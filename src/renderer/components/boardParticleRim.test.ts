import { describe, expect, it } from 'vitest';
import { makeTile } from '../../shared/test/game-fixtures';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getRimParticleMood, sampleCardRim } from './boardParticleRim';

describe('rim particles follow the card and its visible cues', () => {
    it('traces a continuous rounded perimeter instead of scattering inside the artwork', () => {
        const sample = { x: 0, y: 0, nx: 0, ny: 0 };
        let previous = { ...sample };
        for (let i = 0; i <= 400; i += 1) {
            sampleCardRim(i / 400, sample);
            expect(Math.abs(sample.x)).toBeLessThanOrEqual(CARD_PLANE_WIDTH / 2 + 0.012001);
            expect(Math.abs(sample.y)).toBeLessThanOrEqual(CARD_PLANE_HEIGHT / 2 + 0.012001);
            expect(Math.max(Math.abs(sample.x) / (CARD_PLANE_WIDTH / 2), Math.abs(sample.y) / (CARD_PLANE_HEIGHT / 2))).toBeGreaterThan(0.9);
            expect(Math.hypot(sample.nx, sample.ny)).toBeCloseTo(1);
            if (i > 0) expect(Math.hypot(sample.x - previous.x, sample.y - previous.y)).toBeLessThan(0.012);
            previous = { ...sample };
        }
    });

    it('emits only for a visible focus, charged route, or successful pair; never celebrates a miss', () => {
        const props: Parameters<typeof getRimParticleMood>[0] = {
            tile: makeTile('a', 'a', 'A'), faceUp: false, resolvingSelection: null,
            interactionSuppressed: false, pickable: true, keyboardFocused: false,
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } }
        };
        expect(getRimParticleMood(props)).toBeNull();
        expect(getRimParticleMood({ ...props, keyboardFocused: true })).toBe('focus');
        expect(getRimParticleMood({ ...props, hoverTiltRef: { current: { tileId: 'a', x: 0, y: 0 } } })).toBe('focus');
        expect(getRimParticleMood({ ...props, traitRouteReadabilityIntensity: 'surge' })).toBe('charge');
        expect(getRimParticleMood({ ...props, faceUp: true, resolvingSelection: 'match' })).toBe('match');
        expect(getRimParticleMood({ ...props, keyboardFocused: true, resolvingSelection: 'mismatch' })).toBeNull();
        expect(getRimParticleMood({ ...props, keyboardFocused: true, interactionSuppressed: true })).toBeNull();
        expect(getRimParticleMood({ ...props, tile: { ...props.tile, state: 'removed' }, keyboardFocused: true })).toBeNull();
        expect(getRimParticleMood({ ...props, tile: { ...props.tile, state: 'matched' }, faceUp: true })).toBeNull();
    });
});
