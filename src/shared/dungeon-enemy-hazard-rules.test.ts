import { describe, expect, it } from 'vitest';

import type { BoardState, EnemyHazardState, RunState, Tile } from './contracts';
import { MEMORIZE_BONUS_PER_LIFE_LOST_MS } from './contracts';
import {
    ENEMY_HAZARD_PATTERN_DEFINITIONS,
    advanceEnemyHazardsOnBoard,
    applyEnemyHazardClick,
    clearLastPairEnemyHazardSoftlock,
    createEnemyHazardsForBoard,
    damageFirstRevealedEnemyHazard,
    defeatEnemyHazardsBlockingLastPair,
    defeatEnemyHazardsForFloorClear,
    getEnemyHazardMovementCandidateIds
} from './dungeon-enemy-hazard-rules';

describe('dungeon enemy hazard rules', () => {
    it('documents and applies movement pattern candidate priorities', () => {
        expect(Object.keys(ENEMY_HAZARD_PATTERN_DEFINITIONS).sort()).toEqual(
            ['guard', 'observe', 'patrol', 'stalk'].sort()
        );

        const board = boardWith([
            tile('plain-hidden', 'plain-hidden'),
            tile('plain-flipped', 'plain-flipped', { state: 'flipped' }),
            tile('treasure', 'treasure', { dungeonCardKind: 'treasure' }),
            tile('key', 'key', { dungeonCardKind: 'key' }),
            tile('trap', 'trap', { dungeonCardKind: 'trap' }),
            tile('enemy', 'enemy', { dungeonCardKind: 'enemy' }),
            tile('matched', 'matched', { state: 'matched' }),
            tile('exit', '__exit__', { dungeonCardKind: 'exit' })
        ]);

        expect(getEnemyHazardMovementCandidateIds(board, 'patrol')).toEqual([
            'plain-hidden',
            'plain-flipped',
            'treasure',
            'key',
            'trap',
            'enemy'
        ]);
        expect(getEnemyHazardMovementCandidateIds(board, 'stalk')).toEqual([
            'plain-hidden',
            'treasure',
            'key',
            'trap',
            'enemy'
        ]);
        expect(getEnemyHazardMovementCandidateIds(board, 'guard')).toEqual(['treasure', 'key']);
        expect(getEnemyHazardMovementCandidateIds(board, 'observe')).toEqual(['trap', 'enemy']);
    });

    it('creates deterministic hazards from encounter pressure', () => {
        const tiles = [tile('a', 'a'), tile('b', 'b'), tile('c', 'c'), tile('d', 'd')];

        expect(createEnemyHazardsForBoard({
            tiles,
            runSeed: 7,
            rulesVersion: 20,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            nodeKind: 'trap',
            bossId: null,
            gameMode: 'endless'
        })).toEqual([
            expect.objectContaining({ id: '7:hazard:0', kind: 'stalker', pattern: 'stalk' }),
            expect.objectContaining({ id: '7:hazard:1', kind: 'stalker', pattern: 'stalk' })
        ]);

        expect(createEnemyHazardsForBoard({
            tiles,
            runSeed: 7,
            rulesVersion: 20,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            nodeKind: 'trap',
            bossId: null,
            gameMode: 'endless'
        })).toEqual(createEnemyHazardsForBoard({
            tiles,
            runSeed: 7,
            rulesVersion: 20,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            nodeKind: 'trap',
            bossId: null,
            gameMode: 'endless'
        }));
    });

    it('advances active hazards and damages revealed hazards', () => {
        const board = boardWith(
            [tile('a', 'a'), tile('b', 'b'), tile('c', 'c')],
            [hazard('h1', 'a', 'b', { state: 'revealed', hp: 1 })]
        );

        const damaged = damageFirstRevealedEnemyHazard(board, 1);
        expect(damaged).toMatchObject({ defeated: 1, bossDefeated: 0, score: 30 });
        expect(damaged.board.enemyHazards![0]).toMatchObject({ hp: 0, state: 'defeated' });

        const advanced = advanceEnemyHazardsOnBoard(board);
        expect(advanced.enemyHazardTurn).toBe(1);
        expect(advanced.enemyHazards![0]!.currentTileId).toBe('b');
    });

    it('does not advance stale hazards that only occupy cleared tiles', () => {
        const board = boardWith(
            [tile('a', 'done', { state: 'matched' }), tile('b', 'done', { state: 'matched' })],
            [hazard('h1', 'a', 'b', { state: 'revealed', hp: 1 })]
        );

        expect(advanceEnemyHazardsOnBoard(board)).toBe(board);
    });

    it('does not damage stale revealed hazards that only occupy cleared tiles', () => {
        const board = boardWith(
            [tile('a', 'done', { state: 'matched' }), tile('b', 'done', { state: 'matched' })],
            [hazard('h1', 'a', 'b', { state: 'revealed', hp: 1 })]
        );

        expect(damageFirstRevealedEnemyHazard(board, 1)).toEqual({
            board,
            defeated: 0,
            bossDefeated: 0,
            score: 0
        });
    });

    it('does not apply contact damage from stale cleared-tile hazards', () => {
        const board = boardWith(
            [tile('a', 'done', { state: 'matched' }), tile('b', 'done', { state: 'matched' })],
            [hazard('h1', 'a', 'b', { state: 'revealed', hp: 1 })]
        );
        const run = runWithBoard(board);

        const next = applyEnemyHazardClick(run, 'a', { advanceHazards: false });

        expect(next.lives).toBe(run.lives);
        expect(next.enemyHazardHitsThisFloor).toBe(0);
        expect(next.board!.enemyHazards![0]).toMatchObject({ hp: 0, state: 'defeated' });
    });

    it('clicking an occupied hidden card deals contact damage without flipping it', () => {
        const board = boardWith(
            [tile('a', 'a'), tile('b', 'b'), tile('c', 'c')],
            [hazard('h1', 'a', 'b')]
        );
        const run = runWithBoard(board);

        const hit = applyEnemyHazardClick(run, 'a', { advanceHazards: false });

        expect(hit.lives).toBe(run.lives - 1);
        expect(hit.pendingMemorizeBonusMs).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS);
        expect(hit.enemyHazardHitsThisFloor).toBe(1);
        expect(hit.board!.tiles.find((candidate) => candidate.id === 'a')!.state).toBe('hidden');
        expect(hit.board!.enemyHazards![0]).toMatchObject({ state: 'revealed' });
    });

    it('clears hidden hazards blocking the final unresolved real pair', () => {
        const board = boardWith(
            [
                tile('a', 'final'),
                tile('b', 'final'),
                tile('c', 'done', { state: 'matched' })
            ],
            [hazard('h1', 'a', 'b', { bossId: 'rush_sentinel' })]
        );
        const cleared = defeatEnemyHazardsBlockingLastPair(board);

        expect(cleared).toMatchObject({ defeated: 1, bossesDefeated: 1 });
        expect(cleared.board.enemyHazards![0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(clearLastPairEnemyHazardSoftlock(runWithBoard(board), board)).toMatchObject({
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1
        });
    });

    it('ignores resolved dungeon pairs when detecting the final unresolved real pair', () => {
        const board = boardWith(
            [
                tile('a', 'final'),
                tile('b', 'final'),
                tile('lever-a', 'lever', {
                    state: 'flipped',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved'
                }),
                tile('lever-b', 'lever', {
                    state: 'flipped',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved'
                })
            ],
            [hazard('h1', 'a', 'b')]
        );

        const cleared = defeatEnemyHazardsBlockingLastPair(board);

        expect(cleared).toMatchObject({ defeated: 1, bossesDefeated: 0 });
        expect(cleared.board.enemyHazards![0]).toMatchObject({ hp: 0, state: 'defeated' });
    });

    it('sweeps stale cleared-tile hazards on floor clear', () => {
        const board = boardWith(
            [tile('a', 'done', { state: 'matched' }), tile('b', 'done', { state: 'matched' })],
            [hazard('h1', 'a', 'b', { bossId: 'rush_sentinel', state: 'revealed', hp: 1 })]
        );

        const result = defeatEnemyHazardsForFloorClear(board);

        expect(result).toMatchObject({
            defeated: 1,
            bossesDefeated: 1
        });
        expect(result.board.enemyHazards![0]).toMatchObject({ hp: 0, state: 'defeated' });
    });
});

const boardWith = (tiles: Tile[], enemyHazards: EnemyHazardState[] = []): BoardState => ({
    level: 1,
    pairCount: Math.max(1, new Set(tiles.map((candidate) => candidate.pairKey)).size),
    columns: 2,
    rows: 2,
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorTag: 'normal',
    cursedPairKey: null,
    wardPairKey: null,
    bountyPairKey: null,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    cycleFloor: null,
    actTitle: null,
    actFloorNumber: null,
    actFloorCount: null,
    biomeTitle: null,
    biomeTone: null,
    routeWorldProfile: null,
    selectedGatewayRouteType: null,
    dungeonKeysHeld: 0,
    dungeonExitTileId: null,
    dungeonExitActivated: false,
    dungeonExitLockKind: 'none',
    dungeonExitRequiredLeverCount: 0,
    dungeonLeverCount: 0,
    dungeonShopTileId: null,
    dungeonShopVisited: false,
    dungeonBossId: null,
    dungeonObjectiveId: 'find_exit',
    enemyHazards,
    enemyHazardTurn: 0
});

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    atomicVariant: 0,
    ...extra
});

const hazard = (
    id: string,
    currentTileId: string,
    nextTileId: string,
    extra: Partial<EnemyHazardState> = {}
): EnemyHazardState => ({
    id,
    kind: 'sentinel',
    label: id,
    currentTileId,
    nextTileId,
    pattern: 'patrol',
    state: 'hidden',
    damage: 1,
    hp: 1,
    maxHp: 1,
    ...extra
});

const runWithBoard = (board: BoardState): RunState => ({
    status: 'playing',
    gameMode: 'endless',
    score: 0,
    bestScore: 0,
    lives: 3,
    level: 1,
    board,
    stats: {
        currentStreak: 0,
        bestStreak: 0,
        totalMatches: 0,
        totalMistakes: 0,
        perfectClears: 0,
        guardTokens: 0,
        comboShards: 0,
        shufflesUsed: 0,
        pairsDestroyed: 0
    },
    pendingMemorizeBonusMs: 0,
    dungeonEnemiesDefeated: 0,
    dungeonEnemiesDefeatedThisFloor: 0,
    enemyHazardsDefeatedThisFloor: 0,
    enemyHazardHitsThisFloor: 0,
    gambitAvailableThisFloor: false,
    gambitThirdFlipUsed: false
} as unknown as RunState);
