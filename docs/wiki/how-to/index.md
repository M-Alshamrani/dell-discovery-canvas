# How-to guides

**Audience**: someone who already knows the basics and needs to *do a specific task*.
**Mode**: recipes — opinionated steps with code paths; assume reader knows what they're trying to achieve.

A how-to is **not** a tutorial. It addresses one problem, lists the steps, expects the reader to know the surrounding context. If a reader needs to learn the basics first, point them at a tutorial.

## Available how-tos

- **[Add a new AI provider](add-ai-provider.md)** — extend the 3-provider client (e.g., add OpenAI / Bedrock / Mistral).
- **[Add a new writable field](add-writable-field.md)** — extend the AI write surface (FIELD_MANIFEST + WRITE_RESOLVERS pattern).

## Planned how-tos (queued)

- *Add a new tab to the stepper* — extend `app.js` router + add a view module.
- *Add a new layer or environment* — `core/config.js` + catalog refresh + tests.
- *Add a new disposition / gap-type* — `core/taxonomy.js` + migrator + Suite 39.
- *Bump the nginx base image* — Dockerfile + CI test + smoke.
- *Switch to a different localStorage-versioning scheme* — migrator authoring pattern.
- *Investigate a "tests pass but UX broken" bug* — browser smoke + DOM inspection technique.
