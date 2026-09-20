import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
    join(process.cwd(), 'src', 'renderer', 'components', 'GameScreen.module.css'),
    'utf8'
);

const STAGE_CHILD_LAYER_SELECTOR =
    '.boardStage > :global(*):not(.srOnly):not(.matchScoreFloater):not(.mismatchScoreFloater):not(.distractionHud)';

const ruleBody = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `rule "${selector}" is present`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('}', start));
};

/**
 * The match live-region span (`aria-live`, `.srOnly`) is a child of `.boardStage`. A blanket
 * `.boardStage > *` rule has the same specificity as `.srOnly`, so whichever is declared later
 * wins - and the child rule is declared later. When it set `position: relative` on the span, the
 * screen-reader sentence ("Score pop. Plus 525 points. Break score ...") rendered visibly in the
 * stage's top-left corner over the HUD on every match.
 */
describe('GameScreen board stage children', () => {
    it('keeps the screen-reader-only class positioned off-screen', () => {
        const srOnly = ruleBody('.srOnly');
        expect(srOnly).toMatch(/position:\s*absolute/u);
        expect(srOnly).toMatch(/clip:\s*rect\(0, 0, 0, 0\)/u);
    });

    it('excludes screen-reader-only text from the stage child layer rule', () => {
        expect(css).not.toMatch(/\.boardStage\s*>\s*:global\(\*\)\s*\{/u);
        expect(css).not.toMatch(/\.boardStage\s*>\s*:global\(\*\):not\(\.srOnly\)\s*\{/u);
        const children = ruleBody(STAGE_CHILD_LAYER_SELECTOR);
        expect(children).toMatch(/position:\s*relative/u);
    });

    /*
     * The same rule outranked the floaters' own `position: absolute`. On a desktop the board frame
     * is absolute too, so the floater's flow position was the stage corner and nobody noticed; in
     * the phone camera shell the frame is in flow, and every score pop landed a board height below
     * the screen.
     */
    it('excludes the stage-anchored overlays from the stage child layer rule', () => {
        for (const overlay of ['.matchScoreFloater', '.mismatchScoreFloater', '.distractionHud']) {
            expect(STAGE_CHILD_LAYER_SELECTOR).toContain(`:not(${overlay})`);
            expect(ruleBody(overlay)).toMatch(/position:\s*absolute/u);
        }
    });
});
