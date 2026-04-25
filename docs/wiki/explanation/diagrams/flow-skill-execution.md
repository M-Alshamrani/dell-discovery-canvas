# Flow · AI Skill Execution

**Audience**: contributors touching the AI platform.
**Purpose**: show end-to-end what happens when a presales engineer clicks a skill in the "✨ Use AI ▾" dropdown — from button click to applied write to re-rendered view.

---

## Sequence

```mermaid
sequenceDiagram
    actor user as Presales engineer
    participant view as ui/views/<Tab>View
    participant btn as ui/components/UseAiButton
    participant skse as services/skillEngine
    participant pg as core/promptGuards
    participant ai as services/aiService
    participant nginx as nginx LLM proxy
    participant llm as Upstream LLM<br/>(Anthropic / Gemini / local)
    participant aic as interactions/aiCommands
    participant br as core/bindingResolvers
    participant ss as state/sessionStore
    participant us as state/aiUndoStack
    participant se as core/sessionEvents
    participant app as app.js (single subscriber)

    user->>view: clicks "✨ Use AI ▾"
    view->>btn: render dropdown via skillsForTab(tabId)
    user->>btn: picks "Tune driver outcomes"
    btn->>skse: runSkill(skill, session, context)

    skse->>skse: renderTemplate(promptTemplate, scope)
    skse->>pg: getSystemFooter(skill.responseFormat)
    pg-->>skse: footer string (text-brief / json-scalars / json-commands)
    skse->>ai: chatCompletion({provider, model, messages})

    ai->>nginx: POST /api/llm/{provider}/...<br/>x-api-key / Authorization headers
    nginx->>llm: proxy_pass with SNI + resolver
    llm-->>nginx: response (text or JSON body)
    nginx-->>ai: passthrough

    alt transient error (429 / 5xx)
        ai->>ai: backoff + jitter, retry up to RETRY_MAX_ATTEMPTS
        ai->>nginx: retry
        opt fallback chain configured
            ai->>ai: walk fallbackModels[]
        end
    end

    ai-->>skse: { text, raw, modelUsed, attempts }
    skse-->>btn: result

    alt responseFormat == "text-brief"
        btn->>view: render .ai-skill-result panel (no writes)
    else responseFormat == "json-scalars"
        btn->>aic: parseProposals(responseText, outputSchema)
        aic-->>btn: { proposals: [{ path, label, before, after }] }
        btn->>view: render proposals panel per applyPolicy

        alt applyPolicy == "show-only"
            view->>user: renders panel, no writes
        else applyPolicy == "confirm-per-field"
            user->>view: clicks "Apply" on a row
            view->>aic: applyProposal(proposal, ctx)
            aic->>us: push(label, sessionSnapshot)
            us->>us: persist to localStorage[ai_undo_v1]
            alt path starts with "session."
                aic->>ss: setPathFromRoot(session, path, value)
            else path is "context.*"
                aic->>br: WRITE_RESOLVERS[path](session, context, value)
                br->>ss: mutate target entity (find by id)
            end
            aic->>se: emit("ai-apply", label)
        else applyPolicy == "confirm-all"
            user->>view: clicks "Apply all"
            view->>aic: applyAllProposals(proposals, ctx)
            aic->>us: push(label, sessionSnapshot) [single entry for batch]
            loop for each proposal
                aic->>ss: setPath OR call resolver
            end
            aic->>se: emit("ai-apply", label)
        else applyPolicy == "auto"
            view->>aic: applyAllProposals immediately
            note right of aic: same path as confirm-all<br/>but no user click
        end
    else responseFormat == "json-commands"
        note right of btn: v2.6.0 (queued)<br/>currently stubbed-rejects
    end

    se->>app: notify({reason: "ai-apply"})
    app->>view: re-render active tab
    view->>view: re-resolve selected entity by id<br/>(per ADR-006 contract)
    view-->>user: updated UI
```

---

## Key invariants exercised by this flow

1. **Every apply pushes ONE undo snapshot before mutation.** [SPEC §12.8 invariant 4](../../../SPEC.md). If `aiUndoStack.push` throws (quota exceeded), apply aborts.
2. **Every successful apply emits `session-changed` with reason `"ai-apply"`.** [SPEC §12.8 invariant 6](../../../SPEC.md). DS16/DS17 are the regression gates.
3. **Direct `session.*` mutation is forbidden outside `interactions/aiCommands.js`.** [SPEC §12.8 invariant 3](../../../SPEC.md). `applyProposal` is the funnel.
4. **`outputSchema` is an allowlist** — keys outside the schema are silently dropped at parse time. [SPEC §12.4](../../../SPEC.md).
5. **`writable: true` is the gate** — paths without it are rejected by `applyProposal`. [ADR-005](../../adr/ADR-005-writable-path-resolver-protocol.md).

## Reliability stack

The retry-with-backoff + per-provider fallback chain (v2.4.5.1, [SPEC §12.4a](../../../SPEC.md)):

| Behaviour | Value |
|---|---|
| Retriable HTTP statuses | 429, 500, 502, 503, 504 + network errors |
| Non-retriable | 401, 403, other 4xx |
| Retries per model | 3 (primary + 2 retries) |
| Base backoff | 500ms, doubles, capped at 4000ms |
| Jitter | full-jitter (`random(0, capped)`) |
| Fallback chain | per-provider `fallbackModels[]`; tried after primary exhausts retries |

## Anthropic-specific note

The `anthropic-dangerous-direct-browser-access: true` header is set unconditionally by `services/aiService.js buildRequest("anthropic", ...)`. Without it Anthropic returns 401 with a message naming the header. See [ADR-003](../../adr/ADR-003-nginx-reverse-proxy-llm-cors.md).

## When this flow changes

- New AI provider → new request-shape branch in `aiService.js buildRequest`, new `location` in nginx proxy.
- New `responseFormat` → new `getSystemFooter` branch, new `parseProposals`/`parseCommands` dispatch in `aiCommands.js`.
- New `applyPolicy` → new branch in `useAiButton.js` proposals UI dispatch.
- v2.6.0 `json-commands` runtime: `parseCommands` + `applyCommands` parallel paths to the existing scalar pipeline; same undo + event-bus contract.
