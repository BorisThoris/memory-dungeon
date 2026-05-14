# Legacy code and document caveats

## Former `legacy/expo-roguelike/` tree

That prototype directory was **removed** from the repo to reduce dead-code surface; use git history for the old files. The shipping desktop game is under `src/`.

## Former `docs/GAME_TECHSTACK_ANALYSIS.md`

The old tech-stack report was written as a **cross-platform / Expo-era** product survey (dungeon map, room types, Android/web). It was replaced by [MEMORY_DUNGEON_PROJECT_REPORT.md](../MEMORY_DUNGEON_PROJECT_REPORT.md), which describes the active Electron desktop product.

**For the shipped desktop product, prefer:**

- [MEMORY_DUNGEON_PROJECT_REPORT.md](../MEMORY_DUNGEON_PROJECT_REPORT.md)
- [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md)
- [GAMEPLAY_MECHANICS_CATALOG.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.md)
- Repo root [README.md](../../README.md)

## Visual / reference assets under `docs/`

Folders such as `ui-design-reference/`, `reference-comparison/captures/`, and many `visual-capture/**/*.png` files are **binary** and often gitignored per folder READMEs. This wiki indexes **markdown** workflows; it does not enumerate every PNG.

## Version bumps

Gameplay schema changes should follow **`GAME_RULES_VERSION`** and the maintenance notes in [GAMEPLAY_MECHANICS_CATALOG.md](../gameplay/GAMEPLAY_MECHANICS_CATALOG.md) / [contracts.ts](../../src/shared/contracts.ts).
