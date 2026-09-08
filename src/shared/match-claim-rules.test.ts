import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { createMatchedPairClaimBoard, deriveMatchClaimContext } from './match-claim-rules';
import { WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey = 'A', extra: Partial<Tile> = {}): Tile => ({
    id,
    label: id.toUpperCase(),
    pairKey,
    state: 'flipped',
    symbol: id.toUpperCase(),
    ...extra
});

const boardWith = (tiles: Tile[]): BoardState => ({
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: tiles.map((t) => t.id),
    floorArchetypeId: null,
    level: 2,
    matchedPairs: 0,
    pairCount: 1,
    rows: 1,
    tiles
});

describe('match claim rules', () => {
    it('derives findable rewards for a matched pair', () => {
        const first = tile('a1', 'A', { findableKind: 'score_glint' });
        const second = tile('a2', 'A');

        const context = deriveMatchClaimContext(first, second);

        expect(context.claimedFindableKind).toBe('score_glint');
        expect(context.findableScoreBonus).toBe(25);
        expect(context.findablesClaimedDelta).toBe(1);
        expect(context.matchedPairKey).toBe('A');
        expect(context.usedWild).toBe(false);
    });

    it('claims nothing from a plain pair', () => {
        const context = deriveMatchClaimContext(tile('a1'), tile('a2'));

        expect(context.claimedFindableKind).toBeNull();
        expect(context.findableComboShardGain).toBe(0);
        expect(context.findableSafeHazardWardGain).toBe(0);
        expect(context.findableScoreBonus).toBe(0);
        expect(context.findablesClaimedDelta).toBe(0);
    });

    it('uses the non-wild pair key and reports wild usage when one matched tile is wild', () => {
        const first = tile('wild', WILD_PAIR_KEY);
        const second = tile('b1', 'B');

        const context = deriveMatchClaimContext(first, second);

        expect(context.matchedPairKey).toBe('B');
        expect(context.usedWild).toBe(true);
    });

    it('normalizes malformed board counters while claiming a matched pair', () => {
        const first = tile('a1');
        const second = tile('a2');
        const board = { ...boardWith([first, second]), matchedPairs: Number.NaN };

        const nextBoard = createMatchedPairClaimBoard({
            board,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(nextBoard.matchedPairs).toBe(1);
    });

    it('creates the matched-pair board claim and clears the claimed findable', () => {
        const first = tile('a1', 'A', { findableKind: 'score_glint' });
        const second = tile('a2', 'A');
        const board = boardWith([first, second]);

        const nextBoard = createMatchedPairClaimBoard({
            board,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(nextBoard.flippedTileIds).toEqual([]);
        expect(nextBoard.matchedPairs).toBe(1);
        expect(nextBoard.tiles[0]).toMatchObject({ id: 'a1', state: 'matched' });
        expect(nextBoard.tiles[0]!.findableKind).toBeUndefined();
        expect(nextBoard.tiles[1]).toMatchObject({ id: 'a2', state: 'matched' });
    });

    it('hides a gambit third tile again unless it has already left the board', () => {
        const first = tile('a1');
        const second = tile('a2');
        const ordinaryThird = tile('b1', 'B');
        const goneThird = tile('c1', 'C', { state: 'removed' });
        const board = boardWith([first, second, ordinaryThird, goneThird]);

        const hiddenThirdBoard = createMatchedPairClaimBoard({
            board,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: ordinaryThird.id
        });
        const goneThirdBoard = createMatchedPairClaimBoard({
            board,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: goneThird.id
        });

        expect(hiddenThirdBoard.tiles.find((t) => t.id === ordinaryThird.id)?.state).toBe('hidden');
        expect(goneThirdBoard.tiles.find((t) => t.id === goneThird.id)?.state).toBe('removed');
    });
});
