import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { SceneSprites } from './SceneSprites';
import { sceneFlameLevels } from './gameplaySceneLevels';

const flames = SCENE_SPRITES.gameplayFlames;

const varsAt = (heat: number | null) => {
    const { unmount } = render(<SceneSprites embers heat={heat} set={flames} still={false} />);
    const style = screen.getByTestId('scene-sprites').style;
    const read = (name: string) => style.getPropertyValue(name);
    const vars = {
        rate: read('--flame-rate'),
        lift: read('--flame-lift'),
        embers: read('--flame-embers'),
        emberRate: read('--flame-ember-rate')
    };
    unmount();
    return vars;
};

describe('SceneSprites', () => {
    it('leaves a scene with no run behind it burning exactly as it was painted', () => {
        // The menu's candles and the portal's arch have no chain meter. They must set none of these,
        // because every one of them falls back in CSS to the flame the painter painted — a scene
        // that starts declaring them at "rest" values would quietly dim itself.
        expect(varsAt(null)).toEqual({ rate: '', lift: '', embers: '', emberRate: '' });
    });

    it('hands the fire the chain: faster, taller, more sparks, all of it on one element', () => {
        const cold = varsAt(0);
        const hot = varsAt(1);

        for (const key of ['rate', 'lift', 'embers', 'emberRate'] as const) {
            expect(Number(hot[key])).toBeGreaterThan(Number(cold[key]));
        }
        // Six flames and their sparks inherit these four properties from the one root. Nothing is
        // set per sprite, so a hot room costs a phone no more elements or frame work than a cold
        // one — which is the whole reason the fire is allowed to answer the run on the lean tier.
        const { container } = render(<SceneSprites embers heat={1} set={flames} still={false} />);
        const sprites = [...container.querySelectorAll('[data-sprite-id]')];
        expect(sprites).toHaveLength(flames.sprites.length);
        for (const sprite of sprites) {
            expect((sprite as HTMLElement).style.getPropertyValue('--flame-rate')).toBe('');
            expect((sprite as HTMLElement).style.getPropertyValue('--flame-lift')).toBe('');
        }
    });

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

    it('holds a frozen scene frozen however hot the run is', () => {
        render(<SceneSprites embers heat={1} set={flames} still />);
        const sprites = screen.getByTestId('scene-sprites');
        expect(sprites).toHaveAttribute('data-still', 'true');
        // The properties are still there — the stylesheet is what refuses to spend them on a still
        // scene, so reduce motion cannot be defeated by a hot chain.
        for (const sprite of sprites.querySelectorAll('[data-sprite-id]')) {
            expect(sprite).toHaveAttribute('data-still', 'true');
        }
    });
});
