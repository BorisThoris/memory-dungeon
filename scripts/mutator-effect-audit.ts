/**
 * Does every mutator change the game? Run: yarn audit:mutator-effects
 *
 * A mutator is a promise on the floor card - "cooler faces", "a shorter look", "the bird is out" -
 * and the census cannot check those promises: seven of the ten move no counter it watches. What the
 * occupancy censuses catch is a system that never *happens*; what nothing caught until Gen 209 is a
 * mutator that happens and does nothing, which is the same failure one layer up. The magpie shipped
 * for a hundred generations with no counter (Gen 208) and the pop shipped dead for six floors
 * (Gen 148); both were found by measuring rather than by reading.
 *
 * So this plays the same floor twice - once carrying the mutator, once without it, same seed, same
 * player - and asks whether ANY observable channel moved: the score, the memorize window, the
 * board's symbols, its findables, its spotlight keys, the sticky block, the n-back anchor, the
 * magpie's thefts. A mutator that moves none of them on any seed is decoration with a name.
 *
 * The channels are deliberately what a player could notice rather than what the rule writes, so a
 * mutator cannot pass by moving a field nobody reads.
 */
import {
    GAME_RULES_VERSION,
    MUTATOR_IDS,
    type MutatorId,
    type RunState
} from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { getMemorizeDurationForRun } from '../src/shared/scoring-rules';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';

/** Everything about a played floor a player could notice. */
export interface MutatorFloorReading {
    score: number;
    memorizeMs: number;
    letters: boolean;
    findables: number;
    spotlight: boolean;
    sticky: boolean;
    nBack: boolean;
    thefts: number;
}

export const MUTATOR_AUDIT_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888] as const;

/**
 * What a run has already accumulated by the time it reaches this mutator's floor.
 *
 * A floor inside a run is not a first floor, and where a mutator's trigger reads the run rather than
 * the board, a probe that starts from zero cannot fire it: the magpie arrives on every third
 * mismatch OF THE RUN (`MAGPIE_MISS_INTERVAL`), so on a fresh run it needs three misses inside one
 * floor and reads as doing nothing at all. That is the same blindness that had the floor census
 * calling it SILENT for a hundred generations (Gen 208), reproduced in a new instrument - so the
 * probe starts the run where a run would be, and nowhere further.
 */
const RUN_STATE_PRIMING: Partial<Record<MutatorId, (run: RunState) => RunState>> = {
    magpie_thief: (run) => ({ ...run, stats: { ...run.stats, mismatches: 2 } })
};

export const playMutatorFloor = (seed: number, floor: number, mutators: MutatorId[]): MutatorFloorReading => {
    const entry = pickFloorScheduleEntry(seed, GAME_RULES_VERSION, floor, 'endless');
    const board = buildBoard(floor, {
        runSeed: seed,
        runRulesVersion: GAME_RULES_VERSION,
        gameMode: 'endless',
        activeMutators: mutators,
        floorTag: entry.floorTag,
        floorArchetypeId: entry.floorArchetypeId,
        featuredObjectiveId: entry.featuredObjectiveId,
        cycleFloor: entry.cycleFloor
    });
    let run: RunState = {
        ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })),
        activeMutators: mutators,
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
    // Primed for every mutator under test, so the two runs of the floor differ by the mutator only.
    for (const id of MUTATOR_IDS) {
        const prime = RUN_STATE_PRIMING[id];
        if (prime) run = prime(run);
    }
    const reading: MutatorFloorReading = {
        score: 0,
        memorizeMs: getMemorizeDurationForRun(run, floor),
        letters: board.tiles.some((tile) => /^[A-Z]$/.test(tile.symbol)),
        findables: countFindablePairs(board.tiles),
        spotlight: board.wardPairKey != null || board.bountyPairKey != null,
        sticky: false,
        nBack: false,
        thefts: 0
    };
    // The same player on both runs of the floor, so a difference is the mutator and not the policy.
    const rng = createMulberry32(hashStringToSeed(`mutator-audit:${seed}:${floor}`));
    for (let turn = 0; turn < 60 && run.status === 'playing'; turn += 1) {
        const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
            group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
        );
        if (groups.length === 0) break;
        const hidden = run.board!.tiles.filter(
            (tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)
        );
        const wantsMiss = rng() < 0.25 && hidden.length >= 3;
        let first;
        let second;
        if (wantsMiss) {
            first = hidden[pickRngIndex(rng, hidden.length)]!;
            const others = hidden.filter((tile) => tile.pairKey !== first!.pairKey);
            if (others.length === 0) break;
            second = others[pickRngIndex(rng, others.length)]!;
        } else {
            const group = groups[pickRngIndex(rng, groups.length)]!;
            [first, second] = [group[0]!, group[1]!];
        }
        run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
        if (run.stickyBlockIndex != null) reading.sticky = true;
        if (run.nBackAnchorPairKey != null) reading.nBack = true;
        if (run.board?.wardPairKey != null || run.board?.bountyPairKey != null) reading.spotlight = true;
        reading.thefts = Math.max(reading.thefts, run.magpieTheftsThisFloor ?? 0);
    }
    reading.score = run.stats?.currentLevelScore ?? 0;
    return reading;
};

/** The first floor of the schedule that deals this mutator, for a seed that gets it. */
export const findMutatorFloor = (id: MutatorId): { seed: number; floor: number } | null => {
    for (const seed of MUTATOR_AUDIT_SEEDS) {
        for (let floor = 1; floor <= 24; floor += 1) {
            const dealt = filterMutatorsByContentLock(
                pickFloorScheduleEntry(seed, GAME_RULES_VERSION, floor, 'endless').mutators
            );
            if (dealt.includes(id)) return { seed, floor };
        }
    }
    return null;
};

export interface MutatorEffectFinding {
    id: MutatorId;
    detail: string;
}

const CHANNELS: Array<{ name: string; differs: (a: MutatorFloorReading, b: MutatorFloorReading) => boolean }> = [
    { name: 'score', differs: (a, b) => a.score !== b.score },
    { name: 'the memorize window', differs: (a, b) => a.memorizeMs !== b.memorizeMs },
    { name: 'the symbols', differs: (a, b) => a.letters !== b.letters },
    { name: 'the findables', differs: (a, b) => a.findables !== b.findables },
    { name: 'the spotlight', differs: (a, b) => a.spotlight !== b.spotlight },
    { name: 'the sticky block', differs: (a, b) => a.sticky !== b.sticky },
    { name: 'the n-back anchor', differs: (a, b) => a.nBack !== b.nBack },
    { name: 'the magpie', differs: (a, b) => a.thefts !== b.thefts }
];

export const auditMutatorEffects = (): { findings: MutatorEffectFinding[]; observed: Record<string, string> } => {
    const findings: MutatorEffectFinding[] = [];
    const observed: Record<string, string> = {};
    for (const id of MUTATOR_IDS) {
        const target = findMutatorFloor(id);
        if (!target) {
            findings.push({ id, detail: `${id} is never dealt by the floor schedule in 24 floors of any audit seed` });
            continue;
        }
        const moved = new Set<string>();
        for (const seed of MUTATOR_AUDIT_SEEDS) {
            const on = playMutatorFloor(seed, target.floor, [id]);
            const off = playMutatorFloor(seed, target.floor, []);
            for (const channel of CHANNELS) {
                if (channel.differs(on, off)) moved.add(channel.name);
            }
        }
        if (moved.size === 0) {
            findings.push({
                id,
                detail: `${id} is dealt on floor ${target.floor} and changes nothing a player could notice`
            });
            continue;
        }
        observed[id] = [...moved].join(', ');
    }
    return { findings, observed };
};

const main = (): void => {
    const { findings, observed } = auditMutatorEffects();
    for (const id of MUTATOR_IDS) {
        const line = observed[id];
        process.stdout.write(`  ${id.padEnd(22)} ${line ?? 'NOTHING OBSERVED'}\n`);
    }
    process.stdout.write(`\n${MUTATOR_IDS.length} mutators, ${findings.length} changing nothing a player could notice\n`);
    if (findings.length > 0) {
        process.stdout.write(`\n${findings.map((finding) => `- ${finding.detail}`).join('\n')}\n`);
        process.exitCode = 1;
    }
};

if (process.argv[1]?.includes('mutator-effect-audit')) {
    main();
}
