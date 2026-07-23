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
        return candidate.origin === entry.origin;
    } catch {
        return false;
    }
};

