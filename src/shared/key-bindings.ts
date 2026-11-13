/**
 * The keyboard's rebindable actions (2026-11-13): pause, the shortcuts list and the dock's nine
 * tool slots. Bindings are `KeyboardEvent.code` values, so a binding names a key's place on the
 * board, not the character a layout prints on it.
 *
 * Escape, Enter, Space, Tab and the arrows stay fixed: they are how every dialog closes, how a
 * focused card flips and how focus moves, and a player who rebinds one of them can lock themselves
 * out of the very screen that would let them undo it. `?` also keeps opening the shortcuts list.
 */
export const KEY_ACTION_IDS = ['pause', 'help', 'tool1', 'tool2', 'tool3', 'tool4', 'tool5', 'tool6', 'tool7', 'tool8', 'tool9'] as const;

export type KeyActionId = (typeof KEY_ACTION_IDS)[number];

export type KeyBindings = Record<KeyActionId, string>;

export const TOOL_KEY_ACTIONS = KEY_ACTION_IDS.filter((id): id is Exclude<KeyActionId, 'pause' | 'help'> => id.startsWith('tool'));

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
    pause: 'KeyP',
    help: 'F1',
    tool1: 'Digit1',
    tool2: 'Digit2',
    tool3: 'Digit3',
    tool4: 'Digit4',
    tool5: 'Digit5',
    tool6: 'Digit6',
    tool7: 'Digit7',
    tool8: 'Digit8',
    tool9: 'Digit9'
};

/** Keys no action may take (see the module note). */
export const RESERVED_KEY_CODES: ReadonlySet<string> = new Set([
    'Escape',
    'Enter',
    'NumpadEnter',
    'Space',
    'Tab',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
    'MetaLeft',
    'MetaRight',
    'CapsLock',
    'ContextMenu'
]);

const CODE_SHAPE = /^[A-Za-z][A-Za-z0-9]{0,23}$/;

export const isBindableKeyCode = (code: string): boolean => CODE_SHAPE.test(code) && !RESERVED_KEY_CODES.has(code);

/**
 * A save's bindings, made whole: unknown actions and malformed or reserved codes fall back to the
 * default, and a code two actions claim keeps only the first (in `KEY_ACTION_IDS` order), the other
 * returning to its default if that is free, else to no key at all ('').
 */
export const normalizeKeyBindings = (value: unknown): KeyBindings => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const out = { ...DEFAULT_KEY_BINDINGS };
    const taken = new Set<string>();
    const unresolved: KeyActionId[] = [];
    for (const id of KEY_ACTION_IDS) {
        const raw = source[id];
        const code = typeof raw === 'string' && (raw === '' || isBindableKeyCode(raw)) ? raw : DEFAULT_KEY_BINDINGS[id];
        if (code !== '' && taken.has(code)) {
            unresolved.push(id);
            continue;
        }
        out[id] = code;
        if (code !== '') taken.add(code);
    }
    for (const id of unresolved) {
        const fallback = DEFAULT_KEY_BINDINGS[id];
        out[id] = taken.has(fallback) ? '' : fallback;
        if (out[id] !== '') taken.add(fallback);
    }
    return out;
};

/** The action already on a key, if any. */
export const keyActionForCode = (bindings: KeyBindings, code: string): KeyActionId | null =>
    code === '' ? null : KEY_ACTION_IDS.find((id) => bindings[id] === code) ?? null;

export type RebindResult = { ok: true; bindings: KeyBindings } | { ok: false; reason: 'reserved' | 'taken'; takenBy?: KeyActionId };

/** Put an action on a key; a key another action holds, or a reserved one, is refused rather than swapped. */
export const rebindKey = (bindings: KeyBindings, action: KeyActionId, code: string): RebindResult => {
    if (!isBindableKeyCode(code)) return { ok: false, reason: 'reserved' };
    const holder = keyActionForCode(bindings, code);
    if (holder && holder !== action) return { ok: false, reason: 'taken', takenBy: holder };
    return { ok: true, bindings: { ...bindings, [action]: code } };
};

/**
 * Whether a key press is this action. The default number keys also answer on the numeric keypad,
 * as they did before bindings existed.
 */
export const keyMatchesAction = (bindings: KeyBindings, action: KeyActionId, code: string): boolean => {
    const bound = bindings[action];
    if (bound === '') return false;
    if (code === bound) return true;
    const digit = /^Digit([1-9])$/.exec(bound);
    return digit !== null && code === `Numpad${digit[1]}` && keyActionForCode(bindings, code) === null;
};

/** The dock slot (0 for the first tool) a key press uses, or null. */
export const toolSlotForCode = (bindings: KeyBindings, code: string): number | null => {
    const index = TOOL_KEY_ACTIONS.findIndex((action) => keyMatchesAction(bindings, action, code));
    return index >= 0 ? index : null;
};

/** How a code reads to a player: "P", "1", "F1", "Numpad 4", "Backquote". */
export const keyCodeLabel = (code: string): string => {
    if (code === '') return 'None';
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return letter[1];
    const digit = /^Digit([0-9])$/.exec(code);
    if (digit) return digit[1];
    const pad = /^Numpad(.+)$/.exec(code);
    if (pad) return `Numpad ${pad[1]}`;
    return code;
};
