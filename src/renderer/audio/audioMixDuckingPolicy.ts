/**
 * REG-114: final mix / ducking contract — which routes duck music when modal UI or run-critical SFX play.
 * Implementation uses existing `musicGainFromSettings` + App pauses, not a second bus yet.
 */
export type Reg114DuckId =
    | 'menu_overlay'
    | 'pause'
    | 'relic_draft'
    | 'game_over'
    | 'run_critical_sfx' /** match, floor clear — keep music slightly under SFX */
    | 'fever_break' /** the Fever sting and its shatter phrase read over the bed for one beat */
    | 'ui_click';

interface Reg114DuckRow {
    id: Reg114DuckId;
    musicVolumeMultiplier: number;
    reason: string;
    audioInteractionCoverage: boolean;
}

/**
 * When music is *active*, multiply effective music linear gain by this factor before the HTMLAudioElement.
 * Values in (0,1] are conservative; `1` = no duck.
 */
export const REG114_MIX_DUCKING_TABLE: readonly Reg114DuckRow[] = [
    { id: 'menu_overlay', musicVolumeMultiplier: 0.9, reason: 'Meta modals and settings stay readable', audioInteractionCoverage: true },
    { id: 'pause', musicVolumeMultiplier: 0, reason: 'Pause suppresses run loop; music paused with gameplayMusic', audioInteractionCoverage: true },
    { id: 'relic_draft', musicVolumeMultiplier: 0.55, reason: 'Offer panel is run-critical read', audioInteractionCoverage: true },
    { id: 'game_over', musicVolumeMultiplier: 0, reason: 'Results screen is own layer', audioInteractionCoverage: true },
    { id: 'run_critical_sfx', musicVolumeMultiplier: 0.88, reason: 'Light duck so board SFX read over bed', audioInteractionCoverage: true },
    { id: 'fever_break', musicVolumeMultiplier: 0.6, reason: 'A Fever break is the loudest thing on the floor; the bed steps aside for one beat and comes back on a curve', audioInteractionCoverage: true },
    { id: 'ui_click', musicVolumeMultiplier: 1, reason: 'UI SFX is short; no automatic music duck in v1', audioInteractionCoverage: true }
] as const;

export const getReg114DuckRow = (id: Reg114DuckId): Reg114DuckRow | undefined =>
    REG114_MIX_DUCKING_TABLE.find((row) => row.id === id);
