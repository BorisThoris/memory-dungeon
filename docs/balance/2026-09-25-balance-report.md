# Balance report, 2026-09-25

This report measures the game and does not tune it. It covers the rules that changed recently:
Heavy misses cost two, the chain carries one link across floors, floor 10 became the lantern hall,
floor 11 became skittish cards, the wild joker takes its whole pair, and the store stop comes every
third floor. Nothing here has been applied. The suggestions are options for the owner, and they keep
the owner's decisions (runs are punishing, the miss bank, the store stop, bombs) as they are.

## How the numbers were made

| Instrument | Command | Result |
|---|---|---|
| Survival table | `yarn sim:survival` (20 seeds, perfect memory, fixed miss rate) | see §1 |
| Run soak | `yarn soak --seeds=200` (40-floor cap) | 0 violations; see §1 |
| Run occupancy | `yarn sim:run`, `yarn gate:run-occupancy` | passed |
| Floor occupancy | `yarn gate:occupancy` | matches baseline |
| Difficulty curve | `yarn gate:difficulty-curve` | passed; see §3 |
| Archetype pressure | `yarn gate:archetype-pressure` | passed; see §3 |
| Scratch probe | `balance.mts` in the session scratchpad, not in the repo | per-floor deaths, Heavy, store, gold, relics |

**The scratch probe.** It plays whole runs through the game's own functions (`createNewRun`,
`flipTile`, `resolveBoardTurn`, `advanceToNextLevel`, `storeOffer`/`buyStoreItem`), the same way
`soakRun` does. It uses 200 seeds (`31337 + i*7919`, the soak's seeds) and caps a run at 40 floors.
It adds two things the soak does not have:

- **Two more kinds of player.** The four soak players (careful 5%, average 18% and sloppy 40% miss
  rate, plus wild) are *oracles*: they always know where a card's partner is and miss only on
  purpose. An oracle cannot be hurt by cards that move and cannot be helped by a lantern. So the
  probe also has **memory players**. They remember board *positions* for the last N cards they saw:
  a 16-card memory (`mem16`) and a 10-card one (`mem10`), each glimpsing N cards in the study window.
  Each comes in two versions. The `t` version (`mem16t`, `mem10t`) follows cards the board moves,
  like a player who watches every flinch and drift animation. The plain version does not follow
  them. Together they give an upper and a lower bound on what moving cards cost.
- **Two shopping policies.** `random` is the soak's policy: buy random affordable rows until
  nothing is affordable. `planner` buys in this order: miss, Deep Pockets, Gilded Chain, bomb, peek,
  Long Look, shuffle.

A **Heavy surcharge** is the second miss a Heavy card charges (tries went up by 2), counted when the
bank actually paid it.

## 1. Headline numbers

**How long a run lasts** (floors cleared, 200 seeds, 40-floor cap):

| Player | Soak (random shop) | Probe, random shop: median / mean | Probe, planner: median / mean |
|---|---|---|---|
| careful (oracle, 5%) | 195/200 reach the cap | 40 / 39.6, 6 deaths | 40 / 39.9, 2 deaths |
| average (oracle, 18%) | 12.6 floors a run | 11 / 12.5 | 12 / 14.4 |
| sloppy (oracle, 40%) | 2.6 floors a run | 2 / 2.5 | 2 / 2.8 |
| wild (oracle, 18%) | 12.9 floors a run | 11 / 13.0 | 13 / 14.6 |
| mem16 (does not follow moves) | - | 10 / 9.8 | 10 / 9.9 |
| mem16t (follows moves) | - | - | 12.5 / 12.3 |
| mem10 / mem10t | - | 5 / 5.2 | 5 / 5.6 and 6 / 5.7 |

**`sim:survival`** (median floor reached, at each miss rate):

| Miss rate | 10% | 15% | 20% | 25% | 35% |
|---|---|---|---|---|---|
| Now | 34.5 | 12.5 | 5.5 | 5.5 | 4 |
| Table in `miss-bank.ts` | 45 | 17 | 6 | 6 | 4 |

The table in the `miss-bank.ts` doc comment is out of date. The drop at 10–15% is probably the
Heavy surcharge, because nothing else since then charges more per miss. Three seeds at 20% and two
at 25% die on floor 1. I traced two of those deaths (6006 at 20%, 8888 at 35%): each was four
honest misses against the opening bank of 3, not a bug.

## 2. Findings

### Skittish cards (floor 11): the fairest reading is a 10% death rate, and the worst is 72%

Death rate on each floor (deaths on the floor ÷ runs that reached it), probe, 200 seeds:

| Player | f8 | f9 | f10 lantern | **f11 skittish** | f12 | f13 |
|---|---|---|---|---|---|---|
| mem16 (does not follow moves) | 8.2% | 8.4% | 2.0% | **71.3%** (3.97 misses/floor) | 11.6% | 44.7% |
| mem16t (follows moves) | 2.6% | 7.6% | 0.0% | **9.9%** (2.02 misses/floor) | 14.3% | 24.2% |
| average (oracle) | 11.8% | 11.9% | 3.4% | 12.2% | 13.9% | 16.1% |
| careful (oracle) | 0% | 0% | 0.5% | 0% | 0% | 0% |

- Nearly every miss flinches: 3.83 flinches for 3.97 misses on each floor-11 visit. Each flinch
  also moves a neighbour the player may have learned, so one miss moves up to four cards.
- A player who follows every animation meets an ordinary pressure floor (9.9%, between f9 and f12).
  A player who loses track of the flinch loses about three quarters of their runs there. For a mid
  player (`mem16`), floor 11 is where the run ends: 150 reached it and 43 left it.
- Careful players are untouched. This is not a bug, since the rule does what it says. But the floor
  is a cliff whose height depends entirely on how readable the flinch is, and no instrument sees
  that. The oracle players, which every gate uses, cannot be hurt by it.

### Lantern hall (floor 10) is the real breather, and the gates cannot see it

- Memory players: 0.39–0.49 misses on floor 10, against 1.47–1.53 on f9 and 2.0–4.2 on f11. Deaths
  are 0–2%. A match lights about 13 cards a floor.
- `gate:difficulty-curve` puts floor 10 at **0.918 of par**, the tightest floor in the whole curve,
  and `gate:archetype-pressure` rates `lantern_hall` (a "reward" role) at 0.814, tighter than the
  pressure mean of 0.806. Both use perfect-memory players, who gain nothing from a lantern. The
  floor is fine. The instruments are blind to it (see bugs, below).

### Heavy costs about 14% of the misses a run pays, and features in a third of deaths

| Player | Surcharge ÷ misses paid | Deaths where a Heavy miss emptied the bank on the death floor |
|---|---|---|
| careful | 709 / 4676 (15%) | 0 of 2 |
| average (planner) | 674 / 5088 (13%) | 35% |
| wild (planner) | 722 / 5110 (14%) | 44% |
| mem16 / mem16t | 14% / 14% | 34% / 38% |
| mem10 | 12% | 27% |
| sloppy | 5% | 13% |

Heavy barely touches sloppy players, who die before Heavy cards are common (floor 4 on). It weighs
most on the middle of the field. The last surcharge a bank cannot cover is waived, as
`applyMissBudget` documents, so Heavy never ends a run on its own.

### The store: always affordable, but the miss is often not for sale

| Player (planner) | Stops | Mean gold at a stop | Stops where a miss was buyable | Bank full at the stop |
|---|---|---|---|---|
| careful | 2594 | 33.7 | 16% | 84% |
| average | 892 | 24.8 | 61% | 39% |
| mem16 | 590 | 24.8 | 34% | 66% |
| mem10 | 294 | 20.3 | 50% | 50% |
| sloppy | 114 | 16.8 | 90% | 10% |

- Something was affordable at 100% of stops, for every player and both policies.
- The miss, the item the store came back for, is refused as `full` at 39–84% of stops for anyone
  better than sloppy. That happens even though `grantMisses` could take a purchase on a full bank
  by pushing out the oldest grant, as a chain does. So a good player's gold goes to bombs and peeks.
  Careful players bought 2975 bombs, 1987 peeks and only 737 misses.
- **Shopping is worth about 4 floors on average.** An average player clears 10.4 floors (median 9.5)
  without shopping, 12.5 with the random shop and 14.4 with the planner.
- **Sloppy players never meet the store.** The median sloppy run clears 2 floors, and the first stop
  is after floor 3. They leave 35% of all the gold they earn unspent (925 of 2652 with the random shop, 1010 of 2849 with the planner).
  Deaths on each floor: f1 13%, f2 21%, f3 34%.

### Gold does not pile up

- Earned per floor: careful 10.8, average 8.0, mem16 8.3, sloppy 5.2. The ceiling per clear is
  2 + 3 + 3 = 8, and Gilded Chain supplies the rest.
- Price steps keep the purse near zero after a stop: the planner leaves 0.6–1.6 gold and the random
  shopper 1–3.5. Unspent gold at the end of a run is 3.6% of earnings for careful players and 8–21%
  for the rest. That is mostly gold earned since the last stop, which no stop existed to spend.

### Relics

Mean floors cleared by the planner when one row is struck from its list (200 seeds; the medians are
in brackets):

| Never buys | average (oracle 18%) | mem16t |
|---|---|---|
| nothing struck | 14.44 (12) | 12.29 (12.5) |
| Deep Pockets | **11.23 (10)** | 11.35 (12) |
| Gilded Chain | 13.46 (11) | 12.20 (13) |
| Long Look | 14.44 (12) | 12.29 (12.5) |
| all three relics | 11.54 (10) | 11.01 (11) |
| the miss | 12.47 (11) | 12.01 (12) |
| the whole store (no shopping) | 10.44 (9.5) | 10.46 (11) |

- **Deep Pockets (9 gold) is the most valuable thing in the store.** For an average player it is
  worth more than the miss itself: striking it costs 3.2 floors, striking the miss costs 2.0. It
  accounts for most of the store's total value of 4.0 floors. It is strong for the same reason the
  miss is often blocked: the cap of 4 is what binds.
- Owning a relic from floor 1 instead of from the first stop changes almost nothing (Deep Pockets
  from the start: 14.46 against 14.44), so what matters is owning it, not when.
- Gilded Chain pays about 6 gold a run for an average player and is worth about 1 floor.

- Deep Pockets is the first relic every planner buys: all 200 careful runs, 176 average runs and
  200 mem16 runs. The random shopper buys all three relics in nearly every run that reaches two
  stops.
- **Long Look cannot be valued by any instrument.** Every simulated player either knows the board or
  glimpses it by a card count, not by time. A random shopper still bought it 200 times. Its price of
  10, the highest in the store, is a guess.

### Wild joker

The joker is spent once a run, in 200 of 200 wild runs. A wild run clears 13.0 floors (random shop)
against 12.5 for the average player. The miss rate is the same, but the floors are different, so
this is not a clean A/B test. Either way, one joker a run does not move survival. Wild runs keep their own
fixed mutators (`sticky_fingers`, `short_memorize`, `findables_floor` in `createWildRun`) and never
meet the lantern hall or skittish cards, so the wild soak player does not exercise either.

## 3. Things that look like bugs, or blind spots, not balance

1. **The balance gates cannot see the lantern or skittish floors.** `sim-difficulty-curve.ts`,
   `sim-archetype-pressure.ts`, `sim-survival.ts` and the soak all play with perfect memory,
   choosing pairs from `getUnresolvedPlayablePairGroups` or by `pairKey`. A mutator that moves or
   lights cards changes nothing for such a player. The gates therefore report floor 10 as the
   tightest floor of the curve (0.918 of par), when it is the easiest for anyone who has to
   remember. They are equally blind to floor 11's 72% cliff. The same blind spot holds for the
   restless floor (8) and Long Look. This is an instrument bug, not a rule bug.
2. **The survival table in `miss-bank.ts` is stale** (45/17 → 34.5/12.5 at 10%/15%).
3. **`sim:run` flags `wildMatch` as "seen once and never again".** That is by design, since the
   joker is one per run (`wildMatchesRemaining: 1`), so the flag is noise.

No soak invariant fired: 0 violations in 800 runs. No item is never bought (Long Look is the
rarest, bought once in 200 planner runs, but only because the planner ranks it low). No gold is
unspendable.

## 4. Options for the owner (not applied)

1. **Skittish floor readability, or a softer flinch.** The whole difference between a 10% and a 72%
   death rate on floor 11 is whether the player can follow the flinch. Options: make the flinch
   unmissable (a trail or ghost at the old cell until the next flip); or move only the missed cards
   and not their neighbours (half the damage per miss); or keep the rule and move the floor later
   in the cycle. Measure first, with a player who tracks the missed cards but not the neighbours.
2. **Let a miss be bought on a full bank.** For example, buying refreshes the oldest grant's shelf,
   as a chain rung on a full bank already does. As it stands, the core item is blocked at 39–84% of
   stops for competent players. This keeps runs punishing (the cap does not move) but gives good
   players' gold something better than a sixth bomb. The same cap explains why Deep Pockets is the
   strongest row (worth 3.2 floors for 9 gold). If the miss stays blocked on a full bank, Deep
   Pockets is underpriced next to Long Look (10 gold, no measurable value).
3. **A first stop sloppy players can reach, or no gold before it.** 35% of sloppy players' gold is
   never spendable, and most of their runs end before floor 3. One option is a one-off stop after
   floor 2. Another is to leave the rules alone and say on the results screen what the gold was for.
4. **Re-derive the survival table and re-read Heavy.** Heavy is 13–15% of misses paid and features
   in 27–44% of deaths of mid players. If that is the intended weight, update the `miss-bank.ts`
   table. If it is more than intended, a Heavy surcharge could be limited to once a floor.
5. **Give the gates a memory player.** Add a positional-memory player (the probe's `mem16t` is about
   80 lines) to `sim:curve` and `sim:archetype-pressure`, so the lantern hall is measured as the
   reward floor it is and a moving-card mutator cannot hide a cliff again. Price Long Look only after
   an instrument can see it.
