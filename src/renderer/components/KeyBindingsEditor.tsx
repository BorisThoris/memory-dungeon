import { useEffect, useState } from 'react';
import { DEFAULT_KEY_BINDINGS, KEY_ACTION_IDS, keyCodeLabel, rebindKey, type KeyActionId, type KeyBindings } from '../../shared/key-bindings';
import { KEY_ACTION_LABELS, KEY_BINDINGS_COPY } from '../copy/keyBindingsCopy';
import styles from './SettingsScreen.module.css';

interface KeyBindingsEditorProps {
    bindings: KeyBindings;
    onChange: (next: KeyBindings) => void;
}

/**
 * Settings › Controls › Keys (2026-11-13). Each rebindable action is a line with its key; Change
 * listens for the next key. A reserved key or one another action holds is refused with a word why,
 * never swapped silently. The change joins the settings draft like any other control.
 */
const KeyBindingsEditor = ({ bindings, onChange }: KeyBindingsEditorProps) => {
    const [listening, setListening] = useState<KeyActionId | null>(null);
    const [note, setNote] = useState<string | null>(null);

    useEffect(() => {
        if (!listening) return;
        const onKeyDown = (event: KeyboardEvent): void => {
            // Captured before the game's own handlers: the key chosen here must not also pause the run.
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
                setListening(null);
                setNote(null);
                return;
            }
            const result = rebindKey(bindings, listening, event.code);
            const key = keyCodeLabel(event.code);
            if (result.ok) {
                onChange(result.bindings);
                setNote(KEY_BINDINGS_COPY.saved(KEY_ACTION_LABELS[listening], key));
                setListening(null);
                return;
            }
            setNote(
                result.reason === 'taken' && result.takenBy
                    ? KEY_BINDINGS_COPY.taken(key, KEY_ACTION_LABELS[result.takenBy])
                    : KEY_BINDINGS_COPY.reserved(key)
            );
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [bindings, listening, onChange]);

    return (
        <div data-testid="settings-key-bindings">
            <p className={styles.headerCopy}>{KEY_BINDINGS_COPY.lead}</p>
            {KEY_ACTION_IDS.map((action) => (
                <div className={styles.fieldCard} key={action}>
                    <div className={styles.fieldText}>
                        <strong>{KEY_ACTION_LABELS[action]}</strong>
                        <span data-testid={`key-binding-${action}`}>
                            {listening === action ? KEY_BINDINGS_COPY.listening : keyCodeLabel(bindings[action])}
                        </span>
                    </div>
                    <button
                        aria-label={`${KEY_BINDINGS_COPY.change} ${KEY_ACTION_LABELS[action]} key`}
                        aria-pressed={listening === action}
                        className={styles.word}
                        onClick={() => {
                            setNote(listening === action ? null : KEY_BINDINGS_COPY.listeningHint);
                            setListening(listening === action ? null : action);
                        }}
                        type="button"
                    >
                        {KEY_BINDINGS_COPY.change}
                    </button>
                </div>
            ))}
            <p aria-live="polite" className={styles.headerCopy} data-testid="key-bindings-note">
                {note}
            </p>
            <button
                className={styles.word}
                data-testid="key-bindings-reset"
                onClick={() => {
                    setListening(null);
                    setNote(null);
                    onChange(DEFAULT_KEY_BINDINGS);
                }}
                type="button"
            >
                {KEY_BINDINGS_COPY.reset}
            </button>
        </div>
    );
};

export default KeyBindingsEditor;
