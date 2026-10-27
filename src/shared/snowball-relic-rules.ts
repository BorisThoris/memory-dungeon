import type { RelicId, RunState, TileSuit } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * **The stop, and relics that grow** (rules 100, 2026-10-28).
 *
 * The owner's word, asked which kind of change was missing: "a build that snowballs". Until rules 100 the
 * camp spent the run's gold by itself (`automatic-camp-rules.ts`, rules 61) on one shelf of four ranked
 * relics, so every run that reached the Deep owned the same four - 240 relics over 60 careful soak runs,
 * four each. From rules 100 the third-floor stop is the player's again (the owner chose it, 2026-10-28):
 * misses and tools, and three relics drawn from the run's seed out of a pool that grows. Eight of them are
 * new, and each one grows with something the run does, multiplying every match's score or paying out:
 *
 * - The four **Hearts** - one an element - add `HEART_STEP` to the score of every match for every match of
 *   their element this run. A run that leans into one element finds its Heart reading ×2, ×3.
 * - **Minted Halo**: `HALO_STEP` for every gold held, up to `HALO_CAP` - gold kept is score, gold spent is not.
 * - **Frenzy Dial**: `DIAL_STEP` for every pair grabbed in a Flurry this run (`flurry-rules.ts`).
 * - **Glass Crown**: `CROWN_STEP` for every floor in a row cleared without a try spent, back to nothing on
 *   one that was not - and the miss bank holds one fewer while it is worn.
 * - **Interest Coin**: at every stop, a gold for every `INTEREST_PER` held, up to `INTEREST_CAP`.
 *
 * The multipliers stack by multiplying: a Heart at ×2 beside a Halo at ×1.5 makes every match ×3.
 */
export const SNOWBALL_RELICS_FROM = 100;

export const HEART_STEP = 0.03;
export const HALO_STEP = 0.02;
export const HALO_CAP = 2;
export const DIAL_STEP = 0.05;
export const CROWN_STEP = 0.25;
export const INTEREST_PER = 5;
export const INTEREST_CAP = 5;

export type SnowballRelicId = Extract<RelicId, 'cinder_heart' | 'tide_heart' | 'moss_heart' | 'bone_heart' | 'minted_halo' | 'frenzy_dial' | 'glass_crown' | 'interest_coin'>;

export const HEART_SUIT: Readonly<Record<Extract<SnowballRelicId, `${string}_heart`>, TileSuit>> = {
    cinder_heart: 'ember',
    tide_heart: 'tide',
    moss_heart: 'moss',
    bone_heart: 'bone'
};

const pct = (step: number): string => `${Math.round(step * 100)}%`;

export interface SnowballRelicDefinition {
    id: SnowballRelicId;
    title: string;
    body: string;
    price: number;
}

export const SNOWBALL_RELICS: readonly SnowballRelicDefinition[] = [
    { id: 'cinder_heart', title: 'Cinder Heart', body: `Every Ember match this run adds ${pct(HEART_STEP)} to the score of every match.`, price: 9 },
    { id: 'tide_heart', title: 'Tide Heart', body: `Every Tide match this run adds ${pct(HEART_STEP)} to the score of every match.`, price: 9 },
    { id: 'moss_heart', title: 'Moss Heart', body: `Every Moss match this run adds ${pct(HEART_STEP)} to the score of every match.`, price: 9 },
    { id: 'bone_heart', title: 'Bone Heart', body: `Every Bone match this run adds ${pct(HEART_STEP)} to the score of every match.`, price: 9 },
    { id: 'minted_halo', title: 'Minted Halo', body: `Every gold you hold adds ${pct(HALO_STEP)} to every match's score, up to ×${1 + HALO_CAP}.`, price: 7 },
    { id: 'frenzy_dial', title: 'Frenzy Dial', body: `Every pair grabbed in a Flurry this run adds ${pct(DIAL_STEP)} to the score of every match.`, price: 8 },
    { id: 'glass_crown', title: 'Glass Crown', body: `Every floor in a row cleared without a miss adds ${pct(CROWN_STEP)} to every match's score. The miss bank holds one fewer.`, price: 10 },
    { id: 'interest_coin', title: 'Interest Coin', body: `At every stop, 1 gold for every ${INTEREST_PER} you hold, up to ${INTEREST_CAP}.`, price: 6 }
];

export const SNOWBALL_RELIC_IDS: readonly SnowballRelicId[] = SNOWBALL_RELICS.map((relic) => relic.id);

export const isSnowballRelicId = (id: string): id is SnowballRelicId => (SNOWBALL_RELIC_IDS as readonly string[]).includes(id);

type SnowballRun = Pick<RunState, 'relics'> & Partial<Pick<RunState, 'runRulesVersion' | 'gold' | 'elementMatchesThisRun' | 'flurryGrabsThisRun' | 'cleanFloorStreak'>>;

const holds = (run: SnowballRun, id: SnowballRelicId): boolean => (run.relics ?? []).includes(id);
const onSnowball = (run: Partial<Pick<RunState, 'runRulesVersion'>>): boolean => (run.runRulesVersion ?? 0) >= SNOWBALL_RELICS_FROM;

export interface RelicScoreFactor {
    id: SnowballRelicId;
    factor: number;
}

/** What each held relic multiplies a match's score by, now: only the ones above ×1. */
export const relicScoreFactors = (run: SnowballRun): RelicScoreFactor[] => {
    if (!onSnowball(run)) return [];
    const factors: RelicScoreFactor[] = [];
    for (const [id, suit] of Object.entries(HEART_SUIT) as [SnowballRelicId, TileSuit][]) {
        if (holds(run, id)) factors.push({ id, factor: 1 + HEART_STEP * runNonNegativeInteger(run.elementMatchesThisRun?.[suit]) });
    }
    if (holds(run, 'minted_halo')) factors.push({ id: 'minted_halo', factor: 1 + Math.min(HALO_CAP, HALO_STEP * runNonNegativeInteger(run.gold)) });
    if (holds(run, 'frenzy_dial')) factors.push({ id: 'frenzy_dial', factor: 1 + DIAL_STEP * runNonNegativeInteger(run.flurryGrabsThisRun) });
    if (holds(run, 'glass_crown')) factors.push({ id: 'glass_crown', factor: 1 + CROWN_STEP * runNonNegativeInteger(run.cleanFloorStreak) });
    return factors.filter((entry) => entry.factor > 1);
};

/** Every held relic's factor, multiplied: what a match's score is multiplied by. */
export const relicScoreMultiplier = (run: SnowballRun): number => relicScoreFactors(run).reduce((product, entry) => product * entry.factor, 1);

/** A match counted toward the Hearts: every run from rules 100 counts, held or not, so a Heart bought late is already warm. */
export const countElementMatch = <R extends SnowballRun>(run: R, suit: TileSuit | null | undefined): R =>
    !onSnowball(run) || suit == null
        ? run
        : { ...run, elementMatchesThisRun: { ...run.elementMatchesThisRun, [suit]: runNonNegativeInteger(run.elementMatchesThisRun?.[suit]) + 1 } };

/** The Glass Crown's count after a floor clear: one more for a clean floor, nothing after one that was not. */
export const nextCleanFloorStreak = (run: SnowballRun, clean: boolean): number =>
    clean ? runNonNegativeInteger(run.cleanFloorStreak) + 1 : 0;

/** What the Interest Coin pays at a stop, on the gold the run holds as it opens. */
export const interestFor = (run: SnowballRun): number =>
    onSnowball(run) && holds(run, 'interest_coin') ? Math.min(INTEREST_CAP, Math.floor(runNonNegativeInteger(run.gold) / INTEREST_PER)) : 0;

/** The Glass Crown's price, taken from the miss bank's cap. */
export const snowballBankCapDelta = (run: SnowballRun): number => (onSnowball(run) && holds(run, 'glass_crown') ? -1 : 0);
