import type { KeyActionId } from '../../shared/key-bindings';

/** Settings › Controls › Keys (`KeyBindingsEditor.tsx`). */
export const KEY_ACTION_LABELS: Record<KeyActionId, string> = {
    pause: 'Pause',
    help: 'Shortcuts list',
    tool1: 'Tool 1',
    tool2: 'Tool 2',
    tool3: 'Tool 3',
    tool4: 'Tool 4',
    tool5: 'Tool 5',
    tool6: 'Tool 6',
    tool7: 'Tool 7',
    tool8: 'Tool 8',
    tool9: 'Tool 9'
};

export const KEY_BINDINGS_COPY = {
    title: 'Keys',
    lead: 'Choose a key for each action. Tools are counted left to right along the dock below the board. Escape, Enter, Space, Tab and the arrow keys stay as they are.',
    change: 'Change',
    listening: 'Press a key…',
    listeningHint: 'Press the new key, or Escape to keep the old one.',
    reset: 'Reset keys to default',
    reserved: (key: string): string => `${key} stays fixed: it closes dialogs, flips cards or moves focus.`,
    taken: (key: string, holder: string): string => `${key} is already ${holder}. Give ${holder} another key first.`,
    saved: (action: string, key: string): string => `${action} is now ${key}.`
} as const;
