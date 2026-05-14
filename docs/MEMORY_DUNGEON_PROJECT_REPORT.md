# Memory Dungeon Project Report

_Updated 2026-05-14. This report describes the active project in this repository, not the removed Expo / React Native prototype._

## Executive Summary

**Memory Dungeon** is now a Windows-first desktop arcade memory game built with Electron, Vite, React, TypeScript, and a WebGL-driven board renderer. The product target is an offline-first premium desktop build with Steam packaging hooks, local saves, responsive UI, deterministic gameplay contracts, and a broad regression suite.

The old repository folder name, `my-react-native-game`, and the previous tech-stack report no longer matched the codebase. The active application lives in `src/` and `packages/notifications/`; the former Expo/React Native prototype has been removed from the tree and is only available through git history.

## What We Have Now

- A playable Memory Dungeon desktop game loop with choose-path flow, classic runs, daily challenge, gauntlet, puzzle, meditation, scholar, wild, practice, and related featured run variants.
- A deterministic shared gameplay core under `src/shared/`, covering run state, floor schedules, route/shop/side-room systems, relics, mutators, objectives, hazards, findables, economy, and softlock fairness.
- A React renderer under `src/renderer/` with main menu, mode selection, gameplay, HUD, inventory, codex, collection, settings, overlays, game over, and dev fixtures.
- A WebGL tile board with DOM fallback/error handling coverage, camera fit/pan/zoom behavior, tile-face rendering checks, and mobile/short-height layout regression tests.
- Electron main/preload integration for the Windows desktop shell, local persistence, packaging, and Steam adapter boundaries.
- A documentation system that now treats the desktop/Electron product as the source of truth and the old Expo-era material as legacy context.

## Current Stack

| Area | Current implementation |
| --- | --- |
| Desktop shell | Electron main/preload in `src/main/` and `src/preload/` |
| Renderer | Vite + React + TypeScript in `src/renderer/` |
| Game logic | TypeScript shared domain modules in `src/shared/` |
| Board presentation | WebGL/Three-backed tile board with renderer-side helpers and E2E coverage |
| State | Zustand app store plus shared immutable gameplay contracts |
| Persistence | Local save/settings bridge, `electron-store`, migration/version gates |
| Packaging | Electron Builder scripts for Windows x64, Steam local test app id |
| QA | Vitest, TypeScript gates, ESLint, Playwright renderer QA, gameplay gates, long-run simulations |

## Product Scope

The v1 bar is **offline/local-first**:

- Local play and local saves are first class.
- Steam integration is targeted where already wired.
- Online leaderboards, mandatory accounts, and server-backed services are deferred.
- Responsive UI is covered for desktop windows, phone-like dimensions, tablet-like dimensions, and short-height landscape cases because the renderer is also used for layout hardening.

## Current Strengths

- Gameplay systems are no longer just aspirational docs; run depth, economy, relics, route choices, shops, side rooms, objectives, hazards, findables, and long-run feedback have code and tests.
- The renderer has a real QA surface. `yarn test:e2e:renderer-qa` covers layout, navigation, playable-path flows, long-run feedback HUD, Scholar/Wild starts, tile faces, and tile-board interaction.
- The project has clear release gates: `yarn gate:gameplay`, `yarn gate:long-run-ui-feedback`, `yarn gate:long-run`, `yarn fullcheck`, and focused Playwright suites.
- Legacy React Native assumptions are isolated under `legacy/README.md` and wiki caveats instead of being presented as current architecture.

## Known Work Still Ahead

- Final Steam/store media and release-candidate packaging hardening remain separate release tasks.
- Art/audio polish is substantially scaffolded, but final asset lock and rights review still need deliberate release review.
- Some docs are broad historical planning artifacts; the authoritative implementation view should come from `README.md`, `docs/internal-wiki/`, `docs/gameplay/`, and the tested `src/` contracts.

## Authoritative References

- Root project overview: [`README.md`](../README.md)
- Gameplay systems map: [`GAMEPLAY_SYSTEMS_ANALYSIS.md`](./GAMEPLAY_SYSTEMS_ANALYSIS.md)
- Mechanics catalog: [`gameplay/GAMEPLAY_MECHANICS_CATALOG.md`](./gameplay/GAMEPLAY_MECHANICS_CATALOG.md)
- Complete v1 ship bar: [`product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md`](./product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md)
- Internal wiki: [`internal-wiki/README.md`](./internal-wiki/README.md)
- Legacy caveats: [`internal-wiki/LEGACY_AND_CAVEATS.md`](./internal-wiki/LEGACY_AND_CAVEATS.md)
