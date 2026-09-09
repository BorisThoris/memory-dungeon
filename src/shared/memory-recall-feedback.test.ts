import { describe, expect, it } from 'vitest';
import {
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type MutatorId,
    type RunState
} from './contracts';
import { getMemoryRecallFeedback } from './memory-recall-feedback';
import { makeRun, makeTile } from './test/game-fixtures';

describe('getMemoryRecallFeedback', () => {
    it('surfaces forgotten symbols, focus bonus, and memory burden', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'Rune A'),
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
                    perfect: false,
                    mistakes: 1
                }
            }
        );

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.focusLabel).toBe('locked');
        expect(feedback.roomIdentity).toBe('Floor 1');
        expect(feedback.atmosphericSummary).toBe('The archive holds, but the next clean match needs a deliberate read.');
        expect(feedback.atmosphericBeat).toBe(
            'Floor 1: the room still answers, but the next match needs one clean remembered symbol.'
        );
        expect(feedback.pressureDetail).toBe(
            'Recall is strained: recover forgotten markers before route pressure stacks higher.'
        );
        expect(feedback.nextMemoryMove).toEqual(
            expect.objectContaining({
                id: 'next-memory-move-forgotten',
                label: 'Recover forgotten marks',
                tone: 'danger'
            })
        );
        expect(feedback.nextCleanMatchBonus).toBe(RECALL_FOCUS_MATCH_SCORE * 2);
        expect(feedback.forgottenSymbols).toEqual(['Rune B']);
        expect(feedback.pressure).toBe('strained');
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
            score: 4,
            label: 'loaded',
            detail: 'Memory burden is loaded with 1 forgotten mark, 1 partial symbol read; keep the next action tied to an existing clue.',
            tone: 'watch'
        });
        expect(feedback.penalties.map((line) => line.id)).toContain('recall-mistakes');
    });





    it('adds clear and overloaded atmosphere without changing mechanical counters', () => {
        const clearRun = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            recallFocus: 2
        });
        const overloadedRun = makeRun(
            [
                makeTile('a1', 'A', 'Rune A'),
                makeTile('a2', 'A', 'Rune A'),
                makeTile('b1', 'B', 'Rune B'),
                makeTile('b2', 'B', 'Rune B')
            ],
            {
                recallMistakesThisFloor: 2,
                forgottenTileIdsThisFloor: ['a1', 'a2', 'b1']
            } satisfies Partial<RunState>
        );

        const clearFeedback = getMemoryRecallFeedback(clearRun);
        const overloadedFeedback = getMemoryRecallFeedback(overloadedRun);

        expect(clearFeedback.pressure).toBe('clear');
        expect(clearFeedback.atmosphericSummary).toBe('The route is legible; clean recall is carrying the room.');
        expect(clearFeedback.atmosphericBeat).toBe(
            'Floor 1: focus is locked; the route marks are holding steady.'
        );
        expect(overloadedFeedback.pressure).toBe('overloaded');
        expect(overloadedFeedback.atmosphericSummary).toContain('old symbols scrape');
        expect(overloadedFeedback.atmosphericBeat).toContain('the archive margins are full');
        expect(overloadedFeedback.pressureDetail).toContain('3 forgotten tile markers');
        expect(overloadedFeedback.burden).toEqual(
            expect.objectContaining({
                score: 8,
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



    it('maps symbol memory into known pairs, partial reads, hidden pairs, and cleared pairs', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'Rune A', { state: 'flipped' }),
                makeTile('a2', 'A', 'Rune A', { state: 'flipped' }),
                makeTile('b1', 'B', 'Rune B'),
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

    it('labels recall plan entries from unresolved tiles when the pair lead is cleared', () => {
        const run = makeRun(
            [
                makeTile('a1', 'A', 'Cleared Rune', { state: 'matched' }),
                makeTile('a2', 'A', 'Live Rune'),
                makeTile('b1', 'B', 'Rune B'),
                makeTile('b2', 'B', 'Rune B')
            ],
            {
                forgottenTileIdsThisFloor: ['a2']
            }
        );

        expect(getMemoryRecallFeedback(run).recallPlan[0]).toEqual(
            expect.objectContaining({
                id: 'recall-plan-forget-risk',
                label: 'Forgetting risk: Live Rune'
            })
        );
    });

    it('keeps singleton utility cards out of pair-memory counters', () => {
        const run = makeRun([
            makeTile('a1', 'A', 'Rune A'),
            makeTile('a2', 'A', 'Rune A'),
            makeTile('exit', '__exit__', 'Exit'),
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

    it('surfaces active memory taxes without changing score counters', () => {
        const run = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            activeMutators: ['short_memorize', 'wide_recall', 'shifting_spotlight'],
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
        expect(feedback.upgrades.map((line) => line.id)).toEqual(['next-clean-match']);
        expect(feedback.focus).toBe(1);
    });

    it('ignores malformed memory arrays before building feedback copy', () => {
        const run = makeRun([makeTile('a1', 'A', 'A'), makeTile('a2', 'A', 'A')], {
            activeMutators: Number.NaN as unknown as MutatorId[],
            pinnedTileIds: Number.NaN as unknown as string[],
            forgottenTileIdsThisFloor: Number.NaN as unknown as string[],
            recallFocus: 1
        });

        const feedback = getMemoryRecallFeedback(run);

        expect(feedback.penalties.map((line) => line.id)).not.toContain('memory-tax-short_memorize');
        expect(feedback.symbols.map((line) => line.id)).not.toContain('pinned-symbols');
        expect(feedback.forgottenTileCount).toBe(0);
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
