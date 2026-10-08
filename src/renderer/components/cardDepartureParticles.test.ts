import { describe, expect, it } from 'vitest';
import { TILE_SUITS } from '../../shared/tile-suit-rules';
import { CARD_DEPARTURE_PARTICLE_DELAY, cardDepartureBursts, cardDepartureSparkTint } from './cardDepartureParticles';

const base = { x: 0, y: 0, z: 0.04, seed: 11, time: 3, delay: 0, quality: 'high' as const, reduceMotion: false };

describe('card departure particles', () => {
    it('throws off each element as its own material, once the face starts to break up', () => {
        const shapes = TILE_SUITS.map((suit) => cardDepartureBursts({ ...base, suit }).map((burst) => burst.shape).join());
        expect(new Set(shapes).size).toBe(TILE_SUITS.length);
        expect(cardDepartureBursts({ ...base, suit: 'ember' }).every((burst) => burst.shape === 'flame')).toBe(true);
        for (const burst of cardDepartureBursts({ ...base, suit: 'tide', delay: 0.3 })) {
            expect(burst.delay).toBeGreaterThanOrEqual(0.3 + CARD_DEPARTURE_PARTICLE_DELAY);
            expect(burst.priority).toBe('event');
        }
    });

    it('throws nothing for a card without an element, or with motion reduced', () => {
        expect(cardDepartureBursts({ ...base, suit: undefined })).toEqual([]);
        expect(cardDepartureBursts({ ...base, suit: 'moss', reduceMotion: true })).toEqual([]);
        expect(cardDepartureSparkTint(undefined)).toBeUndefined();
        expect(cardDepartureSparkTint('moss')).toMatch(/^#/);
    });
});
