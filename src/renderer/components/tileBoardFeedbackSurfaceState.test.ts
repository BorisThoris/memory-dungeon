import { describe, expect, it } from 'vitest';
import { buildBoardFeedbackSurfaceState } from './tileBoardFeedbackSurfaceState';

const formatLabel = (label: string, rows: readonly (string | null | undefined)[]) =>
    [label, ...rows.filter((row): row is string => Boolean(row))].join(': ');

describe('tileBoardFeedbackSurfaceState', () => {
    it('composes the remaining chain, opportunity, and telemetry surface state', () => {
        const chainOpportunity: Parameters<typeof buildBoardFeedbackSurfaceState>[0]['statusMeters']['opportunity'] = {
            arcadeCallout: { label: 'Arcade live', tone: 'surge', value: '+2' },
            armedPerkLabel: 'Iron Key',
            armedPerkPayoff: 'Open final gate',
            beatSignal: {
                action: 'Cash now',
                audioCue: 'cashout-beat',
                beatCount: 5,
                detail: 'Cash out immediately',
                label: 'Cash route',
                screenCue: 'burst',
                tier: 'cashout'
            },
            chainReadyCount: 2,
            chainReadyTileCount: 4,
            chaseLabel: 'Route chase',
            comboSurgeLabel: 'Routes lit',
            cue: 'cashout',
            examples: ['Cash a route', 'Prime a route'],
            lines: ['Build routes', 'Cash routes'],
            milestoneActionLabel: 'Cash route',
            milestoneBeatCount: 5,
            milestoneMeterFill: 80,
            milestoneScreenCue: 'burst',
            milestoneTargetLabel: '2 pairs',
            milestoneTier: 'cashout',
            milestoneTone: 'surge',
            momentumLabel: 'Momentum up',
            nextActionDetail: 'Take the open cashout',
            nextActionId: 'cash-now',
            nextActionLabel: 'Cash now',
            nextActionTone: 'cashout',
            nextTarget: '2 pairs',
            priorityLabel: 'Best move',
            rewardCue: 'Reward ready',
            rewardHot: true,
            rewardUrgencyLabel: 'Now',
            rewardUrgencyTier: 'next',
            selectedFollowupCount: 1,
            selectedFollowupLabel: 'North lane',
            setupCount: 2,
            streakCashoutReady: true,
            targetPlanLabel: 'Prime one more route',
            tone: 'surge'
        };
        const chainSequenceCue = {
            first: 'Prime route',
            keep: 'Hold streak',
            then: 'Cash reward',
            tone: 'followup' as const
        };
        const args: Parameters<typeof buildBoardFeedbackSurfaceState>[0] = {
            actionPriority: {
                primaryActionId: 'cash-now',
                primaryRow: { role: 'cashout', screenCue: 'burst', tone: 'cashout' },
                rows: [{ action: 'Cash now', count: 2, id: 'cash-now', label: 'Cash now', role: 'cashout', screenCue: 'burst', tone: 'cashout' }],
                summaryAction: 'cashout',
                summaryBeatCount: 5,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            },
            beatMap: {
                actionMapAttr: 'cash-now',
                label: 'Beat map',
                primaryRow: { action: 'cash-now', beatCount: 5, id: 'cash-now' },
                rows: [{ action: 'cash-now', beatCount: 5, count: 2, id: 'cash-now', label: 'Cash now', screenCue: 'burst', tone: 'cashout' }],
                summaryAction: 'cashout',
                summaryBeatCount: 5,
                summaryMeterFill: 100,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            },
            cadenceMap: {
                label: 'Cadence map',
                primaryRow: { action: 'cash-now', id: 'cash-now' },
                rows: [{ action: 'cash-now', count: 2, id: 'cash-now', label: 'Cash now', screenCue: 'burst', tone: 'cashout' }],
                summaryAction: 'cashout',
                summaryBeatCount: 5,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            },
            cardTelemetry: {
                cardActionPrioritySummaryAction: 'cashout',
                cardActionPrioritySummaryBeatCount: 5,
                cardActionPrioritySummaryScreenCue: 'burst',
                cardActionPrioritySummaryTier: 'cashout',
                cardBeatMapSummaryAction: 'cashout',
                cardBeatMapSummaryBeatCount: 5,
                cardBeatMapSummaryScreenCue: 'burst',
                cardBeatMapSummaryTier: 'cashout',
                cardCadenceMapSummaryAction: 'cashout',
                cardCadenceMapSummaryBeatCount: 5,
                cardCadenceMapSummaryScreenCue: 'burst',
                cardCadenceMapSummaryTier: 'cashout',
                cardFeedbackActionCuesAttr: 'burst',
                cardFeedbackActionPriorityAttr: 'cashout',
                cardFeedbackActionPriorityRowsLength: 1,
                cardFeedbackBeatCountsAttr: '5',
                cardFeedbackBeatRowsLength: 1,
                cardFeedbackBeatTiersAttr: 'cashout',
                cardFeedbackCadenceRowsLength: 1,
                cardFeedbackCadencesAttr: 'cashout',
                cardFeedbackMarkerShapesAttr: 'linked-route',
                cardFeedbackPrimaryActionAttr: 'cash-now',
                cardFeedbackPrimaryCardCueAttr: 'burst',
                cardFeedbackRouteGlyphsAttr: '=>',
                cardFeedbackShotMapAttr: 'cash-now',
                cardFeedbackShotMapRowsLength: 1,
                cardFeedbackStatesAttr: 'ready',
                cardFeedbackTraitComboSurgeActive: true,
                cardFeedbackTraitLaneActionsAttr: 'study',
                cardFeedbackTraitLaneBeatsAttr: '3',
                cardFeedbackTraitLaneBeatRowsLength: 1,
                cardFeedbackTraitLaneCuesAttr: 'pulse',
                cardFeedbackTraitLanePrimaryActionAttr: 'study',
                cardFeedbackTraitPayoffStackActive: true,
                cardFeedbackTraitRouteIntensitiesAttr: 'ready',
                cardFeedbackTraitRouteTiersAttr: 'surge',
                cardFeedbackVisibleTraitPreviewCount: 2,
                cardShotMapSummaryAction: 'cashout',
                cardShotMapSummaryBeatCount: 5,
                cardShotMapSummaryScreenCue: 'burst',
                cardShotMapSummaryTier: 'cashout',
                lastResolutionFeedback: 'cashout',
                primaryCardActionPriorityRow: { role: 'cashout', screenCue: 'burst', tone: 'cashout' },
                primaryCardFeedbackBeatRow: { action: 'cash-now', beatCount: 5, id: 'cash-now' },
                primaryCardFeedbackCadenceRow: { action: 'cash-now', id: 'cash-now' },
                primaryCardFeedbackShotAudioCue: 'shot-cash',
                primaryCardFeedbackShotFocus: 'cashout',
                primaryCardFeedbackShotRow: { detail: 'Primary shot', id: 'shot-1', shotLabel: 'Cash route' },
                primaryCardFeedbackShotScreenCue: 'burst',
                primaryTraitLaneAudioCue: 'trait-lane',
                primaryTraitLaneBeatRow: { role: 'study' },
                primaryTraitLaneScreenCue: 'pulse',
                reduceMotion: false,
                traitLaneBeatMapSummaryAction: 'study',
                traitLaneBeatMapSummaryBeatCount: 3,
                traitLaneBeatMapSummaryScreenCue: 'pulse',
                traitLaneBeatMapSummaryTier: 'study'
            },
            chainOpportunityChip: {
                accessibilitySummary: {
                    followupCount: 1,
                    label: 'Cash route label',
                    payoffStackCount: 1,
                    primaryLine: 'Cash route ready',
                    readyCount: 2,
                    rewardHotCount: 1,
                    secondaryLine: 'One follow-up selected',
                    setupCount: 2,
                    surgeCount: 1,
                    tone: 'surge'
                },
                cueMeterFill: 100,
                cueMeterState: 'cashout',
                deps: {
                    cardTraitLaneAudioCue: () => 'trait-lane',
                    cardTraitLaneBeatMapSummaryAction: (role) => role,
                    cardTraitLaneScreenCue: () => 'pulse',
                    formatBeatLabel: (beatSignal) => `${beatSignal.label} x${beatSignal.beatCount}`,
                    getCalloutAction: (tone) => tone,
                    getCalloutAudioCue: () => 'callout-audio',
                    getCalloutScreenCue: () => 'burst',
                    getCueAction: (state) => state,
                    getCueAudioCue: () => 'cue-audio',
                    getCueScreenCue: () => 'burst',
                    getPriorityAudioCue: () => 'priority-audio',
                    getPriorityScreenCue: () => 'burst',
                    getTraitInteractionLaneAction: (laneId) => laneId,
                    getTraitInteractionLaneRole: (lane) => lane.label
                },
                nextActionMeterFill: 80,
                nextActionTier: 'cashout',
                nextActionVerb: 'Cash',
                opportunity: chainOpportunity,
                opportunityMeterFill: 90,
                primaryShotAudio: 'shot-cash',
                primaryShotFocus: 'cashout',
                primaryShotRow: { detail: 'Primary shot', id: 'shot-1', shotLabel: 'Cash route' },
                primaryShotScreenCue: 'burst',
                primaryTraitLaneAudio: 'trait-lane',
                primaryTraitLaneRow: { action: 'study', beatCount: 3, count: 1, id: 'study', label: 'Study lane', role: 'Study' },
                primaryTraitLaneScreenCue: 'pulse',
                priorityId: 'best',
                recipeChips: ['Cash', 'Prime'],
                recipeRows: [{ action: 'Cash', label: 'Cash', laneId: 'cash', recipe: 'Cash > Prime', roleId: 'cashout', sourceLine: 'North lane' }],
                shotBeatRow: { action: 'cash-now', beatCount: 5, id: 'cash-now' },
                shotCadenceRow: { action: 'cash-now', id: 'cash-now' },
                traitInteractionLaneActionMap: 'cash|study',
                traitInteractionLaneAttrValue: 'cash|trait',
                traitInteractionLaneMap: [{ count: 2, cue: 'pulse', id: 'cash', label: 'Cash lane' }],
                traitInteractionLaneMapAccessibleLabel: 'Trait lane map',
                traitInteractionLaneMapMeterFill: 100,
                traitInteractionLanePrimary: { count: 2, cue: 'pulse', id: 'cash', label: 'Cash lane' },
                traitInteractionLaneRoleMap: 'cashout|study',
                traitLaneBeatMapLabel: 'Trait lane beat map',
                traitLaneBeatMapMeterFill: 75,
                traitLaneBeatRows: [{ action: 'study', beatCount: 3, count: 1, id: 'study', label: 'Study lane', role: 'Study' }],
                traitLaneBeatSummaryAction: 'study',
                traitLaneBeatSummaryBeatCount: 3,
                traitLaneBeatSummaryScreenCue: 'pulse',
                traitLaneBeatSummaryTier: 'study'
            },
            chainSurface: {
                accessibleLabel: 'Chain surface',
                tone: 'surge'
            },
            chainTelemetry: {
                boardChainAccessibilitySummary: {
                    followupCount: 1,
                    primaryLine: 'Cash route ready',
                    readyCount: 2,
                    rewardHotCount: 1,
                    secondaryLine: 'One follow-up selected',
                    setupCount: 2,
                    surgeCount: 1,
                    tone: 'surge'
                },
                boardChainMarkerKeyRowsLength: 1,
                boardChainMarkerKeySummaryAction: 'route',
                boardChainMarkerKeySummaryBeatCount: 3,
                boardChainMarkerKeySummaryScreenCue: 'pulse',
                boardChainMarkerKeySummaryTier: 'ready',
                boardChainOpportunity: {
                    ...chainOpportunity,
                    setupCount: 2,
                    targetPlanLabel: 'Prime one more route'
                },
                boardChainRecipeChips: ['Cash', 'Prime'],
                boardChainSequenceCue: chainSequenceCue,
                boardRewardLadderState: {
                    actionAttr: 'prime|cashout',
                    attr: 'soon|next',
                    entries: [],
                    summaryAction: 'cashout',
                    summaryBeatCount: 5,
                    summaryScreenCue: 'burst',
                    summaryTier: 'cashout'
                },
                boardTraitInteractionLaneActionMapAttrValue: 'cash|study',
                boardTraitInteractionLaneMap: [{ count: 2, cue: 'pulse', id: 'cash', label: 'Cash lane' }],
                boardTraitInteractionLaneMapAttrValue: 'cash|trait',
                boardTraitInteractionLaneRoleMapAttrValue: 'cashout|study'
            },
            focusedPreview: {
                accessibleLabel: 'Focused preview',
                deps: {
                    getAudio: () => 'preview-audio',
                    getBeatCount: () => 3,
                    getScreenCue: () => 'pulse'
                },
                preview: {
                    action: 'Study trait',
                    eyebrow: 'Trait',
                    kind: 'trait',
                    lines: ['Combo with cash lane'],
                    rewardHotText: 'Reward hot',
                    source: 'focus',
                    tone: 'surge'
                },
                traitOpportunityTileCount: 2,
                traitPayoffStackActive: true
            },
            markerKey: {
                focusedChainMarkerShape: 'linked-route',
                intensity: { action: 'Match route', count: 2, id: 'ready', label: 'Ready' },
                rows: [{ action: 'Route setup', count: 2, glyph: '=>', id: 'linked-route', label: 'Linked route', shape: 'linked-route' }],
                summaryAction: 'route',
                summaryBeatCount: 3,
                summaryMeterFill: 60,
                summaryScreenCue: 'pulse',
                summaryTier: 'ready'
            },
            opportunitySurface: {
                chainOpportunity,
                deps: {
                    getActionId: (row) => (row?.action.toLowerCase().includes('cash') ? 'cashout' : 'route'),
                    getAudio: (row) => (row.impactCue.includes('cashout') ? 'opportunity-cashout' : 'opportunity-prime'),
                    getBeatCount: (row) => (row.impactCue.includes('cashout') ? 5 : 2),
                    getCrescendoAudioCue: (tier) => `${tier}-audio`,
                    getHeat: (impactCue) => (impactCue.includes('cashout') ? 'cashout' : 'prime'),
                    getImpactCueId: (impactCue) => impactCue.replace(/\s+/g, '-'),
                    getScreenCue: (row) => (row.impactCue.includes('cashout') ? 'burst' : 'pulse'),
                    getSummaryAction: (row) => (row?.impactCue.includes('cashout') ? 'cashout' : 'route'),
                    getSummaryTier: (row) => (row?.impactCue.includes('cashout') ? 'cashout' : 'route')
                },
                hazardOpportunity: {
                    action: 'inspect',
                    family: 'none',
                    screenCue: 'tick',
                    tier: 'watch',
                    trigger: 'none'
                },
                rows: [
                    {
                        action: 'Cash now',
                        detail: 'Two pairs are primed',
                        id: 'chain',
                        impactCue: 'route cashout',
                        label: 'Cash route',
                        tone: 'chain',
                        value: '2 pairs'
                    },
                    {
                        action: 'Prime build',
                        detail: 'Stack another route',
                        id: 'trait',
                        impactCue: 'route prime',
                        label: 'Prime route',
                        tone: 'setup',
                        value: '1 route'
                    }
                ]
            },
            opportunityTelemetry: {},
            pickupOpportunity: {
                deps: { formatLabel },
                opportunity: {
                    count: 2,
                    examples: ['Chest', 'Key'],
                    sequenceCue: {
                        first: 'Collect key',
                        keep: 'Keep route alive',
                        then: 'Open gate',
                        tone: 'reward'
                    },
                    stackCue: 'Stack pickups',
                    stackDetail: 'Two pickups lined up',
                    target: 'Iron key',
                    tileCount: 2,
                    valueLabel: '2 pickups'
                }
            },
            progressionCues: {
                opportunity: chainOpportunity,
                sequenceAccessibleLabel: 'Prime route, hold streak, cash reward',
                sequenceCue: chainSequenceCue
            },
            rewardLadder: {
                rewardLadder: {
                    accessibleLabel: 'Reward ladder',
                    actionAttr: 'prime|cashout',
                    attr: 'soon|next',
                    entries: [],
                    focusId: 'next',
                    lead: { beatCount: 5, meterFill: 80 },
                    leadAccessibleLabel: 'Five beats to cashout',
                    summaryAction: 'cashout',
                    summaryBeatCount: 5,
                    summaryMeterFill: 80,
                    summaryScreenCue: 'burst',
                    summaryTier: 'cashout'
                }
            },
            shotMap: {
                label: 'Shot map',
                primaryActionId: 'cash-now',
                primaryRow: { role: 'cashout', screenCue: 'burst', tone: 'cashout' },
                rows: [{ count: 2, detail: 'Two shots', id: 'shot-1', role: 'cashout', screenCue: 'burst', shotLabel: 'Cash route', tone: 'cashout' }],
                summaryAction: 'cashout',
                summaryBeatCount: 5,
                summaryScreenCue: 'burst',
                summaryTier: 'cashout'
            },
            statusChips: {
                activePower: {
                    action: 'swap',
                    beats: 2,
                    detail: 'Move into combo route',
                    first: 'Pick source',
                    label: 'Swap armed',
                    screenCue: 'pulse',
                    then: 'Preview route payoff',
                    tier: 'route',
                    tone: 'setup'
                },
                deps: { formatLabel },
                traitMode: {
                    action: 'study',
                    beatCount: 3,
                    detail: 'Trait lanes active',
                    screenCue: 'pulse',
                    tier: 'study',
                    tone: 'surge',
                    value: '2 routes'
                },
                traitModeAccessibleLabel: 'Trait mode active'
            },
            statusMeters: {
                deps: { formatLabel },
                opportunity: chainOpportunity,
                rewardLead: { beatCount: 5, meterFill: 80 }
            },
            statusTelemetry: {
                activePowerBoardChip: {
                    action: 'swap',
                    screenCue: 'pulse',
                    tier: 'route'
                },
                boardHazardOpportunity: {
                    action: 'inspect',
                    count: 0,
                    family: 'none',
                    screenCue: 'tick',
                    tier: 'watch',
                    trigger: 'none'
                },
                boardPickupOpportunity: {
                    count: 2,
                    sequenceCue: {
                        first: 'Collect key',
                        keep: 'Keep route alive',
                        then: 'Open gate',
                        tone: 'reward'
                    },
                    tileCount: 2
                },
                boardTraitModeCue: {
                    action: 'study',
                    beatCount: 3,
                    detail: 'Trait lanes active',
                    screenCue: 'pulse',
                    tier: 'study',
                    tone: 'surge',
                    value: '2 routes'
                }
            }
        };

        const state = buildBoardFeedbackSurfaceState(args);

        expect(state.boardChainOpportunitySurfaceView.accessibleLabel).toBe('Chain surface');
        expect(state.boardChainOpportunitySurfaceView.rewardLadder.hotBandTone).toBe('cashout');
        expect(state.boardOpportunityCompassView.hot).toBe('cashout');
        expect(state.boardStatusChipsView.pickupOpportunity?.focus).toBe('reward');
        expect(state.focusedPreviewChipView?.audio).toBe('preview-audio');
        expect(state.chainFeedbackTelemetryAttrs['data-chain-opportunity-beat-action-id']).toBe('cashout');
        expect(state.opportunityFeedbackTelemetryAttrs['data-opportunity-best-id']).toBe('chain');
        expect(state.statusFeedbackTelemetryAttrs['data-pickup-opportunity-count']).toBe(2);
        expect(state.cardFeedbackTelemetryAttrs['data-card-feedback-primary-action']).toBe('cash-now');
    });
});
