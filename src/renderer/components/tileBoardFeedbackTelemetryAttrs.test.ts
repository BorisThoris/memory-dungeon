import { describe, expect, it } from 'vitest';
import {
    buildCardFeedbackTelemetryAttrs,
    buildChainFeedbackTelemetryAttrs,
    buildOpportunityFeedbackTelemetryAttrs,
    buildStatusFeedbackTelemetryAttrs
} from './tileBoardFeedbackTelemetryAttrs';

describe('tileBoardFeedbackTelemetryAttrs', () => {
    it('builds card feedback telemetry attrs', () => {
        const attrs = buildCardFeedbackTelemetryAttrs({
            cardActionPrioritySummaryAction: 'cashout',
            cardActionPrioritySummaryBeatCount: 3,
            cardActionPrioritySummaryScreenCue: 'burst',
            cardActionPrioritySummaryTier: 'cashout',
            cardBeatMapSummaryAction: 'cashout',
            cardBeatMapSummaryBeatCount: 5,
            cardBeatMapSummaryScreenCue: 'burst',
            cardBeatMapSummaryTier: 'cashout',
            cardCadenceMapSummaryAction: 'followup',
            cardCadenceMapSummaryBeatCount: 3,
            cardCadenceMapSummaryScreenCue: 'pulse',
            cardCadenceMapSummaryTier: 'followup',
            cardFeedbackActionCuesAttr: 'cash-now:2',
            cardFeedbackActionPriorityAttr: 'cashout:2',
            cardFeedbackActionPriorityRowsLength: 1,
            cardFeedbackBeatCountsAttr: '5:1',
            cardFeedbackBeatRowsLength: 1,
            cardFeedbackBeatTiersAttr: 'cashout:1',
            cardFeedbackCadenceRowsLength: 1,
            cardFeedbackCadencesAttr: 'followup:1',
            cardFeedbackMarkerShapesAttr: 'linked-route:1',
            cardFeedbackPrimaryActionAttr: 'cash-now',
            cardFeedbackPrimaryCardCueAttr: 'cash-cue',
            cardFeedbackRouteGlyphsAttr: 'linked-route:1',
            cardFeedbackShotMapAttr: 'cash-now:1',
            cardFeedbackShotMapRowsLength: 1,
            cardFeedbackStatesAttr: 'chain-ready:1',
            cardFeedbackTraitComboSurgeActive: true,
            cardFeedbackTraitLaneActionsAttr: 'shard:1',
            cardFeedbackTraitLaneBeatsAttr: '3:1',
            cardFeedbackTraitLaneBeatRowsLength: 1,
            cardFeedbackTraitLaneCuesAttr: 'shard:1',
            cardFeedbackTraitLanePrimaryActionAttr: 'shard',
            cardFeedbackTraitPayoffStackActive: true,
            cardFeedbackTraitRouteIntensitiesAttr: 'ready:1',
            cardFeedbackTraitRouteTiersAttr: 'route:1',
            cardFeedbackVisibleTraitPreviewCount: 2,
            cardShotMapSummaryAction: 'cashout',
            cardShotMapSummaryBeatCount: 3,
            cardShotMapSummaryScreenCue: 'burst',
            cardShotMapSummaryTier: 'cashout',
            lastResolutionFeedback: 'matched',
            primaryCardActionPriorityRow: { role: 'Cashout', screenCue: 'burst', tone: 'cashout' },
            primaryCardFeedbackBeatRow: { action: 'Cash now', beatCount: 5, id: 'cashout' },
            primaryCardFeedbackCadenceRow: { action: 'Follow up', id: 'followup' },
            primaryCardFeedbackShotAudioCue: 'shot-cashout',
            primaryCardFeedbackShotFocus: 'primary',
            primaryCardFeedbackShotRow: { detail: 'Two cards', id: 'cash-now', shotLabel: 'Cash lane' },
            primaryCardFeedbackShotScreenCue: 'burst',
            primaryTraitLaneAudioCue: 'trait-ready',
            primaryTraitLaneBeatRow: { role: 'shard' },
            primaryTraitLaneScreenCue: 'pulse',
            reduceMotion: false,
            traitLaneBeatMapSummaryAction: 'shard',
            traitLaneBeatMapSummaryBeatCount: 3,
            traitLaneBeatMapSummaryScreenCue: 'pulse',
            traitLaneBeatMapSummaryTier: 'route'
        });

        expect(attrs['data-card-feedback-trait-combo-surge']).toBe('true');
        expect(attrs['data-chain-shot-map-summary-beats']).toBe(3);
        expect(attrs['data-card-feedback-primary-shot']).toBe('cash-now');
        expect(attrs['data-card-feedback-reduced-motion']).toBe('animated-state-cues');
    });

    it('builds chain feedback telemetry attrs', () => {
        const attrs = buildChainFeedbackTelemetryAttrs({
            boardChainAccessibilitySummary: {
                followupCount: 1,
                primaryLine: 'Primary',
                readyCount: 2,
                rewardHotCount: 0,
                secondaryLine: null,
                setupCount: 1,
                surgeCount: 0,
                tone: 'ready'
            },
            boardChainMarkerKeyRowsLength: 1,
            boardChainMarkerKeySummaryAction: 'route',
            boardChainMarkerKeySummaryBeatCount: 3,
            boardChainMarkerKeySummaryScreenCue: 'pulse',
            boardChainMarkerKeySummaryTier: 'ready',
            boardChainOpportunity: {
                arcadeCallout: { label: 'Cash now', tone: 'cashout', value: '2 pairs' },
                armedPerkLabel: 'Wand',
                armedPerkPayoff: 'Chest',
                beatSignal: {
                    action: 'Cash out',
                    audioCue: 'cashout-beat',
                    beatCount: 5,
                    cue: 'super',
                    label: 'Cashout beat',
                    screenCue: 'super',
                    tier: 'cashout'
                },
                chainReadyCount: 2,
                chainReadyTileCount: 3,
                chaseLabel: 'Route ready',
                comboSurgeLabel: 'Surge',
                cue: 'Prime route',
                milestoneActionLabel: 'Prime',
                milestoneScreenCue: 'pulse',
                milestoneTargetLabel: 'Reward',
                milestoneTier: 'prime',
                milestoneTone: 'build',
                momentumLabel: 'Ready',
                nextActionDetail: 'Cash soon',
                nextActionId: 'cashout',
                nextActionLabel: 'Cash out',
                nextActionTone: 'cashout',
                nextTarget: 'Marked shard',
                priorityLabel: 'Best',
                rewardHot: true,
                rewardUrgencyLabel: 'Now',
                rewardUrgencyTier: 'next',
                selectedFollowupCount: 1,
                selectedFollowupLabel: 'Marked shard',
                setupCount: 1,
                streakCashoutReady: true,
                targetPlanLabel: 'Prime route'
            },
            boardChainOpportunityBeatActionId: 'cashout',
            boardChainRecipeChips: ['shard', 'guard'],
            boardChainSequenceCue: { first: 'Prime', keep: 'Hold', then: 'Cash', tone: 'cashout' },
            boardChainStatusMeters: {
                hotBand: { action: 'cashout', beatCount: 5, screenCue: 'burst', tier: 'hot', tone: 'cashout' },
                surgeBand: { action: 'surge', beatCount: 4, screenCue: 'burst', tier: 'combo' }
            },
            boardRewardLadderState: {
                actionAttr: 'prime|cashout',
                attr: 'soon|next',
                entries: [1, 2],
                summaryAction: 'cashout',
                summaryBeatCount: 4,
                summaryScreenCue: 'burst',
                summaryTier: 'next'
            },
            boardTraitInteractionLaneActionMapAttrValue: 'cash|prime',
            boardTraitInteractionLaneMap: [1, 2],
            boardTraitInteractionLaneMapAttrValue: 'lane-map',
            boardTraitInteractionLaneRoleMapAttrValue: 'roles'
        });

        expect(attrs['data-chain-opportunity-ready-count']).toBe(2);
        expect(attrs['data-chain-opportunity-reward-hot']).toBe('true');
        expect(attrs['data-chain-hot-band-action']).toBe('cashout');
        expect(attrs['data-chain-reward-ladder-count']).toBe(2);
    });

    it('builds status and opportunity telemetry attrs', () => {
        const status = buildStatusFeedbackTelemetryAttrs({
            activePowerBoardChip: { action: 'swap', screenCue: 'pulse', tier: 'route' },
            boardHazardOpportunity: { action: 'inspect', count: 2, family: 'trap', screenCue: 'guard', tier: 'danger', trigger: 'armed' },
            boardPickupOpportunity: {
                count: 1,
                sequenceCue: { first: 'Find', keep: 'Hold', then: 'Cash', tone: 'reward' },
                tileCount: 2
            },
            boardPickupOpportunityChip: { action: 'cashout', beatCount: 4, focus: 'reward', screenCue: 'burst', tier: 'reward' },
            boardTraitModeCue: { action: 'prime', beatCount: 2, detail: 'Prime mode', screenCue: 'pulse', tier: 'prime', tone: 'setup', value: 'Prime' }
        });
        expect(status['data-active-power-action']).toBe('swap');
        expect(status['data-pickup-opportunity-tier']).toBe('reward');

        const opportunity = buildOpportunityFeedbackTelemetryAttrs({
            boardBestOpportunity: { action: 'Cash', detail: 'Two pairs', id: 'chain', impactCue: 'route cashout', label: 'Cash route', tone: 'chain', value: '2 pairs' },
            boardBestOpportunityActionId: 'cashout',
            boardBestOpportunityAudio: 'opportunity-cashout',
            boardBestOpportunityBeatCount: 5,
            boardBestOpportunityHeat: 'cashout',
            boardBestOpportunityImpactCueId: 'route-cashout',
            boardBestOpportunityScreenCue: 'burst',
            boardOpportunityCompassRowsLength: 1,
            boardOpportunityCompassSummaryAction: 'cashout',
            boardOpportunityCompassSummaryActionLabel: 'Cash now',
            boardOpportunityCompassSummaryBeatCount: 5,
            boardOpportunityCompassSummaryScreenCue: 'burst',
            boardOpportunityCompassSummaryTier: 'cashout',
            boardOpportunityLaneMapPrimaryView: { audio: 'opportunity-cashout', beatCount: 5, focus: 'primary', role: 'cash', roleId: 'cashout', screenCue: 'burst' },
            boardOpportunityLaneMapState: {
                actionAttr: 'cash',
                actionIdAttr: 'cashout',
                attr: 'lane-map',
                primaryLane: { action: 'Cash now', cue: 'Prime', id: 'cash' },
                roleAttr: 'cash',
                roleIdAttr: 'cashout',
                rows: [{ label: 'Cash' }]
            },
            boardOpportunityLaneMapSummaryAction: 'cashout',
            boardOpportunityLaneMapSummaryBeatCount: 5,
            boardOpportunityLaneMapSummaryScreenCue: 'burst',
            boardOpportunityLaneMapSummaryTier: 'cashout',
            boardPayoffStack: {
                action: 'Cash route',
                crescendo: { beatCount: 4, screenCue: 'burst', tier: 'stack' },
                cue: 'Prime',
                cueId: 'prime',
                nextCue: 'Cash',
                sequence: { first: 'Prime', keep: 'Hold', then: 'Cash' },
                sequenceCue: 'Prime then cash',
                tone: 'setup',
                value: '3 chain'
            },
            boardPayoffStackCrescendoAudio: 'stack-burst'
        });
        expect(opportunity['data-opportunity-best-id']).toBe('chain');
        expect(opportunity['data-opportunity-payoff-crescendo-audio']).toBe('stack-burst');
        expect(opportunity['data-opportunity-primary-lane-audio']).toBe('opportunity-cashout');
    });
});
