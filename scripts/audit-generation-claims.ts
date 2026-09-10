/**
 * Does the record of every generation still describe the game? Run: yarn audit:generations
 *
 * This repository writes its history into its documents and its comments: 600-odd sentences that
 * name a generation and say what it changed. Each of them is a claim, and a claim nothing checks
 * rots the same way a test nobody runs does - it goes on being read as true long after the thing
 * it names has gone. Gen 184 removed the combo shards; twenty-one generations later the mechanics
 * catalog still listed them, in the *future* tense, pointing at three symbols that no longer exist.
 *
 * Two rules, and the second is the one that caught that:
 *
 *   1. **A reference has to resolve.** Every backticked file or symbol in a sentence naming a
 *      generation must exist in the repository today - unless the sentence itself says it is gone
 *      ("removed", "deleted", "was", "no longer"), because a record is allowed to name what it
 *      buried. Whole files that exist to be a dated record - `BALANCE_NOTES.md`, the `REMOVED_*`
 *      files, an epic with a superseded banner - are exempt for that reason: their subject IS the
 *      game as it was.
 *   2. **Nothing may still be pending in a generation that has happened.** "leaves in Gen 184" was
 *      true when it was written and became a lie the moment Gen 184 shipped. The current generation
 *      is the highest one the repository mentions, so this needs no constant to keep up to date.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIPPED_DIRECTORIES = new Set([
    '.ai', '.git', 'coverage', 'dist', 'dist-electron', 'node_modules', 'release', 'test-results'
]);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json']);

/**
 * Which generations have actually shipped, read off the file that records shipped work rather than
 * off the highest number anyone has written down. A plan may name a generation years out - "the
 * magpie counter lands in Gen 240" is a plan, not a lie - and taking the latest from every mention
 * would make each plan certify itself.
 *
 * Only the record's own entry headings count, not the prose inside them: the entry that describes
 * this rule quotes that example, and reading every mention let the example raise the ceiling to
 * Gen 240 and switch the rule off for everything under it.
 */
const SHIPPED_GENERATION_RECORD = 'docs/BALANCE_NOTES.md';
const SHIPPED_GENERATION_HEADING = /^\s*-\s+\*\*Gen (\d+)/;

/** Words that mark a reference as history rather than a claim about the game now. */
const GONE_MARKERS =
    /\b(remov|delet|drop|gone|went|retired|superseded|no longer|used to|was |were |had |until Gen|before Gen|left in Gen|out in Gen|replaced)/i;
/** A generation that has already happened cannot still be going to do something. */
const PENDING_PHRASES =
    /\b(leaves?|goes?|lands?|arrives?|ships?|will (?:be|leave|go|land|ship)|planned|to be (?:removed|dropped|cut))\b[^.|]{0,40}\bin Gen (\d+)/gi;

const collectFiles = (directory: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(directory)) {
        if (SKIPPED_DIRECTORIES.has(entry)) continue;
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) collectFiles(full, out);
        else out.push(full);
    }
    return out;
};

export interface GenerationClaimIssue {
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

export interface GenerationClaimReport {
    readonly claims: number;
    readonly files: number;
    readonly latestGeneration: number;
    readonly issues: readonly GenerationClaimIssue[];
}

/** A file whose subject is the game as it was, and which may therefore name what is gone. */
const isDatedRecord = (relativePath: string, text: string): boolean =>
    relativePath === 'docs/BALANCE_NOTES.md' ||
    /^docs\/REMOVED_[A-Z_]+\.md$/.test(relativePath) ||
    /Superseded in Gen \d+/.test(text.slice(0, 4000));

export interface RepositoryFile {
    /** Path from the repository root, which is how a claim spells a file it points at. */
    readonly path: string;
    readonly text: string;
}

/** Every file the audit can see, read once. */
export const readRepositoryFiles = (): RepositoryFile[] =>
    collectFiles(ROOT).map((file) => ({ path: relative(ROOT, file), text: readFileSync(file, 'utf8') }));

export const auditGenerationClaims = (files: readonly RepositoryFile[] = readRepositoryFiles()): GenerationClaimReport => {
    const paths = new Set([...files.map((file) => file.path.slice(file.path.lastIndexOf('/') + 1)), ...files.map((file) => file.path)]);
    const identifiers = new Set(
        files
            .filter((file) => SOURCE_EXTENSIONS.has(extname(file.path)))
            .flatMap((file) => file.text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [])
    );

    const issues: GenerationClaimIssue[] = [];
    const claimFiles = new Set<string>();
    let claims = 0;
    let latestGeneration = 0;
    const pending: Array<{ file: string; line: number; generation: number; text: string }> = [];

    for (const { path: relativePath, text } of files) {
        const extension = extname(relativePath);
        if (extension !== '.md' && !SOURCE_EXTENSIONS.has(extension)) continue;
        // The audit's own rules are written as regular expressions, which name generations it is
        // not making claims about.
        if (relativePath.startsWith('scripts/audit-generation-claims')) continue;
        // Its test holds fabricated stale claims open so the rules stay proven; they are fixtures.
        if (relativePath.startsWith('src/shared/generation-claim-audit')) continue;
        if (!/Gen \d+/.test(text)) continue;
        const lines = text.split('\n');
        const record = isDatedRecord(relativePath, text);

        lines.forEach((line, index) => {
            if (relativePath === SHIPPED_GENERATION_RECORD) {
                const heading = SHIPPED_GENERATION_HEADING.exec(line);
                if (heading) latestGeneration = Math.max(latestGeneration, Number(heading[1]));
            }
            if (!record) {
                // A dated record's tense is relative to the day it was written: an entry from before
                // Gen 175 saying a thing goes in Gen 175 was true then and is history now.
                for (const match of line.matchAll(PENDING_PHRASES)) {
                    pending.push({ file: relativePath, line: index + 1, generation: Number(match[2]), text: match[0].trim() });
                }
            }
            if (!/Gen \d+/.test(line)) return;
            claims += 1;
            claimFiles.add(relativePath);
            if (record) return;
            // In a comment the claim and its references share a block, not a line.
            const window = extension === '.md' ? [line] : lines.slice(Math.max(0, index - 14), index + 15);
            for (const chunk of window) {
                for (const reference of chunk.matchAll(/`([^`\n]+)`/g)) {
                    const token = reference[1]!.trim();
                    if (GONE_MARKERS.test(chunk)) continue;
                    if (/\.(ts|tsx|md|json|mjs|js)$/.test(token)) {
                        if (!paths.has(token)) {
                            issues.push({ file: relativePath, line: index + 1, detail: `no file named ${token}` });
                        }
                        continue;
                    }
                    if (!/^[A-Za-z_$][A-Za-z0-9_$]{3,}$/.test(token)) continue;
                    if (!identifiers.has(token)) {
                        issues.push({ file: relativePath, line: index + 1, detail: `no symbol named ${token}` });
                    }
                }
            }
        });
    }

    for (const entry of pending) {
        if (entry.generation > latestGeneration) continue;
        issues.push({
            file: entry.file,
            line: entry.line,
            detail: `"${entry.text}" is still pending in a generation that has happened (latest is ${latestGeneration})`
        });
    }
    return { claims, files: claimFiles.size, latestGeneration, issues };
};

export const summarizeGenerationClaims = (report: GenerationClaimReport): string =>
    `${report.claims} generation claims across ${report.files} files; latest generation ${report.latestGeneration}`;

const main = (): void => {
    const report = auditGenerationClaims();
    process.stdout.write(`${summarizeGenerationClaims(report)}\n`);
    if (report.issues.length > 0) {
        process.stdout.write(
            `\n${report.issues.length} claim(s) no longer describe the repository:\n` +
                report.issues.map((issue) => `- ${issue.file}:${issue.line} ${issue.detail}`).join('\n') +
                '\n\nEither the claim is stale - fix it where it is written - or the thing it names is gone and the ' +
                'sentence should say so.\n'
        );
        process.exitCode = 1;
        return;
    }
    process.stdout.write('Every generation claim still resolves against the repository\n');
};

if (process.argv[1]?.includes('audit-generation-claims')) {
    main();
}
