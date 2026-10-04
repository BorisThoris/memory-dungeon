import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-build-rules';
import { pairsForFloor, LATE_PAIRS_MAX } from './pair-curve';
import { callMeteor } from './meteor-rules';
import { makeRun, playPair } from './test/game-fixtures';
import { getTraitSwapRouteHints } from './trait-opportunities';

describe('late floors keep the original cards and matching model',()=>{
    it('grows only after the established curve and preserves older shared seeds',()=>{
        expect(pairsForFloor(60)).toBe(24); expect(pairsForFloor(90)).toBe(48);
        expect(pairsForFloor(180)).toBe(384); expect(pairsForFloor(330)).toBe(LATE_PAIRS_MAX);
        expect(pairsForFloor(330,58)).toBe(24);
    });
    it('deals 8192 actual cards with unique readable pair identities and coherent meteor removal',()=>{
        const board=buildBoard(330,{runSeed:271,runRulesVersion:60});
        expect(board.tiles).toHaveLength(8192); expect(board.pairCount).toBe(4096);
        const hints = getTraitSwapRouteHints(board);
        expect(hints.length).toBeLessThanOrEqual(3);
        expect(getTraitSwapRouteHints(board)).toEqual(hints);
        const pairs=new Map<string,typeof board.tiles>();
        for(const tile of board.tiles) pairs.set(tile.pairKey,[...(pairs.get(tile.pairKey)??[]),tile]);
        expect(pairs.size).toBe(4096);
        expect(new Set([...pairs.values()].map(halves=>halves[0]!.edition)).size).toBe(4096);
        for(const halves of pairs.values()) {
            expect(halves).toHaveLength(2); expect(halves[0]!.symbol).toBe(halves[1]!.symbol);
            expect(halves[0]!.edition).toBe(halves[1]!.edition);
        }
        const run={...makeRun([]),board,meteorCharges:1};
        const firstPair=[...pairs.values()][0]!;
        const matched=playPair(run,firstPair[0]!.id,firstPair[1]!.id);
        expect(matched.stats.matchesFound).toBe(1);
        expect(matched.board!.tiles.filter(tile=>tile.state==='matched')).toHaveLength(2);
        expect(board.tiles.every(tile=>tile.state==='hidden')).toBe(true);
        expect(board.tiles.filter(tile=>tile.findableKind).length).toBeGreaterThan(100);
        const next=callMeteor(run,board.tiles[4000]!.id);
        expect(next.meteorCharges).toBe(0);
        const remaining=new Map<string,number>();
        for(const tile of next.board!.tiles) if(tile.state==='hidden') remaining.set(tile.pairKey,(remaining.get(tile.pairKey)??0)+1);
        expect([...remaining.values()].every(count=>count===2)).toBe(true);
        expect(next.board!.meteorImpact!.cards).toBeGreaterThan(100);
    },30000);
});
