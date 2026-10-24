import { DEPTH_CARVE_LINKS, depthHas } from './depth-rules';
import type { CarveDirection, RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { verbReached } from './verb-staircase-rules';

/**
 * Carve (DGE-015, rules 79): aim which way the cascade walks.
 *
 * From floor 7 (rules 89, `verb-staircase-rules.ts`; floor 25 before), between turns, Carve spends two links of the chain - the Hold's meter,
 * so three carves are one Hold not armed - to set a direction on the board. The next pop walks that
 * way first and reaches one further along it: a contact pop (`chunk-break-rules.ts`) takes the cells
 * on the carved side first under its cap and walks one more step along the axis; a realm's reaction
 * burst takes the pairs on the carved side first and one pair more of each element. A held match
 * pops nothing, so a carve waits through the Hold and shapes the release. A pop spends it; a carve
 * with nothing on its side still spends it, the pop falling back to its plain order. It never costs
 * a turn or a miss, and the floor's end takes it.
 */
export const CARVE_FROM = 79;
export const CARVE_LINKS = 2;
/** How many more pairs of each element a carved reaction burst takes. */
export const CARVE_BURST_EXTRA_PAIRS = 1;
export const CARVE_DIRECTIONS: readonly CarveDirection[] = ['up', 'right', 'down', 'left'];

// The Hold's meter (`hold-rules.ts` caps it); read here without importing the Hold, which imports the pop.
const linksOf = (run: Pick<RunState, 'holdLinks'>): number => runNonNegativeInteger(run.holdLinks);

/** A carve's price for this run: Depth 14 (`depth-rules.ts`) asks three links. */
export const carveLinksFor = (run: Partial<Pick<RunState, 'depth'>> | null | undefined): number => (depthHas(run, 'carve_three') ? DEPTH_CARVE_LINKS : CARVE_LINKS);

export const isCarveUnlocked = (run: Pick<RunState, 'board' | 'runRulesVersion'>): boolean =>
    (run.runRulesVersion ?? 0) >= CARVE_FROM && verbReached('carve', run);

export const isCarveDirection = (value: unknown): value is CarveDirection => typeof value === 'string' && (CARVE_DIRECTIONS as readonly string[]).includes(value);

/** Whether a carve can be set now: between turns, unlocked, two links in the meter, none already set. */
export const canCarve = (run: RunState): boolean =>
    run.status === 'playing' &&
    !!run.board &&
    run.board.flippedTileIds.length === 0 &&
    isCarveUnlocked(run) &&
    !isCarveDirection(run.carveDirection) &&
    linksOf(run) >= carveLinksFor(run);

/** Set the carve: two links spent, the direction on the board until a pop uses it. */
export const carve = (run: RunState, direction: CarveDirection): RunState =>
    canCarve(run) && isCarveDirection(direction)
        ? { ...run, carveDirection: direction, holdLinks: linksOf(run) - carveLinksFor(run), carvesThisFloor: runNonNegativeInteger(run.carvesThisFloor) + 1 }
        : run;

/** The carve a pop reads, or null. */
export const liveCarve = (run: Partial<Pick<RunState, 'carveDirection'>> | null | undefined): CarveDirection | null =>
    isCarveDirection(run?.carveDirection) ? run.carveDirection : null;

/** How far a cell lies along the carved axis from an origin: positive is the carved side. */
export const carveOffset = (index: number, origin: number, columns: number, direction: CarveDirection): number => {
    const dc = (index % columns) - (origin % columns);
    const dr = Math.floor(index / columns) - Math.floor(origin / columns);
    return direction === 'right' ? dc : direction === 'left' ? -dc : direction === 'down' ? dr : -dr;
};

/** Whether a cell lies on the carved side of any of the origins. */
export const onCarvedSide = (index: number, origins: readonly number[], columns: number, direction: CarveDirection): boolean =>
    origins.some((origin) => carveOffset(index, origin, columns, direction) > 0);

/** The cell one step along the carved axis, or null off the board. */
export const carveStep = (index: number, columns: number, total: number, direction: CarveDirection): number | null => {
    const col = index % columns;
    if (direction === 'right') return col < columns - 1 && index + 1 < total ? index + 1 : null;
    if (direction === 'left') return col > 0 ? index - 1 : null;
    if (direction === 'down') return index + columns < total ? index + columns : null;
    return index - columns >= 0 ? index - columns : null;
};

/** The carve spent: a pop took pairs along it (or, with nothing on its side, in its plain order). */
export const spendCarve = (run: RunState): RunState =>
    liveCarve(run) ? { ...run, carveDirection: null, carvesSpentThisFloor: runNonNegativeInteger(run.carvesSpentThisFloor) + 1 } : run;

/** Applied after every resolved turn: a turn whose pop took pairs spends the carve. */
export const spendCarveOnPop = (before: RunState, after: RunState): RunState =>
    liveCarve(before) && liveCarve(after) && runNonNegativeInteger(after.chunkPairsBrokenThisFloor) > runNonNegativeInteger(before.chunkPairsBrokenThisFloor)
        ? spendCarve(after)
        : after;
