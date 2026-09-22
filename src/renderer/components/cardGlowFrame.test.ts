import { describe, expect, it } from 'vitest';
import {
    advanceCardGlowFrame,
    cardGlowPhase,
    initialCardGlowMemory,
    type CardGlowFrameInput,
    type CardGlowFrameMemory
} from './cardGlowFrame';

const FPS = 60;

/**
 * Runs the card's light forward the way the render loop does, returning every frame, so a test can
 * look at what a player would actually have seen over a stretch of play rather than at one sample.
 */
const play = (
    steps: readonly { seconds: number; input: Omit<CardGlowFrameInput, 'time'> }[],
    start: CardGlowFrameMemory = initialCardGlowMemory(0)
) => {
    let memory = start;
    let time = 0;
    const frames: { time: number; glowOpacity: number; spinOpacity: number; spinRotation: number }[] = [];
    for (const step of steps) {
        for (let i = 0; i < Math.round(step.seconds * FPS); i += 1) {
            time += 1 / FPS;
            const advanced = advanceCardGlowFrame({ ...step.input, time }, memory);
            memory = advanced.memory;
            frames.push({ time, ...advanced.frame });
        }
    }
    return { frames, memory };
};

const rest = { heat: 0, matched: false, reduceMotion: false, seed: 11 };

describe('advanceCardGlowFrame', () => {
    it('lights a card as the chain climbs and never leaves it dark', () => {
        const cold = play([{ seconds: 1, input: rest }]).frames;
        const hot = play([{ seconds: 1, input: { ...rest, heat: 1 } }]).frames;
        const mean = (f: typeof cold) => f.reduce((sum, x) => sum + x.glowOpacity, 0) / f.length;

        expect(mean(hot)).toBeGreaterThan(mean(cold) * 2);
        // Even at rest the painting's own light is on: a board of dark cardboard reads as broken.
        expect(Math.min(...cold.map((f) => f.glowOpacity))).toBeGreaterThan(0.1);
        // The medallion is still at rest and turning at Fever.
        expect(Math.max(...cold.map((f) => f.spinOpacity))).toBe(0);
        expect(Math.max(...hot.map((f) => f.spinOpacity))).toBeGreaterThan(0.5);
    });

    it('flares when a pair lands, then settles back to exactly the streak it earned', () => {
        // Two runs of the same card over the same clock, one of which matches at 0.5 s. Comparing
        // them frame by frame isolates the flare from the breath, which is a sine and would
        // otherwise make any two windows disagree for reasons that have nothing to do with a match.
        const steps = (matched: boolean) => [
            { seconds: 0.5, input: { ...rest, heat: 0.6 } },
            { seconds: 1.5, input: { ...rest, heat: 0.6, matched } }
        ];
        const control = play(steps(false)).frames;
        const landed = play(steps(true)).frames;

        const during = landed.slice(30, 45);
        const controlDuring = control.slice(30, 45);
        expect(Math.max(...during.map((f) => f.glowOpacity))).toBeGreaterThan(
            Math.max(...controlDuring.map((f) => f.glowOpacity))
        );

        // A pop, not a mood: within a second the two runs are the same card again.
        for (let i = landed.length - 20; i < landed.length; i += 1) {
            expect(landed[i]!.glowOpacity).toBeCloseTo(control[i]!.glowOpacity, 5);
        }
    });

    it('gutters when the chain breaks: darker than resting, then back', () => {
        const { frames } = play([
            { seconds: 1, input: { ...rest, heat: 0.9 } },
            { seconds: 1.5, input: rest }
        ]);
        const hot = frames.slice(0, 60);
        const justAfter = frames.slice(60, 66);
        const recovered = frames.slice(-20);
        const restingAlone = play([{ seconds: 1, input: rest }]).frames;

        // The break is read from the fall in heat alone — no event is passed in.
        expect(Math.min(...justAfter.map((f) => f.glowOpacity))).toBeLessThan(
            Math.min(...restingAlone.map((f) => f.glowOpacity))
        );
        expect(Math.max(...justAfter.map((f) => f.glowOpacity))).toBeLessThan(
            Math.min(...hot.map((f) => f.glowOpacity))
        );
        // And it lets go: a card does not carry a gutter into the next chain.
        expect(Math.min(...recovered.map((f) => f.glowOpacity))).toBeGreaterThan(
            Math.max(...justAfter.map((f) => f.glowOpacity))
        );
    });

    it('does not gutter while the meter is merely easing', () => {
        // Heat only ever falls on a break, but a caller could ramp it down; a small step must not
        // read as one, or every settle would look like a loss.
        const { frames } = play([
            { seconds: 0.4, input: { ...rest, heat: 0.6 } },
            { seconds: 0.4, input: { ...rest, heat: 0.55 } },
            { seconds: 0.4, input: { ...rest, heat: 0.5 } }
        ]);
        const opacities = frames.map((f) => f.glowOpacity);
        expect(Math.min(...opacities)).toBeGreaterThan(0.4);
    });

    it('turns the medallion one way, and holds everything still under reduce motion', () => {
        const turning = play([{ seconds: 2, input: { ...rest, heat: 1 } }]).frames;
        for (let i = 1; i < turning.length; i += 1) {
            expect(turning[i]!.spinRotation).toBeLessThanOrEqual(turning[i - 1]!.spinRotation);
        }

        const still = play([{ seconds: 1, input: { ...rest, heat: 1, reduceMotion: true } }]).frames;
        expect(new Set(still.map((f) => f.spinRotation))).toEqual(new Set([0]));
        // No breath either: every frame is the same card.
        expect(new Set(still.map((f) => f.glowOpacity)).size).toBe(1);
    });

    it('gives two cards different breaths from their seeds, and repeats for one', () => {
        const a = play([{ seconds: 0.5, input: { ...rest, heat: 0.5, seed: 3 } }]).frames;
        const b = play([{ seconds: 0.5, input: { ...rest, heat: 0.5, seed: 44 } }]).frames;
        expect(a.map((f) => f.glowOpacity)).not.toEqual(b.map((f) => f.glowOpacity));
        expect(cardGlowPhase(3)).not.toBe(cardGlowPhase(44));

        const again = play([{ seconds: 0.5, input: { ...rest, heat: 0.5, seed: 3 } }]).frames;
        expect(a.map((f) => f.glowOpacity)).toEqual(again.map((f) => f.glowOpacity));
    });

    it('forgets a flare when the card leaves the matched state', () => {
        const { memory } = play([
            { seconds: 0.3, input: { ...rest, heat: 0.5, matched: true } },
            { seconds: 0.3, input: { ...rest, heat: 0.5 } }
        ]);
        expect(memory.matchedAt).toBeNull();
    });
});
