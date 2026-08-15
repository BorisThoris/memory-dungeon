import { fileURLToPath } from 'node:url';
import {
    assertGameplayBuildStrategiesViable,
    runGameplayBuildStrategySimulation
} from '../src/shared/build-strategy-simulation';
import { readSeedListCliArg } from './seed-sweep-options';

const DEFAULT_SEEDS = [42_001, 42_077, 42_123] as const;

export const runBuildStrategySimulationCli = (argv: readonly string[]): number => {
    const report = runGameplayBuildStrategySimulation({ seeds: readSeedListCliArg(argv, DEFAULT_SEEDS) });
    const health = assertGameplayBuildStrategiesViable(report);
    const summary = {
        rulesVersion: report.rulesVersion,
        seeds: report.seeds,
        offlineOnly: report.offlineOnly,
        ok: health.ok,
        issues: health.issues,
        strategies: report.strategies.map((strategy) => ({
            id: strategy.id,
            buildMechanicId: strategy.buildMechanicId,
            startingLoadoutId: strategy.startingLoadoutId,
            activationDefinitionIds: strategy.activationDefinitionIds,
            consequenceCommandType: strategy.consequenceCommandType,
            consequenceEventType: strategy.consequenceEventType,
            expectedDominantAxis: strategy.expectedDominantAxis,
            dominantAxis: strategy.dominantAxis,
            axisScores: strategy.axisScores,
            acceptedCommands: strategy.acceptedCommands,
            rejectedCommands: strategy.rejectedCommands,
            feedbackEvents: strategy.feedbackEvents,
            viableSeedShare: strategy.viableSeedShare
        })),
        pairwiseAxisDistances: report.pairwiseAxisDistances,
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
    process.exitCode = runBuildStrategySimulationCli(process.argv.slice(2));
}
