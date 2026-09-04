import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG } from './mechanics-encyclopedia';

/**
 * The recipe that reproduces a run on another machine.
 *
 * `buildRunShareKey` in `run-history.ts` predates this and records only `mode:rules:seed`. That is
 * not enough to reproduce what the player played: Wild Run, Practice, Scholar Contract and Pin vow
 * are all `endless` underneath, so all four produce a key that replays as a plain Classic run on
 * the same board. A key that hands someone a different run under the same name is worse than no
 * key, so this carries the variant a player actually picked, plus whatever else that variant needs
 * to come out the same — the clock for a gauntlet, the chosen mutators for a meditation.
 *
 * The `md1` prefix is a version marker. When the shape has to change, old keys can still be read
 * or refused deliberately instead of silently parsing into something else.
 */

export const RUN_SHARE_KEY_PREFIX = 'md1';

export type RunShareVariant =
    | 'classic'
    | 'wild'
    | 'practice'
    | 'scholar'
    | 'pin_vow'
    | 'showcase'
    | 'gauntlet'
    | 'meditation';

export interface RunShareKey {
    readonly variant: RunShareVariant;
    readonly rulesVersion: number;
    readonly seed: number;
    /** Gauntlet only: the clock the run was played against. */
    readonly durationMs?: number;
    /** Meditation only: the focus mutators the player chose. */
    readonly mutators?: readonly MutatorId[];
}

/** Why a run cannot be handed over, in the words the player is shown. */
export type RunShareRefusal =
    | 'A daily is already the same run for everyone — share the date, not a key.'
    | 'A puzzle board is its tiles, not a seed, so there is no key that reproduces it.';

const variantOf = (run: RunState): RunShareVariant | RunShareRefusal => {
    if (run.gameMode === 'daily') {
        return 'A daily is already the same run for everyone — share the date, not a key.';
    }
    if (run.gameMode === 'puzzle') {
        return 'A puzzle board is its tiles, not a seed, so there is no key that reproduces it.';
    }
    if (run.gameMode === 'gauntlet') {
        return 'gauntlet';
    }
    if (run.gameMode === 'meditation') {
        return 'meditation';
    }
    if (run.dungeonShowcaseRun) {
        return 'showcase';
    }
    // Same precedence as `createRestartRun`, so a key and a retry never disagree.
    if (run.activeContract?.maxPinsTotalRun != null) {
        return 'pin_vow';
    }
    if (run.wildMenuRun) {
        return 'wild';
    }
    if (run.practiceMode) {
        return 'practice';
    }
    if (run.activeContract?.noShuffle === true && run.activeContract.noDestroy) {
        return 'scholar';
    }
    return 'classic';
};

const isRefusal = (value: RunShareVariant | RunShareRefusal): value is RunShareRefusal => value.includes(' ');

export const describeRunShareKey = (run: RunState): { key: RunShareKey } | { refusal: RunShareRefusal } => {
    const variant = variantOf(run);
    if (isRefusal(variant)) {
        return { refusal: variant };
    }
    const seed = run.lastRunSummary?.runSeed ?? run.runSeed;
    const rulesVersion = run.lastRunSummary?.runRulesVersion ?? run.runRulesVersion;
    return {
        key: {
            rulesVersion,
            seed,
            variant,
            ...(variant === 'gauntlet' ? { durationMs: run.gauntletSessionDurationMs ?? 0 } : {}),
            ...(variant === 'meditation' ? { mutators: [...run.activeMutators] } : {})
        }
    };
};

export const encodeRunShareKey = (key: RunShareKey): string => {
    const tail =
        key.variant === 'gauntlet'
            ? `:${Math.max(0, Math.floor(key.durationMs ?? 0))}`
            : key.variant === 'meditation'
              ? `:${(key.mutators ?? []).join('+')}`
              : '';
    return `${RUN_SHARE_KEY_PREFIX}:${key.variant}:${key.rulesVersion}:${key.seed}${tail}`;
};

const VARIANTS: ReadonlySet<string> = new Set<RunShareVariant>([
    'classic',
    'gauntlet',
    'meditation',
    'pin_vow',
    'practice',
    'scholar',
    'showcase',
    'wild'
]);

/**
 * Reads a key out of whatever the player pasted. The copy button puts a whole sentence on the
 * clipboard, and people paste the sentence, so the key is found inside the text rather than
 * required to be the whole of it.
 */
export const parseRunShareKey = (input: string): RunShareKey | null => {
    const match = /md1:([a-z_]+):(\d+):(\d+)(?::([0-9a-z_+]*))?/iu.exec(input.trim());
    if (!match) {
        return null;
    }
    const [, rawVariant = '', rawRules = '', rawSeed = '', rawTail] = match;
    const variant = rawVariant.toLowerCase();
    if (!VARIANTS.has(variant)) {
        return null;
    }
    const rulesVersion = Number.parseInt(rawRules, 10);
    const seed = Number.parseInt(rawSeed, 10);
    if (!Number.isSafeInteger(rulesVersion) || !Number.isSafeInteger(seed)) {
        return null;
    }
    const base = { rulesVersion, seed, variant: variant as RunShareVariant };
    if (variant === 'gauntlet') {
        const durationMs = Number.parseInt(rawTail ?? '', 10);
        return Number.isSafeInteger(durationMs) && durationMs > 0 ? { ...base, durationMs } : null;
    }
    if (variant === 'meditation') {
        const mutators = (rawTail ?? '')
            .split('+')
            .filter((id) => id.length > 0)
            .filter((id): id is MutatorId => id in MUTATOR_CATALOG);
        return { ...base, mutators };
    }
    return base;
};
