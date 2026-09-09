export type ChainOpportunityBeatSignal = {
    action: 'Prime route' | 'Match route' | 'Tap follow-up' | 'Chain routes';
    audioCue: 'setup-beat' | 'route-beat' | 'follow-up-beat' | 'surge-beat';
    beatCount: 2 | 3 | 4;
    cue: 'pulse' | 'snap' | 'burst';
    detail: string;
    label: 'Prime beat' | 'Route beat' | 'Follow-up beat' | 'Surge beat';
    screenCue: 'pulse' | 'snap' | 'burst';
    tier: 'setup' | 'route' | 'follow-up' | 'surge';
};

interface ChainOpportunityBeatContext {
    chainReadyCount: number;
    comboSurgeLabel: string | null;
    followupReady: boolean;
    readyCardLabel: string | null;
    readyRouteLabel: string | null;
    selectedFollowupLabel: string | null;
    setupAction: string | null;
    setupCount: number;
}

export function getChainOpportunityBeatSignal({
    chainReadyCount,
    comboSurgeLabel,
    followupReady,
    readyCardLabel,
    readyRouteLabel,
    selectedFollowupLabel,
    setupAction,
    setupCount
}: ChainOpportunityBeatContext): ChainOpportunityBeatSignal | null {
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
