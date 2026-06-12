import { describe, expect, it } from 'vitest';

import {
    SHIFTING_BOUNTY_MATCH_BONUS,
    SHIFTING_WARD_MATCH_PENALTY,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import {
    eligibleSpotlightPairKeys,
    pickShiftingSpotlightKeys,
    rotateAnchorSealPressure,
    rotateRunShiftingSpotlight,
    rotateShiftingSpotlight,
    shiftingSpotlightMatchDelta
} from './shifting-spotlight-rules';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 3,
    pairCount: new Set(tiles.map((t) => t.pairKey).filter((pairKey) => pairKey !== DECOY_PAIR_KEY && pairKey !== WILD_PAIR_KEY)).size,
    columns: 2,
    rows: Math.ceil(tiles.length / 2),
    tiles,
    flippedTileIds: tiles.filter((t) => t.state === 'flipped').map((t) => t.id),
    matchedPairs: 0,
    cursedPairKey: null,
    wardPairKey: null,
    bountyPairKey: null,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    dungeonExitTileId: null,
    dungeonExitActivated: false,
    dungeonExitLockKind: 'none',
    dungeonExitRequiredLeverCount: 0,
    dungeonLeverCount: 0,
    dungeonShopTileId: null,
    dungeonShopVisited: false,
    dungeonBossId: null,
    dungeonObjectiveId: 'find_exit',
    enemyHazards: [],
    enemyHazardTurn: 0,
    ...overrides
});

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        runSeed: 42,
        runRulesVersion: 29,
        activeMutators: ['shifting_spotlight'],
        shiftingSpotlightNonce: 4,
        ...overrides
    }) as RunState;

describe('shifting spotlight rules', () => {
    it('collects only eligible real pairs', () => {
        const b = board([
            tile('a1', 'A'),
            tile('a2', 'A', 'matched'),
            tile('b1', 'B', 'matched'),
            tile('b2', 'B', 'matched'),
            tile('c1', 'C'),
            tile('c2', 'C', 'removed'),
            tile('d', DECOY_PAIR_KEY),
            tile('w', WILD_PAIR_KEY)
        ]);

        expect(eligibleSpotlightPairKeys(b)).toEqual(['A']);
    });

    it('picks deterministic ward and bounty keys from seed, rules, level, and step', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B'), tile('b2', 'B')]);

        expect(pickShiftingSpotlightKeys(b, 10, 29, 2, 'init')).toEqual(
            pickShiftingSpotlightKeys(b, 10, 29, 2, 'init')
        );
        expect(new Set(Object.values(pickShiftingSpotlightKeys(b, 10, 29, 2, 1)))).toEqual(new Set(['A', 'B']));
    });

    it('uses the lone eligible key as bounty without a ward', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A')]);

        expect(pickShiftingSpotlightKeys(b, 10, 29, 2, 'init')).toEqual({
            wardPairKey: null,
            bountyPairKey: 'A'
        });
    });

    it('computes bounty and ward match deltas', () => {
        const b = board([], { bountyPairKey: 'A', wardPairKey: 'B' });

        expect(shiftingSpotlightMatchDelta(b, 'A')).toBe(SHIFTING_BOUNTY_MATCH_BONUS);
        expect(shiftingSpotlightMatchDelta(b, 'B')).toBe(-SHIFTING_WARD_MATCH_PENALTY);
        expect(shiftingSpotlightMatchDelta(b, 'C')).toBe(0);
        expect(shiftingSpotlightMatchDelta(undefined, 'A')).toBe(0);
    });

    it('rotates when mutator is active and board is incomplete', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B'), tile('b2', 'B')]);

        const rotated = rotateShiftingSpotlight(run(), b, () => false);

        expect(rotated.shiftingSpotlightNonce).toBe(5);
        expect(rotated.board).not.toBe(b);
        expect(new Set([rotated.board.wardPairKey, rotated.board.bountyPairKey])).toEqual(new Set(['A', 'B']));
    });

    it('does not rotate without mutator or after completion', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A')], { wardPairKey: 'A', bountyPairKey: null });

        expect(rotateShiftingSpotlight(run({ activeMutators: [] }), b, () => false)).toEqual({
            board: b,
            shiftingSpotlightNonce: 4
        });
        expect(rotateShiftingSpotlight(run(), b, () => true)).toEqual({
            board: b,
            shiftingSpotlightNonce: 4
        });
    });

    it('rotates run shifting spotlight using board completion rules', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B'), tile('b2', 'B')]);

        const rotated = rotateRunShiftingSpotlight(run(), b);

        expect(rotated.shiftingSpotlightNonce).toBe(5);
        expect(rotated.board).not.toBe(b);
        expect(new Set([rotated.board.wardPairKey, rotated.board.bountyPairKey])).toEqual(new Set(['A', 'B']));
    });

    it('uses anchor seal pressure to spend a charge without rotating spotlight', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B'), tile('b2', 'B')], {
            wardPairKey: 'A',
            bountyPairKey: 'B'
        });

        const rotated = rotateAnchorSealPressure(run({ anchorSealChargesThisFloor: 1 }), b);

        expect(rotated).toEqual({
            board: b,
            shiftingSpotlightNonce: 4,
            anchorSealUsed: true
        });
    });

    it('rotates anchor seal pressure normally when no seal charge is available', () => {
        const b = board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B'), tile('b2', 'B')]);

        const rotated = rotateAnchorSealPressure(run({ anchorSealChargesThisFloor: 0 }), b);

        expect(rotated.shiftingSpotlightNonce).toBe(5);
        expect(rotated.anchorSealUsed).toBe(false);
        expect(rotated.board).not.toBe(b);
        expect(new Set([rotated.board.wardPairKey, rotated.board.bountyPairKey])).toEqual(new Set(['A', 'B']));
    });
});
