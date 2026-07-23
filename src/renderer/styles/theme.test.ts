import { describe, expect, it } from 'vitest';
import { RENDERER_THEME, buildRendererThemeStyle, forEachRendererThemeCssVar } from './theme';

describe('REG-014 design-system density tokens', () => {
    it('defines shared density tokens for shells, cards, controls, and lists', () => {
        expect(RENDERER_THEME.cssVars['--ui-density-panel-pad-md']).toBe('var(--ui-card-pad-md)');
        expect(RENDERER_THEME.cssVars['--ui-density-control-pad-y']).toBe('0.72rem');
        expect(RENDERER_THEME.cssVars['--ui-density-list-gap']).toBe('var(--theme-space-sm)');
    });

    it('tightens density tokens under compact theme mode without changing touch target minimum', () => {
        const compact = buildRendererThemeStyle(1, 'compact') as Record<string, string | number>;
        expect(compact['--ui-density-control-pad-y']).toBe('0.62rem');
        expect(compact['--ui-density-list-gap']).toBe('0.42rem');
        expect(compact['--ui-touch-target-min']).toBe(RENDERER_THEME.cssVars['--ui-touch-target-min']);
    });
});
describe('buildRendererThemeStyle', () => {
    it('deepens modal scrim tokens when reduce motion is enabled (OVR-015)', () => {
        const motionOn = buildRendererThemeStyle(1, 'roomy', false);
        const motionOff = buildRendererThemeStyle(1, 'roomy', true);

        expect(motionOn['--theme-modal-scrim-bg' as keyof typeof motionOn]).toBe('var(--theme-scrim-dialog)');
        expect(motionOff['--theme-modal-scrim-bg' as keyof typeof motionOff]).toBe('var(--theme-scrim-heavy)');
        expect(motionOff['--theme-modal-scrim-backdrop-filter' as keyof typeof motionOff]).toBe('none');
    });
});

describe('forEachRendererThemeCssVar', () => {
    it('visits each renderer theme CSS var with its value', () => {
        const visited = new Map<string, string>();

        forEachRendererThemeCssVar((key, value) => {
            visited.set(key, value);
        });

        expect([...visited.keys()]).toEqual(Object.keys(RENDERER_THEME.cssVars));
        for (const [key, value] of Object.entries(RENDERER_THEME.cssVars)) {
            expect(visited.get(key)).toBe(value);
        }
    });
});
