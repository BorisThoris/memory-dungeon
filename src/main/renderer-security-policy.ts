export const RENDERER_SECURITY_WEB_PREFERENCES = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
} as const;

export const rendererNavigationIsAllowed = (candidateUrl: string, entryUrl: string): boolean => {
    try {
        const candidate = new URL(candidateUrl);
        const entry = new URL(entryUrl);
        if (entry.protocol === 'file:') {
            return candidate.protocol === 'file:' && candidate.pathname === entry.pathname;
        }
        // Node gives a custom scheme such as `app://game` the opaque origin "null", the same as
        // `file:` and every other non-web scheme, so comparing origins alone would let the window
        // wander to any of them. The scheme and host are what name the game.
        return candidate.protocol === entry.protocol && candidate.host === entry.host && candidate.origin === entry.origin;
    } catch {
        return false;
    }
};

