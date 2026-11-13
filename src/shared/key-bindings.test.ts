import { describe, expect, it } from 'vitest';
import {
    DEFAULT_KEY_BINDINGS,
    keyCodeLabel,
    keyMatchesAction,
    normalizeKeyBindings,
    rebindKey,
    toolSlotForCode
} from './key-bindings';
import { createDefaultSaveData, normalizeUnknownSaveData } from './save-data';

describe('the keyboard bindings', () => {
    it('reads a save from before bindings existed as the defaults, and keeps High Contrast off', () => {
        const save = createDefaultSaveData();
        const olderSettings: Record<string, unknown> = { ...save.settings };
        delete olderSettings.keyBindings;
        delete olderSettings.highContrast;
        const restored = normalizeUnknownSaveData({ ...save, settings: olderSettings });
        expect(restored.settings.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
        expect(restored.settings.highContrast).toBe(false);
    });

    it('drops reserved, malformed and doubled keys from a save', () => {
        const keys = normalizeKeyBindings({ pause: 'Escape', help: 'KeyH', tool1: 'KeyH', tool2: 42, tool3: 'not a code!', ghost: 'KeyG' });
        expect(keys.pause).toBe('KeyP');
        expect(keys.help).toBe('KeyH');
        // KeyH is taken by help, so tool 1 goes back to its own default.
        expect(keys.tool1).toBe('Digit1');
        expect(keys.tool2).toBe('Digit2');
        expect(keys.tool3).toBe('Digit3');
        expect(keys).not.toHaveProperty('ghost');
    });

    it('leaves an action without a key rather than give two actions one key', () => {
        // Tool 1 moved to 2, and tool 2 moved to 1's default, which tool 1 no longer holds.
        expect(normalizeKeyBindings({ tool1: 'Digit2', tool2: 'Digit1' })).toMatchObject({ tool1: 'Digit2', tool2: 'Digit1' });
        // Tool 2 claims 1's key while 1 keeps it: tool 2 falls back to its own default.
        expect(normalizeKeyBindings({ tool2: 'Digit1' })).toMatchObject({ tool1: 'Digit1', tool2: 'Digit2' });
        // Both defaults taken: no key.
        expect(normalizeKeyBindings({ pause: 'Digit2', tool2: 'KeyP' })).toMatchObject({ pause: 'Digit2', tool2: 'KeyP' });
        expect(normalizeKeyBindings({ pause: 'Digit2', tool1: 'Digit2' })).toMatchObject({ pause: 'Digit2', tool1: 'Digit1', tool2: '' });
    });

    it('refuses a reserved key or one another action holds, and never swaps', () => {
        expect(rebindKey(DEFAULT_KEY_BINDINGS, 'pause', 'Enter')).toEqual({ ok: false, reason: 'reserved' });
        expect(rebindKey(DEFAULT_KEY_BINDINGS, 'pause', 'Digit3')).toEqual({ ok: false, reason: 'taken', takenBy: 'tool3' });
        const moved = rebindKey(DEFAULT_KEY_BINDINGS, 'pause', 'KeyO');
        expect(moved.ok && moved.bindings.pause).toBe('KeyO');
        expect(rebindKey(DEFAULT_KEY_BINDINGS, 'pause', 'KeyP').ok).toBe(true);
    });

    it('matches a press by its key code, and the default number keys on the keypad too', () => {
        expect(keyMatchesAction(DEFAULT_KEY_BINDINGS, 'pause', 'KeyP')).toBe(true);
        expect(toolSlotForCode(DEFAULT_KEY_BINDINGS, 'Digit4')).toBe(3);
        expect(toolSlotForCode(DEFAULT_KEY_BINDINGS, 'Numpad4')).toBe(3);
        const moved = { ...DEFAULT_KEY_BINDINGS, tool1: 'KeyQ' };
        expect(toolSlotForCode(moved, 'KeyQ')).toBe(0);
        expect(toolSlotForCode(moved, 'Digit1')).toBeNull();
        // A keypad key bound to an action of its own is that action's, not the digit's.
        const keypadPause = { ...DEFAULT_KEY_BINDINGS, pause: 'Numpad4' };
        expect(toolSlotForCode(keypadPause, 'Numpad4')).toBeNull();
        expect(keyMatchesAction({ ...DEFAULT_KEY_BINDINGS, pause: '' }, 'pause', '')).toBe(false);
    });

    it('names keys the way a player reads them', () => {
        expect(['KeyP', 'Digit1', 'F1', 'Numpad4', 'Backquote', ''].map(keyCodeLabel)).toEqual(['P', '1', 'F1', 'Numpad 4', 'Backquote', 'None']);
    });
});
