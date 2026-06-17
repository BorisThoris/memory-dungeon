import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import {
    getDungeonBoardPresentation,
    getDungeonBossReadModel,
    getDungeonExitStatus,
    getDungeonObjectiveStatus,
    getDungeonThreatStatus
} from './dungeon-board-status';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY } from './tile-identity';

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
            canActivate: false,
            lockedReason: 'Needs a iron key or master key.'
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
});
