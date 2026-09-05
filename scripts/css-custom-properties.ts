/**
 * Finds CSS custom properties that only one side of the wire knows about.
 *
 * Two failures, both silent, both shipped:
 *
 * `--gameplay-hud-top-clearance` was measured every frame by a hook whose whole job is to stop the
 * board overlays landing on the HUD, written to the shell, and read by no stylesheet at all. And
 * `--ui-font-caption` was sized in three stylesheets and defined in none, so those three
 * declarations did nothing and the text kept whatever size it inherited.
 *
 * Neither shows up as an error anywhere: an unread property is just a string on an element, and an
 * undefined one makes its declaration invalid and the cascade carries on. So compare the two lists.
 */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Properties written with nothing reading them, by name with the reason it is fine. */
export const UNREAD_PROPERTY_EXEMPTIONS: Record<string, string> = {};

/** Properties read with nothing defining them, by name with the reason it is fine. */
export const UNDEFINED_PROPERTY_EXEMPTIONS: Record<string, string> = {
    '--ui-touch-target-min':
        'Defined by the platform stylesheet at the document root rather than by a module in this tree.'
};

export interface PropertyUse {
    readonly file: string;
    readonly line: number;
    readonly property: string;
    /** A read carrying its own fallback still renders when nothing defines the property. */
    readonly hasFallback: boolean;
    /** Written by running code rather than declared in a stylesheet or a theme map. */
    readonly runtime: boolean;
}

const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

/** Every property this file defines: a CSS declaration, a `setProperty` call, or a style-object key. */
export const readDefinedProperties = (file: string, source: string): PropertyUse[] => {
    const found: PropertyUse[] = [];
    const add = (property: string, index: number, runtime: boolean): void =>
        void found.push({ file, hasFallback: false, line: lineOf(source, index), property, runtime });

    // `--x: value` in a stylesheet, and `'--x': value` in a style object.
    for (const match of source.matchAll(/(?:^|[;{\s'"])(--[a-z0-9-]+)'?\s*:/gmu)) {
        add(match[1] ?? '', match.index ?? 0, false);
    }
    /*
     * `['--x' as string]: value` — a computed key, which is how the gameplay visual config declares
     * its properties. Missing this form made the audit's first run report two definitions it had
     * simply failed to read as undefined, so the shape of the declaration has to be matched, not
     * assumed.
     */
    for (const match of source.matchAll(/\[\s*['"`](--[a-z0-9-]+)['"`][^\]]*\]\s*:/gu)) {
        add(match[1] ?? '', match.index ?? 0, false);
    }
    // `setProperty('--x', ...)`.
    for (const match of source.matchAll(/setProperty\(\s*['"`](--[a-z0-9-]+)['"`]/gu)) {
        add(match[1] ?? '', match.index ?? 0, true);
    }
    return found;
};

/** Every property this file reads through `var()`, and whether the read carries a fallback. */
export const readVarUses = (file: string, source: string): PropertyUse[] =>
    [...source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gu)].map((match) => ({
        file,
        hasFallback: match[2] === ',',
        line: lineOf(source, match.index ?? 0),
        property: match[1] ?? '',
        runtime: false
    }));

/**
 * Runtime writes nothing reads. Only `setProperty` counts: a design token declared in the theme map
 * ahead of the screen that will use it is ordinary, but code that measures the layout every frame
 * and writes a number no rule consumes is doing work for nobody — which is exactly what the board's
 * chrome-clearance hook was doing.
 */
export const findUnreadProperties = (defined: readonly PropertyUse[], used: readonly PropertyUse[]): PropertyUse[] => {
    const readNames = new Set(used.map((use) => use.property));
    const seen = new Set<string>();
    return defined.filter((definition) => {
        if (!definition.runtime) {
            return false;
        }
        if (readNames.has(definition.property) || UNREAD_PROPERTY_EXEMPTIONS[definition.property] !== undefined) {
            return false;
        }
        if (seen.has(definition.property)) {
            return false;
        }
        seen.add(definition.property);
        return true;
    });
};

/** Reads with no fallback and no definition anywhere: the declaration is inert and the size is inherited. */
export const findUndefinedProperties = (defined: readonly PropertyUse[], used: readonly PropertyUse[]): PropertyUse[] => {
    const definedNames = new Set(defined.map((definition) => definition.property));
    return used.filter(
        (use) =>
            !use.hasFallback &&
            !definedNames.has(use.property) &&
            UNDEFINED_PROPERTY_EXEMPTIONS[use.property] === undefined
    );
};

const main = (): void => {
    const files = [...globSync('src/**/*.css'), ...globSync('src/**/*.ts'), ...globSync('src/**/*.tsx')]
        .filter((file) => !/\.test\.tsx?$/u.test(file))
        .sort();
    const defined: PropertyUse[] = [];
    const used: PropertyUse[] = [];
    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        defined.push(...readDefinedProperties(file, source));
        used.push(...readVarUses(file, source));
    }

    const unread = findUnreadProperties(defined, used);
    const undefinedReads = findUndefinedProperties(defined, used);

    for (const row of unread) {
        console.log(`written by running code and never read: ${row.property} (${row.file}:${row.line})`);
    }
    for (const row of undefinedReads) {
        console.log(`read with no fallback and never defined: ${row.property} (${row.file}:${row.line})`);
    }
    console.log(
        `\n${new Set(defined.map((d) => d.property)).size} properties defined, ` +
            `${new Set(used.map((u) => u.property)).size} read, ` +
            `${unread.length} written by running code and never read, ` +
            `${undefinedReads.length} read with no fallback and never defined, ` +
            `${Object.keys(UNREAD_PROPERTY_EXEMPTIONS).length + Object.keys(UNDEFINED_PROPERTY_EXEMPTIONS).length} exempt by name`
    );
    if (unread.length > 0 || undefinedReads.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/css-custom-properties.ts'))) {
    main();
}
