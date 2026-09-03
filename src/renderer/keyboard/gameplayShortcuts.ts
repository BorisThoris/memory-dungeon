/**
 * Central list for in-run keyboard help (GameScreen overlay). Keep labels concise; match actual handlers.
 */
export const GAMEPLAY_SHORTCUT_ROWS: ReadonlyArray<{ id: string; keys: string; description: string }> = [
    { id: 'boardNav', keys: 'Arrow keys', description: 'Move focus between tiles on the board (when board focus is active)' },
    { id: 'boardFlip', keys: 'Enter / Space', description: 'Flip the focused tile' },
    { id: 'pause', keys: 'P', description: 'Pause or resume the run' },
    { id: 'powers', keys: 'Toolbar', description: 'Recall = pin/peek, Search = shuffle/swap, Damage control = destroy/stray/undo' },
    { id: 'help', keys: '? or F1', description: 'Open this keyboard shortcuts list' },
    { id: 'closeShortcuts', keys: 'Escape', description: 'Close this shortcuts overlay when it is open' }
];

/**
 * The same list for a controller. A pad drives the focus ring rather than a pointer, so the rows
 * name what each button does to the ring, not which screen it belongs to.
 */
export const GAMEPAD_SHORTCUT_ROWS: ReadonlyArray<{ id: string; keys: string; description: string }> = [
    { id: 'padNav', keys: 'D-pad / left stick', description: 'Move the focus ring; on the board, move between tiles' },
    { id: 'padConfirm', keys: 'A', description: 'Activate the focused control; flip the focused tile' },
    { id: 'padBack', keys: 'B', description: 'Back out of a panel or close an overlay' },
    { id: 'padPause', keys: 'Start', description: 'Pause or resume the run' },
    { id: 'padTabs', keys: 'LB / RB', description: 'Step through every control in order, across panels' },
    { id: 'padHelp', keys: 'Y or Back', description: 'Open this shortcuts list' }
];
