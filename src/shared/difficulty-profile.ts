import {
    MEMORIZE_BASE_MS,
    MEMORIZE_DECAY_EVERY_N_LEVELS,
    MEMORIZE_MIN_MS,
    MEMORIZE_STEP_MS
} from './contracts';

export type DifficultyProfileId = 'shipped_fair';
export type DifficultyProfileAvailability = 'active_default' | 'future_placeholder';
export type DifficultyProfileRowStatus = 'shipped' | 'deferred';

export interface DifficultyProfileRuleSummary {
    id: DifficultyProfileId;
    label: string;
    availability: DifficultyProfileAvailability;
    achievementEligible: true;
    dailyComparable: true;
    memorizeCurve: {
        baseMs: number;
        stepMs: number;
        minMs: number;
        decayEveryNLevels: number;
    };
    playerCopy: string;
}

export const SHIPPED_FAIR_DIFFICULTY_PROFILE: DifficultyProfileRuleSummary = {
    id: 'shipped_fair',
    label: 'Standard',
    availability: 'active_default',
    achievementEligible: true,
    dailyComparable: true,
    memorizeCurve: {
        baseMs: MEMORIZE_BASE_MS,
        stepMs: MEMORIZE_STEP_MS,
        minMs: MEMORIZE_MIN_MS,
        decayEveryNLevels: MEMORIZE_DECAY_EVERY_N_LEVELS
    },
    playerCopy:
        'Default: every floor states a par, and misses come from one small bank the whole run draws on - it opens with three, a floor clear or five matches in a row earns one, each lasts three floors and it never holds more than four; a run ends when you stop or when the bank runs dry before a floor is cleared. No selectable difficulty profile changes rules yet.'
} as const;

export const listDifficultyProfiles = (): DifficultyProfileRuleSummary[] => [
    SHIPPED_FAIR_DIFFICULTY_PROFILE
];

export const getDefaultDifficultyProfile = (): DifficultyProfileRuleSummary => SHIPPED_FAIR_DIFFICULTY_PROFILE;

export interface DifficultyProfileRow {
    id: 'classic_fair' | 'practice_soft' | 'purist_hard';
    label: string;
    status: DifficultyProfileRowStatus;
    dailyComparable: boolean;
    constants: {
        memorizeBaseMs: number;
        memorizeStepMs: number;
        memorizeMinMs: number;
    };
    rules: string;
}

const currentConstants = {
    memorizeBaseMs: MEMORIZE_BASE_MS,
    memorizeStepMs: MEMORIZE_STEP_MS,
    memorizeMinMs: MEMORIZE_MIN_MS
};

export const getCurrentDifficultyProfile = (): DifficultyProfileRow => ({
    id: 'classic_fair',
    label: 'Classic fair',
    status: 'shipped',
    dailyComparable: true,
    constants: currentConstants,
    rules: 'one curve for everyone: a par per floor, and a run-wide miss bank of two that each floor tops up by one, to three at most'
});

export const getDifficultyProfileRows = (): DifficultyProfileRow[] => [
    getCurrentDifficultyProfile(),
    {
        id: 'practice_soft',
        label: 'Practice soft',
        status: 'deferred',
        dailyComparable: false,
        constants: currentConstants,
        rules: 'future accessibility profile; deferred until settings/save schema owns rule variants'
    },
    {
        id: 'purist_hard',
        label: 'Purist hard',
        status: 'deferred',
        dailyComparable: false,
        constants: currentConstants,
        rules: 'future challenge profile; deferred so achievements/dailies remain comparable'
    }
];

