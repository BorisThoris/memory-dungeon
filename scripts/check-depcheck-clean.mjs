import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const depcheckBin = require.resolve('depcheck/bin/depcheck.js');

export const getDepcheckIssues = (payload) => ({
    dependencies: payload.dependencies ?? [],
    devDependencies: payload.devDependencies ?? [],
    missing: payload.missing ?? {},
    invalidFiles: payload.invalidFiles ?? {},
    invalidDirs: payload.invalidDirs ?? {}
});

export const hasDepcheckIssues = (issues) =>
    issues.dependencies.length > 0 ||
    issues.devDependencies.length > 0 ||
    Object.keys(issues.missing).length > 0 ||
    Object.keys(issues.invalidFiles).length > 0 ||
    Object.keys(issues.invalidDirs).length > 0;

export const formatDepcheckIssues = (issues) => JSON.stringify(issues, null, 2);

/**
 * depcheck exits non-zero when it FINDS something, which `execFileSync` raises as an error. Reading
 * the JSON off the thrown error is what separates "the tool broke" from "the tool has an answer" -
 * and until Gen 254 this script did not: it caught the throw, printed "depcheck failed to run",
 * and dropped the report on the floor. Two unused devDependencies sat behind that message inside
 * `fullcheck`, which is the one place a red light is supposed to be unmissable.
 */
const readDepcheckReport = () => {
    try {
        return {
            payload: JSON.parse(
                execFileSync(process.execPath, [depcheckBin, '--json'], {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'inherit']
                })
            )
        };
    } catch (error) {
        const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
        try {
            return { payload: JSON.parse(stdout) };
        } catch {
            return { error };
        }
    }
};

const run = () => {
    const { error, payload } = readDepcheckReport();
    if (!payload) {
        console.error('depcheck could not be run, or printed something that is not JSON.');
        if (error instanceof Error && error.message) {
            console.error(error.message);
        }
        process.exit(1);
    }

    const issues = getDepcheckIssues(payload);
    if (!hasDepcheckIssues(issues)) {
        console.log('depcheck PASS');
        process.exit(0);
    }

    console.error(formatDepcheckIssues(issues));
    process.exit(1);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    run();
}
