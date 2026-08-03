import { describe, expect, it } from 'vitest';

import { type BoardState, type RunShopOfferState, type RunState, type Tile } from './contracts';
import { revealDungeonExit, revealDungeonShop } from './dungeon-reveal-rules';
import { EXIT_PAIR_KEY, SHOP_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden'
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: 1,
    columns: 2,
    rows: 1,
    tiles,
    flippedTileIds: [],
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

const existingOffer = { id: 'offer-1' } as RunShopOfferState;

const run = (b: BoardState, overrides: Partial<RunState> = {}): RunState =>
    ({
        status: 'playing',
        board: b,
        shopOffers: [existingOffer],
        ...overrides
    }) as RunState;

describe('dungeon reveal rules', () => {
    it('reveals a dungeon exit tile', () => {
        const b = board([tile('exit', EXIT_PAIR_KEY)]);

        const revealed = revealDungeonExit(run(b), 'exit');

        expect(revealed.board?.tiles[0]).toMatchObject({
            id: 'exit',
            state: 'flipped',
            dungeonCardState: 'revealed'
        });
    });

    it('reveals a dungeon shop tile and preserves existing offers', () => {
        const b = board([tile('shop', SHOP_PAIR_KEY)]);

        const revealed = revealDungeonShop(run(b), 'shop');

        expect(revealed.board?.dungeonShopVisited).toBe(true);
        expect(revealed.shopOffers).toEqual([existingOffer]);
        expect(revealed.board?.tiles[0]).toMatchObject({
            id: 'shop',
            state: 'flipped',
            dungeonCardState: 'resolved'
        });
    });

    it('normalizes malformed shop offers before creating revealed shop stock', () => {
        const b = board([tile('shop', SHOP_PAIR_KEY)]);

        const revealed = revealDungeonShop(
            run(b, { shopOffers: Number.NaN as unknown as RunState['shopOffers'] }),
            'shop'
        );

        expect(revealed.board?.dungeonShopVisited).toBe(true);
        expect(revealed.shopOffers.length).toBeGreaterThan(0);
    });

    it('ignores non-matching tiles', () => {
        const current = run(board([tile('plain', 'A')]));

        expect(revealDungeonExit(current, 'plain')).toBe(current);
        expect(revealDungeonShop(current, 'plain')).toBe(current);
    });
});
