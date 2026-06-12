import { describe, expect, it } from 'vitest';
import { type BoardState, type RunState, type Tile } from './contracts';
import { createNewRun } from './game';
import {
    DUNGEON_OBJECTIVE_SCORE_REWARD,
    applyDungeonExitObjectiveReward,
    createDungeonExitActivationTransition,
    resolveDungeonExitActivationSpend,
    sealBoardForDungeonExit
} from './dungeon-exit-rules';
import {
    EXIT_PAIR_KEY,
    SHOP_PAIR_KEY
} from './tile-identity';

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

const lockedExitStatus = {
    canActivate: false,
    canActivateWithKey: false,
    canActivateWithMasterKey: false,
    canActivateWithoutSpend: false,
    lockKind: 'none' as const
};

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
});
