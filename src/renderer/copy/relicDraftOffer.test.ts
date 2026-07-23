import { describe, expect, it } from 'vitest';
import { buildRelicDraftBonusFootnoteLines, getRelicDraftVisitTotals } from './relicDraftOffer';
import type { RunState } from '../../shared/contracts';

describe('relicDraftOffer', () => {
    it('getRelicDraftVisitTotals: start of visit', () => {
        expect(getRelicDraftVisitTotals({ tier: 1, options: [], picksRemaining: 3, pickRound: 0 })).toEqual({
            total: 3,
            currentPick: 1
        });
    });

    it('getRelicDraftVisitTotals: second pick', () => {
        expect(getRelicDraftVisitTotals({ tier: 1, options: [], picksRemaining: 2, pickRound: 1 })).toEqual({
            total: 3,
            currentPick: 2
        });
    });

    it('getRelicDraftVisitTotals: single pick visit', () => {
        expect(getRelicDraftVisitTotals({ tier: 1, options: [], picksRemaining: 1, pickRound: 0 })).toEqual({
            total: 1,
            currentPick: 1
        });
    });

    it('uses normalized relic reason rows for contextual footnotes', () => {
        const baseRun = {
            relicOffer: {
                tier: 1,
                options: [],
                picksRemaining: 1,
                pickRound: 0,
                contextualOptionReasons: {
                    unknown_relic: 'ignored'
                }
            },
            activeMutators: [],
            metaRelicDraftExtraPerMilestone: 0
        } as unknown as RunState;

        expect(buildRelicDraftBonusFootnoteLines(baseRun)).toEqual([]);
        expect(
            buildRelicDraftBonusFootnoteLines({
                ...baseRun,
                relicOffer: {
                    ...baseRun.relicOffer!,
                    contextualOptionReasons: {
                        chapter_compass: 'Improves future chapter drafts'
                    }
                }
            })
        ).toContain('At least one choice is chapter-aligned for this Endless route.');
    });
});
