import { describe, expect, it } from 'vitest';
import { findMissingScriptPaths } from '../../scripts/script-paths';

describe('findMissingScriptPaths', () => {
    it('reports a script naming a file that is not there', () => {
        expect(
            findMissingScriptPaths({ 'gate:x': 'vitest run src/renderer/components/Gone.test.tsx' }, () => false)
        ).toEqual([{ path: 'src/renderer/components/Gone.test.tsx', script: 'gate:x' }]);
    });

    it('says nothing about a script whose files are all present', () => {
        expect(findMissingScriptPaths({ 'gate:x': 'vitest run src/a.test.ts src/b.test.ts' }, () => true)).toEqual([]);
    });

    it('leaves package names and flag values alone, which are not ours to resolve', () => {
        const scripts = {
            build: 'cross-env VITE_OUT_DIR=dist vite build --config vite.config.mts',
            lint: 'eslint . --max-warnings 0'
        };
        expect(findMissingScriptPaths(scripts, () => false)).toEqual([]);
    });

    it('reports every missing file in one script, not just the first', () => {
        const found = findMissingScriptPaths({ 'gate:x': 'vitest run src/a.test.ts e2e/b.spec.ts' }, () => false);
        expect(found.map((row) => row.path)).toEqual(['src/a.test.ts', 'e2e/b.spec.ts']);
    });
});
