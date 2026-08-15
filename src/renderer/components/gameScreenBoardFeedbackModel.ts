import { runFilteredArray, runFilteredStringArray } from '../../shared/run-array-guards';
import type { ChainRewardForecastCue } from '../copy/chainMomentum';
import type {
    MismatchFloaterRecoveryLaneMapEntry
} from '../copy/mismatchFloater';
import type {
    MatchScorePopPayoffChip,
    MatchScorePopPayoffLaneMapEntry
} from '../store/matchScorePop';

export const matchPayoffLaneMapAttr = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

export const matchPayoffLaneAction = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'Cash route' | 'Claim pickup' | 'Cash trait' | 'Cash chain' | 'Prime next' => {
    if (lane.id === 'route') {
        return 'Cash route';
    }
    if (lane.id === 'pickup') {
        return 'Claim pickup';
    }
    if (lane.id === 'trait') {
        return 'Cash trait';
    }
    if (lane.id === 'chain') {
        return 'Cash chain';
    }
    return 'Prime next';
};

export const matchPayoffLaneActionMapAttr = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${matchPayoffLaneAction(lane)}:${lane.count}`).join('>') : 'none';

export const matchPayoffLaneMapLabel = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[]): string => {
    if (laneMap.length === 0) {
        return '';
    }
    return `Match payoff lane map. ${laneMap
        .map((lane) => `${lane.label}: ${lane.count}. ${matchPayoffLaneAction(lane)}. ${lane.cue}.`)
        .join(' ')}`;
};

const MATCH_PAYOFF_CHIP_IDS: readonly MatchScorePopPayoffChip['id'][] = [
    'score',
    'streak',
    'cascade',
    'tier',
    'trait',
    'pickup',
    'route',
    'chainReward',
    'next'
];

const MATCH_PAYOFF_CHIP_TONES: readonly MatchScorePopPayoffChip['tone'][] = [
    'score',
    'chain',
    'trait',
    'pickup',
    'route',
    'reward',
    'guard',
    'heal'
];

const MATCH_PAYOFF_LANE_IDS: readonly MatchScorePopPayoffLaneMapEntry['id'][] = ['route', 'pickup', 'trait', 'chain', 'build'];
const MATCH_PAYOFF_LANE_TONES: readonly MatchScorePopPayoffLaneMapEntry['tone'][] = ['route', 'pickup', 'trait', 'chain', 'reward'];

const isMatchPayoffChip = (value: unknown): value is MatchScorePopPayoffChip => {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const chip = value as { arcadeCue?: unknown; id?: unknown; label?: unknown; tone?: unknown; value?: unknown };
    return (
        typeof chip.label === 'string' &&
        typeof chip.value === 'string' &&
        MATCH_PAYOFF_CHIP_IDS.includes(chip.id as MatchScorePopPayoffChip['id']) &&
        MATCH_PAYOFF_CHIP_TONES.includes(chip.tone as MatchScorePopPayoffChip['tone']) &&
        (chip.arcadeCue == null || typeof chip.arcadeCue === 'string')
    );
};

export const matchPayoffChips = (value: unknown): MatchScorePopPayoffChip[] =>
    runFilteredArray(value, isMatchPayoffChip);

const isMatchPayoffLane = (value: unknown): value is MatchScorePopPayoffLaneMapEntry => {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const lane = value as { count?: unknown; cue?: unknown; id?: unknown; label?: unknown; tone?: unknown };
    return (
        typeof lane.label === 'string' &&
        typeof lane.cue === 'string' &&
        typeof lane.count === 'number' &&
        Number.isFinite(lane.count) &&
        MATCH_PAYOFF_LANE_IDS.includes(lane.id as MatchScorePopPayoffLaneMapEntry['id']) &&
        MATCH_PAYOFF_LANE_TONES.includes(lane.tone as MatchScorePopPayoffLaneMapEntry['tone'])
    );
};

export const matchPayoffLaneMap = (value: unknown): MatchScorePopPayoffLaneMapEntry[] =>
    runFilteredArray(value, isMatchPayoffLane);

export const matchPayoffLadderLanes = (value: unknown): string[] => runFilteredStringArray(value);

const MATCH_CHAIN_REWARD_TONES: readonly ChainRewardForecastCue['tone'][] = ['reward', 'guard', 'heal'];
const MATCH_CHAIN_REWARD_URGENCIES: readonly ChainRewardForecastCue['urgency'][] = ['next', 'soon', 'later'];

const isMatchChainRewardForecastCue = (value: unknown): value is ChainRewardForecastCue => {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const cue = value as {
        actionLabel?: unknown;
        chaseLabel?: unknown;
        distance?: unknown;
        distanceLabel?: unknown;
        id?: unknown;
        label?: unknown;
        stackSize?: unknown;
        targetStreak?: unknown;
        tone?: unknown;
        urgency?: unknown;
    };
    return (
        typeof cue.actionLabel === 'string' &&
        typeof cue.chaseLabel === 'string' &&
        typeof cue.distance === 'number' &&
        Number.isFinite(cue.distance) &&
        typeof cue.distanceLabel === 'string' &&
        typeof cue.id === 'string' &&
        typeof cue.label === 'string' &&
        typeof cue.targetStreak === 'number' &&
        Number.isFinite(cue.targetStreak) &&
        MATCH_CHAIN_REWARD_TONES.includes(cue.tone as ChainRewardForecastCue['tone']) &&
        MATCH_CHAIN_REWARD_URGENCIES.includes(cue.urgency as ChainRewardForecastCue['urgency']) &&
        (cue.stackSize == null || (typeof cue.stackSize === 'number' && Number.isFinite(cue.stackSize)))
    );
};

export const matchChainRewardForecastCues = (value: unknown): ChainRewardForecastCue[] =>
    runFilteredArray(value, isMatchChainRewardForecastCue);

export const matchTraitInteractionTexts = (value: unknown): string[] => runFilteredStringArray(value);

export const mismatchRecoveryLaneMapAttr = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${lane.count}`).join('>') ?? 'none';

export const mismatchRecoveryLaneAction = (lane: MismatchFloaterRecoveryLaneMapEntry): string => {
    switch (lane.id) {
        case 'recover':
            return lane.cue === 'Safe pair' ? 'Confirm pair' : 'Stabilize route';
        case 'lost':
            return 'Save cashout';
        case 'chain':
            return lane.count > 1 ? 'Rebuild chain' : 'Reset chain';
        case 'tool':
            return 'Trigger tool';
        case 'risk':
            return 'Route away';
        default:
            return 'Recover';
    }
};

export const mismatchRecoveryLaneActionMapAttr = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${mismatchRecoveryLaneAction(lane)}:${lane.count}`).join('>') ?? 'none';

export const mismatchRecoveryLaneMapLabel = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.length
        ? `Recovery lane map. ${laneMap
              .map((lane) => `${lane.label}: ${lane.count}. ${mismatchRecoveryLaneAction(lane)}. ${lane.cue}.`)
              .join(' ')}`
        : '';

export const getMismatchRecoveryLaneBeatCount = (lane: MismatchFloaterRecoveryLaneMapEntry): 2 | 3 | 4 => {
    if (lane.id === 'lost' || lane.id === 'risk' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'chain' || lane.id === 'tool') {
        return 3;
    }
    return 2;
};

export const getPrimaryMismatchRecoveryLane = (
    laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null
): MismatchFloaterRecoveryLaneMapEntry | null =>
    laneMap?.reduce<MismatchFloaterRecoveryLaneMapEntry | null>((primary, lane) => {
        if (!primary || getMismatchRecoveryLaneBeatCount(lane) > getMismatchRecoveryLaneBeatCount(primary)) {
            return lane;
        }
        return primary;
    }, null) ?? null;

export const getMismatchRecoveryLaneAudioCue = (
    lane: MismatchFloaterRecoveryLaneMapEntry
): 'mismatch-recovery-safe' | 'mismatch-recovery-lost' | 'mismatch-recovery-chain' | 'mismatch-recovery-tool' | 'mismatch-recovery-risk' => {
    switch (lane.id) {
        case 'recover':
            return 'mismatch-recovery-safe';
        case 'lost':
            return 'mismatch-recovery-lost';
        case 'chain':
            return 'mismatch-recovery-chain';
        case 'tool':
            return 'mismatch-recovery-tool';
        default:
            return 'mismatch-recovery-risk';
    }
};

export const getMismatchRecoveryLaneScreenCue = (
    lane: MismatchFloaterRecoveryLaneMapEntry
): 'recover' | 'risk' | 'chain' | 'tool' | 'pulse' => {
    if (lane.id === 'lost' || lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'chain') {
        return 'chain';
    }
    if (lane.id === 'tool') {
        return 'tool';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    return 'pulse';
};

export const getBoardMatchPayoffStackBeatCount = (stack: { laneCount: number; tone: string }): 2 | 3 | 4 | 5 => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 5;
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward' || stack.tone === 'chain') {
        return 4;
    }
    if (stack.tone === 'score') {
        return 3;
    }
    return 2;
};

export const getBoardMatchPayoffStackAction = (
    stack: { laneCount: number; tone: string }
): 'Cash stack' | 'Claim payoff' | 'Hold chain' | 'Prime next' => {
    if (stack.laneCount >= 2 || stack.tone === 'combo' || stack.tone === 'reward') {
        return 'Cash stack';
    }
    if (stack.tone === 'chain') {
        return 'Hold chain';
    }
    if (stack.tone === 'score') {
        return 'Claim payoff';
    }
    return 'Prime next';
};

export const getBoardMatchPayoffStackAudioCue = (
    stack: { laneCount: number; tone: string }
): 'match-stack-super' | 'match-stack-cashout' | 'match-stack-chain' | 'match-stack-prime' => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 'match-stack-super';
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward') {
        return 'match-stack-cashout';
    }
    if (stack.tone === 'chain') {
        return 'match-stack-chain';
    }
    return 'match-stack-prime';
};

export const getBoardMatchPayoffStackScreenCue = (
    stack: { laneCount: number; tone: string }
): 'super' | 'burst' | 'chain' | 'pulse' => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 'super';
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward') {
        return 'burst';
    }
    if (stack.tone === 'chain') {
        return 'chain';
    }
    return 'pulse';
};
