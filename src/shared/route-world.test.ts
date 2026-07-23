import { describe, expect, it } from 'vitest';

import type { RouteWorldProfile, Tile } from './contracts';
import { assignRouteWorldSpecials, deriveRouteWorldProfile } from './route-world';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: id,
    label: id,
    atomicVariant: 0
});

const profile: RouteWorldProfile = {
    routeType: 'safe',
    intensity: 'safe',
    choiceId: 'safe-1',
    sourceLevel: 2,
    targetLevel: 3,
    hazardBudget: 0,
    rewardBudget: 1,
    safetyBudget: 1,
    informationBudget: 0,
    routeSpecialKinds: ['guard_cache', 'lantern_ward'],
    summary: 'test profile'
};

describe('route world rules', () => {
    it('derives route-world profiles for matching target floors', () => {
        expect(
            deriveRouteWorldProfile({
                plan: { choiceId: 'greed-1', routeType: 'greed', sourceLevel: 2, targetLevel: 3 },
                level: 3,
                floorTag: 'normal',
                floorArchetypeId: null,
                mutators: []
            })
        ).toMatchObject({
            routeType: 'greed',
            targetLevel: 3,
            routeSpecialKinds: ['greed_cache', 'greed_toll', 'fragile_cache', 'catalyst_altar']
        });

        expect(
            deriveRouteWorldProfile({
                plan: { choiceId: 'greed-1', routeType: 'greed', sourceLevel: 2, targetLevel: 4 },
                level: 3,
                floorTag: 'normal',
                floorArchetypeId: null,
                mutators: []
            })
        ).toBeNull();
    });

    it('assigns route-world specials deterministically without touching forbidden pairs', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b'), tile('exit', '__exit__')];
        const assigned = assignRouteWorldSpecials({
            tiles,
            profile,
            runSeed: 7,
            rulesVersion: 29,
            level: 3,
            forbiddenPairKeys: ['__exit__']
        });
        const repeat = assignRouteWorldSpecials({
            tiles,
            profile,
            runSeed: 7,
            rulesVersion: 29,
            level: 3,
            forbiddenPairKeys: ['__exit__']
        });

        expect(assigned).toEqual(repeat);
        expect(assigned.filter((candidate) => candidate.routeSpecialKind != null).map((candidate) => candidate.pairKey).sort()).toEqual([
            'a',
            'a',
            'b',
            'b'
        ]);
        const exitTile = assigned.find((candidate) => candidate.pairKey === '__exit__');
        expect(exitTile).not.toHaveProperty('routeCardKind');
        expect(exitTile).not.toHaveProperty('routeSpecialKind');
    });
});
