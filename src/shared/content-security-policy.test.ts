import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, policyAllowsDevServer } from './content-security-policy';

/**
 * Vite's hot-reload channel is a websocket to localhost, so the served policy has to allow `ws:`.
 * That allowance used to be written straight into `index.html`, and Vite copies the file verbatim,
 * so every packaged build shipped permission for its renderer to open a websocket to any port on
 * the player's machine. Nothing needs that once the bundle is on disk.
 */
describe('the renderer content security policy', () => {
    it('gives the dev server the socket it needs', () => {
        const policy = buildContentSecurityPolicy({ allowDevServer: true });

        expect(policy).toContain('ws://localhost:*');
        expect(policyAllowsDevServer(policy)).toBe(true);
    });

    it('ships nothing beyond self on connect-src', () => {
        const policy = buildContentSecurityPolicy({ allowDevServer: false });

        expect(policy).toContain("connect-src 'self';");
        expect(policy).not.toMatch(/wss?:\/\//u);
        expect(policyAllowsDevServer(policy)).toBe(false);
    });

    it('keeps the directives that are not about the dev server identical either way', () => {
        const withoutConnect = (policy: string) =>
            policy
                .split('; ')
                .filter((directive) => !directive.startsWith('connect-src'))
                .join('; ');

        expect(withoutConnect(buildContentSecurityPolicy({ allowDevServer: false }))).toBe(
            withoutConnect(buildContentSecurityPolicy({ allowDevServer: true }))
        );
    });

    it('locks down the directives that matter regardless of mode', () => {
        for (const allowDevServer of [true, false]) {
            const policy = buildContentSecurityPolicy({ allowDevServer });

            expect(policy).toContain("default-src 'self'");
            expect(policy).toContain("object-src 'none'");
            expect(policy).toContain("base-uri 'self'");
            // No 'unsafe-inline' or 'unsafe-eval' on scripts, in either mode.
            expect(policy).toContain("script-src 'self'");
            expect(policy).not.toMatch(/script-src[^;]*unsafe/u);
        }
    });

    it('leaves no placeholder behind in the source HTML', () => {
        // The template carries a token the build replaces; a rename that broke the substitution
        // would ship a policy the browser cannot parse and therefore does not enforce.
        const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

        expect(html).toContain('%CONTENT_SECURITY_POLICY%');
    });

    it('does not carry a dev allowance into a built index.html', () => {
        const built = join(process.cwd(), 'dist', 'index.html');
        if (!existsSync(built)) {
            // The renderer bundle is built by gate:build-output, not by the unit suite.
            return;
        }
        const html = readFileSync(built, 'utf8');

        expect(html).not.toContain('%CONTENT_SECURITY_POLICY%');
        expect(html).not.toMatch(/content="[^"]*wss?:\/\//u);
    });
});
