# Documentation coverage (how “90–100%” is meant)

This page states **what is covered**, **how we measure it**, and **what is explicitly out of scope** so the “~90–100%” claim is honest.

## Scope definition

**In scope:** The **Memory Dungeon Windows / Electron desktop** product in this repo: `src/` (active paths), `e2e/`, `scripts/`, `packages/notifications`, and **all** markdown under `docs/` (including design backlog and audits).

**Product acceptance bar:** [`docs/product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md`](../product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md) is the REG-068 gate for the complete-product definition of done. It defines v1 as offline/local-first with Steam where already targeted, first-class responsive UI, shell/gameplay quality, save trust, and hardening evidence; it also records online leaderboards, mandatory accounts, and server-backed services as out of scope for this ship.

**Desktop UI surface (orientation):** The shipped shell follows `ViewState` in `contracts.ts` as wired by [`App.tsx`](../../src/renderer/App.tsx): boot → **MainMenu** (`menu`) → **ChooseYourPathScreen** (`modeSelect`) → **CollectionScreen** / full-page **Inventory** / **Codex** / **Settings** → primary **GameScreen** (`playing`) → **GameOverScreen** (`gameOver`). In-run **Settings**, **Inventory**, **Codex**, and floor-clear **ShopScreen** (`shop`) can present as overlays while the session stays logically on gameplay (`subscreenReturnView` / modal patterns); the vendor uses temporary run **shop gold** from `RunState`, not menu meta. **Dev-only URL harness** (`?devSandbox=1…`, fixtures, FX preview): single reference in [SOURCE_MAP — Renderer dev sandbox](./SOURCE_MAP.md#renderer-dev-sandbox). Refresh this blurb if `ViewState` or `App` routing changes.

**Out of scope for line-by-line wiki coverage:**

- **Removed legacy Expo prototype** — was under `legacy/expo-roguelike/`; no longer in-tree (see [`legacy/README.md`](../../legacy/README.md)).
- **Binary assets** (PNGs, installers, Steam DLLs, most of `docs/ui-design-reference/`, capture PNGs) — indexed at **folder + workflow** level, not file-by-file.
- **Old Expo / React Native tech-stack assumptions** as *current* architecture — replaced by [MEMORY_DUNGEON_PROJECT_REPORT.md](../MEMORY_DUNGEON_PROJECT_REPORT.md); see [LEGACY_AND_CAVEATS.md](./LEGACY_AND_CAVEATS.md).

## Coverage dimensions

| Dimension | Target | Where satisfied |
|-----------|--------|-----------------|
| Gameplay rules + contracts | Complete for shipped mechanics | [GAMEPLAY_MECHANICS_CATALOG.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.md), epics, [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) |
| Complete product DoD | Offline-first v1 ship gate and per-REG merge checklist | [COMPLETE_PRODUCT_DEFINITION_OF_DONE.md](../product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md) |
| `src/shared/` modules | Named + role | [SOURCE_MAP.md](./SOURCE_MAP.md) |
| Electron main / preload | Files + responsibilities | [SOURCE_MAP.md](./SOURCE_MAP.md), [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Renderer areas | Folders + purpose | [SOURCE_MAP.md](./SOURCE_MAP.md) |
| Tooling | Scripts explained | [TOOLING.md](./TOOLING.md), root [README.md](../../README.md) |
| E2E | Spec list | [E2E_AND_QA.md](./E2E_AND_QA.md) |
| Every `docs/**/*.md` | Listed with summary | [DOCS_CATALOG.md](./DOCS_CATALOG.md) |
| Multi-agent upkeep | Process | [multiple-agents.md](./multiple-agents.md) |

## Score (interpreted)

Against the **in-scope** definition above:

- **Documentation inventory:** ~**100%** of markdown files under `docs/` appear in [DOCS_CATALOG.md](./DOCS_CATALOG.md) (last full pass: **295** files, 2026-04-25; re-count with `Get-ChildItem docs -Recurse -Filter *.md` on Windows).
- **Product + engineering orientation:** ~**95–100%** of active `src/` surface is mapped in [SOURCE_MAP.md](./SOURCE_MAP.md) at module/folder granularity (not every React component name).
- **Overall “everything in the game”** if you include legacy + every asset byte: **not 100%** by design; use this page’s **out of scope** list.

**Bottom line:** For **shipping and maintaining the desktop game**, treat internal coverage as **~95–100%** for *navigable* documentation and source orientation, with **legacy** and **raw binaries** as the main deliberate gaps.

**Multi-pass agent audits** (see [multiple-agents.md](./multiple-agents.md), [APP_ANALYSIS.md](./APP_ANALYSIS.md)) are iterative inventory passes over maps and markdown; they improve orientation and catch doc drift but **do not** replace running the app, tests, or Playwright for behavioral truth.

## When this file goes stale

Update **COVERAGE.md** when:

- New top-level `docs/` folders are added (add to catalog + dimension table).
- A new major `src/` subtree appears (extend SOURCE_MAP).
- The team changes what “in scope” means (e.g. if legacy is revived).
