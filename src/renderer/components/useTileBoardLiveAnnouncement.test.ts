import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTileBoardLiveAnnouncement } from './useTileBoardLiveAnnouncement';

const boardFeedbackModelState = {
    boardChainAccessibilitySummary: {
        followupCount: 0,
        label: '2 routes ready.',
        payoffStackCount: 0,
        primaryLine: 'Routes ready',
        readyCount: 2,
        rewardHotCount: 0,
        secondaryLine: null,
        setupCount: 0,
        surgeCount: 0,
        tone: 'ready'
    },
    boardOpportunityCompassRows: [
        {
            action: 'Cash now',
            detail: 'Two pairs are primed',
            id: 'chain',
            impactCue: 'route cashout',
            label: 'Cash route',
            tone: 'chain',
            value: '2 pairs'
        }
    ],
    boardRewardLadderState: {
        accessibleLabel: 'Reward ladder',
        actionAttr: 'cashout',
        attr: 'next',
        entries: [],
        focusId: null,
        lead: {
            action: 'Prime reward',
            audioCue: 'board-reward-prime',
            beatCount: 3,
            chaseLabel: 'One more match',
            label: 'Iron key',
            meterFill: 60,
            progressLabel: '2 of 3',
            remainingLabel: '1 more',
            screenCue: 'pulse',
            tier: 'soon',
            tone: 'prime',
            urgencyLabel: 'Soon'
        },
        leadAccessibleLabel: undefined,
        summaryAction: 'cashout',
        summaryBeatCount: 5,
        summaryMeterFill: 100,
        summaryScreenCue: 'burst',
        summaryTier: 'cashout'
    },
    boardTraitModeCue: {
        action: 'prime',
        beatCount: 2,
        detail: 'Traits are charging nearby.',
        label: 'Trait mode',
        nextReward: 'Next reward sparks',
        screenCue: 'pulse',
        tier: 'prime',
        tone: 'setup',
        value: 'Prime traits'
    }
} as const;

const boardPayoffStack = {
    action: 'Cash route',
    crescendo: {
        beatCount: 4,
        detail: 'Stack is almost full',
        label: 'Hot ladder',
        screenCue: 'burst',
        tier: 'stack'
    },
    cue: 'Prime stack',
    cueId: 'prime',
    detail: 'Next match fills the bar',
    heat: 'prime',
    nextCue: 'Cash next',
    sequence: {
        first: 'Prime route',
        keep: 'Hold the stack',
        then: 'Cash reward'
    },
    sequenceCue: 'Prime, then cash',
    tone: 'setup',
    value: '3 chain'
} as const;

describe('useTileBoardLiveAnnouncement', () => {
    it('publishes the derived board live message from feedback state', async () => {
        let announcedMessage = '';
        const { rerender } = renderHook(
            ({ focusedTileLabel }: { focusedTileLabel: string | null }) =>
            useTileBoardLiveAnnouncement({
                announceBoardLiveMessage: (message) => {
                    announcedMessage = message;
                },
                boardFeedbackModelState,
                boardOpportunityLaneMapLiveText: ' Lane map says cash first.',
                boardPayoffStack,
                focusedTileLabel
            }),
            { initialProps: { focusedTileLabel: 'Rune tile' } }
        );

        await waitFor(() => {
            expect(announcedMessage).toContain('Focus: Rune tile');
            expect(announcedMessage).toContain('Best play: route cashout.');
            expect(announcedMessage).toContain('Next reward: Iron key.');
        });

        act(() => {
            rerender({ focusedTileLabel: 'Mirror tile' });
        });

        await waitFor(() => {
            expect(announcedMessage).toContain('Focus: Mirror tile');
        });
    });
});
