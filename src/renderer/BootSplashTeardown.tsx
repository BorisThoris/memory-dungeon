import { useEffect } from 'react';
import { dismissBootSplash } from './bootSplash';

/**
 * Drops the first-paint splash once React has committed. An effect rather than a timer after
 * `render()`: the commit is what guarantees the startup intro is in the DOM to fade down onto, so
 * the handoff can never expose a bare page.
 *
 * Mount this as a sibling *outside* AppErrorBoundary. If the app throws during its first render the
 * boundary swallows that subtree's effects, so a teardown living inside it would never run and the
 * splash would sit on top of the error screen forever.
 */
export const BootSplashTeardown = (): null => {
    useEffect(() => {
        dismissBootSplash();
    }, []);

    return null;
};
