import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const collectSourceFiles = (root: string): string[] => {
    if (!fs.existsSync(root)) {
        return [];
    }
    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) {
            return collectSourceFiles(absolute);
        }
        return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
    });
};

const normalize = (file: string): string => file.replaceAll('\\', '/');

describe('dungeon topology runtime boundary', () => {
    it('keeps graphology-backed topology and graphology imports out of runtime renderer and production shared imports', () => {
        const repoRoot = process.cwd();
        const sourceFiles = [
            ...collectSourceFiles(path.join(repoRoot, 'src', 'main')),
            ...collectSourceFiles(path.join(repoRoot, 'src', 'preload')),
            ...collectSourceFiles(path.join(repoRoot, 'src', 'renderer')),
            ...collectSourceFiles(path.join(repoRoot, 'src', 'shared'))
        ];
        const allowed = new Set([
            'src/shared/dungeon-topology.ts',
            'src/shared/softlock-generator-contract.ts'
        ]);
        const offenders = sourceFiles
            .map((file) => normalize(path.relative(repoRoot, file)))
            .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
            .filter((file) => !allowed.has(file))
            .filter((file) => {
                const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
                return (
                    /from ['"].*dungeon-topology['"]/.test(text) ||
                    /(?:from|import) ['"]graphology(?:\/[^'"]*)?['"]/.test(text)
                );
            });

        expect(offenders).toEqual([]);
    });
});
