import { create } from 'zustand/react';
import type { BoardState, GraphicsQualityPreset } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { hashStringToSeed } from '../../shared/rng';
import type { BoardArcBurst, BoardParticleBurst, BoardParticleShape } from './boardParticleSystem';

/**
 * What using an item looks, feels and sounds like (2026-10-08).
 *
 * The owner: "we need to add actual effects to meteors, bombs, and other items." Before this a bomb
 * and a meteor shook nothing and every tool made the same arming click (`power-arm`). The research
 * behind it (Eiserloh's "Juicing Your Cameras With Math", via the Bevy screen-shake example) says an
 * impact should add **trauma** that decays, with shake as trauma squared or cubed: the board already
 * runs that model (`boardTrauma.ts`), so each item adds its own pulse to it, scaled by the player's
 * screen-shake setting (Xbox accessibility guideline 117: shake must be avoidable or adjustable).
 *
 * Every effect is read off the gameplay journal, the record the rules already write for every
 * command (`board.bombed`, `board.peeked`, `board.tiles_swapped`, ...), so an effect plays exactly
 * when its item was used, through whatever path used it, and never replays on a restore.
 *
 * Each effect is a recipe of the board particle system's own pieces - the shockwave ripple, the
 * blast, element-shaped motes, lightning arcs - so it costs no draw call of its own.
 */
export type ItemEffectKind =
    | 'bomb'
    | 'meteor'
    | 'peek'
    | 'pin'
    | 'shuffle'
    | 'row_shuffle'
    | 'swap'
    | 'flash'
    | 'undo'
    | 'wild'
    | 'gambit';

export interface ItemEffect {
    /** The journal event's id: unique, so an effect plays once. */
    key: string;
    kind: ItemEffectKind;
    /** The cards it acts on, by id; empty for the meteor, which lands on a cell. */
    tileIds: readonly string[];
    /** The meteor's impact cell, from `board.meteorImpact`. */
    cell?: number;
}

/** Trauma each item adds to the board (0..1; shake is trauma cubed, `boardTrauma.ts`). */
export const ITEM_EFFECT_TRAUMA: Readonly<Record<ItemEffectKind, number>> = {
    bomb: 0.62,
    meteor: 0.85,
    peek: 0,
    pin: 0,
    shuffle: 0.22,
    row_shuffle: 0.16,
    swap: 0.12,
    flash: 0.08,
    undo: 0.1,
    wild: 0.25,
    gambit: 0.2
};

const cardsOf = (board: BoardState | null | undefined, tileId: string): string[] => {
    const tile = board?.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || !board) return [tileId];
    return board.tiles.filter((candidate) => candidate.pairKey === tile.pairKey).map((candidate) => candidate.id);
};

/**
 * The item effects among `events` (the journal entries since the last look). `boardBefore` is the
 * board the command acted on, for a bomb's twin; `boardAfter` carries the meteor's impact.
 */
export const itemEffectsFromEvents = (
    events: readonly GameplayEvent[],
    boardBefore: BoardState | null | undefined,
    boardAfter: BoardState | null | undefined
): ItemEffect[] => {
    const effects: ItemEffect[] = [];
    for (const event of events) {
        const key = event.eventId;
        switch (event.type) {
            case 'board.bombed':
                effects.push({ key, kind: 'bomb', tileIds: cardsOf(boardBefore ?? boardAfter, event.targetTileId) });
                break;
            case 'board.peeked':
                effects.push({ key, kind: 'peek', tileIds: [event.targetTileId] });
                break;
            case 'board.pin_changed':
                if (event.pinned) effects.push({ key, kind: 'pin', tileIds: [event.targetTileId] });
                break;
            case 'board.shuffled':
                effects.push({ key, kind: 'shuffle', tileIds: event.affectedTileIds });
                break;
            case 'board.region_shuffled':
                effects.push({ key, kind: 'row_shuffle', tileIds: event.affectedTileIds });
                break;
            case 'board.tiles_swapped':
                effects.push({ key, kind: 'swap', tileIds: [event.firstTileId, event.secondTileId] });
                break;
            case 'board.flash_pair_revealed':
                effects.push({ key, kind: 'flash', tileIds: [...event.revealedTileIds] });
                break;
            case 'board.resolve_undone':
                effects.push({ key, kind: 'undo', tileIds: event.restoredTileIds });
                break;
            case 'wild_match.consumed':
                effects.push({ key, kind: 'wild', tileIds: [event.wildTileId, event.pairedTileId] });
                break;
            case 'board.gambit_commit.requested':
                effects.push({ key, kind: 'gambit', tileIds: [] });
                break;
            case 'feedback.requested':
                if (event.cue === 'power.meteor.used' && boardAfter?.meteorImpact) {
                    effects.push({ key, kind: 'meteor', tileIds: [], cell: boardAfter.meteorImpact.cell });
                }
                break;
            default:
                break;
        }
    }
    return effects;
};

export interface ItemEffectAnchor {
    x: number;
    y: number;
    z: number;
}

/** When a meteor's impact lands in its strike (`MeteorStrike.tsx`: the shader's impact begins at 0.16 of 1.65 s). */
export const METEOR_IMPACT_DELAY_SECONDS = 0.26;
/** The most cards one effect bursts on, so a shuffle of a big board stays inside the particle budget. */
export const ITEM_EFFECT_MAX_CARDS = 12;

/**
 * The bursts and bolts an effect is made of, at the anchors of its cards (or its cell). Pure: the
 * board particle system (`TileBoardParticles`) emits them, and the tests read them.
 */
export const itemEffectRecipe = ({
    effect,
    anchors,
    time,
    quality,
    reduceMotion
}: {
    effect: ItemEffect;
    /** Where each of the effect's cards (or, for the meteor, its cell) stands now. */
    anchors: readonly ItemEffectAnchor[];
    time: number;
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
}): { bursts: BoardParticleBurst[]; arcs: BoardArcBurst[] } => {
    const bursts: BoardParticleBurst[] = [];
    const arcs: BoardArcBurst[] = [];
    const seed = (part: string) => hashStringToSeed(`${effect.key}:${part}`);
    const at = anchors.slice(0, ITEM_EFFECT_MAX_CARDS);
    const base = { time, quality, reduceMotion, priority: 'event' as const };
    const motes = (anchor: ItemEffectAnchor, shape: BoardParticleShape, tint: string, energy: number, part: string, delay = 0, sizeScale = 1): void => {
        bursts.push({ ...base, kind: 'ember', shape, tint, energy, sizeScale, delay, x: anchor.x, y: anchor.y, z: anchor.z, seed: seed(part) });
    };
    const shockwave = (anchor: ItemEffectAnchor, energy: number, part: string, delay = 0): void => {
        bursts.push({ ...base, kind: 'ripple', energy, delay, x: anchor.x, y: anchor.y, z: 0, seed: seed(part) });
    };
    switch (effect.kind) {
        case 'bomb': {
            // A white-hot core, a shockwave on the floor, fire licking up and smoke rolling out.
            at.forEach((anchor, index) => {
                shockwave(anchor, 0.9, `wave${index}`);
                bursts.push({ ...base, kind: 'bomb', energy: 1, x: anchor.x, y: anchor.y, z: anchor.z, seed: seed(`blast${index}`) });
                motes(anchor, 'flame', '#ff8a2a', 1, `fire${index}`, 0.02, 1.4);
                motes(anchor, 'spark', '#fff1c4', 1, `sparks${index}`);
                motes(anchor, 'vapor', '#5b4a44', 0.6, `smoke${index}`, 0.12, 1.3);
            });
            if (at.length === 2) {
                arcs.push({ from: at[0]!, to: at[1]!, seed: seed('link'), time, intensity: 0.7, reduceMotion, quality, tint: '#ffb34b' });
            }
            break;
        }
        case 'meteor': {
            const anchor = at[0];
            if (!anchor) break;
            const delay = METEOR_IMPACT_DELAY_SECONDS;
            // The rock lands: two shockwaves, a crater of fire, molten shards thrown wide, dust.
            shockwave(anchor, 1, 'wave', delay);
            shockwave(anchor, 0.7, 'wave2', delay + 0.12);
            bursts.push({ ...base, kind: 'bomb', energy: 1, delay, x: anchor.x, y: anchor.y, z: anchor.z, seed: seed('blast') });
            motes(anchor, 'flame', '#ff6a1a', 1, 'fire', delay, 1.8);
            motes(anchor, 'shard', '#ffb070', 1, 'rock', delay, 1.6);
            motes(anchor, 'spark', '#fff4d6', 1, 'sparks', delay);
            motes(anchor, 'vapor', '#4a3c38', 0.8, 'dust', delay + 0.18, 1.8);
            break;
        }
        case 'peek':
            // An eye opening: a cool glint and a soft ring.
            at.forEach((anchor, index) => {
                motes(anchor, 'spark', '#9cf2ff', 0.6, `glint${index}`);
                shockwave(anchor, 0.25, `ring${index}`);
            });
            break;
        case 'pin':
            at.forEach((anchor, index) => motes(anchor, 'spark', '#ffd977', 0.5, `pin${index}`));
            break;
        case 'shuffle':
        case 'row_shuffle':
            // The deck is riffled: a gust of vapour through the cards it moved.
            at.forEach((anchor, index) => motes(anchor, 'vapor', '#cfe2ff', 0.4, `gust${index}`, index * 0.025, 0.8));
            break;
        case 'swap':
            if (at.length === 2) {
                arcs.push({ from: at[0]!, to: at[1]!, seed: seed('swap'), time, intensity: 0.55, reduceMotion, quality, tint: '#9cebea' });
            }
            at.forEach((anchor, index) => motes(anchor, 'spark', '#9cebea', 0.6, `swap${index}`));
            break;
        case 'flash':
            at.forEach((anchor, index) => {
                motes(anchor, 'spark', '#ffffff', 0.9, `flash${index}`);
                shockwave(anchor, 0.35, `ring${index}`);
            });
            break;
        case 'undo':
            at.forEach((anchor, index) => motes(anchor, 'vapor', '#b9a7ff', 0.5, `rewind${index}`));
            break;
        case 'wild':
            at.forEach((anchor, index) => {
                motes(anchor, 'petal', '#ff9de6', 0.9, `petals${index}`);
                motes(anchor, 'spark', '#b6f3ff', 0.9, `prism${index}`);
            });
            if (at.length === 2) {
                arcs.push({ from: at[0]!, to: at[1]!, seed: seed('wild'), time, intensity: 0.8, reduceMotion, quality, tint: '#ff9de6' });
            }
            break;
        case 'gambit':
            break;
    }
    return { bursts, arcs };
};

/**
 * The channel the game screen publishes effects on and the board's scene, particles and sound
 * read: a tiny external store, so it reaches inside the 3D canvas without threading a prop through
 * the board's layers (the same shape as `realmAmbience.ts`).
 */
export const useItemEffectChannel = create<{ latest: readonly ItemEffect[]; serial: number }>(() => ({ latest: [], serial: 0 }));

export const publishItemEffects = (effects: readonly ItemEffect[]): void => {
    if (effects.length === 0) return;
    useItemEffectChannel.setState((state) => ({ latest: effects, serial: state.serial + 1 }));
};
