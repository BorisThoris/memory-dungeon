import type { RunState } from './contracts';
import { COMBO_HEAT_STAGE_FROM, comboHeatStage, type ComboHeatStage } from './combo-heat-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Heat perks: what the combo's heat changes about the board itself.
 *
 * Up to 2026-09-30 the heat (`combo-heat-rules.ts`) was presentation only, and the study in
 * `docs/gameplay/combo-feedback-reference.md` said so on purpose: rank effects that change the
 * rules were listed under "deliberately not borrowed". The owner overrode that: the pool tables,
 * NBA Jam's fire, Peggle's fever and Tetris Effect's zone all hand the hot player a *different
 * game*, not a louder one, and the combo here is meant to do the same. So the heat now buys three
 * things, each one a rule the board already has, turned up a notch:
 *
 * - **Afterglow.** From Hot, every match lights face-down cards touching the matched pair until
 *   the next flip, the lantern hall's light on a shorter wick: one card at Hot, two at Blazing,
 *   three from Inferno (the lantern's own cap). It is information, which is what a memory game's
 *   hot hand should be made of - the fire shows you the board.
 * - **A wider pop.** From Blazing a break may take one more pair than its rung allows. The rung
 *   still decides the waves; the heat only lifts the cap. Measured before it was set (perfect
 *   player, eight seeds, floors 1-24, `yarn sim:pop-share`): the player matched 0.38 of a floor's
 *   pairs by hand before the perks and 0.34 with them, and the biggest break on a floor went from
 *   0.34 of the board to 0.38. Two pairs at Legendary took it to 0.33 and 0.41, which is the pop
 *   starting to take the board again (`docs/BALANCE_NOTES.md`, 2026-09-23), so it stays at one.
 * - **A longer reach.** From Inferno the first wave walks one step further along the clump.
 *
 * What the heat does *not* buy is a miss. Runs are punishing (`docs/BALANCE_NOTES.md`): the bank
 * is earned the same way at Legendary as at cold, and a miss at any heat ends the combo. The
 * perks make the hot floor faster and more legible, not safer, so the thing at stake when the
 * combo dies is bigger for having burned.
 *
 * The perks read the combo the player *carries into* the turn, not the one the match completes:
 * you have to be on fire before the shot, the way the tables do it.
 */
export interface ComboHeatPerks {
    readonly stage: ComboHeatStage;
    /** Face-down cards a match lights until the next flip (0 = none). */
    readonly afterglow: number;
    /** Pairs a break may take above its rung's cap. */
    readonly breakPairBonus: number;
    /** Steps the first wave walks beyond its rung's reach. */
    readonly breakReachBonus: number;
}

export const COMBO_HEAT_PERKS: Readonly<Record<ComboHeatStage, Omit<ComboHeatPerks, 'stage'>>> = {
    cold: { afterglow: 0, breakPairBonus: 0, breakReachBonus: 0 },
    warm: { afterglow: 0, breakPairBonus: 0, breakReachBonus: 0 },
    hot: { afterglow: 1, breakPairBonus: 0, breakReachBonus: 0 },
    blazing: { afterglow: 2, breakPairBonus: 1, breakReachBonus: 0 },
    inferno: { afterglow: 3, breakPairBonus: 1, breakReachBonus: 1 },
    legendary: { afterglow: 3, breakPairBonus: 1, breakReachBonus: 1 }
};

export const comboHeatPerks = (combo: number): ComboHeatPerks => {
    const stage = comboHeatStage(combo);
    return { stage, ...COMBO_HEAT_PERKS[stage] };
};

/** Whether any perk is on at this heat: the census counts a match resolved with one. */
export const comboHeatPerksActive = (perks: ComboHeatPerks): boolean =>
    perks.afterglow > 0 || perks.breakPairBonus > 0 || perks.breakReachBonus > 0;

/** The perks the run carries into its next turn. Saves from before the perks read as cold. */
export const runComboHeatPerks = (run: Partial<Pick<RunState, 'stats'>>): ComboHeatPerks =>
    comboHeatPerks(runNonNegativeInteger(run.stats?.currentStreak));

/** The combo at which the next perk (or a bigger one) switches on, for the HUD; null at the top. */
export const nextComboHeatPerkAt = (combo: number): number | null => {
    const now = comboHeatPerks(combo);
    const order: Array<Exclude<ComboHeatStage, 'cold'>> = ['warm', 'hot', 'blazing', 'inferno', 'legendary'];
    for (const stage of order) {
        const at = COMBO_HEAT_STAGE_FROM[stage];
        if (at <= combo) continue;
        const next = COMBO_HEAT_PERKS[stage];
        if (next.afterglow > now.afterglow || next.breakPairBonus > now.breakPairBonus || next.breakReachBonus > now.breakReachBonus) return at;
    }
    return null;
};
