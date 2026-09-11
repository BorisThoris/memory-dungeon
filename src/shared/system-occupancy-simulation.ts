import type { BoardState, RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { countFindablePairs } from './board-tile-generation-rules';
import { filterMutatorsByContentLock } from './content-lock-state';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';
import { togglePinnedTile } from './board-power-state';
import { createWildRun } from './run-creation-rules';
import { TILE_TRAIT_COUNT_KINDS } from './session-stats-rules';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { getUnresolvedPlayablePairGroups } from './playthrough-solver-rules';
import { orthogonalNeighbours } from './chunk-break-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';

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
    /** Unique row id. Two passes may watch the same field for different reasons, so the key alone
     *  is not an identity: the tooled player spends a row/swap charge on a row shuffle and the
     *  setup player spends the same charge on a tile swap, and those are two different systems. */
    id: string;
    /** The `RunState` field this system moves. */
    key: string;
    /** How the field is read, when it is not a plain number on the run. Traits live in a record on
     *  `run.stats`, and the gambit and the pin are a flag and a list rather than a tally. */
    read?: (run: RunState) => number;
    label: string;
    /** What the game would lose if this never fired. Sorted into the report by it. */
    family: 'cascade' | 'memory' | 'reward' | 'tools';
    /**
     * Which census decides this system's band (Gen 207).
     *
     * `floor` is the default and means the floor census: everything the floor hands back at full
     * strength - the region shuffle refilled by the floor transition, the undo, the gambit, and
     * every tally that resets with the board.
     *
     * `run` means the charge is handed out once and the run never refills it, so measuring it a
     * floor at a time measures a fresh run every floor and reports a once-a-run button as the loop.
     * The wild joker read 1.000 x 1.00 and `core` on the floor census; in a run it is spent on
     * floor 1 and never seen again, on every seed. `simulateRunOccupancy` bands these.
     */
    scope?: 'floor' | 'run';
    /**
     * The share of floors this is expected to touch, at the reference miss rate. `rare` systems
     * are meant to be occasional; `core` ones are the loop. Both must be greater than zero: a
     * system that never happens is not rare, it is absent.
     */
    cadence: 'core' | 'common' | 'rare';
    /**
     * How the field records the system happening.
     *
     * `tally` counts up from zero as the thing occurs. `spend` counts *down*: a charge the run was
     * handed, whose fall is what the player used. Reading a charge as a tally is the mistake this
     * file exists to catch one level up - a non-zero "undos left" means the charge exists, not that
     * anyone pressed it - so the spend kind reads the drop rather than the value.
     *
     * The drop is summed as it happens, not taken from the two endpoints, because a charge can be
     * refilled mid-floor: the Echo trait hands peeks back. Measured end to end, half the floors
     * reported no peek spent on a floor where one was spent and another earned. A fall that
     * happened is still a fall.
     */
    kind: 'tally' | 'spend';
    /**
     * Which pass sees it. The `reference` player only ever flips pairs, which is why every power
     * and every charge was invisible until Gen 195; the `tooled` player spends what a plain endless
     * run hands it. They are separate passes on purpose, so a shuffled board never moves the
     * cascade counters the reference baseline is ratcheted against.
     *
     * The `setup` player is the third pass, added at Gen 199: a run built the way the setup sheet
     * builds one, so the powers and tokens a plain endless run never hands out - the wild joker and
     * its match token, Stray, Flash, the gambit's third flip, the pin, the tile swap - are on the
     * board to be spent, and the trait tiles that come with that setup get matched. Without it
     * eighteen of the game's forty-five mechanics had no counter at all and sat on an exemption
     * list, which is a debt register rather than a census.
     */
    player: 'reference' | 'tooled' | 'setup';
}

/*
 * The rule Gen 201 learned, written down where the next counter is added:
 *
 * A counter the census presses unconditionally measures the census, not the game.
 *
 * The setup pass used to press the pin, the swap and the flash on floor open regardless of what
 * the board looked like. All three then read exactly 1.000 x 1.00 on every floor of every seed,
 * and all three were banded `core` - a claim that the game does this on nearly every floor, which
 * nothing had ever measured. It was constructed.
 *
 * So a press in either tooled or setup pass has to sit behind a condition the board can fail: the
 * pin and the flash want a miss to have happened, the swap wants a pair whose halves are not
 * already touching. When a press genuinely has a reason on every floor - the opening peek always
 * has an unrevealed card, the joker always has a partner - 1.000 is a real answer and stays.
 */

export const SYSTEM_OCCUPANCY_COUNTERS: readonly SystemOccupancyCounter[] = [
    { id: 'chunkBreaks', key: 'chunkBreaksThisFloor', label: 'A match popped the clump it touched', family: 'cascade', cadence: 'core', kind: 'tally', player: 'reference' },
    { id: 'chunkPairsDropped', key: 'chunkPairsDroppedThisFloor', label: 'The drop took a severed suit’s last pairs', family: 'cascade', cadence: 'common', kind: 'tally', player: 'reference' },
    { id: 'feverBreaks', key: 'feverBreaksThisFloor', label: 'A break landed at Fever', family: 'cascade', cadence: 'common', kind: 'tally', player: 'reference' },
    { id: 'recallMatches', key: 'recallMatchesThisFloor', label: 'A pair was matched from memory', family: 'memory', cadence: 'core', kind: 'tally', player: 'reference' },
    { id: 'recallMistakes', key: 'recallMistakesThisFloor', label: 'A mismatch was made', family: 'memory', cadence: 'common', kind: 'tally', player: 'reference' },
    { id: 'matchResolutions', key: 'matchResolutionsThisFloor', label: 'A turn resolved', family: 'memory', cadence: 'core', kind: 'tally', player: 'reference' },
    { id: 'findablesClaimed', key: 'findablesClaimedThisFloor', label: 'A pickup was claimed', family: 'reward', cadence: 'core', kind: 'tally', player: 'reference' },
    /*
     * The magpie, which had no counter at all until Gen 208 (task 156) - a mechanic that takes a
     * matched pair back off the player and left no trace in the census that exists to catch exactly
     * that. Filed under memory rather than reward because a stolen pair is a pair to remember again,
     * which is what the player actually has to do about it.
     *
     * Run-scoped, and it is the cleanest demonstration of why that distinction had to exist. The
     * bird arrives on every third mismatch OF THE RUN (`stats.mismatches`, MAGPIE_MISS_INTERVAL),
     * and only on a floor carrying its mutator. Given a fresh run every floor, the third mismatch
     * almost never arrives before the board is cleared, so the floor census reported the magpie
     * SILENT across 240 floors - a mechanic that ships, works, and is invisible to the instrument
     * built to find exactly that. Across whole runs it reads 0.013, banded `rare`. Gen 207 caught
     * a system called `core` on a fresh-run-per-floor reading; this is the same error inverted.
     */
    { id: 'magpieThefts', key: 'magpieTheftsThisFloor', label: 'The magpie took a matched pair back', family: 'memory', cadence: 'rare', kind: 'tally', player: 'reference', scope: 'run' },
    /*
     * The featured objective, uncounted since the census existed (Gen 216).
     *
     * Its exemption in `mechanic-accountability.ts` read "spans floors, and the census resets
     * between them - needs the run-level census (task Gen 150)". The run-level census shipped at
     * Gen 207 and nobody came back: the blocker named in the exemption had been gone for eight
     * generations while the line went on excusing the mechanic. An exemption that names its own
     * blocker is a debt with a due date, and this one was overdue.
     *
     * Run-scoped and read as a delta, which is what makes the streak usable as a counter at all.
     * `featuredObjectiveStreak` is a run-cumulative number settled by `advanceToNextLevel` - the
     * game's own transition, which the run census steps - and it *decays* on a miss. The census
     * clamps a delta at zero, so a rise means the floor cleared its objective and a decay reads as
     * a silent floor, which is the right reading: the row counts floors that completed, not the
     * height of the streak.
     */
    { id: 'featuredStreak', key: 'featuredObjectiveStreak', label: 'A floor cleared its featured objective', family: 'reward', cadence: 'common', kind: 'tally', player: 'reference', scope: 'run' },
    // The four charges below are handed out once and never refilled by the floor transition, so
    // the run census is what bands them (Gen 207). The peek survives its `core` bar on the strength
    // of the floor curios: three of them grant a peek charge, and it reads 0.904 across a run.
    { id: 'peek', key: 'peekCharges', label: 'A peek was spent on a hidden tile', family: 'tools', cadence: 'core', kind: 'spend', player: 'tooled', scope: 'run' },
    // Was `core` on the floor census's 1.000. A run starts with one shuffle charge and one curio
    // grants another, so it lands on 0.196 of a run's floors: a tool you keep for when you need it.
    { id: 'shuffle', key: 'shuffleCharges', label: 'The board was shuffled', family: 'tools', cadence: 'common', kind: 'spend', player: 'tooled', scope: 'run' },
    { id: 'regionShuffle', key: 'regionShuffleCharges', label: 'A row was shuffled', family: 'tools', cadence: 'core', kind: 'spend', player: 'tooled' },
    { id: 'undo', key: 'undoUsesThisFloor', label: 'A flip was taken back before it resolved', family: 'tools', cadence: 'common', kind: 'spend', player: 'tooled' },

    /*
     * The setup pass (Gen 199). Everything below is on the board only because a run setup put it
     * there, which is why none of it had a counter until now: the census played plain endless
     * floors, so it could only ever have reported the setup it chose rather than the game.
     */
    /*
     * Gen 201 re-banded this from `core` to `common`, against the first honest measurement it has
     * ever had. It read 1.000 while the census pressed it on floor open regardless of the board;
     * pressed when a player would press it - after a miss, when the floor has just refused to give
     * anything up - it reads 0.158, which is the reference miss rate. That is the right shape: the
     * flash answers being stuck, and a player is stuck about as often as they miss.
     */
    // A setup charge, spent once and gone: 0.042 of a run's floors, not the 0.158 a fresh run every
    // floor reported. Rare is what a once-a-run charge is.
    { id: 'flashPair', key: 'flashPairCharges', label: 'A pair was flashed', family: 'tools', cadence: 'rare', kind: 'spend', player: 'setup', scope: 'run' },
    /*
     * Gen 200 re-banded this from `common` to `core`, against the measurement. Stray was the only
     * thing that ever took the wild joker off the board before the setup player could spend it, and
     * Stray is gone: a run that is granted the token now spends it on every floor, 1.000. The band
     * describes what the game does, so it moves rather than the number being argued down.
     */
    // The clearest case Gen 207 found: `core` - the loop, nearly every floor - on the strength of a
    // census that built a new setup run for every floor. In a run the joker is spent on floor 1 and
    // never seen again, on all ten seeds. That is the setup sheet working as written; the band was
    // describing the instrument.
    { id: 'wildMatch', key: 'wildMatchesRemaining', label: 'The wild joker was spent on a match', family: 'tools', cadence: 'rare', kind: 'spend', player: 'setup', scope: 'run' },
    /*
     * Stays `core`, and now on evidence rather than construction: 0.988. A swap has a real target
     * on nearly every board, because nearly every board deals at least one pair whose halves are
     * not already touching - which is exactly what Gen 198's separation rule set out to produce.
     */
    { id: 'tileSwap', key: 'regionShuffleCharges', label: 'Two tiles were swapped', family: 'tools', cadence: 'core', kind: 'spend', player: 'setup' },
    {
        id: 'gambit',
        key: 'gambitThirdFlipUsed',
        read: (run) => (run.gambitThirdFlipUsed === true ? 1 : 0),
        label: 'The gambit took a third flip',
        family: 'tools',
        // Common, not core: the gambit is spent on a miss, and the reference miss rate does not
        // produce one on every floor. Measured 0.458, which is the undo's shape for the same reason.
        cadence: 'common',
        kind: 'tally',
        player: 'setup'
    },
    {
        id: 'pin',
        key: 'pinnedTileIds',
        read: (run) => runNonNegativeInteger(run.pinsPlacedCountThisRun),
        label: 'A tile was pinned',
        family: 'tools',
        /*
         * Gen 201 re-banded this from `core` to `common`, for the same reason as the flash. The pin
         * marks a card you have seen and cannot pair yet, so it cannot have a reason before the
         * first miss; pressed there it reads 0.158 rather than the 1.000 a floor-open press
         * manufactured. Pinning is a response to going wrong, and going wrong is `common`.
         */
        cadence: 'common',
        kind: 'tally',
        player: 'setup'
    },
    ...TILE_TRAIT_COUNT_KINDS.map((kind): SystemOccupancyCounter => ({
        id: `trait.${kind}`,
        key: 'stats',
        read: (run) => runNonNegativeInteger(run.stats?.tileTraitMatches?.[kind]),
        label: `A ${kind} tile was matched`,
        family: 'memory',
        // Measured 0.33 to 0.57 of floors at Gen 199. Filed as rare on the first pass and corrected
        // by the first measurement: four traits over a floor's tiles is not an occasional event.
        cadence: 'common',
        kind: 'tally',
        player: 'setup'
    }))
];

/*
 * Twenty counters left this list when the dungeon layer left the board: the treasures, the wardens,
 * the traps, the gateways, the roaming hazards, the seven hazard-tile caches, the magpie and the
 * six route specials. Every one of them read zero on all 160 floors, which is what a censused
 * system looks like after the thing it counts is deleted.
 *
 * They are removed rather than baselined as silent on purpose. A baseline says "this is quiet and
 * we have accepted that"; the honest reading here is "this does not exist", and a census that
 * keeps listing absent systems is a census nobody reads. `docs/REMOVED_DUNGEON_LAYER.md` is where
 * they went.
 */

/*
 * `undoUsesThisFloor` is the reason the `spend` kind exists. It counts the undos a floor has LEFT,
 * so reading its value as an occurrence would report "the charge exists" as "somebody used it" -
 * the same mistake this file exists to catch, one level up. Read as a spend, the drop from what the
 * floor opened with is exactly what the player pressed.
 *
 * Three powers stay uncounted because a plain endless run never hands them out: Destroy, Stray
 * Remove and Flash Pair all start at zero charges and are granted by a run setup. A census that
 * reported them silent would be reporting the setup it chose, not the game.
 *
 * A `tools` row reads differently from the rest. The tooled player presses everything it is given,
 * so the number is how often the power was *usable*, not how often a real player would reach for
 * it: the peek works on every floor, the shuffle on 0.975 of them (the rest have too few hidden
 * pairs left by the time it is tried), and the undo on 0.558 (it is spent on a miss, and the
 * reference miss rate does not produce one on every floor). Read them as reachability.
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

/**
 * What a player does with the tools a plain endless run hands them, expressed as the least
 * interesting policy that still presses every button: peek the first hidden tile, take back the
 * first flip that was going to be a mismatch, and shuffle once the floor is underway.
 *
 * It is deliberately not clever. The census asks whether a system can happen on a real board, not
 * whether it is worth using - a power a good player would never touch still has to be reachable.
 *
 * **Gen 205 moved the shuffle off the halfway mark.** It used to be pressed the first time half the
 * pairs were gone, and both shuffles read exactly 0.900 against a core bar of 0.900 - a gate
 * passing by nothing at all, which the redrawn authored floors then failed by one floor in 240.
 * The 24 floors that missed were not floors where a shuffle was impossible: they were floors where
 * a break carried the board from under half to empty in one turn, so the halfway state never
 * existed to press anything in. That is a fact about the cascade, and the census was reporting it
 * as a fact about the shuffle. A floor with one match resolved and cards still hidden is a board a
 * player would shuffle, and it is a state every floor that lasts a turn reaches.
 *
 * Both shuffles read 1.000 now, and that is a reachability claim rather than a rate: the census
 * presses each of them once per floor, so 1.000 says every floor offers the press, not that a
 * player shuffles on every floor. It can still fail - a row needs two hidden cards left in it -
 * which is the difference between this and the floor-open presses Gen 201 took out.
 */
const spendTools = (run: RunState, phase: 'opening' | 'underway'): RunState => {
    const board = run.board;
    if (!board || run.status !== 'playing') {
        return run;
    }
    if (phase === 'opening') {
        const hidden = board.tiles.find((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));
        return hidden ? applyPeek(run, hidden.id) : run;
    }
    const shuffled = applyShuffle(run);
    const rows = Math.max(1, Math.ceil(shuffled.board!.tiles.length / Math.max(1, shuffled.board!.columns)));
    for (let row = 0; row < rows; row += 1) {
        const next = applyRegionShuffle(shuffled, row);
        if (next !== shuffled) {
            return next;
        }
    }
    return shuffled;
};

/**
 * What a player does with what a run *setup* hands them.
 *
 * Gen 201 rewrote this, because the version before it pressed the pin, the swap and the flash
 * unconditionally on floor open, before a single card had been turned. Three tools therefore read
 * exactly 1.000 x 1.00 on every floor of every seed - a number produced by the census script, not
 * by the game, and then banded `core`, which is a claim that the game does this on nearly every
 * floor. That claim was never measured; it was constructed.
 *
 * So each tool is now reached for when the board gives it the reason the tool exists for, and the
 * share falls where it falls:
 *
 *   - **Pin** marks a card you have seen and cannot pair yet. It needs a miss to have happened, so
 *     it moved out of the floor-open block and into the turn loop.
 *   - **Tile swap** moves a card toward its partner. It needs two hidden halves of one pair that
 *     are not already touching - on a tight board they often are, and then there is nothing to fix.
 *   - **Flash pair** is for being stuck, which on a floor's first turn nobody is.
 *
 * It is still not a clever player. The census asks whether a system happens on real boards at a
 * plausible rate, not whether an expert would squeeze more from it.
 */
const setupSwapTargets = (run: RunState): [string, string] | null => {
    const board = run.board;
    if (!board) return null;
    const columns = Math.max(1, board.columns);
    const total = board.tiles.length;
    const indexById = new Map(board.tiles.map((tile, index) => [tile.id, index]));
    const byPair = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.state !== 'hidden' || isSingletonUtilityPairKey(tile.pairKey)) continue;
        const group = byPair.get(tile.pairKey);
        if (group) group.push(tile);
        else byPair.set(tile.pairKey, [tile]);
    }
    for (const group of byPair.values()) {
        if (group.length !== 2) continue;
        const [left, right] = group as [Tile, Tile];
        const leftIndex = indexById.get(left.id);
        const rightIndex = indexById.get(right.id);
        if (leftIndex == null || rightIndex == null) continue;
        const neighbours = orthogonalNeighbours(leftIndex, columns, total);
        if (neighbours.includes(rightIndex)) continue;
        // Move the right half into a cell touching the left one, so the pair ends up adjacent.
        for (const cell of neighbours) {
            const occupant = board.tiles[cell];
            if (!occupant || occupant.state !== 'hidden') continue;
            if (occupant.id === right.id || occupant.pairKey === left.pairKey) continue;
            return [occupant.id, right.id];
        }
    }
    return null;
};

const spendSetupTools = (run: RunState, phase: 'opening' | 'afterMiss'): RunState => {
    const board = run.board;
    if (!board || run.status !== 'playing') {
        return run;
    }
    if (phase === 'opening') {
        // The one tool with a reason at floor open: nothing is known yet, and a swap made now is a
        // swap made while every card is still face down, which is when a player would make it.
        const targets = setupSwapTargets(run);
        return targets ? applyTileSwap(run, targets[0], targets[1]) : run;
    }
    // After a miss: two cards were just seen. Pin one to hold it, and flash when the miss leaves
    // the player with nothing they can act on.
    let next = run;
    const seen = board.tiles.find(
        (tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey) && !runStringArray(next.pinnedTileIds).includes(tile.id)
    );
    if (seen) next = togglePinnedTile(next, seen.id);
    return applyFlashPair(next);
};

const readCounter = (counter: SystemOccupancyCounter, run: RunState): number =>
    counter.read ? counter.read(run) : runNonNegativeInteger((run as unknown as Record<string, number>)[counter.key]);

const SPEND_COUNTERS = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.kind === 'spend');

export interface OccupancyFloorResult {
    run: RunState;
    /** Every fall in a watched charge, summed as it happened. */
    spends: Map<string, number>;
}

/** The floor as the schedule builds it, which is the board a run is handed on that level. */
const scheduledFloorBoard = (seed: number, floor: number, includeWildTile: boolean): BoardState => {
    const rulesVersion = GAME_RULES_VERSION;
    const schedule = pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless');
    return buildBoard(floor, {
        runSeed: seed,
        runRulesVersion: rulesVersion,
        floorTag: schedule.floorTag,
        floorArchetypeId: schedule.floorArchetypeId,
        featuredObjectiveId: schedule.featuredObjectiveId,
        cycleFloor: schedule.cycleFloor,
        gameMode: 'endless',
        activeMutators: schedule.mutators,
        includeWildTile
    });
};

/**
 * One floor, played from the run state it is handed.
 *
 * Split out at Gen 207 so the run census and the floor census play the floor the same way. A second
 * player would diverge from this one within a generation or two, and then the two censuses would be
 * measuring different games while reporting the same units.
 */
const playFloorFrom = (
    startingRun: RunState,
    seed: number,
    floor: number,
    missRate: number,
    maxTurns: number,
    pass: SystemOccupancyCounter['player'] = 'reference'
): OccupancyFloorResult => {
    const tooled = pass === 'tooled';
    const setup = pass === 'setup';
    const rulesVersion = GAME_RULES_VERSION;
    let run: RunState = startingRun;
    const rng = createMulberry32(hashStringToSeed(`occupancy:${seed}:${floor}:${missRate}:${rulesVersion}`));
    const spends = new Map<string, number>();
    /** Take the next run state, and record every watched charge that fell on the way to it. */
    const step = (next: RunState): RunState => {
        for (const counter of SPEND_COUNTERS) {
            const fell = readCounter(counter, run) - readCounter(counter, next);
            if (fell > 0) {
                spends.set(counter.id, (spends.get(counter.id) ?? 0) + fell);
            }
        }
        run = next;
        return run;
    };
    let turns = 0;
    let undone = false;
    let gambited = false;
    let shuffled = false;
    if (tooled) {
        step(spendTools(run, 'opening'));
    }
    if (setup) {
        step(spendSetupTools(run, 'opening'));
    }
    let wildSpent = false;
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
        /*
         * The wild joker is a singleton, so it is never in a playable pair group and the ordinary
         * loop never reaches for it - which is exactly why `wildMatch` read zero on all 240 floors
         * the first time this pass ran. It is a button, like the peek: the census presses it.
         */
        if (setup && !wildSpent && runNonNegativeInteger(run.wildMatchesRemaining) > 0) {
            const wild = run.board!.tiles.find((tile) => tile.state === 'hidden' && isWildPairKey(tile.pairKey));
            const partner = hidden.find((tile) => !isSingletonUtilityPairKey(tile.pairKey));
            if (wild && partner) {
                wildSpent = true;
                step(resolveBoardTurn(flipTile(flipTile(run, wild.id), partner.id)));
                turns += 1;
                continue;
            }
        }
        const flipped = flipTile(flipTile(run, first.id), second.id);
        /*
         * The undo is the one tool that has to be spent mid-turn: it takes back a pair the player
         * has flipped but not yet resolved. Spent on the first miss, which is when a player would.
         */
        if (setup && wantsMiss && !gambited) {
            /*
             * The gambit is the one power that only exists mid-turn: two tiles are down and wrong,
             * and it buys a third look before they turn back. Spent on the first miss, which is the
             * only moment a player could.
             */
            const third = run.board!.tiles.find(
                (tile) => tile.state === 'hidden' && tile.id !== first.id && tile.id !== second.id
            );
            const gambit = third ? flipTile(flipped, third.id) : flipped;
            if (gambit !== flipped) {
                gambited = true;
                step(resolveBoardTurn(gambit));
                turns += 1;
                continue;
            }
        }
        if (tooled && wantsMiss && !undone) {
            const cancelled = cancelResolvingWithUndo(flipped);
            if (cancelled !== flipped) {
                undone = true;
                step(cancelled);
                turns += 1;
                continue;
            }
        }
        step(resolveBoardTurn(flipped));
        turns += 1;
        if (setup && wantsMiss && run.status === 'playing') {
            // The pin and the flash have a reason only once a miss has happened: two cards were
            // just seen and not paired. Pressed here rather than at floor open, which is what made
            // both read 1.000 by construction before Gen 201.
            step(spendSetupTools(run, 'afterMiss'));
        }
        if (tooled && run.status === 'playing' && !shuffled && run.board!.matchedPairs > 0) {
            shuffled = true;
            step(spendTools(run, 'underway'));
        }
    }
    /*
     * The floor used to need a closing move: find the exit tile, reveal it, activate it. There is
     * no exit tile, so the floor is over when the board is - which is the whole point of the
     * change, and the reason this census now ends where the pairs do.
     */
    return { run, spends };
};

const playFloor = (
    seed: number,
    floor: number,
    missRate: number,
    maxTurns: number,
    pass: SystemOccupancyCounter['player'] = 'reference'
): OccupancyFloorResult => {
    const setup = pass === 'setup';
    const board = scheduledFloorBoard(seed, floor, setup);
    /*
     * Gen 208: the floor's mutators go on the RUN as well as on the board.
     *
     * They were only ever passed to `buildBoard`, and eight rules read them off the run instead -
     * the magpie, sticky fingers, the n-back anchor, the shifting spotlight and the four the
     * memorize window reads. None of them could fire in this census, so the magpie read SILENT
     * across 240 floors while the run census, whose floors after the first get their mutators from
     * the game's own `advanceToNextLevel`, saw it steal. A census that cannot see a mutator cannot
     * answer the question it exists to answer.
     */
    const activeMutators = filterMutatorsByContentLock(
        pickFloorScheduleEntry(seed, GAME_RULES_VERSION, floor, 'endless').mutators
    );
    /*
     * The setup pass builds the run the way the setup sheet builds one - the wild joker on the
     * board, a stray charge, a flash charge - so the powers a plain endless run never hands out are
     * there to be spent. Everything else about the floor is identical, so the two passes differ by
     * the setup and nothing else.
     */
    const base = finishMemorizePhase(
        setup
            ? createWildRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })
            : createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })
    );
    return playFloorFrom(
        {
            ...base,
            activeMutators,
            board,
            status: 'playing',
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        },
        seed,
        floor,
        missRate,
        maxTurns,
        pass
    );
};

/**
 * The census, played as a run rather than as a heap of floors.
 *
 * Every simulation in this repository builds a fresh run for every floor - this one did too, and
 * `sim:cascade` and `sim:endless` still do. That is the right instrument for asking what a *board*
 * does, and the wrong one for asking what a *run* does, because the run is where the game keeps
 * everything that does not reset: the charges a player spends and does not get back, the score, the
 * turn ceiling that ends the whole thing. Measured floor by floor, a system that a player meets
 * once and never again reads exactly like a system they meet on every floor.
 *
 * So this plays one continuous run per seed, floor 1 upward, through the game's own transition
 * (`advanceToNextLevel`), and stops when the run does. It reports the same counters as the floor
 * census, plus the two numbers only a run can answer:
 *
 *   - `runFloorShare`: floors *inside a run* where the counter moved.
 *   - `lastFloorSeen`: the deepest floor at which it ever moved. A system whose last sighting is
 *     floor 1 while runs reach floor 20 is a system a player meets once and never again, and no
 *     per-floor share can see that.
 *
 * Task 191 (Gen 150) asked for this and it stayed open for fifty-odd generations, which is about
 * how long the peek has read `core` on the strength of 240 first floors.
 */
export interface RunOccupancyReport {
    /** Runs played, and the floors they reached between them. */
    runs: number;
    floors: number;
    deepestFloor: number;
    meanFloorsPerRun: number;
    endReasons: Record<string, number>;
    rows: Array<{
        key: string;
        label: string;
        family: SystemOccupancyCounter['family'];
        cadence: SystemOccupancyCounter['cadence'];
        /** Floors within a run where this counter moved, over floors played. */
        runFloorShare: number;
        perFloor: number;
        /** The deepest floor this was ever seen on; 0 if it never happened. */
        lastFloorSeen: number;
    }>;
}

export const simulateRunOccupancy = ({
    floors = 24,
    seeds = OCCUPANCY_SEEDS,
    missRate = 0.15,
    maxTurns = 240
}: {
    floors?: number;
    seeds?: readonly number[];
    missRate?: number;
    maxTurns?: number;
} = {}): RunOccupancyReport => {
    const hits = new Map<string, { floors: number; total: number; lastFloor: number }>();
    const endReasons: Record<string, number> = {};
    let played = 0;
    let deepestFloor = 0;
    const passes: Array<SystemOccupancyCounter['player']> = ['reference', 'tooled', 'setup'];

    for (const seed of seeds) {
        for (const pass of passes) {
            const counters = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.player === pass);
            if (counters.length === 0) continue;
            const setup = pass === 'setup';
            const firstBoard = scheduledFloorBoard(seed, 1, setup);
            let run: RunState = finishMemorizePhase(
                setup
                    ? createWildRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })
                    : createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })
            );
            run = {
                ...run,
                // Floor 1 needs its mutators put on by hand for the same reason (Gen 208); every
                // floor after it gets them from `advanceToNextLevel`, which is the game's own path.
                activeMutators: filterMutatorsByContentLock(
                    pickFloorScheduleEntry(seed, GAME_RULES_VERSION, 1, 'endless').mutators
                ),
                board: firstBoard,
                status: 'playing',
                findablesTotalThisFloor: countFindablePairs(firstBoard.tiles)
            };
            let floor = 1;
            let ended = 'reached the cap';
            while (floor <= floors) {
                /*
                 * What each counter read when the floor opened. A tally that resets on the floor
                 * transition reads zero here and the delta is the floor's own count; a tally the run
                 * keeps - the pins placed this run, the trait matches in the session stats - does
                 * not reset, and reading its end-of-floor value would report a running total as a
                 * rate and call every floor after the first one busy. Deltas make both honest.
                 */
                const before = new Map(counters.map((counter) => [counter.id, readCounter(counter, run)]));
                const result = playFloorFrom(run, seed, floor, missRate, maxTurns, pass);
                // Only the reference pass counts a floor, so a floor is counted once however many
                // passes walk it - the same arithmetic the floor census uses.
                if (pass === 'reference') played += 1;
                deepestFloor = Math.max(deepestFloor, floor);
                for (const counter of counters) {
                    const value =
                        counter.kind === 'spend'
                            ? result.spends.get(counter.id) ?? 0
                            : Math.max(0, readCounter(counter, result.run) - (before.get(counter.id) ?? 0));
                    const row = hits.get(counter.id) ?? { floors: 0, total: 0, lastFloor: 0 };
                    if (value > 0) {
                        row.floors += 1;
                        row.lastFloor = Math.max(row.lastFloor, floor);
                    }
                    row.total += value;
                    hits.set(counter.id, row);
                }
                run = result.run;
                if (run.status === 'gameOver') {
                    ended = run.runEndReason ?? 'gameOver';
                    break;
                }
                // The game's own transition, so the run census cannot drift from the run a player
                // is handed: the charges it does not refill are the charges the player does not get.
                const next = advanceToNextLevel({ ...run, status: 'levelComplete' });
                if (!next.board || next.board.level === floor) {
                    ended = 'the floor did not advance';
                    break;
                }
                run = finishMemorizePhase(next);
                floor += 1;
            }
            if (pass === 'reference') endReasons[ended] = (endReasons[ended] ?? 0) + 1;
        }
    }

    const runs = seeds.length;
    return {
        runs,
        floors: played,
        deepestFloor,
        meanFloorsPerRun: runs === 0 ? 0 : played / runs,
        endReasons,
        rows: SYSTEM_OCCUPANCY_COUNTERS.map((counter) => {
            const row = hits.get(counter.id) ?? { floors: 0, total: 0, lastFloor: 0 };
            return {
                key: counter.id,
                label: counter.label,
                family: counter.family,
                cadence: counter.cadence,
                runFloorShare: played === 0 ? 0 : row.floors / played,
                perFloor: played === 0 ? 0 : row.total / played,
                lastFloorSeen: row.lastFloor
            };
        })
    };
};

export const summarizeRunOccupancy = (report: RunOccupancyReport): string =>
    [...report.rows]
        .sort((a, b) => a.runFloorShare - b.runFloorShare)
        .map(
            (row) =>
                `${row.runFloorShare.toFixed(3).padStart(6)} x ${row.perFloor.toFixed(2).padStart(5)}  last floor ` +
                `${String(row.lastFloorSeen).padStart(3)}  ${row.cadence.padEnd(6)} ${row.family.padEnd(8)} ${row.key}`
        )
        .join('\n');

export const OCCUPANCY_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234] as const;

export const simulateSystemOccupancy = ({
    floors = 24,
    seeds = OCCUPANCY_SEEDS,
    missRate = 0.15,
    maxTurns = 240
}: {
    floors?: number;
    seeds?: readonly number[];
    missRate?: number;
    maxTurns?: number;
} = {}): SystemOccupancyReport => {
    const hits = new Map<string, { floors: number; total: number }>();
    let played = 0;
    const passes: Array<SystemOccupancyCounter['player']> = ['reference', 'tooled', 'setup'];
    for (const seed of seeds) {
        for (let floor = 1; floor <= floors; floor += 1) {
            played += 1;
            for (const pass of passes) {
                const counters = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.player === pass);
                if (counters.length === 0) continue;
                const { run, spends } = playFloor(seed, floor, missRate, maxTurns, pass);
                for (const counter of counters) {
                    const value = counter.kind === 'spend' ? spends.get(counter.id) ?? 0 : readCounter(counter, run);
                    const row = hits.get(counter.id) ?? { floors: 0, total: 0 };
                    if (value > 0) row.floors += 1;
                    row.total += value;
                    hits.set(counter.id, row);
                }
            }
        }
    }
    return {
        floors: played,
        rows: SYSTEM_OCCUPANCY_COUNTERS.map((counter) => {
            const row = hits.get(counter.id) ?? { floors: 0, total: 0 };
            return {
                key: counter.id,
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
 * this asks the one a gate can ask meanwhile: has the set CHANGED. A system that goes quiet fails
 * it the moment it does, and a system brought back to life fails it too, which is the only way a
 * list like this ever shrinks rather than drifts.
 *
 * All three lists are empty as of Gen 172, and how the silent list emptied is the whole point of
 * recording these. It did not empty because eleven quiet systems woke up. It emptied because they
 * were deleted: every one of them counted something the dungeon layer put on the board - a seal,
 * an altar, a roaming hazard, a mirror decoy, a shuffle snare, a lantern ward, a magpie, a mimic
 * cache, a pin lattice, a safe-hazard ward - and there is no dungeon layer.
 * `docs/REMOVED_DUNGEON_LAYER.md` is the record of what each one did.
 *
 * That distinction is worth keeping in front of whoever reads this next, because the two readings
 * look identical from here and mean opposite things. The list was a debt register: eleven systems
 * shipped, none of them observable. Gen 171-172 settled that debt by deciding the systems were the
 * problem rather than their tuning. Anything that lands on this list from here is the old kind of
 * debt again - a live system nobody can see - and wants a task, not a baseline entry.
 *
 * The one entry that ever left this list on its own merits did so in Gen 168, and from the
 * direction Gen 151 predicted: the drop had nothing to take because the ripple had already swept
 * the suit, and "the remnant this rule wants is a bigger suit than generation deals today; that is
 * a task, not a threshold." A bounded wave below Sharp and one suit per six pairs leave a remnant
 * standing, and the drop takes it. That is what a silence ending looks like.
 */
export const SYSTEM_OCCUPANCY_BASELINE = {
    /*
     * Empty since Gen 172, when the eleven dungeon counters left the census with the systems they
     * counted. Read the comment above before adding to this list: an entry here now means a live
     * system nobody can observe, which is a bug with a task against it, not a fact to record.
     */
    silent: [] as readonly string[],
    /*
     * Empty since Gen 170. `feverBreaksThisFloor` was the one entry, and it left the list when the
     * Fever rung moved from two thirds of a floor to half of one: the tier used to arrive on the
     * last match or two, with nothing left for a Fever break to take.
     */
    thin: [] as readonly string[],
    /*
     * Empty, and that is a result rather than a placeholder: with the two mislabelled cadences
     * corrected there is nothing running above its own ceiling. It is a ratchet like the other two
     * - a system that grows into the floor fails this the moment it does, and the fix is either the
     * generation or the label, decided deliberately and written down here.
     */
    dominant: [] as readonly string[]
} as const;

/**
 * The floor count the baseline above was measured at. A different count measures a different game:
 * three hazard caches that sit at 4-7% over sixteen floors read as under 2% over twelve.
 *
 * Sixteen since Gen 170, which is `simulateSystemOccupancy`'s own default, so the ratchet and the
 * aspirational check now read the same census rather than two different ones. Twelve was chosen in
 * Gen 167 to match an earlier measurement and had the effect of holding the ratchet to the first
 * act, where floors are small: Fever cleared its bar at sixteen floors (0.119) while still reading
 * thin at twelve (0.050), which is the sample talking rather than the game.
 *
 * Twenty-four since Gen 180, matching `sim:cascade`'s horizon, for the same reason again one
 * curve later: the tempered pair curve (Gen 179) makes floors seven to sixteen smaller than the
 * linear one did, and the severance drop clears their tails, so sixteen floors is the shallow
 * half once more - Fever read 0.094 at sixteen and 0.233 at twenty-four, on the same code.
 */
export const SYSTEM_OCCUPANCY_BASELINE_FLOORS = 24;

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
    const banded = floorBandedRows(report);
    const silent = banded.filter((row) => row.floorShare === 0).map((row) => row.key);
    const thin = banded
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

/**
 * The rows the FLOOR census is entitled to band.
 *
 * A run-scoped charge is left to `judgeRunOccupancy`, which is the only census that can see it
 * handed out once and never refilled; graded here it would be graded against a fresh run every
 * floor, which is how the wild joker came to be filed as the loop (Gen 207). It is still reported
 * in the table - the number is real, it is just a number about first floors.
 */
export const floorBandedRows = (report: SystemOccupancyReport): SystemOccupancyReport['rows'] => {
    const runScoped = new Set(
        SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((counter) => counter.id)
    );
    return report.rows.filter((row) => !runScoped.has(row.key));
};

export const judgeSystemOccupancy = (
    report: SystemOccupancyReport
): { ok: boolean; issues: string[]; silent: string[]; dominant: string[] } => {
    const issues: string[] = [];
    const silent: string[] = [];
    const dominant: string[] = [];
    for (const row of floorBandedRows(report)) {
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

/**
 * The run census's verdict, which covers the charges the floor census cannot see honestly.
 *
 * Same three failure modes as the floor judge - silent, thin, dominant - read off a run rather than
 * off a heap of first floors. A system whose last sighting is floor 1 while runs reach floor 24 is
 * called out by name even when its share clears its band, because "happens once a run" and "happens
 * rarely" are different games and only one of them is a cadence.
 */
export const judgeRunOccupancy = (
    report: RunOccupancyReport
): { ok: boolean; issues: string[]; silent: string[]; dominant: string[]; onceOnly: string[] } => {
    const issues: string[] = [];
    const silent: string[] = [];
    const dominant: string[] = [];
    const onceOnly: string[] = [];
    const banded = new Set(
        SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((counter) => counter.id)
    );
    for (const row of report.rows) {
        if (row.lastFloorSeen === 1 && report.deepestFloor > 1 && row.runFloorShare > 0) {
            onceOnly.push(
                `${row.key} (${row.label}) was last seen on floor 1, and runs reach floor ${report.deepestFloor}`
            );
        }
        if (!banded.has(row.key)) continue;
        if (row.runFloorShare === 0) {
            silent.push(`${row.key} (${row.label}) never fired across ${report.floors} floors of real runs`);
            continue;
        }
        const band = SYSTEM_OCCUPANCY_BANDS[row.cadence];
        if (row.runFloorShare < band.min) {
            issues.push(
                `${row.key} runFloorShare ${row.runFloorShare.toFixed(3)} below ${band.min} for a ${row.cadence} system`
            );
        }
        if (row.runFloorShare > band.max) {
            dominant.push(
                `${row.key} (${row.label}) fired on ${row.runFloorShare.toFixed(3)} of a run's floors, above ${band.max} for a ${row.cadence} system`
            );
        }
    }
    return {
        ok: issues.length === 0 && silent.length === 0 && dominant.length === 0,
        issues,
        silent,
        dominant,
        onceOnly
    };
};

export const dominantSystemKeys = (report: SystemOccupancyReport): string[] =>
    floorBandedRows(report)
        .filter((row) => row.floorShare > SYSTEM_OCCUPANCY_BANDS[row.cadence].max)
        .map((row) => row.key);

export const summarizeSystemOccupancy = (report: SystemOccupancyReport): string => {
    // A run-scoped row is printed but not judged here, and it is marked so nobody reads its zero as
    // a fault: the magpie reads SILENT on this census because it arrives on the third mismatch of a
    // RUN, and this census starts a new run every floor. `yarn sim:run` is where it answers.
    const runScoped = new Set(
        SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((counter) => counter.id)
    );
    return [...report.rows]
        .sort((a, b) => a.floorShare - b.floorShare)
        .map(
            (row) =>
                `${row.floorShare === 0 ? 'SILENT' : row.floorShare.toFixed(3).padStart(6)} ` +
                `x${row.perFloor.toFixed(2).padStart(6)} ${row.cadence.padEnd(6)} ${row.family.padEnd(8)} ` +
                `${row.key}${runScoped.has(row.key) ? ' (banded by sim:run)' : ''}`
        )
        .join('\n');
};
