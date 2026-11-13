import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import styles from './MainMenu.module.css';
import { FLASHING_NOTICE_COPY, FLASHING_NOTICE_STORAGE_KEY } from '../copy/flashingLightsCopy';

/**
 * A word about flashing light before the first run (2026-11-13).
 *
 * The rooms throw lightning, flash on a break and blaze on reaching Fever. Reduce Motion stops all
 * of that, but a player sensitive to flashing light had to find it first. The menu says so once,
 * with the switch itself on the note; "Got it" or the switch puts it away for good on this device.
 * It shows to a new player only, and never while Reduce Motion is already on.
 */
const seen = (): boolean => {
    try {
        return window.localStorage.getItem(FLASHING_NOTICE_STORAGE_KEY) === 'yes';
    } catch {
        return false;
    }
};

const remember = (): void => {
    try {
        window.localStorage.setItem(FLASHING_NOTICE_STORAGE_KEY, 'yes');
    } catch {
        // No storage: the note may come back next launch, which is the safe way to be wrong.
    }
};

const FlashingLightsNotice = () => {
    const { newPlayer, settings, updateSettings } = useAppStore(
        useShallow((state) => ({ newPlayer: !state.saveData.onboardingDismissed, settings: state.settings, updateSettings: state.updateSettings }))
    );
    const [dismissed, setDismissed] = useState(seen);
    // Before the first run, when a warning is any use: a returning player has met the storms already.
    if (dismissed || !newPlayer || settings.reduceMotion) return null;
    const close = (): void => {
        remember();
        setDismissed(true);
    };
    return (
        <div className={styles.note} data-testid="flashing-lights-notice" role="note">
            <span className={styles.noteTitle}>{FLASHING_NOTICE_COPY.title}</span>
            <span>{FLASHING_NOTICE_COPY.body}</span>
            <button
                className={styles.noteAction}
                type="button"
                onClick={() => {
                    close();
                    void updateSettings({ ...settings, reduceMotion: true });
                }}
            >
                {FLASHING_NOTICE_COPY.reduce}
            </button>
            <button className={styles.noteAction} type="button" onClick={close}>
                {FLASHING_NOTICE_COPY.dismiss}
            </button>
        </div>
    );
};

export default FlashingLightsNotice;
