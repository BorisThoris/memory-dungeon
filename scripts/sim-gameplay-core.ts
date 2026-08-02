import type { BoardState, RunState, Tile } from '../src/shared/contracts';
import { runGameplayCoreSimulation } from '../src/shared/gameplay-core-simulation';

const numericArg = (name: string, fallback: number): number => {
    const prefix = `--${name}=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const seed = numericArg('seed', 42001);
const steps = numericArg('steps', 256);
const board: BoardState = {
    level: 1,
    pairCount: 3,
    columns: 3,
    rows: 3,
    tiles: [
        tile('echo-a', 'echo', 'echo'),
        tile('echo-b', 'echo', 'echo'),
        tile('conduit-a', 'conduit', 'conduit'),
        tile('conduit-b', 'conduit', 'conduit'),
        tile('plain-a', 'plain'),
        tile('plain-b', 'plain'),
        tile('wild', '__wild__')
    ],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
};
const initialRun = {
    status: 'playing',
    board,
    runSeed: seed,
    runRulesVersion: 1,
    peekCharges: 0,
    strayRemoveCharges: 1,
    strayRemoveArmed: true,
    recallFocus: 3,
    rewardPerkIds: [],
    relicIds: [
        'combo_shard_plus_step',
        'guard_token_plus_one',
        'chapter_compass',
        'wager_surety',
        'parasite_ledger'
    ],
    powersUsedThisRun: false,
    forgottenTileIdsThisFloor: [],
    peekRevealedTileIds: [],
    stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 }
} as unknown as RunState;
const report = runGameplayCoreSimulation(initialRun, { seed, steps });

console.log(JSON.stringify({
    seed: report.seed,
    requestedSteps: report.requestedSteps,
    accepted: report.acceptedCommandIds.length,
    rejected: report.rejectedCommandIds.length,
    commandTypeCounts: report.commandTypeCounts,
    eventTypeCounts: report.eventTypeCounts,
    finalPeekCharges: report.finalRun.peekCharges ?? 0,
    replayDeterministic: report.replayDeterministic,
    invariantViolations: report.invariantViolations
}, null, 2));

if (!report.replayDeterministic || report.invariantViolations.length > 0) {
    process.exitCode = 1;
}
