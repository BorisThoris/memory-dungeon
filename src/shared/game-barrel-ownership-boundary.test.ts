import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryPath = (...segments: string[]): string => join(process.cwd(), ...segments);

const productionTypeScriptFiles = (directory: string): string[] =>
    readdirSync(repositoryPath(directory), { withFileTypes: true }).flatMap((entry) => {
        const relativePath = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
            return productionTypeScriptFiles(relativePath);
        }
        if (!/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\.tsx?$/.test(entry.name)) {
            return [];
        }
        return [relativePath];
    });

describe('legacy game barrel ownership boundary', () => {
    it('keeps production modules on authoritative rule and command modules', () => {
        const directGameImport = /(?:from\s+|import\s*)['"][^'"]*(?:^|\/)game['"]/m;

        for (const file of productionTypeScriptFiles('src')) {
            const source = readFileSync(repositoryPath(file), 'utf8');
            expect(source, file).not.toMatch(directGameImport);
        }
    });

    it('keeps game.ts as an import-free public barrel rather than a runtime owner', () => {
        const source = readFileSync(repositoryPath('src/shared/game.ts'), 'utf8');

        expect(source).not.toMatch(/^import\s/m);
        expect(source).toContain("from './gameplay-command-compatibility'");
        expect(source).not.toContain('reduceGameplayCommand');
        expect(source).not.toContain('appendGameplayJournal');
        expect(source).not.toContain('createResolveBoardTurnTransition');
        expect(source).not.toContain('resolveBoardTurnCompatibility');
    });

    it('keeps historical state-in/state-out calls behind the shared command adapter', () => {
        const source = readFileSync(repositoryPath('src/shared/gameplay-command-compatibility.ts'), 'utf8');

        expect(source).toContain("from './gameplay-core-adapters'");
        expect(source).toContain('applyTileFlipThroughGameplayCore');
        expect(source).toContain('applyDestroyPairThroughGameplayCore');
        expect(source).toContain('executeGameplayCommandThroughGameplayCore');
        expect(source).toContain('resolveBoardTurnThroughGameplayCore');
        expect(source).not.toContain("from './gameplay-core'");
        expect(source).not.toContain("from './gameplay-journal'");
        expect(source).not.toContain('createResolveBoardTurnTransition');
    });

    it('keeps the superseded reducer/journal compatibility modules retired', () => {
        expect(existsSync(repositoryPath('src/shared/tile-flip-command-transition.ts'))).toBe(false);
        expect(existsSync(repositoryPath('src/shared/floor-completion-transitions.ts'))).toBe(false);
    });
});
