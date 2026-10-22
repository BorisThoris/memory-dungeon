import type { RunState } from './contracts';

/**
 * The recipe that reproduces a run on another machine.
 *
 * `buildRunShareKey` in `run-history.ts` predates this and records only `mode:rules:seed`. There is
 * one mode, so that is not enough to reproduce what the player played: chaos, practice, a scholar
 * contract and a pin vow are all setup-sheet choices on the same mode, and every one of them would
 * produce a key that replays as a plain Classic run on the same board. A key that hands someone a
 * different run under the same name is worse than no key, so this carries the variant a player
 * actually set up.
 *
 * The `md1` prefix is a version marker. When the shape has to change, old keys can still be read
 * or refused deliberately instead of silently parsing into something else. Three variants have
 * been refused that way: `showcase` went with the dungeon layer, `meditation` with the mode
 * collapse, and `gauntlet` with the clock, which the thesis rules out. A key naming one of them
 * parses as nothing rather than as a Classic run on the same seed, because it never was one.
 */

export const RUN_SHARE_KEY_PREFIX = 'md1';

export type RunShareVariant = 'classic' | 'wild' | 'practice' | 'scholar' | 'pin_vow';

export interface RunShareKey {
    readonly campPreference?: RunState['campPreference'];
    /** The Depths (`depth-rules.ts`): only above 0, so older keys read as they always did. */
    readonly depth?: number;
    readonly variant: RunShareVariant;
    readonly rulesVersion: number;
    readonly seed: number;
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
    // Same precedence as `createRestartRun`, so a key and a retry never disagree.
    // A seed replays at the normal pace: a test-pace run (`descent-pace-rules.ts`) cannot be shared.
    if (run.descentPace === 'fast') {
        return 'This run cannot be reproduced from a seed.';
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        return 'pin_vow';
    }
    if (run.wildMenuRun) {
        return 'wild';
    }
    if (run.practiceMode) {
        return 'practice';
    }
    if (run.activeContract?.noShuffle === true) {
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
            ...(rulesVersion >= 64 && run.campPreference ? { campPreference: run.campPreference } : {}),
            ...(run.depth ? { depth: run.depth } : {})
        }
    };
};

export const encodeRunShareKey = (key: RunShareKey): string =>
    `${RUN_SHARE_KEY_PREFIX}:${key.variant}:${key.rulesVersion}:${key.seed}${key.rulesVersion >= 64 && key.campPreference ? `:${key.campPreference}` : ''}${key.depth ? `:d${key.depth}` : ''}`;

const VARIANTS: ReadonlySet<string> = new Set<RunShareVariant>(['classic', 'pin_vow', 'practice', 'scholar', 'wild']);

/**
 * Reads a key out of whatever the player pasted. The copy button puts a whole sentence on the
 * clipboard, and people paste the sentence, so the key is found inside the text rather than
 * required to be the whole of it.
 */
export const parseRunShareKey = (input: string): RunShareKey | null => {
    // The camp segment is one of its words, so a Depth segment (`:d5`) is never read as a camp.
    const match = /md1:([a-z_]+):(\d+):(\d+)(?::(survive|study|score|evolve))?(?::d(\d+))?/iu.exec(input.trim());
    if (!match) {
        return null;
    }
    const [, rawVariant = '', rawRules = '', rawSeed = ''] = match;
    const variant = rawVariant.toLowerCase();
    if (!VARIANTS.has(variant)) {
        return null;
    }
    const rulesVersion = Number.parseInt(rawRules, 10);
    const seed = Number.parseInt(rawSeed, 10);
    if (!Number.isSafeInteger(rulesVersion) || !Number.isSafeInteger(seed)) {
        return null;
    }
    if (match[4] && !['survive', 'study', 'score', 'evolve'].includes(match[4].toLowerCase())) return null;
    const depth = match[5] ? Number.parseInt(match[5], 10) : 0;
    return { rulesVersion, seed, variant: variant as RunShareVariant,
        ...(rulesVersion >= 64 && match[4] ? { campPreference: match[4].toLowerCase() as RunState['campPreference'] } : {}),
        ...(Number.isSafeInteger(depth) && depth > 0 ? { depth } : {}) };
};
