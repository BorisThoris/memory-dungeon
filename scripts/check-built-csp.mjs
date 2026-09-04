/**
 * Fails when a built renderer ships a Content-Security-Policy meant for the dev server.
 *
 * `index.html` carries a placeholder the build replaces, because Vite copies that file verbatim and
 * the hot-reload websocket allowance it used to contain shipped with every packaged build. This
 * runs after the renderer bundle is written, where a unit test cannot look: on a clean checkout
 * there is no `dist/` to inspect, so a test that skips when it is absent guards nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = (process.env.VITE_OUT_DIR ?? 'dist').trim() || 'dist';
const htmlPath = join(process.cwd(), outDir, 'index.html');

const html = readFileSync(htmlPath, 'utf8');
const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/u.exec(html)?.[1] ?? null;

const fail = (message) => {
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
};

if (policy === null) {
    fail(`${htmlPath} has no Content-Security-Policy meta tag.`);
} else if (policy.includes('%CONTENT_SECURITY_POLICY%')) {
    // An unreplaced placeholder is a policy the browser cannot parse, and therefore does not apply.
    fail(`${htmlPath} still contains the CSP placeholder; the build substitution did not run.`);
} else if (/wss?:\/\//u.test(policy)) {
    fail(`${htmlPath} ships a dev-server websocket allowance:\n  ${policy}`);
} else if (!policy.includes("default-src 'self'") || !policy.includes("object-src 'none'")) {
    fail(`${htmlPath} is missing a directive the shipped policy is supposed to carry:\n  ${policy}`);
} else {
    process.stdout.write(`Built CSP is production-shaped (${outDir}/index.html)\n`);
}
