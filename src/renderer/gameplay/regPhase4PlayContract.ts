/**
 * REG-103–108: third-wave gameplay shell contracts (touch/HUD/powers/cards) — stable IDs for tests and docs.
 * Linked: tasks/refined-experience-gaps/REG-103 … REG-108
 */

/** REG-103: minimum touch target (CSS px) for one-hand play next to the board. */
export const REG103_MIN_POWER_TOUCH_PX = 44;

/**
 * REG-103: `touch-action` on the custom pan/zoom stage (browser may still scroll the page if unset on ancestors).
 * TileBoard uses pointer capture for pan; value keeps pinch/double-tap zoom predictable on touch.
 */
export const REG103_BOARD_TOUCH_ACTION = 'none' as const;

/** REG-104/105: data-* hooks for the gameplay shell (GameScreen + TileBoard). */
export const REG104_DATA_SHELL = 'data-reg-gameplay-shell';
export const REG105_DATA_DAIS = 'data-reg-board-dais';
export const REG105_DATA_STAGEVIEW = 'data-reg-stage-viewport';

/** REG-106: HUD information architecture — primary / secondary / deferred regions (RunShell bar / line / dock). */
export const REG106_HUD_IA = {
    primary: ['score', 'floor', 'lives', 'streak', 'ward_bounty'] as const,
    secondary: ['objective', 'mutators', 'run_meta'] as const,
    detailsDrawer: ['guard', 'combo', 'distraction', 'forgiveness'] as const
} as const;

/** REG-107: where power-verb teaching rows surface (RunShell dock). */
export const REG107_POWER_TEACHING_ANCHOR = 'gameplay-power-teaching-rail' as const;

/**
 * REG-108: card / tile material lanes — must stay aligned with `gameplayVisualConfig` + TileBoard three.js materials.
 */
export const REG108_CARD_MATERIAL_LANES = ['match', 'mismatch', 'invalid', 'combo', 'guard'] as const;

/** DNG-065: keyboard/controller focus order for dense dungeon surfaces. */
export const DNG065_DUNGEON_COMFORT_FOCUS_ORDER = [
    'occupied_cards',
    'exit_cards',
    'shop_cards',
    'room_cards',
    'board_powers',
    'required_prompts'
] as const;

export const DNG065_BOARD_APPLICATION_LABEL =
    'Memory tile board. Use arrow keys or controller direction controls to move focus; Enter, Space, or controller confirm selects.';

export const DNG065_MOBILE_BOARD_PRIORITY = {
    boardPrimary: true,
    minTouchTargetPx: REG103_MIN_POWER_TOUCH_PX,
    promptPolicy: 'inline_first_no_focus_trap'
} as const;

export const reg104ShellAttributes = (variant: 'playing' | 'floor_clear' | 'paused'): Record<string, string> => ({
    [REG104_DATA_SHELL]: variant,
    'data-reg-regional-variant': 'reg104-v1'
});
