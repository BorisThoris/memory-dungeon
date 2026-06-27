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

const run = () => {
    let payload;
    try {
        const output = execFileSync(process.execPath, [depcheckBin, '--json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit']
        });
        payload = JSON.parse(output);
    } catch (error) {
        console.error('depcheck failed to run or returned invalid JSON.');
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
