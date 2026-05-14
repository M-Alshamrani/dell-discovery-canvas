# Current state vs Desired state

The Discovery Canvas has two parallel views of the customer's install-base: **Tab 2 (Current state)** captures what they have today, **Tab 3 (Desired state)** captures the target architecture for the engagement.

---

## The shape of each tab

| Tab | Captures | Representative tile |
|---|---|---|
| **Tab 2 (Current state)** | what runs in production today | PowerEdge R770 (compute) in Main DC — "tier-1 web app" |
| **Tab 3 (Desired state)** | what the engagement is building toward | PowerEdge R770 (compute) in Main DC — "tier-1 web app" (Keep) OR PowerProtect Data Manager (data protection) in Main DC — NEW (Introduce) |

Both tabs use the same layer × environment matrix; the difference is which `instance.state` field value the tile carries (`current` vs `desired`).

---

## The disposition lifecycle

Every desired-state tile has a `disposition` that says what role it plays in the transition from current to target architecture:

| Disposition | Current state Δ | Desired state Δ | Net asset Δ | Common case |
|---|---|---|---|---|
| **Keep** | 1 stays | 0 added | 0 | Customer is happy with the existing PowerEdge cluster; no change planned |
| **Enhance** | 1 stays (same vendor) | 0 or 1 added (uplifted variant) | 0 | Upgrade PowerStore 500T → PowerStore 1200T (same family, bigger) |
| **Replace** | 1 retired (logical) | 1 added | 0 (1-for-1 swap) | Swap Veeam → PowerProtect Data Manager |
| **Consolidate** | N retired | 1 added | -(N-1) | Merge 3 legacy storage arrays into 1 PowerStore |
| **Retire** | 1 retired | 0 added | -1 | Sunset on-prem Exchange; no replacement (workloads move to M365) |
| **Introduce** | 0 (untouched) | 1 added | +1 (greenfield) | First-ever PowerProtect Cyber Recovery Vault for this customer |
| **Operational** | — | — | gap-only | Establish RTO testing schedule; no instance delta |

---

## The originId link

Replace + Consolidate + Enhance dispositions carry an `originId` on the desired-state tile pointing at the current-state tile being replaced/uplifted. This is how the canvas knows that *"PowerProtect Data Manager (desired)"* is the replacement for *"Veeam Backup VBR (current)"*.

The `originId` link powers:
- **Tab 2 → Tab 3 mirror rendering**: current tiles appear as ghost tiles in desired state until reviewed (so you don't lose track of what hasn't been triaged)
- **Gap → instance linkage**: gaps reference both current + desired instances via `relatedCurrentInstanceIds[]` + `relatedDesiredInstanceIds[]`
- **Executive summary's "what's changing" narrative**: the report enumerates each disposition transition by reading originId chains

---

## When to add a tile in Tab 2 vs Tab 3

- **Tab 2** for everything the customer has TODAY (regardless of whether you're keeping, replacing, or retiring it). If the customer mentions an existing technology in the discovery conversation, it lands in Tab 2.
- **Tab 3** for what the engagement is BUILDING (whether net-new or replacing a Tab 2 tile). If you wouldn't sell it, you wouldn't list it here.
- **Don't double-count**: if a tile is Keep, it lives in Tab 2 and appears in Tab 3 via mirror rendering — you don't add a separate Tab 3 tile for it.

---

## Common confusions

- ***"I added a tile in Tab 3 but Tab 2 didn't update"*** — Tab 3 doesn't write back to Tab 2 by design. If the customer ALREADY has the technology, capture it in Tab 2 first; the disposition + originId in Tab 3 then ties them together.
- ***"What disposition do I use for a tile that's staying without changes?"*** — Keep (1 stays, 0 added). The customer keeps using it; nothing is added on the Dell side.
- ***"What if the customer wants to introduce TWO new instances?"*** — Two separate Introduce tiles, both in Tab 3, both with no originId. Each is its own greenfield add.
- ***"How is Replace different from Retire?"*** — Replace has a 1-to-1 desired counterpart (originId chain); Retire has zero desired counterpart (the function is being removed entirely, often because workloads move to a different layer or to SaaS).
- ***"Consolidate confuses me — what's the originId pointing at?"*** — In a 3→1 consolidation, the 1 desired tile's originId points at one of the 3 current tiles (typically the largest or most-recent). The other 2 current tiles are linked-but-retired (each gets disposition='retire' on its mirror; the originId link is on the consolidator).

---

## Cross-references

- `docs/v3.0/SPEC.md` §S25 (disposition semantics) + §S43 (instance lifecycle)
- `docs/RULES.md` §13 (Per-gapType Disposition Rules) + §14 (Asset Lifecycle by Action)
- `docs/GAP_TYPE_VS_DISPOSITION.md` — gap_type (the WORK) vs disposition (the OUTCOME)
- `docs/CANVAS_CHAT_USER_GUIDE.md` — how the chat reasons about disposition transitions
