# Source map (`src/`)

Quick orientation for navigation and code review. **Rules of thumb:** `shared/` stays pure where possible; `renderer/` owns input, animation, and shell UI; `main/` owns OS integration.

## `src/shared/` (rules + data)

| Module | Role |
|--------|------|
| `game.ts` | Legacy compatibility barrel/backing implementation for gameplay rules; prefer the focused modules below for new imports |
| `game-core.ts` | Run creation, level advance, pause/resume, summaries, memorize timing, gauntlet expiry |
| `board-generation.ts` | Board building, findables counts, board completion, fairness inspection, board identity helpers |
| `turn-resolution.ts` | Pair matching, flip flow, match/mismatch resolution, score timing/floater anchors |
| `board-powers.ts` | Shuffle, region shuffle, tile swap, destroy, peek, flash pair, pins, stray remove, eligibility helpers |
| `dungeon-rules.ts` | Dungeon exits, shops/rooms on cards, dungeon card copy/status, bosses/objectives |
| `route-rules.ts` | Between-floor route choices, route side rooms, route outcome application |
| `shop-rules.ts` | Run shop catalog/offers, wallet pacing, rerolls, purchases |
| `objective-rules.ts` | Endless risk wager, relic offer progression, relic Favor/objective-adjacent helpers |
| `tile-identity.ts` | Shared singleton pair keys used by renderer/tests without importing full gameplay rules |
| `contracts.ts` | Types, settings, mutator IDs, `GAME_RULES_VERSION`, appendices’ source of truth for catalog |
| `mechanics-encyclopedia.ts` | Player-facing codex copy SoT (relics, mutators, modes, topic articles) |
| `game-catalog.ts` | Re-exports encyclopedia + achievements + helpers for UI |
| `mutators.ts` | Mutator **catalog** imported from mechanics-encyclopedia; helpers like `hasMutator`, daily table subset |
| `floor-mutator-schedule.ts` | Endless floor mutator rotation + floor tags |
| `relics.ts` | Relic definitions / hooks consumed by `game.ts` |
| `builtin-puzzles.ts` | Hand-authored puzzle boards |
| `tile-symbol-catalog.ts` | Symbol bands / generation curve |
| `save-data.ts` | Save schema merge, migration hooks |
| `achievements.ts` | Achievement IDs and evaluation helpers |
| `honorUnlocks.ts` | Local-only honor/title unlocks (`honor:*` tags in `saveData.unlocks`; no Steam slot) |
| `telemetry.ts` | Local telemetry payloads / consent gates |
| `rng.ts` | Seeded RNG utilities |
| `utc-countdown.ts` | Daily window / UTC helpers |
| `run-export.ts` | Import/export serialization for runs |
| `puzzle-import.ts` | Validates user **puzzle JSON** (`title` + `tiles`) for `createPuzzleRun` |
| `graphicsQuality.ts` | Quality tier presets for renderer |
| `cameraViewportMode.ts` | Breakpoint-derived camera / shell mode |
| `pairProximityHint.ts` | Pair-distance hint math (shared with renderer) |
| `focusDimmedTileIds.ts` | Focus-assist dimming set |
| `ipc-channels.ts` | Canonical Electron `ipcMain.handle` channel names (`save:*`, `steam:*`, `window:*`) plus `DESKTOP_IPC_CHANNELS` mapping to `DesktopApi`; legacy `desktop:*` aliases for backward compatibility |
| `feature-flags.ts` | Product gates (`FEATURE_CLOUD_SAVE`, `FEATURE_CARD_OPENTYPE_GLYPHS`, …) consumed by UI |
| `hashPairKey.ts` | Stable string hash for deterministic visuals (tiles, illustration pools / caches) |
| `*.test.ts` | Vitest coverage beside modules above |

## `src/main/` (Electron main)

| File | Role |
|------|------|
| `index.ts` | App lifecycle, `BrowserWindow`, IPC registration, persistence + Steam services (no Electron **Menu** API) |
| `ipc.ts` | IPC handlers: registers [`ipc-channels`](../../src/shared/ipc-channels.ts) canonical names **and** legacy `desktop:*` aliases (same handlers) |
| `persistence.ts` | electron-store: saves, settings paths |
| `steam.ts` | steamworks.js adapter; **mock** adapter when init fails (IPC still saves unlocks locally first). `STEAM_ACHIEVEMENT_API_NAME`: **7** entries, 1:1 with `AchievementId` in `contracts.ts` |

Co-located **`*.test.ts`** here: `persistence.test.ts`, `persistence-write-error.test.ts`.

## `src/preload/`

| File | Role |
|------|------|
| `index.ts` | `contextBridge` surface for renderer (typed in renderer consumption) |

## `src/renderer/` (React + board)

| File | Role |
|------|------|
| `main.tsx` | Delegates to `bootstrapWebRenderer()` in [`initRendererShell.tsx`](../../src/renderer/initRendererShell.tsx) |
| `initRendererShell.tsx` | Web bootstrap: `applyRendererThemeToDocument()`, global CSS imports, `PlatformTiltProvider` → `NotificationHost` → `App` |
| `App.tsx` | Routed shell from `useAppStore`: screens, portals (intro, in-run settings), `data-view` / overlay semantics |
| `desktop-client.ts` | Typed Electron `contextBridge` consumer + web fallbacks — **single file** at renderer root (not `desktop-client/`); used beside `preload` / `ipc-channels` |

| Directory | Role |
|-----------|------|
| `components/` | Screens: `GameScreen`, `TileBoard`, menus, Codex, settings, HUD, modals, WebGL helpers |
| `store/` | `useAppStore.ts` — orchestration; `desktopClient`; `persistBridge.ts` (`persistSaveData` / `persistSaveSettings`, write-failure UX hook); `achievementPersistence.ts` (save-then-unlock sequencing); memorize/resolve/gauntlet timers; `game.ts`; `gameSfx`; achievements/telemetry on run end |
| `audio/` | `gameSfx.ts` — Web Audio procedural SFX (flip, match, mismatch) |
| `hooks/` | Shell zoom (`hubShellFit`), HUD a11y announcements, drag scroll, etc. |
| `keyboard/` | `gameplayShortcuts.ts` — `GAMEPLAY_SHORTCUT_ROWS` for in-run keyboard help overlay |
| `a11y/` | Focus order / focusable queries, modal focus return stack |
| `styles/` | Theme tokens, global CSS, app shell styles |
| `ui/` | Shared UI primitives (`MetaFrame`, buttons, titles); `ui/strings/` — extracted copy (e.g. pair proximity) |
| `copy/` | Screen-level user-visible bundles (e.g. [`gameOverScreen.ts`](../../src/renderer/copy/gameOverScreen.ts) `gameOverScreenCopy`) for a11y review / future i18n |
| `assets/` | Static assets; see [ASSET_SOURCES.md](../../src/renderer/assets/ASSET_SOURCES.md) |
| `cardFace/` | Card faces: SVG/programmatic drawing, [`proceduralIllustration/`](../../src/renderer/cardFace/proceduralIllustration/) (seeded roll tables → `drawProceduralTarotIllustration`), manifest/cache keys, integration with `tileTextures` / `TileBoardScene` |
| `dev/` | **Dev sandbox** — URL harness, canned runs, HUD fixtures, perf toggles ([section below](#renderer-dev-sandbox)) |
| `sandbox/` | Dev route sandboxes (e.g. logo intro) — **not** the same folder as `dev/` |
| `platformTilt/` | Device tilt integration for presentation |

## Renderer dev sandbox

**Folder:** [`src/renderer/dev/`](../../src/renderer/dev/). **Contrast:** [`src/renderer/sandbox/`](../../src/renderer/sandbox/) holds separate **route** sandboxes (for example logo intro); this section is only the `dev/` harness.

**Gate:** [`devSandboxParams.ts`](../../src/renderer/dev/devSandboxParams.ts) `readDevSandboxConfig()` enables the harness only when `import.meta.env.DEV` **and** the URL contains `devSandbox=1`. Without that gate, other query keys are ignored; production builds never apply sandbox config.

**Wiring:** After hydration, [`App.tsx`](../../src/renderer/App.tsx) reads the config once. If `fx` is set, the full shell is replaced by the matching preview component (today: `matchedRimFire` → [`MatchedCardRimFireSandbox.tsx`](../../src/renderer/dev/MatchedCardRimFireSandbox.tsx)). Otherwise [`useAppStore`](../../src/renderer/store/useAppStore.ts) `__devApplySandbox` navigates to `screen`, builds a run from [`runFixtures.ts`](../../src/renderer/dev/runFixtures.ts) when `screen` is `playing` or `gameOver`, and applies `skipIntro` / `unlockAchievements` as documented in `devSandboxParams.ts`.

### URL query parameters (summary)

| Param | Role |
|--------|------|
| `devSandbox=1` | Required for any other key to take effect |
| `screen` | Target `ViewState` excluding `boot`: `menu`, `settings`, `playing`, `gameOver`, `modeSelect`, `collection`, `inventory`, `codex` (aliases such as `game-over` / `modeselect` are accepted — see `parseScreenParam`) |
| `fixture` | Canned run preset when `screen` is `playing` or `gameOver` (default `arcade` if missing or unknown) |
| `skipIntro=1` | Skip startup intro when landing on `menu` |
| `unlockAchievements` | Comma-separated [`AchievementId`](../../src/shared/contracts.ts) values; seeds `newlyUnlockedAchievements` on `playing` for toast / E2E harness |
| `fx=matchedRimFire` | Isolated WebGL rim-fire preview; ignores normal `screen` navigation |

Authoritative comments and example URLs live at the top of [`devSandboxParams.ts`](../../src/renderer/dev/devSandboxParams.ts).

### Canned fixtures (`fixture=`)

Defined in [`runFixtures.ts`](../../src/renderer/dev/runFixtures.ts) (`SANDBOX_FIXTURE_IDS`). Default when absent or invalid: **`arcade`**.

| ID | Intent |
|----|--------|
| `arcade` | Practice run, post-memorize |
| `memorize` | Practice run still in memorize phase |
| `daily` | Daily run after memorize (live daily mutator table) |
| `dailyParasite` | Daily-style run with score parasite + fixed seed |
| `gauntlet` | Gauntlet run after memorize |
| `resolvingMismatch` | Practice run: first tile from each of two different pairs flipped — **mismatch resolving** (visual harness) |
| `gambitTripleMissSetup` | Fixed 2×3 board (three pairKeys); two mismatched flips + long resolve stall; Playwright [`gambit-mismatch-floater.spec.ts`](../../e2e/gambit-mismatch-floater.spec.ts) issues gambit third flip at **row 1, col 3** (`__e2ePickTileAtGrid1`) → triple-no-match → mismatch floater |
| `paused` | Paused practice run |
| `gameOver` | Game-over summary state |

### Files in `src/renderer/dev/`

| File | Role |
|------|------|
| [`devSandboxParams.ts`](../../src/renderer/dev/devSandboxParams.ts) | Parse URL → `DevSandboxConfig` |
| [`runFixtures.ts`](../../src/renderer/dev/runFixtures.ts) | `buildSandboxRun` / fixture IDs for canned runs |
| [`MatchedCardRimFireSandbox.tsx`](../../src/renderer/dev/MatchedCardRimFireSandbox.tsx) (+ `.module.css`) | Full-app replacement for `fx=matchedRimFire` |
| [`hudFixtures.ts`](../../src/renderer/dev/hudFixtures.ts) | Static `GameplayHudBar` props for four HUD states (no Storybook); `gameplayHudBarFixturePropsById` |
| [`hudFixtures.test.tsx`](../../src/renderer/dev/hudFixtures.test.tsx) | Vitest smoke for fixture renders |
| [`fitScreenSpike.test.tsx`](../../src/renderer/dev/fitScreenSpike.test.tsx) | Keeps `@fit-screen/react` imported for typecheck; not the shipped shell ([`VIEWPORT_FIT_UI.md`](../VIEWPORT_FIT_UI.md)) |
| [`boardWebglPerfSample.ts`](../../src/renderer/dev/boardWebglPerfSample.ts) | DEV: `localStorage.perfBoard = '1'` → logs average ms per consolidated tile-step frame |
| [`boardWebglPerfSample.test.ts`](../../src/renderer/dev/boardWebglPerfSample.test.ts) | Unit tests for perf sampler |
| [`legacy/tileStepLegacy.ts`](../../src/renderer/dev/legacy/tileStepLegacy.ts) | DEV: `localStorage.tileStepLegacy = '1'` → per-tile `useFrame` path for A/B vs consolidated scene loop (`TileBoardScene` imports this) |
| [`legacy/tileStepLegacy.test.ts`](../../src/renderer/dev/legacy/tileStepLegacy.test.ts) | Tests for legacy toggle reader |
| [`legacy/README.md`](../../src/renderer/dev/legacy/README.md) | Notes on dev-only legacy toggles |
| [`ProceduralIllustrationGallerySandbox.tsx`](../../src/renderer/dev/ProceduralIllustrationGallerySandbox.tsx) (`.module.css`) | DEV `?devSandbox=1&fx=proceduralGallery` — Canvas2D procedural illustration grid ([`visualization-work/README.md`](../visualization-work/README.md)) |
| [`illustrationRegressionPairKeys.ts`](../../src/renderer/dev/illustrationRegressionPairKeys.ts) | Regression `pairKeys` mirror of [`e2e/fixtures/tile-card-face-illustration-regression.json`](../../e2e/fixtures/tile-card-face-illustration-regression.json); hashing for deterministic visuals uses **[`hashPairKey`](../../src/shared/hashPairKey.ts)** in shared code — guarded by [`illustrationRegressionPairKeys.test.ts`](../../src/renderer/dev/illustrationRegressionPairKeys.test.ts) |

### Captures and E2E helpers

- **Gambit triple-miss floater:** [`e2e/gambit-mismatch-floater.spec.ts`](../../e2e/gambit-mismatch-floater.spec.ts) exercises fixture `gambitTripleMissSetup`; flake absorption follows the root Playwright **`retries`** in [`playwright.config.ts`](../../playwright.config.ts) (currently 2 when `CI` is set).
- **End-product HUD/board crops:** `yarn capture:endproduct-parity` (paths and defaults described in `devSandboxParams.ts`; Playwright specs such as [`e2e/hud-inspect.spec.ts`](../../e2e/hud-inspect.spec.ts) / [`e2e/visual-endproduct-parity.spec.ts`](../../e2e/visual-endproduct-parity.spec.ts); helpers in [`e2e/visualScreenHelpers.ts`](../../e2e/visualScreenHelpers.ts)).
- **Matched flame stills:** `yarn capture:matched-flame` → `test-results/matched-flame-capture/` (or `VISUAL_CAPTURE_ROOT`).

### Related wiki / design docs

- [VIEWPORT_FIT_UI.md](../VIEWPORT_FIT_UI.md) — `@fit-screen/react` spike (`fitScreenSpike.test.tsx`)
- [COMPONENT_CATALOG.md](../new_design/COMPONENT_CATALOG.md) — HUD-016 references `hudFixtures.ts`
- [reference-comparison/CURRENT_VS_ENDPRODUCT.md](../reference-comparison/CURRENT_VS_ENDPRODUCT.md) — Playwright gates tied to dev-sandbox playing fixture
- [visualization-work/README.md](../visualization-work/README.md) — procedural illustration backlog, bake/E2E hooks (`cardFace/proceduralIllustration`)
- [visualization-work/INDEX.md](../visualization-work/INDEX.md) — per-task list (VIZ-001–006)

## `packages/notifications/`

Standalone package: Zustand-backed toasts/confirms; built to `dist/` for import from renderer.

## Tests co-located

- **Unit / component:** `*.test.ts`, `*.test.tsx` next to sources; `yarn test`
- **E2E:** `e2e/*.spec.ts`; see [E2E_AND_QA.md](./E2E_AND_QA.md)
