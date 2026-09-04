import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy some text, and say whether it worked.
 *
 * The Clipboard API needs a secure context and a user gesture, and refuses in ways that vary by
 * host — a packaged Electron window, a browser tab, a headless run. A copy button that silently
 * does nothing is worse than one that says it could not, so the failure is a state the caller can
 * render rather than a swallowed rejection.
 */

export type CopyState = 'idle' | 'copied' | 'failed';

/** How long the confirmation stands before the button goes back to offering the action. */
const CONFIRMATION_MS = 2400;

export const useCopyToClipboard = (): { copy: (text: string) => void; state: CopyState } => {
    const [state, setState] = useState<CopyState>('idle');
    const timerRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        },
        []
    );

    const settle = useCallback((next: CopyState): void => {
        setState(next);
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => setState('idle'), CONFIRMATION_MS);
    }, []);

    const copy = useCallback(
        (text: string): void => {
            const clipboard = navigator.clipboard;
            if (!clipboard || typeof clipboard.writeText !== 'function') {
                settle('failed');
                return;
            }
            clipboard.writeText(text).then(
                () => settle('copied'),
                () => settle('failed')
            );
        },
        [settle]
    );

    return { copy, state };
};
