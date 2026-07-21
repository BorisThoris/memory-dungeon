import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { BoardState, Tile } from './contracts';
import { buildBoard } from './board-build-rules';
import { createDungeonRunMapState, revealDungeonChoices, selectDungeonNode } from './run-map';
import {
    createDungeonBoardTopology,
    formatDungeonBoardTopologyDiagnostics,
    formatDungeonBoardTopologyIssue,
    formatDungeonRunMapTopologyDiagnostics,
    formatDungeonRunMapTopologyIssue,
    inspectDungeonBoardTopology,
    inspectDungeonRunMapTopology,
    type DungeonBoardTopologyOptions
} from './dungeon-topology';
import { GAME_RULES_VERSION } from './contracts';
import { EXIT_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...extra
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: new Set(tiles.map((candidate) => candidate.pairKey).filter((pairKey) => pairKey !== EXIT_PAIR_KEY)).size,
    columns: 3,
    rows: Math.ceil(tiles.length / 3),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    ...overrides
});

describe('dungeon topology graph', () => {
    it('models board progression resources as graph nodes', () => {
        const source = board(
            [
                tile('key-a', 'key', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('key-b', 'key', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('lever-a', 'lever', { dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' }),
                tile('lever-b', 'lever', { dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            {
                pairCount: 2,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        );

        const graph = createDungeonBoardTopology(source);

        expect(graph.nodes().sort()).toEqual(
            expect.arrayContaining(['start', 'pair:key', 'key:iron:key', 'pair:lever', 'lever:lever', 'exit:exit'])
        );
        expect(graph.outboundNeighbors('pair:key')).toContain('key:iron:key');
        expect(graph.outboundNeighbors('key:iron:key')).toContain('exit:exit');
        expect(graph.outboundNeighbors('start')).toContain('exit:exit');
    });

    it('proves key and lever exits from reachable sources', () => {
        const keyLocked = board(
            [
                tile('key-a', 'key', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('key-b', 'key', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            { dungeonExitTileId: 'exit', dungeonExitLockKind: 'iron' }
        );
        const leverLocked = board(
            [
                tile('lever-a', 'lever', { dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' }),
                tile('lever-b', 'lever', { dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 1
                })
            ],
            {
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 1
            }
        );

        expect(inspectDungeonBoardTopology(keyLocked)).toMatchObject({
            obtainableKeyKinds: ['iron'],
            hasExitRoute: true,
            issues: []
        });
        expect(inspectDungeonBoardTopology(leverLocked)).toMatchObject({
            reachableLeverCount: 1,
            hasExitRoute: true,
            issues: []
        });
    });

    it('proves iron exits from reachable room key caches', () => {
        const source = board(
            [
                tile('room-a', 'room', {
                    dungeonCardKind: 'room',
                    dungeonCardEffectId: 'room_key_cache'
                }),
                tile('room-b', 'room', {
                    dungeonCardKind: 'room',
                    dungeonCardEffectId: 'room_key_cache'
                }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            { dungeonExitTileId: 'exit', dungeonExitLockKind: 'iron' }
        );

        const report = inspectDungeonBoardTopology(source);

        expect(report.obtainableKeyKinds).toEqual(['iron']);
        expect(report.hasExitRoute).toBe(true);
        expect(report.issues).toEqual([]);
        expect(createDungeonBoardTopology(source).outboundNeighbors('room:room')).toContain('key:iron:room:room_cache');
    });

    it('reports blocker resources that the topology cannot satisfy', () => {
        const source = board(
            [
                tile('a1', 'a'),
                tile('a2', 'a'),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            { dungeonExitTileId: 'exit', dungeonExitLockKind: 'iron' }
        );

        const report = inspectDungeonBoardTopology(source);

        expect(report.hasExitRoute).toBe(false);
        expect(report.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['topology_exit_lock_source_missing', 'topology_completion_route_missing'])
        );
        expect(formatDungeonBoardTopologyDiagnostics(report)).toContain('keys=none');
        expect(formatDungeonBoardTopologyIssue(report.issues[0]!, report)).toContain('exitRoute=false');
    });

    it('treats floor-local held keys as exit resources', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                dungeonKeysHeld: 1
            }
        );

        expect(inspectDungeonBoardTopology(source)).toMatchObject({
            obtainableKeyKinds: ['iron'],
            hasExitRoute: true,
            issues: []
        });
    });

    it('does not let legacy iron floor keys satisfy typed treasure locks', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure',
                dungeonKeysHeld: 1
            }
        );

        const report = inspectDungeonBoardTopology(source);

        expect(report.obtainableKeyKinds).toEqual([]);
        expect(report.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['topology_exit_lock_source_missing', 'topology_completion_route_missing'])
        );
        expect(formatDungeonBoardTopologyIssue(report.issues[0]!, report)).toContain('needs a treasure key');
    });

    it('lets typed floor-held keys satisfy their matching lock', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure',
                dungeonKeysHeld: 1,
                dungeonKeysHeldByKind: { treasure: 1 }
            }
        );

        expect(inspectDungeonBoardTopology(source)).toMatchObject({
            obtainableKeyKinds: ['treasure'],
            hasExitRoute: true,
            issues: []
        });
    });

    it('normalizes malformed carried and floor-held resources before topology reachability', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure',
                dungeonKeysHeldByKind: { treasure: Number.POSITIVE_INFINITY },
                dungeonLeverCount: Number.NaN
            }
        );

        const malformedCarriedKeys = { treasure: Number.NaN, missing_key: 1 } as DungeonBoardTopologyOptions['dungeonKeys'];
        const report = inspectDungeonBoardTopology(source, {
            dungeonKeys: malformedCarriedKeys,
            dungeonMasterKeys: Number.POSITIVE_INFINITY
        });

        expect(report.obtainableKeyKinds).toEqual([]);
        expect(report.graph.hasNode('run-key:missing_key')).toBe(false);
        expect(report.hasExitRoute).toBe(false);
        expect(report.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['topology_exit_lock_source_missing'])
        );
    });

    it('treats carried run keys as typed exit resources', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure'
            }
        );

        const report = inspectDungeonBoardTopology(source, { dungeonKeys: { treasure: 1 } });

        expect(report).toMatchObject({
            obtainableKeyKinds: ['treasure'],
            hasExitRoute: true,
            issues: []
        });
        expect(report.graph.hasNode('run-key:treasure')).toBe(true);
        expect(report.graph.outboundNeighbors('run-key:treasure')).toContain('exit:exit');
        expect(formatDungeonBoardTopologyDiagnostics(report)).toContain('keys=treasure');
    });

    it('does not let carried run keys satisfy mismatched typed locks', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure'
            }
        );

        const report = inspectDungeonBoardTopology(source, { dungeonKeys: { iron: 1 } });

        expect(report.obtainableKeyKinds).toEqual(['iron']);
        expect(report.hasExitRoute).toBe(false);
        expect(report.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['topology_exit_lock_source_missing', 'topology_completion_route_missing'])
        );
    });

    it('returns obtainable key kinds in deterministic order', () => {
        const source = board(
            [
                tile('iron-a', 'iron', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('iron-b', 'iron', { dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                })
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'treasure'
            }
        );

        expect(inspectDungeonBoardTopology(source, { dungeonKeys: { treasure: 1 } }).obtainableKeyKinds).toEqual([
            'iron',
            'treasure'
        ]);
    });

    it('treats carried master keys as wildcard exit resources in diagnostics', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                })
            ],
            {
                pairCount: 1,
                matchedPairs: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        );

        const report = inspectDungeonBoardTopology(source, { dungeonMasterKeys: 1 });

        expect(report).toMatchObject({
            obtainableKeyKinds: [],
            masterKeyCount: 1,
            hasExitRoute: true,
            issues: []
        });
        expect(formatDungeonBoardTopologyDiagnostics(report)).toContain('masterKeys=1');
    });

    it('surfaces boss objective routes from boss cards and boss hazards', () => {
        const bossCard = board(
            [
                tile('boss-a', 'boss', {
                    dungeonCardKind: 'enemy',
                    dungeonBossId: 'trap_warden',
                    dungeonCardHp: 2,
                    dungeonCardMaxHp: 2
                }),
                tile('boss-b', 'boss', {
                    dungeonCardKind: 'enemy',
                    dungeonBossId: 'trap_warden',
                    dungeonCardHp: 2,
                    dungeonCardMaxHp: 2
                }),
                tile('exit', EXIT_PAIR_KEY, { dungeonCardKind: 'exit', dungeonExitLockKind: 'none' })
            ],
            {
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                dungeonExitTileId: 'exit'
            }
        );
        const bossHazard = board(
            [tile('a1', 'a'), tile('a2', 'a'), tile('exit', EXIT_PAIR_KEY, { dungeonCardKind: 'exit' })],
            {
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                dungeonExitTileId: 'exit',
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
                        hp: 2,
                        maxHp: 2,
                        bossId: 'trap_warden'
                    }
                ]
            }
        );

        expect(inspectDungeonBoardTopology(bossCard)).toMatchObject({ hasBossRoute: true, issues: [] });
        expect(inspectDungeonBoardTopology(bossHazard)).toMatchObject({ hasBossRoute: true, issues: [] });
    });

    it('does not flag stale boss patrols after all real pairs are cleared', () => {
        const source = board(
            [
                tile('a1', 'a', { state: 'matched' }),
                tile('a2', 'a', { state: 'matched' }),
                tile('exit', EXIT_PAIR_KEY, {
                    state: 'flipped',
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'none'
                })
            ],
            {
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                dungeonExitTileId: 'exit',
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
            }
        );

        const report = inspectDungeonBoardTopology(source);

        expect(report.hasBossRoute).toBe(false);
        expect(report.issues.map((issue) => issue.code)).not.toContain('topology_boss_source_missing');
        expect(report.issues).toEqual([]);
    });

    it('checks run-map topology reachability with selected route edges', () => {
        const initial = createDungeonRunMapState(501, GAME_RULES_VERSION, 1);
        const revealed = revealDungeonChoices(initial, 1, [
            { id: 'choice:safe', routeType: 'safe', label: 'Safe passage', detail: 'Stable route.' },
            { id: 'choice:greed', routeType: 'greed', label: 'Greedy route', detail: 'Risk route.' }
        ]);
        const selected = selectDungeonNode(revealed, 'choice:greed');

        const report = inspectDungeonRunMapTopology(selected);

        expect(report.reachableNodeIds.sort()).toEqual(['choice:greed', 'choice:safe', initial.currentNodeId].sort());
        expect(report.legalTargetIds.sort()).toEqual(['choice:greed']);
        expect(report.issues).toEqual([]);
        expect(formatDungeonRunMapTopologyDiagnostics(report)).toContain('legalTargets=choice:greed');
    });

    it('reports missing current run-map nodes without pretending anything is reachable', () => {
        const state = createDungeonRunMapState(503, GAME_RULES_VERSION, 2);
        const damaged = {
            ...state,
            currentNodeId: 'missing-current'
        };

        const report = inspectDungeonRunMapTopology(damaged);

        expect(report).toMatchObject({
            reachableNodeIds: [],
            legalTargetIds: [],
            issues: [
                expect.objectContaining({
                    code: 'topology_current_missing',
                    nodeId: 'missing-current'
                })
            ]
        });
        expect(formatDungeonRunMapTopologyIssue(report.issues[0]!, report)).toContain('current=floor-2:lane-0:combat');
    });

    it('flags revealed future run-map nodes without a current edge', () => {
        const initial = createDungeonRunMapState(502, GAME_RULES_VERSION, 1);
        const revealed = revealDungeonChoices(initial, 1, [
            { id: 'choice:safe', routeType: 'safe', label: 'Safe passage', detail: 'Stable route.' }
        ]);
        const damaged = {
            ...revealed,
            nodes: [
                ...revealed.nodes,
                {
                    ...revealed.nodes.find((node) => node.id === 'choice:safe')!,
                    id: 'orphan',
                    floor: 3,
                    status: 'revealed' as const
                }
            ]
        };

        expect(inspectDungeonRunMapTopology(damaged).issues.map((issue) => issue.code)).toContain(
            'topology_revealed_future_unreachable'
        );
    });

    it('flags route graph corruption before graphology can normalize it away', () => {
        const state = createDungeonRunMapState(504, GAME_RULES_VERSION, 2);
        const target = {
            ...state.nodes[0]!,
            id: 'blocked-target',
            floor: 3,
            status: 'hidden' as const
        };
        const damaged = {
            ...state,
            nodes: [
                { ...state.nodes[0]!, edgeIds: ['blocked-target', 'blocked-target'] },
                target,
                { ...target }
            ]
        };

        expect(inspectDungeonRunMapTopology(damaged).issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining([
                'topology_duplicate_route_node',
                'topology_duplicate_route_edge',
                'topology_edge_target_blocked'
            ])
        );
    });

    it('keeps generated endless boards topology-valid across sampled seeds and floors', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 250_000 }),
                fc.integer({ min: 1, max: 18 }),
                fc.constantFrom('safe' as const, 'greed' as const, 'mystery' as const),
                (runSeed, floor, routeType) => {
                    const source = buildBoard(floor, {
                        gameMode: 'endless',
                        runSeed,
                        runRulesVersion: GAME_RULES_VERSION,
                        routeCardPlan:
                            floor > 1
                                ? {
                                      choiceId: `property:${routeType}:${runSeed}:${floor}`,
                                      routeType,
                                      sourceLevel: floor - 1,
                                      targetLevel: floor
                                  }
                                : undefined
                    });

                    expect(inspectDungeonBoardTopology(source).issues).toEqual([]);
                }
            ),
            { numRuns: 80, seed: 88_031 }
        );
    });
});
