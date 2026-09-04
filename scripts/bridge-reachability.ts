/**
 * Finds desktop-bridge surface nothing uses.
 *
 * The preload bridge is the renderer's entire reach into the main process, and it is a security
 * boundary: everything exposed on it is callable by anything running in the renderer, so a method
 * nobody calls is attack surface bought for nothing.
 *
 * It also rots the same way everything else here has. `getSettings` sat on the bridge long after
 * settings started arriving with `getSaveData`, and `setDisplayMode` was a second path to
 * fullscreen that nothing took, the real one being a side effect of saving settings. Two ways to do
 * one thing, one of them never exercised.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Bridge methods deliberately exposed without a caller yet. Empty, and worth keeping that way. */
export const BRIDGE_EXEMPTIONS: Record<string, string> = {};

export const readDesktopApiMethods = (source: string): string[] => {
    const start = source.indexOf('export interface DesktopApi {');
    if (start < 0) {
        return [];
    }
    return [...source.slice(start, source.indexOf('\n}', start)).matchAll(/^ {4}(\w+):/gmu)].map(
        (match) => match[1] ?? ''
    );
};

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (/\.tsx?$/u.test(path) && !/\.test\./u.test(path)) {
            out.push(path);
        }
    }
    return out;
};

export const findUnusedBridgeMethods = (methods: readonly string[], callerSources: readonly string[]): string[] =>
    methods.filter(
        (method) =>
            !(method in BRIDGE_EXEMPTIONS) &&
            !callerSources.some((source) => new RegExp(`\\b${method}\\b`).test(source))
    );

const main = (): void => {
    const methods = readDesktopApiMethods(readFileSync(join(process.cwd(), 'src/shared/contracts.ts'), 'utf8'));
    // Everything in the renderer except the bridge's own definition, which mentions every method.
    const callers = walk(join(process.cwd(), 'src/renderer'))
        .filter((path) => !path.endsWith(join('renderer', 'desktop-client.ts')))
        .map((path) => readFileSync(path, 'utf8'));
    const unused = findUnusedBridgeMethods(methods, callers);

    for (const method of unused) {
        process.stdout.write(`bridge method with no renderer caller: ${method}\n`);
    }
    process.stdout.write(`\n${methods.length} DesktopApi methods, ${unused.length} with no caller\n`);
    if (unused.length > 0) {
        process.stdout.write('Remove it, or call it. Unused bridge surface is reachable by anything in the renderer.\n');
        process.exitCode = 1;
    }
};

if (process.argv[1]?.includes('bridge-reachability')) {
    main();
}
