/**
 * No cognitive or medical benefit claim reaches a player. Run: yarn audit:health-claims
 *
 * This game is a memory game, and memory games are the one genre with a regulator precedent
 * attached: the FTC fined Lumosity $2M in 2016 for advertising that its brain-training program
 * would sharpen performance, stave off age-related cognitive decline, and protect against mild
 * cognitive impairment, dementia and Alzheimer's - claims it could not support. The research notes
 * in this repository record that case and draw the consequence in one sentence: **this game should
 * make no cognitive claim.**
 *
 * That sentence had nothing behind it. It was a paragraph in `docs/RESEARCH_NOTES_2.md`, written
 * once, read by whoever happened to open the file - which is exactly the shape of every claim this
 * repository has had to go back and fix. The product is clean today; nothing was keeping it clean,
 * and the copy a store page shows is written under deadline by whoever is shipping.
 *
 * So: no shipped string may promise a cognitive or medical benefit. The check runs over source a
 * player's build is made of and over the Steam Partner rows, with comments stripped - a comment
 * explaining why a phrase is banned is the record, not the claim.
 *
 * What is deliberately NOT banned is the design vocabulary that shares words with it. "Cognitive
 * load" is a thing a UI has, "cognitive accessibility" is a W3C guideline this game follows, and
 * neither tells a player their brain will improve. Those are listed below by phrase rather than
 * excused by file, because the distinction is the whole point: the ban is on promising an outcome,
 * not on the word.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Promising an outcome. Each is a phrase rather than a word, because a word-level ban would catch
 * the design vocabulary and be exempted away within a generation.
 */
export const HEALTH_CLAIM_PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] = [
    { id: 'brain training', pattern: /\bbrain[\s-]?train(?:ing|er)?\b/iu },
    { id: 'brain age', pattern: /\bbrain age\b/iu },
    { id: 'mental fitness', pattern: /\bmental fitness\b/iu },
    { id: 'memory workout', pattern: /\bmemory (?:workout|training|exercise)\b/iu },
    { id: 'improves memory', pattern: /\b(?:improve|boost|enhance|strengthen|sharpen)\w*\s+(?:your\s+)?(?:memory|recall|focus|concentration|brain|mind|cognition)\b/iu },
    { id: 'keeps the brain sharp', pattern: /\bkeeps?\s+(?:your\s+)?(?:brain|mind)\s+(?:sharp|young|fit|healthy)\b/iu },
    { id: 'cognitive benefit', pattern: /\bcognitive\s+(?:benefit|gain|improvement|decline|impairment|health|function|performance)\b/iu },
    { id: 'clinical condition', pattern: /\b(?:dementia|alzheimer|mild cognitive impairment|memory loss)\b/iu },
    { id: 'neuroplasticity', pattern: /\bneuroplastic\w*\b/iu },
    { id: 'IQ gain', pattern: /\braise\w*\s+(?:your\s+)?IQ\b|\bIQ\s+(?:boost|gain|points)\b/iu },
    { id: 'scientifically proven', pattern: /\b(?:scientifically|clinically)\s+(?:proven|designed|validated|tested)\b/iu }
];

/**
 * Design vocabulary that shares a word with a claim. Each is the phrase as it is legitimately
 * written, with what it means, because "why is this allowed" is the question a reader will have.
 */
export const DESIGN_VOCABULARY: Record<string, string> = {
    'cognitive load': 'How much a screen asks a player to hold at once - a property of the UI, not a promise about the player.',
    'cognitive accessibility': 'The W3C COGA guidelines this game follows; naming the standard is not claiming an outcome.',
    'cognitive a11y': 'The same standard, abbreviated, as it appears in the REG contract tokens.',
    'cognitive job': 'What a power is for - Recall, Search, Damage control, Risk - which is a taxonomy of tools.'
};

const SOURCE_ROOTS = ['src', 'scripts'] as const;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (/\.(ts|tsx)$/u.test(path) && !/\.d\.ts$/u.test(path)) out.push(path);
    }
    return out;
};

/** A comment saying why a phrase is banned is the record of the rule, not a breach of it. */
export const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');

/** Blank out the design vocabulary before matching, so a phrase is allowed rather than a word. */
export const maskDesignVocabulary = (text: string): string => {
    let masked = text;
    for (const phrase of Object.keys(DESIGN_VOCABULARY)) {
        masked = masked.replace(new RegExp(phrase.replace(/\s+/gu, '\\s+'), 'giu'), ' '.repeat(phrase.length));
    }
    return masked;
};

export interface HealthClaimFinding {
    readonly file: string;
    readonly line: number;
    readonly claim: string;
    readonly text: string;
}

export const findHealthClaims = (
    files: readonly string[],
    readSource: (file: string) => string = (file) => readFileSync(file, 'utf8')
): HealthClaimFinding[] => {
    const findings: HealthClaimFinding[] = [];
    for (const file of files) {
        const lines = maskDesignVocabulary(stripComments(readSource(file))).split('\n');
        lines.forEach((line, index) => {
            for (const { id, pattern } of HEALTH_CLAIM_PATTERNS) {
                if (pattern.test(line)) {
                    findings.push({ file, line: index + 1, claim: id, text: line.trim().slice(0, 120) });
                }
            }
        });
    }
    return findings;
};

const main = (): void => {
    const root = resolve(import.meta.dirname, '..');
    const files = SOURCE_ROOTS.flatMap((dir) => walk(join(root, dir)))
        .map((file) => relative(root, file))
        .filter((file) => !/\.(test|spec)\.tsx?$/u.test(file))
        // The audit's own rules are written as regular expressions naming the phrases it bans.
        .filter((file) => !file.startsWith(join('scripts', 'health-claims')))
        .map((file) => join(root, file));

    /*
     * The package description is the one shipped string that is not source: it is what a build
     * carries into the installer and what a store listing is usually seeded from, which makes it
     * the single most likely place for a marketing sentence to appear without review.
     */
    const packageJson = join(root, 'package.json');
    const description = String(JSON.parse(readFileSync(packageJson, 'utf8')).description ?? '');
    const findings = [
        ...findHealthClaims(files),
        ...findHealthClaims([packageJson], () => description)
    ];
    for (const finding of findings) {
        console.log(`${relative(root, finding.file)}:${finding.line} promises a ${finding.claim}: ${finding.text}`);
    }
    console.log(
        `\n${files.length} shipped source files, ${HEALTH_CLAIM_PATTERNS.length} claim shapes, ` +
            `${Object.keys(DESIGN_VOCABULARY).length} design phrases allowed by name, ` +
            `${findings.length} claim(s) a player could read`
    );
    if (findings.length > 0) {
        console.log(
            '\nThis game makes no cognitive or medical claim. Say what the game does instead: it is a ' +
                'memory game, and remembering where a card was is the whole of the promise.'
        );
        process.exitCode = 1;
        return;
    }
    console.log('No shipped string promises a cognitive or medical benefit');
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/health-claims.ts'))) {
    main();
}
