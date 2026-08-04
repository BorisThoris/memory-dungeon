# App analysis (living wiki page)

**Purpose:** Single **maintained** orientation doc for engineers and agents working in this repo — **quick stamps** (versions, counts), **where truth lives** in code, and a **preserved multi-pass rollup** (methodology + consolidated findings from parallel analysis rounds). **Not** a substitute for [SOURCE_MAP.md](./SOURCE_MAP.md), [ARCHITECTURE.md](./ARCHITECTURE.md), or gameplay epics — update those when modules change; refresh **version stamps** and **indicative counts** here when shipping or after large merges.

**Historic methodology:** Treat “100+ agents” in planning as **two 50-pass stacks** (or four waves) merged into **one** rollup — see [multiple-agents.md](./multiple-agents.md). Rounds 1–3 covered renderer shell, `src/shared`, Electron main/preload, packages, e2e, doc cross-checks; Round 2 refined dev-sandbox matrix, store/IPC split, floor-schedule tests, HUD catalog class names, e2e `schemaVersion`, `paused` vs `ViewState`, …; **Round 3** went deeper (`App` `useShallow`, gauntlet interval, `flipTile` guards, pause **P**, wheel `passive: false`, Codex/Settings/Inventory UX, dead DOM FLIP exports, `RELIC_ROSTER` vs `RelicId`, decoy key duplication, large `useAppStore` / `TileBoardScene` files). **Round 4** synced wiki/tree (bootstrap split, procedural illustration pipeline, Playwright matrices, `docs/` inventory).

**Method (ongoing “turbo” passes):** Read `package.json` scripts, `src/shared/contracts.ts` version constants, and spot-check hot paths (`useAppStore`, `game.ts`, floor schedule, renderer shell). Re-run `yarn verify` / Playwright when behavior must be proven — structural truth here is not runtime proof.

---

## Product & stack

| Fact | Detail |
|------|--------|
| SKU | Windows-first **Electron** desktop game (“Memory Dungeon” rebuild); Vite + React renderer |
| Rules | Pure TS in **`src/shared/game.ts`** on **`RunState`** — not in IPC or main |
| UI | **`src/renderer/`** — Zustand **`useAppStore`**, R3F board (**`TileBoard` / `TileBoardScene`**) |
| Shell | **`src/main/`** persistence + Steam; **`src/preload/`** bridge; **`src/shared/ipc-channels.ts`** canonical IPC names + legacy aliases in **`main/ipc.ts`** |
| Product DoD | REG-068 ship gate: [Complete product definition of done](../product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md) — offline-first v1, mobile/shell quality required, online leaderboards deferred |

---

## Version stamps (refresh when shipping)

| Constant | Location | Value (last audit) |
|----------|----------|---------------------|
| `GAME_RULES_VERSION` | `contracts.ts` | **14** |
| `SAVE_SCHEMA_VERSION` | `contracts.ts` | **6** |
| `FLOOR_SCHEDULE_RULES_VERSION` | `floor-mutator-schedule.ts` | **3** |

Bump **`GAME_RULES_VERSION`** when pair generation, scoring, or player-facing rules change; **`SAVE_SCHEMA_VERSION`** when save merge/migration changes; **`FLOOR_SCHEDULE_RULES_VERSION`** when endless floor mutator **schedule** rules change — and extend **`floor-mutator-schedule.test.ts`** per the module header checklist.

---

## Authority chain (where to look first)

1. **Mechanics / Codex copy:** `mechanics-encyclopedia.ts` → `game-catalog.ts` UI helpers; regenerate appendix via `yarn docs:mechanics-appendix` when catalog rows shift.
2. **Types + achievement IDs + settings shape:** `contracts.ts`.
3. **Turn resolution, powers, mutators, level advance:** `game.ts` (+ `mutators.ts`, `relics.ts`, `floor-mutator-schedule.ts` for metadata/schedule).
4. **Shell navigation + timers + IPC orchestration:** `useAppStore.ts` (large — pair with [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md)).
5. **Bootstrap order:** `main.tsx` → `initRendererShell.tsx` (`bootstrapWebRenderer`) → theme + **`PlatformTiltProvider`** → **`NotificationHost`** → **`App`** (matches consolidated finding #1).

---

## Executive map

| Layer | Truth in code | Primary docs |
|--------|-----------------|--------------|
| Game rules | `src/shared/game.ts`, `contracts.ts` | [GAMEPLAY_MECHANICS_CATALOG.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.md), epics |
| Shell / nav | `App.tsx`, `useAppStore.ts` | [NAVIGATION_MODEL.md](../new_design/NAVIGATION_MODEL.md), [SCREEN_SPEC_GAMEPLAY.md](../new_design/SCREEN_SPEC_GAMEPLAY.md) |
| Board WebGL | `TileBoard.tsx`, `TileBoardScene.tsx`, `tileBoardViewport.ts` | [FX_REDUCE_MOTION_MATRIX.md](../new_design/FX_REDUCE_MOTION_MATRIX.md), [TILE_BOARD_WEBGL_FX_V2_AUDIT.md](../reference-comparison/TILE_BOARD_WEBGL_FX_V2_AUDIT.md) |
| Matched rim FX tunables | `gameplayVisualConfig.ts`, rim shader/material/geometry | Same + sandbox `?devSandbox=1&fx=matchedRimFire` |
| Procedural overlay illustration | `cardFace/proceduralIllustration/` (`ILLUSTRATION_GEN_SCHEMA_VERSION` in `illustrationSchemaVersion.ts`), `cardIllustrationDraw.ts`, `tileTextures.ts`, `gameplayVisualConfig.ts` (`GAMEPLAY_CARD_VISUALS.textureVersion`), dev gallery + regression keys (`ProceduralIllustrationGallerySandbox`, `illustrationRegressionPairKeys`) | [SOURCE_MAP.md](./SOURCE_MAP.md) cardFace + dev rows; [visualization-work/ARCHITECTURE.md](../visualization-work/ARCHITECTURE.md) “When to bump what”; E2E `tile-card-face-illustration-*.spec.ts` |
| Electron I/O | `main/`, `preload/`, `desktop-client.ts` | This wiki: ARCHITECTURE, SOURCE_MAP |
| IPC channel names | `ipc-channels.ts`, `main/ipc.ts` (dual registration: canonical + legacy aliases) | [SOURCE_MAP.md](./SOURCE_MAP.md) shared + main rows |
| Screen copy bundles | `copy/` (e.g. game over, inventory), `ui/strings/` | Future i18n hooks; centralized for a11y review |
| Player copy / Codex | `mechanics-encyclopedia.ts`, `game-catalog.ts` | Encyclopedia + `yarn docs:mechanics-appendix` → auto-appendix |

---

## Gameplay & product bullets (compressed)

- **AI-first gameplay core:** Eighty-five vertical slices now cover the primary deterministic loop: schema-validated seeded start/restart, input, turns, utility powers, exits, floor completion, route/side-room/shop/relic interludes, zero-life terminal cleanup, typed run finalization, floor advancement, pause/debug lifecycle, safety repair, event-only feedback, persistence, replay, and generated-board fairness. Graph v85 keeps all 127 active `RunState` fields plus all 37 command variants across the active-run and bootstrap schemas and all 57 event variants compiler-indexed, rejects production renderer state writes, and enforces source-derived orchestration budgets. `run.start` captures host time/entropy, rules, save-derived context, gameplay settings, and exact restart contract parity before the pure bootstrap reducer constructs `RunState`; `run.interlude_terminal_resolve` owns atomic dead-interlude cleanup, while `run.finalize` serializes canonical evaluated achievement IDs, validates the terminal summary, and places its own final command/event into the bounded saved journal before React selects the game-over screen. Even dev/E2E game-over fixtures now cross the same finalization adapter, with a recursive renderer guard preventing UI code from importing any summary constructor. Renderer commands and historical shared state-in/state-out calls now converge on one accepted-command transaction; `game.ts` is an import-free public barrel, no production module imports it, and the raw board-turn fallback plus duplicate flip/Destroy/exit reducer wrappers are retired behind a recursive boundary. Generated-board properties, fairness, endless simulation, and nine-build traces share the replayable command solver. Thirteen presentation ratchets extract match/mismatch lanes, route/onboarding/Gambit/wager signals, floor-clear feedback, recall-aware route choice, board-floater orchestration/projection plus focused match and mismatch presentations, the floor-clear decision/result presentation boundaries, route-choice and selected-to-active route consequences, plus deterministic next-floor preview from `GameScreen`, cutting it from 6,812 to 1,874 physical lines and holding its ceiling at 1,950 modeled lines/55 imports. Board-floater ceilings remain 225 lines/four imports for the adapter, 875/five for match rewards, and 350/three for mismatch recovery. The 16,399-relationship model covers 145 mechanics and 681 curated edges, retains 27 player-visible states, and reports zero ownership, orchestration, protocol, or feedback diagnostics, while the nine-build gate still completes all 324 floors with zero rejected commands and exact replay. Architecture and current gaps live in [`.ai/GAMEPLAY_MIGRATION.md`](../../.ai/GAMEPLAY_MIGRATION.md).

- **Ship gate:** REG-068’s reusable acceptance bar lives in [Complete product definition of done](../product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md). Use it before opening broad run-map/economy work, and keep REG-119 as the later close-the-loop acceptance report.
- **Modes:** Classic, daily, endless (floor schedule), gauntlet, meditation, puzzle — mode gates live in shared helpers + `game.ts` constructors; endless uses **`pickFloorScheduleEntry`** / **`usesEndlessFloorSchedule`** when rules version ≥ schedule version.
- **Powers & meta:** `powersUsedThisRun` gates **Perfect Memory** (`ACH_PERFECT_CLEAR`); pins do not set the flag — see encyclopedia + `RunState` JSDoc. Inventory exposes a **muted hint** via `copy/inventoryScreen.ts` aligned with that contract.
- **Achievements:** Seven `AchievementId` values — Steam mapping 1:1 in `main/steam.ts`; unlock path **save locally then Steam** (see § Achievements ↔ Steam parity below). **Honors** (local titles) live in `honorUnlocks.ts` and `saveData.unlocks` `honor:*` tags.
- **Persistence:** Renderer uses **`persistBridge.ts`** (normalized writes, failure UX); not raw Zustand `persist`.
- **Audio:** `gameSfx.ts` — Web Audio; `resumeAudioContext()` runs on tile press **and** when resolve applies (immediate or timed)—not only on gesture.
- **Visuals:** Card faces + procedural illustration + `tileTextures` / `gameplayVisualConfig`. **Schema / roll-table / stroke-rule changes** → bump **`ILLUSTRATION_GEN_SCHEMA_VERSION`** (`illustrationSchemaVersion.ts`) so cache keys and hashes stay aligned. **Overlay pipeline / bitmap cache integration** outside pure illustration schema → bump **`GAMEPLAY_CARD_VISUALS.textureVersion`** per `gameplayVisualConfig.ts` (see [visualization-work/ARCHITECTURE.md](../visualization-work/ARCHITECTURE.md)).

---

## Quality & automation

| Layer | Signal |
|-------|--------|
| Unit / integration | **Vitest** — `yarn test`; **75** `src/**/*.test.ts` + **4** `packages/notifications/src/*.test.ts` (same graph as [TOOLING.md](./TOOLING.md) Vitest discovery — re-count after merges) |
| E2E | **Playwright** — indicative **29** `e2e/*.spec.ts` files; curated gate **`yarn test:e2e:renderer-qa`** (see [E2E_AND_QA.md](./E2E_AND_QA.md)) |
| CI local | **`yarn fullcheck`** = lint (+ test extension guard) + typecheck + vitest |
| Headless sim | **`yarn sim:endless`** — scripted endless sampling (`scripts/sim-endless.ts`) |

**E2E:** Playwright `baseURL` `http://127.0.0.1:5173`. Seeded saves in `e2e/` use **`SAVE_SCHEMA_VERSION`** from `contracts.ts` so injected `localStorage` matches the live schema stamp.

---

## Documentation surface

- **`docs/**/*.md`:** indicative **~295** files (2026-04-25 recount) — index in [DOCS_CATALOG.md](./DOCS_CATALOG.md); polish rollup [GAMEPLAY_POLISH_AND_GAPS.md](../gameplay/GAMEPLAY_POLISH_AND_GAPS.md).
- **Internal wiki:** [README.md](./README.md).

**Wiki alignment notes:** [GAMEPLAY_POLISH §16](../gameplay/GAMEPLAY_POLISH_AND_GAPS.md) and [epic-mutators Schedules](../gameplay/epic-mutators.md) reference **`floor-mutator-schedule.test.ts`**. **`copy/inventoryScreen.ts`** documents Perfect Memory eligibility next to “Powers used this run”.

---

## Consolidated findings (high signal, preserved rollup)

1. **Renderer bootstrap:** `main.tsx` calls `bootstrapWebRenderer()`; `initRendererShell.tsx` applies theme CSS vars and mounts `PlatformTiltProvider` → `NotificationHost` → `App`. `App.tsx` maps `ViewState` to screens, portals (intro, in-run settings), and sets `data-view`, `data-reduce-motion`, etc.
2. **Store:** `useAppStore` orchestrates IPC via `desktopClient`, timers (memorize/resolve/gauntlet), `game.ts`, and `gameSfx`; persistence is explicit (`hydrate` / `persistSaveData`), not Zustand `persist`.
3. **Gauntlet:** `isGauntletExpired` is consulted from `pressTile` and from a **subscription** that installs a **~300ms `setInterval`** while an active gauntlet run is in `playing` view—not “the subscription fires every 300ms.”
4. **Gambit:** `pressTile` can advance the **third flip** while `run.status === 'resolving'` (exception to a naive “playing-only” mental model).
5. **Steam:** Main uses steamworks when available; failure yields a **mock** adapter (`isConnected` false). **Unlock** IPC always persists locally before Steam activation.
6. **Main process:** `index.ts` does not register Electron **application menus**—only `autoHideMenuBar`; the main menu UI is renderer/React.
7. **Mechanics appendix:** Regenerate with `yarn docs:mechanics-appendix` after catalog/encyclopedia changes so `GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md` matches `GAME_RULES_VERSION` / counts.
8. **E2E:** Curated gate `yarn test:e2e:renderer-qa`. Inventory: [E2E_AND_QA.md](./E2E_AND_QA.md).
9. **Audio:** Covered above (resume on press and resolve).
10. **Assets:** `ASSET_SOURCES.md` should stay aligned with `assets/ui/index.ts` (e.g. choose-path background filename if art revs).
11. **`App.tsx`:** Subscribes with **`useShallow`** so the selected object of navigation/run/settings fields only re-renders when a shallow field changes.
12. **Gauntlet expiry:** `syncGauntletExpiryWatch` starts a **300ms** `setInterval` only when `view === 'playing'`, gauntlet mode, deadline set, not `gameOver`; clears when those fail or on `clearAllTimers`.
13. **`flipTile`:** Early-outs for missing board, status not `playing` (except gambit third while `resolving`), flip count cap, non-hidden tile, sticky block on first flip.
14. **`DEFAULT_SETTINGS`:** Matches full **`Settings`** + **`debugFlags`** shape in TypeScript; no missing contract keys in defaults.
15. **Decoy key:** `'__decoy__'` is repeated in several modules (not a single shared export); consider centralizing `DECOY_PAIR_KEY` from `contracts` or `game.ts` to prevent drift.
16. **DOM FLIP shuffle:** `captureTileRects` / `runShuffleFlipFromRects` in `shuffleFlipAnimation.ts` are **unwired** in the app; active path is WebGL stagger + `TileBoard` motion budget.
17. **Shell exports:** [`initRendererShell.tsx`](../../src/renderer/initRendererShell.tsx) also exports `applyRendererThemeToDocument` / `mountRendererApp` for tests or alternate hosts—not only `bootstrapWebRenderer()`.
18. **Procedural illustration:** Pair-key–seeded specs under `cardFace/proceduralIllustration/` feed Canvas drawing (`drawProceduralTarotIllustration`, integrated via `cardIllustrationDraw.ts`). **Roll tables / stroke rules / deterministic illustration output** → bump **`ILLUSTRATION_GEN_SCHEMA_VERSION`**. **`textureVersion`** bumps cover overlay/pipeline/cache layers described in `gameplayVisualConfig.ts`, not a substitute for schema bumps — see [visualization-work/ARCHITECTURE.md](../visualization-work/ARCHITECTURE.md).
19. **IPC naming:** [`ipc-channels.ts`](../../src/shared/ipc-channels.ts) is the shared source of truth for **`save:*`**, **`steam:*`**, **`window:*`** invokes; [`main/ipc.ts`](../../src/main/ipc.ts) registers **both** those names and deprecated **`desktop:*`** aliases so older preload assumptions keep working.
20. **Persistence bridge:** [`persistBridge.ts`](../../src/renderer/store/persistBridge.ts) wraps `desktopClient.saveGame` / `saveSettings` with `normalizeSaveData`, consecutive write-failure counting, and optional **`registerPersistenceWriteFailureHandler`** for user-visible disk errors—not raw IPC at call sites.
21. **Achievement unlock ordering:** [`achievementPersistence.ts`](../../src/renderer/store/achievementPersistence.ts) **`persistSaveData`** then **`unlockAchievement`** sequentially per REF-036 (avoids electron-store read–modify–write races across parallel Steam unlock IPCs).
22. **Deterministic visuals:** [`hashPairKey`](../../src/shared/hashPairKey.ts) hashes `pairKey` strings for stable illustration / pool inputs alongside seed helpers in `cardFace/proceduralIllustration/`.
23. **Feature flags:** [`feature-flags.ts`](../../src/shared/feature-flags.ts) gates **cloud save** (off until backend) and **opentype glyph** enhancements for card rank/symbol when quality allows.
24. **Extracted shell copy:** Game-over strings in [`copy/gameOverScreen.ts`](../../src/renderer/copy/gameOverScreen.ts); pair-proximity and related UI strings under [`ui/strings/`](../../src/renderer/ui/strings/); keyboard cheat-sheet rows in [`GAMEPLAY_SHORTCUT_ROWS`](../../src/renderer/keyboard/gameplayShortcuts.ts).

### Achievements ↔ Steam parity

- **`AchievementId`** (`src/shared/contracts.ts`): **7** string-literal union members (includes `ACH_ENDLESS_TEN`, `ACH_SEVEN_DAILIES` plus the original five).
- **Steam mapping** (`src/main/steam.ts` `STEAM_ACHIEVEMENT_API_NAME`): **7** keys, `satisfies Record<AchievementId, string>` — full coverage; Partner **API Name** values currently match those literals. Add matching Partner entries for new IDs before expecting Steam activation. Re-verify Partner dashboard after any rename.

---

## Pass index (50 scopes, preserved)

**Shared / rules (1–10):** App entry & tests · `useAppStore` · `game.ts` · `contracts.ts` · encyclopedia + appendix builder · `mutators` + floor schedule · relics / achievements / save / telemetry / rng · tile catalog + puzzles + import/export · graphics + viewport + hints · Electron main + preload.

**Renderer / product (11–20):** `GameScreen` · Tile board stack + viewport · matched rim FX + `gameplayVisualConfig` · HUD + toolbar + `tileTextures` · main menu + choose path + mode art · Codex / inventory / collection / settings / overlays · game over + startup intro · notifications package · `desktop-client` · `gameSfx`.

**Hooks / visuals / modes (21–30):** Fit shell zoom, HUD polite announcements, drag scroll, distraction tick · a11y focusables + theme + `MetaFrame` / `ScreenTitle` · programmatic faces + shuffle animation + resolving selection · dev sandboxes + fixtures · breakpoints + platform tilt + logo sandbox · full e2e inventory · `run-mode-catalog` · proximity + tutorial planes · `ASSET_SOURCES` + UI art · `GAMEPLAY_SYSTEMS_ANALYSIS` accuracy notes.

**Wiki / tooling / docs (31–50):** ARCHITECTURE vs code · TOOLING vs `package.json` · COVERAGE scope anchor · legacy caveats · `cardSvgPlaneGeometry` · MetaScreen CSS-only · docs portal · gameplay README epic table · new_design README · notifications build · Vitest config · Playwright config · mechanics appendix script · CONTRIBUTING appendix step · FX reduce-motion matrix intro · WebGL FX audit doc · UI_TASKS · visual-capture README · research log · root README stack.

**Round 3 (third 50-pass wave):** `useShallow` · gauntlet watch lifecycle · `flipTile` guards · Settings defaults parity · `ACHIEVEMENT_ORDER` vs catalog · daily RNG (`deriveDailyRunSeed`, `deriveDailyMutatorIndex`) · encore merge · DECOY literals · bloom off on `low` · `cameraViewportMode` `never` vs `TileBoard` `compact` · **P** pause · wheel/pointer listeners · `pickTileAtClientPoint` · HUD dual row · three toolbars · Codex tabs META-005 · inventory relic list · OverlayModal focus · GameOver export null path · StartupIntro WebGL vs SVG · achievement toast `aria-live` · silent `playResolveSfx` · `recomputeKey` on Settings · mocked HUD/TileBoard in `GameScreen.test` · dead DOM FLIP · `__devApplySandbox` DEV guard · eslint `e2e` block · `RELIC_ROSTER` completion · `FindableKind` · `peerDependencies` react>=18 · `postinstall` electron-builder · line-count scale (`useAppStore` ~1.4k, `TileBoardScene` ~2.5k).

**Round 4 (wiki + tree sync):** `main.tsx` → [`initRendererShell.tsx`](../../src/renderer/initRendererShell.tsx) (`bootstrapWebRenderer`, `PlatformTiltProvider`) · seeded procedural tarot illustration (`cardFace/proceduralIllustration/`: `illustrationSeed`, roll tables, `drawProceduralTarotIllustration`, manifest/cache key) · `textureVersion` / overlay cache invalidation · `keyboard/gameplayShortcuts.ts` · `dev/legacy/tileStepLegacy` (paths no longer under `dev/` root) · Playwright: `tile-card-face-illustration-regression`, `tile-card-face-illustration-benchmark`, `tile-card-face-overlay-regression`, `a11y-scoped-routes` · package scripts `test:e2e:illustration-regression`, `test:e2e:a11y`, `benchmark:illustration-regression`, `regenerate:illustration-regression` · re-count `docs/**/*.md` when [DOCS_CATALOG.md](./DOCS_CATALOG.md) is audited.

**Round 5 (2026-04-19 turbo wiki pass):** Merged parallel slices into [SOURCE_MAP](./SOURCE_MAP.md) (`desktop-client.ts`, main `*.test.ts`, dev regression row → `hashPairKey`), [TOOLING](./TOOLING.md) (`build:cloudflare`, bake/plates/manifest scripts, **`yarn bake:procedural-set` not in default CI**), [visualization-work/README](../visualization-work/README.md) → [multiple-agents](./multiple-agents.md); corrected bootstrap order + **schema vs `textureVersion`** bumps in executive map / findings; [REF-020](../refinement-tasks/REF-020.md) Related; doc count **~293** (snapshot for that pass — superseded by Round 6; [DOCS_CATALOG](./DOCS_CATALOG.md)).

**Round 6 (2026-04-25 wiki refresh):** Reconciled **version stamps** to `contracts.ts` / `floor-mutator-schedule.ts` (`GAME_RULES_VERSION` **14**, `FLOOR_SCHEDULE_RULES_VERSION` **3**). Re-counted **Vitest** (**75** `src/**/*.test.ts` + **4** `packages/notifications` tests) and **Playwright** (29 `e2e/*.spec.ts`); doc inventory **~295** `docs/**/*.md`. Extended [DOCS_CATALOG](./DOCS_CATALOG.md) (root memos, `epics/`, `refinement-tasks/`, `ui-design-reference` note, `visual-capture/improvement-workqueue`) and aligned [COVERAGE](./COVERAGE.md) + [E2E_AND_QA](./E2E_AND_QA.md). Regenerated [mechanics auto-appendix](../gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md) via `yarn docs:mechanics-appendix`.

---

## Ultra consolidated slice (structural audit)

Structured slice audit merged into [SOURCE_MAP](./SOURCE_MAP.md) + wiki hygiene: **`ipc-channels`** / dual IPC registration, **`persistBridge`** / **`achievementPersistence`**, **`feature-flags`** / **`hashPairKey`**, renderer **`copy/`** / **`ui/strings/`** / **`GAMEPLAY_SHORTCUT_ROWS`**. Details: **consolidated findings #19–24** above. Behavior still needs **`yarn verify`** / Playwright—not doc-only proof.

---

## Residual risks (backlog)

- Duplicated **`__decoy__`** literals.
- Unwired DOM FLIP shuffle exports (`shuffleFlipAnimation.ts`); live path is WebGL stagger + `TileBoard`.
- **`FEATURE_CLOUD_SAVE`** remains false until a backend exists.

---

## Maintenance

When navigation, major modules, or versioning change: update [SOURCE_MAP.md](./SOURCE_MAP.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) first, then refresh **version stamps** and **indicative counts** in **this file** — do **not** spawn new dated narrative analysis docs; fold discoveries here or into authoritative topic files.

**Branch health is separate from wiki counts:** `yarn verify` (typecheck + Vitest) is the product-truth check; a red `tsc` or test failure is engineering debt, not refuted by updated stamps in this page alone.
