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

const EXPECTED_COMMAND_ADAPTER_CONSUMERS = [
    'src/renderer/store/levelCompleteContinuationExecutor.ts',
    'src/renderer/store/relicOfferSurfaceState.ts',
    'src/renderer/store/riskWagerSurfaceState.ts',
    'src/renderer/store/runSurfaceState.ts',
    'src/renderer/store/shopSurfaceState.ts',
    'src/renderer/store/sideRoomSurfaceState.ts',
    'src/renderer/store/tilePressController.ts'
] as const;

describe('renderer command transaction ownership boundary', () => {
    it('keeps reducer execution and accepted journal ordering in one shared adapter', () => {
        const adapters = readSource('src/shared/gameplay-core-adapters.ts');
        const coreTest = readSource('src/shared/gameplay-core.test.ts');

        expect(adapters).toContain('export const executeGameplayCommandThroughGameplayCore = (');
        expect(adapters).toContain('const result = reduceGameplayCommand(run, command);');
        expect(adapters).toContain(
            'run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run'
        );
        expect(coreTest).toContain("it('owns accepted command journaling and leaves rejected inputs untouched'");
    });

    it('limits production renderer modules to command construction and returned-state projection', () => {
        const consumers: string[] = [];

        for (const [relativePath, source] of readProductionRendererSources()) {
            expect(source, relativePath).not.toMatch(/from\s+['"][^'"]*shared\/gameplay-core['"]/);
            expect(source, relativePath).not.toMatch(/from\s+['"][^'"]*shared\/gameplay-journal['"]/);
            expect(source, relativePath).not.toContain('reduceGameplayCommand(');
            expect(source, relativePath).not.toContain('appendGameplayJournal(');

            if (source.includes('executeGameplayCommandThroughGameplayCore(')) {
                consumers.push(relativePath);
            }
        }

        expect(consumers.sort()).toEqual([...EXPECTED_COMMAND_ADAPTER_CONSUMERS]);
    });
});
