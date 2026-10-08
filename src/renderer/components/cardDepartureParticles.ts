import type { GraphicsQualityPreset, TileSuit } from '../../shared/contracts';
import type { BoardParticleBurst, BoardParticleShape } from './boardParticleSystem';
import { CARD_DISSOLVE_EDGE } from './cardDissolveMaterial';
import { ELEMENT_CARD_MOTE } from './realmParticles';
import { BREAK_DEPARTURE_SECONDS } from './tileBoardFramePulseState';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';

/**
 * A card leaving the board throws off what it is made of (2026-10-09), while its face breaks up
 * its element's way (`cardDissolveMaterial.ts`): fire sheds flames that lick upward, water drops
 * that fall, ice shards that drift out turning, growth petals and a leaf that drift down. One burst
 * per shape, each a few motes, at event priority so ambient weather cannot crowd it out.
 */
export const CARD_DEPARTURE_SHAPES: Readonly<Record<TileSuit, readonly BoardParticleShape[]>> = {
    ember: ['flame', 'flame'],
    tide: ['droplet', 'droplet', 'droplet'],
    bone: ['shard', 'shard', 'shard'],
    moss: ['petal', 'petal', 'leaf']
};

const PETAL_TINT = '#f2d27a';

/** Seconds after the cue that the face starts to break up: halfway through the burst, then a little in. */
export const CARD_DEPARTURE_PARTICLE_DELAY = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.default * 0.5 + BREAK_DEPARTURE_SECONDS * 0.2;

/** The match sparks take the element's colour; a card with none keeps the warm default. */
export const cardDepartureSparkTint = (suit: TileSuit | undefined): string | undefined => suit ? CARD_DISSOLVE_EDGE[suit] : undefined;

export const cardDepartureBursts = ({ suit, x, y, z, seed, time, delay, quality, reduceMotion }: {
    suit: TileSuit | undefined;
    x: number;
    y: number;
    z: number;
    seed: number;
    time: number;
    /** The cue's own delay (a break wave's), before the burst. */
    delay: number;
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
}): BoardParticleBurst[] => {
    if (!suit || reduceMotion) return [];
    return CARD_DEPARTURE_SHAPES[suit].map((shape, index): BoardParticleBurst => ({
        kind: 'ember',
        shape,
        x,
        y,
        z,
        seed: seed + index * 7919,
        time,
        delay: delay + CARD_DEPARTURE_PARTICLE_DELAY + index * 0.04,
        reduceMotion,
        quality,
        energy: 1,
        tint: shape === 'petal' ? PETAL_TINT : ELEMENT_CARD_MOTE[suit].tint,
        sizeScale: shape === 'flame' ? 0.8 : shape === 'droplet' ? 1.1 : 1.35,
        priority: 'event'
    }));
};
