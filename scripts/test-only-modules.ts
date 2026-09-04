/**
 * Finds modules whose only importer is their own test.
 *
 * This is the quiet end of the same failure the other reachability audits chase: not code that is
 * broken, but code nobody can reach. `run-mode-discovery.ts` held three exported functions and
 * real player-facing prose — locked reasons, result counts, page hints — imported by nothing but
 * `run-mode-discovery.test.ts`. Every test passed. Package hygiene did not flag it either, because
 * a test file is an importer as far as an unused-file check is concerned.
 *
 * So a module is reported when every file that imports it is a test for that same module. A module
 * imported by some *other* module's test is a shared fixture and stays quiet; a module imported by
 * nothing at all is package hygiene's job, not this one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

/**
 * Modules that are meant to have no runtime importer: contract tables, coverage matrices and
 * readiness records that exist so a claim about the game can be checked, not so the game can call
 * them. Their test *is* the consumer. Named with the reason, because "why is this unreachable" is
 * the whole question.
 */
export const TEST_ONLY_EXEMPTIONS: Record<string, string> = {
    'assetDropInReadiness.ts': 'Asset pipeline readiness record: what each art category accepts and who owns it.',
    'difficulty-profile.ts': 'The shipped tuning profile written down so a change to the curve has to change this too.',
    'dungeon-combinatoric-matrix.ts': 'QA coverage matrix: which dungeon combinations are covered, excluded or future.',
    'dungeon-versioning.ts': 'Rules-change taxonomy that says which edits must bump the rules version.',
    'dungeonAudioEventCoverage.ts': 'Audio coverage table pairing every dungeon event with its cue and duck.',
    'gameplay-interaction-graph.ts': 'Validates the interaction graph JSON against the feedback facts; a check, not a caller.',
    'illustrationManifest.ts': 'Manifest of authored and baked illustrations, checked against what is on disk.',
    'illustrationRegressionPairKeys.ts': 'Dev-only list kept in sync with the e2e illustration fixture.',
    'localization-readiness.ts': 'Localization readiness record: what is source English, deferred or excluded.',
    'main-menu-hub-quality.ts': 'Hub quality contract: the four things the main menu must answer.',
    'regPhase5Hardening.ts': 'REG phase contract tokens; the record of what that phase closed.',
    'regPhase6Closure.ts': 'REG phase contract tokens; the record of what that phase closed.',
    'regPhase7Ship.ts': 'REG phase contract tokens; the record of what that phase closed.'
};

/**
 * Debt, not design: each of these was built to be used and then lost its caller, usually in a UI
 * rebuild. Listed by name so the audit passes on today's repo and fails the moment a *new* module
 * joins them. Reconnect or delete them, then delete the line.
 */
export const TEST_ONLY_BASELINE: Record<string, string> = {
    'dungeon-e2e-fixtures.ts': 'Ten authored dungeon fixtures; no e2e spec loads them any more.',
    'gameplayEventAnnouncement.ts': 'Announcement presentation for gameplay events, including its dedupe key.',
    'runPayoffSignals.ts': 'End-of-run payoff signals with their arcade and audio cues.'
};

/** Where a module may be reported from. */
const SOURCE_ROOTS = ['src'] as const;

/**
 * Where an importer may live. Scripts and e2e specs are real consumers: the release checklist is
 * read by `scripts/release-checklist.ts`, and leaving these out reported it as unused.
 */
const IMPORTER_ROOTS = ['src', 'scripts', 'e2e'] as const;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (/\.(ts|tsx)$/u.test(path) && !/\.d\.ts$/u.test(path)) {
            out.push(path);
        }
    }
    return out;
};

const isTestFile = (path: string): boolean => /\.(test|spec)\.tsx?$/u.test(path);

/**
 * `./foo`, `../bar/baz` — relative specifiers only; a package name is not a file in this repo.
 *
 * Matching the bare `from '...'` rather than a whole import statement is deliberate: an import
 * clause spans lines whenever it names more than a couple of bindings, and an anchored
 * statement-shaped pattern silently skipped every one of them. That reported FloorClearDialog and
 * the crash reporter as test-only when GameScreen and the main process import both.
 */
export const readRelativeImports = (source: string): string[] => [
    ...source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/gu),
    ...source.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gu),
    ...source.matchAll(/(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/gu)
].map((match) => match[1] ?? '');

/** A specifier resolves to whichever of these exists; extensionless and index forms included. */
const candidatePaths = (fromFile: string, specifier: string): string[] => {
    const base = resolve(fromFile, '..', specifier);
    return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
};

/** The module a test file is the test *for*: `foo.test.ts` tests `foo.ts`. */
const moduleUnderTest = (testFile: string): string =>
    testFile.replace(/\.(test|spec)(\.tsx?)$/u, '$2');

export interface TestOnlyModule {
    readonly file: string;
    readonly importers: readonly string[];
}

export const findTestOnlyModules = (
    files: readonly string[],
    importerFiles: readonly string[] = files
): TestOnlyModule[] => {
    const known = new Set(files.map((file) => resolve(file)));
    const importers = new Map<string, string[]>();

    for (const file of importerFiles) {
        const source = readFileSync(file, 'utf8');
        for (const specifier of readRelativeImports(source)) {
            const target = candidatePaths(file, specifier).find((candidate) => known.has(resolve(candidate)));
            if (!target) {
                continue;
            }
            const key = resolve(target);
            importers.set(key, [...(importers.get(key) ?? []), resolve(file)]);
        }
    }

    return files
        .filter((file) => !isTestFile(file))
        .map((file) => ({ file, importers: importers.get(resolve(file)) ?? [] }))
        .filter(({ file, importers: from }) => {
            if (from.length === 0) {
                return false; // Nothing imports it at all: that is package hygiene's finding.
            }
            const ownTest = resolve(moduleUnderTest(file));
            return from.every((importer) => isTestFile(importer) && resolve(moduleUnderTest(importer)) === ownTest);
        })
        .filter(({ file }) => TEST_ONLY_EXEMPTIONS[basename(file)] === undefined);
};

const main = (): void => {
    const files = SOURCE_ROOTS.flatMap((root) => walk(root));
    const importerFiles = IMPORTER_ROOTS.flatMap((root) => walk(root));
    const found = findTestOnlyModules(files, importerFiles);
    const fresh = found.filter(({ file }) => TEST_ONLY_BASELINE[basename(file)] === undefined);
    const known = found.filter(({ file }) => TEST_ONLY_BASELINE[basename(file)] !== undefined);

    for (const { file, importers } of fresh) {
        console.log(
            `module imported only by its own test: ${relative('.', file)} (${importers
                .map((importer) => relative('.', importer))
                .join(', ')})`
        );
    }
    for (const { file } of known) {
        console.log(`known, still disconnected: ${relative('.', file)} — ${TEST_ONLY_BASELINE[basename(file)]}`);
    }

    const stale = Object.keys(TEST_ONLY_BASELINE).filter(
        (name) => !found.some(({ file }) => basename(file) === name)
    );
    for (const name of stale) {
        console.log(`baseline entry no longer applies, delete the line: ${name}`);
    }

    console.log(
        `\n${files.length} source files, ${found.length} imported only by their own test ` +
            `(${known.length} known debt, ${fresh.length} new), ${Object.keys(TEST_ONLY_EXEMPTIONS).length} exempt by name`
    );
    if (fresh.length > 0 || stale.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/test-only-modules.ts'))) {
    main();
}
