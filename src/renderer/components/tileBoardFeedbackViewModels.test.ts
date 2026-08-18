import { describe, expect, it } from 'vitest';
import {
    buildBoardChainActionPriorityViewData,
    buildBoardChainBeatMapViewData,
    buildBoardChainCadenceMapViewData,
    buildBoardChainMarkerKeyViewData,
    buildBoardChainOpportunitySurfaceViewData,
    buildBoardChainProgressionCuesViewData,
    buildBoardChainRewardLadderViewData,
    buildBoardChainShotMapViewData,
    buildBoardOpportunityLaneMapSurfaceViewData,
    buildBoardOpportunityCompassSurfaceViewData
} from './tileBoardFeedbackViewModels';

const baseOpportunity: Parameters<typeof buildBoardChainProgressionCuesViewData>[0]['opportunity'] = {
    arcadeCallout: null,
    armedPerkLabel: null,
    armedPerkPayoff: null,
    beatSignal: null,
    chainReadyCount: 1,
    chainReadyTileCount: 2,
    chaseLabel: null,
    comboSurgeLabel: 'Routes lit',
    cue: 'Prime route',
    examples: [],
    lines: [],
    milestoneActionLabel: 'Prime',
    milestoneBeatCount: 3,
    milestoneMeterFill: 75,
    milestoneScreenCue: 'pulse',
    milestoneTargetLabel: 'Cash chest',
    milestoneTier: 'prime',
    milestoneTone: 'build',
    momentumLabel: null,
    nextActionDetail: 'Cash soon',
    nextActionId: 'follow-up',
    nextActionLabel: 'Tap follow-up',
    nextActionTone: 'ready',
    nextTarget: 'Marked shard',
    priorityLabel: null,
    rewardCue: 'Cash out soon',
    rewardHot: false,
    rewardUrgencyLabel: 'Soon',
    rewardUrgencyTier: 'soon',
    selectedFollowupCount: 1,
    selectedFollowupLabel: 'Marked shard',
    streakCashoutReady: false,
    targetPlanLabel: 'Prime two matches'
};

describe('tileBoardFeedbackViewModels', () => {
    it('builds chain progression cue props', () => {
        expect(
            buildBoardChainProgressionCuesViewData({
                nextActionTier: 'tap',
                nextTargetBeatCount: 3,
                opportunity: baseOpportunity,
                sequenceAccessibleLabel: 'Chain sequence label',
                sequenceCue: {
                    first: 'Prime route',
                    keep: 'Hold streak',
                    then: 'Cash reward',
                    tone: 'followup'
                },
                targetPlanBeatCount: 3
            })
        ).toMatchObject({
            followupLabel: 'Marked shard',
            nextTarget: {
                actionId: 'follow-up',
                beatCount: 3,
                target: 'Marked shard',
                tier: 'tap',
                tone: 'ready'
            },
            sequenceCue: {
                accessibleLabel: 'Chain sequence label',
                first: 'Prime route',
                keep: 'Hold streak',
                then: 'Cash reward',
                tone: 'followup'
            },
            surgeLabel: 'Routes lit',
            targetPlan: {
                actionId: 'follow-up',
                beatCount: 3,
                label: 'Prime two matches'
            }
        });
    });

    it('builds chain reward ladder props', () => {
        expect(
            buildBoardChainRewardLadderViewData({
                hotBandTone: 'cashout',
                rewardLadder: {
                    accessibleLabel: 'Reward ladder',
                    actionAttr: 'prime|cashout',
                    attr: 'soon|next',
                    entries: [],
                    focusId: 'next',
                    lead: null,
                    leadAccessibleLabel: 'Lead label',
                    summaryAction: 'prime',
                    summaryBeatCount: 3,
                    summaryMeterFill: 66,
                    summaryScreenCue: 'pulse',
                    summaryTier: 'soon'
                }
            })
        ).toEqual({
            accessibleLabel: 'Reward ladder',
            entries: [],
            focusId: 'next',
            hotBandTone: 'cashout',
            ladderActionAttr: 'prime|cashout',
            ladderAttr: 'soon|next',
            lead: null,
            leadAccessibleLabel: 'Lead label',
            summaryAction: 'prime',
            summaryBeatCount: 3,
            summaryMeterFill: 66,
            summaryScreenCue: 'pulse',
            summaryTier: 'soon'
        });
    });

    it('builds shot map props and compass surface props', () => {
        const shotMap = buildBoardChainShotMapViewData({
            label: 'Shot map',
            primaryActionId: 'cash-now',
            primaryRow: {
                role: 'cashout',
                screenCue: 'burst',
                tone: 'cashout'
            },
            rows: [
                {
                    count: 3,
                    detail: 'Three shots',
                    id: 'cash-now',
                    role: 'cashout',
                    screenCue: 'burst',
                    shotLabel: 'Cash lane',
                    tone: 'cashout'
                }
            ],
            summaryAction: 'cashout',
            summaryBeatCount: 3,
            summaryScreenCue: 'burst',
            summaryTier: 'cashout'
        });
        expect(shotMap.primaryActionId).toBe('cash-now');

        const compass = buildBoardOpportunityCompassSurfaceViewData({
            bestOpportunity: { tone: 'chain' },
            chainOpportunity: { comboSurgeLabel: 'Routes lit' },
            compassLabel: 'Compass',
            heat: 'cashout',
            hotBandTone: 'cashout',
            meterFill: 80,
            payoffStack: null,
            rows: [
                {
                    action: 'Cash',
                    actionId: 'cashout',
                    ariaLabel: 'Cash label',
                    audio: 'opportunity-cashout',
                    beatCount: 5,
                    detail: 'Two pairs',
                    hazardAction: 'none',
                    hazardFamily: 'none',
                    hazardScreenCue: 'none',
                    hazardTier: 'none',
                    hazardTrigger: 'none',
                    heat: 'cashout',
                    id: 'chain',
                    impactCue: 'route cashout',
                    impactCueId: 'route-cashout',
                    isBest: true,
                    label: 'Cash route',
                    rowMeterFill: 100,
                    screenCue: 'burst',
                    tone: 'chain',
                    value: '2 pairs'
                }
            ],
            summaryAction: 'cashout',
            summaryActionLabel: 'Cash now',
            summaryBeatCount: 5,
            summaryScreenCue: 'burst',
            summaryTier: 'cashout'
        });

        expect(compass).toMatchObject({
            bestScreenCue: 'burst',
            bestTone: 'chain',
            beats: 1,
            hot: 'cashout',
            priority: 'single',
            surge: 'true',
            summaryTone: 'chain'
        });
    });

    it('builds action priority, beat map, cadence map, and marker key props', () => {
        expect(
            buildBoardChainActionPriorityViewData({
                primaryActionId: 'cash-now',
                primaryRow: {
                    count: 2,
                    id: 'cash-now',
                    label: 'Cash lane',
                    role: 'Cashout',
                    screenCue: 'burst',
                    tone: 'cashout'
                },
                rows: [
                    {
                        count: 2,
                        id: 'cash-now',
                        label: 'Cash lane',
                        role: 'Cashout',
                        screenCue: 'burst',
                        tone: 'cashout'
                    }
                ],
                summaryAction: 'cashout',
                summaryBeatCount: 3,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            })
        ).toMatchObject({ primaryActionId: 'cash-now', summaryAction: 'cashout' });

        expect(
            buildBoardChainBeatMapViewData({
                actionMapAttr: 'cashout|route',
                label: 'Beat map',
                primaryRow: { id: 'cash', screenCue: 'burst', tone: 'cashout' },
                rows: [
                    {
                        action: 'Cash now',
                        beatCount: 5,
                        count: 2,
                        id: 'cash',
                        label: 'Cash',
                        screenCue: 'burst',
                        tone: 'cashout'
                    }
                ],
                summaryAction: 'cashout',
                summaryBeatCount: 5,
                summaryMeterFill: 100,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            })
        ).toMatchObject({ actionMapAttr: 'cashout|route', summaryMeterFill: 100 });

        expect(
            buildBoardChainCadenceMapViewData({
                label: 'Pulse map',
                primaryRow: { screenCue: 'pulse', tone: 'followup' },
                rows: [
                    {
                        action: 'Follow up',
                        beatCount: 3,
                        count: 1,
                        id: 'followup',
                        label: 'Follow-up',
                        screenCue: 'pulse',
                        tone: 'followup'
                    }
                ],
                summaryAction: 'followup',
                summaryBeatCount: 3,
                summaryScreenCue: 'pulse',
                summaryTier: 'followup'
            })
        ).toMatchObject({ label: 'Pulse map', summaryAction: 'followup' });

        expect(
            buildBoardChainMarkerKeyViewData({
                focusedChainMarkerShape: 'linked-route',
                intensity: {
                    action: 'Match route',
                    count: 2,
                    id: 'ready',
                    label: 'Ready'
                },
                rows: [
                    {
                        action: 'Route setup',
                        count: 2,
                        glyph: '=>',
                        id: 'linked-route',
                        label: 'Linked route',
                        shape: 'linked-route'
                    }
                ],
                summaryAction: 'route',
                summaryBeatCount: 3,
                summaryMeterFill: 60,
                summaryScreenCue: 'pulse',
                summaryTier: 'ready'
            })
        ).toMatchObject({ focusedChainMarkerShape: 'linked-route', summaryMeterFill: 60 });
    });

    it('builds chain chip surface props and lane map surface props', () => {
        const laneMap = buildBoardOpportunityLaneMapSurfaceViewData({
            accessibleLabel: 'Lane map',
            actionIdMap: 'cashout|prime',
            actionMap: 'Cash now|Prime build',
            laneMap: 'cash|prime',
            primaryLane: {
                action: 'Cash now',
                audio: 'opportunity-cashout',
                beatCount: 5,
                count: 2,
                cue: 'Prime route',
                focus: 'primary',
                id: 'cash',
                label: 'Cash',
                role: 'cash',
                roleId: 'cashout',
                screenCue: 'burst'
            },
            roleIdMap: 'cashout|prime',
            roleMap: 'cash|prime',
            rows: [],
            summaryAction: 'cashout',
            summaryBeatCount: 5,
            summaryMeterFill: 100,
            summaryScreenCue: 'burst',
            summaryTier: 'cashout'
        });
        expect(laneMap.primaryLane?.id).toBe('cash');

        const chainSurface = buildBoardChainOpportunitySurfaceViewData({
            accessibleLabel: 'Chain surface',
            actionPriority: {
                primaryActionId: 'cash-now',
                primaryRow: null,
                rows: [],
                summaryAction: null,
                summaryBeatCount: 2,
                summaryScreenCue: null,
                summaryTier: null
            },
            arcadeCallout: null,
            beat: null,
            beatMap: {
                actionMapAttr: 'none',
                label: 'Beat map',
                primaryRow: null,
                rows: [],
                summaryAction: null,
                summaryBeatCount: 2,
                summaryMeterFill: 0,
                summaryScreenCue: null,
                summaryTier: null
            },
            cadenceMap: {
                label: 'Pulse map',
                primaryRow: null,
                rows: [],
                summaryAction: null,
                summaryBeatCount: 2,
                summaryScreenCue: null,
                summaryTier: null
            },
            cue: {
                beatAction: 'Cash now',
                beatAudio: 'chain-cue-cashout',
                beatCount: 5,
                beatScreenCue: 'burst',
                beatState: 'cashout',
                fill: 100,
                label: 'Cue'
            },
            eyebrow: {
                beatAction: 'Cash now',
                beatAudio: 'cashout-beat',
                beatCount: 5,
                beatScreenCue: 'burst',
                beatState: 'cashout',
                label: 'Eyebrow'
            },
            markerKey: {
                focusedChainMarkerShape: 'none',
                intensity: null,
                rows: [],
                summaryAction: null,
                summaryBeatCount: 2,
                summaryMeterFill: 0,
                summaryScreenCue: null,
                summaryTier: null
            },
            meter: null,
            nextAction: null,
            primaryShot: null,
            primaryTraitLane: null,
            priority: {
                beatAudio: 'chain-priority-best',
                beatCount: 5,
                beatScreenCue: 'burst',
                id: 'best',
                label: 'Best'
            },
            progressionCues: {
                followupLabel: null,
                milestone: null,
                nextTarget: null,
                sequenceCue: null,
                surgeLabel: null,
                targetPlan: null
            },
            recipes: {
                accessibleLabel: 'Recipes',
                meterFill: 0,
                rows: []
            },
            rewardLadder: {
                accessibleLabel: 'Rewards',
                entries: [],
                focusId: null,
                hotBandTone: 'none',
                ladderActionAttr: 'none',
                ladderAttr: 'none',
                lead: null,
                summaryAction: null,
                summaryBeatCount: 2,
                summaryMeterFill: 0,
                summaryScreenCue: null,
                summaryTier: null
            },
            roleSummaryLanes: [],
            shotMap: {
                label: 'Shot map',
                primaryActionId: 'none',
                primaryRow: null,
                rows: [],
                summaryAction: null,
                summaryBeatCount: 2,
                summaryScreenCue: null,
                summaryTier: null
            },
            statusMeters: {
                armedPerk: null,
                examples: null,
                hotBand: null,
                lines: {
                    action: 'idle',
                    beatCount: 2,
                    items: [],
                    meterFill: 0,
                    tier: 'setup',
                    tone: 'idle'
                },
                momentum: null,
                rewardCue: null,
                rewardUrgency: null,
                surgeBand: null
            },
            tone: 'setup',
            traitInteractionLaneMap: null,
            traitLaneBeatMap: null
        });
        expect(chainSurface.accessibleLabel).toBe('Chain surface');
        expect(chainSurface.tone).toBe('setup');
    });
});
