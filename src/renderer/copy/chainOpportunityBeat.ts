export type ChainOpportunityBeatSignal = {
    action: 'Prime route' | 'Match route' | 'Tap follow-up' | 'Chain routes' | 'Cash out';
    audioCue: 'setup-beat' | 'route-beat' | 'follow-up-beat' | 'surge-beat' | 'cashout-beat';
    beatCount: 2 | 3 | 4 | 5;
    cue: 'pulse' | 'snap' | 'burst' | 'super';
    detail: string;
    label: 'Prime beat' | 'Route beat' | 'Follow-up beat' | 'Surge beat' | 'Cashout beat';
    screenCue: 'pulse' | 'snap' | 'burst' | 'super';
    tier: 'setup' | 'route' | 'follow-up' | 'surge' | 'cashout';
};

interface ChainOpportunityBeatContext {
    chainReadyCount: number;
    comboSurgeLabel: string | null;
    followupReady: boolean;
    nextTarget: string | null;
    readyCardLabel: string | null;
    readyRouteLabel: string | null;
    rewardCue: string | null;
    rewardHot: boolean;
    selectedFollowupLabel: string | null;
    setupAction: string | null;
    setupCount: number;
    streakCashoutReady: boolean;
}

export function getChainOpportunityBeatSignal({
    chainReadyCount,
    comboSurgeLabel,
    followupReady,
    nextTarget,
    readyCardLabel,
    readyRouteLabel,
    rewardCue,
    rewardHot,
    selectedFollowupLabel,
    setupAction,
    setupCount,
    streakCashoutReady
}: ChainOpportunityBeatContext): ChainOpportunityBeatSignal | null {
    if (rewardHot || streakCashoutReady) {
        return {
            action: 'Cash out',
            audioCue: 'cashout-beat',
            beatCount: 5,
            detail: nextTarget ?? rewardCue ?? 'Cashout is live',
            label: 'Cashout beat',
            cue: 'super',
            screenCue: 'super',
            tier: 'cashout'
        };
    }
    if (comboSurgeLabel) {
        return {
            action: 'Chain routes',
            audioCue: 'surge-beat',
            beatCount: 4,
            detail: readyRouteLabel ?? readyCardLabel ?? 'Multiple trait routes are lit',
            label: 'Surge beat',
            cue: 'burst',
            screenCue: 'burst',
            tier: 'surge'
        };
    }
    if (followupReady) {
        return {
            action: 'Tap follow-up',
            audioCue: 'follow-up-beat',
            beatCount: 3,
            detail: selectedFollowupLabel ?? 'Marked follow-up is ready',
            label: 'Follow-up beat',
            cue: 'snap',
            screenCue: 'snap',
            tier: 'follow-up'
        };
    }
    if (chainReadyCount > 0) {
        return {
            action: 'Match route',
            audioCue: 'route-beat',
            beatCount: 3,
            detail: readyRouteLabel ?? readyCardLabel ?? 'Trait route is lit',
            label: 'Route beat',
            cue: 'snap',
            screenCue: 'snap',
            tier: 'route'
        };
    }
    if (setupCount > 0) {
        return {
            action: 'Prime route',
            audioCue: 'setup-beat',
            beatCount: 2,
            detail: setupAction ?? 'Move traits together',
            label: 'Prime beat',
            cue: 'pulse',
            screenCue: 'pulse',
            tier: 'setup'
        };
    }
    return null;
}

export function formatChainOpportunityBeatLabel(signal: ChainOpportunityBeatSignal): string {
    return `${signal.label}: ${signal.action}. ${signal.beatCount} beats. ${signal.detail}.`;
}
