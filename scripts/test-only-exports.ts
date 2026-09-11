/**
 * Finds exports nothing but their own test can reach. Run: yarn audit:test-only-exports
 *
 * `test-only-modules.ts` asks the same question one level up - whose only importer is its own test -
 * and it has held at zero for a long time. That is not the same as the repository having no
 * unreachable code, because a module can be perfectly reachable and still carry an export that
 * nobody but its test has ever called. Gen 213 tripped over one: `createInventoryScreenModel`
 * assembles eleven projections for the Inventory screen - economy rows, prep rows, loadout summary,
 * perfect-memory attribution, two reward signals - and the Inventory screen imports two unrelated
 * helpers from the same file and nothing else. Every test passed. The module audit could not see it
 * (the module IS imported), knip could not see it (a test file is a consumer), and the export sat
 * there being maintained.
 *
 * So the rule is the module rule, lifted to a symbol: an export is reported when every file that
 * imports it is that module's own test, AND the module itself does not use it. Both halves matter.
 * A helper a test imports and the module also calls is over-exported, not unreachable, and this is
 * a gate rather than a style checker. A symbol some *other* module's test imports is a shared
 * fixture and stays quiet, exactly as it does for modules.
 *
 * What this cannot see, by construction: a symbol reached through `import * as`, which consumes
 * every export at once. Those modules are listed in the summary rather than silently skipped.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import baseline from './test-only-exports-baseline.json';
import { readRelativeImports } from './test-only-modules';

/**
 * Exports meant to have no runtime caller: a record whose test IS the consumer, checked so a claim
 * about the game has to change when the game does. Named with the reason, because "why is this
 * unreachable" is the whole question - the same contract the module audit's exemptions keep.
 */
export const TEST_ONLY_EXPORT_EXEMPTIONS: Record<string, string> = {};

/**
 * What the audit found the day it was written, as `path name` lines in a sibling JSON file.
 *
 * 152 of them, which is the finding rather than an embarrassment to hide: this repository holds a
 * lot of records whose test is their consumer by design, and a lot of read models that lost their
 * caller in a rebuild, and nothing has ever told the two apart. Working the list down means
 * deciding, one at a time, which a symbol is - and the honest thing to do first is to stop the list
 * growing. So the audit passes on a known line, fails on a new one, and fails on a stale one too,
 * which is what makes it a ratchet rather than a list of excuses.
 */
export const TEST_ONLY_EXPORT_BASELINE: ReadonlySet<string> = new Set(baseline.entries);

const SOURCE_ROOTS = ['src'] as const;
const IMPORTER_ROOTS = ['src', 'scripts', 'e2e'] as const;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (/\.(ts|tsx)$/u.test(path) && !/\.d\.ts$/u.test(path)) out.push(path);
    }
    return out;
};

const isTestFile = (path: string): boolean => /\.(test|spec)\.tsx?$/u.test(path);

/** The module a test file is the test *for*: `foo.test.ts` tests `foo.ts`. */
const moduleUnderTest = (testFile: string): string => testFile.replace(/\.(test|spec)(\.tsx?)$/u, '$2');

/** Comments are not uses; a sentence naming a symbol is a record of it, not a call. */
export const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');

/**
 * Every name a module exports. Type-only exports are included: an interface nothing outside the
 * module names is the same finding with no runtime weight.
 */
export const readExportedNames = (source: string): string[] => {
    const text = stripComments(source);
    const names = new Set<string>();
    for (const match of text.matchAll(
        /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|enum|type)\s+([A-Za-z_$][\w$]*)/gu
    )) {
        names.add(match[1]!);
    }
    // `export { a, b as c }` - the exported name is what a consumer writes, so take the alias.
    // `export type { ... }` counts as well; leaving the optional `type` out of the pattern skipped
    // every type-only re-export in the repository.
    for (const match of text.matchAll(/\bexport\s+type\s*\{([^}]*)\}|\bexport\s*\{([^}]*)\}/gu)) {
        for (const clause of (match[1] ?? match[2] ?? '').split(',')) {
            const parts = clause.trim().split(/\s+as\s+/u);
            const exported = (parts[1] ?? parts[0] ?? '').trim().replace(/^type\s+/u, '');
            if (/^[A-Za-z_$][\w$]*$/u.test(exported) && exported !== 'default') names.add(exported);
        }
    }
    return [...names];
};

/** The bindings an import clause pulls in, and whether it took the whole namespace. */
export const readImportedNames = (clause: string): { names: string[]; namespace: boolean } => {
    if (/^\s*\*\s+as\s/u.test(clause)) return { names: [], namespace: true };
    const names: string[] = [];
    const braced = /\{([^}]*)\}/u.exec(clause);
    if (braced) {
        for (const entry of braced[1]!.split(',')) {
            const local = entry.trim().replace(/^type\s+/u, '').split(/\s+as\s+/u)[0]?.trim() ?? '';
            if (/^[A-Za-z_$][\w$]*$/u.test(local)) names.push(local);
        }
    }
    return { names, namespace: false };
};

const candidatePaths = (fromFile: string, specifier: string): string[] => {
    const base = resolve(fromFile, '..', specifier);
    return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
};

/** Which named bindings each importer takes from each relative target, and from whom. */
const readImportEdges = (
    file: string,
    source: string,
    known: ReadonlySet<string>
): { target: string; names: string[]; namespace: boolean }[] => {
    const edges: { target: string; names: string[]; namespace: boolean }[] = [];
    const text = stripComments(source);
    /*
     * The clause charset deliberately excludes quotes and semicolons. Written as `[\s\S]*?` it
     * matched lazily from the first `import` in the file and, finding no relative specifier there,
     * expanded straight through the intervening statements - so a file that imports `node:fs`
     * before it imports a module of ours had its bindings read off the wrong statement, and
     * `buildMechanicsCatalogAppendixMarkdown` was reported as reached only by its test while
     * `scripts/run-mechanics-appendix.ts` calls it on every docs regeneration.
     */
    for (const match of text.matchAll(/\bimport\s+((?:type\s+)?[\w$*{},\s]*?)\s+from\s*['"](\.[^'"]+)['"]/gu)) {
        const target = candidatePaths(file, match[2]!).find((candidate) => known.has(resolve(candidate)));
        if (!target) continue;
        edges.push({ target: resolve(target), ...readImportedNames(match[1]!) });
    }
    // A bare `import './x'` and a dynamic `import('./x')` take no names but are still importers.
    for (const specifier of readRelativeImports(source)) {
        const target = candidatePaths(file, specifier).find((candidate) => known.has(resolve(candidate)));
        if (target && !edges.some((edge) => edge.target === resolve(target))) {
            edges.push({ target: resolve(target), names: [], namespace: false });
        }
    }
    return edges;
};

/** Does the module use the name itself, anywhere but the line that declares it exported? */
export const usedInOwnModule = (source: string, name: string): boolean => {
    const text = stripComments(source);
    const uses = [...text.matchAll(new RegExp(`\\b${name.replace(/\$/gu, '\\$')}\\b`, 'gu'))];
    const declarations = [
        ...text.matchAll(
            new RegExp(
                `\\bexport\\s+(?:declare\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class|interface|enum|type)\\s+${name.replace(/\$/gu, '\\$')}\\b`,
                'gu'
            )
        )
    ];
    /*
     * The declaration itself contributes one occurrence of the name, and `declarations` counts
     * exactly those, so anything above that count is a real use. Writing `+ 1` here reported
     * `dealTilesInClumps` and `suitCountForPairs` as unreachable while their own module calls both.
     */
    return uses.length > declarations.length;
};

export interface TestOnlyExport {
    readonly file: string;
    readonly name: string;
    readonly importers: readonly string[];
}

export const findTestOnlyExports = (
    files: readonly string[],
    importerFiles: readonly string[] = files,
    readSource: (file: string) => string = (file) => readFileSync(file, 'utf8')
): { found: TestOnlyExport[]; namespaceImported: string[] } => {
    const known = new Set(files.map((file) => resolve(file)));
    const sources = new Map(files.map((file) => [resolve(file), readSource(file)]));
    /** module -> export name -> the files that import it by name. */
    const consumers = new Map<string, Map<string, string[]>>();
    const namespaceImported = new Set<string>();

    for (const file of importerFiles) {
        const source = sources.get(resolve(file)) ?? readSource(file);
        for (const edge of readImportEdges(file, source, known)) {
            if (edge.namespace) {
                namespaceImported.add(edge.target);
                continue;
            }
            const byName = consumers.get(edge.target) ?? new Map<string, string[]>();
            for (const name of edge.names) {
                byName.set(name, [...(byName.get(name) ?? []), resolve(file)]);
            }
            consumers.set(edge.target, byName);
        }
    }

    const found: TestOnlyExport[] = [];
    for (const file of files) {
        if (isTestFile(file)) continue;
        const key = resolve(file);
        if (namespaceImported.has(key)) continue;
        const source = sources.get(key) ?? readSource(file);
        const byName = consumers.get(key) ?? new Map<string, string[]>();
        const ownTest = resolve(moduleUnderTest(file));
        for (const name of readExportedNames(source)) {
            if (TEST_ONLY_EXPORT_EXEMPTIONS[name] !== undefined) continue;
            const importers = byName.get(name) ?? [];
            // Nothing imports it at all: that is knip's finding, not this one.
            if (importers.length === 0) continue;
            const onlyOwnTest = importers.every(
                (importer) => isTestFile(importer) && resolve(moduleUnderTest(importer)) === ownTest
            );
            if (onlyOwnTest && !usedInOwnModule(source, name)) {
                found.push({ file, name, importers });
            }
        }
    }
    return { found, namespaceImported: [...namespaceImported] };
};

const main = (): void => {
    const files = SOURCE_ROOTS.flatMap((root) => walk(root));
    const importerFiles = IMPORTER_ROOTS.flatMap((root) => walk(root));
    const { found, namespaceImported } = findTestOnlyExports(files, importerFiles);
    const key = ({ file, name }: TestOnlyExport): string => `${relative('.', file)} ${name}`;
    const fresh = found.filter((entry) => !TEST_ONLY_EXPORT_BASELINE.has(key(entry)));
    const stale = [...TEST_ONLY_EXPORT_BASELINE].filter(
        (entry) => !found.some((candidate) => key(candidate) === entry)
    );

    for (const entry of fresh) {
        console.log(
            `export reached only by its own test: ${key(entry)} (${entry.importers
                .map((importer) => relative('.', importer))
                .join(', ')})`
        );
    }
    for (const entry of stale) {
        console.log(`baseline entry no longer applies, delete the line: ${entry}`);
    }
    console.log(
        `\n${files.length} source files, ${found.length} export(s) reached only by their own test ` +
            `(${found.length - fresh.length} known debt, ${fresh.length} new), ` +
            `${namespaceImported.length} module(s) skipped for a namespace import, ` +
            `${Object.keys(TEST_ONLY_EXPORT_EXEMPTIONS).length} exempt by name`
    );
    if (fresh.length > 0 || stale.length > 0) {
        console.log(
            '\nEither the export has a caller it lost - reconnect it - or it is dead and should go ' +
                'with whatever it orphans. A baseline line comes out when the symbol does.'
        );
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/test-only-exports.ts'))) {
    main();
}
