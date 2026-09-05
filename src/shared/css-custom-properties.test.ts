import { describe, expect, it } from 'vitest';
import {
    findUndefinedProperties,
    findUnreadProperties,
    readDefinedProperties,
    readVarUses,
    UNDEFINED_PROPERTY_EXEMPTIONS,
    UNREAD_PROPERTY_EXEMPTIONS
} from '../../scripts/css-custom-properties';

describe('readDefinedProperties', () => {
    it('reads a stylesheet declaration', () => {
        expect(readDefinedProperties('a.css', '.x {\n    --gap: 4px;\n}').map((row) => row.property)).toEqual(['--gap']);
    });

    it('reads a style-object key and a computed key, which are how the theme declares its own', () => {
        const source = ["    '--ui-radius-sm': '0.4rem',", "    ['--gameplay-chrome-blur' as string]: '14px',"].join('\n');
        expect(readDefinedProperties('theme.ts', source).map((row) => row.property).sort()).toEqual([
            '--gameplay-chrome-blur',
            '--ui-radius-sm'
        ]);
    });

    it('marks a setProperty write as written by running code, and a declaration as not', () => {
        expect(readDefinedProperties('h.ts', "el.style.setProperty('--clearance', '4px');")[0]).toMatchObject({
            property: '--clearance',
            runtime: true
        });
        expect(readDefinedProperties('a.css', '.x {\n    --gap: 4px;\n}')[0]).toMatchObject({ runtime: false });
    });

    it('does not mistake a var() read for a declaration', () => {
        expect(readDefinedProperties('a.css', '.x {\n    gap: var(--gap);\n}')).toEqual([]);
    });
});

describe('readVarUses', () => {
    it('records whether the read carries its own fallback', () => {
        const rows = readVarUses('a.css', '.x {\n    top: var(--a);\n    left: var(--b, 4px);\n}');
        expect(rows.map((row) => [row.property, row.hasFallback])).toEqual([
            ['--a', false],
            ['--b', true]
        ]);
    });
});

describe('findUnreadProperties', () => {
    const write = (property: string) => ({ file: 'h.ts', hasFallback: false, line: 1, property, runtime: true });
    const declare = (property: string) => ({ file: 'a.css', hasFallback: false, line: 1, property, runtime: false });
    const read = (property: string) => ({ file: 'a.css', hasFallback: false, line: 1, property, runtime: false });

    it('reports a runtime write nothing reads', () => {
        // The clearance hook measured the chrome every frame and wrote a number no rule consumed.
        expect(findUnreadProperties([write('--clearance')], []).map((row) => row.property)).toEqual(['--clearance']);
    });

    it('says nothing about a runtime write something reads', () => {
        expect(findUnreadProperties([write('--clearance')], [read('--clearance')])).toEqual([]);
    });

    it('leaves a declared-but-unused design token alone, since defining one ahead of use is ordinary', () => {
        expect(findUnreadProperties([declare('--ui-radius-xl')], [])).toEqual([]);
    });
});

describe('findUndefinedProperties', () => {
    const read = (property: string, hasFallback = false) => ({ file: 'a.css', hasFallback, line: 1, property, runtime: false });
    const declare = (property: string) => ({ file: 'theme.ts', hasFallback: false, line: 1, property, runtime: false });

    it('reports a read with no fallback that nothing defines', () => {
        // `padding: var(--ui-button-pad-md)` was invalid, so every unstyled button had none.
        expect(findUndefinedProperties([], [read('--ui-button-pad-md')]).map((row) => row.property)).toEqual([
            '--ui-button-pad-md'
        ]);
    });

    it('leaves a read carrying its own fallback alone, since it still renders', () => {
        expect(findUndefinedProperties([], [read('--maybe', true)])).toEqual([]);
    });

    it('says nothing about a read the theme defines', () => {
        expect(findUndefinedProperties([declare('--ui-radius-sm')], [read('--ui-radius-sm')])).toEqual([]);
    });
});

describe('exemptions', () => {
    it('keeps every exemption paired with a reason, not just a name', () => {
        for (const [name, reason] of Object.entries({ ...UNREAD_PROPERTY_EXEMPTIONS, ...UNDEFINED_PROPERTY_EXEMPTIONS })) {
            expect(reason.trim().length, `${name} needs a reason`).toBeGreaterThan(20);
        }
    });
});
