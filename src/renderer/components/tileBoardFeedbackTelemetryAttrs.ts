type FeedbackTelemetryValue = string | number;

export type TileBoardFeedbackTelemetryAttrs = Record<string, FeedbackTelemetryValue>;

interface CardFeedbackTelemetryState {
    cardActionPrioritySummaryAction: string | null;
    cardActionPrioritySummaryBeatCount: number;
    cardActionPrioritySummaryScreenCue: string | null;
    cardActionPrioritySummaryTier: string | null;
    cardBeatMapSummaryAction: string | null;
    cardBeatMapSummaryBeatCount: number;
    cardBeatMapSummaryScreenCue: string | null;
    cardBeatMapSummaryTier: string | null;
    cardCadenceMapSummaryAction: string | null;
    cardCadenceMapSummaryBeatCount: number;
    cardCadenceMapSummaryScreenCue: string | null;
    cardCadenceMapSummaryTier: string | null;
    cardFeedbackActionCuesAttr: string;
    cardFeedbackActionPriorityAttr: string | null;
    cardFeedbackActionPriorityRowsLength: number;
    cardFeedbackBeatCountsAttr: string;
    cardFeedbackBeatRowsLength: number;
    cardFeedbackBeatTiersAttr: string | null;
    cardFeedbackCadenceRowsLength: number;
    cardFeedbackCadencesAttr: string | null;
    cardFeedbackMarkerShapesAttr: string;
    cardFeedbackPrimaryActionAttr: string;
    cardFeedbackPrimaryCardCueAttr: string;
    cardFeedbackRouteGlyphsAttr: string | null;
    cardFeedbackShotMapAttr: string;
    cardFeedbackShotMapRowsLength: number;
    cardFeedbackStatesAttr: string;
    cardFeedbackTraitComboSurgeActive: boolean;
    cardFeedbackTraitLaneActionsAttr: string | null;
    cardFeedbackTraitLaneBeatsAttr: string | null;
    cardFeedbackTraitLaneBeatRowsLength: number;
    cardFeedbackTraitLaneCuesAttr: string | null;
    cardFeedbackTraitLanePrimaryActionAttr: string;
    cardFeedbackTraitPayoffStackActive: boolean;
    cardFeedbackTraitRouteIntensitiesAttr: string;
    cardFeedbackTraitRouteTiersAttr: string;
    cardFeedbackVisibleTraitPreviewCount: number;
    cardShotMapSummaryAction: string | null;
    cardShotMapSummaryBeatCount: number;
    cardShotMapSummaryScreenCue: string | null;
    cardShotMapSummaryTier: string | null;
    lastResolutionFeedback: string;
    primaryCardActionPriorityRow: { role: string; screenCue: string; tone: string } | null;
    primaryCardFeedbackBeatRow: { action: string; beatCount: number; id: string } | null;
    primaryCardFeedbackCadenceRow: { action: string; id: string } | null;
    primaryCardFeedbackShotAudioCue: string;
    primaryCardFeedbackShotFocus: string;
    primaryCardFeedbackShotRow: { detail: string; id: string; shotLabel: string } | null;
    primaryCardFeedbackShotScreenCue: string;
    primaryTraitLaneAudioCue: string;
    primaryTraitLaneBeatRow: { role: string } | null;
    primaryTraitLaneScreenCue: string;
    reduceMotion: boolean;
    traitLaneBeatMapSummaryAction: string | null;
    traitLaneBeatMapSummaryBeatCount: number;
    traitLaneBeatMapSummaryScreenCue: string | null;
    traitLaneBeatMapSummaryTier: string | null;
}

interface ChainFeedbackTelemetryState {
    boardChainAccessibilitySummary: {
        followupCount: number;
        primaryLine: string;
        readyCount: number;
        rewardHotCount: number;
        secondaryLine: string | null;
        setupCount: number;
        surgeCount: number;
        tone: string;
    };
    boardChainOpportunity: {
        arcadeCallout: { label: string; tone: string; value: string } | null;
        armedPerkLabel: string | null;
        armedPerkPayoff: string | null;
        beatSignal: {
            action: string;
            audioCue: string;
            beatCount: number;
            cue?: string;
            label: string;
            screenCue: string;
            tier: string;
        } | null;
        chainReadyCount: number;
        chainReadyTileCount: number;
        chaseLabel: string | null;
        comboSurgeLabel: string | null;
        cue: string;
        milestoneActionLabel: string | null;
        milestoneScreenCue: string | null;
        milestoneTargetLabel: string | null;
        milestoneTier: string | null;
        milestoneTone: string | null;
        momentumLabel: string | null;
        nextActionDetail: string | null;
        nextActionId: string;
        nextActionLabel: string | null;
        nextActionTone: string;
        nextTarget: string | null;
        priorityLabel: string | null;
        rewardHot: boolean;
        rewardUrgencyLabel: string | null;
        rewardUrgencyTier: string | null;
        selectedFollowupCount: number;
        selectedFollowupLabel?: string | null;
        setupCount: number;
        streakCashoutReady: boolean;
        targetPlanLabel: string | null;
    };
    boardChainOpportunityBeatActionId: string | null;
    boardChainRecipeChips: string[];
    boardChainSequenceCue: { first: string; keep: string; then: string; tone: string } | null;
    boardChainStatusMeters: {
        hotBand: { action: string; beatCount: number; screenCue: string; tier: string; tone: string } | null;
        surgeBand: { action: string; beatCount: number; screenCue: string; tier: string } | null;
    };
    boardChainMarkerKeyRowsLength: number;
    boardChainMarkerKeySummaryAction: string | null;
    boardChainMarkerKeySummaryBeatCount: number;
    boardChainMarkerKeySummaryScreenCue: string | null;
    boardChainMarkerKeySummaryTier: string | null;
    boardRewardLadderState: {
        actionAttr: string;
        attr: string;
        entries: readonly unknown[];
        summaryAction: string | null;
        summaryBeatCount: number;
        summaryScreenCue: string | null;
        summaryTier: string | null;
    };
    boardTraitInteractionLaneActionMapAttrValue: string;
    boardTraitInteractionLaneMap: readonly unknown[];
    boardTraitInteractionLaneMapAttrValue: string;
    boardTraitInteractionLaneRoleMapAttrValue: string;
}

interface StatusFeedbackTelemetryState {
    activePowerBoardChip: { action: string; screenCue: string; tier: string } | null;
    boardHazardOpportunity: { action: string; count: number; family: string; screenCue: string; tier: string; trigger: string };
    boardPickupOpportunity: {
        count: number;
        sequenceCue: { first: string; keep: string; then: string; tone: string } | null;
        tileCount: number;
    };
    boardPickupOpportunityChip: { action: string; beatCount: number; focus: string; screenCue: string; tier: string } | null;
    boardTraitModeCue: { action: string; beatCount: number; detail: string; screenCue: string; tier: string; tone: string; value: string } | null;
}

interface OpportunityFeedbackTelemetryState {
    boardBestOpportunity: { action: string; detail: string; id: string; impactCue: string; label: string; tone: string; value: string } | null;
    boardBestOpportunityActionId: string | null;
    boardBestOpportunityBeatCount: number;
    boardBestOpportunityHeat: string;
    boardBestOpportunityImpactCueId: string | null;
    boardBestOpportunityAudio: string;
    boardBestOpportunityScreenCue: string;
    boardOpportunityCompassRowsLength: number;
    boardOpportunityCompassSummaryAction: string | null;
    boardOpportunityCompassSummaryActionLabel: string;
    boardOpportunityCompassSummaryBeatCount: number;
    boardOpportunityCompassSummaryScreenCue: string | null;
    boardOpportunityCompassSummaryTier: string | null;
    boardOpportunityLaneMapPrimaryView: {
        audio: string;
        beatCount: number;
        focus: string;
        role: string;
        roleId: string;
        screenCue: string;
    } | null;
    boardOpportunityLaneMapState: {
        actionAttr: string;
        actionIdAttr: string;
        attr: string;
        primaryLane: { action: string; cue: string; id: string } | null;
        roleAttr: string;
        roleIdAttr: string;
        rows: readonly { label: string }[];
    };
    boardOpportunityLaneMapSummaryAction: string | null;
    boardOpportunityLaneMapSummaryBeatCount: number;
    boardOpportunityLaneMapSummaryScreenCue: string | null;
    boardOpportunityLaneMapSummaryTier: string | null;
    boardPayoffStack: {
        action: string;
        crescendo: { beatCount: number; screenCue: string; tier: string };
        cue: string;
        cueId: string;
        nextCue: string;
        sequence: { first: string; keep: string; then: string };
        sequenceCue: string | null;
        tone: string;
        value: string;
    } | null;
    boardPayoffStackCrescendoAudio: string;
}

export const buildCardFeedbackTelemetryAttrs = (state: CardFeedbackTelemetryState): TileBoardFeedbackTelemetryAttrs => ({
    'data-card-feedback-states': state.cardFeedbackStatesAttr,
    'data-card-feedback-trait-combo-surge': state.cardFeedbackTraitComboSurgeActive ? 'true' : 'false',
    'data-card-feedback-action-cues': state.cardFeedbackActionCuesAttr,
    'data-card-feedback-action-priority': state.cardFeedbackActionPriorityAttr || 'none',
    'data-card-feedback-beat-tiers': state.cardFeedbackBeatTiersAttr || 'none',
    'data-card-feedback-beat-counts': state.cardFeedbackBeatCountsAttr || 'none',
    'data-card-feedback-cadences': state.cardFeedbackCadencesAttr || 'none',
    'data-card-feedback-shot-map': state.cardFeedbackShotMapAttr,
    'data-card-feedback-primary-shot': state.primaryCardFeedbackShotRow?.id ?? 'none',
    'data-card-feedback-primary-shot-audio': state.primaryCardFeedbackShotAudioCue,
    'data-card-feedback-primary-shot-detail': state.primaryCardFeedbackShotRow?.detail ?? 'none',
    'data-card-feedback-primary-shot-focus': state.primaryCardFeedbackShotFocus,
    'data-card-feedback-primary-shot-label': state.primaryCardFeedbackShotRow?.shotLabel ?? 'none',
    'data-card-feedback-primary-shot-screen-cue': state.primaryCardFeedbackShotScreenCue,
    'data-chain-shot-map-summary-action': state.cardShotMapSummaryAction ?? 'none',
    'data-chain-shot-map-summary-beats': state.cardFeedbackShotMapRowsLength > 0 ? state.cardShotMapSummaryBeatCount : 0,
    'data-chain-shot-map-summary-screen-cue': state.cardShotMapSummaryScreenCue ?? 'none',
    'data-chain-shot-map-summary-tier': state.cardShotMapSummaryTier ?? 'none',
    'data-card-feedback-primary-beat': state.primaryCardFeedbackBeatRow?.id ?? 'none',
    'data-card-feedback-primary-beat-action': state.primaryCardFeedbackBeatRow?.action ?? 'none',
    'data-card-feedback-primary-beat-count': state.primaryCardFeedbackBeatRow?.beatCount ?? 0,
    'data-card-beat-map-summary-action': state.cardBeatMapSummaryAction ?? 'none',
    'data-card-beat-map-summary-beats': state.cardFeedbackBeatRowsLength > 0 ? state.cardBeatMapSummaryBeatCount : 0,
    'data-card-beat-map-summary-screen-cue': state.cardBeatMapSummaryScreenCue ?? 'none',
    'data-card-beat-map-summary-tier': state.cardBeatMapSummaryTier ?? 'none',
    'data-card-feedback-primary-cadence': state.primaryCardFeedbackCadenceRow?.id ?? 'none',
    'data-card-feedback-primary-cadence-action': state.primaryCardFeedbackCadenceRow?.action ?? 'none',
    'data-card-cadence-map-summary-action': state.cardCadenceMapSummaryAction ?? 'none',
    'data-card-cadence-map-summary-beats': state.cardFeedbackCadenceRowsLength > 0 ? state.cardCadenceMapSummaryBeatCount : 0,
    'data-card-cadence-map-summary-screen-cue': state.cardCadenceMapSummaryScreenCue ?? 'none',
    'data-card-cadence-map-summary-tier': state.cardCadenceMapSummaryTier ?? 'none',
    'data-card-feedback-marker-shapes': state.cardFeedbackMarkerShapesAttr,
    'data-card-feedback-trait-lane-beats': state.cardFeedbackTraitLaneBeatsAttr || 'none',
    'data-card-feedback-trait-lane-actions': state.cardFeedbackTraitLaneActionsAttr || 'none',
    'data-card-feedback-trait-lanes': state.cardFeedbackTraitLaneCuesAttr || 'none',
    'data-card-feedback-trait-lane-primary-audio': state.primaryTraitLaneAudioCue,
    'data-card-feedback-trait-lane-primary-action': state.cardFeedbackTraitLanePrimaryActionAttr,
    'data-card-feedback-trait-lane-primary-role': state.primaryTraitLaneBeatRow?.role ?? 'none',
    'data-card-feedback-trait-lane-primary-role-id': state.traitLaneBeatMapSummaryAction ?? 'none',
    'data-card-feedback-trait-lane-primary-screen-cue': state.primaryTraitLaneScreenCue,
    'data-card-trait-lane-beat-map-summary-action': state.traitLaneBeatMapSummaryAction ?? 'none',
    'data-card-trait-lane-beat-map-summary-beats': state.cardFeedbackTraitLaneBeatRowsLength > 0 ? state.traitLaneBeatMapSummaryBeatCount : 0,
    'data-card-trait-lane-beat-map-summary-screen-cue': state.traitLaneBeatMapSummaryScreenCue ?? 'none',
    'data-card-trait-lane-beat-map-summary-tier': state.traitLaneBeatMapSummaryTier ?? 'none',
    'data-card-feedback-route-glyphs': state.cardFeedbackRouteGlyphsAttr || 'none',
    'data-card-feedback-trait-route-intensities': state.cardFeedbackTraitRouteIntensitiesAttr,
    'data-card-feedback-trait-route-tiers': state.cardFeedbackTraitRouteTiersAttr,
    'data-card-feedback-primary-action': state.cardFeedbackPrimaryActionAttr,
    'data-card-feedback-primary-action-role': state.primaryCardActionPriorityRow?.role ?? 'none',
    'data-card-feedback-primary-action-role-id': state.primaryCardActionPriorityRow?.tone ?? 'none',
    'data-card-feedback-primary-action-screen-cue': state.primaryCardActionPriorityRow?.screenCue ?? 'none',
    'data-card-feedback-primary-action-tone': state.primaryCardActionPriorityRow?.tone ?? 'none',
    'data-card-action-priority-summary-action': state.cardActionPrioritySummaryAction ?? 'none',
    'data-card-action-priority-summary-beats': state.cardFeedbackActionPriorityRowsLength > 0 ? state.cardActionPrioritySummaryBeatCount : 0,
    'data-card-action-priority-summary-screen-cue': state.cardActionPrioritySummaryScreenCue ?? 'none',
    'data-card-action-priority-summary-tier': state.cardActionPrioritySummaryTier ?? 'none',
    'data-card-feedback-primary-card-cue': state.cardFeedbackPrimaryCardCueAttr,
    'data-card-feedback-trait-payoff-stack': state.cardFeedbackTraitPayoffStackActive ? 'true' : 'false',
    'data-card-feedback-last-resolution': state.lastResolutionFeedback,
    'data-card-feedback-reduced-motion': state.reduceMotion ? 'static-state-cues' : 'animated-state-cues',
    'data-card-feedback-visible-trait-preview-count': state.cardFeedbackVisibleTraitPreviewCount
});

export const buildChainFeedbackTelemetryAttrs = (state: ChainFeedbackTelemetryState): TileBoardFeedbackTelemetryAttrs => ({
    'data-chain-opportunity-ready-count': state.boardChainOpportunity.chainReadyCount,
    'data-chain-opportunity-ready-tile-count': state.boardChainOpportunity.chainReadyTileCount,
    'data-chain-opportunity-setup-count': state.boardChainOpportunity.setupCount,
    'data-chain-opportunity-armed-perk': state.boardChainOpportunity.armedPerkLabel ?? 'none',
    'data-chain-opportunity-armed-perk-payoff': state.boardChainOpportunity.armedPerkPayoff ?? 'none',
    'data-chain-opportunity-priority': state.boardChainOpportunity.priorityLabel ?? 'none',
    'data-chain-opportunity-momentum': state.boardChainOpportunity.momentumLabel ?? 'none',
    'data-chain-opportunity-next-action': state.boardChainOpportunity.nextActionId,
    'data-chain-opportunity-next-action-detail': state.boardChainOpportunity.nextActionDetail ?? 'none',
    'data-chain-opportunity-next-action-label': state.boardChainOpportunity.nextActionLabel ?? 'none',
    'data-chain-opportunity-next-action-tone': state.boardChainOpportunity.nextActionTone,
    'data-chain-opportunity-recipes': state.boardChainRecipeChips.join('|') || 'none',
    'data-chain-marker-key-action': state.boardChainMarkerKeySummaryAction ?? 'none',
    'data-chain-marker-key-beats': state.boardChainMarkerKeyRowsLength > 0 ? state.boardChainMarkerKeySummaryBeatCount : 0,
    'data-chain-marker-key-screen-cue': state.boardChainMarkerKeySummaryScreenCue ?? 'none',
    'data-chain-marker-key-tier': state.boardChainMarkerKeySummaryTier ?? 'none',
    'data-trait-interaction-lane-actions': state.boardTraitInteractionLaneActionMapAttrValue || 'none',
    'data-trait-interaction-lane-map': state.boardTraitInteractionLaneMapAttrValue || 'none',
    'data-trait-interaction-lane-roles': state.boardTraitInteractionLaneRoleMapAttrValue || 'none',
    'data-trait-interaction-lane-count': state.boardTraitInteractionLaneMap.length,
    'data-chain-opportunity-target-plan': state.boardChainOpportunity.targetPlanLabel ?? 'none',
    'data-chain-opportunity-beat-action': state.boardChainOpportunity.beatSignal?.action ?? 'none',
    'data-chain-opportunity-beat-action-id': state.boardChainOpportunityBeatActionId ?? 'none',
    'data-chain-opportunity-beat-audio': state.boardChainOpportunity.beatSignal?.audioCue ?? 'none',
    'data-chain-opportunity-beat-count': state.boardChainOpportunity.beatSignal?.beatCount ?? 0,
    'data-chain-opportunity-beat-cue': state.boardChainOpportunity.beatSignal?.cue ?? 'none',
    'data-chain-opportunity-beat-screen-cue': state.boardChainOpportunity.beatSignal?.screenCue ?? 'none',
    'data-chain-opportunity-beat-tier': state.boardChainOpportunity.beatSignal?.tier ?? 'none',
    'data-chain-opportunity-beat-label': state.boardChainOpportunity.beatSignal?.label ?? 'none',
    'data-chain-opportunity-callout': state.boardChainOpportunity.arcadeCallout?.label ?? 'none',
    'data-chain-opportunity-callout-value': state.boardChainOpportunity.arcadeCallout?.value ?? 'none',
    'data-chain-opportunity-callout-tone': state.boardChainOpportunity.arcadeCallout?.tone ?? 'none',
    'data-chain-opportunity-chase': state.boardChainOpportunity.chaseLabel ?? 'none',
    'data-chain-opportunity-milestone-action': state.boardChainOpportunity.milestoneActionLabel ?? 'none',
    'data-chain-opportunity-milestone-screen-cue': state.boardChainOpportunity.milestoneScreenCue ?? 'none',
    'data-chain-opportunity-milestone-target': state.boardChainOpportunity.milestoneTargetLabel ?? 'none',
    'data-chain-opportunity-milestone-tier': state.boardChainOpportunity.milestoneTier ?? 'none',
    'data-chain-opportunity-milestone-tone': state.boardChainOpportunity.milestoneTone ?? 'none',
    'data-chain-opportunity-reward-urgency': state.boardChainOpportunity.rewardUrgencyLabel ?? 'none',
    'data-chain-opportunity-reward-urgency-tier': state.boardChainOpportunity.rewardUrgencyTier ?? 'none',
    'data-chain-opportunity-reward-hot': state.boardChainOpportunity.rewardHot ? 'true' : 'false',
    'data-chain-opportunity-combo-surge': state.boardChainOpportunity.comboSurgeLabel ? 'true' : 'false',
    'data-chain-opportunity-hot-band': state.boardChainStatusMeters.hotBand?.tone ?? 'none',
    'data-chain-hot-band-action': state.boardChainStatusMeters.hotBand?.action ?? 'none',
    'data-chain-hot-band-beats': state.boardChainStatusMeters.hotBand?.beatCount ?? 0,
    'data-chain-hot-band-screen-cue': state.boardChainStatusMeters.hotBand?.screenCue ?? 'none',
    'data-chain-hot-band-tier': state.boardChainStatusMeters.hotBand?.tier ?? 'none',
    'data-chain-surge-band-action': state.boardChainStatusMeters.surgeBand?.action ?? 'none',
    'data-chain-surge-band-beats': state.boardChainStatusMeters.surgeBand?.beatCount ?? 0,
    'data-chain-surge-band-screen-cue': state.boardChainStatusMeters.surgeBand?.screenCue ?? 'none',
    'data-chain-surge-band-tier': state.boardChainStatusMeters.surgeBand?.tier ?? 'none',
    'data-chain-reward-ladder': state.boardRewardLadderState.attr,
    'data-chain-reward-ladder-actions': state.boardRewardLadderState.actionAttr,
    'data-chain-reward-ladder-count': state.boardRewardLadderState.entries.length,
    'data-chain-reward-ladder-summary-action': state.boardRewardLadderState.summaryAction ?? 'none',
    'data-chain-reward-ladder-summary-beats': state.boardRewardLadderState.summaryBeatCount,
    'data-chain-reward-ladder-summary-screen-cue': state.boardRewardLadderState.summaryScreenCue ?? 'none',
    'data-chain-reward-ladder-summary-tier': state.boardRewardLadderState.summaryTier ?? 'none',
    'data-chain-opportunity-streak-cashout-ready': state.boardChainOpportunity.streakCashoutReady ? 'true' : 'false',
    'data-chain-opportunity-selected-followups': state.boardChainOpportunity.selectedFollowupCount,
    'data-chain-opportunity-selected-followup-label': state.boardChainOpportunity.selectedFollowupLabel ?? 'none',
    'data-chain-sequence-first': state.boardChainSequenceCue?.first ?? 'none',
    'data-chain-sequence-keep': state.boardChainSequenceCue?.keep ?? 'none',
    'data-chain-sequence-then': state.boardChainSequenceCue?.then ?? 'none',
    'data-chain-sequence-tone': state.boardChainSequenceCue?.tone ?? 'none',
    'data-chain-opportunity-cue': state.boardChainOpportunity.cue || 'none',
    'data-chain-opportunity-screen-cue': state.boardChainOpportunity.beatSignal?.screenCue ?? 'none',
    'data-chain-opportunity-target': state.boardChainOpportunity.nextTarget ?? 'none',
    'data-chain-accessibility-tone': state.boardChainAccessibilitySummary.tone,
    'data-chain-accessibility-ready-count': state.boardChainAccessibilitySummary.readyCount,
    'data-chain-accessibility-followup-count': state.boardChainAccessibilitySummary.followupCount,
    'data-chain-accessibility-surge-count': state.boardChainAccessibilitySummary.surgeCount,
    'data-chain-accessibility-reward-hot-count': state.boardChainAccessibilitySummary.rewardHotCount,
    'data-chain-accessibility-setup-count': state.boardChainAccessibilitySummary.setupCount,
    'data-chain-accessibility-primary-line': state.boardChainAccessibilitySummary.primaryLine,
    'data-chain-accessibility-secondary-line': state.boardChainAccessibilitySummary.secondaryLine ?? 'none'
});

export const buildStatusFeedbackTelemetryAttrs = (state: StatusFeedbackTelemetryState): TileBoardFeedbackTelemetryAttrs => ({
    'data-trait-mode-tone': state.boardTraitModeCue?.tone ?? 'none',
    'data-trait-mode-value': state.boardTraitModeCue?.value ?? 'none',
    'data-trait-mode-detail': state.boardTraitModeCue?.detail ?? 'none',
    'data-trait-mode-action': state.boardTraitModeCue?.action ?? 'none',
    'data-trait-mode-beats': state.boardTraitModeCue?.beatCount ?? 0,
    'data-trait-mode-screen-cue': state.boardTraitModeCue?.screenCue ?? 'none',
    'data-trait-mode-tier': state.boardTraitModeCue?.tier ?? 'none',
    'data-hazard-opportunity-count': state.boardHazardOpportunity.count,
    'data-hazard-opportunity-action': state.boardHazardOpportunity.count > 0 ? state.boardHazardOpportunity.action : 'none',
    'data-hazard-opportunity-family': state.boardHazardOpportunity.family,
    'data-hazard-opportunity-screen-cue': state.boardHazardOpportunity.count > 0 ? state.boardHazardOpportunity.screenCue : 'none',
    'data-hazard-opportunity-tier': state.boardHazardOpportunity.count > 0 ? state.boardHazardOpportunity.tier : 'none',
    'data-hazard-opportunity-trigger': state.boardHazardOpportunity.trigger,
    'data-active-power-action': state.activePowerBoardChip?.action ?? 'none',
    'data-active-power-screen-cue': state.activePowerBoardChip?.screenCue ?? 'none',
    'data-active-power-tier': state.activePowerBoardChip?.tier ?? 'none',
    'data-pickup-opportunity-count': state.boardPickupOpportunity.count,
    'data-pickup-opportunity-action': state.boardPickupOpportunityChip?.action ?? 'none',
    'data-pickup-opportunity-beats': state.boardPickupOpportunityChip?.beatCount ?? 0,
    'data-pickup-opportunity-focus': state.boardPickupOpportunityChip?.focus ?? 'none',
    'data-pickup-opportunity-screen-cue': state.boardPickupOpportunityChip?.screenCue ?? 'none',
    'data-pickup-opportunity-tier': state.boardPickupOpportunityChip?.tier ?? 'none',
    'data-pickup-sequence-first': state.boardPickupOpportunity.sequenceCue?.first ?? 'none',
    'data-pickup-sequence-keep': state.boardPickupOpportunity.sequenceCue?.keep ?? 'none',
    'data-pickup-sequence-then': state.boardPickupOpportunity.sequenceCue?.then ?? 'none',
    'data-pickup-sequence-tone': state.boardPickupOpportunity.sequenceCue?.tone ?? 'none',
    'data-pickup-opportunity-tile-count': state.boardPickupOpportunity.tileCount
});

export const buildOpportunityFeedbackTelemetryAttrs = (state: OpportunityFeedbackTelemetryState): TileBoardFeedbackTelemetryAttrs => ({
    'data-opportunity-best-id': state.boardBestOpportunity?.id ?? 'none',
    'data-opportunity-best-action': state.boardBestOpportunity?.action ?? 'none',
    'data-opportunity-best-action-id': state.boardBestOpportunityActionId ?? 'none',
    'data-opportunity-best-label': state.boardBestOpportunity?.label ?? 'none',
    'data-opportunity-best-value': state.boardBestOpportunity?.value ?? 'none',
    'data-opportunity-best-detail': state.boardBestOpportunity?.detail ?? 'none',
    'data-opportunity-best-tone': state.boardBestOpportunity?.tone ?? 'none',
    'data-opportunity-best-impact-cue': state.boardBestOpportunity?.impactCue ?? 'none',
    'data-opportunity-best-impact-cue-id': state.boardBestOpportunityImpactCueId ?? 'none',
    'data-opportunity-best-heat': state.boardBestOpportunityHeat,
    'data-opportunity-best-beats': state.boardBestOpportunityBeatCount,
    'data-opportunity-best-audio': state.boardBestOpportunity ? state.boardBestOpportunityAudio : 'none',
    'data-opportunity-best-screen-cue': state.boardBestOpportunity ? state.boardBestOpportunityScreenCue : 'none',
    'data-opportunity-payoff-stack': state.boardPayoffStack?.value ?? 'none',
    'data-opportunity-payoff-stack-action': state.boardPayoffStack?.action ?? 'none',
    'data-opportunity-payoff-crescendo-audio': state.boardPayoffStack ? state.boardPayoffStackCrescendoAudio : 'none',
    'data-opportunity-payoff-crescendo-beats': state.boardPayoffStack?.crescendo.beatCount ?? 0,
    'data-opportunity-payoff-crescendo-cue': state.boardPayoffStack?.crescendo.screenCue ?? 'none',
    'data-opportunity-payoff-crescendo-screen-cue': state.boardPayoffStack?.crescendo.screenCue ?? 'none',
    'data-opportunity-payoff-crescendo-tier': state.boardPayoffStack?.crescendo.tier ?? 'none',
    'data-opportunity-payoff-stack-cue': state.boardPayoffStack?.cue ?? 'none',
    'data-opportunity-payoff-stack-cue-id': state.boardPayoffStack?.cueId ?? 'none',
    'data-opportunity-payoff-first-cue': state.boardPayoffStack?.nextCue ?? 'none',
    'data-opportunity-payoff-keep-cue': state.boardPayoffStack?.sequence.keep ?? 'none',
    'data-opportunity-payoff-sequence-cue': state.boardPayoffStack?.sequenceCue ?? 'none',
    'data-opportunity-payoff-sequence-first': state.boardPayoffStack?.sequence.first ?? 'none',
    'data-opportunity-payoff-sequence-keep': state.boardPayoffStack?.sequence.keep ?? 'none',
    'data-opportunity-payoff-sequence-then': state.boardPayoffStack?.sequence.then ?? 'none',
    'data-opportunity-payoff-stack-tone': state.boardPayoffStack?.tone ?? 'none',
    'data-opportunity-compass-count': state.boardOpportunityCompassRowsLength,
    'data-opportunity-compass-summary-action': state.boardOpportunityCompassSummaryAction ?? 'none',
    'data-opportunity-compass-summary-action-label': state.boardOpportunityCompassSummaryActionLabel,
    'data-opportunity-compass-summary-beats': state.boardOpportunityCompassRowsLength > 0 ? state.boardOpportunityCompassSummaryBeatCount : 0,
    'data-opportunity-compass-summary-screen-cue': state.boardOpportunityCompassSummaryScreenCue ?? 'none',
    'data-opportunity-compass-summary-tier': state.boardOpportunityCompassRowsLength > 0 ? state.boardOpportunityCompassSummaryTier ?? 'none' : 'none',
    'data-opportunity-lane-actions': state.boardOpportunityLaneMapState.actionAttr,
    'data-opportunity-lane-action-ids': state.boardOpportunityLaneMapState.actionIdAttr,
    'data-opportunity-lane-map-action': state.boardOpportunityLaneMapSummaryAction ?? 'none',
    'data-opportunity-lane-map-beats': state.boardOpportunityLaneMapSummaryBeatCount,
    'data-opportunity-lane-map': state.boardOpportunityLaneMapState.attr,
    'data-opportunity-lane-map-screen-cue': state.boardOpportunityLaneMapSummaryScreenCue ?? 'none',
    'data-opportunity-lane-map-tier': state.boardOpportunityLaneMapSummaryTier ?? 'none',
    'data-opportunity-lane-count': state.boardOpportunityLaneMapState.rows.length,
    'data-opportunity-lane-label': state.boardOpportunityLaneMapState.rows[0]?.label ?? 'none',
    'data-opportunity-lane-roles': state.boardOpportunityLaneMapState.roleAttr,
    'data-opportunity-lane-role-ids': state.boardOpportunityLaneMapState.roleIdAttr,
    'data-opportunity-primary-lane': state.boardOpportunityLaneMapState.primaryLane?.id ?? 'none',
    'data-opportunity-primary-lane-action': state.boardOpportunityLaneMapState.primaryLane?.action ?? 'none',
    'data-opportunity-primary-lane-action-id': state.boardOpportunityLaneMapSummaryAction ?? 'none',
    'data-opportunity-primary-lane-audio': state.boardOpportunityLaneMapPrimaryView?.audio ?? 'none',
    'data-opportunity-primary-lane-beats': state.boardOpportunityLaneMapPrimaryView?.beatCount ?? 0,
    'data-opportunity-primary-lane-cue': state.boardOpportunityLaneMapState.primaryLane?.cue ?? 'none',
    'data-opportunity-primary-lane-focus': state.boardOpportunityLaneMapPrimaryView?.focus ?? 'none',
    'data-opportunity-primary-lane-role': state.boardOpportunityLaneMapPrimaryView?.role ?? 'none',
    'data-opportunity-primary-lane-role-id': state.boardOpportunityLaneMapPrimaryView?.roleId ?? 'none',
    'data-opportunity-primary-lane-screen-cue': state.boardOpportunityLaneMapPrimaryView?.screenCue ?? 'none'
});
