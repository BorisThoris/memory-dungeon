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
        status: 'shipped',
        title: 'Pass-and-play',
        description:
            'Same-device multiplayer ships with turn ownership (a miss passes the device), per-player labels and scores in the HUD, a handoff beat between turns, and a restart that keeps the table seated. It persists nothing: a shared game sets no personal best and writes no run history.',
        uiCopy: 'Pass and Play: two to four people on one device, offline. Shared games are not recorded to this profile.',
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
    /**
     * Widened from `share_only` when pass-and-play shipped. Everything still local: the online row
     * below is the one that is deferred, and it is deferred for the same reasons it always was.
     */
    shippedScope: 'share_and_same_device',
    persistedMultiplayerFields: [],
    onlineRequiresReg052: true
} as const;

/**
 * The first shipped row. More than one ships now, so this is the *primary* one rather than the only
 * one — callers that want the whole picture should read the rows or use `buildSocialScopeNote`.
 */
export const getShippedSocialPlayDecision = (): SocialPlayDecisionRow =>
    SOCIAL_PLAY_DECISIONS.find((row) => row.status === 'shipped') ?? SHIPPED_SOCIAL_PLAY_DECISION;

/** Short labels for the scope note, so it never has to be restated in a component. */
const SOCIAL_SCOPE_NOTE_LABEL: Record<SocialPlayDecisionId, string> = {
    online_challenges: 'Online challenges',
    pass_and_play: 'same-device play',
    share_strings: 'share strings'
};

/**
 * The one line Choose Your Path shows about what this build's social layer actually is.
 *
 * Derived from the decision table rather than written beside it: the hand-written version said
 * "local runs and share strings only" and stayed on screen saying it after same-device play
 * shipped, which is a promise the game was no longer keeping. A sentence built from the rows it
 * describes cannot drift from them.
 */
export const buildSocialScopeNote = (): string => {
    const shipped = SOCIAL_PLAY_DECISIONS.filter((row) => row.status === 'shipped').map(
        (row) => SOCIAL_SCOPE_NOTE_LABEL[row.id]
    );
    const deferred = SOCIAL_PLAY_DECISIONS.filter((row) => row.status === 'deferred').map(
        (row) => SOCIAL_SCOPE_NOTE_LABEL[row.id]
    );
    const list = (parts: readonly string[]): string =>
        parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    const head = `Offline-first: local runs, ${list(shipped)}.`;
    return deferred.length === 0 ? head : `${head} ${list(deferred)} stay deferred.`;
};

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
