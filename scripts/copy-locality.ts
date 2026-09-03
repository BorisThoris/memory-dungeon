/**
 * How much player-facing copy still lives inside components.
 *
 * Copy is mostly centralised already — `src/renderer/copy/` and the shared catalogs — which is the
 * expensive half of ever localizing this game. What is missing is anything stopping the next
 * component from hardcoding a sentence, and any idea of how much is already hardcoded.
 *
 * The detector is deliberately blunt: prose-shaped string literals in component files. It will
 * catch things that are not copy and miss things that are, so the gate is a baseline that must not
 * grow rather than a claim that the number is exactly right.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface HardcodedCopy {
    readonly file: string;
    readonly text: string;
}

/** Attributes whose values are identifiers or styling, never words a player reads. */
const NON_COPY_ATTRIBUTES =
    /\b(className|data-[\w-]+|testId|id|key|href|src|role|type|name|htmlFor|aria-controls|aria-labelledby|aria-describedby)\s*=\s*$/u;

const LOOKS_LIKE_CODE = /^(?:[a-z]+[A-Z]|[\w-]+\.[\w-]+$|https?:|#|\.|\/|--|\d)/u;

/**
 * Prose, roughly: several words, starting like a sentence, with a space and no code punctuation.
 * Two words is too loose (it catches labels like "Shop gold" that are legitimately inline).
 */
const isProse = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 25 || LOOKS_LIKE_CODE.test(trimmed)) {
        return false;
    }
    const words = trimmed.split(/\s+/u);
    return words.length >= 5 && /^[A-Z]/u.test(trimmed) && !/[{}<>|]/u.test(trimmed);
};

export const findHardcodedCopy = (source: string, file: string): HardcodedCopy[] => {
    const found: HardcodedCopy[] = [];
    // Single and double quoted literals, plus backtick templates with no interpolation.
    const literals = source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/gu);
    for (const match of literals) {
        const text = match[2] ?? '';
        if (!isProse(text)) {
            continue;
        }
        const before = source.slice(Math.max(0, match.index - 40), match.index);
        if (NON_COPY_ATTRIBUTES.test(before)) {
            continue;
        }
        found.push({ file, text: text.slice(0, 80) });
    }
    return found;
};

const listComponentFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return listComponentFiles(path);
        }
        return entry.isFile() && path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
    });

export const scanComponentCopy = (root = join(process.cwd(), 'src/renderer/components')): HardcodedCopy[] =>
    listComponentFiles(root).flatMap((file) => findHardcodedCopy(readFileSync(file, 'utf8'), file));

/**
 * What is hardcoded today. Lower it when copy moves into `src/renderer/copy/`; raising it should be
 * a decision written down here rather than a reflex.
 */
export const HARDCODED_COPY_BASELINE = 54;

if (process.argv[1]?.endsWith('copy-locality.ts')) {
    const found = scanComponentCopy();
    for (const row of found) {
        process.stdout.write(`${row.file}: ${row.text}\n`);
    }
    process.stdout.write(`\n${found.length} prose literals in components (baseline ${HARDCODED_COPY_BASELINE})\n`);
}
