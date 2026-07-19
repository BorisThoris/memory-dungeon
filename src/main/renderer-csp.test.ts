import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('renderer content security policy', () => {
    it('restricts executable and network sources while retaining local renderer assets', () => {
        const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
        const content = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];

        expect(content).toBeDefined();
        expect(content).toContain("default-src 'self'");
        expect(content).toContain("base-uri 'self'");
        expect(content).toContain("object-src 'none'");
        expect(content).toContain("script-src 'self'");
        expect(content).not.toContain("script-src 'self' 'unsafe-inline'");
        expect(content).not.toContain('unsafe-eval');
        expect(content).toContain("connect-src 'self' ws://127.0.0.1:*");
        expect(content).toContain("worker-src 'self' blob:");
    });
});

