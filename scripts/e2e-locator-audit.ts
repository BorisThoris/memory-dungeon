/**
 * Finds e2e locators that point at elements the app no longer renders.
 *
 * The end-to-end suite is not in the routine check — it needs a browser and a dev server — so it
 * rots quietly. Three separate dead locators turned up in one file recently, each hidden behind the
 * one before it, and the HUD rebuild left specs reaching for panels that had been deleted. A spec
 * driving something that does not exist does not fail loudly: it waits for the element until the
 * test times out, which reads like slowness rather than breakage.
 *
 * This catches the checkable half without launching anything. Test ids are exact strings, so a spec
 * naming one the renderer never writes is wrong with no judgement required. Accessible names are
 * deliberately out of scope: they are composed at runtime from copy modules and run state, and a
 * check that guesses at them would cry wolf often enough to get switched off.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Locators known to be dead and not yet repaired. The number fails on growth rather than on the
 * debt itself: a gate that cannot pass is a gate nobody runs, which is how this rot started.
 */
export const DEAD_E2E_LOCATOR_BASELINE = 18;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (/\.tsx?$/u.test(path)) {
            out.push(path);
        }
    }
    return out;
};

export interface RenderedTestIds {
    /** Ids written as plain strings. */
    readonly literals: Set<string>;
    /** Prefixes of ids built from a template, e.g. `side-room-choice-${choice.id}`. */
    readonly prefixes: string[];
}

export const readRenderedTestIds = (sources: readonly string[]): RenderedTestIds => {
    const literals = new Set<string>();
    const prefixes: string[] = [];
    for (const source of sources) {
        for (const match of source.matchAll(/(?:data-testid|testId)\s*=\s*(?:\{\s*)?['"]([^'"]+)['"]/gu)) {
            literals.add(match[1] ?? '');
        }
        for (const match of source.matchAll(/(?:data-testid|testId)\s*=\s*\{\s*`([^`$]*)\$\{/gu)) {
            prefixes.push(match[1] ?? '');
        }
    }
    return { literals, prefixes };
};

export const readSpecTestIds = (source: string): string[] => [
    ...[...source.matchAll(/getByTestId\(\s*['"]([^'"]+)['"]/gu)].map((match) => match[1] ?? ''),
    ...[...source.matchAll(/\[data-testid=["']([^"']+)["']\]/gu)].map((match) => match[1] ?? '')
];

export const findDeadTestIds = (specIds: readonly string[], rendered: RenderedTestIds): string[] =>
    specIds.filter(
        (id) =>
            !rendered.literals.has(id) &&
            !rendered.prefixes.some((prefix) => prefix.length > 0 && id.startsWith(prefix))
    );

const main = (): void => {
    const rendered = readRenderedTestIds(
        walk(join(process.cwd(), 'src'))
            .filter((path) => !/\.test\./u.test(path))
            .map((path) => readFileSync(path, 'utf8'))
    );
    const dead: { file: string; id: string }[] = [];
    for (const path of walk(join(process.cwd(), 'e2e'))) {
        for (const id of findDeadTestIds(readSpecTestIds(readFileSync(path, 'utf8')), rendered)) {
            dead.push({ file: path.slice(process.cwd().length + 1), id });
        }
    }

    for (const row of dead) {
        process.stdout.write(`e2e locator names a test id nothing renders: ${row.file}: ${row.id}\n`);
    }
    process.stdout.write(
        `\n${dead.length} dead e2e test-id locators (baseline ${DEAD_E2E_LOCATOR_BASELINE})\n`
    );
    if (dead.length > DEAD_E2E_LOCATOR_BASELINE) {
        process.stdout.write('A spec pointing at a missing element times out rather than failing; fix or delete it.\n');
        process.exitCode = 1;
    }
};

if (process.argv[1]?.includes('e2e-locator-audit')) {
    main();
}
