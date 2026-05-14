# Memory Dungeon

Windows-first desktop arcade rebuild of Memory Dungeon, packaged with Electron and designed for Steam.

The active application lives under `src/`. An older Expo/roguelike prototype was removed from `legacy/`; see [`legacy/README.md`](./legacy/README.md) and git history if needed.

## Stack

- Electron for the desktop shell
- Vite + React + TypeScript for the renderer
- Zustand for app/game state
- electron-store for saves and settings
- steamworks.js behind a main-process adapter for Steam achievements

## Development

Use **Node 22.x** (see [`.node-version`](./.node-version) for the version this repo is tested with). [`.yarnrc`](./.yarnrc) sets `ignore-engines true` so transitive Electron tooling does not block `yarn install` / `yarn add` on slightly different patch releases.

```bash
yarn install
yarn dev
```

This starts:

- the Vite renderer on `http://127.0.0.1:5173`
- the Electron main/preload build watcher
- an Electron app window connected to the dev server

## Scripts

```bash
yarn dev
yarn ci
yarn build
yarn package:dir
yarn package:win
```

`yarn ci` runs **`yarn fullcheck`** (`eslint` + the `.test.ts`/JSX guard + `tsc --noEmit` + `vitest run`). Use **`yarn verify`** for typecheck + tests only when iterating without lint. **`yarn lint`** runs ESLint + the guard only.

Abridged scripts above; full matrix (Playwright bundles, illustration regression/benchmark, captures, card pipeline): [`docs/internal-wiki/TOOLING.md`](docs/internal-wiki/TOOLING.md).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for mechanics encyclopedia / Codex copy workflow when changing relics, mutators, or player-facing rules text.

## Dev: WebGL board profiling

These flags are **dev builds only** (`import.meta.env.DEV`). After changing `localStorage`, **reload the page** so the renderer picks up the new value.

| Flag | Effect |
| --- | --- |
| `localStorage.perfBoard = '1'` | Logs `[perfBoard]` average milliseconds per frame for the consolidated tile-stepping slice in the board scene (see `src/renderer/dev/boardWebglPerfSample.ts`). |
| `localStorage.tileStepLegacy = '1'` | Uses per-tile `useFrame` stepping instead of the scene-level consolidated loop (see `src/renderer/dev/legacy/tileStepLegacy.ts`). |

Clear the key or set it to anything other than `'1'` to turn a flag off, then reload.

## Steam Notes

- `steam_appid.txt` is set to `480` for local testing.
- Steam integration is initialized in the Electron main process.
- If Steam is unavailable, the app falls back to a no-op adapter and still runs normally.
- Steam redistributables are copied from `steamworks.js/dist/win64` into packaged Windows builds.

## Product Scope

This v1 desktop build is intentionally narrow on platform, but exposes several **run types** from the main menu (player-facing reference copy lives in `src/shared/mechanics-encyclopedia.ts`; `src/shared/game-catalog.ts` re-exports it plus achievements for UI):

- **Classic run** (internal mode: endless): procedural floors, relic offers, escalating pair counts
- **Daily challenge**: shared UTC seed with a rotated daily mutator
- **Gauntlet**: run-wide countdown (**5 / 10 / 15** minute presets from the main menu)
- **Puzzle**: fixed handcrafted boards from the built-in set; optional **Import puzzle JSON** for local playtests
- **Meditation**: calmer pacing / longer memorize windows
- **Featured runs** from the menu include practice, scholar contract, pin vow, wild/joker, and puzzle shortcuts

Also:

- Mouse + keyboard (responsive layout for different window sizes)
- Local saves, settings, and achievements
- Windows x64 only

Current project report and design details: [docs/MEMORY_DUNGEON_PROJECT_REPORT.md](docs/MEMORY_DUNGEON_PROJECT_REPORT.md), [docs/MUTATORS.md](docs/MUTATORS.md), [docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.md](docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.md) (full rules matrix), [docs/GAMEPLAY_SYSTEMS_ANALYSIS.md](docs/GAMEPLAY_SYSTEMS_ANALYSIS.md).

The full v1 ship bar is the offline-first [complete product definition of done](docs/product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md): local play, Steam where already targeted, first-class responsive/mobile UI, save trust, and staged hardening. Competitive online leaderboards, server-backed online services, and mandatory online accounts are explicitly deferred.

**Internal wiki (full doc map, multi-agent upkeep, coverage methodology):** [docs/internal-wiki/README.md](docs/internal-wiki/README.md) · [docs/internal-wiki/COVERAGE.md](docs/internal-wiki/COVERAGE.md).

## Archived Legacy Code

- See [`legacy/README.md`](./legacy/README.md) for what used to live here and how to find it in git history.
