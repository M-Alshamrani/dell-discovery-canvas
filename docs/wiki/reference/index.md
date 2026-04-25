# Reference

**Audience**: anyone looking up a specific fact.
**Mode**: descriptive, dry, comprehensive.

A reference is **not** a tutorial or how-to. It tells you *what is*, not *what to do*. If a reader needs to act on the information, point them at a how-to.

Most entries here are **auto-derivable** from existing code — when the code changes, the reference must update too. Per the procedure §9.4, every `.dNN` hygiene-pass refreshes these tables.

## Available references

| File | Auto-derived? | Source |
|---|---|---|
| **[file-tree.md](file-tree.md)** | Yes | `find` over the source dirs |
| **[dependency-graph.md](dependency-graph.md)** | Yes | `import` statement scan |
| **[test-inventory.md](test-inventory.md)** | Yes | `describe()` / `it()` parse of `appSpec.js` + `demoSpec.js` |
| **[localStorage-keys.md](localStorage-keys.md)** | No (manually maintained) | each storage owner's normalizer |
| **[field-manifest.md](field-manifest.md)** | Yes | `core/fieldManifest.js` |
| **[GLOSSARY.md](GLOSSARY.md)** | No (manually maintained) | domain terms |
| **[BROWSER_SUPPORT.md](BROWSER_SUPPORT.md)** | No | manual smoke matrix |

For a one-line summary of every business rule in the system, see [docs/RULES.md](../../RULES.md).
For decisions and rationale, see [explanation/](../explanation/).
