import type { RunState } from './contracts';
import { simulateRunOccupancy, type RunOccupancyReport, type SystemOccupancyCounter } from './system-occupancy-simulation';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The deep census (DGE-027, 2026-10-23): the run census taken to the Warden's floor.
 *
 * The run census plays floors 1-24, where the reference player meets the first act and the Keeper,
 * so every mechanic the Descent deals deeper - the masks from 25, the Cartographer at 40, the
 * Sleepers from 41, the Spiral at 44 and 56, the Dread's purchases, the Warden at 60 - read zero
 * there and carried an argued exemption instead of a number. This plays the same
 * reference player, through the game's own floor transition, to floor 60, on fewer seeds (it is
 * two and a half times the floors), and watches only the deep counters. Each mechanic it covers
 * answers for itself with a measured share of the run's floors (`mechanic-accountability.ts`).
 *
 * The learned rule stays exempt: it reads the element matched most, and this census plays without a
 * realm. The verbs (Hold, Carve, Reprise) stay exempt too: the reference player never presses a
 * tool, and the soak's planned player is where they are counted.
 */
export const DEEP_CENSUS_FLOORS = 60;
export const DEEP_CENSUS_SEEDS: readonly number[] = Array.from({ length: 24 }, (_, index) => 60_013 + index * 7919);

const bought = (run: RunState): number =>
    run.dreadBought ? runNonNegativeInteger(run.dreadBought.sleeper) + runNonNegativeInteger(run.dreadBought.mask) + runNonNegativeInteger(run.dreadBought.wanderer) : 0;

export const DEEP_OCCUPANCY_COUNTERS: readonly SystemOccupancyCounter[] = [
    { id: 'deep.keeperSwaps', key: 'keeperSwapsThisFloor', label: 'The Keeper of Halls swapped its rooms', family: 'memory', cadence: 'rare', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.cartographerTurns', key: 'cartographerTurnsThisFloor', label: 'The Cartographer turned its lower deck', family: 'memory', cadence: 'rare', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.wardenRedeals', key: 'wardenRedealsThisFloor', label: 'The Warden dealt its face-down cards again', family: 'memory', cadence: 'rare', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.masksDropped', key: 'masksDroppedThisFloor', label: 'A mask dropped as its card turned', family: 'memory', cadence: 'common', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.sleepersWoken', key: 'sleepersWokenThisFloor', label: 'A Sleeper woke in another cell', family: 'memory', cadence: 'common', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.spiralRings', key: 'spiralRingsSealedThisFloor', label: 'A ring of the Spiral sealed', family: 'cascade', cadence: 'rare', kind: 'tally', player: 'reference', scope: 'run' },
    { id: 'deep.dreadBuys', key: 'dreadBought', read: bought, label: 'The Dread bought family pairs for the floor', family: 'memory', cadence: 'common', kind: 'state', player: 'reference', scope: 'run' }
];

/** The deep census: the reference player to floor 60, the deep counters only. */
export const simulateDeepCensus = ({ seeds = DEEP_CENSUS_SEEDS }: { seeds?: readonly number[] } = {}): RunOccupancyReport =>
    simulateRunOccupancy({ floors: DEEP_CENSUS_FLOORS, seeds, counters: DEEP_OCCUPANCY_COUNTERS });

/** Each deep counter must fire on some floor, or the mechanic it stands for never met the player. */
export const judgeDeepCensus = (report: Pick<RunOccupancyReport, 'rows'>): string[] =>
    report.rows.filter((row) => row.runFloorShare <= 0).map((row) => `${row.key} (${row.label}) never fired to floor ${DEEP_CENSUS_FLOORS}`);
