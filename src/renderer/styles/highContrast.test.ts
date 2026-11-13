import { describe, expect, it } from 'vitest';
import { applyHighContrastToDocument, buildRendererThemeStyle, HIGH_CONTRAST_CSS_VARS, RENDERER_THEME } from './theme';

describe('High Contrast', () => {
    it('strengthens the app root’s secondary text and rules only when on', () => {
        const off = buildRendererThemeStyle(1) as Record<string, unknown>;
        const on = buildRendererThemeStyle(1, 'roomy', false, true) as Record<string, unknown>;
        expect(off['--theme-text-muted']).toBe(RENDERER_THEME.cssVars['--theme-text-muted']);
        expect(on['--theme-text-muted']).toBe(HIGH_CONTRAST_CSS_VARS['--theme-text-muted']);
        expect(on['--margin-hairline-soft']).toBe(HIGH_CONTRAST_CSS_VARS['--margin-hairline-soft']);
    });

    it('goes on <html> for portaled dialogs, and comes off back to the theme and the stylesheet', () => {
        const html = document.createElement('html');
        html.style.setProperty('--theme-text-muted', RENDERER_THEME.cssVars['--theme-text-muted']);
        applyHighContrastToDocument(true, html);
        expect(html.dataset.contrast).toBe('high');
        expect(html.style.getPropertyValue('--theme-text-muted')).toBe(HIGH_CONTRAST_CSS_VARS['--theme-text-muted']);
        expect(html.style.getPropertyValue('--margin-paper-dim')).toBe(HIGH_CONTRAST_CSS_VARS['--margin-paper-dim']);
        applyHighContrastToDocument(false, html);
        expect(html.dataset.contrast).toBeUndefined();
        expect(html.style.getPropertyValue('--theme-text-muted')).toBe(RENDERER_THEME.cssVars['--theme-text-muted']);
        // A stylesheet-only token is removed, so global.css's value shows again.
        expect(html.style.getPropertyValue('--margin-paper-dim')).toBe('');
    });
});
