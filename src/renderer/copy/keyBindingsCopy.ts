import { tr } from '../../shared/i18n';
import type { KeyActionId } from '../../shared/key-bindings';

/** Settings › Controls › Keys (`KeyBindingsEditor.tsx`). */
export const KEY_ACTION_LABELS: Record<KeyActionId, string> = {
    pause: tr.s('Pause'),
    help: tr.s('Shortcuts list'),
    tool1: tr.s('Tool 1'),
    tool2: tr.s('Tool 2'),
    tool3: tr.s('Tool 3'),
    tool4: tr.s('Tool 4'),
    tool5: tr.s('Tool 5'),
    tool6: tr.s('Tool 6'),
    tool7: tr.s('Tool 7'),
    tool8: tr.s('Tool 8'),
    tool9: tr.s('Tool 9')
};

export const KEY_BINDINGS_COPY = {
    title: tr.s('Keys'),
    lead: tr.s('Choose a key for each action. Tools are counted left to right along the dock below the board. Escape, Enter, Space, Tab and the arrow keys stay as they are.'),
    change: tr.s('Change'),
    listening: tr.s('Press a key…'),
    listeningHint: tr.s('Press the new key, or Escape to keep the old one.'),
    reset: tr.s('Reset keys to default'),
    reserved: (key: string): string => tr`${key} stays fixed: it closes dialogs, flips cards or moves focus.`,
    taken: (key: string, holder: string): string => tr`${key} is already ${holder}. Give ${holder} another key first.`,
    saved: (action: string, key: string): string => tr`${action} is now ${key}.`
} as const;
