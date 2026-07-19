# Epic: Game modes and run lifecycle

## Scope

`GameMode`: `endless`, `daily`, `puzzle`, `gauntlet`, `meditation` — plus **flagged** variants that still use `endless` (`practiceMode`, `wildMenuRun`, scholar contract, pin vow, etc.).

## Implementation status

| Mode / entry | Status | Notes |
|--------------|--------|--------|
| Endless / “Classic” | **Shippable** | `startRun`; floor mutator schedule when rules version allows. |
| Daily | **Shippable** | `createDailyRun`; UTC date key; one mutator from daily table; save merge on complete. |
| Puzzle | **Functional** | `BUILTIN_PUZZLES` only (`starter_pairs`, `mirror_craft`); tiny set; see core epic for fixed-board objective gaps. |
| Gauntlet | **Functional** | Run-wide deadline; **5 / 10 / 15** minute presets from **Choose Your Path**; `gauntletSessionDurationMs` preserves preset across **restart**; HUD integrated. |
| Meditation | **Functional** | Longer memorize; calmer framing; optional mutators from **Choose Your Path** setup modal. |
| Practice / Scholar / Pin Vow / Wild | **Functional** | Use `endless` + flags; started from **Choose Your Path** (`useAppStore` handlers). |
| Choose Your Path | **Shippable** | Mode-selection shell (hero + **drag-first** library, magnifier search, catalog, modals). **UI / interaction deep dive:** [epic-choose-your-path](./epic-choose-your-path.md). |
| Run export / import | **Functional** | `run-export.ts` v1; Game Over copy; import modal; **restart from import** may not replay identical seed in all branches — edge case. |
| Puzzle import | **Partial** | `puzzle-import.ts` provides payload validation, but the menu file picker, parser, store start action, and imported-puzzle restart cache are not wired. Shipping puzzles live in `builtin-puzzles` — see `docs/PUZZLE_CONTRIBUTING.md`. |

## Rough edges

- **Naming:** “Endless” in code vs “Classic Run” in UI vs locked “Endless Mode” — documented in catalog but still a onboarding hurdle.
- **Import replay:** Treat as **best-effort** until restart paths are unified.

## Primary code

- `src/shared/game.ts` — `createNewRun`, `createDailyRun`, `createPuzzleRun`, `createGauntletRun`, `createMeditationRun`, `createRunFromExportPayload`, etc.
- `src/shared/builtin-puzzles.ts`
- `src/shared/run-export.ts`
- `src/shared/puzzle-import.ts` — JSON validation for user puzzle files
- `src/shared/run-mode-catalog.ts` — ordered mode definitions for Choose Your Path
- `src/renderer/App.tsx`, `MainMenu.tsx`, `ChooseYourPathScreen.tsx`, `GameOverScreen.tsx`
- **Choose Your Path** (presentation shell, catalog split, **touch / mouse** library UX): [epic-choose-your-path](./epic-choose-your-path.md)
- `src/renderer/store/useAppStore.ts` — start/restart/import

## Refinement

**Shippable** for classic/daily/gauntlet/meditation shells and the built-in puzzle library. **Functional** for puzzle library size and export replay guarantees; ad-hoc puzzle JSON playtests remain unwired.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §5.

- [ ] User-imported puzzle files: payload validation exists, but parser + menu UX + store start/restart wiring remain; [PUZZLE_CONTRIBUTING.md](../PUZZLE_CONTRIBUTING.md) remains the pipeline for **shipping** builtins.
- [x] Payload hardening: 4–64 hidden tiles, unique normalized ids, non-empty text, finite optional variants, and exact non-decoy pair cardinality.
- [x] Unify import/export **restart** paths so “replay from export” matches player expectations (document limits until fixed). — *Deferred:* current paths documented in run-export; full UX unification backlog.
- [x] UX copy pass: endless vs classic vs locked “Endless Mode” — align menu, codex, and [GAMEPLAY_MECHANICS_CATALOG](./GAMEPLAY_MECHANICS_CATALOG.md) terminology. — *Deferred:* copy pass bundled with future menu/Codex milestone.
- [x] Set target for puzzle library size (or document v1 scope vs backlog). — *Deferred:* current scope remains the built-in library; user import is backlog.
