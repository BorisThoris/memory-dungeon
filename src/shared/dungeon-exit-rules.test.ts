import { describe, expect, it } from 'vitest';
import { type BoardState, type EnemyHazardState, type RunState, type Tile } from './contracts';
import { createNewRun } from './game';
import {
    DUNGEON_OBJECTIVE_SCORE_REWARD,
    applyDungeonExitObjectiveReward,
    chooseDungeonExitActivationSpend,
    createDungeonExitActivationTransition,
    resolveDungeonExitActivationSpend,
    sealBoardForDungeonExit
} from './dungeon-exit-rules';
import {
    EXIT_PAIR_KEY,
    SHOP_PAIR_KEY
} from './tile-identity';
import { getDungeonExitStatus } from './dungeon-board-status';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...overrides
});

const createBoard = (tiles: Tile[]): BoardState => ({
    ...createNewRun(0, { runSeed: 21 }).board!,
    matchedPairs: 0,
    flippedTileIds: tiles.map((candidate) => candidate.id),
    tiles
});

const hazard = (overrides: Partial<EnemyHazardState> = {}): EnemyHazardState => ({
    id: 'boss-hazard',
    kind: 'warden',
    label: 'Warden',
    currentTileId: 'a1',
    nextTileId: 'a2',
    pattern: 'guard',
    state: 'revealed',
    damage: 1,
    hp: 2,
    maxHp: 2,
    bossId: 'trap_warden',
    ...overrides
});

const lockedExitStatus = {
    canActivate: false,
    canActivateWithKey: false,
    canActivateWithMasterKey: false,
    canActivateWithoutSpend: false,
    lockKind: 'none' as const
};

describe('chooseDungeonExitActivationSpend', () => {
    it('prefers free activation before spending typed or master keys', () => {
        expect(chooseDungeonExitActivationSpend({
            canActivateWithoutSpend: true,
            canActivateWithKey: true,
            canActivateWithMasterKey: true
        })).toBe('none');
        expect(chooseDungeonExitActivationSpend({
            canActivateWithoutSpend: false,
            canActivateWithKey: true,
            canActivateWithMasterKey: true
        })).toBe('key');
        expect(chooseDungeonExitActivationSpend({
            canActivateWithoutSpend: false,
            canActivateWithKey: false,
            canActivateWithMasterKey: true
        })).toBe('master_key');
    });
});

describe('resolveDungeonExitActivationSpend', () => {
    it('opens exits that need no spend', () => {
        expect(resolveDungeonExitActivationSpend({
            ...lockedExitStatus,
            canActivate: true,
            canActivateWithoutSpend: true
        }, 'none')).toEqual({
            canOpen: true,
            spendsKey: false,
            spendsMasterKey: false,
            keyKind: null
        });
    });

    it('spends a matching dungeon key for keyed locks', () => {
        expect(resolveDungeonExitActivationSpend({
            ...lockedExitStatus,
            canActivateWithKey: true,
            lockKind: 'iron'
        }, 'key')).toEqual({
            canOpen: true,
            spendsKey: true,
            spendsMasterKey: false,
            keyKind: 'iron'
        });
    });

    it('spends a master key without claiming a typed key kind', () => {
        expect(resolveDungeonExitActivationSpend({
            ...lockedExitStatus,
            canActivateWithMasterKey: true,
            lockKind: 'boss'
        }, 'master_key')).toEqual({
            canOpen: true,
            spendsKey: false,
            spendsMasterKey: true,
            keyKind: null
        });
    });

    it('refuses locked exits when the requested spend cannot open them', () => {
        expect(resolveDungeonExitActivationSpend({
            ...lockedExitStatus,
            canActivateWithKey: true,
            lockKind: 'iron'
        }, 'none')).toMatchObject({
            canOpen: false,
            spendsKey: false,
            spendsMasterKey: false
        });
    });
});

describe('sealBoardForDungeonExit', () => {
    it('activates the exit and removes unresolved real pairs', () => {
        const board = createBoard([
            tile('exit', EXIT_PAIR_KEY, { dungeonCardState: 'revealed' }),
            tile('a1', 'a', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('a2', 'a', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('b1', 'b', { state: 'matched' }),
            tile('b2', 'b', { state: 'matched' })
        ]);

        const sealed = sealBoardForDungeonExit(board);

        expect(sealed.dungeonExitActivated).toBe(true);
        expect(sealed.flippedTileIds).toEqual([]);
        expect(sealed.matchedPairs).toBe(2);
        expect(sealed.tiles.find((candidate) => candidate.id === 'exit')).toMatchObject({
            state: 'matched',
            dungeonCardState: 'resolved',
            dungeonExitActivated: true
        });
        expect(sealed.tiles.find((candidate) => candidate.id === 'a1')).toMatchObject({
            state: 'removed',
            dungeonCardKind: undefined,
            dungeonCardState: undefined
        });
        expect(sealed.tiles.find((candidate) => candidate.id === 'b1')).toMatchObject({
            state: 'matched'
        });
    });

    it('hides flipped singleton utility tiles instead of removing them', () => {
        const board = createBoard([
            tile('exit', EXIT_PAIR_KEY),
            tile('shop', SHOP_PAIR_KEY, { state: 'flipped', dungeonCardState: 'revealed' })
        ]);

        const sealed = sealBoardForDungeonExit(board);

        expect(sealed.tiles.find((candidate) => candidate.id === 'shop')).toMatchObject({
            state: 'hidden',
            dungeonCardState: 'revealed'
        });
    });
});

describe('applyDungeonExitObjectiveReward', () => {
    it('rewards claim-route objectives when an activated exit has a route type', () => {
        const run = {
            ...createNewRun(0, { runSeed: 22 }),
            board: {
                ...createNewRun(0, { runSeed: 22 }).board!,
                dungeonObjectiveId: 'claim_route'
            } satisfies BoardState,
            stats: {
                ...createNewRun(0, { runSeed: 22 }).stats,
                totalScore: 10,
                currentLevelScore: 3
            }
        };

        const result = applyDungeonExitObjectiveReward(run, { routeType: 'safe' });

        expect(result.rewarded).toBe(true);
        expect(result.run.stats.totalScore).toBe(10 + DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.currentLevelScore).toBe(3 + DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.bestScore).toBe(10 + DUNGEON_OBJECTIVE_SCORE_REWARD);
    });

    it('normalizes malformed score counters before rewarding exit objectives', () => {
        const run = {
            ...createNewRun(0, { runSeed: 24 }),
            board: {
                ...createNewRun(0, { runSeed: 24 }).board!,
                dungeonObjectiveId: 'claim_route'
            } satisfies BoardState,
            stats: {
                ...createNewRun(0, { runSeed: 24 }).stats,
                totalScore: Number.NaN,
                currentLevelScore: -4.5,
                bestScore: Number.POSITIVE_INFINITY
            }
        };

        const result = applyDungeonExitObjectiveReward(run, { routeType: 'safe' });

        expect(result.rewarded).toBe(true);
        expect(result.run.stats.totalScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.currentLevelScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.bestScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
    });

    it('normalizes malformed stat records before rewarding exit objectives', () => {
        const run = {
            ...createNewRun(0, { runSeed: 25 }),
            board: {
                ...createNewRun(0, { runSeed: 25 }).board!,
                dungeonObjectiveId: 'claim_route'
            } satisfies BoardState,
            stats: Number.NaN as unknown as RunState['stats']
        };

        const result = applyDungeonExitObjectiveReward(run, { routeType: 'safe' });

        expect(result.rewarded).toBe(true);
        expect(result.run.stats.totalScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.currentLevelScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
        expect(result.run.stats.bestScore).toBe(DUNGEON_OBJECTIVE_SCORE_REWARD);
    });

    it('does not reward the default find-exit objective', () => {
        const run = {
            ...createNewRun(0, { runSeed: 23 }),
            board: {
                ...createNewRun(0, { runSeed: 23 }).board!,
                dungeonObjectiveId: 'find_exit'
            } satisfies BoardState,
            stats: {
                ...createNewRun(0, { runSeed: 23 }).stats,
                totalScore: 10,
                currentLevelScore: 3
            }
        };

        const result = applyDungeonExitObjectiveReward(run, { routeType: 'safe' });

        expect(result.rewarded).toBe(false);
        expect(result.run.stats).toBe(run.stats);
    });
});

describe('createDungeonExitActivationTransition', () => {
    it('opens a revealed keyed exit and prepares the completed board', () => {
        const base = createNewRun(0, { runSeed: 24 });
        const board = createBoard([
            tile('exit', EXIT_PAIR_KEY, {
                state: 'flipped',
                dungeonCardState: 'revealed',
                dungeonExitLockKind: 'iron',
                dungeonRouteType: 'safe'
            }),
            tile('a1', 'a'),
            tile('a2', 'a')
        ]);
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonKeys: { iron: 1 },
            dungeonMasterKeys: 0,
            dungeonGatewaysUsed: 0,
            pendingRouteCardPlan: null
        };

        const transition = createDungeonExitActivationTransition(run, 'key');

        expect(transition).not.toBeNull();
        expect(transition?.board.dungeonExitActivated).toBe(true);
        expect(transition?.run.board).toBe(transition?.board);
        expect(transition?.run.dungeonKeys.iron).toBe(0);
        expect(transition?.run.dungeonGatewaysUsed).toBe(1);
        expect(transition?.run.pendingRouteCardPlan?.routeType).toBe('safe');
    });

    it('auto-selects the valid spend when opening a revealed keyed exit without an explicit spend', () => {
        const base = createNewRun(0, { runSeed: 2401 });
        const board = createBoard([
            tile('exit', EXIT_PAIR_KEY, {
                state: 'flipped',
                dungeonCardState: 'revealed',
                dungeonExitLockKind: 'iron'
            }),
            tile('a1', 'a', { state: 'matched' }),
            tile('a2', 'a', { state: 'matched' })
        ]);
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonKeys: { iron: 1 },
            dungeonMasterKeys: 0,
            dungeonGatewaysUsed: 0
        };

        const transition = createDungeonExitActivationTransition(run);

        expect(transition).not.toBeNull();
        expect(transition?.run.dungeonKeys.iron).toBe(0);
        expect(transition?.board.dungeonExitActivated).toBe(true);
    });

    it('opens terminal key-lock fallback exits without spending a key', () => {
        const base = createNewRun(0, { runSeed: 2404 });
        const board = {
            ...createBoard([
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'iron'
                }),
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' })
            ]),
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron' as const,
            matchedPairs: 1,
            pairCount: 1
        };
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonKeys: { iron: 0 },
            dungeonMasterKeys: 0
        };

        expect(getDungeonExitStatus(run)).toMatchObject({
            lockKind: 'none',
            terminalKeySoftlockFallback: true,
            canActivateWithoutSpend: true
        });

        const transition = createDungeonExitActivationTransition(run);

        expect(transition).not.toBeNull();
        expect(transition?.board.dungeonExitActivated).toBe(true);
        expect(transition?.run.dungeonKeys.iron ?? 0).toBe(0);
        expect(transition?.run.dungeonMasterKeys).toBe(0);
    });

    it('defeats remaining moving boss hazards when the exit seals the floor', () => {
        const base = createNewRun(0, { runSeed: 2402 });
        const board = {
            ...createBoard([
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardState: 'revealed'
                }),
                tile('a1', 'a'),
                tile('a2', 'a')
            ]),
            enemyHazards: [hazard()]
        };
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 2
        };

        const transition = createDungeonExitActivationTransition(run);

        expect(transition).not.toBeNull();
        expect(transition?.board.enemyHazards).toMatchObject([{ id: 'boss-hazard', hp: 0, state: 'defeated' }]);
        expect(transition?.run.dungeonEnemiesDefeated).toBe(2);
        expect(transition?.run.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(transition?.run.enemyHazardsDefeatedThisFloor).toBe(3);
    });

    it('normalizes malformed dungeon counters when activating exits', () => {
        const base = createNewRun(0, { runSeed: 2405 });
        const board = {
            ...createBoard([
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'iron'
                }),
                tile('a1', 'a'),
                tile('a2', 'a')
            ]),
            enemyHazards: [hazard()]
        };
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonKeys: { iron: 0 },
            dungeonMasterKeys: 1.9,
            dungeonGatewaysUsed: Number.NaN,
            dungeonEnemiesDefeated: Number.POSITIVE_INFINITY,
            dungeonEnemiesDefeatedThisFloor: 1.9,
            enemyHazardsDefeatedThisFloor: Number.NaN
        };

        const transition = createDungeonExitActivationTransition(run, 'master_key');

        expect(transition).not.toBeNull();
        expect(transition?.run.dungeonMasterKeys).toBe(0);
        expect(transition?.run.dungeonGatewaysUsed).toBe(1);
        expect(transition?.run.dungeonEnemiesDefeated).toBe(1);
        expect(transition?.run.dungeonEnemiesDefeatedThisFloor).toBe(2);
        expect(transition?.run.enemyHazardsDefeatedThisFloor).toBe(1);
    });

    it('allows a cleared boss floor to exit when only a stale boss patrol overlay remains', () => {
        const base = createNewRun(0, { runSeed: 2403 });
        const board = {
            ...createBoard([
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed'
                }),
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' })
            ]),
            dungeonExitTileId: 'exit',
            dungeonObjectiveId: 'defeat_boss' as const,
            dungeonBossId: 'trap_warden' as const,
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [hazard({ currentTileId: 'a1', nextTileId: 'a2' })]
        };
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonEnemiesDefeated: 0,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 0
        };

        expect(getDungeonExitStatus(run)).toMatchObject({
            canActivate: true,
            lockedReason: null
        });

        const transition = createDungeonExitActivationTransition(run);

        expect(transition).not.toBeNull();
        expect(transition?.board.enemyHazards).toMatchObject([{ id: 'boss-hazard', hp: 0, state: 'defeated' }]);
        expect(transition?.run.status).toBe('playing');
    });
});

describe('getDungeonExitStatus softlock prevention', () => {
    it('prefers the primary lever exit over a revealed locked alternate exit', () => {
        const base = createNewRun(0, { runSeed: 25 });
        const board = {
            ...createBoard([
                tile('alternate-exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'iron',
                    dungeonRouteType: 'greed'
                }),
                tile('primary-exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 1,
                    dungeonRouteType: 'safe'
                }),
                tile('lever-a', 'lever', {
                    state: 'matched',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'lever_floor'
                }),
                tile('lever-b', 'lever', {
                    state: 'matched',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'lever_floor'
                })
            ]),
            dungeonExitTileId: 'primary-exit',
            dungeonExitLockKind: 'lever' as const,
            dungeonExitRequiredLeverCount: 1,
            dungeonLeverCount: 1
        };
        const run: RunState = { ...base, board, dungeonKeys: { iron: 0, treasure: 0, boss: 0 }, dungeonMasterKeys: 0 };

        const status = getDungeonExitStatus(run);

        expect(status.exitTile?.id).toBe('primary-exit');
        expect(status.lockKind).toBe('lever');
        expect(status.canActivate).toBe(true);
        expect(status.lockedReason).toBeNull();
    });

    it('activates the primary lever exit instead of softlocking on a revealed alternate key exit', () => {
        const base = createNewRun(0, { runSeed: 26 });
        const board = {
            ...createBoard([
                tile('alternate-exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'iron',
                    dungeonRouteType: 'greed'
                }),
                tile('primary-exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 1,
                    dungeonRouteType: 'safe'
                }),
                tile('lever-a', 'lever', {
                    state: 'matched',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'lever_floor'
                }),
                tile('lever-b', 'lever', {
                    state: 'matched',
                    dungeonCardKind: 'lever',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'lever_floor'
                })
            ]),
            dungeonExitTileId: 'primary-exit',
            dungeonExitLockKind: 'lever' as const,
            dungeonExitRequiredLeverCount: 1,
            dungeonLeverCount: 1
        };
        const run: RunState = {
            ...base,
            status: 'playing',
            board,
            dungeonKeys: { iron: 0, treasure: 0, boss: 0 },
            dungeonMasterKeys: 0,
            dungeonGatewaysUsed: 0,
            pendingRouteCardPlan: null
        };

        const transition = createDungeonExitActivationTransition(run);

        expect(transition).not.toBeNull();
        expect(transition?.board.tiles.find((candidate) => candidate.id === 'primary-exit')).toMatchObject({
            dungeonExitActivated: true,
            dungeonRouteType: 'safe'
        });
        expect(transition?.board.tiles.find((candidate) => candidate.id === 'alternate-exit')).not.toMatchObject({
            dungeonExitActivated: true
        });
        expect(transition?.run.dungeonKeys.iron ?? 0).toBe(0);
        expect(transition?.run.pendingRouteCardPlan?.routeType).toBe('safe');
    });
});
