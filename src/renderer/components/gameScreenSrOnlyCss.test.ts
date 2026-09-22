import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
    join(process.cwd(), 'src', 'renderer', 'components', 'GameScreen.module.css'),
    'utf8'
);

/*
 * The selector is matched on its tokens, not its line breaks: it is long enough that the
 * formatter wraps it, and a guard that a reformat can break is a guard that gets deleted.
 */
const STAGE_CHILD_LAYER_SELECTOR =
    '.boardStage > :global(*):not(.srOnly):not(.matchScoreFloater):not(.mismatchScoreFloater):not(.distractionHud):not(.memorizeSkipLayer)';

const collapsed = css.replace(/\s+/gu, ' ');

const ruleBody = (selector: string): string => {
    const start = collapsed.indexOf(`${selector} {`);
    expect(start, `rule "${selector}" is present`).toBeGreaterThan(-1);
    return collapsed.slice(start, collapsed.indexOf('}', start));
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
        expect(collapsed).not.toMatch(/\.boardStage\s*>\s*:global\(\*\)\s*\{/u);
        expect(collapsed).not.toMatch(/\.boardStage\s*>\s*:global\(\*\):not\(\.srOnly\)\s*\{/u);
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

/*
 * The same rule killed the double tap that ends the study period, and killed it silently.
 *
 * The skip layer is an empty button whose entire hit area comes from `position: absolute; inset:
 * 0`. Flattened to `position: relative` it kept its class, its accessible name and its place in
 * the DOM - and, having no content, collapsed to nothing. Every test that asked whether it was
 * rendered still passed. There was no visual symptom and no failing check, only a gesture that
 * had stopped working.
 *
 * jsdom lays out neither CSS modules nor zero-height boxes, so no rendering test can catch this.
 * The stylesheet can.
 */
describe('the study-skip layer', () => {
    it('keeps the hit area that its absolute inset gives it', () => {
        const layer = ruleBody('.memorizeSkipLayer');
        expect(layer).toMatch(/position:\s*absolute/u);
        expect(layer).toMatch(/inset:\s*0/u);
    });

    it('is excluded from the stage child layer rule that would flatten it', () => {
        expect(STAGE_CHILD_LAYER_SELECTOR).toContain(':not(.memorizeSkipLayer)');
        expect(ruleBody(STAGE_CHILD_LAYER_SELECTOR)).toMatch(/position:\s*relative/u);
    });

    /* Above the tiles the stage-child rule puts on layer 1, so the tap reaches the layer. */
    it('paints above the board tiles it covers', () => {
        const zIndex = /z-index:\s*(\d+)/u.exec(ruleBody('.memorizeSkipLayer'));
        expect(zIndex, 'the skip layer declares a z-index').not.toBeNull();
        expect(Number(zIndex?.[1])).toBeGreaterThan(1);
    });
});
