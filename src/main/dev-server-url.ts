const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export const resolveDevServerUrl = (rawValue: string | undefined, isPackaged: boolean): string | null => {
    if (isPackaged || !rawValue) {
        return null;
    }
    try {
        const url = new URL(rawValue);
        if (
            (url.protocol !== 'http:' && url.protocol !== 'https:') ||
            !LOOPBACK_HOSTNAMES.has(url.hostname) ||
            url.username.length > 0 ||
            url.password.length > 0
        ) {
            return null;
        }
        return url.href;
    } catch {
        return null;
    }
};

