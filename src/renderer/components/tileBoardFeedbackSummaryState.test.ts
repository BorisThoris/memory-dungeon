import { describe, expect, it } from 'vitest';
import {
    buildBoardChainFeedbackSummaryState,
    buildBoardLiveMessage
} from './tileBoardFeedbackSummaryState';

describe('tileBoardFeedbackSummaryState', () => {
    it('builds chain feedback summary state', () => {
        expect(
            buildBoardChainFeedbackSummaryState({
                opportunity: {
                    arcadeCallout: null,
                    armedPerkDetail: null,
                    armedPerkLabel: null,
                    armedPerkPayoff: null,
                    beatSignal: null,
                    chainReadyCount: 0,
                    chainReadyTileCount: 0,
                    chaseLabel: null,
                    comboSurgeLabel: null,
                    cue: 'Prime route',
                    examples: [],
                    lines: [],
                    milestoneActionLabel: null,
                    milestoneBeatCount: 0,
                    milestoneMeterFill: 0,
                    milestoneScreenCue: null,
                    milestoneTargetLabel: null,
                    milestoneTier: null,
                    milestoneTone: null,
                    momentumLabel: null,
                    nextActionDetail: null,
                    nextActionId: 'follow-up',
                    nextActionLabel: 'Tap follow-up',
                    nextActionTone: 'ready',
                    nextTarget: null,
                    priorityLabel: null,
                    rewardCue: null,
                    rewardHot: false,
                    rewardUrgencyLabel: null,
                    rewardUrgencyTier: null,
                    selectedFollowupCount: 1,
                    selectedFollowupLabel: null,
                    setupAction: null,
                    setupCount: 0,
                    setupHint: null,
                    setupStackCue: null,
                    setupStackDetail: null,
                    streakCashoutReady: false,
                    targetPlanLabel: null,
                    tone: 'ready'
                },
                sequenceCue: {
                    first: 'Mark route.',
                    keep: 'Hold streak!',
                    then: 'Cash stack?',
                    tone: 'followup'
                }
            })
        ).toEqual({
            cueMeterFill: 75,
            cueMeterState: 'followup',
            nextActionMeterFill: 75,
            nextActionTier: 'tap',
            nextActionVerb: 'Tap',
            priorityId: 'followup',
            sequenceAccessibleLabel: 'Chain sequence. First: Mark route. Then: Cash stack. Keep: Hold streak.'
        });
    });

    it('builds board live message content', () => {
        expect(
            buildBoardLiveMessage({
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
                boardOpportunityLaneMapLiveText: ' Lane map says cash first.',
                boardPayoffStack: {
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
                },
                focusedTileLabel: 'Rune tile',
                rewardLead: {
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
                traitModeCue: {
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
            })
        ).toContain('Focus: Rune tile');
    });

    it('returns empty live text when there is no focused tile label', () => {
        expect(
            buildBoardLiveMessage({
                boardChainAccessibilitySummary: {
                    followupCount: 0,
                    label: 'Idle',
                    payoffStackCount: 0,
                    primaryLine: 'Idle',
                    readyCount: 0,
                    rewardHotCount: 0,
                    secondaryLine: null,
                    setupCount: 0,
                    surgeCount: 0,
                    tone: 'idle'
                },
                boardOpportunityCompassRows: [],
                boardOpportunityLaneMapLiveText: '',
                boardPayoffStack: null,
                focusedTileLabel: null,
                rewardLead: null,
                traitModeCue: null
            })
        ).toBe('');
    });
});
