import { describe, expect, it } from 'vitest';
import { type BoardState, type RunState, type Tile } from './contracts';
import { buildBoard } from './board-generation';
import { inspectBoardFairness, isBoardComplete } from './board-inspection';
import { cardsBeneath, dealLayers, LAYERS_COVER, LAYERS_RULES_FROM, layerKeyOf, promoteBeneath } from './board-layers-rules';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const SEED = 2525;
const dealt = (level: number, rulesVersion = CLASSIC_DESCENT_RULES): BoardState =>
    dealLayers(buildBoard(level, { runSeed: SEED, runRulesVersion: rulesVersion, gameMode: 'endless', activeMutators: [] }), { runSeed: SEED, rulesVersion });
const lower = (board: BoardState): Tile[] => (board.beneath ?? []).filter((card): card is Tile => card != null);

describe('Layers (DGE-017)', () => {
    it('deals a second deck under two cells in five of the Deep, and nowhere else', () => {
        const board = dealt(25);
        const cards = lower(board);
        expect(cards.length).toBe(2 * Math.floor((board.tiles.length * LAYERS_COVER) / 2));
        expect(board.beneath).toHaveLength(board.tiles.length);
        expect(cardsBeneath(dealt(24))).toBe(0);
        expect(cardsBeneath(dealt(41))).toBe(0);
        expect(cardsBeneath(dealt(25, LAYERS_RULES_FROM - 1))).toBe(0);
        // Its own pairs, two elements, faces the top deck does not show, all of it face down.
        const byPair = new Map<string, number>();
        for (const card of cards) byPair.set(card.pairKey, (byPair.get(card.pairKey) ?? 0) + 1);
        expect([...byPair.values()].every((n) => n === 2)).toBe(true);
        expect(new Set(cards.map((card) => card.suit)).size).toBeLessThanOrEqual(2);
        const topFaces = new Set(board.tiles.map((tile) => tile.symbol));
        expect(cards.some((card) => topFaces.has(card.symbol))).toBe(false);
        expect(cards.every((card) => card.state === 'hidden')).toBe(true);
        // Both decks count, and the floor's key names every id it was dealt.
        const top = buildBoard(25, { runSeed: SEED, runRulesVersion: CLASSIC_DESCENT_RULES, gameMode: 'endless', activeMutators: [] });
        expect(board.pairCount).toBe(top.pairCount + byPair.size);
        expect(board.layerKey).toBe(layerKeyOf(board.tiles, board.beneath!));
        expect(inspectBoardFairness(board).issues ?? []).toEqual([]);
    });

    it('a cleared cell takes the card beneath it, face down, with the id it was dealt; a held one waits', () => {
        const board = dealt(25);
        const cell = board.beneath!.findIndex(Boolean);
        const otherPairKey = board.tiles.find((tile, index) => board.beneath![index] != null && tile.pairKey !== board.tiles[cell]!.pairKey)!.pairKey;
        const other = board.tiles.findIndex((tile, index) => tile.pairKey === otherPairKey && board.beneath![index] != null);
        const below = board.beneath![cell]!;
        // Two whole pairs cleared: the one over `cell`, and one the Hold keeps.
        const clearedKeys = new Set([board.tiles[cell]!.pairKey, otherPairKey]);
        const cleared: BoardState = {
            ...board,
            matchedPairs: 2,
            tiles: board.tiles.map((tile) => (clearedKeys.has(tile.pairKey) ? { ...tile, state: 'matched' as const } : tile))
        };
        const held = board.tiles[other]!.id;
        const risen = promoteBeneath(cleared, new Set([held]));
        expect(risen.tiles[cell]).toEqual(below);
        expect(risen.beneath![cell]).toBeNull();
        expect(risen.tiles[other]!.state).toBe('matched');
        expect(risen.beneath![other]).not.toBeNull();
        // Promotion never deals anything new: the floor's key stands.
        expect(layerKeyOf(risen.tiles, risen.beneath!)).not.toBe(board.layerKey);
        expect(risen.layerKey).toBe(board.layerKey);
        // A half-risen lower pair is still a pair to the inspector.
        expect(inspectBoardFairness(risen).issues ?? []).toEqual([]);
    });

    it('unlocks a floor where every card face down waits for a partner still beneath', () => {
        // Two cards over each other's partners, everything else cleared: neither can ever be matched.
        const card = (id: string, pairKey: string): Tile => ({ id, pairKey, symbol: pairKey, label: pairKey, state: 'hidden', suit: 'bone' });
        const gone = (id: string): Tile => ({ ...card(id, 'gone'), state: 'matched' });
        const locked = {
            level: 25,
            columns: 3,
            rows: 2,
            pairCount: 3,
            matchedPairs: 1,
            flippedTileIds: [],
            tiles: [card('p-A', 'p'), gone('g-A'), gone('g-B'), card('q-A', 'q'), { ...gone('x'), state: 'removed' as const }, { ...gone('y'), state: 'removed' as const }],
            beneath: [card('q-B', 'q'), null, null, card('p-B', 'p'), null, null]
        } as unknown as BoardState;
        const freed = promoteBeneath(locked);
        const faceDown = freed.tiles.filter((tile) => tile.state === 'hidden').map((tile) => tile.pairKey);
        expect(faceDown.filter((key) => key === 'p').length === 2 || faceDown.filter((key) => key === 'q').length === 2).toBe(true);
        expect(cardsBeneath(freed)).toBe(1);
    });

    it('is not complete while anything waits beneath', () => {
        const board = dealt(25);
        const allCleared: BoardState = { ...board, tiles: board.tiles.map((tile) => ({ ...tile, state: 'matched' as const })) };
        expect(isBoardComplete(allCleared)).toBe(false);
        expect(isBoardComplete({ ...allCleared, beneath: allCleared.beneath!.map(() => null) })).toBe(true);
    });

    it('a match over a covered cell raises the card beneath into it in the same turn', () => {
        const board = dealt(25);
        const base = finishMemorizePhase(createNewRun(0, { runSeed: SEED, realm: null }));
        let run: RunState = { ...base, status: 'playing', activeMutators: [], board, missBank: [{ floor: 25, misses: 9 }] };
        const covered = board.tiles.find((tile, index) => board.beneath![index] != null && !tile.pairKey.startsWith('__'))!;
        const partner = board.tiles.find((tile) => tile.pairKey === covered.pairKey && tile.id !== covered.id)!;
        const cell = board.tiles.indexOf(covered);
        const below = board.beneath![cell]!;
        run = resolveBoardTurn(flipTile(flipTile(run, covered.id), partner.id));
        expect(run.board!.tiles[cell]!.id).toBe(below.id);
        expect(run.board!.tiles[cell]!.state).toBe('hidden');
        expect(run.layerCardsRisenThisFloor).toBeGreaterThanOrEqual(1);
        expect(inspectBoardFairness(run.board!).issues ?? []).toEqual([]);
    });
});
