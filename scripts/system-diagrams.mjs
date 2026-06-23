/**
 * Build high-level system diagrams for the app. The output is intentionally
 * small enough for architectural review while still linking back to concrete files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectGraphData } from './graph-project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');

const DIAGRAM_IDS = [
    'navigation-flow',
    'gameplay-resolution',
    'board-generation',
    'rewards-economy',
    'trait-systems'
];

const evidence = (repoRoot, candidates) =>
    candidates
        .map((candidate) => candidate.replaceAll('\\', '/'))
        .filter((candidate) => fs.existsSync(path.join(repoRoot, candidate)));

const readText = (repoRoot, rel) => {
    const abs = path.join(repoRoot, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
};

const countBy = (items, pick) =>
    items.reduce((acc, item) => {
        const key = pick(item);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

const diagramStats = (diagram) => ({
    nodeCount: diagram.nodes.length,
    edgeCount: diagram.edges.length,
    findingCount: diagram.findings.length
});

const edge = (source, target, label, kind = 'flow') => ({
    id: `${source}->${target}:${label}`,
    source,
    target,
    label,
    kind
});

const node = (id, label, kind, layer, detail, evidencePaths) => ({
    id,
    label,
    kind,
    layer,
    detail,
    evidence: evidencePaths
});

const finding = (id, severity, title, detail, evidencePaths) => ({
    id,
    severity,
    title,
    detail,
    evidence: evidencePaths
});

const action = (id, priority, system, title, detail, verifies, evidencePaths) => ({
    id,
    priority,
    system,
    title,
    detail,
    verifies,
    evidence: evidencePaths
});

const hasText = (repoRoot, rel, needle) => readText(repoRoot, rel).includes(needle);

const buildNavigationDiagram = (repoRoot) => {
    const navEvidence = evidence(repoRoot, [
        'src/renderer/App.tsx',
        'src/renderer/store/useAppStore.ts',
        'src/renderer/store/navigationModel.ts',
        'docs/new_design/NAVIGATION_MODEL.md'
    ]);
    const hasContracts = hasText(repoRoot, 'src/renderer/store/navigationModel.ts', 'NAVIGATION_ROUTE_CONTRACTS');
    return {
        id: 'navigation-flow',
        title: 'Navigation Flow',
        summary: 'Route contracts, shell chrome, and app store actions define how players move between screens.',
        nodes: [
            node('route_contracts', 'Route Contracts', 'contract', 'renderer', 'Allowed route transitions and action labels.', navEvidence),
            node('app_store', 'App Store', 'state', 'renderer', 'Central zustand state applies navigation actions.', evidence(repoRoot, ['src/renderer/store/useAppStore.ts'])),
            node('app_shell', 'App Shell', 'ui', 'renderer', 'Top-level route rendering and shell chrome.', evidence(repoRoot, ['src/renderer/App.tsx'])),
            node('screens', 'Playable Screens', 'ui', 'renderer', 'Menu, run map, gameplay, shop, rewards, and meta screens.', evidence(repoRoot, ['src/renderer/App.tsx', 'src/renderer/screens']))
        ],
        edges: [
            edge('route_contracts', 'app_store', 'validated by'),
            edge('app_store', 'app_shell', 'drives route'),
            edge('app_shell', 'screens', 'renders')
        ],
        findings: [
            finding(
                'nav-contract-drift',
                hasContracts ? 'info' : 'risk',
                hasContracts ? 'Navigation has explicit route contracts' : 'Navigation contracts were not detected',
                hasContracts
                    ? 'Keep new overlays, route actions, and shell chrome behavior registered in navigationModel so diagram and tests remain aligned.'
                    : 'Add or restore explicit route contracts before expanding navigation; otherwise route drift is hard to audit.',
                navEvidence
            )
        ],
        actions: [
            action(
                'nav-contract-drift-guard',
                'P2',
                'Navigation Flow',
                'Keep route contracts authoritative',
                'When adding any route, overlay, or shell chrome state, add or update a navigation contract plus a focused renderer/store regression.',
                'Route action cannot bypass App shell state or strand the player on a stale screen.',
                navEvidence
            )
        ]
    };
};

const buildGameplayDiagram = (repoRoot) => {
    const softlockEvidence = evidence(repoRoot, [
        'src/shared/game.ts',
        'src/shared/softlock-fairness.test.ts',
        'src/shared/board-power-actions.ts',
        'src/shared/hazard-tiles.ts',
        'src/shared/enemy-resolution.ts'
    ]);
    return {
        id: 'gameplay-resolution',
        title: 'Gameplay Resolution',
        summary: 'Card flips resolve through matching, traits, hazards, enemies, board powers, scoring, and run progression.',
        nodes: [
            node('input', 'Player Input', 'interaction', 'renderer', 'Flip, inspect, match, shuffle, swap, and consume powers.', evidence(repoRoot, ['src/renderer/App.tsx', 'src/renderer/components'])),
            node('rules', 'Shared Rules', 'domain', 'shared', 'Pure rules resolve matches, hazards, traits, enemies, and resources.', evidence(repoRoot, ['src/shared/game.ts', 'src/shared/tile-trait-rules.ts'])),
            node('board_powers', 'Board Powers', 'domain', 'shared', 'Peek, shuffle, region shuffle, and swap modify board state under legality rules.', evidence(repoRoot, ['src/shared/board-power-actions.ts', 'src/shared/board-power-availability.ts'])),
            node('feedback', 'HUD Feedback', 'ui', 'renderer', 'Gameplay HUD exposes route, trait, resource, and action state.', evidence(repoRoot, ['src/renderer/components/GameplayHudBar.tsx'])),
            node('progression', 'Run Progression', 'domain', 'shared', 'Room completion advances route, rewards, shops, elites, and bosses.', evidence(repoRoot, ['src/shared/run-map.ts', 'src/shared/bonus-rewards.ts']))
        ],
        edges: [
            edge('input', 'rules', 'dispatches action'),
            edge('rules', 'board_powers', 'checks legality'),
            edge('rules', 'feedback', 'publishes state'),
            edge('rules', 'progression', 'completes rooms')
        ],
        findings: [
            finding(
                'resolution-blast-radius',
                'warning',
                'Gameplay resolution has a wide blast radius',
                'Changes to match resolution should keep focused tests around softlocks, powers, enemies, traits, HUD route copy, and progression because these systems share the same action loop.',
                softlockEvidence
            )
        ],
        actions: [
            action(
                'resolution-slice-gate',
                'P1',
                'Gameplay Resolution',
                'Use a focused action-loop gate for match changes',
                'Match, enemy, hazard, board-power, and trait changes should run `yarn gate:action-loop` before full-suite handoff.',
                'A change in one resolver branch cannot silently regress another branch of the same turn loop.',
                softlockEvidence
            )
        ]
    };
};

const buildBoardGenerationDiagram = (repoRoot) => {
    const boardEvidence = evidence(repoRoot, [
        'src/shared/board-generation.ts',
        'src/shared/board-build-rules.ts',
        'src/shared/softlock-fairness.test.ts',
        'src/shared/softlock-generator-contract.ts',
        'src/shared/softlock-generator-contract.test.ts',
        'src/shared/board-tile-generation-rules.ts',
        'src/shared/objective-rules.ts'
    ]);
    return {
        id: 'board-generation',
        title: 'Board Generation',
        summary: 'Room identity, objectives, tile pools, trait overlays, and repair rules build playable boards.',
        nodes: [
            node('room_context', 'Room Context', 'domain', 'shared', 'Floor, route, lock, objective, mutator, and seed inputs.', evidence(repoRoot, ['src/shared/run-map.ts', 'src/shared/contracts.ts'])),
            node('tile_pool', 'Tile Pool', 'domain', 'shared', 'Base pairs, enemies, hazards, findables, locks, and supports.', evidence(repoRoot, ['src/shared/board-tile-generation-rules.ts'])),
            node('trait_overlay', 'Trait Overlay', 'domain', 'shared', 'Trait-aware generation places comboable and reactive tile traits.', evidence(repoRoot, ['src/shared/tile-trait-rules.ts'])),
            node('softlock_repair', 'Softlock Repair', 'safety', 'shared', 'Post-generation pass repairs missing keys, exits, and completion routes.', boardEvidence),
            node('board_state', 'Board State', 'state', 'shared', 'Serializable board consumed by renderer and resolution rules.', evidence(repoRoot, ['src/shared/contracts.ts', 'src/shared/board-generation.ts']))
        ],
        edges: [
            edge('room_context', 'tile_pool', 'selects pool'),
            edge('tile_pool', 'trait_overlay', 'adds traits'),
            edge('trait_overlay', 'softlock_repair', 'validated by'),
            edge('softlock_repair', 'board_state', 'emits')
        ],
        findings: [
            finding(
                'repair-is-contract',
                'warning',
                'Softlock repair is part of the generation contract',
                'Treat repair as required generation behavior, not a cleanup detail. New locks, blockers, objectives, or trait blockers need property tests that prove at least one completion route remains.',
                boardEvidence
            )
        ],
        actions: [
            action(
                'softlock-generation-matrix',
                'P0',
                'Board Generation',
                'Extend the softlock matrix for every new blocker',
                'New locks, trait blockers, enemies, objectives, or exit states must add a softlock-fairness or softlock-generator-contract case that proves a completion path exists after generation and repair.',
                'Generated boards remain completable even when repair has to intervene.',
                boardEvidence
            )
        ]
    };
};

const buildRewardsEconomyDiagram = (repoRoot) => {
    const rewardEvidence = evidence(repoRoot, [
        'src/shared/bonus-rewards.ts',
        'src/shared/shop-rules.ts',
        'src/shared/relics.ts',
        'src/shared/economy-ledger.ts',
        'src/shared/balance-simulation.ts'
    ]);
    return {
        id: 'rewards-economy',
        title: 'Rewards And Economy',
        summary: 'Rewards, shops, relics, gold, shards, and route priorities decide what the player can buy or draft.',
        nodes: [
            node('reward_rooms', 'Reward Rooms', 'domain', 'shared', 'Bonus reward rooms grant gold, traits, relics, or board tools.', evidence(repoRoot, ['src/shared/bonus-rewards.ts'])),
            node('shop_catalog', 'Shop Catalog', 'domain', 'shared', 'Shop services and items route scarce keys, powers, relics, and trait tools.', evidence(repoRoot, ['src/shared/shop-rules.ts'])),
            node('economy_ledger', 'Economy Ledger', 'state', 'shared', 'Ledger records inflows, sinks, caps, and reward claims.', evidence(repoRoot, ['src/shared/economy-ledger.ts'])),
            node('balance_sim', 'Balance Simulation', 'analysis', 'shared', 'Simulation watches access, spend, route pressure, and trait floor share.', evidence(repoRoot, ['src/shared/balance-simulation.ts'])),
            node('reward_ui', 'Reward UI', 'ui', 'renderer', 'Renderer shows pickable rewards and shop decisions.', evidence(repoRoot, ['src/renderer/components', 'src/renderer/App.tsx']))
        ],
        edges: [
            edge('reward_rooms', 'economy_ledger', 'records claim'),
            edge('shop_catalog', 'economy_ledger', 'spends and grants'),
            edge('economy_ledger', 'balance_sim', 'sampled by'),
            edge('shop_catalog', 'reward_ui', 'presented in'),
            edge('reward_rooms', 'reward_ui', 'presented in')
        ],
        findings: [
            finding(
                'priority-overlap',
                'warning',
                'Reward priority overlaps need regression coverage',
                'Key, boss, loadout, trait-routing, and shop-service offers compete for limited slots. Keep tests around priority ordering so fun trait tools do not hide required progression items.',
                rewardEvidence
            )
        ],
        actions: [
            action(
                'reward-priority-gate',
                'P1',
                'Rewards And Economy',
                'Lock reward priority slots before adding fun offers',
                'Any new shop or reward offer must prove it does not displace required keys, boss access, loadout recovery, or trait-route starter support.',
                'Progression-critical offers remain reachable while optional trait tools still appear.',
                rewardEvidence
            )
        ]
    };
};

const buildTraitDiagram = (repoRoot) => {
    const traitEvidence = evidence(repoRoot, [
        'src/shared/tile-trait-rules.ts',
        'src/shared/tile-trait-rules.test.ts',
        'src/shared/board-power-actions.ts',
        'src/shared/balance-simulation.ts',
        'src/renderer/components/GameplayHudBar.tsx'
    ]);
    return {
        id: 'trait-systems',
        title: 'Trait Systems',
        summary: 'Traits are a third gameplay layer: placement, matching, blockers, interactions, rewards, powers, and HUD visibility.',
        nodes: [
            node('trait_catalog', 'Trait Catalog', 'domain', 'shared', 'Trait definitions, combos, blockers, and interaction hooks.', evidence(repoRoot, ['src/shared/tile-trait-rules.ts'])),
            node('trait_generation', 'Trait Generation', 'domain', 'shared', 'Board generation seeds route-visible trait opportunities.', evidence(repoRoot, ['src/shared/board-generation.ts', 'src/shared/board-tile-generation-rules.ts'])),
            node('trait_actions', 'Trait Actions', 'domain', 'shared', 'Matches and board powers create, move, reveal, or block trait opportunities.', evidence(repoRoot, ['src/shared/board-power-actions.ts', 'src/shared/game.ts'])),
            node('trait_rewards', 'Trait Rewards', 'economy', 'shared', 'Rewards and shops let players build toward trait routes.', evidence(repoRoot, ['src/shared/bonus-rewards.ts', 'src/shared/shop-rules.ts'])),
            node('trait_feedback', 'Trait Feedback', 'ui', 'renderer', 'HUD and tile faces make combo routes readable immediately.', evidence(repoRoot, ['src/renderer/components/GameplayHudBar.tsx', 'src/renderer/cardFace']))
        ],
        edges: [
            edge('trait_catalog', 'trait_generation', 'informs placement'),
            edge('trait_generation', 'trait_actions', 'creates opportunities'),
            edge('trait_actions', 'trait_rewards', 'drives build value'),
            edge('trait_rewards', 'trait_catalog', 'expands catalog access'),
            edge('trait_actions', 'trait_feedback', 'explains state')
        ],
        findings: [
            finding(
                'traits-as-core-loop',
                'info',
                'Traits are now core-loop material',
                'Keep trait opportunities visible from early floors and track trait-match-route floor share in simulation whenever adding new interactions or blockers.',
                traitEvidence
            )
        ],
        actions: [
            action(
                'trait-route-visibility-gate',
                'P1',
                'Trait Systems',
                'Keep traits visible as a third mechanic',
                'New trait interactions should update simulation visibility metrics, first-run HUD smoke, and at least one `yarn gate:action-loop` board-power interaction case.',
                'Trait routes stay present early and interact with movement/shuffle tools instead of becoming rare flavor.',
                traitEvidence
            )
        ]
    };
};

const extractRulesVersion = (repoRoot) => {
    const contracts = readText(repoRoot, 'src/shared/contracts.ts');
    const match = contracts.match(/GAME_RULES_VERSION\s*=\s*(\d+)/);
    return match ? Number(match[1]) : null;
};

/**
 * @param {string} repoRoot
 */
export function buildSystemDiagramData(repoRoot = defaultRepoRoot) {
    const importGraph = process.env.SYSTEM_DIAGRAMS_SKIP_IMPORT_GRAPH === '1'
        ? { nodes: [], edges: [], stats: { fileCount: 0, edgeCount: 0 } }
        : buildProjectGraphData(repoRoot);
    const diagrams = [
        buildNavigationDiagram(repoRoot),
        buildGameplayDiagram(repoRoot),
        buildBoardGenerationDiagram(repoRoot),
        buildRewardsEconomyDiagram(repoRoot),
        buildTraitDiagram(repoRoot)
    ].map((diagram) => ({ ...diagram, stats: diagramStats(diagram) }));
    const actions = diagrams.flatMap((diagram) => diagram.actions);
    const layerCounts = countBy(importGraph.nodes, (n) => n.layer);
    return {
        generatedAt: new Date(0).toISOString(),
        rulesVersion: extractRulesVersion(repoRoot),
        diagrams,
        actions,
        stats: {
            diagramCount: diagrams.length,
            nodeCount: diagrams.reduce((sum, diagram) => sum + diagram.stats.nodeCount, 0),
            edgeCount: diagrams.reduce((sum, diagram) => sum + diagram.stats.edgeCount, 0),
            findingCount: diagrams.reduce((sum, diagram) => sum + diagram.stats.findingCount, 0),
            actionCount: actions.length,
            importGraph: {
                fileCount: importGraph.stats.fileCount,
                edgeCount: importGraph.stats.edgeCount,
                layers: layerCounts
            }
        }
    };
}

const mermaidId = (id) => id.replace(/[^A-Za-z0-9_]/g, '_');
const mermaidLabel = (value) => String(value).replaceAll('"', '\\"');

const renderDiagramMermaid = (diagram) => {
    const lines = ['```mermaid', 'flowchart LR'];
    for (const n of diagram.nodes) {
        lines.push(`    ${mermaidId(n.id)}["${mermaidLabel(n.label)}"]`);
    }
    for (const e of diagram.edges) {
        lines.push(`    ${mermaidId(e.source)} -->|"${mermaidLabel(e.label)}"| ${mermaidId(e.target)}`);
    }
    lines.push('```');
    return lines.join('\n');
};

/**
 * @param {ReturnType<typeof buildSystemDiagramData>} payload
 */
export function renderSystemDiagramsMarkdown(payload) {
    const lines = [
        '# System Diagrams',
        '',
        'Generated by `yarn docs:system-diagrams`. These diagrams are intentionally higher-level than `yarn graph:project` so they can be used for architectural review.',
        '',
        `- Diagrams: ${payload.stats.diagramCount}`,
        `- System nodes: ${payload.stats.nodeCount}`,
        `- System edges: ${payload.stats.edgeCount}`,
        `- Findings: ${payload.stats.findingCount}`,
        `- Audit actions: ${payload.stats.actionCount}`,
        `- Import graph: ${payload.stats.importGraph.fileCount} files, ${payload.stats.importGraph.edgeCount} edges`,
        payload.rulesVersion == null ? '- Rules version: unknown' : `- Rules version: ${payload.rulesVersion}`,
        '',
        '## Audit Actions',
        '',
        'These are the current system gaps or guardrails surfaced by the diagrams.',
        ''
    ];
    for (const item of payload.actions) {
        lines.push(`- **${item.priority} ${item.title}** (${item.system}): ${item.detail}`);
        lines.push(`  Verifies: ${item.verifies}`);
        if (item.evidence.length > 0) {
            lines.push(`  Evidence: ${item.evidence.map((p) => `\`${p}\``).join(', ')}`);
        }
    }
    lines.push('');
    for (const diagram of payload.diagrams) {
        lines.push(`## ${diagram.title}`, '', diagram.summary, '', renderDiagramMermaid(diagram), '');
        lines.push('### Findings', '');
        for (const item of diagram.findings) {
            lines.push(`- **${item.severity.toUpperCase()} ${item.title}.** ${item.detail}`);
            if (item.evidence.length > 0) {
                lines.push(`  Evidence: ${item.evidence.map((p) => `\`${p}\``).join(', ')}`);
            }
        }
        lines.push('', '### Evidence Nodes', '');
        for (const n of diagram.nodes) {
            const evidenceText = n.evidence.length > 0 ? n.evidence.map((p) => `\`${p}\``).join(', ') : 'none detected';
            lines.push(`- **${n.label}** (${n.kind}/${n.layer}): ${n.detail} Evidence: ${evidenceText}`);
        }
        lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
}

const main = () => {
    const payload = buildSystemDiagramData(defaultRepoRoot);
    if (process.argv.includes('--markdown')) {
        process.stdout.write(renderSystemDiagramsMarkdown(payload));
        return;
    }
    if (process.argv.includes('--check-docs')) {
        const outFile = path.join(defaultRepoRoot, 'docs', 'system-diagrams', 'README.md');
        const expected = renderSystemDiagramsMarkdown(payload);
        const actual = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
        if (actual !== expected) {
            process.stderr.write('docs/system-diagrams/README.md is stale. Run yarn docs:system-diagrams.\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('docs/system-diagrams/README.md is current\n');
        return;
    }
    if (process.argv.includes('--write-docs')) {
        const outDir = path.join(defaultRepoRoot, 'docs', 'system-diagrams');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'README.md'), renderSystemDiagramsMarkdown(payload), 'utf8');
        process.stdout.write('Wrote docs/system-diagrams/README.md\n');
        return;
    }
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const thisFile = fileURLToPath(import.meta.url);
if (path.normalize(thisFile) === path.normalize(path.resolve(process.argv[1] ?? ''))) {
    main();
}

export { DIAGRAM_IDS };
