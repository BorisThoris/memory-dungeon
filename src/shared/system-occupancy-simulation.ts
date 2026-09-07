import type { RelicId, RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { countFindablePairs } from './board-tile-generation-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { activateDungeonExit, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn, revealDungeonExit } from './game';
import { getPrimaryPlaythroughExitTile, getUnresolvedPlayablePairGroups } from './playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Does this system ever happen to a player?
 *
 * The cascade simulation asks what the loop pays. The reachability gates ask whether a piece of
 * content can be reached at all. Neither asks the question that let the pop ship dead for six
 * floors: on the floors a player actually plays, does this rule ever fire?
 *
 * A rule can be implemented, unit-tested, wired into the turn path and named in the Codex, and
 * still never happen - because generation never produces the board it needs. That is not a bug a
 * unit test can see: every fixture is hand-built to make the rule fire, which is exactly what
 * hides it. So this plays real generated floors with a reference player and counts, per system,
 * the share of floors where its own counter moved.
 *
 * The counters are the run's own (`RunState`, per-floor), so nothing here re-derives a rule: it
 * reads the ledger the game keeps for itself. A system whose counter never moves across the whole
 * census is decoration, and the report says so by name.
 */
export interface SystemOccupancyCounter {
    /** The `RunState` per-floor counter this system writes. */
    key: keyof RunState & string;
    label: string;
    /** What the game would lose if this never fired. Sorted into the report by it. */
    family: 'cascade' | 'dungeon' | 'hazard' | 'reward' | 'memory' | 'route';
    /**
     * The share of floors this is expected to touch, at the reference miss rate. `rare` systems
     * are meant to be occasional; `core` ones are the loop. Both must be greater than zero: a
     * system that never happens is not rare, it is absent.
     */
    cadence: 'core' | 'common' | 'rare';
}

export const SYSTEM_OCCUPANCY_COUNTERS: readonly SystemOccupancyCounter[] = [
    { key: 'chunkBreaksThisFloor', label: 'A match popped the clump it touched', family: 'cascade', cadence: 'core' },
    { key: 'chunkPairsDroppedThisFloor', label: 'The drop took a suit’s last pairs', family: 'cascade', cadence: 'rare' },
    { key: 'feverBreaksThisFloor', label: 'A break landed at Fever', family: 'cascade', cadence: 'common' },
    { key: 'recallMatchesThisFloor', label: 'A pair was matched from memory', family: 'memory', cadence: 'core' },
    { key: 'recallMistakesThisFloor', label: 'A mismatch was made', family: 'memory', cadence: 'common' },
    { key: 'matchResolutionsThisFloor', label: 'A turn resolved', family: 'memory', cadence: 'core' },
    { key: 'findablesClaimedThisFloor', label: 'A pickup was claimed', family: 'reward', cadence: 'core' },
    { key: 'dungeonTreasuresOpenedThisFloor', label: 'A treasure was opened', family: 'reward', cadence: 'common' },
    { key: 'dungeonEnemiesDefeatedThisFloor', label: 'A warden was defeated', family: 'dungeon', cadence: 'common' },
    { key: 'dungeonTrapsResolvedThisFloor', label: 'A trap was resolved', family: 'dungeon', cadence: 'common' },
    { key: 'dungeonGatewaysUsedThisFloor', label: 'A gateway was used', family: 'dungeon', cadence: 'common' },
    { key: 'enemyHazardHitsThisFloor', label: 'A roaming hazard landed a hit', family: 'dungeon', cadence: 'rare' },
    { key: 'hazardTileTriggersThisFloor', label: 'A hazard tile triggered', family: 'hazard', cadence: 'common' },
    { key: 'hazardShuffleSnaresThisFloor', label: 'A shuffle snare sprang', family: 'hazard', cadence: 'rare' },
    { key: 'hazardCascadeCachesThisFloor', label: 'A cascade cache paid', family: 'hazard', cadence: 'rare' },
    { key: 'hazardMirrorDecoysThisFloor', label: 'A mirror decoy fooled a flip', family: 'hazard', cadence: 'rare' },
    { key: 'hazardFragileCacheClaimsThisFloor', label: 'A fragile cache was claimed', family: 'hazard', cadence: 'rare' },
    { key: 'hazardTollCachesThisFloor', label: 'A toll cache was paid', family: 'hazard', cadence: 'rare' },
    { key: 'hazardFuseCachesThisFloor', label: 'A fuse cache was claimed', family: 'hazard', cadence: 'rare' },
    { key: 'mimicCacheClaimsThisFloor', label: 'A mimic cache was opened', family: 'hazard', cadence: 'rare' },
    { key: 'magpieTheftsThisFloor', label: 'The magpie stole a pair', family: 'dungeon', cadence: 'rare' },
    { key: 'anchorSealUsesThisFloor', label: 'An anchor seal was spent', family: 'route', cadence: 'rare' },
    { key: 'catalystAltarUpgradesThisFloor', label: 'A catalyst altar upgraded something', family: 'route', cadence: 'rare' },
    { key: 'parasiteVesselConversionsThisFloor', label: 'A parasite vessel converted', family: 'route', cadence: 'rare' },
    { key: 'pinLatticeRewardsThisFloor', label: 'A pin lattice paid out', family: 'route', cadence: 'rare' },
    { key: 'lanternWardScoutsThisFloor', label: 'A lantern ward scouted', family: 'route', cadence: 'rare' },
    { key: 'omenSealScoutsThisFloor', label: 'An omen seal scouted', family: 'route', cadence: 'rare' },
    { key: 'safeHazardWardsUsedThisFloor', label: 'A safe-hazard ward absorbed a hit', family: 'hazard', cadence: 'rare' }
];

/*
 * Not censused, and why: `undoUsesThisFloor` counts the undos a floor has LEFT, not the ones a
 * player spent, so a non-zero reading means the charge exists rather than that anything happened.
 * Every counter above is a tally of something that occurred. A "charges remaining" field read as
 * an occurrence is the same mistake this file exists to catch, one level up.
 */

export interface SystemOccupancyReport {
    floors: number;
    rows: Array<{
        key: string;
        label: string;
        family: SystemOccupancyCounter['family'];
        cadence: SystemOccupancyCounter['cadence'];
        /** Floors where this system's counter moved, over floors played. */
        floorShare: number;
        /** Total the counter moved by, over floors played. */
        perFloor: number;
    }>;
}

const playFloor = (seed: number, floor: number, missRate: number, relicIds: readonly RelicId[], maxTurns: number): RunState => {
    const rulesVersion = GAME_RULES_VERSION;
    const schedule = pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless');
    const board = buildBoard(floor, {
        runSeed: seed,
        runRulesVersion: rulesVersion,
        floorTag: schedule.floorTag,
        floorArchetypeId: schedule.floorArchetypeId,
        featuredObjectiveId: schedule.featuredObjectiveId,
        cycleFloor: schedule.cycleFloor,
        gameMode: 'endless',
        activeMutators: schedule.mutators,
        relicIds
    });
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed }));
    let run: RunState = {
        ...base,
        board,
        status: 'playing',
        relicIds: [...relicIds],
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
    const rng = createMulberry32(hashStringToSeed(`occupancy:${seed}:${floor}:${missRate}:${rulesVersion}`));
    let turns = 0;
    while (run.status === 'playing' && turns < maxTurns) {
        const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
            group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
        );
        if (groups.length === 0) break;
        const hidden = run
            .board!.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));
        const wantsMiss = rng() < missRate && hidden.length >= 3;
        let first: Tile;
        let second: Tile;
        if (wantsMiss) {
            first = hidden[pickRngIndex(rng, hidden.length)]!;
            const others = hidden.filter((tile) => tile.pairKey !== first.pairKey);
            if (others.length === 0) break;
            second = others[pickRngIndex(rng, others.length)]!;
        } else {
            const group = groups[pickRngIndex(rng, groups.length)]!;
            first = group[0]!;
            second = group[1]!;
        }
        run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
        turns += 1;
    }
    if (run.status === 'playing') {
        const exit = getPrimaryPlaythroughExitTile(run.board!);
        if (exit) {
            run = activateDungeonExit(revealDungeonExit(run, exit.id));
        }
    }
    return run;
};

export const OCCUPANCY_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234] as const;

export const simulateSystemOccupancy = ({
    floors = 16,
    seeds = OCCUPANCY_SEEDS,
    missRate = 0.15,
    relicIds = [],
    maxTurns = 240
}: {
    floors?: number;
    seeds?: readonly number[];
    missRate?: number;
    relicIds?: readonly RelicId[];
    maxTurns?: number;
} = {}): SystemOccupancyReport => {
    const hits = new Map<string, { floors: number; total: number }>();
    let played = 0;
    for (const seed of seeds) {
        for (let floor = 1; floor <= floors; floor += 1) {
            const run = playFloor(seed, floor, missRate, relicIds, maxTurns);
            played += 1;
            for (const counter of SYSTEM_OCCUPANCY_COUNTERS) {
                const value = runNonNegativeInteger(run[counter.key] as number);
                const row = hits.get(counter.key) ?? { floors: 0, total: 0 };
                if (value > 0) row.floors += 1;
                row.total += value;
                hits.set(counter.key, row);
            }
        }
    }
    return {
        floors: played,
        rows: SYSTEM_OCCUPANCY_COUNTERS.map((counter) => {
            const row = hits.get(counter.key) ?? { floors: 0, total: 0 };
            return {
                key: counter.key,
                label: counter.label,
                family: counter.family,
                cadence: counter.cadence,
                floorShare: played === 0 ? 0 : row.floors / played,
                perFloor: played === 0 ? 0 : row.total / played
            };
        })
    };
};

/**
 * The bar, by cadence. `core` is the loop and must be nearly every floor; `common` is a system a
 * player meets often enough to learn; `rare` is occasional - but never zero, because a system that
 * never happens is not rare, it is absent, and absent is what this census exists to catch.
 */
export const SYSTEM_OCCUPANCY_BANDS = {
    core: { min: 0.9, max: 1 },
    common: { min: 0.1, max: 0.9 },
    /*
     * 0.005 is one floor in two hundred, which is below what this census can resolve rather than a
     * cadence anyone would design for: a system that fires once because a seed allowed it clears
     * the bar. Raising it to 0.02 was tried and reverted - at 120 floors it called three hazard
     * caches thin that sit at 4-7% over 160, so the bar was measuring the sample, not the game.
     * A real bar needs more floors under it first.
     */
    rare: { min: 0.005, max: 0.25 }
} as const;

/**
 * The ceilings, and why a census needs them.
 *
 * Every bar here was a minimum, so the census could only ever see the dead half of the game. A
 * system can fail its own design from the other direction just as completely: something written to
 * be occasional that fires on a third of floors is not a rare flourish a player notices, it is
 * part of the floor, and something written as one system among several that fires on nearly all of
 * them has quietly become the loop while its neighbours went quiet. Both are the same failure as a
 * silence - the game is not the game that was designed - and neither leaves a trace a minimum can
 * catch.
 *
 * Run against the ceilings the first time, two rows breached and both were mislabels rather than
 * generation faults, which is worth stating because it is the answer a good diagnostic gives most
 * often: `dungeonGatewaysUsedThisFloor` at 0.369 and `findablesClaimedThisFloor` at 0.944 were
 * filed `rare` and `common`, and taking a route gateway or claiming a findable is something this
 * game means to happen on most floors. They are relabelled rather than tuned. `core` keeps a
 * ceiling of 1 so the shape of the record is the same for every cadence, and so that a `core`
 * system reading above 1 - which would mean the counter is being read as something other than a
 * share - fails rather than passes.
 */

/**
 * The census as a ratchet: what is silent and what is thin today, asserted exactly.
 *
 * `judgeSystemOccupancy` asks the aspirational question - is anything silent or thin at all - and
 * the answer is yes, eleven and one, so it cannot gate anything until that is nought. This is the
 * question a gate can ask meanwhile: has the set CHANGED. A system that goes quiet fails it the
 * moment it does, and a system brought back to life fails it too, which is the only way a list
 * like this ever shrinks rather than drifts.
 *
 * Every entry is a debt with a task against it, not an exemption. Four of the silent ones are
 * route specials this census structurally cannot reach, because it plays floors rather than runs
 * (task 150).
 *
 * The list has moved once, and it is worth recording how. Two silences were predicted to end with
 * the dungeon-budget reserve (task 156). The reserve shipped in Gen 167 and none of them moved:
 * the earlier measurement at a 40% share said shuffle snares and the safe-hazard ward came back,
 * and at the 25% share that actually shipped they do not.
 *
 * The drop came off this list in Gen 168 instead, and from the direction Gen 151 predicted. Its
 * finding was that the drop had nothing to take because the ripple had already swept the suit, and
 * that "the remnant this rule wants is a bigger suit than generation deals today; that is a task,
 * not a threshold." Gen 168 is that task: a bounded wave below Sharp and one suit per six pairs
 * leave a remnant standing, and the drop now takes it. The two the reserve was supposed to wake
 * keep their tasks (153, 154) rather than being counted as solved by anything.
 */
export const SYSTEM_OCCUPANCY_BASELINE = {
    silent: [
        'anchorSealUsesThisFloor',
        'catalystAltarUpgradesThisFloor',
        'enemyHazardHitsThisFloor',
        'hazardMirrorDecoysThisFloor',
        'hazardShuffleSnaresThisFloor',
        'lanternWardScoutsThisFloor',
        'magpieTheftsThisFloor',
        'mimicCacheClaimsThisFloor',
        'parasiteVesselConversionsThisFloor',
        'pinLatticeRewardsThisFloor',
        'safeHazardWardsUsedThisFloor'
    ],
    thin: ['feverBreaksThisFloor'],
    /*
     * Empty, and that is a result rather than a placeholder: with the two mislabelled cadences
     * corrected there is nothing running above its own ceiling. It is a ratchet like the other two
     * - a system that grows into the floor fails this the moment it does, and the fix is either the
     * generation or the label, decided deliberately and written down here.
     */
    dominant: [] as readonly string[]
} as const;

/** The floor count the baseline above was measured at. A different count measures a different game. */
export const SYSTEM_OCCUPANCY_BASELINE_FLOORS = 12;

/**
 * Compare a census against the recorded baseline, naming what moved in either direction.
 *
 * This is what a gate runs. `judgeSystemOccupancy` says whether the game is where it should be;
 * this says whether a change made it worse - or better without anyone updating the record, which
 * matters just as much, because an unrecorded revival is how a baseline stops meaning anything.
 */
export const judgeSystemOccupancyAgainstBaseline = (
    report: SystemOccupancyReport
): { ok: boolean; issues: string[] } => {
    const silent = report.rows.filter((row) => row.floorShare === 0).map((row) => row.key);
    const thin = report.rows
        .filter((row) => row.floorShare > 0 && row.floorShare < SYSTEM_OCCUPANCY_BANDS[row.cadence].min)
        .map((row) => row.key);
    const issues: string[] = [];
    const compare = (label: string, observed: readonly string[], expected: readonly string[]): void => {
        for (const key of observed) {
            if (!expected.includes(key)) issues.push(`${key} is now ${label} and is not in the baseline`);
        }
        for (const key of expected) {
            if (!observed.includes(key)) {
                issues.push(`${key} is no longer ${label} - it came back to life, so update the baseline`);
            }
        }
    };
    compare('silent', silent, SYSTEM_OCCUPANCY_BASELINE.silent);
    compare('thin', thin, SYSTEM_OCCUPANCY_BASELINE.thin);
    compare('dominant', dominantSystemKeys(report), SYSTEM_OCCUPANCY_BASELINE.dominant);
    return { ok: issues.length === 0, issues };
};

export const judgeSystemOccupancy = (
    report: SystemOccupancyReport
): { ok: boolean; issues: string[]; silent: string[]; dominant: string[] } => {
    const issues: string[] = [];
    const silent: string[] = [];
    const dominant: string[] = [];
    for (const row of report.rows) {
        if (row.floorShare === 0) {
            silent.push(`${row.key} (${row.label}) never fired on any of ${report.floors} floors`);
            continue;
        }
        const band = SYSTEM_OCCUPANCY_BANDS[row.cadence];
        if (row.floorShare < band.min) {
            issues.push(`${row.key} floorShare ${row.floorShare.toFixed(3)} below ${band.min} for a ${row.cadence} system`);
        }
        if (row.floorShare > band.max) {
            dominant.push(
                `${row.key} (${row.label}) fired on ${row.floorShare.toFixed(3)} of floors, above ${band.max} for a ${row.cadence} system`
            );
        }
    }
    return { ok: issues.length === 0 && silent.length === 0 && dominant.length === 0, issues, silent, dominant };
};

/** Systems firing above their cadence's ceiling: the other half of the census. */
export const dominantSystemKeys = (report: SystemOccupancyReport): string[] =>
    report.rows.filter((row) => row.floorShare > SYSTEM_OCCUPANCY_BANDS[row.cadence].max).map((row) => row.key);

export const summarizeSystemOccupancy = (report: SystemOccupancyReport): string =>
    [...report.rows]
        .sort((a, b) => a.floorShare - b.floorShare)
        .map(
            (row) =>
                `${row.floorShare === 0 ? 'SILENT' : row.floorShare.toFixed(3).padStart(6)} ` +
                `x${row.perFloor.toFixed(2).padStart(6)} ${row.cadence.padEnd(6)} ${row.family.padEnd(8)} ${row.key}`
        )
        .join('\n');
