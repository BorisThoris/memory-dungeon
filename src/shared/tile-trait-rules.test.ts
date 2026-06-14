import { describe, expect, it } from 'vitest';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import { makeBoard, makePair, makeRun, makeTile } from './test/game-fixtures';
import {
    applyVolatileMismatchTrait,
    assignTileTraitsToGeneratedBoard,
    calculateTileTraitMatchRewards,
    calculateTileTraitMismatchPenalty
} from './tile-trait-rules';

describe('tile trait rules', () => {
    it('assigns deterministic route-weighted traits to generated safe tiles after floor one', () => {
        const baseTiles = [
            ...makePair('a', 'A'),
            ...makePair('b', 'B'),
            ...makePair('c', 'C'),
            ...makePair('d', 'D')
        ];
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed');

        const traitTiles = tiles.filter((tile) => tile.tileTraitKind != null);
        expect(traitTiles.length).toBeGreaterThan(0);
        expect(traitTiles.every((tile) => tile.tileHazardKind == null && tile.dungeonCardKind == null)).toBe(true);
        expect(assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed').map((tile) => tile.tileTraitKind ?? null)).toEqual(
            tiles.map((tile) => tile.tileTraitKind ?? null)
        );
    });

    it('does not assign traits on the opener floor', () => {
        const [a1, a2] = makePair('a', 'A');
        const tiles = assignTileTraitsToGeneratedBoard([a1, a2], 1, 30, 1, 'mystery');
        expect(tiles.some((tile) => tile.tileTraitKind != null)).toBe(false);
    });

    it('turns echo and mirror clean matches into resource rewards', () => {
        const run = makeRun([]);
        const [echoA, echoB] = makePair('echo', 'E');
        const [mirrorA, mirrorB] = makePair('mirror', 'M');

        expect(calculateTileTraitMatchRewards(run, [{ ...echoA, tileTraitKind: 'echo' }, echoB])).toEqual({
            comboShardGain: 0,
            guardTokenGain: 0,
            peekChargeGain: 1,
            relicFavorGain: 0,
            scoreBonus: 0,
            shopGoldGain: 0
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB])).toEqual({
            comboShardGain: 0,
            guardTokenGain: 1,
            peekChargeGain: 0,
            relicFavorGain: 0,
            scoreBonus: 0,
            shopGoldGain: 0
        });
    });

    it('turns cursed, sealed, and heavy matches into build rewards', () => {
        const run = makeRun([], { relicIds: ['parasite_ledger'] });
        const [cursedA, cursedB] = makePair('cursed', 'C');
        const [sealedA, sealedB] = makePair('sealed', 'S');
        const [heavyA, heavyB] = makePair('heavy', 'H');

        expect(calculateTileTraitMatchRewards(run, [{ ...cursedA, tileTraitKind: 'cursed' }, cursedB])).toMatchObject({
            relicFavorGain: 1,
            scoreBonus: 15,
            shopGoldGain: 1
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]).comboShardGain).toBe(1);
        expect(calculateTileTraitMatchRewards(run, [{ ...heavyA, tileTraitKind: 'heavy' }, heavyB]).scoreBonus).toBe(35);
    });

    it('applies echo reward through normal two-card resolution', () => {
        const run = makeRun([
            makeTile('a1', 'a', 'A', { tileTraitKind: 'echo' }),
            makeTile('a2', 'a', 'A', { tileTraitKind: 'echo' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));
        expect(resolved.peekCharges).toBe(run.peekCharges + 1);
        expect(resolved.stats.tileTraitMatches.echo).toBe(1);
    });

    it('adds mirror mismatch pressure without hiding the base miss bookkeeping', () => {
        const [a1] = makePair('a', 'A');
        const [b1] = makePair('b', 'B');
        const run = makeRun([], { peekCharges: 1 });
        const penalty = calculateTileTraitMismatchPenalty(run, [{ ...a1, tileTraitKind: 'mirror' }, b1]);

        expect(penalty).toMatchObject({ triesDelta: 1, recallMistakesDelta: 1, peekChargeLoss: 0 });
    });

    it('drains peek on sealed mismatch before adding deeper recall pressure', () => {
        const [a1] = makePair('a', 'A');
        const [b1] = makePair('b', 'B');
        const withPeek = calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 1 }), [
            { ...a1, tileTraitKind: 'sealed' },
            b1
        ]);
        const withoutPeek = calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 0 }), [
            { ...a1, tileTraitKind: 'sealed' },
            b1
        ]);

        expect(withPeek).toMatchObject({ peekChargeLoss: 1, recallMistakesDelta: 0 });
        expect(withoutPeek).toMatchObject({ peekChargeLoss: 0, recallMistakesDelta: 1 });
    });

    it('shuffles safe hidden tiles when a volatile pair is missed', () => {
        const board = makeBoard([
            makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile', state: 'flipped' }),
            makeTile('x1', 'x', 'X', { state: 'flipped' }),
            makeTile('a1', 'a', 'A'),
            makeTile('a2', 'a', 'A'),
            makeTile('b1', 'b', 'B'),
            makeTile('b2', 'b', 'B')
        ]);
        const run = makeRun(board.tiles, { board });

        const result = applyVolatileMismatchTrait(board, run, [board.tiles[0]!, board.tiles[1]!]);
        expect(result.triggered).toBe(true);
        expect(result.board.tiles.slice(2).map((tile) => tile.id)).not.toEqual(board.tiles.slice(2).map((tile) => tile.id));
    });
});
