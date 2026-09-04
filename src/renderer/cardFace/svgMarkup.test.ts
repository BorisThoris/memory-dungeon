import { describe, expect, it } from 'vitest';
import { svgLinearGradientDef } from './svgMarkup';

describe('svgMarkup', () => {

    it('svgLinearGradientDef emits a linearGradient block', () => {
        const g = svgLinearGradientDef('g1', 0, 0, 1, 1, true, [
            { offset: '0', color: '#000' },
            { offset: '1', color: '#fff' }
        ]);
        expect(g).toContain('id="g1"');
        expect(g).toContain('userSpaceOnUse');
        expect(g).toContain('stop-color="#000"');
    });
});
