# Internal wiki (developer knowledge base)

**Audience:** people working in this repo (design, gameplay, UI, engineering). **Not** public marketing or in-game strings.

**Principle:** Prefer **one authoritative doc** per topic and **link** here instead of copying tables or rules. When something changes, update the authoritative file first, then adjust indexes (this page, [gameplay/README.md](../gameplay/README.md), folder READMEs).

**Coverage claim (what “done” means):** [COVERAGE.md](./COVERAGE.md) — methodology, in/out of scope, ~95–100% for the **desktop product** navigational map.

---

## Wiki map (start anywhere)

| Topic | Page |
|--------|------|
| **Architecture** (layers, IPC) | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **`src/` module map** (includes [renderer dev sandbox](SOURCE_MAP.md#renderer-dev-sandbox)) | [SOURCE_MAP.md](./SOURCE_MAP.md) |
| **Scripts, Yarn, pipelines** | [TOOLING.md](./TOOLING.md) |
| **Playwright specs & QA** | [E2E_AND_QA.md](./E2E_AND_QA.md) |
| **Every `docs/*.md` file** (catalog) | [DOCS_CATALOG.md](./DOCS_CATALOG.md) |
| **Legacy code & doc caveats** | [LEGACY_AND_CAVEATS.md](./LEGACY_AND_CAVEATS.md) |
| **Parallel agents / drift control** | [multiple-agents.md](./multiple-agents.md) |
| **Refinement backlog (REF-*) triage cadence** | [refinement-tasks/README.md](../refinement-tasks/README.md) — quarterly hygiene per REF-100 |
| **App analysis (living)** | [APP_ANALYSIS.md](./APP_ANALYSIS.md) — maintained rollup: version stamps, authority chain, consolidated findings, QA/doc counts; [snapshot](./APP_ANALYSIS_SNAPSHOT_2026-04-17.md) / [turbo](./APP_ANALYSIS_TURBO_2026-04-18.md) redirect here |

---

## Quick links (authoritative sources)

| Need | Go to |
|------|--------|
| Full mechanics matrix + contract field appendices | [GAMEPLAY_MECHANICS_CATALOG.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.md) |
| Polish / partial mechanics / risks (rollup) | [GAMEPLAY_POLISH_AND_GAPS.md](../gameplay/GAMEPLAY_POLISH_AND_GAPS.md) |
| Epic deep dives (aligned with catalog) | [gameplay/README.md](../gameplay/README.md) — [Choose Your Path](../gameplay/epic-choose-your-path.md) (mode select shell, touch- and pointer-first library) |
| “Who owns what” in code (systems map) | [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) |
| Mutator reference | [MUTATORS.md](../MUTATORS.md) |
| Stack, `yarn dev`, Steam, run types (short) | [README.md](../../README.md) (repo root) |
| Gameplay SFX wiring (Web Audio) | [AUDIO_INTEGRATION.md](../AUDIO_INTEGRATION.md) |
| New UI redesign package (screens, nav, tasks) | [new_design/README.md](../new_design/README.md) |
| Gameplay implementation backlog (GP-*) | [gameplay-tasks/README.md](../gameplay-tasks/README.md) |
| Speculation / depth notes (floors, helpers, backlog) | [gameplay-depth/README.md](../gameplay-depth/README.md) |
| Mobile UI audit tasks | [UI_TASKS/README.md](../UI_TASKS/README.md) |
| Visual regression matrix & device audits | [visual-capture/README.md](../visual-capture/README.md) |
| Reference vs end-product writeups | [reference-comparison/](../reference-comparison/) |
| Research log | [research/RESEARCH_LOG.md](../research/RESEARCH_LOG.md) |
| WIP asset buckets | [wip-assets/README.md](../wip-assets/README.md) |
| E2E / Playwright README | [e2e/README.md](../../e2e/README.md) |

---

## Map by concern

### Gameplay & content

- **Catalog + epics:** [../gameplay/](../gameplay/README.md)
- **Depth / theory:** [../gameplay-depth/](../gameplay-depth/README.md)
- **Backlog tasks:** [../gameplay-tasks/](../gameplay-tasks/README.md)
- **Standalone topic docs:** [../BALANCE_NOTES.md](../BALANCE_NOTES.md), [../FINDABLES.md](../FINDABLES.md), [../COLLECTIBLE_SYSTEM.md](../COLLECTIBLE_SYSTEM.md), [../SYMBOL_GUIDELINES.md](../SYMBOL_GUIDELINES.md), [../STRAY_TILE.md](../STRAY_TILE.md), and other root-level `docs/*.md` files — full list in [DOCS_CATALOG.md](./DOCS_CATALOG.md)

### Code truth (pointers)

- **Shared rules & types:** `src/shared/` — see [SOURCE_MAP.md](./SOURCE_MAP.md)
- **Shell:** `src/main/`, `src/preload/`
- **UI + board:** `src/renderer/`

### Product & research

- [../MARKET_SIMILAR_GAMES_RESEARCH.md](../MARKET_SIMILAR_GAMES_RESEARCH.md), [../LEADERBOARDS_DEFERRAL.md](../LEADERBOARDS_DEFERRAL.md), [../IDEAS_AUDITS.md](../IDEAS_AUDITS.md), [../GAME_MECHANICS_PLAN.md](../GAME_MECHANICS_PLAN.md)

### Design system & parity

- [../new_design/COMPONENT_CATALOG.md](../new_design/COMPONENT_CATALOG.md), [../new_design/VISUAL_SYSTEM_SPEC.md](../new_design/VISUAL_SYSTEM_SPEC.md), [../new_design/NAVIGATION_MODEL.md](../new_design/NAVIGATION_MODEL.md), [../new_design/TASKS/](../new_design/TASKS/README.md)

### Assets

- [../new_design/ASSET_AND_ART_PIPELINE.md](../new_design/ASSET_AND_ART_PIPELINE.md), [../../src/renderer/assets/ASSET_SOURCES.md](../../src/renderer/assets/ASSET_SOURCES.md)

### Quality & testing

- [TOOLING.md](./TOOLING.md) (test/capture scripts), [E2E_AND_QA.md](./E2E_AND_QA.md), [../visual-capture/INVENTORY.md](../visual-capture/INVENTORY.md)

---

## Maintaining this wiki

- **Indexes:** [DOCS_CATALOG.md](./DOCS_CATALOG.md) should gain a row when a new `docs/**/*.md` is added.
- **Coverage score:** Revisit [COVERAGE.md](./COVERAGE.md) when scope changes.
- **Multi-agent / AI workflows:** [multiple-agents.md](./multiple-agents.md)

### Player-facing changelog template (release notes)

When gameplay rules change, include at least: build/version, user-visible rule changes, and whether **endless mode** uses the scripted per-floor mutator schedule (see `usesEndlessFloorSchedule` in `src/shared/floor-mutator-schedule.ts`).
