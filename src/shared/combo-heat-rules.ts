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
 * The heat as one number, 0..1, saturating: the first links are where the growth is felt, and a
 * combo carried across five floors still has somewhere to climb. 3 ≈ 0.22, 10 ≈ 0.57, 16 ≈ 0.74,
 * 25 ≈ 0.88, 40 ≈ 0.96.
 */
export const comboHeat = (combo: number): number => 1 - Math.exp(-runNonNegativeInteger(combo) / 12);

export const COMBO_HEAT_STAGE_LABELS: Readonly<Record<ComboHeatStage, string>> = {
    cold: '',
    warm: 'Warm',
    hot: 'Hot',
    blazing: 'Blazing',
    inferno: 'Inferno',
    legendary: 'Legendary'
};

export interface ComboHeatLevels {
    stage: ComboHeatStage;
    stageIndex: number;
    heat: number;
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
    return {
        stage,
        stageIndex,
        heat: round(heat),
        burn: round(1 + heat * 1.1),
        aura: round(stageIndex === 0 ? 0 : 0.18 + heat * 0.82),
        hueDeg: Math.round(-12 * stageIndex * (stageIndex >= 4 ? 2.2 : 1)) + 0,
        embers: stageIndex < 2 ? 0 : Math.min(6, stageIndex * 1.5)
    };
};
