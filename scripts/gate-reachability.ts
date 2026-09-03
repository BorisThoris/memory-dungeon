/**
 * Finds gates nothing runs.
 *
 * Two separate real problems in this repository came from the same shape: a gate that exists, is
 * correct, reports genuine findings, and is invoked by nothing. `gate:security` sat unreferenced
 * while sixty-four dependency advisories accumulated behind it. `gate:package-hygiene` sat
 * unreferenced while five dead files accumulated, two of them player-facing copy modules that had
 * been written, reviewed, and imported by nothing.
 *
 * A gate nobody runs is worse than no gate, because it looks like coverage. So every gate-like
 * script has to be either reachable from `fullcheck` or listed below with a reason it is not.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gates deliberately left out of the routine path. A reason, not a count: "why is this not run"
 * is the whole question, and a number lets a newly orphaned gate hide inside a total.
 */
export const STANDALONE_GATES: Record<string, string> = {
    'audit:dungeon-topology:json': 'Prints topology as JSON for a human to read; not a pass/fail check.',
    'audit:dungeon-topology:stress':
        'The 250-floor, 64-seed stress variant. fullcheck runs the release-scale sweep; this one is for a release candidate.',
    'audit:unused-exports':
        'Reports types exported as API and helpers only tests import. Zeroing it would mean deleting exports tests need, so it stays advisory rather than a permanently red light.',
    'audit:copy-locality':
        'A command-line view of a check that already runs as src/shared/copy-locality.test.ts, which the full test run covers.',
    'gate:asset-rendering':
        'Selects the asset test files plus audit:renderer-assets; fullcheck runs that audit directly and the tests with everything else.',
    'gate:changed': 'Selects gates by what a branch touched; it is the selector, not a gate.',
    'gate:long-run':
        'Its 1000-floor sim is gate:sim-health and its balance bounds are gate:balance-depth, both of which fullcheck runs; this bundles them for a release candidate.',
    'gate:long-run-ui-feedback': 'Drives Playwright, so it needs a dev server and a browser rather than a plain checkout.',
    'gate:readability-long-run': 'Test selector plus gate:long-run, both covered above.',
    'gate:sim-softlock-stress':
        'The 250-floor, 64-seed stress variant of gate:sim-softlock-seeds, which fullcheck already runs at release scale.',
    'gate:softlock-full':
        'The multi-hour stress variant of gate:sim-softlock-seeds, which fullcheck already runs at release scale.',
    'test:e2e:startup': 'Needs a dev server and a browser; run before packaging rather than on every change.'
};

/**
 * A gate whose whole body is `vitest run <files>` and typechecks adds no coverage the routine path
 * does not already have: `yarn test` runs every test file with no filter, and `verify` runs both.
 * Such a gate is a fast way to run one slice by hand, so it is covered rather than orphaned — and
 * recognising that by shape means the list above does not have to name each one and go stale.
 */
export const isCoveredByTheFullTestRun = (body: string): boolean => {
    const remaining = body
        .split('&&')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .filter((part) => !/^yarn typecheck(:\w+)?$/u.test(part))
        .filter((part) => !/^yarn vitest run [\w@./\- ]+$/u.test(part));
    return remaining.length === 0;
};

/** Scripts that select and run other scripts rather than checking anything themselves. */
const isGateLike = (name: string): boolean =>
    name.startsWith('gate:') || name.startsWith('audit:') || name.endsWith(':check');

export const readScripts = (packageJsonPath = join(process.cwd(), 'package.json')): Record<string, string> =>
    JSON.parse(readFileSync(packageJsonPath, 'utf8')).scripts ?? {};

/**
 * Every script `fullcheck` reaches, directly or through another script. Walks transitively, because
 * a gate two composites deep is still run.
 */
export const reachableFrom = (scripts: Record<string, string>, root: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [root];
    while (queue.length > 0) {
        const name = queue.shift();
        if (name === undefined || seen.has(name)) {
            continue;
        }
        seen.add(name);
        const body = scripts[name] ?? '';
        for (const candidate of Object.keys(scripts)) {
            if (candidate !== name && new RegExp(`yarn ${candidate.replace(/[:*+?^${}()|[\]\\]/gu, '\\$&')}\\b`).test(body)) {
                queue.push(candidate);
            }
        }
    }
    return seen;
};

export const findUnrunGates = (scripts: Record<string, string>, root = 'fullcheck'): string[] => {
    const reachable = reachableFrom(scripts, root);
    return Object.keys(scripts)
        .filter(isGateLike)
        .filter(
            (name) =>
                !reachable.has(name) &&
                !(name in STANDALONE_GATES) &&
                !isCoveredByTheFullTestRun(scripts[name] ?? '')
        )
        .sort();
};

const main = (): void => {
    const scripts = readScripts();
    const unrun = findUnrunGates(scripts);

    for (const name of unrun) {
        process.stdout.write(`gate not reachable from fullcheck: ${name}\n`);
    }
    const gateCount = Object.keys(scripts).filter(isGateLike).length;
    process.stdout.write(
        `\n${gateCount} gate-like scripts, ${unrun.length} unreachable, ` +
            `${Object.keys(STANDALONE_GATES).length} standalone by declaration\n`
    );
    if (unrun.length > 0) {
        process.stdout.write('Add it to a composite gate, or list it in STANDALONE_GATES with a reason.\n');
        process.exitCode = 1;
    }
};

if (process.argv[1]?.includes('gate-reachability')) {
    main();
}
