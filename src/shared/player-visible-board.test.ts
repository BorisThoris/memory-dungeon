import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { playerVisibleBoard, playerVisibleTile } from './player-visible-board';
import { anchorMarkedTileId } from './n-back-anchor-rules';
import { getSelectedTraitFollowupTileIds } from './trait-opportunities';

const card = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({ id, pairKey, symbol: pairKey, label: pairKey, state: 'hidden', suit: 'ember', ...extra });

/** What a face-down card shows: everything but which card it is and its face (symbol, label, art variant). */
const backOf = (tile: Tile): string => {
    const { id: _id, pairKey: _pairKey, symbol: _symbol, label: _label, atomicVariant: _art, ...shown } = tile;
    return JSON.stringify(shown, Object.keys(shown).sort());
};

describe('the board the player can see', () => {
    it('strips pickups, traits and odd cards off face-down cards, and keeps them on faces', () => {
        const hidden = card('a-A', 'a', { findableKind: 'meteor_shard', tileTraitKind: 'heavy', hourglass: 4 });
        expect(playerVisibleTile(hidden)).toEqual(card('a-A', 'a'));
        const flipped = { ...hidden, state: 'flipped' as const };
        expect(playerVisibleTile(flipped)).toBe(flipped);
    });

    it('shows a face-down Turncoat in the element it was dealt, with no badge', () => {
        const turncoat = card('t-A', 't', { suit: 'tide', turncoat: 'moss', turncoatDealt: 'ember' });
        expect(playerVisibleTile(turncoat)).toEqual(card('t-A', 't', { suit: 'ember' }));
    });

    it('on real generated floors, no face-down card shows anything its own suit-mates do not', () => {
        for (const level of [4, 6, 8, 11]) {
            for (let seed = 1; seed <= 8; seed += 1) {
                const board: BoardState = playerVisibleBoard(buildBoard(level, { runSeed: seed * 7919, runRulesVersion: GAME_RULES_VERSION }));
                // Every face-down back of one suit looks the same (the realm's marks aside, which a
                // fresh floor has none of): no back singles out a pair.
                const backsBySuit = new Map<string, Set<string>>();
                for (const tile of board.tiles.filter((t) => t.state === 'hidden')) {
                    const key = tile.suit ?? 'none';
                    backsBySuit.set(key, (backsBySuit.get(key) ?? new Set()).add(backOf(tile)));
                }
                for (const [suit, backs] of backsBySuit) {
                    expect(backs.size, `floor ${level} seed ${seed}, ${suit}: ${[...backs].join(' | ')}`).toBe(1);
                }
            }
        }
    });

    it('never marks the face-down mate of a flipped trait card', () => {
        const board = {
            tiles: [card('c-A', 'c', { tileTraitKind: 'conduit', state: 'flipped' }), card('c-B', 'c', { tileTraitKind: 'conduit' })],
            flippedTileIds: ['c-A']
        } as unknown as BoardState;
        expect(getSelectedTraitFollowupTileIds(board).size).toBe(0);
    });

    it('keeps the anchor on the same card: turning it never moves the mark to its partner', () => {
        const tiles = [card('n-B', 'n'), card('n-A', 'n')];
        const board = { tiles } as unknown as BoardState;
        expect(anchorMarkedTileId(board, 'n')).toBe('n-A');
        const turned = { tiles: [tiles[0]!, { ...tiles[1]!, state: 'flipped' as const }] } as unknown as BoardState;
        expect(anchorMarkedTileId(turned, 'n')).toBeNull();
    });
});
