/**
 * The translation catalogs (docs/LOCALIZATION_PLAN.md).
 *
 *   yarn i18n:extract   rewrite src/locales/en.json: every key the `tr` calls in src/ use
 *   yarn i18n:check     fail on a key a shipping catalog lacks, a placeholder it drops or invents,
 *                       or a stale key no call uses any more
 *
 * Keys come from the source by syntax: `` tr`...${x}...` `` gives `...{0}...`, `tr.s('...')` gives
 * its string, and `plural(n, { one, other })` gives `other#<category>` for every plural category the
 * target language has (`{0} pairs#few` in Russian).
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { SHIPPING_LOCALES, templateKey } from '../src/shared/i18n';

const ROOT = process.cwd();
const LOCALES_DIR = join(ROOT, 'src', 'locales');

/** Names and marks that read the same in every language. */
export const SAME_IN_EVERY_LANGUAGE = new Set(['Memory Dungeon', 'OK', 'Steam', 'Steam Cloud', 'Android', 'Electron', 'Codex']);

export interface ExtractedKeys {
    readonly keys: Map<string, string[]>;
    readonly plurals: Map<string, { one: string; other: string }>;
}

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            return sourceFiles(full);
        }
        return /\.(?:ts|tsx)$/u.test(name) && !/\.(?:test|spec)\.tsx?$/u.test(name) && !name.endsWith('.d.ts') ? [full] : [];
    });

const isTr = (node: ts.Expression): boolean => ts.isIdentifier(node) && node.text === 'tr';
const isTrS = (node: ts.Expression): boolean =>
    ts.isPropertyAccessExpression(node) && isTr(node.expression) && node.name.text === 's';

const literalText = (node: ts.Node | undefined): string | null =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

export const extractKeys = (files: readonly string[] = sourceFiles(join(ROOT, 'src'))): ExtractedKeys => {
    const keys = new Map<string, string[]>();
    const plurals = new Map<string, { one: string; other: string }>();
    const add = (key: string, where: string): void => {
        keys.set(key, [...(keys.get(key) ?? []), where]);
    };
    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        if (!/\btr\b|\bplural\(/u.test(source)) {
            continue;
        }
        const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const rel = relative(ROOT, file).split('\\').join('/');
        const visit = (node: ts.Node): void => {
            const where = `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
            if (ts.isTaggedTemplateExpression(node) && isTr(node.tag)) {
                const template = node.template;
                const parts = ts.isNoSubstitutionTemplateLiteral(template)
                    ? [template.text]
                    : [template.head.text, ...template.templateSpans.map((span) => span.literal.text)];
                add(templateKey(parts), where);
            } else if (ts.isCallExpression(node) && isTrS(node.expression)) {
                const text = literalText(node.arguments[0]);
                if (text !== null) {
                    add(text, where);
                }
            } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'plural') {
                const forms = node.arguments[1];
                if (forms && ts.isObjectLiteralExpression(forms)) {
                    const read = (name: string): string | null => {
                        const prop = forms.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name);
                        return prop && ts.isPropertyAssignment(prop) ? literalText(prop.initializer) : null;
                    };
                    const one = read('one');
                    const other = read('other');
                    if (one !== null && other !== null) {
                        plurals.set(other, { one, other });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return { keys, plurals };
};

/** Every key a locale's catalog must hold: the plain keys plus `other#category` per plural. */
export const requiredKeysFor = (locale: string, extracted: ExtractedKeys): string[] => {
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    const pluralKeys = [...extracted.plurals.keys()].flatMap((other) => categories.map((category) => `${other}#${category}`));
    return [...extracted.keys.keys(), ...pluralKeys].sort();
};

export const placeholders = (text: string): string => (text.match(/\{\d+\}/gu) ?? []).sort().join(',');

const readCatalog = (locale: string): Record<string, string> | null => {
    const path = join(LOCALES_DIR, `${locale}.json`);
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>) : null;
};

const sortedJson = (record: Record<string, string>): string =>
    `${JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 2)}\n`;

export const checkCatalogs = (extracted: ExtractedKeys): string[] => {
    const problems: string[] = [];
    for (const locale of SHIPPING_LOCALES) {
        if (locale === 'en') {
            continue;
        }
        const catalog = readCatalog(locale);
        if (!catalog) {
            problems.push(`${locale}: no catalog at src/locales/${locale}.json`);
            continue;
        }
        const required = new Set(requiredKeysFor(locale, extracted));
        for (const key of required) {
            const value = catalog[key];
            const english = key.includes('#') ? key.slice(0, key.lastIndexOf('#')) : key;
            if (value === undefined || value.trim() === '') {
                problems.push(`${locale}: missing ${JSON.stringify(key)}`);
            } else if (placeholders(value) !== placeholders(english)) {
                problems.push(`${locale}: placeholders differ in ${JSON.stringify(key)} -> ${JSON.stringify(value)}`);
            }
        }
        for (const key of Object.keys(catalog)) {
            if (!required.has(key)) {
                problems.push(`${locale}: stale key ${JSON.stringify(key)}`);
            }
        }
    }
    return problems;
};

const main = (): void => {
    const mode = process.argv[2];
    const extracted = extractKeys();
    if (mode === 'extract') {
        const english: Record<string, string> = {};
        for (const key of requiredKeysFor('en', extracted)) {
            english[key] = key;
        }
        writeFileSync(join(LOCALES_DIR, 'en.json'), sortedJson(english));
        console.log(`src/locales/en.json: ${extracted.keys.size} keys, ${extracted.plurals.size} plurals`);
        return;
    }
    if (mode === 'prune') {
        // Drop stale keys from every catalog after copy changed; missing ones still need translating.
        for (const locale of SHIPPING_LOCALES) {
            const catalog = locale === 'en' ? null : readCatalog(locale);
            if (!catalog) {
                continue;
            }
            const required = new Set(requiredKeysFor(locale, extracted));
            writeFileSync(join(LOCALES_DIR, `${locale}.json`), sortedJson(Object.fromEntries(Object.entries(catalog).filter(([key]) => required.has(key)))));
        }
        return;
    }
    const problems = checkCatalogs(extracted);
    const english = readCatalog('en') ?? {};
    const expected = requiredKeysFor('en', extracted);
    if (expected.length !== Object.keys(english).length || expected.some((key) => !(key in english))) {
        problems.unshift('src/locales/en.json is stale: run yarn i18n:extract');
    }
    for (const problem of problems.slice(0, 40)) {
        console.error(problem);
    }
    if (problems.length > 0) {
        console.error(`i18n:check: ${problems.length} problem(s)`);
        process.exit(1);
    }
    console.log(`i18n:check: ${expected.length} keys complete in ${SHIPPING_LOCALES.length - 1} languages`);
};

if (process.argv[1] && /i18n-catalog\.ts$/u.test(process.argv[1])) {
    main();
}
