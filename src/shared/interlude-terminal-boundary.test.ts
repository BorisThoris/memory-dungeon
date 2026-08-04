import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string =>
    readFileSync(join(process.cwd(), relativePath), 'utf8');

const rendererTerminalAdapters = [
    'src/renderer/store/sideRoomSurfaceState.ts',
    'src/renderer/store/levelCompleteShopExecutor.ts',
    'src/renderer/store/levelCompleteContinuationExecutor.ts'
] as const;

describe('interlude terminal ownership boundary', () => {
    it('keeps terminal mutation in the command core and out of production renderer adapters', () => {
        const contracts = readSource('src/shared/gameplay-core-contracts.ts');
        const core = readSource('src/shared/gameplay-core.ts');
        const adapters = readSource('src/shared/gameplay-core-adapters.ts');

        expect(contracts).toContain("type: z.literal('run.interlude_terminal_resolve')");
        expect(contracts).toContain("type: z.literal('run.interlude_terminal_resolved')");
        expect(core).toContain('createDeadInterludeGameOverRun(run)');
        expect(core).toContain("command.type === 'run.interlude_terminal_resolve'");
        expect(core).toContain("type: 'run.interlude_terminal_resolved'");
        expect(adapters).toContain('createGameplayInterludeTerminalResolveCommand(commandId)');
        expect(adapters).toContain('appendGameplayJournal(result.run, [command], result.events)');

        for (const path of rendererTerminalAdapters) {
            const source = readSource(path);
            expect(source, path).toContain('resolveInterludeTerminalThroughGameplayCore(');
            expect(source, path).not.toContain('createDeadInterludeGameOverRun');
            expect(source, path).not.toContain("status: 'gameOver'");
        }
    });

    it('keeps terminal feedback, simulation, and validated summary persistence in the enforced path', () => {
        const core = readSource('src/shared/gameplay-core.ts');
        const simulation = readSource('src/shared/gameplay-core-simulation.ts');
        const cli = readSource('scripts/sim-gameplay-core.ts');
        const resolutionController = readSource('src/renderer/store/runResolutionController.ts');

        expect(core).toContain("cue: 'run.interlude.terminal'");
        expect(simulation).toContain('runGameplayInterludeTerminalSimulation');
        expect(simulation).toContain("event.type === 'run.interlude_terminal_resolved'");
        expect(cli).toContain('interludeTerminalReport.invariantViolations.length > 0');
        expect(resolutionController).toContain('finalizeRunThroughGameplayCore(');
        expect(resolutionController).toContain('lastRunSummary: nextRun.lastRunSummary');
    });
});
