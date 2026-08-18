import type { ChainOpportunityBeatSignal } from '../copy/chainOpportunityBeat';

export type BoardOpportunityHeat = 'cashout' | 'normal' | 'prime' | 'surge';
export type ChainOpportunityBeatActionId = 'cashout' | 'followup' | 'route' | 'setup' | 'surge';
export type BoardOpportunityImpactCueId =
    | 'avoid-penalty'
    | 'chain-cashout'
    | 'combo-surge'
    | 'control-tool'
    | 'followup-route'
    | 'keep-streak'
    | 'perk-armed'
    | 'pickup-cashout'
    | 'prime-cashout'
    | 'rebuild-chase'
    | 'recall-tool'
    | 'recover-route'
    | 'route-cashout'
    | 'route-prime'
    | 'safe-pair'
    | 'save-cashout'
    | 'stack-cashout'
    | 'stack-prime'
    | 'super-stack'
    | 'tool-route'
    | 'trait-combo-route'
    | 'trait-combo-surge'
    | 'trait-stack-route'
    | 'trait-stack-surge';
export type BoardOpportunityActionId =
    | 'cashout'
    | 'claim'
    | 'followup'
    | 'match'
    | 'prime'
    | 'recover'
    | 'risk'
    | 'route'
    | 'study'
    | 'tool';
export type BoardOpportunityCompassSummaryAction = 'cashout' | 'claim' | 'prime' | 'recover' | 'risk' | 'route' | 'tool';
export type BoardOpportunityCompassSummaryTier = 'cashout' | 'prime' | 'recover' | 'risk' | 'route' | 'tool';
export type BoardFeedbackScreenCue = 'burst' | 'guard' | 'pulse' | 'snap' | 'tick';
export type BoardChainCueMeterState = 'cashout' | 'followup' | 'setup' | 'surge';
export type BoardChainOpportunityPriorityId = 'best' | 'followup' | 'ready' | 'setup';
export type BoardChainArcadeCalloutTone = 'cashout' | 'surge' | 'ready' | 'setup';
export type BoardPayoffStackCrescendoTier = 'cashout' | 'prime' | 'stack' | 'super';

export interface BoardOpportunityCompassCueRow {
    action: string;
    id: string;
    impactCue: string;
    tone: string;
}

export interface FocusedPreviewCueInput {
    kind: 'hazard' | 'pickup' | 'trait';
    rewardHotText?: string | null;
    tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
}

export const getBoardOpportunityHeat = (impactCue: string): BoardOpportunityHeat => {
    const normalizedCue = impactCue.toLowerCase();
    if (normalizedCue.includes('cashout') || normalizedCue.includes('super stack')) {
        return 'cashout';
    }
    if (normalizedCue.includes('surge')) {
        return 'surge';
    }
    if (
        normalizedCue.includes('prime') ||
        normalizedCue.includes('follow-up') ||
        normalizedCue.includes('perk armed')
    ) {
        return 'prime';
    }
    return 'normal';
};

export const getChainOpportunityBeatActionId = (signal: ChainOpportunityBeatSignal | null): ChainOpportunityBeatActionId | null => {
    if (!signal) {
        return null;
    }
    if (signal.tier === 'cashout') return 'cashout';
    if (signal.tier === 'surge') return 'surge';
    if (signal.tier === 'follow-up') return 'followup';
    if (signal.tier === 'route') return 'route';
    return 'setup';
};

export const getBoardChainCueAction = (state: BoardChainCueMeterState): 'Cash now' | 'Chain routes' | 'Follow up' | 'Prime route' => {
    if (state === 'cashout') return 'Cash now';
    if (state === 'surge') return 'Chain routes';
    if (state === 'followup') return 'Follow up';
    return 'Prime route';
};

export const getBoardChainCueAudioCue = (
    state: BoardChainCueMeterState
): 'chain-cue-cashout' | 'chain-cue-followup' | 'chain-cue-prime' | 'chain-cue-surge' => {
    if (state === 'cashout') return 'chain-cue-cashout';
    if (state === 'surge') return 'chain-cue-surge';
    if (state === 'followup') return 'chain-cue-followup';
    return 'chain-cue-prime';
};

export const getBoardChainCueScreenCue = (state: BoardChainCueMeterState): BoardFeedbackScreenCue => {
    if (state === 'cashout') return 'burst';
    if (state === 'surge' || state === 'followup') return 'pulse';
    return 'tick';
};

export const getBoardChainPriorityAudioCue = (
    priority: BoardChainOpportunityPriorityId
): 'chain-priority-best' | 'chain-priority-followup' | 'chain-priority-ready' | 'chain-priority-setup' => {
    if (priority === 'best') return 'chain-priority-best';
    if (priority === 'followup') return 'chain-priority-followup';
    if (priority === 'ready') return 'chain-priority-ready';
    return 'chain-priority-setup';
};

export const getBoardChainPriorityScreenCue = (priority: BoardChainOpportunityPriorityId): BoardFeedbackScreenCue => {
    if (priority === 'best') return 'burst';
    if (priority === 'followup' || priority === 'ready') return 'pulse';
    return 'tick';
};

export const getBoardChainCalloutAction = (
    tone: BoardChainArcadeCalloutTone
): 'Cash now' | 'Chain routes' | 'Match route' | 'Prime route' => {
    if (tone === 'cashout') return 'Cash now';
    if (tone === 'surge') return 'Chain routes';
    if (tone === 'ready') return 'Match route';
    return 'Prime route';
};

export const getBoardChainCalloutAudioCue = (
    tone: BoardChainArcadeCalloutTone
): 'chain-callout-cashout' | 'chain-callout-ready' | 'chain-callout-setup' | 'chain-callout-surge' => {
    if (tone === 'cashout') return 'chain-callout-cashout';
    if (tone === 'surge') return 'chain-callout-surge';
    if (tone === 'ready') return 'chain-callout-ready';
    return 'chain-callout-setup';
};

export const getBoardChainCalloutScreenCue = (tone: BoardChainArcadeCalloutTone): BoardFeedbackScreenCue => {
    if (tone === 'cashout') return 'burst';
    if (tone === 'surge' || tone === 'ready') return 'pulse';
    return 'tick';
};

export const getBoardOpportunityImpactCueId = (impactCue: string): BoardOpportunityImpactCueId => {
    const cue = impactCue.toLowerCase();
    if (cue === 'super stack') return 'super-stack';
    if (cue === 'stack cashout') return 'stack-cashout';
    if (cue === 'stack prime') return 'stack-prime';
    if (cue === 'route cashout') return 'route-cashout';
    if (cue === 'chain cashout') return 'chain-cashout';
    if (cue === 'pickup cashout') return 'pickup-cashout';
    if (cue === 'reward cashout') return 'route-cashout';
    if (cue === 'prime cashout') return 'prime-cashout';
    if (cue === 'follow-up route') return 'followup-route';
    if (cue === 'combo surge') return 'combo-surge';
    if (cue === 'keep streak') return 'keep-streak';
    if (cue === 'route prime') return 'route-prime';
    if (cue === 'trait stack surge') return 'trait-stack-surge';
    if (cue === 'trait stack route') return 'trait-stack-route';
    if (cue === 'trait combo surge') return 'trait-combo-surge';
    if (cue === 'trait combo route') return 'trait-combo-route';
    if (cue === 'avoid penalty') return 'avoid-penalty';
    if (cue === 'perk armed') return 'perk-armed';
    if (cue === 'safe pair') return 'safe-pair';
    if (cue === 'recover route') return 'recover-route';
    if (cue === 'rebuild chase') return 'rebuild-chase';
    if (cue === 'save cashout') return 'save-cashout';
    if (cue === 'recall tool') return 'recall-tool';
    if (cue === 'control tool') return 'control-tool';
    return 'tool-route';
};

export const getBoardOpportunityActionId = (row: BoardOpportunityCompassCueRow | null): BoardOpportunityActionId | null => {
    if (!row) {
        return null;
    }
    const action = row.action.toLowerCase();
    if (action.includes('cash')) return 'cashout';
    if (action.includes('claim')) return 'claim';
    if (action.includes('follow')) return 'followup';
    if (action.includes('match')) return 'match';
    if (action.includes('prime')) return 'prime';
    if (action.includes('recover')) return 'recover';
    if (action.includes('scout') || row.id === 'hazard' || row.tone === 'hazard' || row.tone === 'risk') return 'risk';
    if (action.includes('study')) return 'study';
    if (action.includes('use') || row.id === 'tool' || row.tone === 'control' || row.tone === 'recall') return 'tool';
    return 'route';
};

export const getBoardOpportunityBeatCount = (row: BoardOpportunityCompassCueRow): 2 | 3 | 4 | 5 => {
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 5;
    }
    if (heat === 'surge') {
        return 4;
    }
    if (heat === 'prime' || row.id === 'hazard') {
        return 3;
    }
    return 2;
};

export const getBoardOpportunityCompassSummaryTier = (row: BoardOpportunityCompassCueRow | null): BoardOpportunityCompassSummaryTier => {
    if (!row) {
        return 'route';
    }
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 'cashout';
    }
    if (row.id === 'hazard' || row.tone === 'hazard' || row.tone === 'risk' || row.tone === 'lost-reward' || row.tone === 'control') {
        return 'risk';
    }
    if (row.id === 'recovery' || row.id === 'pickup' || row.tone === 'recover' || row.tone === 'pickup') {
        return 'recover';
    }
    if (row.id === 'tool' || row.tone === 'recall' || row.tone === 'setup') {
        return 'tool';
    }
    if (heat === 'prime' || heat === 'surge') {
        return 'prime';
    }
    return 'route';
};

export const getBoardOpportunityCompassSummaryAction = (
    row: BoardOpportunityCompassCueRow | null
): BoardOpportunityCompassSummaryAction | null => {
    if (!row) {
        return null;
    }
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 'cashout';
    }
    if (row.id === 'hazard' || row.tone === 'hazard' || row.tone === 'risk' || row.tone === 'lost-reward' || row.tone === 'control') {
        return 'risk';
    }
    if (row.id === 'pickup' || row.tone === 'pickup') {
        return 'claim';
    }
    if (row.id === 'recovery' || row.tone === 'recover') {
        return 'recover';
    }
    if (row.id === 'tool' || row.tone === 'recall') {
        return 'tool';
    }
    if (heat === 'prime' || heat === 'surge' || row.tone === 'setup' || row.tone === 'perk') {
        return 'prime';
    }
    return 'route';
};

export const getFocusedPreviewBeatCount = ({ kind, rewardHotText, tone }: FocusedPreviewCueInput): 3 | 4 | 5 => {
    if (tone === 'cashout' || rewardHotText) {
        return 5;
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 3;
    }
    return 4;
};

export const getFocusedPreviewAudioCue = ({
    kind,
    rewardHotText,
    tone
}: FocusedPreviewCueInput): 'preview-cashout' | 'preview-hazard' | 'preview-pickup' | 'preview-route' => {
    if (tone === 'cashout' || rewardHotText) {
        return 'preview-cashout';
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 'preview-hazard';
    }
    if (kind === 'pickup' || tone === 'pickup') {
        return 'preview-pickup';
    }
    return 'preview-route';
};

export const getFocusedPreviewScreenCue = ({ kind, rewardHotText, tone }: FocusedPreviewCueInput): BoardFeedbackScreenCue => {
    if (tone === 'cashout' || rewardHotText) {
        return 'burst';
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 'guard';
    }
    if (kind === 'pickup' || tone === 'pickup') {
        return 'snap';
    }
    return 'pulse';
};

export const boardOpportunityAudioCue = (
    row: BoardOpportunityCompassCueRow
): 'opportunity-cashout' | 'opportunity-hazard' | 'opportunity-perk' | 'opportunity-prime' | 'opportunity-recover' | 'opportunity-tool' => {
    if (row.id === 'hazard') {
        return 'opportunity-hazard';
    }
    if (row.id === 'recovery') {
        return 'opportunity-recover';
    }
    if (row.id === 'tool') {
        return 'opportunity-tool';
    }
    if (row.id === 'perk') {
        return 'opportunity-perk';
    }
    return getBoardOpportunityHeat(row.impactCue) === 'cashout' ? 'opportunity-cashout' : 'opportunity-prime';
};

export const boardOpportunityScreenCue = (row: BoardOpportunityCompassCueRow): BoardFeedbackScreenCue => {
    if (row.id === 'hazard' || row.id === 'recovery') {
        return 'guard';
    }
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 'burst';
    }
    if (heat === 'surge' || heat === 'prime') {
        return 'pulse';
    }
    return 'tick';
};

export const boardPayoffStackCrescendoAudioCue = (
    tier: BoardPayoffStackCrescendoTier
): 'cashout-pop' | 'prime-pop' | 'stack-burst' | 'super-burst' => {
    if (tier === 'super') {
        return 'super-burst';
    }
    if (tier === 'stack') {
        return 'stack-burst';
    }
    if (tier === 'cashout') {
        return 'cashout-pop';
    }
    return 'prime-pop';
};
