import { describe, expect, it } from 'vitest';
import {
    findUndefinedTokens,
    findUndersized,
    MIN_TYPE_EXEMPTIONS,
    MIN_TYPE_PX,
    readFontTokens,
    readTypeDeclarations,
    resolveMinPx,
    ROOT_PX
} from '../../scripts/min-type-size';

describe('resolveMinPx', () => {
    it('resolves rem against the root size and px as itself', () => {
        expect(resolveMinPx('0.7rem')).toBeCloseTo(0.7 * ROOT_PX);
        expect(resolveMinPx('13px')).toBe(13);
    });

    it('takes a clamp at its lower bound, which is the size it can actually reach', () => {
        expect(resolveMinPx('clamp(0.7rem, 3vw, 2rem)')).toBeCloseTo(0.7 * ROOT_PX);
    });

    it('takes the smallest arm of a min() and the largest of a max()', () => {
        expect(resolveMinPx('min(1rem, 10px)')).toBe(10);
        expect(resolveMinPx('max(1rem, 10px)')).toBe(ROOT_PX);
    });

    it('resolves a var() through the token it names', () => {
        expect(resolveMinPx('var(--ui-font-caption)', { '--ui-font-caption': '0.75rem' })).toBe(12);
    });

    it('reports a var() naming no defined token as undefined, not as passing', () => {
        expect(resolveMinPx('var(--ui-font-missing)', {})).toBeUndefined();
    });

    it('uses a var() fallback, since a fallback makes the missing token harmless', () => {
        expect(resolveMinPx('var(--ui-font-missing, 11px)', {})).toBe(11);
    });

    it('leaves what the cascade decides to the cascade', () => {
        expect(resolveMinPx('0.7em')).toBeNull();
        expect(resolveMinPx('inherit')).toBeNull();
        expect(resolveMinPx('calc(1rem - 2px)')).toBeNull();
    });
});

describe('readFontTokens', () => {
    it('reads the size tokens and skips the font stacks', () => {
        const source = [
            "        '--ui-font-label': '0.75rem',",
            '        \'--ui-font-display-family\': "\'Cinzel\', Georgia, serif",',
            "        '--ui-type-screen': 'clamp(1.25rem, 3.2vw, 2rem)',"
        ].join('\n');

        expect(readFontTokens(source)).toEqual({
            '--ui-font-label': '0.75rem',
            '--ui-type-screen': 'clamp(1.25rem, 3.2vw, 2rem)'
        });
    });
});

describe('readTypeDeclarations', () => {
    it('names the selector a declaration sits under, so a report points somewhere', () => {
        const css = ['.kicker {', '    font-weight: 700;', '    font-size: 0.7rem;', '}'].join('\n');
        const [declaration] = readTypeDeclarations('a.css', css);

        expect(declaration).toMatchObject({ file: 'a.css', line: 3, selector: '.kicker', value: '0.7rem' });
    });

    it('does not mistake another property that ends in font-size for one', () => {
        expect(readTypeDeclarations('a.css', '.x {\n    --hud-font-size: 0.5rem;\n}')).toEqual([]);
    });
});

describe('findUndersized', () => {
    const declaration = (px: number | null | undefined, selector = '.x') => ({
        file: 'a.css',
        line: 1,
        px,
        selector,
        value: 'x'
    });

    it('reports a declaration under the floor', () => {
        expect(findUndersized([declaration(11.2)])).toHaveLength(1);
    });

    it('says nothing about the floor itself', () => {
        expect(findUndersized([declaration(MIN_TYPE_PX)])).toEqual([]);
    });

    it('does not count a size the cascade decides as undersized', () => {
        expect(findUndersized([declaration(null)])).toEqual([]);
    });
});

describe('findUndefinedTokens', () => {
    it('reports the declaration whose token does not exist, which does nothing at all', () => {
        const rows = findUndefinedTokens([
            { file: 'a.css', line: 1, px: undefined, selector: '.x', value: 'var(--nope)' },
            { file: 'a.css', line: 2, px: 12, selector: '.y', value: '0.75rem' }
        ]);

        expect(rows.map((row) => row.selector)).toEqual(['.x']);
    });
});

describe('MIN_TYPE_EXEMPTIONS', () => {
    it('keeps every exemption paired with a reason, not just a name', () => {
        for (const [key, reason] of Object.entries(MIN_TYPE_EXEMPTIONS)) {
            expect(reason.trim().length, `${key} needs a reason`).toBeGreaterThan(20);
        }
    });
});
