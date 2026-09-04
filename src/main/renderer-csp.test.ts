import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '../shared/content-security-policy';

/**
 * This used to read the literal policy out of `index.html`. The file now carries a placeholder the
 * build fills in, because the policy written there was the one the dev server needs — including a
 * websocket allowance to localhost that shipped in every packaged build. The assertions move to the
 * builder that produces both, and the interesting half is what production does *not* get.
 */
describe('renderer content security policy', () => {
    it('restricts executable and network sources while retaining local renderer assets', () => {
        for (const allowDevServer of [true, false]) {
            const content = buildContentSecurityPolicy({ allowDevServer });

            expect(content).toContain("default-src 'self'");
            expect(content).toContain("base-uri 'self'");
            expect(content).toContain("object-src 'none'");
            expect(content).toContain("script-src 'self'");
            expect(content).not.toContain("script-src 'self' 'unsafe-inline'");
            expect(content).not.toContain('unsafe-eval');
            expect(content).toContain("worker-src 'self' blob:");
        }
    });

    it('gives the hot-reload socket to the dev server and to nothing else', () => {
        expect(buildContentSecurityPolicy({ allowDevServer: true })).toContain("connect-src 'self' ws://127.0.0.1:*");
        expect(buildContentSecurityPolicy({ allowDevServer: false })).toContain("connect-src 'self';");
    });

    it('keeps the template a placeholder so the two cannot drift', () => {
        const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

        expect(html).toContain('%CONTENT_SECURITY_POLICY%');
        // A literal policy here is what caused the problem: Vite copies this file verbatim.
        expect(html).not.toMatch(/content="default-src/u);
    });
});
