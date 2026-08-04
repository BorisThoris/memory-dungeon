import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryPath = (...segments: string[]): string => join(process.cwd(), ...segments);

const readRepositorySource = (path: string): string => readFileSync(repositoryPath(path), 'utf8');

describe('legacy playthrough solver retirement boundary', () => {
    it('keeps the direct-mutation solver implementation and its duplicate test retired', () => {
        expect(existsSync(repositoryPath('src/shared/playthrough-solver.ts'))).toBe(false);
        expect(existsSync(repositoryPath('src/shared/playthrough-solver.test.ts'))).toBe(false);
    });

    it('routes generated-board properties and simulation consumers through the command solver', () => {
        const consumers = [
            'src/shared/gameplay-property-invariants.test.ts',
            'src/shared/softlock-generator-contract.ts',
            'src/shared/build-strategy-playthrough-simulation.ts',
            'scripts/sim-endless.ts'
        ];

        for (const consumer of consumers) {
            const source = readRepositorySource(consumer);
            expect(source, consumer).toContain('gameplay-core-playthrough-solver');
            expect(source, consumer).not.toContain("from './playthrough-solver'");
            expect(source, consumer).not.toContain('solveRunByExhaustingPlayablePairs');
        }
    });

    it('keeps both command-solver implementation and shared selection rules on stress gates', () => {
        const gateSource = readRepositorySource('scripts/gate-changed.mjs');

        expect(gateSource).toContain("file.startsWith('src/shared/gameplay-core-playthrough-solver')");
        expect(gateSource).toContain("file.startsWith('src/shared/playthrough-solver-rules')");
        expect(gateSource).toContain('isPlaythroughSolverBoundaryFile(file)');
    });
});
