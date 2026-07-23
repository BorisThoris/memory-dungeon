import { runNonNegativeIntegerOrNull } from './run-number-guards';

export type SocialPlayDecisionId = 'share_strings' | 'pass_and_play' | 'online_challenges';
export type SocialPlayStatus = 'shipped' | 'deferred';

export interface SocialPlayDecisionRow {
    id: SocialPlayDecisionId;
    status: SocialPlayStatus;
    title: string;
    description: string;
    uiCopy: string;
    persistence: 'none' | 'derived_share_string';
    onlineRequired: false;
}

const SHIPPED_SOCIAL_PLAY_DECISION: SocialPlayDecisionRow = {
    id: 'share_strings',
    status: 'shipped',
    title: 'Share strings only',
    description:
        'v1 supports offline-safe share strings and deterministic local share keys for daily/run summaries.',
    uiCopy: 'Share-only v1: compare local score, seed, and streak text outside the app; no account required.',
    persistence: 'derived_share_string',
    onlineRequired: false
};

export const SOCIAL_PLAY_DECISIONS: readonly SocialPlayDecisionRow[] = [
    SHIPPED_SOCIAL_PLAY_DECISION,
    {
        id: 'pass_and_play',
        status: 'deferred',
        title: 'Pass-and-play',
        description:
            'Same-device multiplayer needs turn ownership, per-player labels, scoring handoff, and restart/game-over policy before it can ship.',
        uiCopy: 'Pass-and-play is not enabled in this build; modes remain single-player local runs.',
        persistence: 'none',
        onlineRequired: false
    },
    {
        id: 'online_challenges',
        status: 'deferred',
        title: 'Online challenges',
        description:
            'Competitive online comparison remains deferred until server trust, anti-cheat, and leaderboard policy exist.',
        uiCopy: 'Online challenges and leaderboards are deferred; daily/weekly comparison is local/share-string only.',
        persistence: 'none',
        onlineRequired: false
    }
];

export const getSocialPlayDecisionRows = (): readonly SocialPlayDecisionRow[] => SOCIAL_PLAY_DECISIONS;
export const getSocialPlayScopeRows = getSocialPlayDecisionRows;

export const SOCIAL_PLAY_SCOPE_DECISION = {
    shippedScope: 'share_only',
    persistedMultiplayerFields: [],
    onlineRequiresReg052: true
} as const;

export const getShippedSocialPlayDecision = (): SocialPlayDecisionRow =>
    SOCIAL_PLAY_DECISIONS.find((row) => row.status === 'shipped') ?? SHIPPED_SOCIAL_PLAY_DECISION;

export const buildSocialShareCopy = ({
    mode,
    score,
    seed
}: {
    mode: string;
    score: number | null;
    seed: number | null;
}): string => {
    const displaySeed = runNonNegativeIntegerOrNull(seed);
    const displayScore = runNonNegativeIntegerOrNull(score);
    const seedCopy = displaySeed == null ? 'seed unavailable' : `seed ${displaySeed}`;
    const scoreCopy = displayScore == null ? 'no score yet' : `${displayScore.toLocaleString()} local score`;
    return `${mode} · ${scoreCopy} · ${seedCopy} · share-only v1, no online rank`;
};
