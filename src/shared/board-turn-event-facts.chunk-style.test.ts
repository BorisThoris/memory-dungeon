import { describe, expect, it } from 'vitest';
import type { RunState, Tile } from './contracts';
import { getBoardTurnAnnouncementFacts } from './board-turn-event-facts';
import { createNewRun, finishMemorizePhase } from './game-core';

/*
 * The style line is read off the two boards, never re-derived from the break rule. A tile that was
 * hidden before and is `removed` by a chunk after is a tile the chunk took; everything the line
 * says comes from those tiles and the matched pair's suit.
 */
const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden',
    suit: 'ember',
    ...extra
});

const runWith = (tiles: Tile[], columns: number, flippedTileIds: string[] = []): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 7 }));
    return {
        ...base,
        board: { ...base.board!, columns, rows: Math.ceil(tiles.length / columns), pairCount: Math.floor(tiles.length / 2), tiles, flippedTileIds }
    };
};

describe('chunk style facts', () => {
    it('are zeros on a turn that broke nothing', () => {
        const before = runWith([tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b')], 2, ['a1', 'a2']);
        const after = runWith(
            [tile('a1', 'a', { state: 'matched' }), tile('a2', 'a', { state: 'matched' }), tile('b1', 'b'), tile('b2', 'b')],
            2
        );
        const facts = getBoardTurnAnnouncementFacts(before, after);
        expect(facts.chunkPartnerSpanMax).toBe(0);
        expect(facts.chunkHaloPairs).toBe(0);
        expect(facts.chunkTreasuresSpilled).toBe(0);
        expect(facts.chunkSuitCleared).toBe(false);
    });

    it('name the span, the halo, the spill and the sweep from the board the chunk left', () => {
        // 4 columns. Row 1: a1 a2 b1 t1 · Row 2: c1 c2 t2 b2. The match is a (ember); b is ember
        // with halves a row and a column apart (two steps); t is a treasure pair; c is tide, taken
        // by the halo.
        const layout = (): Tile[] => [
            tile('a1', 'a'),
            tile('a2', 'a'),
            tile('b1', 'b'),
            tile('t1', 't', { dungeonCardKind: 'treasure', dungeonCardEffectId: 'treasure_gold', dungeonCardState: 'hidden' }),
            tile('c1', 'c', { suit: 'tide' }),
            tile('c2', 'c', { suit: 'tide' }),
            tile('t2', 't', { dungeonCardKind: 'treasure', dungeonCardEffectId: 'treasure_gold', dungeonCardState: 'hidden' }),
            tile('b2', 'b')
        ];
        const before = runWith(layout(), 4, ['a1', 'a2']);
        const gone = new Set(['b', 't', 'c']);
        const after = runWith(
            layout().map((t) =>
                t.pairKey === 'a'
                    ? { ...t, state: 'matched' as const }
                    : gone.has(t.pairKey)
                      ? { ...t, state: 'removed' as const, brokenByChunk: true }
                      : t
            ),
            4
        );
        const facts = getBoardTurnAnnouncementFacts(before, after);
        expect(facts.chunkPartnerSpanMax).toBe(2);
        expect(facts.chunkHaloPairs).toBe(1);
        expect(facts.chunkTreasuresSpilled).toBe(1);
        expect(facts.chunkSuitCleared).toBe(true);
    });

    it('does not count a suit as swept while a hidden tile of it is still on the floor', () => {
        const layout = (): Tile[] => [tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b'), tile('d1', 'd'), tile('d2', 'd')];
        const before = runWith(layout(), 2, ['a1', 'a2']);
        const after = runWith(
            layout().map((t) =>
                t.pairKey === 'a'
                    ? { ...t, state: 'matched' as const }
                    : t.pairKey === 'b'
                      ? { ...t, state: 'removed' as const, brokenByChunk: true }
                      : t
            ),
            2
        );
        expect(getBoardTurnAnnouncementFacts(before, after).chunkSuitCleared).toBe(false);
    });
});
