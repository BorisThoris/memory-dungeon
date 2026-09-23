import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type RunState, type Tile } from './contracts';
import { buildBoard, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import {
    RESTLESS_MAX_SWAPS_PER_DRIFT,
    RESTLESS_TURN_INTERVAL,
    applyRestlessDrift,
    isRestlessDriftTurn,
    resolveRestlessDrift,
    restlessSwapCountForDrift
} from './restless-floor-rules';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    state,
    symbol: pairKey,
    label: pairKey
});

const board = (tiles: Tile[]): BoardState => ({
    level: 8,
    pairCount: tiles.length / 2,
    columns: 4,
    rows: Math.ceil(tiles.length / 4),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const eightHidden = (): Tile[] =>
    ['a', 'b', 'c', 'd'].flatMap((key) => [tile(`${key}1`, key), tile(`${key}2`, key)]);

describe('the restless floor', () => {
    it('drifts on every third resolved turn and not in between', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 9].map(isRestlessDriftTurn)).toEqual([
            false, false, true, false, false, true, false, true
        ]);
        expect(isRestlessDriftTurn(0)).toBe(false);
        expect(RESTLESS_TURN_INTERVAL).toBe(3);
    });

    it('escalates: one pair of cards, then two, then three, and holds there', () => {
        expect([0, 1, 2, 3, 9].map(restlessSwapCountForDrift)).toEqual([1, 2, 3, 3, 3]);
        expect(RESTLESS_MAX_SWAPS_PER_DRIFT).toBe(3);
    });

    it('moves only hidden, unpinned cards, and never a card onto its own partner', () => {
        const tiles = [...eightHidden(), tile('m1', 'm', 'matched'), tile('m2', 'm', 'matched'), tile('f1', 'f', 'flipped')];
        const drift = resolveRestlessDrift({
            board: board(tiles),
            turnsThisFloor: 3,
            driftsBefore: 2,
            pinnedTileIds: ['a1'],
            runSeed: 777,
            rulesVersion: GAME_RULES_VERSION
        });
        expect(drift.kind).toBe('drift');
        expect(drift.swaps).toHaveLength(3);
        const touched = new Set<number>();
        for (const { a, b } of drift.swaps) {
            expect(tiles[a]?.state).toBe('hidden');
            expect(tiles[b]?.state).toBe('hidden');
            expect(tiles[a]?.id).not.toBe('a1');
            expect(tiles[b]?.id).not.toBe('a1');
            expect(tiles[a]?.pairKey).not.toBe(tiles[b]?.pairKey);
            // Each card moves at most once per drift, so no swap undoes another.
            expect(touched.has(a)).toBe(false);
            expect(touched.has(b)).toBe(false);
            touched.add(a);
            touched.add(b);
        }
    });

    it('is the same drift for the same seed, so a replay shifts the same way', () => {
        const input = {
            board: board(eightHidden()),
            turnsThisFloor: 6,
            driftsBefore: 1,
            pinnedTileIds: [],
            runSeed: 4242,
            rulesVersion: GAME_RULES_VERSION
        };
        expect(resolveRestlessDrift(input)).toEqual(resolveRestlessDrift(input));
        expect(resolveRestlessDrift({ ...input, runSeed: 4243 })).not.toEqual(resolveRestlessDrift(input));
    });

    it('has nothing to move on a floor with fewer than two loose cards, and says so', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a', 'matched'), tile('b1', 'b', 'matched'), tile('b2', 'b', 'matched')];
        expect(
            resolveRestlessDrift({
                board: board(tiles),
                turnsThisFloor: 3,
                driftsBefore: 0,
                pinnedTileIds: [],
                runSeed: 1,
                rulesVersion: GAME_RULES_VERSION
            })
        ).toEqual({ kind: 'nothing_to_move', swaps: [] });
        expect(
            resolveRestlessDrift({
                board: board(eightHidden()),
                turnsThisFloor: 4,
                driftsBefore: 0,
                pinnedTileIds: [],
                runSeed: 1,
                rulesVersion: GAME_RULES_VERSION
            })
        ).toEqual({ kind: 'not_yet', swaps: [] });
    });

    it('applies a drift as a pure trade of cells: same cards, same states, different places', () => {
        const before = board(eightHidden());
        const after = applyRestlessDrift(before, [{ a: 0, b: 5 }, { a: 2, b: 7 }]);
        expect(after.tiles[0]?.id).toBe('c2');
        expect(after.tiles[5]?.id).toBe('a1');
        expect(after.tiles[2]?.id).toBe('d2');
        expect(after.tiles[7]?.id).toBe('b1');
        expect([...after.tiles].map((t) => t.id).sort()).toEqual(before.tiles.map((t) => t.id).sort());
        expect(after.matchedPairs).toBe(before.matchedPairs);
        expect(applyRestlessDrift(before, [])).toBe(before);
    });

    it('moves the board mid-floor in a real run, on the third turn, and counts it', () => {
        const seed = 31_337;
        const level = 8;
        const floorBoard = buildBoard(level, {
            runSeed: seed,
            runRulesVersion: GAME_RULES_VERSION,
            activeMutators: ['restless_floor']
        });
        let run: RunState = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })),
            activeMutators: ['restless_floor' as const],
            board: floorBoard,
            status: 'playing' as const
        };
        const layoutBefore = floorBoard.tiles.map((t) => t.id);

        // Three deliberate misses: two hidden cards of different pairs each turn.
        for (let turn = 0; turn < 3; turn += 1) {
            const hidden = run.board!.tiles.filter((t) => t.state === 'hidden');
            const first = hidden[0]!;
            const second = hidden.find((t) => t.pairKey !== first.pairKey)!;
            run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
            if (turn < 2) {
                expect(run.restlessDriftsThisFloor).toBe(0);
                expect(run.board!.tiles.map((t) => t.id)).toEqual(layoutBefore);
            }
        }
        expect(run.turnsThisFloor).toBe(3);
        expect(run.restlessDriftsThisFloor).toBe(1);
        const layoutAfter = run.board!.tiles.map((t) => t.id);
        expect(layoutAfter).not.toEqual(layoutBefore);
        expect([...layoutAfter].sort()).toEqual([...layoutBefore].sort());
        // Exactly one pair of cards traded places on the first drift.
        expect(layoutAfter.filter((id, index) => id !== layoutBefore[index])).toHaveLength(2);
    });

    it('leaves a floor without the mutator exactly where it was', () => {
        const seed = 31_337;
        const floorBoard = buildBoard(8, { runSeed: seed, runRulesVersion: GAME_RULES_VERSION, activeMutators: [] });
        let run: RunState = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })),
            board: floorBoard,
            status: 'playing' as const
        };
        const layoutBefore = floorBoard.tiles.map((t) => t.id);
        for (let turn = 0; turn < 3; turn += 1) {
            const hidden = run.board!.tiles.filter((t) => t.state === 'hidden');
            const first = hidden[0]!;
            const second = hidden.find((t) => t.pairKey !== first.pairKey)!;
            run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
        }
        expect(run.restlessDriftsThisFloor).toBe(0);
        expect(run.board!.tiles.map((t) => t.id)).toEqual(layoutBefore);
    });
});
