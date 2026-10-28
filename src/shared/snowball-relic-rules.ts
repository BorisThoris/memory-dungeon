import type { FusionId, RelicId, RunState, TileSuit } from './contracts';
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

type SnowballRun = Pick<RunState, 'relics'> & Partial<Pick<RunState, 'runRulesVersion' | 'gold' | 'elementMatchesThisRun' | 'flurryGrabsThisRun' | 'cleanFloorStreak' | 'fusions' | 'awakened'>>;

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
    // Twin Hearts (rules 102): every held Heart counts the matches of every held Heart's element.
    const twinned = hasFusion(run, 'twin_hearts') ? heldHeartSuits(run).reduce((sum, suit) => sum + runNonNegativeInteger(run.elementMatchesThisRun?.[suit]), 0) : null;
    for (const [id, suit] of Object.entries(HEART_SUIT) as [SnowballRelicId, TileSuit][]) {
        if (holds(run, id)) factors.push({ id, factor: 1 + HEART_STEP * awakeTimes(run, id) * (twinned ?? runNonNegativeInteger(run.elementMatchesThisRun?.[suit])) });
    }
    if (holds(run, 'minted_halo')) factors.push({ id: 'minted_halo', factor: 1 + Math.min(isAwake(run, 'minted_halo') ? AWAKENED_HALO_CAP : HALO_CAP, HALO_STEP * runNonNegativeInteger(run.gold)) });
    if (holds(run, 'frenzy_dial')) factors.push({ id: 'frenzy_dial', factor: 1 + DIAL_STEP * awakeTimes(run, 'frenzy_dial') * runNonNegativeInteger(run.flurryGrabsThisRun) });
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
    clean ? runNonNegativeInteger(run.cleanFloorStreak) + 1 : isAwake(run, 'glass_crown') ? Math.floor(runNonNegativeInteger(run.cleanFloorStreak) / 2) : 0;

/** What the Interest Coin pays at a stop, on the gold the run holds as it opens. */
export const interestFor = (run: SnowballRun): number => {
    if (!onSnowball(run) || !holds(run, 'interest_coin')) return 0;
    const compound = hasFusion(run, 'compound_coin');
    return Math.min((compound ? COMPOUND_INTEREST_CAP : INTEREST_CAP) + (isAwake(run, 'interest_coin') ? AWAKENED_INTEREST_BONUS : 0), Math.floor(runNonNegativeInteger(run.gold) / (compound ? COMPOUND_INTEREST_PER : INTEREST_PER)));
};

/**
 * **The build pays** (rules 101, 2026-10-28). Through rules 100 the multiplier fell on score alone, and in the
 * Descent score buys nothing: gold comes from the clear (`floorClearGold`), so a Heart at ×3 changed the
 * number on the HUD and not one thing the run could do. From rules 101 a floor clear's gold is multiplied by
 * the build too, rounded down: the build buys the next stop's misses and relics, and the next stop grows the
 * build. Read on the base clear, before a realm's weather and the Miser's Purse multiply it again.
 */
export const BUILD_PAYS_FROM = 101;

/** A clear's gold through the build: the base times every held relic's factor, from rules 101. */
export const buildPaidGold = (run: SnowballRun, gold: number): number =>
    (run.runRulesVersion ?? 0) >= BUILD_PAYS_FROM ? Math.floor(runNonNegativeInteger(gold) * relicScoreMultiplier(run)) : gold;

/** The Glass Crown's price, taken from the miss bank's cap. */
export const snowballBankCapDelta = (run: SnowballRun): number =>
    onSnowball(run) && holds(run, 'glass_crown') && !hasFusion(run, 'storm_crown') ? -1 : 0;

/**
 * **Fusions** (rules 102, 2026-10-28): two relics that grow, held together, are offered as one power at the
 * stop for `FUSION_PRICE` gold. The owner, shown the relics that grow and the build that pays: keep
 * building on it. A fusion takes no slot and keeps both relics; each is bought once a run.
 *
 * - **Twin Hearts** (two Hearts): every held Heart counts the matches of every held Heart's element.
 * - **Gilded Heart** (a Heart and the Minted Halo): every match of a held Heart's element pays `GILDED_HEART_GOLD` gold.
 * - **Storm Crown** (the Glass Crown and the Frenzy Dial): a floor of one miss keeps the Crown's streak, and the bank has its slot back.
 * - **Compound Coin** (the Interest Coin and the Minted Halo): a gold for every `COMPOUND_INTEREST_PER` held, up to `COMPOUND_INTEREST_CAP`.
 */
export const FUSIONS_FROM = 102;
export const FUSION_PRICE = 20;
export const GILDED_HEART_GOLD = 1;
export const COMPOUND_INTEREST_PER = 4;
export const COMPOUND_INTEREST_CAP = 15;

const HEART_IDS = Object.keys(HEART_SUIT) as Extract<SnowballRelicId, `${string}_heart`>[];
const heldHeartSuits = (run: SnowballRun): TileSuit[] => HEART_IDS.filter((id) => holds(run, id)).map((id) => HEART_SUIT[id]);

export interface FusionDefinition {
    id: FusionId;
    title: string;
    body: string;
    /** What it is made of, in words for the stop. */
    from: string;
    ready: (run: SnowballRun) => boolean;
}

export const FUSIONS: readonly FusionDefinition[] = [
    { id: 'twin_hearts', title: 'Twin Hearts', from: 'Two Hearts', body: 'Every Heart you hold counts the matches of every Heart’s element.', ready: (run) => heldHeartSuits(run).length >= 2 },
    { id: 'gilded_heart', title: 'Gilded Heart', from: 'A Heart and the Minted Halo', body: `Every match of a held Heart’s element pays ${GILDED_HEART_GOLD} gold.`, ready: (run) => heldHeartSuits(run).length >= 1 && holds(run, 'minted_halo') },
    { id: 'storm_crown', title: 'Storm Crown', from: 'The Glass Crown and the Frenzy Dial', body: 'A floor of one miss keeps the Crown’s streak, and the miss bank has its slot back.', ready: (run) => holds(run, 'glass_crown') && holds(run, 'frenzy_dial') },
    { id: 'compound_coin', title: 'Compound Coin', from: 'The Interest Coin and the Minted Halo', body: `At every stop, 1 gold for every ${COMPOUND_INTEREST_PER} you hold, up to ${COMPOUND_INTEREST_CAP}.`, ready: (run) => holds(run, 'interest_coin') && holds(run, 'minted_halo') }
];

export const fusionDefinition = (id: FusionId): FusionDefinition => FUSIONS.find((fusion) => fusion.id === id)!;

export const hasFusion = (run: Partial<Pick<RunState, 'fusions' | 'runRulesVersion'>>, id: FusionId): boolean =>
    (run.runRulesVersion ?? 0) >= FUSIONS_FROM && (run.fusions ?? []).includes(id);

/** The fusions the stop offers: both parts held, not yet fused. */
export const availableFusions = (run: SnowballRun): FusionDefinition[] =>
    (run.runRulesVersion ?? 0) < FUSIONS_FROM ? [] : FUSIONS.filter((fusion) => !(run.fusions ?? []).includes(fusion.id) && fusion.ready(run));

/** The run with a fusion bought, or null when it is not on offer or not affordable. */
export const applyFusion = <R extends SnowballRun>(run: R, id: FusionId): R | null => {
    const gold = runNonNegativeInteger(run.gold);
    if (!availableFusions(run).some((fusion) => fusion.id === id) || gold < FUSION_PRICE) return null;
    return { ...run, gold: gold - FUSION_PRICE, fusions: [...(run.fusions ?? []), id] };
};

/** What the Gilded Heart pays for a match of `suit`. */
export const heartGoldFor = (run: SnowballRun, suit: TileSuit | null | undefined): number =>
    suit != null && hasFusion(run, 'gilded_heart') && heldHeartSuits(run).includes(suit) ? GILDED_HEART_GOLD : 0;

/** Whether a floor cleared with `tries` spent keeps the Glass Crown's streak: none, or one with the Storm Crown. */
export const floorKeepsCrown = (run: SnowballRun, tries: number): boolean => tries === 0 || (tries <= 1 && hasFusion(run, 'storm_crown'));

/**
 * **Relics that grow awaken** (rules 103, 2026-10-28). The owner, shown fusions: keep building on it - "let
 * the new relics evolve". (Evolve already names the camp relics' blueprint recipes, `relic-evolution-rules.ts`,
 * so these awaken.) A relic that grows, held, awakens on the floor clear where its own count reaches its mark,
 * takes a new name and keeps a stronger rule to the end of the run. The clear says so; the stop and the
 * inventory name it. Each mark is the relic's own count, read after the clear has paid: a Heart its own
 * element's matches (not the twinned sum), the Halo and the Coin the gold held as the clear ends.
 */
export const AWAKENING_FROM = 103;
export const HEART_AWAKENS_AT = 24;
export const HALO_AWAKENS_AT = 30;
export const DIAL_AWAKENS_AT = 12;
export const CROWN_AWAKENS_AT = 3;
export const COIN_AWAKENS_AT = 25;
export const AWAKENED_HALO_CAP = 4;
export const AWAKENED_INTEREST_BONUS = 5;

export interface AwakeningDefinition {
    id: SnowballRelicId;
    title: string;
    /** What the relic awakens at, said before it does. */
    mark: string;
    body: string;
    reached: (run: SnowballRun) => boolean;
}

const heartAwakening = (id: Extract<SnowballRelicId, `${string}_heart`>, title: string, element: string): AwakeningDefinition => ({
    id,
    title,
    mark: `Awakens at ${HEART_AWAKENS_AT} ${element} matches.`,
    body: `Every ${element} match adds ${pct(HEART_STEP * 2)} to the score of every match.`,
    reached: (run) => runNonNegativeInteger(run.elementMatchesThisRun?.[HEART_SUIT[id]]) >= HEART_AWAKENS_AT
});

export const AWAKENINGS: readonly AwakeningDefinition[] = [
    heartAwakening('cinder_heart', 'Inferno Heart', 'Ember'),
    heartAwakening('tide_heart', 'Deluge Heart', 'Tide'),
    heartAwakening('moss_heart', 'Wildwood Heart', 'Moss'),
    heartAwakening('bone_heart', 'Ossuary Heart', 'Bone'),
    { id: 'minted_halo', title: 'Sovereign Halo', mark: `Awakens holding ${HALO_AWAKENS_AT} gold.`, body: `Every gold you hold adds ${pct(HALO_STEP)} to every match's score, up to ×${1 + AWAKENED_HALO_CAP}.`, reached: (run) => runNonNegativeInteger(run.gold) >= HALO_AWAKENS_AT },
    { id: 'frenzy_dial', title: 'Riot Dial', mark: `Awakens at ${DIAL_AWAKENS_AT} Flurry grabs.`, body: `Every pair grabbed in a Flurry adds ${pct(DIAL_STEP * 2)} to the score of every match.`, reached: (run) => runNonNegativeInteger(run.flurryGrabsThisRun) >= DIAL_AWAKENS_AT },
    { id: 'glass_crown', title: 'Diamond Crown', mark: `Awakens at ${CROWN_AWAKENS_AT} clean floors in a row.`, body: `A floor with a miss halves the streak instead of breaking it.`, reached: (run) => runNonNegativeInteger(run.cleanFloorStreak) >= CROWN_AWAKENS_AT },
    { id: 'interest_coin', title: 'Treasury Coin', mark: `Awakens holding ${COIN_AWAKENS_AT} gold.`, body: `Interest pays up to ${AWAKENED_INTEREST_BONUS} gold more at every stop.`, reached: (run) => runNonNegativeInteger(run.gold) >= COIN_AWAKENS_AT }
];

export const awakeningDefinition = (id: SnowballRelicId): AwakeningDefinition => AWAKENINGS.find((entry) => entry.id === id)!;

/** True once the held relic has awakened. */
export const isAwake = (run: Partial<Pick<RunState, 'awakened' | 'runRulesVersion'>>, id: SnowballRelicId): boolean =>
    (run.runRulesVersion ?? 0) >= AWAKENING_FROM && (run.awakened ?? []).includes(id);

/** A doubled step once awake. */
const awakeTimes = (run: SnowballRun, id: SnowballRelicId): number => (isAwake(run, id) ? 2 : 1);

/** The relic's name as the run holds it: its awakened name once it has awakened. */
export const snowballRelicTitle = (run: SnowballRun, id: SnowballRelicId, title: string): string =>
    isAwake(run, id) ? awakeningDefinition(id).title : title;

/**
 * Awaken every held relic whose mark the run has reached, on the run as the clear leaves it; the clear's
 * result names the ones that awoke on it.
 */
export const awakenGrownRelics = <R extends SnowballRun & { lastLevelResult?: RunState['lastLevelResult'] }>(run: R): R => {
    if ((run.runRulesVersion ?? 0) < AWAKENING_FROM) return run;
    const woke = AWAKENINGS.filter((entry) => holds(run, entry.id) && !isAwake(run, entry.id) && entry.reached(run)).map((entry) => entry.id);
    if (woke.length === 0) return run;
    return {
        ...run,
        awakened: [...(run.awakened ?? []), ...woke],
        ...(run.lastLevelResult ? { lastLevelResult: { ...run.lastLevelResult, awakened: woke } } : {})
    };
};
