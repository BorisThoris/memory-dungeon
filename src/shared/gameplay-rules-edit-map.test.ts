import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
};
const editMap = fs.readFileSync(path.join(repoRoot, 'docs', 'agent', 'GAMEPLAY_RULES_EDIT_MAP.md'), 'utf8');

const referencedYarnScripts = (text: string): string[] => {
    const matches = text.matchAll(/\byarn\s+([A-Za-z0-9:_-]+)/g);
    return [...new Set([...matches].map((match) => match[1]!).filter((script) => script !== 'vitest'))];
};

describe('gameplay rules edit map drift', () => {
    it('references package scripts that exist', () => {
        const missing = referencedYarnScripts(editMap).filter((script) => packageJson.scripts[script] == null);

        expect(missing).toEqual([]);
    });

    it('points high-blast-radius gameplay work at system gates', () => {
        expect(editMap).toContain('yarn gate:action-loop');
        expect(editMap).toContain('yarn gate:rewards-economy');
        expect(editMap).toContain('yarn gate:navigation');
        expect(editMap).toContain('yarn gate:systems');
        expect(editMap).toContain('softlock-generator-contract.test.ts');
    });
});
