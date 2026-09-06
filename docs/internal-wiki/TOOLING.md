# Tooling and scripts

## `package.json` scripts (abridged by theme)

### Development

| Script | What it does |
|--------|----------------|
| `yarn dev` | Concurrently: Vite renderer, tsup watch for main/preload, Electron against dev server |
| `yarn dev:renderer` | Vite only (`http://127.0.0.1:5173`) |
| Dev `/__blueprint` | Vite-only browser explorer for project/system diagrams plus allowlisted AST/codegen experiments; smoke with `yarn test:e2e:blueprint` |
| `yarn demo:browser` | Browser-only portfolio demo server (`http://127.0.0.1:4102`; see [Portfolio Demo Evidence](../PORTFOLIO_DEMO.md)) |
| `yarn dev:electron:watch` | tsup watch for Electron bundles |
| `yarn dev:electron` | Waits for Vite + built `dist-electron`, runs electronmon |

### Quality gates

| Script | What it does |
|--------|----------------|
| `yarn ci` | Same as **`yarn fullcheck`** (`lint` + security + desktop build + renderer budget + systems/softlock gates + `verify`) — primary automation entrypoint. |
| `yarn verify` | `yarn typecheck` + `yarn test` |
| `yarn fullcheck` | `yarn lint` + `gate:security` + `gate:desktop-build` + `gate:build-output` + `gate:systems` + `yarn verify` |
| `yarn typecheck` | `tsc --noEmit` (full `src/` + root configs) |
| `yarn typecheck:shared` | `tsc -p tsconfig.shared.json --noEmit` — optional narrow check for `src/shared` only (no `composite` split; see TypeScript note below) |
| `yarn lint` | ESLint + `scripts/check-test-file-extensions.mjs` (REF-093: no JSX in `.test.ts`) |
| `yarn gate:systems` | Action-loop, rewards/economy, navigation, system-diagram drift, quiet topology audit, endless health, and multi-seed softlock gates |
| `yarn gate:changed` | Selects focused gates from explicit paths or the current Git diff; route-map edits pull navigation, long-run, topology, softlock seeds, and full softlock stress, while source files without a narrower mapping fall back to `yarn verify` |
| `yarn gate:long-run` | Long-run pacing, relic, balance, route-share, and 1000-floor endless sampler gate |
| `yarn depcheck` | Unused/missing dependency scan ([`.depcheckrc.json`](../../.depcheckrc.json); ignores CSS-imported fonts + script runner bins) |
| `yarn knip` | Unused files / dependency issues ([`knip.json`](../../knip.json); scopes `files`, `dependencies`, `unlisted`, `unresolved`; sets `NODE_OPTIONS=--experimental-require-module` for Knip on Node 22) |
| `yarn knip:exports` | Knip unused **exports/types** mode (`--exports`; [`ignoreIssues`](../../knip.json) narrows intentional barrels — run before widening default `yarn knip` scope) |
| `yarn knip:production` | Knip with `--production --use-tsconfig-files` for dependency/file issues along production entry paths; the tsconfig file set keeps Vite/Electron renderer dependencies visible to Knip. |
| `yarn gate:package-hygiene` | Combined dependency, unused-file, production-entry, and unused-export scan (concise `depcheck` wrapper, `knip`, `knip:production`, `knip:exports`) selected by `gate:changed` for package/tooling edits. |
| `yarn audit:renderer-assets` | `scripts/audit-renderer-assets.mjs` — lists `src/renderer/assets/**` files whose basename has no TS/CSS/markdown reference under `src/`, `scripts/`, `e2e/`, `public/` (manual triage; not a delete pass) |
| `yarn audit:summary` | `scripts/audit-summary.mjs` — condenses `yarn audit --json` into severity totals, unique advisory groups, patched ranges, and sample dependency paths |
| `yarn test` | Vitest run with at most two workers for stable full-suite memory use |
| `yarn test:watch` | Vitest watch |
| `yarn test:e2e` | Full Playwright suite |
| `yarn test:e2e:illustration-regression` | Golden comparison for procedural card illustration (`e2e/tile-card-face-illustration-regression.spec.ts`, `--workers=1`) |
| `yarn regenerate:illustration-regression` | Updates illustration fixtures (`UPDATE_ILLUSTRATION_FIXTURES`) — use intentionally |
| `yarn benchmark:illustration-regression` | Illustration perf sample (`RUN_ILLUSTRATION_BENCHMARK`) |
| `yarn test:e2e:a11y` | Scoped axe on main menu, settings, in-run shell (`e2e/a11y-scoped-routes.spec.ts`) |
| `yarn test:e2e:blueprint` | Dev-only `/__blueprint` system diagram explorer smoke |
| `yarn sim:endless` | `tsx scripts/sim-endless.ts` — endless schedule CSV sampler with fairness, topology, solved-run topology, playable-clear, reward, and trait health metrics (REF-098) |
| `yarn audit:dungeon-topology:gate` | Quiet graph-backed board/route topology audit for routine gate use |
| `yarn audit:dungeon-topology:json` | Structured graph-backed topology audit with issue and coverage counts for diagnostics |
| `yarn gate:sim-softlock-seeds` | Deterministic multi-seed softlock/progression gate used by `gate:systems` |
| `yarn gate:sim-softlock-stress` | Broader deterministic stress seed sweep for lock, boss, exit, objective, shop, and repair-rule changes |
| `yarn gate:softlock-full` | Combined topology stress audit plus deterministic softlock stress sweep for progression-risk changes |

**Refinement backlog (REF-100):** [REF-100](../refinement-tasks/REF-100.md) is **Done** (INDEX acceptance met). Notes live in [refinement-tasks/README.md](../refinement-tasks/README.md) and [COMPLETION.md](../refinement-tasks/COMPLETION.md) (2026-04-17); optional INDEX re-triage is process only.

### TypeScript: shared vs renderer

The repo uses a **single** root `tsconfig.json` for `tsc --noEmit` so CSS module typings and Vite aliases stay one graph. A **composite** split (`tsc -b` with `src/shared` emitting `.d.ts`) was evaluated; it stalled on the usual CSS-module string typing gap under a partitioned app project, so incremental project references are **deferred**. Use `tsconfig.shared.json` + `yarn typecheck:shared` when you want a faster mental model or IDE focus on `src/shared` only.

### Playwright visual / QA bundles

| Script | What it does |
|--------|----------------|
| `yarn test:e2e:visual` | Device-grid visual inventory capture |
| `yarn test:e2e:visual:device-grid` | Same, explicit name |
| `yarn test:e2e:visual:device-grid:shard1` … `shard4` | Sharded runs |
| `yarn test:e2e:visual:smoke` (+ shards) | Smaller mobile + standard visual set |
| `yarn test:e2e:renderer-qa` | Curated gameplay/renderer QA bundle (see [e2e/README](../../e2e/README.md)) |
| `yarn test:e2e:ui` | Playwright UI mode |

### Captures (writes under `docs/` or configured roots)

| Script | What it does |
|--------|----------------|
| `yarn capture:ui-audit` / `capture:visual-inventory` | `VISUAL_CAPTURE_ROOT=docs/visual-capture` + device-grid spec |
| `yarn capture:ui-audit` for portfolio evidence | Preferred visual capture entrypoint for the compact [Portfolio Demo Evidence Page](../PORTFOLIO_DEMO.md) |
| `yarn capture:ui-design-reference` | Reference stills for design buckets |
| `yarn capture:endproduct-parity` | End-product parity captures (defaults `VISUAL_CAPTURE_ROOT=docs/visual-capture/endproduct-parity`) |
| `yarn capture:matched-flame` | Matched-card flame capture spec |

### Docs generation

| Script | What it does |
|--------|----------------|
| `yarn docs:mechanics-appendix` | Regenerates [GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md) (`tsx scripts/run-mechanics-appendix.ts`) — run after encyclopedia/catalog changes (see [CONTRIBUTING.md](../../CONTRIBUTING.md)) |
| `yarn docs:ui-audit` / `docs:visual-inventory` | Regenerates markdown from captures via `scripts/generate-visual-inventory-md.mjs` |

### WIP / card pipeline

| Script | What it does |
|--------|----------------|
| `yarn wip:extract-endproduct` | Extract WIP assets from end-product refs (`scripts/extract-endproduct-wip-assets.mjs`) |
| `yarn wip:extract-endproduct:react` | Same + writes `docs/wip-assets/EndproductWipSvgs.tsx` beside traced SVGs |
| `yarn wip:extract-endproduct:png-only` | PNG only |
| `yarn imagegen` | `scripts/card-pipeline/image_gen.mjs` |
| `yarn card-backs:local` | `py -3 scripts/card-pipeline/batch_local_card_backs.py` (Windows; local SDXL + `normalize-card-texture.ps1`; deps in `requirements-local-card-backs.txt`; elsewhere use `python3`/`python`) |
| `yarn card-backs:local:dry` | Same with `--dry-run` (no torch; lists plan) |
| `yarn face-panels:local` | `py -3 scripts/card-pipeline/batch_local_face_panels.py` (SDXL tarot mat panels 520×592, 80 tiered) |
| `yarn face-panels:local:dry` | Same with `--dry-run` |
| `yarn ui-art:local` | `py -3.12 scripts/card-pipeline/batch_local_zimage.py` — local **Z-Image-Turbo** batch for shell scenes, mode posters, and the app icon (`ui-backgrounds.zimage.manifest.json`; takes land in `tmp/zimage/…` with a contact sheet) |
| `yarn ui-art:local:dry` | Same with `--dry-run` (no torch) |
| `yarn ui-art:install` | Copy the takes listed in `ui-backgrounds.zimage.picks.json` to their `target` paths, then run `yarn assets:ui-backgrounds:export-runtime-webp` |
| `yarn face-panels:manifest:zimage` | Rebuild `face-panels.zimage.manifest.json` (80 tiered motifs, 2× render size) |
| `yarn face-panels:local:zimage` | Z-Image-Turbo face-panel batch (`face-panels.zimage.manifest.json`); `:dry` variant lists the plan |
| `yarn face-panels:install:zimage` | Downsample picked takes to the 520×592 `face-panel-NN.png` masters, then run `yarn face-panels:export-runtime-webp` |
| `yarn audio:ace-step:batch` | `py -3 scripts/audio-pipeline/batch_ace_step.py` — local **ACE-Step 1.5** batch (Python 3.11+ venv; see `scripts/audio-pipeline/README.md`; outputs under `tmp/audio/ace-step/`) |
| `yarn audio:ace-step:batch:dry` | Same with `--dry-run` (no torch) |
| `yarn audio:ace-step:app:xl` | Full app batch on the 4B `acestep-v15-xl-turbo` checkpoint (8 steps, two takes) |
| `yarn audio:ace-step:ambience` | Portfolio run-bed job on XL turbo (three takes) |
| `yarn audio:ace-step:run-bed` | Gameplay run-loop candidates on XL turbo guided by Ballance-pack reference blends (`jobs.run-bed-ambience.json`; build the blends first with `build-ambience-reference-mix.py`) |
| `yarn audio:ace-step:run-bed:library` | Comparison candidates guided by the vault beds and the freesound library (`jobs.run-bed-library.json`) |
| `yarn face-panels:export-runtime-webp` | Export checked-in `face-panel-NN.png` masters to runtime WebP and rebuild `facePanelRasterUrls.ts` |
| `yarn gen:face-panel-raster-urls` | Rebuild `facePanelRasterUrls.ts` after adding/removing `face-panel-NN.webp` runtime files |
| `yarn card-normals:export-runtime-webp` | Export checked-in card normal-map PNG masters to smaller runtime WebP maps |
| `yarn assets:ui-backgrounds:export-runtime-webp` | Export checked-in UI background PNG masters to runtime WebP files |
| `yarn card-texture:ideal` / `card-texture:ai-brief` | Print ideal texture spec / AI brief |
| `yarn capture:ui-vs-assets` | Compare UI vs asset renders |
| `yarn png:trim-bbox` | Trim PNG bounding boxes |

### Build / package

| Script | What it does |
|--------|----------------|
| `yarn build` | Clean + renderer build + Electron tsup bundle |
| `yarn build:renderer` | Vite production build → `dist/`; prunes `public/wip-assets/` design-reference files unless `VITE_KEEP_WIP_PUBLIC_ASSETS=1` |
| `yarn build:electron` | tsup → `dist-electron/` |
| `yarn clean` | Removes `dist`, `dist-electron`, `release` |
| `yarn package:dir` | Build + electron-builder `--dir` |
| `yarn package:win` | Build + Windows NSIS installer |
| `yarn postinstall` | `scripts/postinstall.cjs` |

### Static assets, plates, manifests, procedural bake

| Script | What it does |
|--------|----------------|
| `yarn build:cloudflare` | Renderer-only prod build (`yarn build:renderer`) — e.g. Cloudflare Pages; **no** Electron bundle |
| `yarn assets:choose-path-bg` | `scripts/generate-choose-path-background.mjs` |
| `yarn optimize:card-front` | `scripts/svgo-optimize-card-front.mjs` |
| `yarn generate:card-plates` | `tsx scripts/generate-card-plates.ts` |
| `yarn build:card-illustration-manifest` | `scripts/build-card-illustration-manifest.mjs` |
| `yarn bake:procedural-set` | `tsx scripts/bake-procedural-illustration-set.ts` — offline procedural PNG bake (see [visualization-work/README.md](../visualization-work/README.md)). **Default CI (`yarn ci`) does not bake**; use locally or optional automation outside PR gates |

## `scripts/` (maintenance)

| Path | Role |
|------|------|
| `audit-renderer-assets.mjs` | Basename audit for orphaned renderer asset files (`yarn audit:renderer-assets`) |
| `check-depcheck-clean.mjs` | Concise depcheck JSON wrapper for `yarn gate:package-hygiene` |
| `postinstall.cjs` | Runs `electron-builder install-app-deps` (skipped on Cloudflare Pages) so native Electron deps match the platform |
| `run-mechanics-appendix.ts` | Writes mechanics catalog machine snapshot (versions + counts) |
| `generate-visual-inventory-md.mjs` | Builds visual inventory markdown |
| `extract-endproduct-wip-assets.mjs` | WIP extraction |
| `bake-procedural-illustration-set.ts` | Procedural illustration offline bake (also `yarn bake:procedural-set`) |
| `sim-endless.ts` | Endless schedule sampler (`yarn sim:endless`) |
| `generate-card-plates.ts` | Card plate generation (`yarn generate:card-plates`) |
| `generate-choose-path-background.mjs` | Choose-path background asset (`yarn assets:choose-path-bg`) |
| `build-card-illustration-manifest.mjs` | Illustration manifest (`yarn build:card-illustration-manifest`) |
| `svgo-optimize-card-front.mjs` | SVG optimize pass (`yarn optimize:card-front`) |
| `card-pipeline/image_gen.mjs` | Card image generation |
| `card-pipeline/batch_local_card_backs.py` | Local GPU SDXL batch card backs → `normalize-card-texture.ps1` |
| `card-pipeline/batch_local_zimage.py` | Local GPU **Z-Image-Turbo** manifest batch (backgrounds, posters, icon, face panels) → `tmp/zimage/<manifest>/` + contact sheet |
| `card-pipeline/install_zimage_picks.py` | Copy/resize picked Z-Image takes to manifest `target` paths (`*.zimage.picks.json`) |
| `card-pipeline/build-face-panels-zimage-manifest.py` | Writes `face-panels.zimage.manifest.json` (tier slots match `weightedFacePanelPool.ts`) |
| `card-pipeline/ui-backgrounds.zimage.manifest.json` | Prompts + targets for shell scenes, mode posters, app icon |
| `card-pipeline/masks/*.alpha.png` | Alpha profiles kept from the earlier gameplay scene masters; `install_zimage_picks.py` re-applies them via manifest `alphaFrom` |
| `card-pipeline/requirements-local-card-backs.txt` | Pip deps for `batch_local_card_backs.py` |
| `card-pipeline/card-back-prompts.manifest.example.json` | Example `--manifest` for custom prompts |
| `card-pipeline/print-card-texture-ideal.mjs` | Texture ideal / AI brief output |
| `card-pipeline/capture-ui-vs-asset-screens.mjs` | UI vs asset screenshot pass |
| `card-pipeline/trim-png-bounding-box.mjs` | PNG trim |
| `card-pipeline/cardTextureConstants.mjs` | Shared constants for pipeline |
| `card-pipeline/*.ps1` | Windows PowerShell helpers for textures |
| `audio-pipeline/batch_ace_step.py` | ACE-Step 1.5 JSON job batch → `tmp/audio/ace-step/` + manifest |
| `audio-pipeline/pick-ace-takes.py` | Objective take scoring for `v##` renders → picks JSON for `install-ace-app-outputs.mjs --picks` |
| `audio-pipeline/jobs.portfolio-ambience.json` | Fallback run bed (`yarn audio:ace-step:ambience`; installed as `assets/audio/portfolio-feedback-pack/demo-ambience-loop.wav`, used only when `music/run-loop.ogg` is absent) |
| `audio-pipeline/build-ambience-reference-mix.py` | Level-matched crossfade chain of reference tracks (the `dont_modify` beds by default, or a `--list` of paths incl. MP3s) → `reference-audio/*.wav` (gitignored) for `reference_audio` |
| `audio-pipeline/jobs.run-bed-ambience.json` | Run-loop candidates guided by blends of the Ballance pack (`dont_modify/`, `yarn audio:ace-step:run-bed`) |
| `audio-pipeline/jobs.run-bed-library.json` | Comparison run-loop candidates: vault beds alone and the curated freesound library next to the repo (`yarn audio:ace-step:run-bed:library`) |
| `audio-pipeline/run-bed-references-ballance-*.txt`, `run-bed-references*.txt` | Reference track lists (paths relative to the Repos folder, resolved from worktrees too) fed to `build-ambience-reference-mix.py --list` |
| `audio-pipeline/make-seamless-loop.py` | Seamless loop + RMS/peak match for a chosen ACE-Step loop take (menu/run beds, portfolio ambience) |
| `audio-pipeline/jobs.example.json` | Example jobs (`text2music`, reference audio, `cover`) |
| `audio-pipeline/jobs.game-ambient.example.json` | Text-only ambient/menu + run tension (no `samples/` files) |
| `audio-pipeline/jobs.sfx.example.json` | ACE-Step captions for gameplay one-shots → trim → `src/renderer/assets/audio/sfx/` |
| `audio-pipeline/RIGHTS.md` / `EVENT_MAP.md` / `PROMPTS.md` | Legal strategy, SFX mapping, caption seeds |
| `audio-pipeline/README.md` | Install + rights notes for ACE-Step |

## Config files (pointers)

- `vite.config.mts`, `tsup.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `tsconfig.json` — standard locations at repo root.

### Vitest (unit / component tests)

Vitest is configured in `vite.config.mts` via `defineConfig` from `vitest/config`, so one file covers Vite dev/build and test runner settings. Tests use the `happy-dom` environment and `./vitest.setup.ts`, which wires `@testing-library/jest-dom/vitest`, runs Testing Library `cleanup()` after each test, and documents **DOM behavior**: happy-dom’s built-in `matchMedia` (desktop-like defaults — coarse pointer false); tests that need touch-first media behavior should override `window.matchMedia` locally. **`visualViewport`** is not implemented in happy-dom; the setup installs a small polyfill so hooks that subscribe to `visualViewport` + `window` `resize` behave consistently. The test `pool` is set to `threads` so teardown avoids Windows/sandbox `EPERM` issues sometimes seen with Vitest’s default fork pool. Test discovery includes `src/**/*.{test,spec}.{ts,tsx}` and `packages/notifications/src/**/*.{test,spec}.{ts,tsx}`. The same `resolve.dedupe` and `resolve.alias` entries as the renderer (React, `react-dom`, `zustand`, and `@cross-repo-libs/notifications` → package `src`) apply during tests so imports match dev and do not require building `packages/notifications/dist` first.

## `@cross-repo-libs/notifications` (`packages/notifications`)

Vendored package: toast + confirm UI (Zustand store, imperative API, `NotificationHost`). The app depends on it via `file:./packages/notifications` in the root `package.json`.

### Build outputs

| Step | Output |
|------|--------|
| `tsc -p tsconfig.build.json` | Emits `packages/notifications/dist/**/*.js` and `**/*.d.ts` from `src/` (`outDir`: `dist`, `rootDir`: `src`). Entry typings: `dist/index.d.ts`. |
| `node packages/notifications/scripts/copy-css.mjs` | Copies `src/notification-host.css` → `dist/notification-host.css`. |

Published surface (see `packages/notifications/package.json`):

- **Main / types:** `dist/index.js`, `dist/index.d.ts`
- **Exports:** `.` → JS + types; `./styles.css` → `dist/notification-host.css` (also listed in `sideEffects` so bundlers do not tree-shake it away)
- **NPM pack contents:** `files`: [`dist`] only

Package script: `yarn --cwd packages/notifications build` (or `npm run build` inside that folder). `prepublishOnly` runs the same build.

### How the renderer imports it

**Source path (local dev + `tsc` in this repo):** Root `tsconfig.json` maps `@cross-repo-libs/notifications` → `./packages/notifications/src/index.ts`, so TypeScript and tests resolve the TypeScript source without building the package first.

**Vite:** `vite.config.mts` aliases:

- `@cross-repo-libs/notifications` → `packages/notifications/src/index.ts`
- `@cross-repo-libs/notifications/styles.css` → `packages/notifications/src/notification-host.css`

That keeps a single React/Zustand instance and lets you edit notification source without pre-building `dist/`.

**Runtime imports** (example from `src/renderer/initRendererShell.tsx`): `NotificationHost` from `@cross-repo-libs/notifications` and `@cross-repo-libs/notifications/styles.css`, plus app-level overrides in `src/renderer/styles/notificationsGame.css`.

**If you consumed the package only as a built dependency** (no monorepo aliases), you would use the package exports: `@cross-repo-libs/notifications` and `@cross-repo-libs/notifications/styles.css`, which resolve to `dist/` as above.
