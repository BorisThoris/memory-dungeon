/**
 * Combo heat: how wild the run looks as the combo stacks up.
 *
 * The chain meter tops out at Fever, which is a floor's own rung, and a combo that carries across
 * floors (`chain-carryover-rules.ts`) climbs well past it. Past Fever the meter is full and had
 * nothing more to say, so a combo of thirty looked like a combo of ten. This is the ladder above
 * the ladder: a continuous heat from the raw combo and six named stages on it, read by every
 * surface that answers the run - the HUD's combo number and rail, the card backs, the room's fire
 * and ring, the board's particles and lightning, and the vignette around the whole screen - so
 * the whole game gets steadily wilder the longer a player goes without missing, the way an
 * arcade pool table does when the shots keep dropping.
 *
 * The stages are the combo alone, not the floor: a floor's rungs decide what a break takes, this
 * decides only how the run looks and sounds. Nothing here is read by a rule.
 */
import { runNonNegativeInteger } from './run-number-guards';
import { createMulberry32, hashStringToSeed } from './rng';

export type ComboHeatStage = 'cold' | 'warm' | 'hot' | 'blazing' | 'inferno' | 'legendary';

/** The combo each stage opens at, ascending. */
export const COMBO_HEAT_STAGE_FROM: Readonly<Record<Exclude<ComboHeatStage, 'cold'>, number>> = {
    warm: 3,
    hot: 6,
    blazing: 10,
    inferno: 16,
    legendary: 25
};

const STAGES: readonly ComboHeatStage[] = ['cold', 'warm', 'hot', 'blazing', 'inferno', 'legendary'];

export const comboHeatStage = (combo: number): ComboHeatStage => {
    const links = runNonNegativeInteger(combo);
    if (links >= COMBO_HEAT_STAGE_FROM.legendary) return 'legendary';
    if (links >= COMBO_HEAT_STAGE_FROM.inferno) return 'inferno';
    if (links >= COMBO_HEAT_STAGE_FROM.blazing) return 'blazing';
    if (links >= COMBO_HEAT_STAGE_FROM.hot) return 'hot';
    if (links >= COMBO_HEAT_STAGE_FROM.warm) return 'warm';
    return 'cold';
};

/** 0 at cold through 5 at legendary, for surfaces that want a number rather than a name. */
export const comboHeatStageIndex = (stage: ComboHeatStage): number => Math.max(0, STAGES.indexOf(stage));

/**
 * The ladder has no top. Legendary opens at 25 and every 25 links after it is another
 * **ascension** - Legendary II, III, IV and on, without end - so a combo of 200 is not the same
 * screen as a combo of 25. 0 below Legendary, 1 at it, 2 from 50, and so on.
 */
export const COMBO_ASCENSION_SPAN = 25;
export const comboAscension = (combo: number): number => {
    const links = runNonNegativeInteger(combo);
    return links < COMBO_HEAT_STAGE_FROM.legendary ? 0 : Math.floor((links - COMBO_HEAT_STAGE_FROM.legendary) / COMBO_ASCENSION_SPAN) + 1;
};

/** The ascension a turn reached past the first, or null: the second Legendary stamp and every one after. */
export const comboAscensionReached = (comboBefore: number, comboAfter: number): number | null => {
    const before = comboAscension(comboBefore);
    const after = comboAscension(comboAfter);
    return after > before && after >= 2 ? after : null;
};

/**
 * How much past the top of the meter the run has climbed, unbounded but slow: 0 below
 * Legendary, 1 at the second ascension, 2 at the fourth, 3 at the eighth. Everything that must
 * keep growing forever grows on this - one more strand of lightning, one more ring of aura, a
 * bigger number - while the things with a ceiling (a particle budget) clamp it themselves.
 */
export const comboSurge = (combo: number): number => {
    const ascension = comboAscension(combo);
    return ascension <= 1 ? 0 : Math.log2(ascension);
};

const ROMAN: readonly [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export const romanNumeral = (value: number): string => {
    let n = Math.max(0, Math.floor(value));
    let out = '';
    for (const [weight, glyph] of ROMAN) while (n >= weight) { out += glyph; n -= weight; }
    return out;
};

/** The stage's label with its ascension: "Legendary", then "Legendary II", "Legendary III"... */
export const comboStageLabel = (labels: Readonly<Record<ComboHeatStage, string>>, combo: number): string => {
    const stage = comboHeatStage(combo);
    const ascension = comboAscension(combo);
    return ascension >= 2 ? `${labels[stage]} ${romanNumeral(ascension)}` : labels[stage];
};

/** The stamp for an ascension past the first: the temper's Legendary word with the numeral. */
export const comboAscensionCallout = (legendaryCallout: string, ascension: number): string =>
    `${legendaryCallout.replace(/!$/, '')} ${romanNumeral(ascension)}!`;

/**
 * The heat as one number, 0..1, saturating: the first links are where the growth is felt, and a
 * combo carried across five floors still has somewhere to climb. 3 ≈ 0.22, 10 ≈ 0.57, 16 ≈ 0.74,
 * 25 ≈ 0.88, 40 ≈ 0.96.
 */
export const comboHeat = (combo: number): number => 1 - Math.exp(-runNonNegativeInteger(combo) / 12);

/**
 * The stage a turn climbed to, or null: the rank-up moment the arcade tables stamp across the
 * screen ("ON FIRE!"). Read from the combo before and after one resolved turn, so it is an event
 * a turn produced and never something a mount or a restore replays. Warm is not called out: the
 * first stage is the HUD warming, and a stamp for three in a row would be a stamp for nothing.
 */
export const comboStageReached = (comboBefore: number, comboAfter: number): Exclude<ComboHeatStage, 'cold' | 'warm'> | null => {
    const before = comboHeatStageIndex(comboHeatStage(comboBefore));
    const after = comboHeatStage(comboAfter);
    const afterIndex = comboHeatStageIndex(after);
    if (afterIndex <= before || afterIndex < 2) return null;
    return after as Exclude<ComboHeatStage, 'cold' | 'warm'>;
};

/**
 * The temper of a run: which element the combo ladder burns in, rolled from the run seed.
 *
 * The pool tables sell the streak's instrument in elements - a fire cue, a permafrost cue, a
 * lightning cue - and Balatro's editions and Pokémon's shinies show what a rare palette does to a
 * run: it changes nothing a rule reads and everything a player remembers. So a run's heat has a
 * temper. Most runs are ember (the default fire). Some are frost, and the combo goes cold rather
 * than hot - chill, frozen, glacial, absolute zero - with snow drifting down off the cards instead
 * of embers rising. Some are storm. One in fifty is prismatic, the shiny: every colour at once,
 * and its stamps say so. Seeded, so a shared run has the same temper for everyone who plays it.
 */
export type ComboHeatThemeId = 'ember' | 'frost' | 'storm' | 'prismatic' | 'tide' | 'grove';

export interface ComboHeatTheme {
    id: ComboHeatThemeId;
    /** What the run is called when the temper shows itself. */
    title: string;
    /** The shiny: stamps carry a RARE tag and the palette cycles. */
    rare: boolean;
    /** Roll weight; the four sum to 100. */
    weight: number;
    labels: Readonly<Record<ComboHeatStage, string>>;
    callouts: Readonly<Record<Exclude<ComboHeatStage, 'cold' | 'warm'>, string>>;
    /** One colour per stage index, cold through legendary. */
    colors: readonly [string, string, string, string, string, string];
    /** How the cards' particles move at heat: embers rise, snow falls, sparks fly. */
    emberMode: 'rise' | 'fall' | 'spark';
    /** Lightning tints at four intensity bands, dim to bright. */
    arcTints: readonly [string, string, string, string];
    /** Extra hue the room's ring turns toward at full heat, in degrees. */
    ringHueDeg: number;
}

export const COMBO_HEAT_THEMES: readonly ComboHeatTheme[] = [
    {
        id: 'ember',
        title: 'Ember',
        rare: false,
        weight: 70,
        labels: { cold: '', warm: 'Warm', hot: 'Hot', blazing: 'Blazing', inferno: 'Inferno', legendary: 'Legendary' },
        callouts: { hot: 'HOT!', blazing: 'BLAZING!', inferno: 'INFERNO!', legendary: 'LEGENDARY!' },
        colors: ['#e1ad66', '#e1ad66', '#ffa24f', '#ff7a3d', '#ff4d5e', '#e2b3ff'],
        emberMode: 'rise',
        arcTints: ['#8fdcff', '#ffd27a', '#ffb070', '#ff9ad8'],
        ringHueDeg: 0
    },
    {
        id: 'frost',
        title: 'Frost',
        rare: false,
        weight: 18,
        labels: { cold: '', warm: 'Chill', hot: 'Cold', blazing: 'Frozen', inferno: 'Glacial', legendary: 'Absolute Zero' },
        callouts: { hot: 'COLD!', blazing: 'FROZEN!', inferno: 'GLACIAL!', legendary: 'ABSOLUTE ZERO!' },
        colors: ['#bfe3f7', '#bfe3f7', '#8fdcff', '#5fc3ff', '#b9a6ff', '#ffffff'],
        emberMode: 'fall',
        arcTints: ['#cfefff', '#8fdcff', '#5fc3ff', '#ffffff'],
        ringHueDeg: 140
    },
    {
        id: 'storm',
        title: 'Storm',
        rare: false,
        weight: 10,
        labels: { cold: '', warm: 'Charged', hot: 'Sparking', blazing: 'Storm', inferno: 'Tempest', legendary: 'Godlike' },
        callouts: { hot: 'SPARKING!', blazing: 'STORM!', inferno: 'TEMPEST!', legendary: 'GODLIKE!' },
        colors: ['#c9c2ff', '#c9c2ff', '#a78bff', '#8a5cff', '#d94dff', '#f6f0ff'],
        emberMode: 'spark',
        arcTints: ['#d9d0ff', '#a78bff', '#d94dff', '#ffffff'],
        ringHueDeg: -60
    },
    {
        id: 'prismatic',
        title: 'Prismatic',
        rare: true,
        weight: 2,
        labels: { cold: '', warm: 'Shimmer', hot: 'Gleam', blazing: 'Radiant', inferno: 'Prismatic', legendary: 'Mythic' },
        callouts: { hot: 'GLEAM!', blazing: 'RADIANT!', inferno: 'PRISMATIC!', legendary: 'MYTHIC!' },
        colors: ['#ffd27a', '#ffd27a', '#7dffc4', '#7ec8ff', '#ff8ae2', '#ffffff'],
        emberMode: 'rise',
        arcTints: ['#7dffc4', '#7ec8ff', '#ff8ae2', '#ffffff'],
        ringHueDeg: 200
    }
];

/**
 * The two realms that have no temper of their own (`realm-rules.ts`) get one here. They are never
 * rolled from a seed - their weight is nought and they are not in `COMBO_HEAT_THEMES` - they are
 * what the heat burns in while a floor is in the Drowned Vault or the Overgrown Crypt.
 */
export const REALM_HEAT_THEMES: readonly ComboHeatTheme[] = [
    {
        id: 'tide',
        title: 'Tide',
        rare: false,
        weight: 0,
        labels: { cold: '', warm: 'Ripple', hot: 'Swell', blazing: 'Surge', inferno: 'Torrent', legendary: 'Tsunami' },
        callouts: { hot: 'SWELL!', blazing: 'SURGE!', inferno: 'TORRENT!', legendary: 'TSUNAMI!' },
        colors: ['#9fe8dc', '#9fe8dc', '#4fd6c8', '#2fb6d8', '#3a8cff', '#e8fffb'],
        emberMode: 'fall',
        arcTints: ['#bff5ec', '#4fd6c8', '#2fb6d8', '#ffffff'],
        ringHueDeg: 150
    },
    {
        id: 'grove',
        title: 'Grove',
        rare: false,
        weight: 0,
        labels: { cold: '', warm: 'Sprout', hot: 'Bloom', blazing: 'Overgrown', inferno: 'Primeval', legendary: 'Worldtree' },
        callouts: { hot: 'BLOOM!', blazing: 'OVERGROWN!', inferno: 'PRIMEVAL!', legendary: 'WORLDTREE!' },
        colors: ['#c8e6a0', '#c8e6a0', '#8fd66a', '#5fbf4a', '#d6e04a', '#f4ffe0'],
        emberMode: 'rise',
        arcTints: ['#d8f0b8', '#8fd66a', '#d6e04a', '#ffffff'],
        ringHueDeg: 60
    }
];

/** Every temper by id, the realm ones included. */
export const heatThemeById = (id: ComboHeatThemeId | undefined | null): ComboHeatTheme =>
    [...COMBO_HEAT_THEMES, ...REALM_HEAT_THEMES].find((theme) => theme.id === id) ?? COMBO_HEAT_THEMES[0]!;

/**
 * The temper a run's heat burns in right now. A floor in a realm burns in the realm's element, so
 * the snow, the embers, the storm and the stamps are the environment's (2026-09-30); a run with no
 * realm keeps the temper its seed rolled.
 */
export const comboHeatThemeForRun = (run: { runSeed: number; realmId?: string | null }): ComboHeatTheme => {
    switch (run.realmId) {
        case 'frost':
        case 'ember':
        case 'storm':
        case 'tide':
        case 'grove':
            return heatThemeById(run.realmId);
        default:
            return comboHeatThemeForSeed(run.runSeed);
    }
};

/** The run's temper, rolled once from its seed: the same seed is the same temper for everyone. */
export const comboHeatThemeForSeed = (runSeed: number): ComboHeatTheme => {
    const seed = Number.isFinite(runSeed) ? Math.floor(runSeed) : 0;
    const rng = createMulberry32(hashStringToSeed(`combo-heat-theme:${seed}`));
    const roll = rng() * 100;
    let at = 0;
    for (const theme of COMBO_HEAT_THEMES) {
        at += theme.weight;
        if (roll < at) return theme;
    }
    return COMBO_HEAT_THEMES[0]!;
};

/**
 * The rare stamps a combo earns on its own, whatever the temper: the half-century, the century,
 * and every hundred after. Nobody sees these often, which is the point of stamping them.
 */
export const comboMilestoneReached = (comboBefore: number, comboAfter: number): number | null => {
    const before = runNonNegativeInteger(comboBefore);
    const after = runNonNegativeInteger(comboAfter);
    if (after <= before) return null;
    const hundredsBefore = Math.floor(before / 100);
    const hundredsAfter = Math.floor(after / 100);
    return hundredsAfter > hundredsBefore ? hundredsAfter * 100 : null;
};

export const COMBO_MILESTONE_CALLOUT = (milestone: number): string =>
    milestone === 100 ? 'CENTURY!' : `${milestone} COMBO!`;


export interface ComboHeatLevels {
    stage: ComboHeatStage;
    stageIndex: number;
    heat: number;
    /** Legendary and every 25 links after it: 0 below, 1 at 25, 2 at 50... without end. */
    ascension: number;
    /** log2 of the ascension past the first: the unbounded, slow growth the endless effects read. */
    surge: number;
    /** Extra rate on the room's flames and the card medallions past what the meter gives, 1 at cold. */
    burn: number;
    /** Strength of the aura around the combo number and the screen's edges, 0 at cold. */
    aura: number;
    /** Hue rotation in degrees for the warm palette: gold at warm, orange, red, then violet-white. */
    hueDeg: number;
    /** How many of the board's cards throw embers a tick, 0 below hot. */
    embers: number;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const comboHeatLevels = (combo: number): ComboHeatLevels => {
    const stage = comboHeatStage(combo);
    const stageIndex = comboHeatStageIndex(stage);
    const heat = comboHeat(combo);
    const ascension = comboAscension(combo);
    const surge = comboSurge(combo);
    return {
        stage,
        stageIndex,
        heat: round(heat),
        ascension,
        surge: round(surge),
        burn: round(1 + heat * 1.1),
        aura: round(stageIndex === 0 ? 0 : 0.18 + heat * 0.82),
        hueDeg: Math.round(-12 * stageIndex * (stageIndex >= 4 ? 2.2 : 1)) + 0,
        embers: stageIndex < 2 ? 0 : Math.min(12, stageIndex * 1.5 + Math.max(0, ascension - 1))
    };
};
