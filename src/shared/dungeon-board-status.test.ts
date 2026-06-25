import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import {
    getDungeonBoardStatus,
    getDungeonBoardPresentation,
    getDungeonBossReadModel,
    getDungeonEnemyLifecycleStatus,
    getDungeonExitStatus,
    getDungeonObjectiveStatus,
    getDungeonThreatStatus
} from './dungeon-board-status';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

const tile = (overrides: Partial<Tile>): Tile =>
    ({
        id: overrides.id ?? 'tile',
        pairKey: overrides.pairKey ?? 'pair',
        label: overrides.label ?? 'Tile',
        state: overrides.state ?? 'hidden',
        symbol: overrides.symbol ?? '?',
        ...overrides
    }) as Tile;

const run = (board: BoardState | null, overrides: Partial<RunState> = {}): RunState =>
    ({
        board,
        dungeonEnemiesDefeated: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonKeys: { iron: 0, bronze: 0, silver: 0, gold: 0 },
        dungeonMasterKeys: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        stats: {
            guardTokens: 0
        },
        ...overrides
    }) as RunState;

describe('dungeon board status', () => {
    it('reports hidden and key-locked dungeon exits', () => {
        const board = {
            dungeonExitLockKind: 'iron',
            tiles: [
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Iron Exit',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ]
        } as BoardState;

        expect(getDungeonExitStatus(run(board))).toMatchObject({
            revealed: false,
            canActivate: false,
            lockedReason: 'Reveal the exit card first.'
        });
        expect(
            getDungeonExitStatus(
                run({
                    ...board,
                    tiles: [{ ...board.tiles[0]!, state: 'flipped' }]
                })
            )
        ).toMatchObject({
            revealed: true,
            lockKind: 'none',
            terminalKeySoftlockFallback: true,
            canActivate: true,
            lockedReason: null
        });
        expect(
            getDungeonExitStatus(
                run(
                    {
                        ...board,
                        tiles: [{ ...board.tiles[0]!, state: 'flipped' }]
                    },
                    { dungeonKeys: { iron: 1 } }
                )
            )
        ).toMatchObject({
            canActivate: true,
            canActivateWithKey: true,
            lockedReason: null
        });
    });

    it('treats an unreachable primary key lock as open instead of softlocking progression', () => {
        const board = {
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Iron Exit',
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }),
                tile({ id: 'a1', pairKey: 'a', state: 'matched' }),
                tile({ id: 'a2', pairKey: 'a', state: 'matched' })
            ]
        } as BoardState;

        expect(getDungeonExitStatus(run(board))).toMatchObject({
            lockKind: 'none',
            terminalKeySoftlockFallback: true,
            canActivate: true,
            canActivateWithoutSpend: true,
            lockedReason: null
        });
        expect(getDungeonBoardStatus(run({ ...board, dungeonExitRequiredLeverCount: 3 }))).toMatchObject({
            requiredLeverCount: 0
        });
    });

    it('treats resolved trap cards as settled when deciding terminal key-lock fallback', () => {
        const board = {
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Iron Exit',
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }),
                tile({
                    id: 'trap-a',
                    pairKey: 'trap',
                    state: 'flipped',
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'resolved'
                }),
                tile({
                    id: 'trap-b',
                    pairKey: 'trap',
                    state: 'flipped',
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'resolved'
                })
            ]
        } as BoardState;

        expect(getDungeonExitStatus(run(board))).toMatchObject({
            lockKind: 'none',
            terminalKeySoftlockFallback: true,
            canActivate: true,
            lockedReason: null
        });
    });

    it('keeps a primary key lock while there are still real pairs that can contain progression', () => {
        const board = {
            dungeonExitTileId: 'primary-exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                tile({
                    id: 'primary-exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Primary Exit',
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }),
                tile({ id: 'a1', pairKey: 'a', state: 'hidden' }),
                tile({ id: 'a2', pairKey: 'a', state: 'hidden' })
            ]
        } as BoardState;

        expect(getDungeonExitStatus(run(board))).toMatchObject({
            exitTile: expect.objectContaining({ id: 'primary-exit' }),
            lockKind: 'iron',
            terminalKeySoftlockFallback: false,
            keyFallbackPending: true,
            canActivate: false,
            lockedReason: 'No key source remains; clear the remaining pairs to force the exit open.'
        });
        expect(getDungeonBoardPresentation(run(board))).toMatchObject({
            exitText: 'Clear pairs to open',
            alertText: 'No key source remains; clear the remaining pairs to force the exit open.'
        });
    });

    it('keeps a primary key lock while a wild-card completion route remains', () => {
        const board = {
            dungeonExitTileId: 'primary-exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                tile({
                    id: 'primary-exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Primary Exit',
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }),
                tile({ id: 'single-real', pairKey: 'a', state: 'hidden' }),
                tile({ id: 'wild', pairKey: WILD_PAIR_KEY, state: 'hidden' })
            ]
        } as BoardState;

        expect(getDungeonExitStatus(run(board))).toMatchObject({
            exitTile: expect.objectContaining({ id: 'primary-exit' }),
            lockKind: 'iron',
            terminalKeySoftlockFallback: false,
            keyFallbackPending: true,
            canActivate: false,
            lockedReason: 'No key source remains; clear the remaining pairs to force the exit open.'
        });
    });

    it('counts dungeon trap threat pairs by hidden, armed, and resolved state', () => {
        const board = {
            tiles: [
                tile({ id: 'trap-a1', pairKey: 'trap-a', dungeonCardKind: 'trap', dungeonCardState: 'hidden' }),
                tile({ id: 'trap-a2', pairKey: 'trap-a', dungeonCardKind: 'trap', dungeonCardState: 'hidden' }),
                tile({ id: 'trap-b1', pairKey: 'trap-b', dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
                tile({ id: 'trap-b2', pairKey: 'trap-b', dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
                tile({ id: 'trap-c1', pairKey: 'trap-c', dungeonCardKind: 'trap', dungeonCardState: 'resolved' }),
                tile({ id: 'trap-c2', pairKey: 'trap-c', dungeonCardKind: 'trap', dungeonCardState: 'resolved' })
            ]
        } as BoardState;

        expect(getDungeonThreatStatus(board)).toMatchObject({
            trapCardPairCount: 3,
            hiddenTrapCardPairCount: 1,
            armedTrapCardPairCount: 1,
            resolvedTrapCardPairCount: 1
        });
    });

    it('builds objective and presentation state for visible dungeon boards', () => {
        const board = {
            dungeonObjectiveId: 'reveal_unknowns',
            tiles: [
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    label: 'Exit',
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed'
                }),
                tile({
                    id: 'room',
                    pairKey: ROOM_PAIR_KEY,
                    label: 'Room',
                    state: 'flipped',
                    dungeonCardKind: 'room',
                    dungeonCardState: 'revealed'
                })
            ]
        } as BoardState;

        expect(getDungeonObjectiveStatus(run(board))).toMatchObject({
            objectiveId: 'reveal_unknowns',
            completed: true,
            progress: 1,
            required: 1
        });
        expect(getDungeonBoardPresentation(run(board))).toMatchObject({
            visible: true,
            title: 'Dungeon',
            objectiveLabel: 'Reveal unknowns',
            exitText: 'Exit open'
        });
    });

    it('reads boss lifecycle from moving patrol hazards', () => {
        const board = {
            dungeonBossId: 'rush_sentinel',
            tiles: [],
            enemyHazards: [
                {
                    id: 'boss-hazard',
                    bossId: 'rush_sentinel',
                    kind: 'sentinel',
                    label: 'Bell-Rush Sentinel',
                    pattern: 'patrol',
                    state: 'revealed',
                    currentTileId: 'a',
                    nextTileId: 'b',
                    damage: 1,
                    hp: 1,
                    maxHp: 3
                }
            ]
        } as unknown as BoardState;

        expect(getDungeonBossReadModel(run(board))).toMatchObject({
            id: 'rush_sentinel',
            lifecycleSource: 'moving_patrol',
            phase: 'bloodied',
            hp: 1,
            maxHp: 3,
            pressureCopy: 'Rush Sentinel shortens study time; board movement is the clean counterplay.'
        });
    });

    it('surfaces boss pressure copy in presentation alerts', () => {
        const board = {
            floorTag: 'boss',
            dungeonBossId: 'spire_observer',
            dungeonObjectiveId: 'defeat_boss',
            tiles: [
                tile({
                    id: 'boss-a',
                    pairKey: 'boss',
                    dungeonBossId: 'spire_observer',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'revealed',
                    dungeonCardHp: 3,
                    dungeonCardMaxHp: 3
                }),
                tile({
                    id: 'boss-b',
                    pairKey: 'boss',
                    dungeonBossId: 'spire_observer',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'revealed',
                    dungeonCardHp: 3,
                    dungeonCardMaxHp: 3
                })
            ]
        } as BoardState;

        expect(getDungeonBoardPresentation(run(board))).toMatchObject({
            bossText: 'Mnemonist Observer',
            alertText: 'Mnemonist Observer gives a longer study, then punishes mismatches with extra recall pressure.'
        });
    });

    it('does not treat resolved visible enemy and boss cards as active threats', () => {
        const board = {
            floorTag: 'boss',
            dungeonBossId: 'spire_observer',
            dungeonObjectiveId: 'defeat_boss',
            tiles: [
                tile({
                    id: 'boss-a',
                    pairKey: 'boss',
                    state: 'flipped',
                    dungeonBossId: 'spire_observer',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'resolved',
                    dungeonCardHp: 0,
                    dungeonCardMaxHp: 3
                }),
                tile({
                    id: 'boss-b',
                    pairKey: 'boss',
                    state: 'flipped',
                    dungeonBossId: 'spire_observer',
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'resolved',
                    dungeonCardHp: 0,
                    dungeonCardMaxHp: 3
                }),
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonCardState: 'revealed',
                    dungeonExitLockKind: 'none'
                })
            ],
            dungeonExitTileId: 'exit',
            matchedPairs: 1,
            pairCount: 1
        } as BoardState;

        expect(getDungeonEnemyLifecycleStatus(run(board))).toMatchObject({
            awakeEnemyCardPairCount: 0,
            defeatedEnemyCardPairCount: 1,
            activeBossEnemyCount: 0
        });
        expect(getDungeonBoardStatus(run(board))).toMatchObject({
            awakeEnemyCount: 0,
            hiddenDungeonCardCount: 0
        });
        expect(getDungeonExitStatus(run(board))).toMatchObject({
            canActivate: true,
            lockedReason: null
        });
        expect(getDungeonBossReadModel(run(board))).toMatchObject({
            lifecycleSource: 'none',
            phase: 'defeated',
            hp: 0
        });
    });

    it('does not let stale boss patrol overlays block a fully matched boss floor', () => {
        const board = {
            floorTag: 'boss',
            dungeonBossId: 'trap_warden',
            dungeonObjectiveId: 'defeat_boss',
            dungeonExitTileId: 'exit',
            tiles: [
                tile({ id: 'a1', pairKey: 'a', state: 'matched' }),
                tile({ id: 'a2', pairKey: 'a', state: 'matched' }),
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'none'
                })
            ],
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [
                {
                    id: 'boss-hazard',
                    bossId: 'trap_warden',
                    kind: 'warden',
                    label: 'Latch Warden',
                    pattern: 'guard',
                    state: 'revealed',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    damage: 1,
                    hp: 1,
                    maxHp: 3
                }
            ]
        } as BoardState;
        const staleRun = run(board);

        expect(getDungeonObjectiveStatus(staleRun)).toMatchObject({
            objectiveId: 'defeat_boss',
            completed: true,
            progress: 3,
            required: 3
        });
        expect(getDungeonExitStatus(staleRun).lockedReason).toBeNull();
        expect(getDungeonBossReadModel(staleRun)).toMatchObject({
            lifecycleSource: 'none',
            phase: 'defeated',
            activeMovingPatrolCount: 0
        });
        expect(getDungeonBoardPresentation(staleRun).combatForecastText).toBeNull();
    });

    it('counts stale patrol overlays as resolved for fully matched pacify floors', () => {
        const board = {
            dungeonObjectiveId: 'pacify_floor',
            tiles: [
                tile({ id: 'a1', pairKey: 'a', state: 'matched' }),
                tile({ id: 'a2', pairKey: 'a', state: 'matched' })
            ],
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [
                {
                    id: 'patrol',
                    kind: 'sentinel',
                    label: 'Patrol',
                    pattern: 'patrol',
                    state: 'revealed',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ]
        } as BoardState;

        expect(getDungeonObjectiveStatus(run(board))).toMatchObject({
            objectiveId: 'pacify_floor',
            completed: true,
            progress: 1,
            required: 1
        });
    });

    it('separates defeated boss state from the remaining hidden-exit step', () => {
        const board = {
            floorTag: 'boss',
            dungeonBossId: 'rush_sentinel',
            dungeonObjectiveId: 'defeat_boss',
            dungeonExitTileId: 'exit',
            tiles: [
                tile({ id: 'a1', pairKey: 'a', state: 'matched' }),
                tile({ id: 'a2', pairKey: 'a', state: 'matched' }),
                tile({
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    state: 'hidden',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'none'
                })
            ],
            matchedPairs: 1,
            pairCount: 1,
            enemyHazards: [
                {
                    id: 'boss-hazard',
                    bossId: 'rush_sentinel',
                    kind: 'sentinel',
                    label: 'Bell-Rush Sentinel',
                    pattern: 'patrol',
                    state: 'defeated',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    damage: 1,
                    hp: 0,
                    maxHp: 3
                }
            ]
        } as BoardState;
        const presentation = getDungeonBoardPresentation(run(board));

        expect(presentation).toMatchObject({
            objectiveText: 'Defeat the boss 3/3 complete',
            exitText: 'Boss defeated - reveal exit',
            alertText: 'Boss defeated. Reveal the exit card, then activate it to leave.'
        });
        expect(presentation.chips.find((chip) => chip.id === 'exit')).toMatchObject({
            value: 'Boss defeated - reveal exit',
            tone: 'neutral'
        });
    });
});
