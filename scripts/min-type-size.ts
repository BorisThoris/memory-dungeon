/**
 * Finds player-facing text declared below the readable floor.
 *
 * The fit contract already fails a screen whose text renders under 12px — but only for the text a
 * browser happens to walk on the day it runs, on the fixture it was given. Profile shipped two
 * declarations under the floor and the contract said nothing for weeks, because the sweep is slow
 * enough that nobody runs it and the fixture it does run leaves half the screen empty.
 *
 * A declaration is a fact in a file, so read the files. Every `font-size` in a stylesheet must
 * resolve to at least 12px, or be named below with the reason it may not — and a `var()` must name
 * a token the theme actually defines. `--ui-font-caption` was sized in three stylesheets and
 * defined in none of them, so all three lines did nothing and the text inherited its parent.
 */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The floor, in CSS px. Below this, text stops being readable at arm's length on a Deck. */
export const MIN_TYPE_PX = 12;

/** The root font size every `rem` in this project resolves against; `--ui-scale` is a zoom, not a root size. */
export const ROOT_PX = 16;

/**
 * Declarations allowed under the floor, keyed by `file:selector`, with the reason. A declaration
 * is exempt when the text it sizes is not prose a player has to read.
 */
export const MIN_TYPE_EXEMPTIONS: Record<string, string> = {};

export interface TypeDeclaration {
    file: string;
    line: number;
    /** The smallest px this can render at; null when the cascade decides, `undefined` when it names a missing token. */
    px: number | null | undefined;
    selector: string;
    value: string;
}

/**
 * The theme's type-size tokens, by name. `*-family` tokens are font stacks, not sizes, and a value
 * carrying a quote is a family list — neither is something a `font-size` can resolve to.
 */
export const readFontTokens = (themeSource: string): Record<string, string> =>
    Object.fromEntries(
        [...themeSource.matchAll(/'(--ui-(?:font|type)-[a-z-]+)':\s*(?:'([^']*)'|("[^"]*"))/gu)]
            .map((match) => [match[1] ?? '', match[2] ?? ''])
            .filter(([name, value]) => value !== '' && !name.endsWith('-family'))
    );

/** The selector a declaration sits under: the nearest preceding line ending in `{`. */
const selectorAbove = (lines: readonly string[], index: number): string => {
    for (let i = index; i >= 0; i -= 1) {
        const line = (lines[i] ?? '').trim();
        if (line.endsWith('{')) {
            return line.slice(0, -1).trim();
        }
    }
    return '(file)';
};

/**
 * The smallest px this value can render at, or null when it cannot be resolved statically.
 * `em` and `%` depend on a parent, `var()` and `calc()` on the cascade — those are reported
 * separately rather than counted as passing.
 */
export const resolveMinPx = (raw: string, tokens: Readonly<Record<string, string>> = {}): number | null | undefined => {
    const value = raw.trim().toLowerCase();
    const token = /^var\(\s*(--[a-z0-9-]+)\s*(?:,([\s\S]+))?\)$/u.exec(value);
    if (token) {
        const defined = tokens[token[1] ?? ''];
        if (defined !== undefined) {
            return resolveMinPx(defined, tokens);
        }
        // A fallback makes the missing token harmless; without one the declaration does nothing at all.
        return token[2] === undefined ? undefined : resolveMinPx(token[2], tokens);
    }
    const clamp = /^clamp\(([^,]+),/u.exec(value);
    if (clamp) {
        return resolveMinPx(clamp[1] ?? '', tokens);
    }
    const bounded = /^(min|max)\((.+)\)$/u.exec(value);
    if (bounded) {
        const parts = (bounded[2] ?? '').split(',').map((part) => resolveMinPx(part, tokens));
        const known = parts.filter((part): part is number => part !== null);
        if (known.length === 0 || known.length !== parts.length) {
            return null;
        }
        return bounded[1] === 'min' ? Math.min(...known) : Math.max(...known);
    }
    const rem = /^(\d*\.?\d+)rem$/u.exec(value);
    if (rem) {
        return Number.parseFloat(rem[1] ?? '0') * ROOT_PX;
    }
    const px = /^(\d*\.?\d+)px$/u.exec(value);
    if (px) {
        return Number.parseFloat(px[1] ?? '0');
    }
    return null;
};

export const readTypeDeclarations = (
    file: string,
    source: string,
    tokens: Readonly<Record<string, string>> = {}
): TypeDeclaration[] => {
    const lines = source.split('\n');
    const found: TypeDeclaration[] = [];
    lines.forEach((line, index) => {
        const match = /(?:^|[;{\s])font-size:\s*([^;}]+)/u.exec(line);
        if (!match) {
            return;
        }
        const value = (match[1] ?? '').trim();
        found.push({
            file,
            line: index + 1,
            px: resolveMinPx(value, tokens),
            selector: selectorAbove(lines, index),
            value
        });
    });
    return found;
};

export const isExempt = (declaration: TypeDeclaration): boolean =>
    MIN_TYPE_EXEMPTIONS[`${declaration.file}:${declaration.selector}`] !== undefined;

export const findUndersized = (declarations: readonly TypeDeclaration[]): TypeDeclaration[] =>
    declarations.filter(
        (declaration) =>
            typeof declaration.px === 'number' && declaration.px < MIN_TYPE_PX && !isExempt(declaration)
    );

/** Declarations naming a token the theme never defines: the line is inert and the size is whatever it inherited. */
export const findUndefinedTokens = (declarations: readonly TypeDeclaration[]): TypeDeclaration[] =>
    declarations.filter((declaration) => declaration.px === undefined);

const main = (): void => {
    const tokens = readFontTokens(readFileSync('src/renderer/styles/theme.ts', 'utf8'));
    const files = globSync('src/**/*.css').sort();
    const declarations = files.flatMap((file) => readTypeDeclarations(file, readFileSync(file, 'utf8'), tokens));
    const undersized = findUndersized(declarations);
    const undefinedTokens = findUndefinedTokens(declarations);
    const unresolved = declarations.filter((declaration) => declaration.px === null);

    const say = (kind: string, declaration: TypeDeclaration): void => {
        console.log(
            `${kind}: ${declaration.file}:${declaration.line} ${declaration.selector} ` +
                `font-size: ${declaration.value}` +
                (typeof declaration.px === 'number' ? ` (${declaration.px}px)` : '')
        );
    };
    for (const declaration of undersized) {
        say(`text below the ${MIN_TYPE_PX}px floor`, declaration);
    }
    for (const declaration of undefinedTokens) {
        say('font-size names a token the theme does not define', declaration);
    }
    console.log(
        `\n${declarations.length} font-size declarations across ${files.length} stylesheets, ` +
            `${Object.keys(tokens).length} sized theme tokens, ` +
            `${undersized.length} below the ${MIN_TYPE_PX}px floor, ` +
            `${undefinedTokens.length} naming an undefined token, ` +
            `${Object.keys(MIN_TYPE_EXEMPTIONS).length} exempt by name, ` +
            `${unresolved.length} left to the cascade (em, % or calc — the fit contract covers those)`
    );
    if (undersized.length > 0 || undefinedTokens.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/min-type-size.ts'))) {
    main();
}
