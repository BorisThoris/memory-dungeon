/**
 * The renderer's Content-Security-Policy, in one place so the shipped one can differ from the one
 * the dev server needs.
 *
 * Vite's hot-reload channel is a websocket to localhost, so development has to allow `ws:` in
 * `connect-src`. That allowance was written straight into `index.html`, and Vite copies the file
 * verbatim — so every packaged build has shipped permission for its renderer to open a websocket to
 * any port on the player's machine. Nothing needs that once the bundle is on disk.
 */

/** Ports are unknown ahead of time, so the dev entries are wildcards over the loopback names. */
const DEV_SERVER_SOCKETS = [
    'ws://127.0.0.1:*',
    'ws://localhost:*',
    'ws://[::1]:*',
    'wss://127.0.0.1:*',
    'wss://localhost:*',
    'wss://[::1]:*'
] as const;

export interface ContentSecurityPolicyOptions {
    /** True only while Vite is serving; a packaged build never needs the hot-reload socket. */
    readonly allowDevServer: boolean;
}

export const buildContentSecurityPolicy = ({ allowDevServer }: ContentSecurityPolicyOptions): string => {
    const connectSrc = ["'self'", ...(allowDevServer ? DEV_SERVER_SOCKETS : [])].join(' ');
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "script-src 'self'",
        // Inline styles are how the theme bridge writes its CSS variables onto :root.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self' blob:",
        `connect-src ${connectSrc}`,
        "worker-src 'self' blob:"
    ].join('; ');
};

/** True when a policy still carries permissions only the dev server needs. */
export const policyAllowsDevServer = (policy: string): boolean =>
    DEV_SERVER_SOCKETS.some((entry) => policy.includes(entry.replace(':*', ''))) || /\bwss?:\/\//u.test(policy);
