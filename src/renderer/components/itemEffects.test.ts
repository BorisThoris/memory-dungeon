import { afterEach, describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    ITEM_EFFECT_TRAUMA,
    METEOR_IMPACT_DELAY_SECONDS,
    itemEffectRecipe,
    itemEffectsFromEvents,
    publishItemEffects,
    useItemEffectChannel,
    type ItemEffectKind
} from './itemEffects';
import { sampleTraumaShake, setScreenShakeIntensity } from './boardTrauma';

const card = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({ id, pairKey, symbol: pairKey, label: pairKey, state });
const board = (tiles: Tile[], extra: Partial<BoardState> = {}): BoardState => ({ tiles, columns: 2, rows: tiles.length / 2, flippedTileIds: [], ...extra }) as unknown as BoardState;
const event = (type: string, fields: Record<string, unknown>): GameplayEvent => ({ eventId: `e:${type}`, commandId: 'c', sequence: 0, schemaVersion: 1, source: {}, type, ...fields }) as unknown as GameplayEvent;
const at = (x: number) => ({ x, y: 0, z: 0.04 });

describe('item effects', () => {
    afterEach(() => setScreenShakeIntensity(1));

    it('reads each item off the journal event the rules wrote for it', () => {
        const before = board([card('a-A', 'a', 'flipped'), card('a-B', 'a'), card('b-A', 'b'), card('b-B', 'b')]);
        const after = board(before.tiles, { meteorImpact: { key: 1, cell: 2, radius: 1, cards: 3 } });
        const effects = itemEffectsFromEvents(
            [
                event('board.bombed', { targetTileId: 'a-A', pairKey: 'a' }),
                event('board.tiles_swapped', { firstTileId: 'a-B', secondTileId: 'b-A' }),
                event('board.peeked', { targetTileId: 'b-B' }),
                event('feedback.requested', { cue: 'power.meteor.used', message: 'm', tone: 'information' }),
                event('score.changed', {})
            ],
            before,
            after
        );
        expect(effects.map((effect) => effect.kind)).toEqual(['bomb', 'swap', 'peek', 'meteor']);
        // A bomb takes the card and its twin: both burst.
        expect(effects[0]!.tileIds).toEqual(['a-A', 'a-B']);
        expect(effects[3]!.cell).toBe(2);
    });

    it('a bomb is a shockwave, a blast, fire, sparks and smoke at each card it took', () => {
        const { bursts, arcs } = itemEffectRecipe({ effect: { key: 'k', kind: 'bomb', tileIds: ['a', 'b'] }, anchors: [at(0), at(1)], time: 3, quality: 'high', reduceMotion: false });
        expect(bursts.filter((burst) => burst.kind === 'ripple')).toHaveLength(2);
        expect(bursts.filter((burst) => burst.kind === 'bomb')).toHaveLength(2);
        expect(new Set(bursts.filter((burst) => burst.kind === 'ember').map((burst) => burst.shape))).toEqual(new Set(['flame', 'spark', 'vapor']));
        expect(arcs).toHaveLength(1);
        // Item effects are events: weather and ambient sparks never crowd them out.
        expect(bursts.every((burst) => burst.priority === 'event')).toBe(true);
    });

    it('a meteor lands when its strike does, with two shockwaves and thrown rock', () => {
        const { bursts } = itemEffectRecipe({ effect: { key: 'k', kind: 'meteor', tileIds: [], cell: 0 }, anchors: [at(0)], time: 0, quality: 'medium', reduceMotion: false });
        expect(bursts.filter((burst) => burst.kind === 'ripple')).toHaveLength(2);
        expect(bursts.some((burst) => burst.shape === 'shard')).toBe(true);
        expect(Math.min(...bursts.map((burst) => burst.delay ?? 0))).toBeCloseTo(METEOR_IMPACT_DELAY_SECONDS);
    });

    it('a crucible melts its pair the way its element breaks, then runs the new element across every card it recast', () => {
        const [effect] = itemEffectsFromEvents(
            [event('board.transmuted', { targetTileId: 'a-A', meltedTileIds: ['a-A', 'a-B'], recastTileIds: ['c-A', 'c-B', 'd-A', 'd-B'], fromSuit: 'ember', toSuit: 'bone' })],
            null,
            null
        );
        expect(effect).toMatchObject({ kind: 'crucible', tileIds: ['a-A', 'a-B', 'c-A', 'c-B', 'd-A', 'd-B'], melt: { from: 'ember', to: 'bone', meltedCount: 2 } });
        const { bursts, arcs } = itemEffectRecipe({ effect: effect!, anchors: [0, 1, 2, 3, 4, 5].map(at), time: 0, quality: 'high', reduceMotion: false });
        const melt = bursts.filter((burst) => burst.x <= 1);
        const recast = bursts.filter((burst) => burst.x >= 2);
        // The melt breaks up as fire (the element melted), the recast comes in as frost shards.
        expect(melt.some((burst) => burst.shape === 'flame' && burst.tint === '#ff8a2a')).toBe(true);
        expect(recast.some((burst) => burst.shape === 'shard' && burst.tint === '#e8f6ff')).toBe(true);
        // A wave: each recast card lights a little after the one before, after the melt.
        const firstDelay = (x: number) => Math.min(...recast.filter((burst) => burst.x === x).map((burst) => burst.delay ?? 0));
        expect(firstDelay(2)).toBeGreaterThan(0);
        expect(firstDelay(5)).toBeGreaterThan(firstDelay(2));
        expect(arcs).toHaveLength(4);
        expect(ITEM_EFFECT_TRAUMA.crucible).toBeGreaterThan(ITEM_EFFECT_TRAUMA.swap);
        expect(ITEM_EFFECT_TRAUMA.crucible).toBeLessThan(ITEM_EFFECT_TRAUMA.bomb);
    });

    it('a storm glass shatters over every card the storm reached, in the realm\u2019s light, a bolt running card to card', () => {
        const [effect] = itemEffectsFromEvents(
            [event('realm.weather_called', { realmId: 'storm', weatherKind: 'thunderclap', touchedTileIds: ['a-A', 'b-A', 'c-A'], litTileIds: ['a-A', 'b-A', 'c-A'] })],
            null,
            null
        );
        expect(effect).toMatchObject({ kind: 'storm_glass', tileIds: ['a-A', 'b-A', 'c-A'], realm: 'storm' });
        const { bursts, arcs } = itemEffectRecipe({ effect: effect!, anchors: [0, 1, 2].map(at), time: 0, quality: 'high', reduceMotion: false });
        expect(bursts.some((burst) => burst.shape === 'shard' && burst.tint === '#e6f6ff')).toBe(true);
        expect(bursts.some((burst) => burst.shape === 'spark' && burst.tint === '#b69bff')).toBe(true);
        expect(arcs).toHaveLength(2);
        expect(ITEM_EFFECT_TRAUMA.storm_glass).toBeGreaterThan(ITEM_EFFECT_TRAUMA.crucible);
        expect(ITEM_EFFECT_TRAUMA.storm_glass).toBeLessThan(ITEM_EFFECT_TRAUMA.meteor);
    });

    it('taking up the purse spills coins over the face-down cards, gently', () => {
        const after = board([card('a-A', 'a'), card('a-B', 'a', 'matched'), card('b-A', 'b')]);
        const [effect] = itemEffectsFromEvents([event('run.relic_taken', { relicId: 'misers_purse', missesBefore: 4, missesAfter: 3 })], after, after);
        expect(effect).toMatchObject({ kind: 'misers_purse', tileIds: ['a-A', 'b-A'] });
        const { bursts } = itemEffectRecipe({ effect: effect!, anchors: [0, 1].map(at), time: 0, quality: 'high', reduceMotion: false });
        expect(bursts.some((burst) => burst.shape === 'shard' && burst.tint === '#ffd56a')).toBe(true);
        expect(ITEM_EFFECT_TRAUMA.misers_purse).toBeLessThan(ITEM_EFFECT_TRAUMA.crucible);
    });

    it('the big items shake hardest, the quiet ones not at all', () => {
        expect(ITEM_EFFECT_TRAUMA.meteor).toBeGreaterThan(ITEM_EFFECT_TRAUMA.bomb);
        expect(ITEM_EFFECT_TRAUMA.bomb).toBeGreaterThan(ITEM_EFFECT_TRAUMA.shuffle);
        for (const kind of ['peek', 'pin'] as ItemEffectKind[]) expect(ITEM_EFFECT_TRAUMA[kind]).toBe(0);
        for (const value of Object.values(ITEM_EFFECT_TRAUMA)) expect(value).toBeLessThanOrEqual(1);
    });

    it('the Screen shake setting scales every shake, and at zero there is none', () => {
        const full = sampleTraumaShake({ seconds: 0.37, trauma: 0.8 });
        setScreenShakeIntensity(0.5);
        const half = sampleTraumaShake({ seconds: 0.37, trauma: 0.8 });
        expect(half.offsetX).toBeCloseTo(full.offsetX / 2);
        setScreenShakeIntensity(0);
        expect(sampleTraumaShake({ seconds: 0.37, trauma: 0.8 }).offsetX).toBe(0);
    });

    it('publishes on a channel the board reads', () => {
        const serial = useItemEffectChannel.getState().serial;
        publishItemEffects([]);
        expect(useItemEffectChannel.getState().serial).toBe(serial);
        publishItemEffects([{ key: 'x', kind: 'pin', tileIds: ['a'] }]);
        expect(useItemEffectChannel.getState().serial).toBe(serial + 1);
        expect(useItemEffectChannel.getState().latest[0]!.kind).toBe('pin');
    });
});
