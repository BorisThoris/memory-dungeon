import { DEFAULT_KEY_BINDINGS, keyCodeLabel, TOOL_KEY_ACTIONS, type KeyBindings } from '../../shared/key-bindings';

/** The tool keys as one label: "1–9" for an unbroken run of digits, else each key in slot order. */
const toolKeysLabel = (bindings: KeyBindings): string => {
    const labels = TOOL_KEY_ACTIONS.map((action) => keyCodeLabel(bindings[action]));
    if (labels.every((label, index) => label === String(index + 1))) return '1–9';
    return labels.filter((label) => label !== 'None').join(' ');
};

/**
 * Central list for in-run keyboard help (GameScreen overlay), read from the player's bindings
 * (`key-bindings.ts`) so the list cannot drift from the keys. Keep labels concise.
 */
export const gameplayShortcutRows = (
    bindings: KeyBindings = DEFAULT_KEY_BINDINGS
): ReadonlyArray<{ id: string; keys: string; description: string }> => [
    { id: 'boardNav', keys: 'Arrow keys', description: 'Move focus between tiles on the board (when board focus is active)' },
    { id: 'boardFlip', keys: 'Enter / Space', description: 'Flip the focused tile' },
    {
        id: 'pause',
        keys: bindings.pause ? `${keyCodeLabel(bindings.pause)} / Escape` : 'Escape',
        description: 'Pause or resume the run; Escape closes the current dialog first'
    },
    { id: 'powers', keys: toolKeysLabel(bindings), description: 'Use the tools below the board, left to right; press an armed tool again to cancel it' },
    { id: 'help', keys: bindings.help ? `? or ${keyCodeLabel(bindings.help)}` : '?', description: 'Open this keyboard shortcuts list' },
    { id: 'closeShortcuts', keys: 'Escape', description: 'Close Controls and return to the paused run' }
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
