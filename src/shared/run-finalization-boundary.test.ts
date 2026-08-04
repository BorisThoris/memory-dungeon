import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string =>
    readFileSync(join(process.cwd(), relativePath), 'utf8');

const readProductionRendererSources = (relativeDirectory = 'src/renderer'): Array<[string, string]> =>
    readdirSync(join(process.cwd(), relativeDirectory), { withFileTypes: true }).flatMap((entry) => {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        if (entry.isDirectory()) {
            return readProductionRendererSources(relativePath);
        }
        if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) {
            return [];
        }
        return [[relativePath, readSource(relativePath)]];
    });

describe('run finalization ownership boundary', () => {
    it('keeps terminal summary mutation behind the schema-validated gameplay core', () => {
        const contracts = readSource('src/shared/gameplay-core-contracts.ts');
        const core = readSource('src/shared/gameplay-core.ts');
        const adapters = readSource('src/shared/gameplay-core-adapters.ts');
        const controller = readSource('src/renderer/store/runResolutionController.ts');
        const app = readSource('src/renderer/App.tsx');
        const fixtures = readSource('src/shared/playable-path-fixtures.ts');

        expect(contracts).toContain("type: z.literal('run.finalize')");
        expect(contracts).toContain("type: z.literal('run.finalized')");
        expect(contracts).toContain('createGameplayRunFinalizeCommand');
        expect(core).toContain("command.type === 'run.finalize'");
        expect(core).toContain('createValidatedGameOverRunSummary(run, command.unlockedAchievements)');
        expect(core).toContain("type: 'run.finalized'");
        expect(adapters).toContain('finalizeRunThroughGameplayCore');
        expect(adapters).toContain('appendGameplayJournal(result.run, [command], result.events)');
        expect(adapters).toContain('createValidatedGameOverRunSummary(result.run, [...unlockedAchievements])');

        expect(controller).toContain('finalizeRunThroughGameplayCore(');
        expect(app).toContain('createFinalizedGameOverPlayablePathRun(current)');
        expect(fixtures).toContain('finalizeRunThroughGameplayCore(');
        expect(fixtures).not.toContain('createRunSummary(');

        for (const [relativePath, source] of readProductionRendererSources()) {
            expect(source, relativePath).not.toContain('run-summary-rules');
            expect(source, relativePath).not.toMatch(/create(?:Validated)?GameOverRunSummary\s*\(/);
            expect(source, relativePath).not.toMatch(/createRunSummary\s*\(/);
        }
    });

    it('keeps finalization replay, persisted journals, and the game-over display in the enforced path', () => {
        const simulation = readSource('src/shared/gameplay-core-simulation.ts');
        const cli = readSource('scripts/sim-gameplay-core.ts');
        const controller = readSource('src/renderer/store/runResolutionController.ts');
        const gameOverScreen = readSource('src/renderer/components/GameOverScreen.tsx');

        expect(simulation).toContain('runGameplayRunFinalizationSimulation');
        expect(simulation).toContain("event.type === 'run.finalized'");
        expect(simulation).toContain('normalizeRunSummary(summary)');
        expect(cli).toContain('runFinalizationReport.invariantViolations.length > 0');
        expect(controller).toContain('lastRunSummary: nextRun.lastRunSummary');
        expect(gameOverScreen).toContain('const summary = run.lastRunSummary');
    });
});
