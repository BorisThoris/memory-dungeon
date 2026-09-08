import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG } from './mechanics-encyclopedia';

/**
 * The recipe that reproduces a run on another machine.
 *
 * `buildRunShareKey` in `run-history.ts` predates this and records only `mode:rules:seed`. There is
 * one mode, so that is not enough to reproduce what the player played: chaos, practice, a scholar
 * contract, a pin vow and a clock are all setup-sheet choices on the same mode, and every one of
 * them would produce a key that replays as a plain Classic run on the same board. A key that hands
 * someone a different run under the same name is worse than no key, so this carries the variant a
 * player actually set up, plus whatever else that variant needs to come out the same — the clock
 * for a timed run, the chosen mutators for a calm one.
 *
 * The `md1` prefix is a version marker. When the shape has to change, old keys can still be read
 * or refused deliberately instead of silently parsing into something else.
 */

export const RUN_SHARE_KEY_PREFIX = 'md1';

export type RunShareVariant = 'classic' | 'wild' | 'practice' | 'scholar' | 'pin_vow' | 'showcase' | 'gauntlet' | 'meditation';

export interface RunShareKey {
    readonly variant: RunShareVariant;
    readonly rulesVersion: number;
    readonly seed: number;
    /** Timed runs only: the clock the run was played against. */
    readonly durationMs?: number;
    /** Calm runs only: the focus mutators the player chose. */
    readonly mutators?: readonly MutatorId[];
}

/**
 * Why a run cannot be handed over, in the words the player is shown.
 *
 * Nothing refuses today — the daily and the puzzle board were the only two runs a seed could not
 * reproduce, and both went with the mode collapse. The type stays because `describeRunShareKey`
 * returns a union the callers already branch on, and the next unshareable run should refuse here
 * rather than hand out a key that replays as something else.
 */
export type RunShareRefusal = 'This run cannot be reproduced from a seed.';

const variantOf = (run: RunState): RunShareVariant | RunShareRefusal => {
    if (run.gauntletDeadlineMs !== null) {
        return 'gauntlet';
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
            ...(variant === 'gauntlet' ? { durationMs: run.gauntletSessionDurationMs ?? 0 } : {})
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
