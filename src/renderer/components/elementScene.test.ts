import { describe, expect, it } from 'vitest';
import type { ElementReactionImpact, RealmId } from '../../shared/contracts';
import { ELEMENT_REACTIONS, ELEMENT_REACTION_KINDS } from '../../shared/element-resonance-rules';
import { SUIT_REALM } from '../../shared/realm-sway-rules';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import { deriveElementScene, ELEMENT_SCENE_KINDS, ELEMENT_SCENE_SUITS } from './elementScene';

const run = () => makeRun([...makePair('a', 'A'), ...makePair('b', 'B')]);
const realms: RealmId[] = ['ember', 'tide', 'frost', 'grove', 'storm'];
const active = (state: ReturnType<typeof deriveElementScene>) => state.reactions.filter(r => r.weight > 0);

describe('every element changes the painted world', () => {
    it.each(realms.flatMap(from => realms.map(to => [from, to] as const)))('%s + %s has a complete confluence and directional transition', (from, to) => {
        const mixture = deriveElementScene({ ...run(), realmId: from, realmSecondaryId: to });
        const change = deriveElementScene({ ...run(), realmId: to,
            lastRealmEvent: { key: 'tip', kind: 'reaction', from, to, tileIds: [], gold: 0 } });
        if (from === to) {
            expect(active(mixture)).toHaveLength(0);
            expect(from === 'storm' ? mixture.storm : Math.max(...Object.values(mixture.elements))).toBeGreaterThan(0);
        } else {
            expect(active(mixture)).toHaveLength(1);
            expect(active(change).map(r => r.kind)).toEqual(active(mixture).map(r => r.kind));
        }
        for (const layer of mixture.reactions) {
            expect(layer.opacity).toBeGreaterThanOrEqual(0);
            expect(layer.opacity).toBeLessThanOrEqual(1);
        }
    });
    it.each(ELEMENT_REACTION_KINDS)('uses the committed %s receipt immediately, including ground-only chemistry', kind => {
        const r = run();
        const reaction: ElementReactionImpact = { kind, scope: 'ground', potency: 8, sourceCells: [0], changes: [], gold: 0, score: 0, stillTurns: 1, resonanceGain: 0 };
        r.board!.elementCast = { key: kind, suit: ELEMENT_REACTIONS[kind].elements[0], sourceCells: [0], contacts: [], power: 2, multiplier: 1, groupPairs: 1, reaction: kind, detail: '', reactions: [reaction] };
        const world = deriveElementScene(r);
        expect(world.reactions.find(r => r.kind === kind)!.weight).toBeGreaterThan(0.7);
        expect(world.pulseKinds).toContain(kind);
        expect(world.pulseKey).toContain(kind);
        const restored = deriveElementScene(structuredClone(r));
        expect(restored).toEqual(world);
    });
    it('composes every coexisting ground combination and responds to replacement and floor reset', () => {
        const r = run();
        r.board!.elementalGround = [...ELEMENT_SCENE_SUITS];
        expect(active(deriveElementScene(r)).map(r => r.kind)).toEqual(ELEMENT_REACTION_KINDS);
        r.board!.elementalGround = ['ember', 'ember', 'ember', 'ember'];
        expect(active(deriveElementScene(r))).toHaveLength(0);
        r.board!.tiles[0] = { ...r.board!.tiles[0]!, frost: 1 };
        expect(active(deriveElementScene(r)).map(r => r.kind)).toEqual(['melt']);
        expect(active(deriveElementScene(run()))).toHaveLength(0);
    });
    it('keeps all overlapping reactions bounded and does not mutate the run', () => {
        const r = run();
        r.realmId = 'storm';
        r.board!.elementalGround = [...ELEMENT_SCENE_SUITS];
        const saved = structuredClone(r);
        const result = deriveElementScene(r);
        expect(active(result)).toHaveLength(ELEMENT_SCENE_KINDS.length);
        expect(result.reactions.reduce((sum, r) => sum + r.weight, 0)).toBeCloseTo(0.94);
        expect(r).toEqual(saved);
    });
    it.each(ELEMENT_SCENE_SUITS)('same-element %s casts and sway increase their own material', suit => {
        const base = run();
        const quiet = deriveElementScene({ ...base, realmId: SUIT_REALM[suit] });
        const charged = deriveElementScene({ ...base, realmId: SUIT_REALM[suit], elementResonance: { [suit]: 20 }, realmSway: { [suit]: 4 } });
        expect(charged.elements[suit]).toBeGreaterThan(quiet.elements[suit]);
        expect(active(charged)).toHaveLength(0);
    });
});
