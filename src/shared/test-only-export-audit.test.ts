import { describe, expect, it } from 'vitest';
import {
    findTestOnlyExports,
    readExportedNames,
    readImportedNames,
    stripComments,
    TEST_ONLY_EXPORT_BASELINE,
    usedInOwnModule
} from '../../scripts/test-only-exports';

/**
 * The audit's own rules, held open on fixtures.
 *
 * Both of this audit's first two readings were wrong in the direction that matters least visibly -
 * it over-reported - and both were arithmetic rather than judgement. It counted the declaration
 * line as a use and reported `dealTilesInClumps` and `suitCountForPairs` as unreachable while
 * `tile-suit-rules.ts` calls each of them; and its import-clause pattern matched lazily from the
 * first `import` in a file, so a module imported after `node:fs` had its bindings read off the
 * wrong statement, which reported `buildMechanicsCatalogAppendixMarkdown` as test-only while the
 * docs regeneration calls it every time it runs.
 *
 * An audit that cries wolf is worse than no audit, because the fix for a false alarm is an
 * exemption. So the rules are pinned here rather than trusted.
 */
describe('what counts as an export', () => {
    it('reads every declaration form, and the alias in an export clause', () => {
        const names = readExportedNames(`
            export const a = 1;
            export function b() {}
            export async function c() {}
            export class D {}
            export interface E { x: number }
            export type F = string;
            const g = 2;
            export { g as h };
            export type { E as I };
        `);
        expect(new Set(names)).toEqual(new Set(['a', 'b', 'c', 'D', 'E', 'F', 'h', 'I']));
    });

    it('does not read a name out of a comment', () => {
        expect(readExportedNames('// export const ghost = 1;\n/* export const other = 2; */')).toEqual([]);
        expect(stripComments('const a = 1; // export const b')).not.toContain('export const b');
    });
});

describe('what counts as importing a name', () => {
    it('takes the local binding, not the alias, and ignores a type prefix', () => {
        expect(readImportedNames("{ a, b as c, type D }")).toEqual({ names: ['a', 'b', 'D'], namespace: false });
    });

    it('reports a namespace import, which consumes every export at once', () => {
        expect(readImportedNames('* as everything')).toEqual({ names: [], namespace: true });
    });
});

describe('what counts as the module using its own export', () => {
    it('is false when the only occurrence is the declaration', () => {
        expect(usedInOwnModule('export const lonely = 1;\n', 'lonely')).toBe(false);
    });

    it('is true when the module calls it, which is the off-by-one that over-reported', () => {
        expect(usedInOwnModule('export const used = () => 1;\nconst x = used();\n', 'used')).toBe(true);
    });

    it('is false when the only other occurrence is a comment about it', () => {
        expect(usedInOwnModule('// see used\nexport const used = 1;\n', 'used')).toBe(false);
    });
});

describe('the audit as a whole', () => {
    const sources: Record<string, string> = {
        'src/thing.ts': "export const reachable = 1;\nexport const orphan = 2;\nexport const internal = 3;\nconst x = internal;\n",
        'src/thing.test.ts': "import { orphan, internal, reachable } from './thing';\n",
        'src/screen.ts': "import { reachable } from './thing';\n",
        'src/shared.ts': "export const fixture = 1;\n",
        'src/other.test.ts': "import { fixture } from './shared';\n"
    };
    const files = Object.keys(sources);
    const read = (file: string): string => sources[file.replace(/^\.\//u, '')] ?? '';

    it('reports the export only the module\'s own test reaches', () => {
        const { found } = findTestOnlyExports(files, files, read);
        expect(found.map((entry) => `${entry.file} ${entry.name}`)).toEqual(['src/thing.ts orphan']);
    });

    it('stays quiet about a symbol some other module\'s test imports, which is a shared fixture', () => {
        const { found } = findTestOnlyExports(files, files, read);
        expect(found.some((entry) => entry.name === 'fixture')).toBe(false);
    });

    it('skips a module taken wholesale by a namespace import rather than guessing', () => {
        const withNamespace: Record<string, string> = {
            ...sources,
            'src/wide.ts': 'export const a = 1;\n',
            'src/wide.test.ts': "import * as wide from './wide';\n"
        };
        const wideFiles = Object.keys(withNamespace);
        const { found, namespaceImported } = findTestOnlyExports(
            wideFiles,
            wideFiles,
            (file) => withNamespace[file.replace(/^\.\//u, '')] ?? ''
        );
        expect(found.some((entry) => entry.name === 'a')).toBe(false);
        expect(namespaceImported.some((path) => path.endsWith('wide.ts'))).toBe(true);
    });
});

describe('the baseline', () => {
    it('is a ratchet rather than a list of excuses: it only ever shrinks', () => {
        /*
         * 149 on the day Gen 214 wrote it, after the Inventory read-model chain came out. The
         * number is asserted so a later generation cannot quietly re-record a new finding as
         * known debt - adding a line fails this, and the audit itself fails on a line that no
         * longer applies.
         */
        expect(TEST_ONLY_EXPORT_BASELINE.size).toBeLessThanOrEqual(149);
    });

    it('names a file and a symbol on every line', () => {
        for (const entry of TEST_ONLY_EXPORT_BASELINE) {
            expect(entry, `${entry} is not "<path> <name>"`).toMatch(/^src\/[\w./-]+\.tsx? [A-Za-z_$][\w$]*$/u);
        }
    });
});
