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
