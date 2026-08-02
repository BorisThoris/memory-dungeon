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
const MODEL_VERSION = 2;
const GENERATED_PATHS = new Set([AI_REPO_MODEL_PATH]);
const CONTENT_REGISTRIES = [
    { kind: 'build_archetype', file: 'src/shared/relics.ts', variable: 'RELIC_BUILD_ARCHETYPE_ORDER', mechanicPrefix: 'build' },
    { kind: 'relic', file: 'src/shared/relics.ts', variable: 'RELIC_POOL', mechanicPrefix: 'relic' },
    { kind: 'findable', file: 'src/shared/findables.ts', variable: 'FINDABLE_REWARD_ROW_ORDER', mechanicPrefix: 'findable' },
    { kind: 'inventory_item', file: 'src/shared/run-inventory.ts', variable: 'RUN_INVENTORY_ITEM_IDS', mechanicPrefix: 'inventory' },
    { kind: 'bonus_reward', file: 'src/shared/bonus-rewards.ts', variable: 'BONUS_REWARD_IDS', mechanicPrefix: 'reward' }
];
const PLAYER_VISIBLE_STATES = new Set([
    'achievementProgress',
    'bossTrophyCacheOutcome',
    'comboShards',
    'currentLevelScore',
    'dungeonEnemiesDefeatedThisFloor',
    'enemyHazardsDefeatedThisFloor',
    'feedbackLines',
    'guardTokens',
    'interactionTags',
    'lastLevelResult',
    'lives',
    'nextFloor',
    'objectiveCompleted',
    'peekCharges',
    'recallFocus',
    'regionShuffleCharges',
    'relicFavorProgress',
    'relicOffer',
    'routeChoices',
    'score',
    'sessionStats',
    'shopGold',
    'totalScore',
    'triesDelta'
]);
const TERMINAL_MECHANIC_IDS = new Set([
    'board.cleanup',
    'feedback.gameplay_hud',
    'objective.floor_clear',
    'progression.run_flow',
    'stats.session_tracking'
]);

const toPosix = (value) => value.split(path.sep).join('/');
const fromRoot = (repoRoot, value) => toPosix(path.relative(repoRoot, path.normalize(value)));
const fileId = (value) => `file:${value}`;
const symbolId = (file, name) => `symbol:${file}#${name}`;
const mechanicId = (value) => `mechanic:${value}`;
const stateId = (value) => `state:${value}`;
const contentId = (kind, value) => `content:${kind}.${value}`;
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

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
    symbols.sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return { files, symbols, relationships };
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

const buildGameplayIndex = (repoRoot) => {
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
        .map((state) => ({ ...state, readBy: uniqueSorted(state.readBy), writtenBy: uniqueSorted(state.writtenBy) }))
        .sort((a, b) => a.id.localeCompare(b.id));
    relationships.sort((a, b) => a.id.localeCompare(b.id));
    return { mechanics, states: normalizedStates, relationships, graph };
};

const buildDiagnostics = (repoRoot, gameplay, content) => {
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
        const writesVisibleState = sourceMechanic?.writes.some((state) => PLAYER_VISIBLE_STATES.has(state)) ?? false;
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
    const gameplay = buildGameplayIndex(repoRoot);
    const diagnostics = buildDiagnostics(repoRoot, gameplay, content.content);
    const relationships = [...code.relationships, ...content.relationships, ...gameplay.relationships].sort((a, b) => a.id.localeCompare(b.id));
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
            relationshipCount: relationships.length
        },
        inventory,
        files: code.files,
        symbols: code.symbols,
        content: content.content,
        mechanics: gameplay.mechanics,
        states: gameplay.states,
        relationships,
        diagnostics
    };
};

export const validateAiRepoModel = (model) => {
    const issues = [];
    if (model.schemaVersion !== MODEL_VERSION) issues.push(`Unsupported schemaVersion ${model.schemaVersion}.`);
    const allNodeIds = [
        ...model.inventory.map((item) => fileId(item.path)),
        ...model.files.map((node) => node.id),
        ...model.symbols.map((node) => node.id),
        ...model.content.map((node) => node.id),
        ...model.mechanics.map((node) => node.id),
        ...model.states.map((node) => node.id)
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
        ...model.states.map((item) => ({ type: 'state', ...item }))
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
