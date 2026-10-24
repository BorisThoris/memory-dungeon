import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EVOLUTIONS } from '../../shared/relic-evolution-rules';
import { EvolutionGlyph } from './EvolutionGlyph';

describe('EvolutionGlyph (DGE-014)', () => {
    it('draws a mark for every evolution, and none for an unknown id', () => {
        for (const recipe of EVOLUTIONS) {
            const { container, unmount } = render(<EvolutionGlyph id={recipe.id} />);
            const svg = container.querySelector(`svg[data-evolution-glyph="${recipe.id}"]`);
            expect(svg, recipe.id).not.toBeNull();
            expect(svg!.getAttribute('aria-hidden')).toBe('true');
            expect(svg!.querySelectorAll('path').length, recipe.id).toBeGreaterThan(1);
            unmount();
        }
        expect(render(<EvolutionGlyph id="not_an_evolution" />).container.innerHTML).toBe('');
    });
});
