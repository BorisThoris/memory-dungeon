import { describe, expect, it } from 'vitest';
import {
    RECALL_CLUE_MATCH_SCORE,
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type RouteChoice,
    type RunState
} from './contracts';
import { getMemoryRecallFeedback } from './memory-recall-feedback';
import { createDungeonRunMapState } from './run-map';
import { makeRun, makeTile } from './test/game-fixtures';

const routeChoices: RouteChoice[] = [
    {
        id: 'route:safe',
        routeType: 'safe',
        label: 'Safe passage',
        detail: 'Recover before the next room.',
        rewardPreview: '+1 life.'
    },
    {
        id: 'route:greed',
        routeType: 'greed',
        label: 'Greedy route',
        detail: 'Push for value.',
        rewardPreview: '+6 gold.',
        riskPreview: '-1 life.'
    },
    {
        id: 'route:mystery',
        routeType: 'mystery',
        label: 'Mystery route',
        detail: 'Unknown side-room hook.'
    }
];

describe('getMemoryRecallFeedback', () => {
    it('surfaces remembered clues, forgotten symbols, focus bonus, and route choices', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'Rune A', {
                    routeSpecialKind: 'mystery_veil',
                    routeSpecialRevealed: true
                }),
                makeTile('a2', 'A', 'Rune A'),
                makeTile('b1', 'B', 'Rune B'),
                makeTile('b2', 'B', 'Rune B')
            ],
            {
                gameMode: 'endless',
                recallFocus: 2,
                recallMistakesThisFloor: 1,
                forgottenTileIdsThisFloor: ['b1'],
                pinnedTileIds: ['a1'],
                lastLevelResult: {
                    level: 1,
                    scoreGained: 100,
                    rating: 'A',
                    livesRemaining: 4,
                    perfect: false,
                    mistakes: 1,
                    clearLifeReason: 'none',
                    clearLifeGained: 0,
                    routeChoices
                }
            }
        );

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.focusLabel).toBe('locked');
        expect(feedback.roomIdentity).toBe('Threshold Archive');
        expect(feedback.atmosphericSummary).toBe('The archive holds, but the next clean match needs a deliberate read.');
        expect(feedback.atmosphericBeat).toBe(
            'Threshold Archive: the room still answers, but the next match needs one clean remembered symbol.'
        );
        expect(feedback.pressureDetail).toBe(
            'Recall is strained: recover forgotten markers before route or patrol pressure stacks higher.'
        );
        expect(feedback.nextMemoryMove).toEqual(
            expect.objectContaining({
                id: 'next-memory-move-forgotten',
                label: 'Recover forgotten marks',
                tone: 'danger'
            })
        );
        expect(feedback.nextCleanMatchBonus).toBe(RECALL_FOCUS_MATCH_SCORE * 2 + RECALL_CLUE_MATCH_SCORE);
        expect(feedback.rememberedClueTileCount).toBe(1);
        expect(feedback.forgottenSymbols).toEqual(['Rune B']);
        expect(feedback.pressure).toBe('strained');
        expect(feedback.clues.map((line) => line.id)).toContain('remembered-clues');
        expect(feedback.symbols.map((line) => line.id)).toEqual(['symbol-memory-map', 'forgotten-symbols', 'pinned-symbols']);
        expect(feedback.recallPlan).toEqual([
            expect.objectContaining({
                id: 'recall-plan-forget-risk',
                label: 'Forgetting risk: Rune B',
                tone: 'danger'
            }),
            expect.objectContaining({
                id: 'recall-plan-partial-reads',
                label: 'Remember next: Rune A',
                tone: 'watch'
            })
        ]);
        expect(feedback.symbolMap).toEqual(
            expect.objectContaining({
                knownPairCount: 0,
                partialPairCount: 1,
                hiddenPairCount: 1,
                forgottenIntersectionCount: 1
            })
        );
        expect(feedback.burden).toEqual({
            score: 6,
            label: 'taxed',
            detail: 'Memory burden is taxed by 1 forgotten mark, 1 partial symbol read, 3 route decisions; cash in a known pair or choose the safer route.',
            tone: 'watch'
        });
        expect(feedback.penalties.map((line) => line.id)).toContain('recall-mistakes');
        expect(feedback.choices).toEqual([
            expect.objectContaining({ id: 'route:safe', tone: 'stable', readiness: 'ready' }),
            expect.objectContaining({ id: 'route:greed', tone: 'danger', readiness: 'unsafe', consequence: '+6 gold. -1 life.' }),
            expect.objectContaining({ id: 'route:mystery', tone: 'watch', readiness: 'ready' })
        ]);
        expect(feedback.choices.map((choice) => choice.atmosphericCue)).toEqual([
            'A steadier corridor keeps its marks close to the wall.',
            'The louder stair promises value, but every card remembers the noise.',
            'The unindexed door offers a clue first and an answer later.'
        ]);
    });

    it('calls out patrol and revealed enemy memory pressure', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'A', {
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'revealed'
                }),
                makeTile('a2', 'A', 'A'),
                makeTile('b1', 'B', 'B'),
                makeTile('b2', 'B', 'B')
            ],
            {
                board: {
                    ...makeRun([]).board!,
                    level: 3,
                    pairCount: 2,
                    columns: 2,
                    rows: 2,
                    tiles: [
                        makeTile('a1', 'A', 'A', {
                            dungeonCardKind: 'enemy',
                            dungeonCardState: 'revealed'
                        }),
                        makeTile('a2', 'A', 'A'),
                        makeTile('b1', 'B', 'B'),
                        makeTile('b2', 'B', 'B')
                    ],
                    enemyHazards: [
                        {
                            id: 'sentinel-1',
                            kind: 'sentinel',
                            label: 'Sentinel',
                            currentTileId: 'b1',
                            nextTileId: 'b2',
                            pattern: 'patrol',
                            state: 'revealed',
                            damage: 1,
                            hp: 1,
                            maxHp: 1
                        }
                    ]
                }
            } satisfies Partial<RunState>
        );

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.pressure).toBe('strained');
        expect(feedback.pressureDetail).toBe(
            'Recall is strained: hold 2 active threat reads in memory before route or patrol pressure stacks higher.'
        );
        expect(feedback.nextMemoryMove).toEqual(
            expect.objectContaining({
                id: 'next-memory-move-threat',
                label: 'Read patrol positions',
                tone: 'watch'
            })
        );
        expect(feedback.enemies).toEqual([
            expect.objectContaining({ id: 'enemy-hazard-memory', tone: 'danger' }),
            expect.objectContaining({ id: 'revealed-enemy-cards', tone: 'watch' })
        ]);
    });

    it('includes path memory from route-world boards and dungeon map state', () => {
        const dungeonRun = createDungeonRunMapState(7, 1, 2);
        const run = makeRun(
            [makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')],
            {
                dungeonRun,
                board: {
                    ...makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')]).board!,
                    routeWorldProfile: {
                        routeType: 'greed',
                        intensity: 'greed',
                        choiceId: 'choice:greed',
                        sourceLevel: 1,
                        targetLevel: 2,
                        hazardBudget: 3,
                        rewardBudget: 4,
                        safetyBudget: 0,
                        informationBudget: 1,
                        routeSpecialKinds: ['greed_cache'],
                        summary: 'Greed cache route adds pressure and reward.'
                    }
                }
            }
        );

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.path).toEqual([
            expect.objectContaining({ id: 'route-world-profile', tone: 'danger' }),
            expect.objectContaining({ id: 'current-dungeon-node' }),
            expect.objectContaining({
                id: 'room-atmosphere',
                label: 'Room log clear',
                detail: 'The room is quiet enough to rebuild focus before the next branch.',
                tone: 'stable'
            })
        ]);
    });

    it('adds clear and overloaded atmosphere without changing mechanical counters', () => {
        const clearRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2
        });
        const overloadedRun = makeRun(
            [
                makeTile('a1', 'A', 'Rune A'),
                makeTile('a2', 'A', 'Rune A'),
                makeTile('b1', 'B', 'Rune B', {
                    dungeonCardKind: 'enemy',
                    dungeonCardState: 'revealed'
                }),
                makeTile('b2', 'B', 'Rune B')
            ],
            {
                recallMistakesThisFloor: 2,
                forgottenTileIdsThisFloor: ['a1', 'a2', 'b1'],
                board: {
                    ...makeRun([]).board!,
                    level: 4,
                    pairCount: 2,
                    columns: 2,
                    rows: 2,
                    tiles: [
                        makeTile('a1', 'A', 'Rune A'),
                        makeTile('a2', 'A', 'Rune A'),
                        makeTile('b1', 'B', 'Rune B', {
                            dungeonCardKind: 'enemy',
                            dungeonCardState: 'revealed'
                        }),
                        makeTile('b2', 'B', 'Rune B')
                    ],
                    enemyHazards: [
                        {
                            id: 'sentinel-2',
                            kind: 'sentinel',
                            label: 'Sentinel',
                            currentTileId: 'b1',
                            nextTileId: 'b2',
                            pattern: 'patrol',
                            state: 'revealed',
                            damage: 1,
                            hp: 1,
                            maxHp: 1
                        }
                    ]
                }
            } satisfies Partial<RunState>
        );

        const clearFeedback = getMemoryRecallFeedback(clearRun);
        const overloadedFeedback = getMemoryRecallFeedback(overloadedRun);

        expect(clearFeedback.pressure).toBe('clear');
        expect(clearFeedback.atmosphericSummary).toBe('The route is legible; clean recall is carrying the room.');
        expect(clearFeedback.atmosphericBeat).toBe(
            'Threshold Archive: focus is locked; the route marks are holding steady.'
        );
        expect(overloadedFeedback.pressure).toBe('overloaded');
        expect(overloadedFeedback.atmosphericSummary).toContain('old symbols scrape');
        expect(overloadedFeedback.atmosphericBeat).toContain('the archive margins are full');
        expect(overloadedFeedback.pressureDetail).toContain('3 forgotten tile markers');
        expect(overloadedFeedback.burden).toEqual(
            expect.objectContaining({
                score: 13,
                label: 'breaking',
                tone: 'danger'
            })
        );
        expect(overloadedFeedback.burden.detail).toContain('repair known information');
        expect(overloadedFeedback.path).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'room-atmosphere',
                    label: 'Room log overloaded',
                    tone: 'danger'
                })
            ])
        );
        expect(overloadedFeedback.forgottenTileCount).toBe(3);
    });

    it('prioritizes route choice memory prompts before cashing in clean recall', () => {
        const baseChoices: RouteChoice[] = [
            {
                id: 'route:greed',
                routeType: 'greed',
                label: 'Greed',
                detail: 'Risk memory for more value.'
            },
            {
                id: 'route:mystery',
                routeType: 'mystery',
                label: 'Mystery',
                detail: 'Unknown clue route.'
            }
        ];
        const warmingRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 1,
            lastLevelResult: {
                level: 2,
                scoreGained: 80,
                rating: 'B',
                livesRemaining: 3,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices: baseChoices
            }
        });
        const lockedMysteryRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2,
            lastLevelResult: {
                level: 2,
                scoreGained: 80,
                rating: 'B',
                livesRemaining: 3,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices: baseChoices.filter((choice) => choice.routeType === 'mystery')
            }
        });
        const cleanRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2
        });

        expect(getMemoryRecallFeedback(warmingRun).nextMemoryMove).toEqual(
            expect.objectContaining({ id: 'next-memory-move-greed', tone: 'watch' })
        );
        expect(getMemoryRecallFeedback(lockedMysteryRun).nextMemoryMove).toEqual(
            expect.objectContaining({ id: 'next-memory-move-mystery', tone: 'watch' })
        );
        expect(getMemoryRecallFeedback(cleanRun).nextMemoryMove).toEqual(
            expect.objectContaining({ id: 'next-memory-move-cash-in', tone: 'reward' })
        );
    });

    it('grades route choices against current recall pressure', () => {
        const greedReadyRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2,
            lastLevelResult: {
                level: 2,
                scoreGained: 80,
                rating: 'A',
                livesRemaining: 4,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                routeChoices: [routeChoices[1]!]
            }
        });
        const mysteryThinRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2,
            lastLevelResult: {
                level: 2,
                scoreGained: 80,
                rating: 'A',
                livesRemaining: 4,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                routeChoices: [routeChoices[2]!]
            }
        });

        expect(getMemoryRecallFeedback(greedReadyRun).choices[0]).toEqual(
            expect.objectContaining({
                readiness: 'ready',
                readinessLabel: 'Greed is supportable while focus is locked.'
            })
        );
        expect(getMemoryRecallFeedback(mysteryThinRun).choices[0]).toEqual(
            expect.objectContaining({
                readiness: 'risky',
                readinessLabel: 'Mystery is thin until one clue source is remembered.'
            })
        );
    });

    it('maps symbol memory into known pairs, partial reads, hidden pairs, and cleared pairs', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'Rune A', { state: 'flipped' }),
                makeTile('a2', 'A', 'Rune A', { state: 'flipped' }),
                makeTile('b1', 'B', 'Rune B', { lanternScouted: true }),
                makeTile('b2', 'B', 'Rune B'),
                makeTile('c1', 'C', 'Rune C'),
                makeTile('c2', 'C', 'Rune C'),
                makeTile('d1', 'D', 'Rune D', { state: 'matched' }),
                makeTile('d2', 'D', 'Rune D', { state: 'matched' })
            ],
            {
                forgottenTileIdsThisFloor: ['c1'],
                pinnedTileIds: ['b1']
            }
        );

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.symbolMap).toEqual({
            knownPairCount: 1,
            partialPairCount: 1,
            hiddenPairCount: 1,
            clearedPairCount: 1,
            pinnedIntersectionCount: 1,
            forgottenIntersectionCount: 1,
            nextSymbolPrompt: 'Repair forgotten intersections before spending route pressure.'
        });
        expect(feedback.symbols[0]).toEqual(
            expect.objectContaining({
                id: 'symbol-memory-map',
                label: '1 known pair / 1 partial read',
                detail: 'Repair forgotten intersections before spending route pressure. 1 hidden pair remains unindexed.',
                tone: 'danger'
            })
        );
        expect(feedback.recallPlan).toEqual([
            expect.objectContaining({
                id: 'recall-plan-forget-risk',
                label: 'Forgetting risk: Rune C',
                tone: 'danger'
            }),
            expect.objectContaining({
                id: 'recall-plan-known-pairs',
                label: 'Recall now: Rune A',
                tone: 'reward'
            }),
            expect.objectContaining({
                id: 'recall-plan-partial-reads',
                label: 'Remember next: Rune B',
                tone: 'watch'
            })
        ]);
    });

    it('keeps singleton utility cards out of pair-memory counters', () => {
        const run = makeRun([
            makeTile('a1', 'A', 'Rune A'),
            makeTile('a2', 'A', 'Rune A'),
            makeTile('exit', '__exit__', 'Exit'),
            makeTile('shop', '__shop__', 'Shop'),
            makeTile('room', '__room__', 'Room'),
            makeTile('decoy', '__decoy__', 'Decoy'),
            makeTile('wild', '__wild__', 'Wild')
        ]);

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.symbolMap).toEqual(
            expect.objectContaining({
                knownPairCount: 0,
                partialPairCount: 0,
                hiddenPairCount: 1,
                clearedPairCount: 0
            })
        );
        expect(feedback.burden).toEqual({
            score: 0,
            label: 'light',
            detail: 'The room log is light; use the next flip to create a reliable recall anchor.',
            tone: 'stable'
        });
        expect(feedback.symbols[0]).toEqual(
            expect.objectContaining({
                label: '0 known pairs / 0 partial reads',
                detail: 'Open one safe clue and start a fresh symbol trail. 1 hidden pair remains unindexed.'
            })
        );
        expect(feedback.recallPlan).toEqual([
            expect.objectContaining({
                id: 'recall-plan-fresh-read',
                tone: 'stable'
            })
        ]);
    });

    it('surfaces active memory taxes and owned recall assists without changing score counters', () => {
        const run = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            activeMutators: ['short_memorize', 'wide_recall', 'shifting_spotlight'],
            relicIds: ['memorize_under_short_memorize', 'peek_charge_plus_one', 'pin_cap_plus_one', 'chapter_compass'],
            peekCharges: 2,
            pinnedTileIds: ['a1'],
            recallFocus: 1,
            recallBonusScoreThisFloor: 0
        });

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.nextCleanMatchBonus).toBe(RECALL_FOCUS_MATCH_SCORE);
        expect(feedback.penalties).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'memory-tax-short_memorize',
                    label: 'Short study tax',
                    tone: 'danger'
                }),
                expect.objectContaining({
                    id: 'memory-tax-wide_recall',
                    detail: expect.stringContaining('partial reads decay faster')
                }),
                expect.objectContaining({
                    id: 'memory-tax-shifting_spotlight',
                    label: 'Spotlight tax'
                })
            ])
        );
        expect(feedback.upgrades).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'memory-assist-short-memorize-answer',
                    detail: 'This relic directly answers the active short-study tax.',
                    tone: 'reward'
                }),
                expect.objectContaining({
                    id: 'memory-assist-peek-charge',
                    label: '2 peek reads ready'
                }),
                expect.objectContaining({
                    id: 'memory-assist-pin-cap',
                    detail: expect.stringContaining('safer path')
                }),
                expect.objectContaining({
                    id: 'memory-assist-chapter-compass',
                    tone: 'reward'
                })
            ])
        );
        expect(feedback.focus).toBe(1);
        expect(feedback.rememberedClueTileCount).toBe(0);
    });

    it('normalizes stale recall focus before showing next-match bonus', () => {
        const highFocusRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 99
        });
        const negativeFocusRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: -4
        });

        expect(getMemoryRecallFeedback(highFocusRun)).toEqual(
            expect.objectContaining({
                focus: RECALL_FOCUS_MAX,
                focusLabel: 'locked',
                nextCleanMatchBonus: RECALL_FOCUS_MATCH_SCORE * RECALL_FOCUS_MAX
            })
        );
        expect(getMemoryRecallFeedback(negativeFocusRun)).toEqual(
            expect.objectContaining({
                focus: 0,
                focusLabel: 'unfocused',
                nextCleanMatchBonus: 0
            })
        );
    });
});
