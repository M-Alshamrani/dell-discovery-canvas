# Run your first workshop

**Audience**: anyone running the Dell Discovery Canvas for the first time.
**Time**: ~20 minutes.
**Outcome**: you'll have walked the demo session through all 5 tabs and seen a generated Roadmap.

---

## Prerequisites

- A laptop running Windows 10+, macOS, or Linux.
- **Docker Desktop** (Windows / macOS) or Docker Engine (Linux). [Install Docker.](https://docs.docker.com/get-docker/)
- A modern browser (last 2 majors of Chrome / Firefox / Safari).

That's it. No npm, no Node, no build chain. **Stop here and confirm Docker works** before continuing — `docker version` should print without error.

---

## Step 1 · Clone + start the container

```bash
git clone https://github.com/M-Alshamrani/dell-discovery-canvas.git
cd dell-discovery-canvas
docker compose up -d --build
```

The image builds in ~30 seconds. When it finishes, verify:

```bash
curl http://localhost:8080/health
# → ok
```

## Step 2 · Open the app

In your browser: **http://localhost:8080**.

You'll see the **Context tab** (Tab 1) with a fresh-start welcome card: two CTAs ("↺ Load demo" and "Start fresh"). At the very bottom, a thin status bar; if all 509 tests passed, it briefly displays "✅ All 509 tests passed" before auto-dismissing after 5 seconds.

> **Stop and ask** if you don't see the green-pass banner. Either tests are failing (bug — check DevTools console) or the page didn't load fully.

## Step 3 · Load the Acme FSI demo

Click **"↺ Load demo session"** on the welcome card.

You'll see "Acme Financial Services" populate the customer name. Three driver tiles appear: **Cyber Resilience**, **Modernize Aging Infrastructure**, **Cost Optimization**. Click any one — the right panel shows that driver's conversation starter, priority dropdown, and outcomes.

## Step 4 · Walk Tabs 2-3 (Current → Desired State)

- **Tab 2 · Current State** — a 6-row × 4-column matrix (6 layers including Workload at top, 4 environments). Demo populates ~12 instances across the matrix. Click any tile; the right panel shows its details (vendor, criticality, notes).
- **Tab 3 · Desired State** — the **future** matrix. Some tiles are **mirrors** (greyed, disposition = unset) of current tiles; some are net-new "introduce" entries. Click a mirror tile and pick a disposition (Keep / Enhance / Replace / Consolidate / Retire / Operational). For non-Keep choices, a **gap** is auto-drafted in Tab 4.

## Step 5 · Tab 4 · Gaps

7 gap cards are present in the demo (3 Now / 3 Next / 1 Later), arranged on a phase-kanban. Each card shows urgency (colour + shape), gap type pill, description, affected layers/envs, linked instances, status.

Try:
- **Click a gap** → right-panel detail. Read the auto-suggested driver chip if `driverId` isn't set.
- **Drag a card** between phase columns → the linked desired tile's `priority` re-syncs.
- **Click "Show closed gaps"** → no closed gaps in demo by default; this filter chip surfaces v2.4.11's status-closed semantics.

## Step 6 · Tab 5 · Reporting (the crown jewel)

Five sub-tabs:
- **Overview** — Coverage + Risk panels, plus a "Session Brief" prose summary.
- **Heatmap** — per-(layer, environment) risk score, dual-channel (colour + shape).
- **Gaps Board** — a tabular cross-cut of every gap.
- **Vendor Mix** — Dell vs non-Dell tile distribution.
- **Roadmap** — **the crown jewel**. Programs (drivers) × Phases (Now / Next / Later) swimlane grid. Each cell holds project cards (auto-grouped from `(env, layer, gapType)`).

Click any project card → right panel shows the gaps inside it, the linked Dell solutions (deduped from desired tiles), the urgency rollup.

## Step 7 · Try AI (optional)

If you have an Anthropic, Gemini, or local-LLM API key:

1. Click the **gear icon** (top right) → Settings → AI Providers.
2. Pick a provider, paste the key, click **Test connection** → expect "✓ OK".
3. Close the modal.
4. On Tab 1, click any driver, then click **"✨ Use AI ▾"** in the driver detail. Pick "Suggest discovery questions" — the seed skill returns 3 conversation prompts.

## Step 8 · Stop the container

```bash
docker compose down
```

The image stays cached; next time you'll start in <5 seconds.

---

## What you've learned

You've seen the full data flow: Context → Current → Desired → Gaps → Roadmap. You've seen auto-derivation (gaps from dispositions, projects from gaps, urgency from criticality). You've used AI to extend the workshop. Next steps:

- **Read [SPEC §0-§2](../../../SPEC.md)** for the data model.
- **Read [explanation/diagrams/data-model-er.md](../explanation/diagrams/data-model-er.md)** for the entity-relationship picture.
- **Read [adr/ADR-001](../../adr/ADR-001-vanilla-js-no-build.md)** to understand why this codebase looks the way it does.
- **Run a real customer workshop** — use "+ New session", capture their drivers, walk Tabs 2-3 with them, present the Roadmap.

If you broke something while exploring: **"Clear all data"** in the footer wipes localStorage and reloads. The demo is one click away from coming back.
