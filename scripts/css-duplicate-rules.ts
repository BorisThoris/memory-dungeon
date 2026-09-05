/**
 * Finds a CSS declaration that another block in the same file has already overruled.
 *
 * `.shell:not([data-mobile-camera-mode='true']) .boardStage` was declared twice in the game
 * screen's module, hundreds of lines apart, and both blocks set `inset`, `position`, `width`,
 * `overflow` and `z-index`. The second one won, which meant an edit to the first one did nothing.
 * That is how a stage inset meant to keep the top row of cards out from under the HUD landed in the
 * file, shipped, and did not move a pixel — with no error, no warning, and no lint rule that minds.
 *
 * The rule here is narrow on purpose: the same selector, in the same at-rule context, in the same
 * file, setting the same property twice. That is never a cascade decision — a later block cannot
 * be more specific than an identical one — so the earlier declaration is dead text that reads like
 * live code. A media query, a different pseudo-state, or the same selector in another file are all
 * ordinary overrides and are left alone.
 */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** `file selector { property` rows that are deliberate, by key with the reason. */
export const SHADOWED_DECLARATION_EXEMPTIONS: Record<string, string> = {};

export interface ShadowedDeclaration {
    readonly file: string;
    /** The at-rule context plus the selector, as the key both blocks share. */
    readonly selector: string;
    readonly property: string;
    /** Line of the declaration that never applies. */
    readonly deadLine: number;
    /** Line of the declaration that wins. */
    readonly winningLine: number;
}

/** Blanks comments while keeping every newline, so reported lines stay true. */
export const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ' '));

interface Block {
    readonly context: string;
    readonly selector: string;
    readonly body: string;
    readonly bodyStart: number;
}

const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

const normalize = (text: string): string => text.replace(/\s+/gu, ' ').replace(/\s*([,>+~])\s*/gu, '$1').trim();

/**
 * Walks the braces rather than parsing CSS: enough to know which rule a declaration belongs to and
 * which at-rules wrap it, which is all the comparison needs.
 */
export const readBlocks = (source: string): Block[] => {
    const blocks: Block[] = [];
    const stack: { prelude: string; atRule: boolean }[] = [];
    let preludeStart = 0;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (character === '{') {
            const prelude = normalize(source.slice(preludeStart, index));
            const atRule = prelude.startsWith('@');
            stack.push({ atRule, prelude });
            if (!atRule) {
                const close = matchingBrace(source, index);
                blocks.push({
                    body: source.slice(index + 1, close),
                    bodyStart: index + 1,
                    context: stack
                        .slice(0, -1)
                        .map((frame) => frame.prelude)
                        .join(' '),
                    selector: prelude
                });
            }
            preludeStart = index + 1;
        } else if (character === '}') {
            stack.pop();
            preludeStart = index + 1;
        } else if (character === ';' && stack.every((frame) => frame.atRule)) {
            // A statement at-rule (`@import ...;`) never opens a block; its prelude ends here.
            preludeStart = index + 1;
        }
    }
    /*
     * Nested rules are walked as their own blocks, so a parent's body would double-count them.
     * They are blanked rather than cut out: every offset here is reported as a line number, and a
     * body that shrank would name the wrong one.
     */
    return blocks.map((block) => ({ ...block, body: blankNested(block.body) }));
};

/** Replaces every nested rule with spaces, keeping newlines so offsets and lines both hold. */
const blankNested = (body: string): string => {
    let previous = body;
    for (;;) {
        const next = previous.replace(/\{[^{}]*\}/gu, (nested) => nested.replace(/[^\n]/gu, ' '));
        if (next === previous) {
            return next;
        }
        previous = next;
    }
};

const matchingBrace = (source: string, open: number): number => {
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') {
            depth += 1;
        } else if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return source.length;
};

/**
 * Every `property: value` a block declares, with the file offset of each and whether it carries
 * `!important` — which beats declaration order, so an earlier important declaration is the one that
 * applies and is not dead at all.
 */
const readDeclarations = (block: Block): { property: string; index: number; important: boolean }[] =>
    [...block.body.matchAll(/(?:^|;)(\s*)(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:([^;]*)/gu)].map((match) => ({
        important: /!\s*important/iu.test(match[3] ?? ''),
        // The property's own offset, not the separator before it: this is reported as a line.
        index: block.bodyStart + (match.index ?? 0) + (match[0].startsWith(';') ? 1 : 0) + (match[1] ?? '').length,
        property: (match[2] ?? '').toLowerCase()
    }));

export const findShadowedDeclarations = (file: string, rawSource: string): ShadowedDeclaration[] => {
    const source = stripComments(rawSource);
    const bySelector = new Map<string, Block[]>();
    for (const block of readBlocks(source)) {
        const key = `${block.context}||${block.selector}`;
        bySelector.set(key, [...(bySelector.get(key) ?? []), block]);
    }

    const found: ShadowedDeclaration[] = [];
    for (const [key, blocks] of bySelector) {
        if (blocks.length < 2) {
            continue;
        }
        const selector = key.replace('||', ' ').trim();
        /*
         * The last declaration of a property wins — unless an earlier one carries `!important` and
         * a later one does not, in which case the important one applies and the later is the dead
         * text. So the winner is the last important declaration if there is one, else the last.
         */
        const lines: { property: string; line: number; important: boolean }[] = [];
        for (const block of blocks) {
            for (const declaration of readDeclarations(block)) {
                lines.push({
                    important: declaration.important,
                    line: lineOf(source, declaration.index),
                    property: declaration.property
                });
            }
        }
        const winner = new Map<string, number>();
        for (const declaration of lines) {
            const important = lines.filter((row) => row.property === declaration.property && row.important);
            const pool = important.length > 0 ? important : lines.filter((row) => row.property === declaration.property);
            winner.set(declaration.property, Math.max(...pool.map((row) => row.line)));
        }
        for (const declaration of lines) {
            const winningLine = winner.get(declaration.property) ?? declaration.line;
            if (winningLine === declaration.line) {
                continue;
            }
            const exemption = `${file} ${selector} { ${declaration.property}`;
            if (SHADOWED_DECLARATION_EXEMPTIONS[exemption] !== undefined) {
                continue;
            }
            found.push({ deadLine: declaration.line, file, property: declaration.property, selector, winningLine });
        }
    }
    return found.sort((left, right) => left.deadLine - right.deadLine);
};

const main = (): void => {
    const files = globSync('src/**/*.css').sort();
    const found: ShadowedDeclaration[] = [];
    for (const file of files) {
        found.push(...findShadowedDeclarations(file, readFileSync(file, 'utf8')));
    }
    for (const row of found) {
        console.log(
            `${row.file}:${row.deadLine} \`${row.property}\` never applies — ` +
                `\`${row.selector}\` sets it again at line ${row.winningLine}`
        );
    }
    console.log(
        `\n${files.length} stylesheets, ${found.length} declarations overruled by an identical rule, ` +
            `${Object.keys(SHADOWED_DECLARATION_EXEMPTIONS).length} exempt by name`
    );
    if (found.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/css-duplicate-rules.ts'))) {
    main();
}
