export type MechanicTokenId =
    | 'safe'
    | 'risk'
    | 'reward'
    | 'armed'
    | 'resolved'
    | 'hidden_known'
    | 'objective'
    | 'build'
    | 'cost'
    | 'forfeit'
    | 'locked'
    | 'momentum';

export interface MechanicTokenDefinition {
    id: MechanicTokenId;
    label: string;
    purpose: string;
    a11yHint: string;
}

export const MECHANIC_TOKEN_DEFINITIONS: Record<MechanicTokenId, MechanicTokenDefinition> = {
    safe: {
        id: 'safe',
        label: 'Safe',
        purpose: 'Recovery, protection, or lower-variance choices.',
        a11yHint: 'Identifies a choice or state that reduces danger.'
    },
    risk: {
        id: 'risk',
        label: 'Risk',
        purpose: 'Danger, volatility, or a choice with a known downside.',
        a11yHint: 'Identifies a warned danger or risky commitment.'
    },
    reward: {
        id: 'reward',
        label: 'Reward',
        purpose: 'Score, gold, Favor, guard, shards, keys, or other gains.',
        a11yHint: 'Identifies value the player can earn.'
    },
    armed: {
        id: 'armed',
        label: 'Armed',
        purpose: 'A hazard or effect is active and can matter on future turns.',
        a11yHint: 'Identifies an active threat or primed effect.'
    },
    resolved: {
        id: 'resolved',
        label: 'Resolved',
        purpose: 'A card, effect, room, or threat has been consumed or made safe.',
        a11yHint: 'Identifies a completed or no-longer-active mechanic.'
    },
    hidden_known: {
        id: 'hidden_known',
        label: 'Known clue',
        purpose: 'Fair information has been learned without revealing an exact solution.',
        a11yHint: 'Identifies partial information about hidden board state.'
    },
    objective: {
        id: 'objective',
        label: 'Objective',
        purpose: 'Floor, route, boss, or bonus requirements.',
        a11yHint: 'Identifies a goal or condition to complete.'
    },
    build: {
        id: 'build',
        label: 'Build',
        purpose: 'Relic, archetype, or run identity effects.',
        a11yHint: 'Identifies a run-build synergy or role.'
    },
    cost: {
        id: 'cost',
        label: 'Cost',
        purpose: 'Charges, gold, keys, shards, risk, or opportunity spent.',
        a11yHint: 'Identifies what will be spent or consumed.'
    },
    forfeit: {
        id: 'forfeit',
        label: 'Forfeit',
        purpose: 'Rewards, score, objectives, or Perfect Memory value that will be lost.',
        a11yHint: 'Identifies value that will be lost by this action.'
    },
    locked: {
        id: 'locked',
        label: 'Locked',
        purpose: 'Unavailable actions, gates, requirements, or contracts.',
        a11yHint: 'Identifies something unavailable and why.'
    },
    momentum: {
        id: 'momentum',
        label: 'Momentum',
        purpose: 'Streaks, shards, guard saves, route payoff, and build engines changing state.',
        a11yHint: 'Identifies a positive or negative run-state swing.'
    }
};

export type MechanicClass = 'skill_test' | 'tool' | 'bailout' | 'bypass';
export type MemoryTaxAxis =
    | 'informationBypass'
    | 'spatialDisruption'
    | 'mistakeRecovery'
    | 'hiddenPunishment'
    | 'boardCompletionRisk'
    | 'uiComprehensionLoad';

export const MEMORY_TAX_AXES = [
    'informationBypass',
    'spatialDisruption',
    'mistakeRecovery',
    'hiddenPunishment',
    'boardCompletionRisk',
    'uiComprehensionLoad'
] as const satisfies readonly MemoryTaxAxis[];

export type MemoryTaxScore = Record<MemoryTaxAxis, 0 | 1 | 2 | 3>;

export interface MemoryTaxReview {
    score: MemoryTaxScore;
    total: number;
    band: 'core_safe' | 'controlled_assist_or_pressure' | 'prototype_only' | 'reject_or_defer';
    blockedByAxis: boolean;
}

export const calculateMemoryTaxReview = (score: MemoryTaxScore): MemoryTaxReview => {
    const total = MEMORY_TAX_AXES.reduce<number>((sum, axis) => sum + score[axis], 0);
    const blockedByAxis = score.hiddenPunishment === 3 || score.boardCompletionRisk === 3;
    const band =
        total <= 4
            ? 'core_safe'
            : total <= 8
              ? 'controlled_assist_or_pressure'
              : total <= 12
                ? 'prototype_only'
                : 'reject_or_defer';

    return { score, total, band: blockedByAxis ? 'reject_or_defer' : band, blockedByAxis };
};

export const CORE_SAFE_MEMORY_TAX: MemoryTaxScore = {
    informationBypass: 0,
    spatialDisruption: 0,
    mistakeRecovery: 0,
    hiddenPunishment: 0,
    boardCompletionRisk: 0,
    uiComprehensionLoad: 0
};

export type PerfectMemoryImpact = 'allowed' | 'locks_perfect_memory';

export const perfectMemoryImpactCopy = (impact: PerfectMemoryImpact): string =>
    impact === 'allowed' ? 'Perfect Memory-safe.' : 'Assist used: Perfect Memory locked.';

export const assertTokenCoverage = (tokens: readonly MechanicTokenId[]): boolean =>
    tokens.every((token) => MECHANIC_TOKEN_DEFINITIONS[token]?.id === token);
