import { describe, expect, it } from 'vitest';
import type { RunState, Tile, TileSuit } from './contracts';
import { advanceToNextLevel, createNewRun, finishMemorizePhase } from './game-core';
import { flipTile } from './game';
import { applyCrucible, crucibleRecastSuit, crucibleTargetTileId } from './crucible-rules';
import { reduceGameplayCommand } from './gameplay-core';
import { createGameplayCrucibleCommand } from './gameplay-core-contracts';

/** Floor 5 of a fixed seed: ten pairs over four elements, Fire the most. */
const floorFive = (): RunState => {
    let run = finishMemorizePhase(createNewRun(0, { runSeed: 4242, realm: null }));
    for (let floor = 0; floor < 4; floor += 1) run = finishMemorizePhase(advanceToNextLevel({ ...run, status: 'levelComplete' }));
    return { ...run, crucibleCharges: 1 };
};

const live = (run: RunState): Tile[] => run.board!.tiles.filter((tile) => tile.state === 'hidden' || tile.state === 'flipped');
const hiddenOf = (run: RunState, suit: TileSuit): Tile[] => run.board!.tiles.filter((tile) => tile.state === 'hidden' && tile.suit === suit);

describe('the Crucible', () => {
    it('waits for one card face up whose twin is still down', () => {
        const run = floorFive();
        expect(crucibleTargetTileId(run)).toBeNull();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        expect(crucibleTargetTileId(flipTile(run, first.id))).toBe(first.id);
        expect(crucibleTargetTileId({ ...flipTile(run, first.id), crucibleCharges: 0 })).toBeNull();
    });

    it('melts the pair and recasts the rest of its element as the element it puts out, with new faces', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const from = first.suit!;
        const to = crucibleRecastSuit(from);
        const flipped = flipTile(run, first.id);
        const otherOfElement = hiddenOf(flipped, from).filter((tile) => tile.pairKey !== first.pairKey);
        const result = applyCrucible(flipped, first.id)!;

        expect(result.fromSuit).toBe(from);
        expect(result.toSuit).toBe(to);
        expect(result.meltedTileIds).toHaveLength(2);
        expect(result.run.board!.tiles.filter((tile) => result.meltedTileIds.includes(tile.id)).every((tile) => tile.state === 'removed')).toBe(true);
        expect(result.recastTileIds).toHaveLength(otherOfElement.length);
        expect(hiddenOf(result.run, from)).toHaveLength(0);
        const recast = result.run.board!.tiles.filter((tile) => result.recastTileIds.includes(tile.id));
        expect(recast.every((tile) => tile.suit === to && tile.state === 'hidden')).toBe(true);
        // New faces: none the element wore before.
        const oldFaces = new Set(otherOfElement.map((tile) => tile.symbol));
        expect(recast.some((tile) => oldFaces.has(tile.symbol))).toBe(false);
        // The cells that turned are the cells that held the element.
        const cellsBefore = flipped.board!.tiles.map((tile, cell) => (otherOfElement.includes(tile) ? cell : -1)).filter((cell) => cell >= 0);
        const cellsAfter = result.run.board!.tiles.map((tile, cell) => (result.recastTileIds.includes(tile.id) ? cell : -1)).filter((cell) => cell >= 0);
        expect(cellsAfter).toEqual(cellsBefore);
        expect(result.run.crucibleCharges).toBe(0);
        expect(result.run.crucibleUsesThisRun).toBe(1);
    });

    it('leaves a whole board: every live pair two cards, faces unique, one more pair gone', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const result = applyCrucible(flipTile(run, first.id), first.id)!;
        const board = result.run.board!;
        const counts = new Map<string, number>();
        for (const tile of live(result.run)) counts.set(tile.pairKey, (counts.get(tile.pairKey) ?? 0) + 1);
        expect([...counts.values()].every((count) => count === 2)).toBe(true);
        const faces = new Map<string, Set<string>>();
        for (const tile of live(result.run)) faces.set(tile.symbol, (faces.get(tile.symbol) ?? new Set()).add(tile.pairKey));
        expect([...faces.values()].every((keys) => keys.size === 1)).toBe(true);
        expect(board.tiles).toHaveLength(run.board!.tiles.length);
        expect(new Set(board.tiles.map((tile) => tile.id)).size).toBe(board.tiles.length);
        expect(board.matchedPairs).toBe(run.board!.matchedPairs + 1);
    });

    it('keeps every card its id, so the board does not deal itself again, and shows no recast face for free', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const flipped = flipTile(run, first.id);
        const element = hiddenOf(flipped, first.suit!).filter((tile) => tile.pairKey !== first.pairKey).map((tile) => tile.id);
        const result = applyCrucible({ ...flipped, peekRevealedTileIds: [element[0]!], lanternLitTileIds: [element[1]!] }, first.id)!;
        expect(new Set(result.recastTileIds)).toEqual(new Set(element));
        expect(result.run.board!.tiles.map((tile) => tile.id).sort()).toEqual(run.board!.tiles.map((tile) => tile.id).sort());
        expect(result.run.peekRevealedTileIds).toEqual([]);
        expect(result.run.lanternLitTileIds).toEqual([]);
    });

    it('leaves the odd cards their element: a Turncoat turns its own and an Hourglass keeps its count', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const odd = run.board!.tiles.find((tile) => tile.state === 'hidden' && tile.suit === first.suit && tile.pairKey !== first.pairKey)!;
        const marked: RunState = { ...run, board: { ...run.board!, tiles: run.board!.tiles.map((tile) => (tile.pairKey === odd.pairKey ? { ...tile, turncoat: 'tide' as const } : tile)) } };
        const result = applyCrucible(flipTile(marked, first.id), first.id)!;
        const after = result.run.board!.tiles.filter((tile) => tile.id === odd.id)[0]!;
        expect(after).toMatchObject({ pairKey: odd.pairKey, suit: odd.suit, turncoat: 'tide' });
        expect(result.recastTileIds).not.toContain(odd.id);
    });

    it('recasts the same way every time from the same run', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const flipped = flipTile(run, first.id);
        expect(applyCrucible(flipped, first.id)!.run.board).toEqual(applyCrucible(flipped, first.id)!.run.board);
    });

    it('never takes the floor\'s last pair', () => {
        const run = floorFive();
        const keep = run.board!.tiles.find((tile) => tile.state === 'hidden')!.pairKey;
        const lastPair: RunState = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) => (tile.pairKey === keep ? tile : { ...tile, state: 'removed' as const })),
                matchedPairs: run.board!.pairCount - 1
            }
        };
        const first = lastPair.board!.tiles.find((tile) => tile.pairKey === keep)!;
        expect(crucibleTargetTileId(flipTile(lastPair, first.id))).toBeNull();
    });

    it('goes through the gameplay core and journals what it melted and recast', () => {
        const run = floorFive();
        const first = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const flipped = flipTile(run, first.id);
        const result = reduceGameplayCommand(flipped, createGameplayCrucibleCommand('crucible:test', first.id));
        expect(result.accepted).toBe(true);
        const transmuted = result.events.find((event) => event.type === 'board.transmuted');
        expect(transmuted).toMatchObject({ targetTileId: first.id, fromSuit: first.suit, crucibleChargesBefore: 1, crucibleChargesAfter: 0 });
        expect(result.events.some((event) => event.type === 'feedback.requested' && event.cue === 'power.crucible.used')).toBe(true);
        expect(reduceGameplayCommand(run, createGameplayCrucibleCommand('crucible:none', first.id)).accepted).toBe(false);
    });
});
