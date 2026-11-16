import { tr } from '../../shared/i18n';
export type ChainOpportunityBeatSignal = {
    action: string;
    audioCue: 'setup-beat' | 'route-beat' | 'follow-up-beat' | 'surge-beat';
    beatCount: 2 | 3 | 4;
    cue: 'pulse' | 'snap' | 'burst';
    detail: string;
    label: string;
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
            action: tr.s('Chain routes'),
            audioCue: 'surge-beat',
            beatCount: 4,
            detail: readyRouteLabel ?? readyCardLabel ?? tr.s('Multiple trait routes are lit'),
            label: tr.s('Surge beat'),
            cue: 'burst',
            screenCue: 'burst',
            tier: 'surge'
        };
    }
    if (followupReady) {
        return {
            action: tr.s('Tap follow-up'),
            audioCue: 'follow-up-beat',
            beatCount: 3,
            detail: selectedFollowupLabel ?? tr.s('Marked follow-up is ready'),
            label: tr.s('Follow-up beat'),
            cue: 'snap',
            screenCue: 'snap',
            tier: 'follow-up'
        };
    }
    if (chainReadyCount > 0) {
        return {
            action: tr.s('Match route'),
            audioCue: 'route-beat',
            beatCount: 3,
            detail: readyRouteLabel ?? readyCardLabel ?? tr.s('Trait route is lit'),
            label: tr.s('Route beat'),
            cue: 'snap',
            screenCue: 'snap',
            tier: 'route'
        };
    }
    if (setupCount > 0) {
        return {
            action: tr.s('Prime route'),
            audioCue: 'setup-beat',
            beatCount: 2,
            detail: setupAction ?? tr.s('Move traits together'),
            label: tr.s('Prime beat'),
            cue: 'pulse',
            screenCue: 'pulse',
            tier: 'setup'
        };
    }
    return null;
}

export function formatChainOpportunityBeatLabel(signal: ChainOpportunityBeatSignal): string {
    return tr`${signal.label}: ${signal.action}. ${signal.beatCount} beats. ${signal.detail}.`;
}
