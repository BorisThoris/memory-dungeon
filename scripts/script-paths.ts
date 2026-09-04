/**
 * Finds package scripts that name a file which is not there.
 *
 * `gate:long-run-ui-feedback` ran `GameplayHudBar.test.tsx` long after the HUD rebuild renamed
 * that component to `RunShell`. The gate would have failed on its first line for anyone who ran
 * it — and nobody did, because it is declared standalone, so the gate-reachability audit counted
 * it as accounted for and moved on. A gate that cannot start is the quietest kind of gate nobody
 * runs, and no test catches it, because the broken reference lives in `package.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Only paths under these roots are ours to check; everything else is a package or a flag value. */
const OWNED_ROOTS = ['src/', 'scripts/', 'e2e/', 'docs/'] as const;

const PATH_SHAPED = /[\w./-]+\.(?:ts|tsx|mts|mjs|js|json|md)\b/gu;

export interface MissingScriptPath {
    readonly script: string;
    readonly path: string;
}

export const findMissingScriptPaths = (
    scripts: Readonly<Record<string, string>>,
    exists: (path: string) => boolean
): MissingScriptPath[] => {
    const missing: MissingScriptPath[] = [];
    for (const [script, command] of Object.entries(scripts)) {
        for (const path of command.match(PATH_SHAPED) ?? []) {
            if (OWNED_ROOTS.some((root) => path.startsWith(root)) && !exists(path)) {
                missing.push({ path, script });
            }
        }
    }
    return missing;
};

const main = (): void => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    const missing = findMissingScriptPaths(scripts, (path) => existsSync(path));

    for (const row of missing) {
        console.log(`script names a file that is not there: ${row.script} → ${row.path}`);
    }
    console.log(`\n${Object.keys(scripts).length} scripts, ${missing.length} naming a missing file`);
    if (missing.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/script-paths.ts'))) {
    main();
}
