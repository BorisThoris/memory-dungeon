import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { useTileBoardFeedbackRuntime } from './useTileBoardFeedbackRuntime';

vi.mock('../audio/gameSfx', () => ({
    playChainOpportunityBeatSfx: vi.fn(),
    resumeAudioContext: vi.fn().mockResolvedValue(undefined)
}));

const baseBoard: BoardState = {
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    matchedPairs: 0,
    flippedTileIds: ['a1', 'a2'],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

const boardFeedbackModelState = {
    boardChainAccessibilitySummary: {
        followupCount: 0,
        label: '1 route ready.',
        payoffStackCount: 0,
        primaryLine: 'Route ready',
        readyCount: 1,
        rewardHotCount: 0,
        secondaryLine: null,
        setupCount: 0,
        surgeCount: 0,
        tone: 'ready'
    },
    boardChainOpportunity: {
        arcadeCallout: null,
        armedPerkLabel: null,
        armedPerkPayoff: null,
        beatSignal: {
            action: 'Cash now',
            audioCue: 'cashout-beat',
            beatCount: 5,
            detail: 'Cash route',
            label: 'Cash route',
            screenCue: 'burst',
            tier: 'cashout'
        },
        chainReadyCount: 1,
        chainReadyTileCount: 2,
        chaseLabel: null,
        comboSurgeLabel: null,
        cue: 'Cash route',
        examples: ['Cash route'],
        lines: ['Cash route'],
        milestoneActionLabel: 'Cash route',
        milestoneBeatCount: 5,
        milestoneMeterFill: 100,
        milestoneScreenCue: 'burst',
        milestoneTargetLabel: '2 pairs',
        milestoneTier: 'cashout',
        milestoneTone: 'cashout',
        momentumLabel: null,
        nextActionDetail: 'Cash now',
        nextActionId: 'cashout',
        nextActionLabel: 'Cash now',
        nextActionTone: 'cashout',
        nextTarget: '2 pairs',
        priorityLabel: 'Best',
        rewardCue: 'Reward ready',
        rewardHot: true,
        rewardUrgencyLabel: 'Now',
        rewardUrgencyTier: 'next',
        selectedFollowupCount: 0,
        selectedFollowupLabel: null,
        setupCount: 0,
        streakCashoutReady: true,
        targetPlanLabel: 'Cash route',
        tone: 'cashout'
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
        lead: null,
        leadAccessibleLabel: undefined,
        summaryAction: 'cashout',
        summaryBeatCount: 5,
        summaryMeterFill: 100,
        summaryScreenCue: 'burst',
        summaryTier: 'cashout'
    },
    boardTraitModeCue: null
} as const;

describe('useTileBoardFeedbackRuntime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('manages live message, trap resolution feedback, and reduced-motion resolution summary', async () => {
        const { result, rerender } = renderHook(
            ({ resolvedTrapTileCount }: { resolvedTrapTileCount: number }) =>
            useTileBoardFeedbackRuntime({
                board: baseBoard,
                boardFeedbackModelState,
                resolvedTrapTileCount,
                runStatus: 'resolving',
                shuffleSfxGain: 1
            }),
            { initialProps: { resolvedTrapTileCount: 0 } }
        );

        rerender({ resolvedTrapTileCount: 2 });

        await waitFor(() => {
            expect(result.current.lastResolutionFeedback).toBe('match:2');
            expect(result.current.trapResolutionMessage).toContain('Trap resolved: Snare');
            expect(result.current.trapResolutionDetails?.effect).toBe('Trap effect paid');
        });
    });
});
