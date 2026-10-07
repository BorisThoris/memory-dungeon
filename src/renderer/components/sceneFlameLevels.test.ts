import { describe, expect, it } from 'vitest';
import { sceneFlameLevels } from './gameplaySceneLevels';

/**
 * How hard the room's fire burns for a given chain. These were `SceneSprites`' tests when the
 * flames were elements and the levels reached them as custom properties; the curve is the same
 * now that `composeGameplayScene` reads it and the canvas paints it.
 */
describe('sceneFlameLevels', () => {
    it('shows one pair in the fire, rather than saving everything for Fever', () => {
        // A chain of one, on a four-pair meter. Half the climb should already be spent, or the room
        // says nothing until the run is nearly over.
        const early = sceneFlameLevels(0.25);
        const cold = sceneFlameLevels(0);
        const hot = sceneFlameLevels(1);
        const spent = (early.rate - cold.rate) / (hot.rate - cold.rate);
        expect(spent).toBeGreaterThan(0.4);
    });

    it('never asks for more than the fire can be: bounded, and safe on a broken fill', () => {
        for (const fill of [-5, 0, 0.5, 1, 9, Number.NaN, Number.POSITIVE_INFINITY]) {
            const levels = sceneFlameLevels(fill);
            expect(levels.rate).toBeGreaterThanOrEqual(0.9);
            expect(levels.rate).toBeLessThanOrEqual(1.6);
            expect(levels.lift).toBeGreaterThanOrEqual(1);
            expect(levels.lift).toBeLessThanOrEqual(1.2);
            expect(levels.embers).toBeGreaterThan(0);
            expect(levels.embers).toBeLessThanOrEqual(1);
        }
        // Garbage reads as a cold room, not as a bonfire.
        expect(sceneFlameLevels(Number.NaN)).toEqual(sceneFlameLevels(0));
    });

    it('climbs without ever stepping back', () => {
        let previous = sceneFlameLevels(0);
        for (let fill = 0.05; fill <= 1.0001; fill += 0.05) {
            const levels = sceneFlameLevels(fill);
            expect(levels.rate).toBeGreaterThan(previous.rate);
            expect(levels.lift).toBeGreaterThanOrEqual(previous.lift);
            expect(levels.embers).toBeGreaterThan(previous.embers);
            previous = levels;
        }
    });

    it('draws breath for the pair that would land a rung, and lets it out again', () => {
        // Fire pulls in before a gust. That is the only reason this reads without a caption, and it
        // is why the draw has to be the *inverse* of the climb: the rung landing releases it.
        const steady = sceneFlameLevels(0.6);
        const drawing = sceneFlameLevels(0.6, true);
        expect(drawing.rate).toBeGreaterThan(steady.rate);
        expect(drawing.lift).toBeLessThan(steady.lift);
        expect(drawing.embers).toBeLessThan(steady.embers);
        // Small enough to still be the same fire: a room that lurched every fourth pair would be
        // exhausting, and a flame that shrank by half would read as going out, not as gathering.
        expect(drawing.lift).toBeGreaterThan(steady.lift * 0.9);
        expect(sceneFlameLevels(0.6, false)).toEqual(steady);
    });

    it('never lets the draw undo the climb: a drawn hot fire still beats a steady cold one', () => {
        // Both states ride the same four properties, so they could in principle cancel. A player
        // one pair from Fever must not see a fire smaller than one who has just started.
        const coldSteady = sceneFlameLevels(0);
        const hotDrawing = sceneFlameLevels(1, true);
        expect(hotDrawing.rate).toBeGreaterThan(coldSteady.rate);
        expect(hotDrawing.lift).toBeGreaterThan(coldSteady.lift);
        expect(hotDrawing.embers).toBeGreaterThan(coldSteady.embers);
    });

    it('drops the fire on a miss without putting it out', () => {
        // A miss halves the streak and zeroes the cascade (`turn-mismatch-rules`), so the room
        // reads momentum that is still most of a chain. The comment there once said "the fire goes
        // out" — written before there was a fire. It is not out, and a test is the only thing that
        // keeps that claim honest as the curve moves.
        const FEVER_RUNG = 7;
        const fillFor = (momentum: number) => Math.min(1, momentum / FEVER_RUNG);
        // A seat at Fever: streak 6 with 2 cascade pairs, then a miss leaves streak 3, cascade 0.
        const hot = sceneFlameLevels(fillFor(6 + 2));
        const afterMiss = sceneFlameLevels(fillFor(Math.floor(6 / 2)));
        const cold = sceneFlameLevels(0);

        expect(afterMiss.rate).toBeLessThan(hot.rate);
        expect(afterMiss.embers).toBeLessThan(hot.embers);
        // The drop has to be visible, or the loss reads as nothing happening.
        expect(hot.rate - afterMiss.rate).toBeGreaterThan(0.1);
        // And it has to stay a fire: still clearly above a room with no chain behind it at all.
        expect(afterMiss.rate).toBeGreaterThan(cold.rate + 0.2);
        expect(afterMiss.embers).toBeGreaterThan(cold.embers);
    });
});
