/**
 * Build the deterministic, machine-readable repository model used by AI tools.
 *
 * The model deliberately joins two kinds of truth:
 * - facts derived from the repository and TypeScript compiler; and
 * - curated gameplay semantics from gameplay-interaction-graph-data.json.
 *
 * Usage:
 *   node scripts/ai-repo-model.mjs --write
 *   node scripts/ai-repo-model.mjs --check
 *   node scripts/ai-repo-model.mjs --query "recall focus"
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');
export const AI_REPO_MODEL_PATH = '.ai/repo-model.json';
const MODEL_VERSION = 6;
const GENERATED_PATHS = new Set([AI_REPO_MODEL_PATH]);
const CONTENT_REGISTRIES = [
    { kind: 'build_archetype', file: 'src/shared/relics.ts', variable: 'RELIC_BUILD_ARCHETYPE_ORDER', mechanicPrefix: 'build' },
    { kind: 'relic', file: 'src/shared/relics.ts', variable: 'RELIC_POOL', mechanicPrefix: 'relic' },
    { kind: 'findable', file: 'src/shared/findables.ts', variable: 'FINDABLE_REWARD_ROW_ORDER', mechanicPrefix: 'findable' },
    { kind: 'inventory_item', file: 'src/shared/run-inventory-contracts.ts', variable: 'RUN_INVENTORY_ITEM_IDS', mechanicPrefix: 'inventory' },
    { kind: 'bonus_reward', file: 'src/shared/bonus-rewards.ts', variable: 'BONUS_REWARD_IDS', mechanicPrefix: 'reward' }
];
const PLAYER_VISIBLE_STATE_REGISTRY = {
    file: 'src/shared/gameplay-feedback-facts.ts',
    variable: 'GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES'
};
const TERMINAL_MECHANIC_IDS = new Set([
    'board.cleanup',
    'feedback.gameplay_hud',
    'objective.floor_clear',
    'progression.run_flow',
    'stats.session_tracking'
]);
const GAMEPLAY_PROTOCOL_COVERAGE_TEST_EXCLUSIONS = new Set([
    'src/shared/ai-repo-model.test.ts',
    'src/shared/gameplay-interaction-graph.test.ts'
]);
const RUN_STATE_WRITE_ACCESS_KINDS = new Set(['direct_assignment', 'state_construction']);
const ORCHESTRATION_FILE_BUDGETS = [
    {
        path: 'src/renderer/components/GameScreen.tsx',
        maxLines: 5_350,
        maxImports: 62
    }
];

const toPosix = (value) => value.split(path.sep).join('/');
const fromRoot = (repoRoot, value) => toPosix(path.relative(repoRoot, path.normalize(value)));
const fileId = (value) => `file:${value}`;
const symbolId = (file, name) => `symbol:${file}#${name}`;
const mechanicId = (value) => `mechanic:${value}`;
const stateId = (value) => `state:${value}`;
const runStateFieldId = (value) => `run_state_field:${value}`;
const gameplayCommandId = (value) => `gameplay_command:${value}`;
const gameplayEventId = (value) => `gameplay_event:${value}`;
const contentId = (kind, value) => `content:${kind}.${value}`;
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const readLiteralRegistryValues = (repoRoot, registry) => {
    const absolute = path.join(repoRoot, registry.file);
    if (!fs.existsSync(absolute)) {
        throw new Error(`Missing source registry ${registry.variable} at ${registry.file}.`);
    }
    const sourceFile = ts.createSourceFile(
        absolute,
        fs.readFileSync(absolute, 'utf8'),
        ts.ScriptTarget.Latest,
        true
    );
    let declaration = null;
    const findDeclaration = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === registry.variable) {
            declaration = node;
            return;
        }
        if (!declaration) ts.forEachChild(node, findDeclaration);
    };
    findDeclaration(sourceFile);
    if (!declaration?.initializer) {
        throw new Error(`Missing literal initializer for ${registry.variable} at ${registry.file}.`);
    }
    const values = [];
    const collectValues = (node) => {
        if (ts.isStringLiteralLike(node)) values.push(node.text);
        else ts.forEachChild(node, collectValues);
    };
    collectValues(declaration.initializer);
    return uniqueSorted(values);
};

const classifyTrackedFile = (file) => {
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith('e2e/')) return 'test';
    if (file.startsWith('src/')) return 'source';
    if (file.startsWith('scripts/')) return 'script';
    if (file.startsWith('docs/') || /(^|\/)README(?:\.|$)/i.test(file)) return 'documentation';
    if (/\.(png|jpe?g|webp|gif|svg|ico|wav|ogg|mp3|woff2?|ttf|otf)$/i.test(file)) return 'asset';
    if (/^(package|tsconfig|vite|vitest|playwright|electron|eslint)|\.(json|ya?ml|toml|config\.[cm]?[jt]s)$/i.test(file)) {
        return 'configuration';
    }
    return 'other';
};

const listRepositoryFiles = (repoRoot) => {
    const output = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: repoRoot, encoding: 'buffer', windowsHide: true }
    );
    return uniqueSorted(
        output
            .toString('utf8')
            .split('\0')
            .filter(Boolean)
            .map((file) => file.replaceAll('\\', '/'))
            .filter((file) => !GENERATED_PATHS.has(file))
    );
};

const buildInventory = (repoRoot) =>
    listRepositoryFiles(repoRoot).flatMap((file) => {
        const absolute = path.join(repoRoot, file);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return [];
        const content = fs.readFileSync(absolute);
        return [{ path: file, category: classifyTrackedFile(file), bytes: content.byteLength, sha256: sha256(content) }];
    });

const getLayer = (file) => {
    if (file.startsWith('src/shared/')) return 'shared';
    if (file.startsWith('src/renderer/')) return 'renderer';
    if (file.startsWith('src/main/')) return 'main';
    if (file.startsWith('src/preload/')) return 'preload';
    if (file.startsWith('src/blueprint/')) return 'blueprint';
    return 'other';
};

const getCodeRole = (file) => {
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) return 'test';
    if (file.endsWith('.d.ts')) return 'declaration';
    return 'production';
};

const declarationKind = (declaration) => {
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) return 'function';
    if (ts.isClassDeclaration(declaration)) return 'class';
    if (ts.isInterfaceDeclaration(declaration)) return 'interface';
    if (ts.isTypeAliasDeclaration(declaration)) return 'type';
    if (ts.isEnumDeclaration(declaration)) return 'enum';
    if (ts.isVariableDeclaration(declaration) || ts.isVariableStatement(declaration)) return 'value';
    return ts.SyntaxKind[declaration.kind] ?? 'unknown';
};

const readTsConfig = (repoRoot) => {
    const configPath = path.join(repoRoot, 'tsconfig.json');
    const result = ts.readConfigFile(configPath, (file) => fs.readFileSync(file, 'utf8'));
    if (result.error) throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
    return ts.parseJsonConfigFileContent(result.config, ts.sys, repoRoot, undefined, configPath);
};

const syntaxPropertyName = (name) => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
    return null;
};

const isRuntimeAssignmentTarget = (node) => {
    const parent = node.parent;
    if (ts.isBinaryExpression(parent) && parent.left === node) {
        return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    }
    return (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken);
};

const buildRunStateFieldIndex = (repoRoot, sourceFiles, checker) => {
    const contractsFile = sourceFiles.find((sourceFile) => fromRoot(repoRoot, sourceFile.fileName) === 'src/shared/contracts.ts');
    const declaration = contractsFile?.statements.find(
        (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === 'RunState'
    );
    if (!contractsFile || !declaration || !ts.isInterfaceDeclaration(declaration)) {
        throw new Error('Unable to locate the authoritative RunState interface in src/shared/contracts.ts.');
    }

    const fields = declaration.members.flatMap((member) => {
        if (!ts.isPropertySignature(member) || !member.name) return [];
        const name = syntaxPropertyName(member.name);
        if (!name) return [];
        const position = contractsFile.getLineAndCharacterOfPosition(member.name.getStart(contractsFile));
        return [{
            id: runStateFieldId(name),
            name,
            source: { path: 'src/shared/contracts.ts', line: position.line + 1 },
            readReferences: [],
            writeReferences: []
        }];
    });
    const byName = new Map(fields.map((field) => [field.name, field]));
    const fieldNames = [...byName.keys()];
    const membersByName = new Map(
        declaration.members.flatMap((member) => {
            if (!ts.isPropertySignature(member) || !member.name) return [];
            const name = syntaxPropertyName(member.name);
            return name ? [[name, member]] : [];
        })
    );
    const symbolOwnsField = (symbol, fieldName) =>
        Boolean(symbol?.declarations?.some((candidate) => candidate === membersByName.get(fieldName)));
    const typeOwnsField = (type, fieldName, visited = new Set()) => {
        if (!type || visited.has(type) || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))) return false;
        visited.add(type);
        if (symbolOwnsField(type.getProperty?.(fieldName), fieldName)) return true;
        if ((type.isUnion?.() || type.isIntersection?.()) && type.types.some((item) => typeOwnsField(item, fieldName, visited))) {
            return true;
        }
        const apparent = checker.getApparentType(type);
        return apparent !== type && typeOwnsField(apparent, fieldName, visited);
    };
    const runStateTypeCache = new Map();
    const typeHasRunStateShape = (type) => {
        if (!type || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))) return false;
        if (runStateTypeCache.has(type)) return runStateTypeCache.get(type);
        const apparent = checker.getApparentType(type);
        const result = fieldNames.every((fieldName) => Boolean(apparent.getProperty?.(fieldName)));
        runStateTypeCache.set(type, result);
        return result;
    };
    const runStateObjectLiteralCache = new Map();
    const objectLiteralCreatesRunState = (objectLiteral) => {
        if (runStateObjectLiteralCache.has(objectLiteral)) return runStateObjectLiteralCache.get(objectLiteral);
        const result = [checker.getContextualType(objectLiteral), checker.getTypeAtLocation(objectLiteral)]
            .filter(Boolean)
            .some(typeHasRunStateShape) || objectLiteral.properties.some(
                (property) => ts.isSpreadAssignment(property) && typeHasRunStateShape(checker.getTypeAtLocation(property.expression))
            );
        runStateObjectLiteralCache.set(objectLiteral, result);
        return result;
    };
    const record = (fieldName, kind, sourceFile, node, accessKind = undefined) => {
        const field = byName.get(fieldName);
        if (!field) return;
        const file = fromRoot(repoRoot, sourceFile.fileName);
        if (getCodeRole(file) !== 'production') return;
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const references = kind === 'read' ? field.readReferences : field.writeReferences;
        const reference = { path: file, line: position.line + 1, ...(accessKind ? { accessKind } : {}) };
        if (!references.some(
            (item) => item.path === reference.path && item.line === reference.line && item.accessKind === reference.accessKind
        )) {
            references.push(reference);
        }
    };

    for (const sourceFile of sourceFiles) {
        const visit = (node) => {
            if (node === declaration) return;
            if (ts.isPropertyAccessExpression(node)) {
                if (symbolOwnsField(checker.getSymbolAtLocation(node.name), node.name.text)) {
                    const write = isRuntimeAssignmentTarget(node);
                    record(node.name.text, write ? 'write' : 'read', sourceFile, node.name, write ? 'direct_assignment' : undefined);
                }
            } else if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
                const name = node.argumentExpression.text;
                if (typeOwnsField(checker.getTypeAtLocation(node.expression), name)) {
                    const write = isRuntimeAssignmentTarget(node);
                    record(name, write ? 'write' : 'read', sourceFile, node.argumentExpression, write ? 'direct_assignment' : undefined);
                }
            } else if (ts.isPropertyAssignment(node)) {
                const name = syntaxPropertyName(node.name);
                if (name && byName.has(name) && ts.isObjectLiteralExpression(node.parent) && objectLiteralCreatesRunState(node.parent)) {
                    record(name, 'write', sourceFile, node.name, 'state_construction');
                }
            } else if (ts.isShorthandPropertyAssignment(node)) {
                if (
                    byName.has(node.name.text) &&
                    ts.isObjectLiteralExpression(node.parent) &&
                    objectLiteralCreatesRunState(node.parent)
                ) {
                    record(node.name.text, 'write', sourceFile, node.name, 'state_construction');
                }
            } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
                const name = node.propertyName ? syntaxPropertyName(node.propertyName) : ts.isIdentifier(node.name) ? node.name.text : null;
                if (name && typeOwnsField(checker.getTypeAtLocation(node.parent), name)) {
                    record(name, 'read', sourceFile, node.propertyName ?? node.name);
                }
            } else if (
                ts.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
                ts.isStringLiteralLike(node.left) &&
                typeOwnsField(checker.getTypeAtLocation(node.right), node.left.text)
            ) {
                record(node.left.text, 'read', sourceFile, node.left);
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    const relationships = [];
    for (const field of fields) {
        field.readReferences.sort((a, b) => `${a.path}:${a.line}`.localeCompare(`${b.path}:${b.line}`));
        field.writeReferences.sort((a, b) => `${a.path}:${a.line}`.localeCompare(`${b.path}:${b.line}`));
        relationships.push({
            id: `declares:${fileId(field.source.path)}->${field.id}`,
            source: fileId(field.source.path),
            target: field.id,
            kind: 'declares',
            label: `L${field.source.line}`
        });
        for (const reference of field.readReferences) {
            relationships.push({
                id: `reads:${fileId(reference.path)}->${field.id}:L${reference.line}`,
                source: fileId(reference.path),
                target: field.id,
                kind: 'reads',
                label: `L${reference.line}`
            });
        }
        for (const reference of field.writeReferences) {
            relationships.push({
                id: `writes:${fileId(reference.path)}->${field.id}:L${reference.line}:${reference.accessKind}`,
                source: fileId(reference.path),
                target: field.id,
                kind: 'writes',
                label: `L${reference.line} ${reference.accessKind}`
            });
        }
    }
    fields.sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return { fields, relationships };
};

const rendererRunStateWriteLocations = (runStateFields) => {
    const byLocation = new Map();
    for (const field of runStateFields) {
        for (const reference of field.writeReferences) {
            if (!reference.path.startsWith('src/renderer/') || reference.path.startsWith('src/renderer/dev/')) continue;
            const key = `${reference.path}:L${reference.line}:${reference.accessKind}`;
            const current = byLocation.get(key) ?? {
                path: reference.path,
                line: reference.line,
                accessKind: reference.accessKind,
                fields: []
            };
            current.fields.push(field.name);
            byLocation.set(key, current);
        }
    }
    return [...byLocation.values()]
        .map((location) => ({ ...location, fields: uniqueSorted(location.fields) }))
        .sort((a, b) => `${a.path}:${a.line}:${a.accessKind}`.localeCompare(`${b.path}:${b.line}:${b.accessKind}`));
};

const buildOrchestrationBudgetIndex = (files) => {
    const filesByPath = new Map(files.map((file) => [file.path, file]));
    const budgets = ORCHESTRATION_FILE_BUDGETS.map((budget) => {
        const file = filesByPath.get(budget.path);
        const lineCount = file?.lineCount ?? null;
        const importCount = file?.imports.length ?? null;
        return {
            id: `orchestration_budget:${budget.path}`,
            ...budget,
            lineCount,
            importCount,
            withinBudget:
                lineCount !== null &&
                importCount !== null &&
                lineCount <= budget.maxLines &&
                importCount <= budget.maxImports
        };
    });
    const relationships = budgets.flatMap((budget) =>
        budget.lineCount === null
            ? []
            : [{
                  id: `gates:${budget.id}->${fileId(budget.path)}`,
                  source: budget.id,
                  target: fileId(budget.path),
                  kind: 'gates',
                  label: `<=${budget.maxLines} lines, <=${budget.maxImports} imports`
              }]
    );
    return { budgets, relationships };
};

const isZodLiteralCall = (node) =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'z' &&
    node.expression.name.text === 'literal' &&
    node.arguments.length === 1 &&
    ts.isStringLiteralLike(node.arguments[0]);

const findVariableDeclaration = (sourceFile, variableName) => {
    let declaration = null;
    const visit = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName) {
            declaration = node;
            return;
        }
        if (!declaration) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return declaration;
};

const extractGameplayProtocolVariants = (sourceFile, schemaName, kind) => {
    const declaration = findVariableDeclaration(sourceFile, schemaName);
    if (!declaration?.initializer) {
        throw new Error(`Unable to locate ${schemaName} in src/shared/gameplay-core-contracts.ts.`);
    }
    const variants = [];
    const visit = (node) => {
        if (
            ts.isPropertyAssignment(node) &&
            syntaxPropertyName(node.name) === 'type' &&
            isZodLiteralCall(node.initializer)
        ) {
            const literal = node.initializer.arguments[0];
            const name = literal.text;
            const position = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
            const objectLiteral = ts.isObjectLiteralExpression(node.parent) ? node.parent : null;
            const payloadFields = objectLiteral
                ? objectLiteral.properties.flatMap((property) => {
                      if (!('name' in property) || !property.name) return [];
                      const fieldName = syntaxPropertyName(property.name);
                      return fieldName && fieldName !== 'type' ? [fieldName] : [];
                  })
                : [];
            variants.push({
                id: kind === 'command' ? gameplayCommandId(name) : gameplayEventId(name),
                name,
                kind,
                schema: schemaName,
                source: {
                    path: 'src/shared/gameplay-core-contracts.ts',
                    line: position.line + 1
                },
                payloadFields: uniqueSorted(payloadFields),
                ...(kind === 'command'
                    ? { handlerReferences: [], creatorReferences: [], testReferences: [] }
                    : { emitterReferences: [], consumerReferences: [], testReferences: [] })
            });
        }
        ts.forEachChild(node, visit);
    };
    visit(declaration.initializer);
    const duplicateNames = uniqueSorted(
        variants.map((variant) => variant.name).filter((name, index, names) => names.indexOf(name) !== index)
    );
    if (duplicateNames.length > 0) {
        throw new Error(`${schemaName} contains duplicate variants: ${duplicateNames.join(', ')}.`);
    }
    return { declaration, variants };
};

const discriminantComparison = (literal) => {
    const binary = literal.parent;
    if (!ts.isBinaryExpression(binary)) return null;
    const positive = binary.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        binary.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken;
    const negative = binary.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        binary.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
    if (!positive && !negative) return null;
    const candidate = binary.left === literal ? binary.right : binary.left;
    if (!ts.isPropertyAccessExpression(candidate) || candidate.name.text !== 'type') return null;
    return {
        objectName: ts.isIdentifier(candidate.expression) ? candidate.expression.text : null,
        positive
    };
};

const switchDiscriminant = (literal) => {
    const clause = literal.parent;
    if (!ts.isCaseClause(clause) || !ts.isCaseBlock(clause.parent) || !ts.isSwitchStatement(clause.parent.parent)) return null;
    const expression = clause.parent.parent.expression;
    if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'type') return null;
    return ts.isIdentifier(expression.expression) ? expression.expression.text : null;
};

const buildGameplayProtocolIndex = (repoRoot, sourceFiles) => {
    const contractsFile = sourceFiles.find(
        (sourceFile) => fromRoot(repoRoot, sourceFile.fileName) === 'src/shared/gameplay-core-contracts.ts'
    );
    if (!contractsFile) {
        throw new Error('Unable to locate src/shared/gameplay-core-contracts.ts.');
    }
    const commandSchema = extractGameplayProtocolVariants(contractsFile, 'gameplayCommandSchema', 'command');
    const eventSchema = extractGameplayProtocolVariants(contractsFile, 'gameplayEventSchema', 'event');
    const commandsByName = new Map(commandSchema.variants.map((variant) => [variant.name, variant]));
    const eventsByName = new Map(eventSchema.variants.map((variant) => [variant.name, variant]));
    const addReference = (variant, field, sourceFile, node) => {
        const path = fromRoot(repoRoot, sourceFile.fileName);
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const reference = { path, line: position.line + 1 };
        if (!variant[field].some((item) => item.path === reference.path && item.line === reference.line)) {
            variant[field].push(reference);
        }
    };

    for (const sourceFile of sourceFiles) {
        const path = fromRoot(repoRoot, sourceFile.fileName);
        const role = getCodeRole(path);
        const visit = (node) => {
            if (node === commandSchema.declaration || node === eventSchema.declaration) return;
            if (ts.isStringLiteralLike(node)) {
                const command = commandsByName.get(node.text);
                const event = eventsByName.get(node.text);
                if (role === 'test' && !GAMEPLAY_PROTOCOL_COVERAGE_TEST_EXCLUSIONS.has(path)) {
                    if (command) addReference(command, 'testReferences', sourceFile, node);
                    if (event) addReference(event, 'testReferences', sourceFile, node);
                } else {
                    const comparison = discriminantComparison(node);
                    const switchedObject = switchDiscriminant(node);
                    const isTypeProperty =
                        ts.isPropertyAssignment(node.parent) && syntaxPropertyName(node.parent.name) === 'type';
                    if (
                        command &&
                        path === 'src/shared/gameplay-core.ts' &&
                        comparison?.positive &&
                        comparison.objectName === 'command'
                    ) {
                        addReference(command, 'handlerReferences', sourceFile, node);
                    }
                    if (command && isTypeProperty) {
                        addReference(command, 'creatorReferences', sourceFile, node);
                    }
                    if (event && isTypeProperty) {
                        addReference(event, 'emitterReferences', sourceFile, node);
                    }
                    if (event && (comparison || switchedObject)) {
                        addReference(event, 'consumerReferences', sourceFile, node);
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    const relationships = [];
    const addRelationship = (source, target, kind, reference) => {
        const label = reference ? `L${reference.line}` : undefined;
        const suffix = reference ? `:${reference.path}:L${reference.line}` : '';
        relationships.push({
            id: `${kind}:${source}->${target}${suffix}`,
            source,
            target,
            kind,
            ...(label ? { label } : {})
        });
    };
    const journalFile = fileId('src/shared/gameplay-journal.ts');
    for (const command of commandSchema.variants) {
        addRelationship(fileId(command.source.path), command.id, 'declares', command.source);
        for (const reference of command.handlerReferences) {
            addRelationship(fileId(reference.path), command.id, 'handles', reference);
        }
        for (const reference of command.creatorReferences) {
            addRelationship(fileId(reference.path), command.id, 'creates', reference);
        }
        for (const reference of command.testReferences) {
            addRelationship(command.id, fileId(reference.path), 'tested_by', reference);
        }
        addRelationship(command.id, journalFile, 'persists');
    }
    for (const event of eventSchema.variants) {
        addRelationship(fileId(event.source.path), event.id, 'declares', event.source);
        for (const reference of event.emitterReferences) {
            addRelationship(fileId(reference.path), event.id, 'emits', reference);
        }
        for (const reference of event.consumerReferences) {
            addRelationship(fileId(reference.path), event.id, 'consumes', reference);
            if (reference.path.startsWith('src/renderer/')) {
                addRelationship(event.id, fileId(reference.path), 'displays', reference);
            }
        }
        for (const reference of event.testReferences) {
            addRelationship(event.id, fileId(reference.path), 'tested_by', reference);
        }
        addRelationship(event.id, journalFile, 'persists');
    }
    const sortReferences = (variant) => {
        for (const field of Object.keys(variant).filter((key) => key.endsWith('References'))) {
            variant[field].sort((a, b) => `${a.path}:${a.line}`.localeCompare(`${b.path}:${b.line}`));
        }
    };
    commandSchema.variants.forEach(sortReferences);
    eventSchema.variants.forEach(sortReferences);
    commandSchema.variants.sort((a, b) => a.id.localeCompare(b.id));
    eventSchema.variants.sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return {
        commands: commandSchema.variants,
        events: eventSchema.variants,
        relationships
    };
};

const buildCodeIndex = (repoRoot) => {
    const parsed = readTsConfig(repoRoot);
    const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        projectReferences: parsed.projectReferences
    });
    const checker = program.getTypeChecker();
    const sourceRoot = path.normalize(path.join(repoRoot, 'src') + path.sep).toLowerCase();
    const sourceFiles = program
        .getSourceFiles()
        .filter((sourceFile) => {
            const normalized = path.normalize(sourceFile.fileName).toLowerCase();
            return !sourceFile.isDeclarationFile && normalized.startsWith(sourceRoot);
        })
        .sort((a, b) => fromRoot(repoRoot, a.fileName).localeCompare(fromRoot(repoRoot, b.fileName)));
    const projectPaths = new Set(sourceFiles.map((sourceFile) => fromRoot(repoRoot, sourceFile.fileName)));
    const files = [];
    const symbols = [];
    const relationships = [];
    const testImportsByTarget = new Map();

    for (const sourceFile of sourceFiles) {
        const file = fromRoot(repoRoot, sourceFile.fileName);
        const imports = [];
        const exports = [];
        const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
        if (moduleSymbol) {
            for (const exported of checker.getExportsOfModule(moduleSymbol)) {
                const declarations = exported.getDeclarations() ?? [];
                const declaration = declarations.find((item) => item.getSourceFile() === sourceFile);
                if (!declaration) continue;
                const start = sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile));
                const end = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd());
                const id = symbolId(file, exported.getName());
                exports.push(id);
                symbols.push({
                    id,
                    name: exported.getName(),
                    kind: declarationKind(declaration),
                    file,
                    line: start.line + 1,
                    endLine: end.line + 1
                });
                relationships.push({ id: `exports:${file}->${id}`, source: fileId(file), target: id, kind: 'exports' });
            }
        }

        const visit = (node) => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
                const resolved = ts.resolveModuleName(node.moduleSpecifier.text, sourceFile.fileName, parsed.options, ts.sys).resolvedModule;
                if (resolved?.resolvedFileName) {
                    const target = fromRoot(repoRoot, resolved.resolvedFileName);
                    if (projectPaths.has(target) && target !== file) imports.push(target);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        const stableImports = uniqueSorted(imports);
        for (const target of stableImports) {
            relationships.push({
                id: `imports:${file}->${target}`,
                source: fileId(file),
                target: fileId(target),
                kind: 'imports'
            });
            if (getCodeRole(file) === 'test') {
                const tests = testImportsByTarget.get(target) ?? [];
                tests.push(file);
                testImportsByTarget.set(target, tests);
            }
        }
        files.push({
            id: fileId(file),
            path: file,
            layer: getLayer(file),
            role: getCodeRole(file),
            lineCount: sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1,
            imports: stableImports.map(fileId),
            exports: uniqueSorted(exports),
            testedBy: []
        });
    }

    for (const file of files) {
        file.testedBy = uniqueSorted(testImportsByTarget.get(file.path) ?? []).map(fileId);
        for (const test of file.testedBy) {
            relationships.push({
                id: `tested_by:${file.path}->${test}`,
                source: file.id,
                target: test,
                kind: 'tested_by'
            });
        }
    }
    const runState = buildRunStateFieldIndex(repoRoot, sourceFiles, checker);
    const gameplayProtocol = buildGameplayProtocolIndex(repoRoot, sourceFiles);
    relationships.push(...runState.relationships, ...gameplayProtocol.relationships);
    symbols.sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return {
        files,
        symbols,
        runStateFields: runState.fields,
        gameplayCommands: gameplayProtocol.commands,
        gameplayEvents: gameplayProtocol.events,
        relationships
    };
};

const buildContentIndex = (repoRoot) => {
    const content = [];
    const relationships = [];
    for (const registry of CONTENT_REGISTRIES) {
        const absolute = path.join(repoRoot, registry.file);
        if (!fs.existsSync(absolute)) {
            content.push({
                id: contentId(registry.kind, '__missing_registry__'),
                contentId: '__missing_registry__',
                kind: registry.kind,
                registry: registry.variable,
                expectedMechanicId: `${registry.mechanicPrefix}.__missing_registry__`,
                source: { path: registry.file, line: null }
            });
            continue;
        }
        const text = fs.readFileSync(absolute, 'utf8');
        const sourceFile = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
        let declaration = null;
        const findDeclaration = (node) => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === registry.variable) {
                declaration = node;
                return;
            }
            if (!declaration) ts.forEachChild(node, findDeclaration);
        };
        findDeclaration(sourceFile);
        if (!declaration?.initializer) {
            content.push({
                id: contentId(registry.kind, '__missing_registry__'),
                contentId: '__missing_registry__',
                kind: registry.kind,
                registry: registry.variable,
                expectedMechanicId: `${registry.mechanicPrefix}.__missing_registry__`,
                source: { path: registry.file, line: null }
            });
            continue;
        }
        const values = [];
        const collectValues = (node) => {
            if (ts.isStringLiteralLike(node)) values.push(node.text);
            else ts.forEachChild(node, collectValues);
        };
        collectValues(declaration.initializer);
        const line = sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile)).line + 1;
        for (const value of uniqueSorted(values)) {
            const id = contentId(registry.kind, value);
            content.push({
                id,
                contentId: value,
                kind: registry.kind,
                registry: registry.variable,
                expectedMechanicId: `${registry.mechanicPrefix}.${value}`,
                source: { path: registry.file, line }
            });
            relationships.push({
                id: `declared_by:${id}->${fileId(registry.file)}`,
                source: id,
                target: fileId(registry.file),
                kind: 'declared_by'
            });
        }
    }
    content.sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return { content, relationships };
};

const lineReference = (repoRoot, file, mechanic) => {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) return { path: file, line: null };
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
    const tokens = uniqueSorted([
        mechanic.id.split('.').at(-1)?.replaceAll('_', ' ') ?? '',
        ...mechanic.label.toLowerCase().split(/\s+/).filter((token) => token.length >= 4)
    ]).filter(Boolean);
    const index = lines.findIndex((line) => tokens.some((token) => line.toLowerCase().includes(token)));
    return { path: file, line: index >= 0 ? index + 1 : 1 };
};

const buildGameplayIndex = (repoRoot, playerVisibleStates) => {
    const graphPath = path.join(repoRoot, 'src/shared/gameplay-interaction-graph-data.json');
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const mechanics = graph.mechanics
        .map((mechanic) => ({
            id: mechanicId(mechanic.id),
            mechanicId: mechanic.id,
            label: mechanic.label,
            kind: mechanic.kind,
            role: mechanic.role,
            evidence: mechanic.evidence.map((file) => lineReference(repoRoot, file, mechanic)),
            tests: mechanic.tests.map((file) => lineReference(repoRoot, file, mechanic)),
            enables: [...mechanic.enables],
            blocks: [...mechanic.blocks],
            softlockGuards: [...mechanic.softlockGuards]
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const states = new Map();
    const relationships = [];
    const addRelationship = (source, target, kind, label) => {
        const suffix = label ? `:${label}` : '';
        relationships.push({ id: `${kind}:${source}->${target}${suffix}`, source, target, kind, ...(label ? { label } : {}) });
    };

    for (const mechanic of graph.mechanics) {
        const id = mechanicId(mechanic.id);
        for (const state of mechanic.reads) {
            const entry = states.get(state) ?? { id: stateId(state), name: state, readBy: [], writtenBy: [] };
            entry.readBy.push(id);
            states.set(state, entry);
            addRelationship(id, entry.id, 'reads');
        }
        for (const state of mechanic.writes) {
            const entry = states.get(state) ?? { id: stateId(state), name: state, readBy: [], writtenBy: [] };
            entry.writtenBy.push(id);
            states.set(state, entry);
            addRelationship(id, entry.id, 'writes');
        }
        for (const evidence of mechanic.evidence) {
            const target = fileId(evidence);
            addRelationship(id, target, /GameplayHudBar|Feedback|feedback/.test(evidence) ? 'displays' : 'implemented_by');
        }
        for (const test of mechanic.tests) addRelationship(id, fileId(test), 'tested_by');
    }
    for (const edge of graph.edges) {
        addRelationship(mechanicId(edge.source), mechanicId(edge.target), edge.kind, edge.label);
    }
    const normalizedStates = [...states.values()]
        .map((state) => ({
            ...state,
            playerVisible: playerVisibleStates.has(state.name),
            readBy: uniqueSorted(state.readBy),
            writtenBy: uniqueSorted(state.writtenBy)
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return { mechanics, states: normalizedStates, relationships, graph };
};

const buildDiagnostics = (
    repoRoot,
    gameplay,
    content,
    playerVisibleStates,
    runStateFields,
    gameplayCommands,
    gameplayEvents,
    orchestrationBudgets
) => {
    const diagnostics = [];
    const mechanicIds = new Set(gameplay.mechanics.map((mechanic) => mechanic.mechanicId));
    const gameplayDegree = new Map(gameplay.mechanics.map((mechanic) => [mechanic.mechanicId, 0]));
    const outgoingDegree = new Map(gameplay.mechanics.map((mechanic) => [mechanic.mechanicId, 0]));
    for (const edge of gameplay.graph.edges) {
        gameplayDegree.set(edge.source, (gameplayDegree.get(edge.source) ?? 0) + 1);
        gameplayDegree.set(edge.target, (gameplayDegree.get(edge.target) ?? 0) + 1);
        outgoingDegree.set(edge.source, (outgoingDegree.get(edge.source) ?? 0) + 1);
        if (!mechanicIds.has(edge.source) || !mechanicIds.has(edge.target)) {
            diagnostics.push({ severity: 'error', code: 'dangling_gameplay_edge', subject: edge.label, detail: `${edge.source} -> ${edge.target}` });
        }
    }
    for (const mechanic of gameplay.mechanics) {
        if ((gameplayDegree.get(mechanic.mechanicId) ?? 0) === 0) {
            diagnostics.push({ severity: 'error', code: 'orphan_mechanic', subject: mechanic.mechanicId, detail: 'No incoming or outgoing gameplay relationship.' });
        }
        if ((gameplayDegree.get(mechanic.mechanicId) ?? 0) > 0 && (outgoingDegree.get(mechanic.mechanicId) ?? 0) === 0 && !TERMINAL_MECHANIC_IDS.has(mechanic.mechanicId)) {
            diagnostics.push({ severity: 'warning', code: 'dead_end_mechanic', subject: mechanic.mechanicId, detail: 'Connected mechanic has no outgoing consequence; confirm that it is an intentional sink.' });
        }
        for (const reference of [...mechanic.evidence, ...mechanic.tests]) {
            if (!fs.existsSync(path.join(repoRoot, reference.path))) {
                diagnostics.push({ severity: 'error', code: 'missing_reference', subject: mechanic.mechanicId, detail: reference.path });
            }
        }
        if (mechanic.tests.length === 0) {
            diagnostics.push({ severity: 'error', code: 'missing_critical_test', subject: mechanic.mechanicId, detail: 'Mechanic has no declared regression test.' });
        }
        if (mechanic.evidence.length === 0) {
            diagnostics.push({ severity: 'error', code: 'missing_implementation_evidence', subject: mechanic.mechanicId, detail: 'Mechanic has no implementation evidence.' });
        }
        const sourceMechanic = gameplay.graph.mechanics.find((item) => item.id === mechanic.mechanicId);
        const writesVisibleState = sourceMechanic?.writes.some((state) => playerVisibleStates.has(state)) ?? false;
        const hasFeedbackEvidence = mechanic.evidence.some((reference) => /renderer|hud|feedback/i.test(reference.path));
        const hasFeedbackEdge = gameplay.graph.edges.some(
            (edge) =>
                (edge.source === mechanic.mechanicId && edge.target === 'feedback.gameplay_hud') ||
                (edge.target === mechanic.mechanicId && edge.source === 'feedback.gameplay_hud')
        );
        if (writesVisibleState && !hasFeedbackEvidence && !hasFeedbackEdge) {
            diagnostics.push({ severity: 'error', code: 'missing_player_feedback', subject: mechanic.mechanicId, detail: 'Writes player-visible state without renderer evidence or a gameplay feedback edge.' });
        }
    }
    for (const state of gameplay.states) {
        if (state.writtenBy.length > 0 && state.readBy.length === 0 && !state.name.endsWith('Report') && !state.name.endsWith('Plan')) {
            diagnostics.push({ severity: 'warning', code: 'write_without_reader', subject: state.name, detail: `Written by ${state.writtenBy.join(', ')}` });
        }
    }
    for (const field of runStateFields) {
        if (field.readReferences.length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'run_state_field_without_reader',
                subject: field.name,
                detail: field.writeReferences.length > 0
                    ? `Written at ${field.writeReferences.map((reference) => `${reference.path}:${reference.line}`).join(', ')} but never read by production source.`
                    : 'Declared on RunState but never read or written by production source.'
            });
        }
    }
    for (const location of rendererRunStateWriteLocations(runStateFields)) {
        diagnostics.push({
            severity: 'error',
            code: 'renderer_run_state_write',
            subject: `${location.path}:L${location.line}`,
            detail: `Renderer ${location.accessKind} writes core-owned RunState fields: ${location.fields.join(', ')}.`
        });
    }
    for (const budget of orchestrationBudgets) {
        if (budget.lineCount === null || budget.importCount === null) {
            diagnostics.push({
                severity: 'error',
                code: 'orchestration_budget_file_missing',
                subject: budget.path,
                detail: 'Configured orchestration budget has no indexed source file.'
            });
        } else if (!budget.withinBudget) {
            diagnostics.push({
                severity: 'error',
                code: 'orchestration_budget_exceeded',
                subject: budget.path,
                detail: `${budget.lineCount}/${budget.maxLines} lines and ${budget.importCount}/${budget.maxImports} imports.`
            });
        }
    }
    for (const command of gameplayCommands) {
        if (command.handlerReferences.length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'gameplay_command_without_handler',
                subject: command.name,
                detail: 'Declared by gameplayCommandSchema but not dispatched by reduceGameplayCommand.'
            });
        }
        if (command.testReferences.length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'gameplay_protocol_variant_without_test',
                subject: command.name,
                detail: 'Gameplay command variant has no exact test-source reference.'
            });
        }
    }
    for (const event of gameplayEvents) {
        if (event.emitterReferences.length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'gameplay_event_without_emitter',
                subject: event.name,
                detail: 'Declared by gameplayEventSchema but never emitted by production source.'
            });
        }
        if (event.testReferences.length === 0) {
            diagnostics.push({
                severity: 'error',
                code: 'gameplay_protocol_variant_without_test',
                subject: event.name,
                detail: 'Gameplay event variant has no exact test-source reference.'
            });
        }
    }
    const feedbackEvent = gameplayEvents.find((event) => event.name === 'feedback.requested');
    if (!feedbackEvent || !feedbackEvent.consumerReferences.some((reference) => reference.path.startsWith('src/renderer/'))) {
        diagnostics.push({
            severity: 'error',
            code: 'gameplay_feedback_event_without_display_consumer',
            subject: 'feedback.requested',
            detail: 'Typed feedback event has no exact renderer consumer reference.'
        });
    }
    const modeledMechanicIds = new Set(gameplay.mechanics.map((mechanic) => mechanic.mechanicId));
    for (const registry of CONTENT_REGISTRIES) {
        const uncovered = content
            .filter((item) => item.registry === registry.variable)
            .filter((item) => !modeledMechanicIds.has(item.expectedMechanicId));
        if (uncovered.length > 0) {
            diagnostics.push({
                severity: 'warning',
                code: 'unmodeled_content_family',
                subject: registry.kind,
                detail: `${uncovered.length} source-declared items lack mechanic nodes: ${uncovered.map((item) => item.contentId).join(', ')}`
            });
        }
    }
    return diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subject}`.localeCompare(`${b.severity}:${b.code}:${b.subject}`));
};

export const buildAiRepoModel = (repoRoot = defaultRepoRoot) => {
    const inventory = buildInventory(repoRoot);
    const code = buildCodeIndex(repoRoot);
    const content = buildContentIndex(repoRoot);
    const playerVisibleStates = new Set(readLiteralRegistryValues(repoRoot, PLAYER_VISIBLE_STATE_REGISTRY));
    const gameplay = buildGameplayIndex(repoRoot, playerVisibleStates);
    const rendererRunStateWrites = rendererRunStateWriteLocations(code.runStateFields);
    const orchestration = buildOrchestrationBudgetIndex(code.files);
    const diagnostics = buildDiagnostics(
        repoRoot,
        gameplay,
        content.content,
        playerVisibleStates,
        code.runStateFields,
        code.gameplayCommands,
        code.gameplayEvents,
        orchestration.budgets
    );
    const relationships = [
        ...code.relationships,
        ...content.relationships,
        ...gameplay.relationships,
        ...orchestration.relationships
    ].sort((a, b) => a.id.localeCompare(b.id));
    return {
        schemaVersion: MODEL_VERSION,
        generator: 'scripts/ai-repo-model.mjs',
        repository: {
            name: JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).name,
            trackedFileCount: inventory.length,
            codeFileCount: code.files.length,
            exportedSymbolCount: code.symbols.length,
            contentItemCount: content.content.length,
            mechanicCount: gameplay.mechanics.length,
            stateFieldCount: gameplay.states.length,
            runStateFieldCount: code.runStateFields.length,
            dormantRunStateFieldCount: code.runStateFields.filter((field) => field.readReferences.length === 0).length,
            rendererRunStateWriteCount: rendererRunStateWrites.length,
            orchestrationBudgetViolationCount: orchestration.budgets.filter((budget) => !budget.withinBudget).length,
            gameplayCommandTypeCount: code.gameplayCommands.length,
            gameplayEventTypeCount: code.gameplayEvents.length,
            unhandledGameplayCommandTypeCount: code.gameplayCommands.filter((command) => command.handlerReferences.length === 0).length,
            unemittedGameplayEventTypeCount: code.gameplayEvents.filter((event) => event.emitterReferences.length === 0).length,
            untestedGameplayProtocolTypeCount: [...code.gameplayCommands, ...code.gameplayEvents].filter(
                (variant) => variant.testReferences.length === 0
            ).length,
            playerVisibleStateCount: playerVisibleStates.size,
            relationshipCount: relationships.length
        },
        inventory,
        files: code.files,
        symbols: code.symbols,
        content: content.content,
        mechanics: gameplay.mechanics,
        states: gameplay.states,
        runStateFields: code.runStateFields,
        orchestrationBudgets: orchestration.budgets,
        gameplayCommands: code.gameplayCommands,
        gameplayEvents: code.gameplayEvents,
        playerVisibleStates: [...playerVisibleStates].sort((a, b) => a.localeCompare(b)),
        relationships,
        diagnostics
    };
};

export const validateAiRepoModel = (model) => {
    const issues = [];
    if (model.schemaVersion !== MODEL_VERSION) issues.push(`Unsupported schemaVersion ${model.schemaVersion}.`);
    const runStateFields = Array.isArray(model.runStateFields) ? model.runStateFields : [];
    if (runStateFields.length !== model.repository.runStateFieldCount) {
        issues.push('repository.runStateFieldCount does not match runStateFields.');
    }
    const dormantRunStateFields = runStateFields.filter((field) => field.readReferences.length === 0);
    if (dormantRunStateFields.length !== model.repository.dormantRunStateFieldCount) {
        issues.push('repository.dormantRunStateFieldCount does not match runStateFields.');
    }
    if (runStateFields.some(
        (field) => field.writeReferences.some((reference) => !RUN_STATE_WRITE_ACCESS_KINDS.has(reference.accessKind))
    )) {
        issues.push('runStateFields contains a write reference with an unsupported accessKind.');
    }
    if (rendererRunStateWriteLocations(runStateFields).length !== model.repository.rendererRunStateWriteCount) {
        issues.push('repository.rendererRunStateWriteCount does not match runStateFields.');
    }
    const orchestrationBudgets = Array.isArray(model.orchestrationBudgets) ? model.orchestrationBudgets : [];
    const expectedOrchestrationBudgets = buildOrchestrationBudgetIndex(model.files).budgets;
    if (JSON.stringify(orchestrationBudgets) !== JSON.stringify(expectedOrchestrationBudgets)) {
        issues.push('orchestrationBudgets does not match configured source-file budgets.');
    }
    if (
        orchestrationBudgets.filter((budget) => !budget.withinBudget).length !==
        model.repository.orchestrationBudgetViolationCount
    ) {
        issues.push('repository.orchestrationBudgetViolationCount does not match orchestrationBudgets.');
    }
    const gameplayCommands = Array.isArray(model.gameplayCommands) ? model.gameplayCommands : [];
    const gameplayEvents = Array.isArray(model.gameplayEvents) ? model.gameplayEvents : [];
    if (gameplayCommands.length !== model.repository.gameplayCommandTypeCount) {
        issues.push('repository.gameplayCommandTypeCount does not match gameplayCommands.');
    }
    if (gameplayEvents.length !== model.repository.gameplayEventTypeCount) {
        issues.push('repository.gameplayEventTypeCount does not match gameplayEvents.');
    }
    if (
        gameplayCommands.filter((command) => command.handlerReferences.length === 0).length !==
        model.repository.unhandledGameplayCommandTypeCount
    ) {
        issues.push('repository.unhandledGameplayCommandTypeCount does not match gameplayCommands.');
    }
    if (
        gameplayEvents.filter((event) => event.emitterReferences.length === 0).length !==
        model.repository.unemittedGameplayEventTypeCount
    ) {
        issues.push('repository.unemittedGameplayEventTypeCount does not match gameplayEvents.');
    }
    if (
        [...gameplayCommands, ...gameplayEvents].filter((variant) => variant.testReferences.length === 0).length !==
        model.repository.untestedGameplayProtocolTypeCount
    ) {
        issues.push('repository.untestedGameplayProtocolTypeCount does not match gameplay protocol variants.');
    }
    const playerVisibleStates = Array.isArray(model.playerVisibleStates) ? model.playerVisibleStates : [];
    if (playerVisibleStates.length !== model.repository.playerVisibleStateCount) {
        issues.push('repository.playerVisibleStateCount does not match playerVisibleStates.');
    }
    const modeledStateNames = new Set(model.states.map((state) => state.name));
    for (const state of playerVisibleStates) {
        if (!modeledStateNames.has(state)) issues.push(`Player-visible state ${state} is not modeled by the gameplay graph.`);
    }
    const playerVisibleStateSet = new Set(playerVisibleStates);
    for (const state of model.states) {
        if (state.playerVisible !== playerVisibleStateSet.has(state.name)) {
            issues.push(`${state.id} has stale playerVisible metadata.`);
        }
    }
    const allNodeIds = [
        ...model.inventory.map((item) => fileId(item.path)),
        ...model.files.map((node) => node.id),
        ...model.symbols.map((node) => node.id),
        ...model.content.map((node) => node.id),
        ...model.mechanics.map((node) => node.id),
        ...model.states.map((node) => node.id),
        ...runStateFields.map((node) => node.id),
        ...orchestrationBudgets.map((node) => node.id),
        ...gameplayCommands.map((node) => node.id),
        ...gameplayEvents.map((node) => node.id)
    ];
    const nodeIds = new Set(allNodeIds);
    const duplicateNodeIds = uniqueSorted(allNodeIds.filter((id, index) => allNodeIds.indexOf(id) !== index));
    for (const id of duplicateNodeIds) {
        if (!id.startsWith('file:')) issues.push(`Duplicate node id ${id}.`);
    }
    const relationshipIds = model.relationships.map((item) => item.id);
    for (const id of uniqueSorted(relationshipIds.filter((value, index) => relationshipIds.indexOf(value) !== index))) {
        issues.push(`Duplicate relationship id ${id}.`);
    }
    for (const relationship of model.relationships) {
        if (!nodeIds.has(relationship.source)) issues.push(`${relationship.id} has missing source ${relationship.source}.`);
        if (!nodeIds.has(relationship.target)) issues.push(`${relationship.id} has missing target ${relationship.target}.`);
    }
    for (const diagnostic of model.diagnostics.filter((item) => item.severity === 'error')) {
        issues.push(`${diagnostic.code}: ${diagnostic.subject} (${diagnostic.detail})`);
    }
    return uniqueSorted(issues);
};

export const queryAiRepoModel = (model, query, limit = 40) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { query, nodes: [], relationships: [] };
    const codePaths = new Set(model.files.map((item) => item.path));
    const candidates = [
        ...model.inventory.filter((item) => !codePaths.has(item.path)).map((item) => ({ type: 'artifact', id: fileId(item.path), ...item })),
        ...model.files.map((item) => ({ type: 'file', ...item })),
        ...model.symbols.map((item) => ({ type: 'symbol', ...item })),
        ...model.content.map((item) => ({ type: 'content', ...item })),
        ...model.mechanics.map((item) => ({ type: 'mechanic', ...item })),
        ...model.states.map((item) => ({ type: 'state', ...item })),
        ...(model.runStateFields ?? []).map((item) => ({ type: 'run_state_field', ...item })),
        ...(model.orchestrationBudgets ?? []).map((item) => ({ type: 'orchestration_budget', ...item })),
        ...(model.gameplayCommands ?? []).map((item) => ({ type: 'gameplay_command', ...item })),
        ...(model.gameplayEvents ?? []).map((item) => ({ type: 'gameplay_event', ...item }))
    ];
    const nodes = candidates
        .filter((item) => JSON.stringify(item).toLowerCase().includes(needle))
        .slice(0, limit);
    const ids = new Set(nodes.map((item) => item.id));
    const relationships = model.relationships
        .filter((item) => ids.has(item.source) || ids.has(item.target))
        .slice(0, limit * 4);
    return { query, nodes, relationships };
};

const serialize = (model) => `${JSON.stringify(model, null, 2)}\n`;

const main = () => {
    const args = process.argv.slice(2);
    const outputPath = path.join(defaultRepoRoot, AI_REPO_MODEL_PATH);
    const queryIndex = args.findIndex((arg) => arg === '--query' || arg.startsWith('--query='));
    if (queryIndex >= 0) {
        if (!fs.existsSync(outputPath)) throw new Error(`${AI_REPO_MODEL_PATH} is missing. Run yarn ai:model.`);
        const model = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        const validationIssues = validateAiRepoModel(model);
        if (validationIssues.length > 0) throw new Error(`AI repository model is invalid:\n${validationIssues.join('\n')}`);
        const query = args[queryIndex].includes('=') ? args[queryIndex].slice(args[queryIndex].indexOf('=') + 1) : args[queryIndex + 1] ?? '';
        process.stdout.write(`${JSON.stringify(queryAiRepoModel(model, query), null, 2)}\n`);
        return;
    }
    const model = buildAiRepoModel(defaultRepoRoot);
    const validationIssues = validateAiRepoModel(model);
    if (validationIssues.length > 0) {
        throw new Error(`AI repository model validation failed:\n${validationIssues.map((issue) => `- ${issue}`).join('\n')}`);
    }
    if (args.includes('--write')) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, serialize(model), 'utf8');
        process.stdout.write(`Wrote ${AI_REPO_MODEL_PATH} (${model.repository.relationshipCount} relationships).\n`);
        return;
    }
    if (args.includes('--check')) {
        if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialize(model)) {
            throw new Error(`${AI_REPO_MODEL_PATH} is stale. Run yarn ai:model.`);
        }
        process.stdout.write(`${AI_REPO_MODEL_PATH} is current and valid.\n`);
        return;
    }
    process.stdout.write(`${JSON.stringify({ repository: model.repository, diagnostics: model.diagnostics }, null, 2)}\n`);
};

const thisFile = fileURLToPath(import.meta.url);
if (path.normalize(thisFile) === path.normalize(path.resolve(process.argv[1] ?? ''))) main();
