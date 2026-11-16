/**
 * Repair for the i18n codemod: unwrap `tr` calls that hold code, not words. Translating them let the
 * language reach the rules or the renderer (i18n-rules-isolation.test.ts and the translators caught it):
 *  - templates whose literal parts hold no space (`` tr`opening-layout:${seed}:${level}` ``): ids and seeds;
 *  - shader source, CSS values and canvas font shorthands (`looksLikeCode`).
 *
 *   yarn tsx scripts/i18n-unwrap-ids.ts src
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? files(full) : /\.(?:ts|tsx)$/u.test(name) ? [full] : [];
    });

export const isIdTemplate = (parts: readonly string[]): boolean => parts.every((part) => !/\s/u.test(part));

/** GLSL, CSS and canvas-font text: never player copy. */
export const looksLikeCode = (text: string): boolean =>
    /;\s*$|;\s*\n|\bvec[234]\b|\buniform\b|\bvarying\b|\battribute\b|gl_|\bvoid main\b|\bprecision\b|@media|\bcolor-mix\(|\bvar\(--|\brgba?\(|\bminmax\(|\brepeat\(|\binset\b|^\((?:any-)?(?:pointer|hover|prefers-|min-|max-|orientation)|\[data-[\w-]+|\[role=|\[aria-|^(?:input|textarea|select|button)\b[^.]*,|\d(?:rem|vw|vh|em)\b|\bclamp\(|\bu[A-Z][a-z]+ [*+\-/] |\b\d+px\b|\{\d+\}px\b|\bsans-serif\b|\bserif"?$|\bsystem-ui\b|=>/u.test(text);

const MAIN = process.argv[1] && /i18n-unwrap-ids\.ts$/u.test(process.argv[1]);
if (MAIN) {
    let total = 0;
    for (const file of files(process.argv[2] ?? 'src')) {
        const source = readFileSync(file, 'utf8');
        if (!source.includes('tr`') && !source.includes('tr.s(')) {
            continue;
        }
        const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const edits: { start: number; end: number; text: string }[] = [];
        const visit = (node: ts.Node): void => {
            if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'tr') {
                const template = node.template;
                const parts = ts.isNoSubstitutionTemplateLiteral(template)
                    ? [template.text]
                    : [template.head.text, ...template.templateSpans.map((span) => span.literal.text)];
                if ((ts.isTemplateExpression(template) && isIdTemplate(parts)) || looksLikeCode(parts.join('{}'))) {
                    edits.push({ start: node.tag.getStart(sf), end: node.tag.getEnd(), text: '' });
                }
            } else if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === 'tr' &&
                node.expression.name.text === 's' &&
                node.arguments.length === 1 &&
                ts.isStringLiteral(node.arguments[0]!) &&
                looksLikeCode(node.arguments[0].text)
            ) {
                const arg = node.arguments[0];
                const parent = node.parent;
                const inJsxBraces = parent && ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent);
                if (inJsxBraces) {
                    edits.push({ start: parent.getStart(sf), end: parent.getEnd(), text: arg.getText(sf) });
                } else {
                    edits.push({ start: node.getStart(sf), end: node.getEnd(), text: arg.getText(sf) });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
        if (edits.length > 0) {
            let output = source;
            for (const edit of edits.sort((a, b) => b.start - a.start)) {
                output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
            }
            writeFileSync(file, output);
            total += edits.length;
            console.log(`${String(edits.length).padStart(4)}  ${file}`);
        }
    }
    console.log(`unwrapped ${total}`);
}
