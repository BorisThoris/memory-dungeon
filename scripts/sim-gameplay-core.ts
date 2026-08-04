import type { BoardState, RunState, Tile } from '../src/shared/contracts';
import {
    runGameplayCoreSimulation,
    runGameplayInterludeTerminalSimulation,
    runGameplayRunFinalizationSimulation,
    runGameplayProgressionRepairSimulation
} from '../src/shared/gameplay-core-simulation';
import { createTimerState } from '../src/shared/run-timer-rules';
import { createRunShopOffers } from '../src/shared/shop-rules';
import { EXIT_PAIR_KEY, WILD_PAIR_KEY } from '../src/shared/tile-identity';

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
    level: 3,
    pairCount: 3,
    columns: 3,
    rows: 3,
    tiles: [
        tile('echo-a', 'echo', 'echo'),
        tile('echo-b', 'echo', 'echo'),
        tile('conduit-a', 'conduit', 'conduit'),
        tile('conduit-b', 'conduit', 'conduit'),
        tile('plain-a', 'plain'),
        tile('wild', WILD_PAIR_KEY)
    ],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
};
const initialRunBase = {
    status: 'memorize',
    lives: 3,
    board,
    runSeed: seed,
    runRulesVersion: 1,
    gameMode: 'endless',
    practiceMode: true,
    wildMenuRun: true,
    wildMatchesRemaining: 1,
    flipHistory: [],
    timerState: createTimerState({ memorizeRemainingMs: 900 }),
    resolveDelayMultiplier: 1,
    echoFeedbackEnabled: false,
    dungeonTrapsTriggered: 0,
    pendingMemorizeBonusMs: 0,
    peekCharges: 0,
    flashPairCharges: 1,
    flashPairRevealedTileIds: [],
    undoUsesThisFloor: 1,
    strayRemoveCharges: 1,
    recallFocus: 0,
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
    pinnedTileIds: [],
    peekRevealedTileIds: [],
    shopGold: 10,
    shopRerolls: 0,
    shopOffers: [],
    stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 }
} as unknown as RunState;
const initialRun: RunState = {
    ...initialRunBase,
    shopOffers: createRunShopOffers(initialRunBase)
};
const report = runGameplayCoreSimulation(initialRun, { seed, steps });
const repairRun: RunState = {
    ...initialRun,
    board: {
        level: 5,
        pairCount: 1,
        columns: 2,
        rows: 2,
        tiles: [
            { ...tile('repair-pair-a', 'repair-pair'), state: 'matched' },
            { ...tile('repair-pair-b', 'repair-pair'), state: 'matched' },
            {
                ...tile('repair-exit', EXIT_PAIR_KEY),
                state: 'flipped',
                dungeonCardKind: 'exit',
                dungeonExitLockKind: 'iron'
            }
        ],
        flippedTileIds: ['repair-exit'],
        matchedPairs: 1,
        floorArchetypeId: null,
        featuredObjectiveId: null,
        dungeonExitTileId: 'repair-exit',
        dungeonExitLockKind: 'iron',
        dungeonObjectiveId: 'defeat_boss',
        dungeonBossId: 'trap_warden',
        enemyHazards: [
            {
                id: 'repair-stale-warden',
                kind: 'warden',
                label: 'Repair Stale Warden',
                currentTileId: 'repair-pair-a',
                nextTileId: 'repair-pair-b',
                pattern: 'guard',
                state: 'revealed',
                damage: 1,
                hp: 1,
                maxHp: 1,
                bossId: 'trap_warden'
            }
        ]
    },
    dungeonKeys: {},
    dungeonMasterKeys: 0,
    dungeonEnemiesDefeated: 0,
    dungeonEnemiesDefeatedThisFloor: 0,
    enemyHazardsDefeatedThisFloor: 0,
    status: 'levelComplete'
};
const repairReport = runGameplayProgressionRepairSimulation(repairRun);
const interludeTerminalReport = runGameplayInterludeTerminalSimulation({
    ...initialRun,
    lives: 0,
    pendingRouteCardPlan: {
        choiceId: 'terminal-safe',
        routeType: 'safe',
        sourceLevel: initialRun.board?.level ?? 1,
        targetLevel: (initialRun.board?.level ?? 1) + 1
    },
    status: 'levelComplete'
});
const runFinalizationReport = runGameplayRunFinalizationSimulation({
    ...interludeTerminalReport.finalRun,
    achievementsEnabled: true
});

console.log(JSON.stringify({
    seed: report.seed,
    requestedSteps: report.requestedSteps,
    accepted: report.acceptedCommandIds.length,
    rejected: report.rejectedCommandIds.length,
    commandTypeCounts: report.commandTypeCounts,
    acceptedCommandTypeCounts: report.acceptedCommandTypeCounts,
    rejectedCommandTypeCounts: report.rejectedCommandTypeCounts,
    eventTypeCounts: report.eventTypeCounts,
    finalPeekCharges: report.finalRun.peekCharges ?? 0,
    progressionRepair: {
        accepted: repairReport.accepted,
        commandType: repairReport.command.type,
        eventTypes: repairReport.events.map((event) => event.type),
        replayDeterministic: repairReport.replayDeterministic,
        invariantViolations: repairReport.invariantViolations
    },
    interludeTerminal: {
        accepted: interludeTerminalReport.accepted,
        commandType: interludeTerminalReport.command.type,
        eventTypes: interludeTerminalReport.events.map((event) => event.type),
        replayDeterministic: interludeTerminalReport.replayDeterministic,
        invariantViolations: interludeTerminalReport.invariantViolations
    },
    runFinalization: {
        accepted: runFinalizationReport.accepted,
        commandType: runFinalizationReport.command.type,
        eventTypes: runFinalizationReport.events.map((event) => event.type),
        replayDeterministic: runFinalizationReport.replayDeterministic,
        invariantViolations: runFinalizationReport.invariantViolations
    },
    replayDeterministic: report.replayDeterministic,
    invariantViolations: report.invariantViolations
}, null, 2));

if (
    !report.replayDeterministic ||
    report.invariantViolations.length > 0 ||
    !repairReport.accepted ||
    !repairReport.replayDeterministic ||
    repairReport.invariantViolations.length > 0 ||
    !interludeTerminalReport.accepted ||
    !interludeTerminalReport.replayDeterministic ||
    interludeTerminalReport.invariantViolations.length > 0 ||
    !runFinalizationReport.accepted ||
    !runFinalizationReport.replayDeterministic ||
    runFinalizationReport.invariantViolations.length > 0
) {
    process.exitCode = 1;
}
