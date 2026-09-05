import { describe, expect, it } from 'vitest';
import { findShadowedDeclarations, readBlocks, stripComments, SHADOWED_DECLARATION_EXEMPTIONS } from '../../scripts/css-duplicate-rules';

const at = (source: string): string[] =>
    findShadowedDeclarations('a.css', source).map((row) => `${row.property}:${row.deadLine}>${row.winningLine}`);

describe('findShadowedDeclarations', () => {
    it('finds the declaration an identical rule later in the file overrules', () => {
        expect(at('.a {\n    inset: 0;\n}\n\n.a {\n    inset: 4px;\n}')).toEqual(['inset:2>6']);
    });

    it('is the real case: a layout property set twice hundreds of lines apart', () => {
        // The board stage. An edit to the first block moved nothing, and nothing said so.
        const source = [".x .stage {", "    position: absolute;", "    inset: 0;", "}", "", ".x .stage {", "    position: absolute;", "    inset: 0;", "}"].join('\n');
        expect(at(source).sort()).toEqual(['inset:3>8', 'position:2>7']);
    });

    it('leaves a different selector alone, however similar', () => {
        expect(at('.a {\n    inset: 0;\n}\n\n.a:hover {\n    inset: 4px;\n}')).toEqual([]);
    });

    it('leaves a media query alone: that is the cascade doing its job, not a shadowed edit', () => {
        expect(at('.a {\n    inset: 0;\n}\n\n@media (max-width: 700px) {\n    .a {\n        inset: 4px;\n    }\n}')).toEqual([]);
    });

    it('reports the same selector twice inside one media query', () => {
        expect(at('@media (max-width: 700px) {\n    .a {\n        inset: 0;\n    }\n    .a {\n        inset: 4px;\n    }\n}')).toEqual([
            'inset:3>6'
        ]);
    });

    it('leaves the two blocks alone when they set different properties', () => {
        expect(at('.a {\n    inset: 0;\n}\n\n.a {\n    color: red;\n}')).toEqual([]);
    });

    it('normalizes whitespace so the same selector written two ways still matches', () => {
        expect(at('.a  >  .b {\n    inset: 0;\n}\n\n.a > .b {\n    inset: 4px;\n}')).toEqual(['inset:2>6']);
    });

    it('gives an earlier !important the win, so the later declaration is the dead one', () => {
        expect(at('.a {\n    inset: 0 !important;\n}\n\n.a {\n    inset: 4px;\n}')).toEqual(['inset:6>2']);
    });

    it('lets a later !important win over an earlier one', () => {
        expect(at('.a {\n    inset: 0 !important;\n}\n\n.a {\n    inset: 4px !important;\n}')).toEqual(['inset:2>6']);
    });

    it('reads custom properties, which shadow just as silently as any other', () => {
        expect(at('.a {\n    --surface: red;\n}\n\n.a {\n    --surface: blue;\n}')).toEqual(['--surface:2>6']);
    });

    it('does not read a property out of a comment', () => {
        expect(at('.a {\n    /* inset: 0; */\n    color: red;\n}\n\n.a {\n    inset: 4px;\n}')).toEqual([]);
    });

    it('does not count a nested rule against its parent', () => {
        expect(at('.a {\n    inset: 0;\n\n    &:hover {\n        inset: 4px;\n    }\n}')).toEqual([]);
    });
});

describe('stripComments', () => {
    it('blanks a comment without moving any line', () => {
        const stripped = stripComments('.a {\n    /* two\n       lines */\n    color: red;\n}');
        expect(stripped.split('\n')).toHaveLength(5);
        expect(stripped).not.toContain('lines');
    });
});

describe('readBlocks', () => {
    it('carries the at-rule context so two contexts never compare', () => {
        const blocks = readBlocks('@media (max-width: 700px) {\n    .a {\n        inset: 0;\n    }\n}');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.context).toBe('@media (max-width: 700px)');
    });

    it('does not let a statement at-rule swallow the rule after it', () => {
        expect(readBlocks("@import 'x.css';\n.a {\n    inset: 0;\n}").map((block) => block.selector)).toEqual(['.a']);
    });
});

describe('SHADOWED_DECLARATION_EXEMPTIONS', () => {
    it('names a reason for every exemption rather than carrying a bare count', () => {
        for (const [key, reason] of Object.entries(SHADOWED_DECLARATION_EXEMPTIONS)) {
            expect(reason.length, key).toBeGreaterThan(20);
        }
    });
});
