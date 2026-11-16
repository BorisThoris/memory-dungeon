/**
 * Wrap player-facing string literals in `tr` (docs/LOCALIZATION_PLAN.md).
 *
 *   yarn tsx scripts/i18n-wrap.ts <file-or-dir> [...] [--dry]
 *
 * A literal is wrapped when it reads like words (a letter, and a space or a capital first letter)
 * and sits where a value is produced, not compared or used as a key: not an import, an object key,
 * an operand of ===/!==, a `case`, a type, an argument to a string method that matches text
 * (`includes`, `startsWith`, `replace`, ...), a RegExp, an Error or a console line. It is a
 * one-shot helper: read the diff it makes before committing, and fix by hand what it misjudges.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import ts from 'typescript';

const I18N_MODULE = join(process.cwd(), 'src', 'shared', 'i18n');

const MATCHING_METHODS = new Set([
    'includes', 'startsWith', 'endsWith', 'replace', 'replaceAll', 'split', 'indexOf', 'lastIndexOf',
    'match', 'matchAll', 'search', 'get', 'has', 'set', 'delete', 'getItem', 'setItem', 'removeItem',
    'querySelector', 'querySelectorAll', 'getElementById', 'addEventListener', 'removeEventListener',
    'getPropertyValue', 'setProperty', 'toLocaleString', 'localeCompare', 'padStart', 'padEnd', 'join'
]);

const COMPARISON = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword
]);

/** Words, not identifiers, paths, CSS or colour codes. */
export const readsLikeCopy = (text: string): boolean => {
    const trimmed = text.trim();
    if (!/[A-Za-z]{2}/u.test(trimmed)) {
        return false;
    }
    if (/^(?:https?:|mailto:|#|\.|\/|--|data-|aria-|var\()/u.test(trimmed)) {
        return false;
    }
    if (/^[a-z0-9]+(?:[_.:/-][a-z0-9]+)+$/u.test(trimmed)) {
        return false; // max_rank, store.offer, a/b, kebab-case
    }
    if (/^[a-z]+[A-Z]\w*$/u.test(trimmed)) {
        return false; // camelCase
    }
    if (/^[\d\s.,%()+\-x×/:px]+$/u.test(trimmed)) {
        return false;
    }
    if (/\b(?:rgba?|hsla?|translate|scale|rotate|cubic-bezier|linear-gradient|calc)\(/u.test(trimmed)) {
        return false;
    }
    return /\s/u.test(trimmed) || /^[A-Z][a-z]/u.test(trimmed);
};

const templateText = (node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral): string =>
    ts.isNoSubstitutionTemplateLiteral(node)
        ? node.text
        : [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');

const calleeMethodName = (call: ts.CallExpression | ts.NewExpression): string | null => {
    const callee = call.expression;
    if (ts.isPropertyAccessExpression(callee)) {
        return callee.name.text;
    }
    if (ts.isIdentifier(callee)) {
        return callee.text;
    }
    return null;
};

const isExcludedPosition = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (!parent) {
        return true;
    }
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) {
        return true;
    }
    if (ts.isLiteralTypeNode(parent) || ts.isTypeNode(parent)) {
        return true;
    }
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isEnumMember(parent)) && parent.name === node) {
        return true;
    }
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) {
        return true;
    }
    if (ts.isBinaryExpression(parent) && COMPARISON.has(parent.operatorToken.kind)) {
        return true;
    }
    if (ts.isCaseClause(parent)) {
        return true;
    }
    if (ts.isTaggedTemplateExpression(parent)) {
        return true;
    }
    if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
        const name = calleeMethodName(parent);
        if (name === 'tr' || name === 's' || name === 'plural' || name === 'RegExp' || name === 'Error' || name === 'TypeError' || name === 'RangeError') {
            return true;
        }
        if (name && MATCHING_METHODS.has(name)) {
            return true;
        }
        const callee = parent.expression;
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'console') {
            return true;
        }
    }
    if (ts.isJsxAttribute(parent)) {
        const name = parent.name.getText();
        return !/^(?:aria-label|aria-description|title|alt|placeholder|label)$/u.test(name);
    }
    // Inside a template that will itself be wrapped, a nested literal is still its own string.
    return false;
};

interface Edit { start: number; end: number; text: string }

export const wrapSource = (fileName: string, source: string): { output: string; wrapped: number } => {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits: Edit[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) && readsLikeCopy(node.text) && !isExcludedPosition(node)) {
            const inAttribute = node.parent && ts.isJsxAttribute(node.parent);
            edits.push({ start: node.getStart(sf), end: node.getStart(sf), text: inAttribute ? '{tr.s(' : 'tr.s(' }, { start: node.getEnd(), end: node.getEnd(), text: inAttribute ? ')}' : ')' });
            return;
        }
        const isTemplate = ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node);
        // A template with substitutions and a word around them (`${n} gold`) is copy even when no part has a space of its own.
        const templateIsCopy = isTemplate && (readsLikeCopy(templateText(node)) || (ts.isTemplateExpression(node) && /\s[A-Za-z]{2}|[A-Za-z]{2}\s/u.test(templateText(node)) && !/[;{}]|^\s*[.#-]/u.test(templateText(node))));
        if (isTemplate && templateIsCopy && !isExcludedPosition(node)) {
            edits.push({ start: node.getStart(sf), end: node.getStart(sf), text: 'tr' });
        }
        if (ts.isJsxText(node) && readsLikeCopy(node.text) && node.text.trim().length > 0) {
            const raw = node.getText(sf);
            const lead = raw.match(/^\s*/u)?.[0] ?? '';
            const trail = raw.match(/\s*$/u)?.[0] ?? '';
            const inner = raw.trim().replace(/\s+/gu, ' ');
            if (!/[{}<>`$\\]/u.test(inner)) {
                edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${lead}{tr.s(${JSON.stringify(inner)})}${trail}` });
            }
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    if (edits.length === 0) {
        return { output: source, wrapped: 0 };
    }
    let output = source;
    for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
        output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    }
    if (!/import\s*\{[^}]*\btr\b[^}]*\}\s*from\s*'[^']*shared\/i18n'/u.test(output)) {
        let rel = relative(dirname(fileName), I18N_MODULE).split(sep).join('/');
        if (!rel.startsWith('.')) {
            rel = `./${rel}`;
        }
        const importLine = `import { tr } from '${rel}';\n`;
        const firstImport = output.search(/^import\s/mu);
        output = firstImport >= 0 ? output.slice(0, firstImport) + importLine + output.slice(firstImport) : importLine + output;
    }
    return { output, wrapped: edits.filter((edit) => edit.text !== ')' && edit.text !== ')}').length };
};

const collect = (target: string): string[] => {
    const stats = statSync(target);
    if (stats.isFile()) {
        return [target];
    }
    return readdirSync(target).flatMap((name) => collect(join(target, name)));
};

const main = (): void => {
    const args = process.argv.slice(2);
    const dry = args.includes('--dry');
    const files = args.filter((arg) => !arg.startsWith('--')).flatMap(collect)
        .filter((file) => /\.(?:ts|tsx)$/u.test(file) && !/\.test\.tsx?$/u.test(file) && !/\.d\.ts$/u.test(file));
    let total = 0;
    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const { output, wrapped } = wrapSource(file, source);
        if (wrapped > 0) {
            total += wrapped;
            console.log(`${String(wrapped).padStart(4)}  ${relative(process.cwd(), file)}`);
            if (!dry) {
                writeFileSync(file, output);
            }
        }
    }
    console.log(`${dry ? 'would wrap' : 'wrapped'} ${total} literal(s) in ${files.length} file(s)`);
};

if (process.argv[1] && /i18n-wrap\.ts$/u.test(process.argv[1])) {
    main();
}
