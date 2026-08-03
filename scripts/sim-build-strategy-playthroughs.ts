import { fileURLToPath } from 'node:url';
import {
    assertGameplayBuildMultiFloorViable,
    runGameplayBuildMultiFloorSimulation
} from '../src/shared/build-strategy-playthrough-simulation';
import {
    readPositiveFlooredNumericCliArg,
    readSeedListCliArg
} from './seed-sweep-options';

const DEFAULT_SEEDS = [42_001, 42_077, 42_123] as const;

export const runBuildStrategyPlaythroughSimulationCli = (argv: readonly string[]): number => {
    const report = runGameplayBuildMultiFloorSimulation({
        seeds: readSeedListCliArg(argv, DEFAULT_SEEDS),
        floors: readPositiveFlooredNumericCliArg(argv, 'floors', 4)
    });
    const health = assertGameplayBuildMultiFloorViable(report);
    const summary = {
        rulesVersion: report.rulesVersion,
        seeds: report.seeds,
        floorsPerSeed: report.floorsPerSeed,
        offlineOnly: report.offlineOnly,
        ok: health.ok,
        issues: health.issues,
        strategies: report.strategies.map((strategy) => ({
            id: strategy.id,
            buildMechanicId: strategy.buildMechanicId,
            consequenceCommandType: strategy.consequenceCommandType,
            consequenceEventType: strategy.consequenceEventType,
            expectedDominantAxis: strategy.expectedDominantAxis,
            dominantAxis: strategy.dominantAxis,
            signatureAxisScores: strategy.signatureAxisScores,
            floorsAttempted: strategy.floorsAttempted,
            floorsCompleted: strategy.floorsCompleted,
            floorCompletionShare: strategy.floorCompletionShare,
            deterministicReplaySeeds: strategy.deterministicReplaySeeds,
            signatureConsequenceUses: strategy.signatureConsequenceUses,
            observedBoardTraitKinds: strategy.observedBoardTraitKinds,
            observedTraitInteractionTags: strategy.observedTraitInteractionTags,
            recurringSynergyTags: strategy.recurringSynergyTags,
            turnsPerFloor: strategy.turnsPerFloor,
            commandsPerFloor: strategy.commandsPerFloor,
            livesRemaining: strategy.livesRemaining,
            scoreGained: strategy.scoreGained,
            matchupMetrics: strategy.matchupMetrics
        })),
        pairwiseMeanTurnRatios: report.pairwiseMeanTurnRatios,
        bounds: report.bounds,
        notes: report.notes
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!health.ok) {
        process.stderr.write(`${health.issues.join('\n')}\n`);
        return 1;
    }
    return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exitCode = runBuildStrategyPlaythroughSimulationCli(process.argv.slice(2));
}
