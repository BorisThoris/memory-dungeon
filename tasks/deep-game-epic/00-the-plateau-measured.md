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

## Re-measured 2026-10-19 on `main` (rules 69), DGE-001

| # | Today | Command |
| --- | --- | --- |
| 1 | **Unchanged.** `ENDLESS_CYCLE_FLOOR_COUNT = 12`, `BOSS_ROTATION_CYCLE_POSITION = 9`. | `grep` of `src/shared/floor-mutator-schedule.ts` |
| 2 | **True to floor 60, then false.** `PAIRS_MAX = 24` holds from floor 52 to 60; since rules 60 `pairsForFloor` grows past 60, doubling every 30 floors: 25 pairs at 61, 30 at 70, 48 at 90, 96 at 120, 384 at 180, `LATE_PAIRS_MAX` 4096 by about 300. A run past 60 is not frozen; one that ends before 60 never sees the growth. | `pairsForFloor(f, 69)` for f = 40, 52, 60, 61, 70, 90, 120, 180, 300 |
| 3 | **Still a hill, and shallower in the opening.** Pop rate per floor: 1.00 on floors 1-3 (authored), 0.74 at 9 pairs, 0.80 at 11, 0.45 at 12, 0.53-0.55 at 12-13, 0.61-0.63 at 14. The whole-run share at the heat stages: matched 0.34 of a floor (the cascade takes the other two thirds), biggest break 0.39 of a floor on average, 0.64 at most. The per-pair-count curve past 14 is DGE-012's per-act breakdown. Ladder pairs a break takes: clean 0.70, sharp 0.99, fever 2.39. | `yarn sim:pop` (floors 1-12), `yarn sim:pop-share` |
| 4 | **No longer true: runs end on their own.** The earned, expiring miss bank (shipped after Gen 207) ends runs. Median floor reached, perfect-memory player, twenty seeds: 10% misses 60 (the cap; mean 51.1), 15% 20, 20% 11, 25% 6.5, 35% 4; with the curio items used, 60 / 19.5 / 11.5 / 6.5 / 4. The run census (`yarn sim:run`, 160 runs) plays a fixed 24 floors and ends every run at its cap, so it no longer measures run end. | `yarn sim:survival`, `yarn sim:survival --items` |

What this changes for the plan: fact 4's diagnosis ("there is no end to push toward") now reads "the end comes early": the median 15%-miss run stops at floor 20, inside Act II of a sixty-floor Descent. DGE-005 (the Warden at 60) and DGE-032 (run-ending bars) should be read against this: the Warden is a wall only a 10%-miss player meets, unless the acts also change what the bank does.
