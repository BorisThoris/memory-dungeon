import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    boardHasGlassDecoy,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    isBoardComplete,
    repairDungeonExitSoftlocks
} from './board-inspection';
import { DECOY_PAIR_KEY, EXIT_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...extra
});

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        rows: 2,
        columns: 2,
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        pairCount: Math.floor(tiles.filter((candidate) => ![DECOY_PAIR_KEY, WILD_PAIR_KEY].includes(candidate.pairKey)).length / 2),
        floorArchetypeId: null,
        featuredObjectiveId: null
    });

describe('board-inspection', () => {
    it('finds a wild joker tile id when present', () => {
        expect(getWildTileIdFromBoard(board([tile('a', 'p'), tile('wild', WILD_PAIR_KEY)]))).toBe('wild');
        expect(getWildTileIdFromBoard(board([tile('a', 'p')]))).toBe(null);
    });

    it('distinguishes glass decoy from mirror decoy hazards', () => {
        expect(boardHasGlassDecoy(board([tile('decoy', DECOY_PAIR_KEY)]))).toBe(true);
        expect(boardHasGlassDecoy(board([tile('mirror', DECOY_PAIR_KEY, { tileHazardKind: 'mirror_decoy' })]))).toBe(false);
    });

    it('requires real tiles to be cleared', () => {
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a', { state: 'matched' })]))).toBe(true);
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a')]))).toBe(false);
    });

    it('requires dungeon exits to be activated when present', () => {
        const withExit = board([tile('a1', 'a', { state: 'matched' }), tile('exit', '__exit__')]);

        expect(isBoardComplete({ ...withExit, dungeonExitTileId: 'exit', dungeonExitActivated: false })).toBe(false);
        expect(isBoardComplete({ ...withExit, dungeonExitTileId: 'exit', dungeonExitActivated: true })).toBe(true);
    });

    it('normalizes stale board-level exit lock metadata to the primary exit tile during repair', () => {
        const stale = {
            ...board([
                tile('lever-a', 'lever', {
                    dungeonCardKind: 'lever',
                    dungeonCardEffectId: 'lever_floor'
                }),
                tile('lever-b', 'lever', {
                    dungeonCardKind: 'lever',
                    dungeonCardEffectId: 'lever_floor'
                }),
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 1
                })
            ]),
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron' as const,
            dungeonExitRequiredLeverCount: 0,
            dungeonLeverCount: 0,
            pairCount: 1
        } satisfies BoardState;

        const repaired = repairDungeonExitSoftlocks(stale);

        expect(repaired.dungeonExitLockKind).toBe('lever');
        expect(repaired.dungeonExitRequiredLeverCount).toBe(1);
        expect(repaired.tiles.find((candidate) => candidate.id === 'exit')).toMatchObject({
            dungeonExitLockKind: 'lever',
            dungeonExitRequiredLeverCount: 1
        });
        expect(inspectBoardFairness(repaired).issues.map((issue) => issue.code)).not.toContain(
            'exit_lock_metadata_mismatch'
        );
    });

    it('allows hidden glass decoys and flipped mirror decoys after real tiles clear', () => {
        expect(
            isBoardComplete(
                board([
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('decoy', DECOY_PAIR_KEY)
                ])
            )
        ).toBe(true);
        expect(
            isBoardComplete(
                board([
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('mirror', DECOY_PAIR_KEY, { state: 'flipped', tileHazardKind: 'mirror_decoy' })
                ])
            )
        ).toBe(true);
    });

    it('treats sprung trap tiles as settled', () => {
        expect(
            isBoardComplete(
                board([tile('trap', 'trap', { state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' })])
            )
        ).toBe(true);
    });

    it('ignores stale enemy hazards that only reference cleared tiles after the floor is complete', () => {
        const inspected = inspectBoardFairness({
            ...board([
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' })
            ]),
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [
                {
                    id: 'warden',
                    kind: 'warden',
                    label: 'Latch Warden',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    pattern: 'guard',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 3,
                    bossId: 'trap_warden'
                }
            ]
        });

        expect(inspected.complete).toBe(true);
        expect(inspected.issues.map((issue) => issue.code)).not.toContain('enemy_hazard_on_cleared_tile');
        expect(inspected.hasCompletionRoute).toBe(true);
    });

    it('still reports active enemy hazards on cleared tiles while unresolved pairs remain', () => {
        const inspected = inspectBoardFairness({
            ...board([
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('b1', 'b'),
                tile('b2', 'b')
            ]),
            matchedPairs: 1,
            pairCount: 2,
            enemyHazards: [
                {
                    id: 'warden',
                    kind: 'warden',
                    label: 'Latch Warden',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'guard',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 3,
                    bossId: 'trap_warden'
                }
            ]
        });

        expect(inspected.complete).toBe(false);
        expect(inspected.issues.map((issue) => issue.code)).toContain('enemy_hazard_on_cleared_tile');
        expect(inspected.hasCompletionRoute).toBe(false);
    });

    it('treats resolved boss cards and stale defeated boss hazards as complete after exit activation', () => {
        const inspected = inspectBoardFairness({
            ...board([
                tile('boss-a', 'boss', {
                    state: 'flipped',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'resolved',
                    dungeonBossId: 'trap_warden',
                    dungeonCardHp: 0,
                    dungeonCardMaxHp: 3
                }),
                tile('boss-b', 'boss', {
                    state: 'flipped',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'resolved',
                    dungeonBossId: 'trap_warden',
                    dungeonCardHp: 0,
                    dungeonCardMaxHp: 3
                }),
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'none'
                })
            ]),
            dungeonBossId: 'trap_warden',
            dungeonObjectiveId: 'defeat_boss',
            dungeonExitTileId: 'exit',
            dungeonExitActivated: true,
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [
                {
                    id: 'warden',
                    kind: 'warden',
                    label: 'Latch Warden',
                    currentTileId: 'boss-a',
                    nextTileId: 'boss-b',
                    pattern: 'guard',
                    state: 'defeated',
                    damage: 1,
                    hp: 0,
                    maxHp: 3,
                    bossId: 'trap_warden'
                }
            ]
        });

        expect(inspected.complete).toBe(true);
        expect(inspected.hasCompletionRoute).toBe(true);
        expect(inspected.issues).toEqual([]);
    });
});
