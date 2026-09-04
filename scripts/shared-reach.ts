/**
 * Finds shared systems no shipping entry point can reach.
 *
 * `daily-archive.ts` and `quest-campaign.ts` were live systems — streaks, weekly and season keys,
 * campaign steps, all written to the save on every run — and no screen rendered either. They did
 * not look orphaned: a shared module imported both. That module was itself imported only by its
 * own test, so the whole branch hung off nothing, one level further out than the per-module audit
 * could see.
 *
 * So this walks the import graph from what actually ships — the renderer entry, the Electron main
 * and preload — and reports every `src/shared` module the walk never arrives at. A module reached
 * only by a test, a script or an e2e spec is not reached by the game.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

/** What ships. A module reachable from one of these is reachable by a player. */
const SHIPPING_ENTRY_POINTS = ['src/renderer/main.tsx', 'src/main/index.ts', 'src/preload/index.ts'] as const;

/**
 * Shared modules that are meant to have no runtime reader. Three kinds, all legitimate: things a
 * gate or simulation runs, things a build or a script reads, and records that exist so a claim
 * about the game can be checked. Named with the reason, because "why is this unreachable" is the
 * whole question.
 */
export const SHARED_REACH_EXEMPTIONS: Record<string, string> = {
    // Simulations and solvers: gate:sim-health, gate:balance-depth and friends run these.
    'balance-simulation.ts': 'Balance sweep run by the simulation gates, not by a run.',
    'board-generation.ts': 'Re-export barrel over board-build-rules, board-tile-generation-rules and board-inspection; the simulations import it, the game imports those three directly, and it is the same code either way.',
    'build-strategy-playthrough-simulation.ts': 'Build-strategy playthrough sweep for the balance gates.',
    'build-strategy-simulation.ts': 'Build-strategy sweep for the balance gates.',
    'economy-ledger.ts': 'Economy accounting the long-run depth sweep checks.',
    'gameplay-core-playthrough-solver.ts': 'Solver used by the core-replay gate.',
    'gameplay-core-simulation.ts': 'Core simulation used by the core-replay gate.',
    'gameplay-feedback-completeness.ts': 'Completeness check the simulations run over feedback coverage.',
    'long-run-depth.ts': 'Long-run depth sweep for the balance gates.',
    'playthrough-solver-rules.ts': 'Solver rules for the playthrough gates.',
    'playthrough-solver.ts': 'Playthrough solver for the gates.',
    'softlock-generator-contract.ts': 'Softlock seed contract the softlock gate enforces.',

    // Build and script inputs.
    'blueprintAstPoc.ts': 'The dev-only AST round-trip target named in scripts/ast-allowlist.json and read by the Vite dev endpoint; referenced from JSON, so no import edge reaches it.',
    'blueprintGlossaryGen.ts': 'Generated glossary read by the docs generator.',
    'content-security-policy.ts': 'Read by vite.config.mts at build time to stamp the policy into index.html.',
    'dungeon-topology.ts': 'Topology model the dungeon-topology audit script walks.',
    'mechanics-catalog-appendix-builder.ts': 'Builds the mechanics appendix for the docs generator.',
    'release-checklist.ts': 'Read by the release-checklist script and its gate.',
    'steam-rich-presence-tokens.ts': 'Token text the Steam Partner-site generator emits; the game sets presence through rich-presence.ts.',

    // Records and contract tables whose consumer is a test.
    'color-vision.ts': 'Colour-distance maths the palette tests check the shipped palette against.',
    'copy-tone.ts': 'Tone rules the copy tests hold the shipped strings to.',
    'difficulty-profile.ts': 'The shipped tuning profile written down so a change to the curve has to change this too.',
    'dungeon-combinatoric-matrix.ts': 'QA coverage matrix: which dungeon combinations are covered, excluded or future.',
    'dungeon-save-migration.ts': 'Field policy table saying which save fields need a migration when they change; the save tests hold the schema to it. Not a migration routine, so nothing calls it at load.',
    'dungeon-versioning.ts': 'Rules-change taxonomy that says which edits must bump the rules version.',
    'gameplay-interaction-graph.ts': 'Validates the interaction graph JSON against the feedback facts.',
    'localization-readiness.ts': 'Localization readiness record: what is source English, deferred or excluded.',
    'main-menu-hub-quality.ts': 'Hub quality contract: the four things the main menu must answer.',
    'power-verbs.ts': 'Verb vocabulary the copy contracts hold power names to.',
    'regPhase5Hardening.ts': 'REG phase contract tokens; the record of what that phase closed.',
    'regPhase6Closure.ts': 'REG phase contract tokens; the record of what that phase closed.',
    'regPhase7Ship.ts': 'REG phase contract tokens; the record of what that phase closed.',
    'social-play-scope.ts': 'Scope record for what social play does and does not include offline.',

    // Test fixtures.
    'dungeon-e2e-fixtures.ts':
        'A capture plan, not fixtures: ten recipes naming a fixture id, seed, floor, selectors and screenshot filenames for the dungeon room types. The fixtures it names (dungeonEnemy, dungeonBoss, ...) were never built, so this is a record of intended coverage that does not exist.',
    'dungeon-feature-coverage.ts': 'Test-only dungeon feature coverage helper.',
    'game-fixtures.ts': 'Shared test fixtures.',
    'gameplay-event-fixtures.ts': 'Shared test fixtures for gameplay events.'
};

/**
 * Known and unreachable, and that is a problem rather than a design. The gate passes on these and
 * fails the moment a new module joins them or one of these is fixed and the line goes stale.
 */
export const SHARED_REACH_BASELINE: Record<string, string> = {};

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (/\.(ts|tsx)$/u.test(path) && !/\.d\.ts$/u.test(path) && !/\.(test|spec)\.tsx?$/u.test(path)) {
            out.push(path);
        }
    }
    return out;
};

export const readRelativeImports = (source: string): string[] => [
    ...source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/gu),
    ...source.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gu),
    ...source.matchAll(/(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/gu)
].map((match) => match[1] ?? '');

const resolveSpecifier = (fromFile: string, specifier: string, known: ReadonlySet<string>): string | null => {
    const base = resolve(fromFile, '..', specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
    return candidates.find((candidate) => known.has(resolve(candidate))) ?? null;
};

/** Every file the walk arrives at from `entries`, following relative imports only. */
export const reachableFromEntries = (
    entries: readonly string[],
    files: readonly string[],
    /** Injected so the walk can be checked without a repository on disk under it. */
    readSource: (file: string) => string = (file) => readFileSync(file, 'utf8')
): Set<string> => {
    const known = new Set(files.map((file) => resolve(file)));
    const seen = new Set<string>();
    const queue = entries.map((entry) => resolve(entry)).filter((entry) => known.has(entry));

    while (queue.length > 0) {
        const current = queue.pop();
        if (current === undefined || seen.has(current)) {
            continue;
        }
        seen.add(current);
        for (const specifier of readRelativeImports(readSource(current))) {
            const target = resolveSpecifier(current, specifier, known);
            if (target !== null && !seen.has(resolve(target))) {
                queue.push(resolve(target));
            }
        }
    }
    return seen;
};

const main = (): void => {
    const files = walk('src');
    const reached = reachableFromEntries(SHIPPING_ENTRY_POINTS, files);
    const unreachable = files
        .filter((file) => file.startsWith(join('src', 'shared')))
        .filter((file) => !reached.has(resolve(file)))
        .filter((file) => SHARED_REACH_EXEMPTIONS[basename(file)] === undefined);

    const fresh = unreachable.filter((file) => SHARED_REACH_BASELINE[basename(file)] === undefined);
    const known = unreachable.filter((file) => SHARED_REACH_BASELINE[basename(file)] !== undefined);

    for (const file of fresh) {
        console.log(`shared module no shipping entry point reaches: ${relative('.', file)}`);
    }
    for (const file of known) {
        console.log(`known, still unreachable: ${relative('.', file)} — ${SHARED_REACH_BASELINE[basename(file)]}`);
    }
    const stale = Object.keys(SHARED_REACH_BASELINE).filter(
        (name) => !unreachable.some((file) => basename(file) === name)
    );
    for (const name of stale) {
        console.log(`baseline entry no longer applies, delete the line: ${name}`);
    }

    console.log(
        `\n${files.length} source files, ${reached.size} reachable from what ships, ` +
            `${unreachable.length} shared modules unreachable (${known.length} known, ${fresh.length} new), ` +
            `${Object.keys(SHARED_REACH_EXEMPTIONS).length} exempt by name`
    );
    if (fresh.length > 0 || stale.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/shared-reach.ts'))) {
    main();
}
