# The plateau, measured

Four facts from the repository. Each names where it comes from so the next session can re-measure rather than trust.

| # | Fact | Where it is measured |
| --- | --- | --- |
| 1 | **The endless cycle is twelve floors that repeat.** `ENDLESS_CYCLE_FLOOR_COUNT = 12`, three acts of four floors inside it (Gate, floors 5 to 8, floors 9 to 12), one rotating boss slot at `BOSS_ROTATION_CYCLE_POSITION = 9`. Floor 40 resolves to the same `ENDLESS_FLOOR_CYCLE` entry as floor 4. | `src/shared/floor-mutator-schedule.ts`, `pickFloorScheduleEntry` |
| 2 | **The board stops growing at floor 52.** 24 pairs, 48 tiles, 7 columns, 24 symbols, memorize 5280 ms, all frozen from there on. `PAIRS_MAX = 24`; `LATE_PAIRS_MAX = 4096` is only reached by the deep-floor simulator, never by a run. | `src/shared/pair-curve.ts`; `docs/BALANCE_NOTES.md` Gen 211; `yarn sim:curve` |
| 3 | **The pop is a hill, not a line.** The cascade's share of a board is 0.50 at four pairs, 0.65 at eleven, 0.75 at fourteen, 0.60 at seventeen, 0.48 by twenty-two. Four suits of six pairs over forty-eight cells give a bounded wave a smaller fraction of each suit to walk. | `docs/BALANCE_NOTES.md` Gen 211; `yarn sim:pop`, `scripts/sim-pop-share.ts` |
| 4 | **At a competent miss rate a run never ends on its own.** 15% misses: forty floors on every seed, no run ends. 30%: one in ten hits the turn ceiling. 45%: mean run 28.6 floors. 60%: every run ends by floor 8. A clean run ends when the player stops. | `docs/BALANCE_NOTES.md` Gen 207; `yarn sim:run`, `scripts/sim-run-occupancy.ts` |

Two supporting facts:

- Par already rises with pairs after thirteen (`floor-par.ts`), and Fever still lands on floors 70 to 100 (0.4 to 1.0 a floor). The scoring ladder has not gone flat; the *content* has.
- Mutators iterate during play on the player's own clock (restless, skittish, lantern, looking glass). That seam pattern (`*-rules.ts` module hooked in the match or mismatch seam, a `RunState` counter, a beat module for the words) is the pattern every new mechanic in this pack follows.

## Diagnosis
The game scales quantity once (pairs to floor 52), the spectacle decays with size (fact 3), there is no end to push toward (fact 4), and no new verb arrives after floor 12 (fact 1). Items change power; the problem is that nothing changes *kind*. The pack therefore adds verbs, families, board shapes and bosses on a visible schedule, an end, and a next goal always on screen.

## Re-measure before and after
- `yarn sim:run` at 15% misses: how often a run ends, and at what floor.
- `yarn sim:pop` and `scripts/sim-pop-share.ts` by act (DGE-012 adds the per-act breakdown).
- `yarn sim:curve` to floor 60, then to 120 in Endless (DGE-032).
- `yarn sim:endless --deep-floors` for the Endless board sizes.
