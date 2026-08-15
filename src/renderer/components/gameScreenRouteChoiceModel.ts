import type { RouteNodeType, RunState } from '../../shared/contracts';
import type { MemoryRouteChoiceFeedback } from '../../shared/memory-recall-feedback';

export const getRouteChoiceSignalLabels = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): { reward: string; risk: string } => {
    if (routeType === 'safe') {
        return { reward: 'Stable reward', risk: 'Low risk' };
    }
    if (routeType === 'greed') {
        return { reward: 'High reward', risk: 'High risk' };
    }
    return { reward: 'Board change', risk: 'Unknown risk' };
};

type RouteChoiceBeatCue = {
    action: string;
    audioCue: 'route-guard-beat' | 'route-cashout-beat' | 'route-prime-beat';
    beatCount: number;
    detail: string;
    label: string;
    screenCue: 'guard' | 'super' | 'pulse';
    tier: 'cashout' | 'guard' | 'prime';
};

export const getRouteChoiceBeatCue = (routeType: RouteNodeType): RouteChoiceBeatCue => {
    switch (routeType) {
        case 'greed':
            return {
                action: 'Cash greed',
                audioCue: 'route-cashout-beat',
                beatCount: 5,
                detail: 'Take only after recall is repaired.',
                label: 'Cashout beat',
                screenCue: 'super',
                tier: 'cashout'
            };
        case 'mystery':
            return {
                action: 'Prime mystery',
                audioCue: 'route-prime-beat',
                beatCount: 3,
                detail: 'Anchor the clue before accepting the remix.',
                label: 'Prime beat',
                screenCue: 'pulse',
                tier: 'prime'
            };
        case 'safe':
        default:
            return {
                action: 'Stabilize route',
                audioCue: 'route-guard-beat',
                beatCount: 2,
                detail: 'Guard the next floor before stacking value.',
                label: 'Guard beat',
                screenCue: 'guard',
                tier: 'guard'
            };
    }
};

type RouteChoicePayoffTone = 'reward' | 'risk' | 'memory' | 'build' | 'route';
type RouteChoicePayoffRow = { id: string; label: string; tone: RouteChoicePayoffTone; value: string };
type RouteChoiceDecisionStack = {
    label: 'Route stack' | 'Route safety' | 'Route gamble' | 'Route mystery';
    nextCue: string;
    tone: RouteChoicePayoffTone;
    value: string;
};
type RouteChoiceActionCue = {
    action: 'Stabilize route' | 'Cash greed' | 'Prime mystery';
    detail: string;
    label: 'Do next';
    tone: RouteChoicePayoffTone;
};
type RouteChoiceImpactCue = {
    label: 'Safe route' | 'Greed route' | 'Mystery route';
    tone: RouteChoicePayoffTone;
    value: string;
};
type SelectedRouteActionCue = {
    detail: string;
    label: 'Opening tactic';
    tone: RouteChoicePayoffTone;
    value: string;
};

export const getRouteChoiceToneBeatCount = (tone: RouteChoicePayoffTone): 2 | 3 | 4 => {
    if (tone === 'reward') {
        return 4;
    }
    if (tone === 'risk' || tone === 'build') {
        return 3;
    }
    return 2;
};

export const getRouteChoicePayoffAudioCue = (
    tone: RouteChoicePayoffTone
): 'route-payoff-reward' | 'route-payoff-risk' | 'route-payoff-memory' | 'route-payoff-build' | 'route-payoff-route' => {
    if (tone === 'reward') {
        return 'route-payoff-reward';
    }
    if (tone === 'risk') {
        return 'route-payoff-risk';
    }
    if (tone === 'memory') {
        return 'route-payoff-memory';
    }
    if (tone === 'build') {
        return 'route-payoff-build';
    }
    return 'route-payoff-route';
};

export const getRouteChoicePayoffScreenCue = (tone: RouteChoicePayoffTone): 'burst' | 'risk' | 'memory' | 'build' | 'pulse' => {
    if (tone === 'reward') {
        return 'burst';
    }
    if (tone === 'risk') {
        return 'risk';
    }
    if (tone === 'memory') {
        return 'memory';
    }
    if (tone === 'build') {
        return 'build';
    }
    return 'pulse';
};

export const getRouteChoiceSignalAudioCue = (signal: 'reward' | 'risk'): 'route-signal-reward' | 'route-signal-risk' =>
    signal === 'reward' ? 'route-signal-reward' : 'route-signal-risk';

export const getRouteChoiceSignalScreenCue = (signal: 'reward' | 'risk'): 'burst' | 'risk' =>
    signal === 'reward' ? 'burst' : 'risk';

export const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

const getRouteChoiceNextFloorRow = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): RouteChoicePayoffRow => {
    if (routeType === 'safe') {
        return { id: 'next', label: 'Next', tone: 'route', value: 'ward support' };
    }
    if (routeType === 'greed') {
        return { id: 'next', label: 'Next', tone: 'risk', value: 'richer caches' };
    }
    return { id: 'next', label: 'Next', tone: 'build', value: 'changed board' };
};

export const getSelectedRouteActionCue = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): SelectedRouteActionCue => {
    if (routeType === 'safe') {
        return {
            detail: 'Use ward support to preserve the first chain.',
            label: 'Opening tactic',
            tone: 'memory',
            value: 'Stabilize first pair'
        };
    }
    if (routeType === 'greed') {
        return {
            detail: 'Confirm recall before chasing richer caches.',
            label: 'Opening tactic',
            tone: 'risk',
            value: 'Verify before cashout'
        };
    }
    return {
        detail: 'Anchor the clue before the changed board spreads.',
        label: 'Opening tactic',
        tone: 'build',
        value: 'Solve clue first'
    };
};

export const getRouteChoicePayoffRows = ({
    memoryChoice,
    routeType
}: {
    memoryChoice?: MemoryRouteChoiceFeedback;
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoicePayoffRow[] => {
    const baseRows: RouteChoicePayoffRow[] =
        routeType === 'safe'
            ? [
                  { id: 'reward', label: 'Payoff', tone: 'reward' as const, value: 'steady clear' },
                  { id: 'risk', label: 'Risk', tone: 'memory' as const, value: 'low pressure' }
              ]
            : routeType === 'greed'
              ? [
                    { id: 'reward', label: 'Payoff', tone: 'reward' as const, value: 'bonus value' },
                    { id: 'risk', label: 'Risk', tone: 'risk' as const, value: 'high pressure' }
                ]
              : [
                    { id: 'reward', label: 'Payoff', tone: 'build' as const, value: 'board twist' },
                    { id: 'risk', label: 'Risk', tone: 'risk' as const, value: 'unknown' }
                ];

    const nextFloorRow = getRouteChoiceNextFloorRow(routeType);
    if (!memoryChoice) {
        return [...baseRows, nextFloorRow];
    }
    const memoryTone: RouteChoicePayoffTone =
        memoryChoice.readiness === 'ready' ? 'memory' : memoryChoice.readiness === 'unsafe' ? 'risk' : 'build';

    const rows: RouteChoicePayoffRow[] = [
        ...baseRows,
        nextFloorRow,
        {
            id: 'memory',
            label: 'Recall',
            tone: memoryTone,
            value: memoryChoice.readinessLabel
        }
    ];
    return rows.slice(0, 4);
};

export const getRouteChoiceDecisionStack = ({
    memoryChoice,
    payoffRows,
    routeType,
    signalLabels
}: {
    memoryChoice?: MemoryRouteChoiceFeedback;
    payoffRows: RouteChoicePayoffRow[];
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
    signalLabels: { reward: string; risk: string };
}): RouteChoiceDecisionStack => {
    const payoff = payoffRows.find((row) => row.id === 'reward')?.value ?? signalLabels.reward;
    const next = payoffRows.find((row) => row.id === 'next')?.value ?? 'next room';
    const recall = memoryChoice?.readinessLabel ? trimTerminalPunctuation(memoryChoice.readinessLabel) : undefined;
    const value = recall ? `${signalLabels.reward} + ${recall}` : `${signalLabels.reward} + ${next}`;
    if (routeType === 'safe') {
        return {
            label: 'Route safety',
            nextCue: `First: stabilize with ${next}`,
            tone: 'memory',
            value
        };
    }
    if (routeType === 'greed') {
        return {
            label: 'Route gamble',
            nextCue: `First: confirm recall before ${payoff}`,
            tone: 'risk',
            value
        };
    }
    return {
        label: 'Route mystery',
        nextCue: `First: anchor clue before ${next}`,
        tone: 'build',
        value
    };
};

export const getRouteChoiceActionCue = ({
    decisionStack,
    memoryChoice,
    routeType
}: {
    decisionStack: RouteChoiceDecisionStack;
    memoryChoice?: MemoryRouteChoiceFeedback;
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoiceActionCue => {
    if (routeType === 'safe') {
        return {
            action: 'Stabilize route',
            detail: memoryChoice?.readinessLabel ?? decisionStack.nextCue.replace(/^First:\s*/u, ''),
            label: 'Do next',
            tone: 'memory'
        };
    }
    if (routeType === 'greed') {
        return {
            action: 'Cash greed',
            detail:
                memoryChoice?.readiness === 'unsafe'
                    ? 'Repair recall before taking pressure cashout'
                    : memoryChoice?.readinessLabel ?? 'Confirm recall before bonus value',
            label: 'Do next',
            tone: memoryChoice?.readiness === 'unsafe' ? 'risk' : 'reward'
        };
    }
    return {
        action: 'Prime mystery',
        detail: memoryChoice?.readinessLabel ?? 'Anchor clue before board remix',
        label: 'Do next',
        tone: 'build'
    };
};

export const getRouteChoiceImpactCue = ({
    decisionStack,
    routeType
}: {
    decisionStack: RouteChoiceDecisionStack;
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoiceImpactCue => {
    if (routeType === 'safe') {
        return { label: 'Safe route', tone: decisionStack.tone, value: 'Shield next floor' };
    }
    if (routeType === 'greed') {
        return { label: 'Greed route', tone: decisionStack.tone, value: 'Pressure cashout' };
    }
    return { label: 'Mystery route', tone: decisionStack.tone, value: 'Board remix' };
};

export const getSelectedRouteImpactCue = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): RouteChoiceImpactCue => {
    if (routeType === 'safe') {
        return { label: 'Safe route', tone: 'memory', value: 'Ward support locked' };
    }
    if (routeType === 'greed') {
        return { label: 'Greed route', tone: 'risk', value: 'Risk cashout locked' };
    }
    return { label: 'Mystery route', tone: 'build', value: 'Remix locked' };
};
