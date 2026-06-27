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
    'gameplay-interaction-graph',
    'board-generation',
    'rewards-economy',
    'trait-systems',
    'persistence-save-flow',
    'renderer-input-flow',
    'audio-feedback-pipeline',
    'asset-card-rendering',
    'test-gate-architecture'
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

const loadGameplayInteractionGraph = (repoRoot) => {
    const rel = 'src/shared/gameplay-interaction-graph-data.json';
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
        throw new Error(`${rel} is missing. Add the executable gameplay interaction graph before generating diagrams.`);
    }
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!Array.isArray(parsed.mechanics) || !Array.isArray(parsed.edges)) {
        throw new Error(`${rel} must contain mechanics and edges arrays.`);
    }
    return parsed;
};

const loadActionRegistry = (repoRoot) => {
    const rel = 'docs/system-diagrams/actions.json';
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
        throw new Error(`${rel} is missing. Add action status/command metadata before generating system diagrams.`);
    }
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!Array.isArray(parsed.actions)) {
        throw new Error(`${rel} must contain an actions array.`);
    }
    return parsed.actions;
};

const mergeActionRegistry = (repoRoot, diagrams) => {
    const registry = loadActionRegistry(repoRoot);
    const registryById = new Map(registry.map((item) => [item.id, item]));
    const seen = new Set();
    const mergedDiagrams = diagrams.map((diagram) => ({
        ...diagram,
        actions: diagram.actions.map((item) => {
            const registered = registryById.get(item.id);
            if (!registered) {
                throw new Error(`Action ${item.id} is missing from docs/system-diagrams/actions.json.`);
            }
            seen.add(item.id);
            for (const key of ['priority', 'system', 'title']) {
                if (registered[key] !== item[key]) {
                    throw new Error(`Action ${item.id} registry ${key}=${registered[key]} does not match diagram ${key}=${item[key]}.`);
                }
            }
            const minimumEvidence = Math.max(1, Number(registered.minimumEvidence ?? 1));
            if (item.evidence.length < minimumEvidence) {
                throw new Error(`Action ${item.id} has ${item.evidence.length} evidence paths; registry requires ${minimumEvidence}.`);
            }
            if (!registered.status || !registered.command) {
                throw new Error(`Action ${item.id} registry entry must include status and command.`);
            }
            return {
                ...item,
                status: registered.status,
                command: registered.command,
                minimumEvidence
            };
        })
    }));
    const unused = registry.filter((item) => !seen.has(item.id));
    if (unused.length > 0) {
        throw new Error(`Unused action registry entries: ${unused.map((item) => item.id).join(', ')}`);
    }
    return mergedDiagrams;
};

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
                navEvidence,
                'done',
                'yarn gate:navigation'
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
                softlockEvidence,
                'done',
                'yarn gate:action-loop'
            )
        ]
    };
};

const buildGameplayInteractionGraphDiagram = (repoRoot) => {
    const graph = loadGameplayInteractionGraph(repoRoot);
    const graphEvidence = evidence(repoRoot, [
        'src/shared/gameplay-interaction-graph-data.json',
        'src/shared/gameplay-interaction-graph.ts',
        'src/shared/gameplay-interaction-graph.test.ts',
        'src/shared/softlock-fairness.test.ts',
        'src/shared/tile-trait-rules.ts',
        'src/shared/enemy-hazard-board-rules.ts'
    ]);
    const mechanicsByKind = countBy(graph.mechanics, (mechanic) => mechanic.kind);
    const blockers = graph.mechanics.filter((mechanic) => Array.isArray(mechanic.blocks) && mechanic.blocks.length > 0);
    const traitMechanics = graph.mechanics.filter((mechanic) => mechanic.kind === 'trait');
    const graphNodes = [
        node('traits', 'Trait Layer', 'domain', 'shared', `${mechanicsByKind.trait ?? 0} trait mechanics with synergy, risk, and counterplay edges.`, evidence(repoRoot, ['src/shared/tile-trait-rules.ts', 'src/shared/trait-opportunities.ts'])),
        node('powers', 'Board Powers', 'domain', 'shared', `${mechanicsByKind.power ?? 0} routing/removal tools connect player agency to trait layouts.`, evidence(repoRoot, ['src/shared/board-power-actions.ts', 'src/shared/board-power-availability.ts'])),
        node('hazards_bosses', 'Hazards And Bosses', 'domain', 'shared', 'Moving hazards and boss patrols must connect to defeat and safety routes.', evidence(repoRoot, ['src/shared/dungeon-enemy-hazard-rules.ts', 'src/shared/enemy-hazard-board-rules.ts', 'src/shared/dungeon-boss-rules.ts'])),
        node('exits_locks', 'Exits And Locks', 'domain', 'shared', 'Exit and lock blockers require reachable sources or repair routes.', evidence(repoRoot, ['src/shared/dungeon-exit-rules.ts', 'src/shared/dungeon-key-rules.ts', 'src/shared/board-inspection.ts'])),
        node('objectives', 'Objectives', 'domain', 'shared', 'Objectives must connect to exit activation or floor clear.', evidence(repoRoot, ['src/shared/dungeon-board-status.ts', 'src/shared/level-clear-rules.ts'])),
        node('safety_graph', 'Interaction Graph Gate', 'safety', 'shared', 'Typed graph validation fails disconnected mechanics, unguarded blockers, and unwired outputs.', graphEvidence)
    ];
    const graphEdges = [
        edge('traits', 'powers', 'repositioned by', 'counterplay'),
        edge('powers', 'traits', 'creates combos', 'flow'),
        edge('hazards_bosses', 'safety_graph', 'guarded by', 'safety'),
        edge('exits_locks', 'safety_graph', 'guarded by', 'safety'),
        edge('objectives', 'exits_locks', 'unblocks', 'flow'),
        edge('safety_graph', 'objectives', 'proves completion', 'safety')
    ];
    return {
        id: 'gameplay-interaction-graph',
        title: 'Gameplay Interaction Graph',
        summary: `Executable registry covers ${graph.mechanics.length} mechanics, ${graph.edges.length} edges, ${traitMechanics.length} tile traits, and ${blockers.length} blockers.`,
        nodes: graphNodes,
        edges: graphEdges,
        findings: [
            finding(
                'interaction-graph-is-executable',
                'info',
                'Cross-feature logic now has an executable graph',
                'Mechanics declare reads, writes, blockers, counterplay, softlock guards, evidence, and tests. Keep this registry current whenever adding traits, hazards, objectives, locks, powers, shops, or boss logic.',
                graphEvidence
            ),
            finding(
                'blockers-need-guards',
                'warning',
                'Every blocker needs counterplay or a softlock guard',
                `The graph currently tracks ${blockers.length} blocking mechanics. New blockers should fail validation unless they declare counterplay edges, tests, and softlock guards.`,
                graphEvidence
            )
        ],
        actions: [
            action(
                'gameplay-interaction-graph-gate',
                'P0',
                'Gameplay Interaction Graph',
                'Keep cross-feature mechanics in the executable graph',
                'Any new trait, hazard, boss, exit lock, objective, board power, shop service, or reward sink must update the gameplay interaction graph and keep its validation test passing.',
                'Disconnected mechanics, unguarded blockers, missing counterplay, and unwired state outputs fail before they can become softlocks.',
                graphEvidence
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
                boardEvidence,
                'done',
                'yarn gate:sim-softlock-seeds'
            ),
            action(
                'softlock-stress-sweep',
                'P1',
                'Board Generation',
                'Stress sweep generated seeds after progression changes',
                'Run a broader deterministic seed sweep when touching locks, bosses, exits, objectives, shops, or repair rules so rare schedule interactions are exercised before browser QA.',
                'Generated stress seeds clear without fairness issues, stale bosses, dead traits, or locked-exit regressions.',
                boardEvidence,
                'done',
                'yarn gate:sim-softlock-stress'
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
                rewardEvidence,
                'done',
                'yarn gate:rewards-economy'
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
                traitEvidence,
                'done',
                'yarn gate:action-loop'
            )
        ]
    };
};

const buildPersistenceDiagram = (repoRoot) => {
    const persistenceEvidence = evidence(repoRoot, [
        'src/main/persistence.ts',
        'src/main/persistence.test.ts',
        'src/main/persistence-write-error.test.ts',
        'src/shared/contracts.ts',
        'src/renderer/store/useAppStore.ts'
    ]);
    return {
        id: 'persistence-save-flow',
        title: 'Persistence Save Flow',
        summary: 'Main-process persistence, preload contracts, and renderer state decide how runs and settings survive app restarts.',
        nodes: [
            node('renderer_store', 'Renderer Store', 'state', 'renderer', 'Runtime state requests save, load, reset, and migration behavior.', evidence(repoRoot, ['src/renderer/store/useAppStore.ts'])),
            node('preload_contract', 'Preload Contract', 'contract', 'renderer', 'Typed IPC boundary exposes persistence calls to renderer code.', evidence(repoRoot, ['src/preload', 'src/shared/contracts.ts'])),
            node('main_persistence', 'Main Persistence', 'service', 'main', 'Disk-backed store reads, writes, and reports persistence errors.', evidence(repoRoot, ['src/main/persistence.ts'])),
            node('save_schema', 'Save Schema', 'contract', 'shared', 'Shared contracts define serializable save fields and rules version.', evidence(repoRoot, ['src/shared/contracts.ts'])),
            node('persistence_tests', 'Persistence Tests', 'gate', 'main', 'Regression tests cover normal writes and write-error handling.', persistenceEvidence)
        ],
        edges: [
            edge('renderer_store', 'preload_contract', 'calls through'),
            edge('preload_contract', 'main_persistence', 'bridges IPC'),
            edge('main_persistence', 'save_schema', 'serializes'),
            edge('main_persistence', 'persistence_tests', 'guarded by')
        ],
        findings: [
            finding(
                'save-contract-surface',
                'warning',
                'Save changes cross process boundaries',
                'Persistence changes need contract, main-process, and renderer-state checks together because a green domain test can still miss an IPC or serialization drift.',
                persistenceEvidence
            )
        ],
        actions: [
            action(
                'persistence-save-contract-gate',
                'P1',
                'Persistence Save Flow',
                'Gate save changes through cross-process tests',
                'Any save shape, rules version, or write-error change should run persistence tests plus typecheck before handoff.',
                'Save data remains serializable, loadable, and failure-tolerant across renderer and main process boundaries.',
                persistenceEvidence
            )
        ]
    };
};

const buildRendererInputDiagram = (repoRoot) => {
    const inputEvidence = evidence(repoRoot, [
        'src/renderer/components/TileBoard.tsx',
        'src/renderer/components/tileBoardDomAccessibility.ts',
        'src/renderer/components/tileBoardPointerPick.ts',
        'src/renderer/components/tileBoardWebglBoundary.tsx',
        'src/renderer/store/useAppStore.ts'
    ]);
    return {
        id: 'renderer-input-flow',
        title: 'Renderer Input Flow',
        summary: 'DOM accessibility, pointer picking, WebGL boundaries, and store actions translate player intent into legal game actions.',
        nodes: [
            node('dom_accessibility', 'DOM Accessibility Layer', 'interaction', 'renderer', 'Keyboard, labels, and fallback surface expose playable tile actions.', evidence(repoRoot, ['src/renderer/components/tileBoardDomAccessibility.ts'])),
            node('pointer_pick', 'Pointer Pick', 'interaction', 'renderer', 'Pointer and raycast helpers identify the intended tile or board target.', evidence(repoRoot, ['src/renderer/components/tileBoardPointerPick.ts', 'src/renderer/components/tileBoardPick.ts'])),
            node('webgl_boundary', 'WebGL Boundary', 'render', 'renderer', 'Renderer chooses WebGL or DOM fallback without changing legal action semantics.', evidence(repoRoot, ['src/renderer/components/tileBoardWebglBoundary.tsx'])),
            node('store_dispatch', 'Store Dispatch', 'state', 'renderer', 'useAppStore applies input actions to the shared game state.', evidence(repoRoot, ['src/renderer/store/useAppStore.ts'])),
            node('input_tests', 'Input Tests', 'gate', 'renderer', 'Focused tests keep DOM, pointer, WebGL, and store paths equivalent.', inputEvidence)
        ],
        edges: [
            edge('dom_accessibility', 'store_dispatch', 'dispatches'),
            edge('pointer_pick', 'store_dispatch', 'dispatches'),
            edge('webgl_boundary', 'pointer_pick', 'routes pointer state'),
            edge('store_dispatch', 'input_tests', 'guarded by')
        ],
        findings: [
            finding(
                'input-parity-risk',
                'warning',
                'Input has multiple equivalent entry points',
                'Tile interaction changes should prove DOM fallback, keyboard, pointer, WebGL boundary, and store dispatch still agree on the same legal action.',
                inputEvidence
            )
        ],
        actions: [
            action(
                'renderer-input-contract-gate',
                'P1',
                'Renderer Input Flow',
                'Keep tile input paths behaviorally equivalent',
                'Any TileBoard or store input change should run renderer input tests that cover DOM accessibility, WebGL fallback, pointer picking, and store dispatch.',
                'Players can perform the same legal move through every supported input/rendering path.',
                inputEvidence
            )
        ]
    };
};

const buildAudioFeedbackDiagram = (repoRoot) => {
    const audioEvidence = evidence(repoRoot, [
        'src/renderer/audio/uiSfx.ts',
        'src/renderer/audio/audioInteractionCoverage.ts',
        'src/renderer/audio/audioInteractionCoverage.test.ts',
        'src/renderer/hooks/useHudPoliteLiveAnnouncement.ts',
        'src/renderer/components/gameScreenFeedback.ts',
        'docs/AUDIO_ASSET_INVENTORY.md'
    ]);
    return {
        id: 'audio-feedback-pipeline',
        title: 'Audio Feedback Pipeline',
        summary: 'Gameplay events become audio cues, HUD announcements, and visible feedback so core actions are legible.',
        nodes: [
            node('feedback_events', 'Feedback Events', 'domain', 'renderer', 'Game screen feedback maps action results into player-facing cues.', evidence(repoRoot, ['src/renderer/components/gameScreenFeedback.ts'])),
            node('ui_sfx', 'UI SFX', 'service', 'renderer', 'Audio service triggers short cues for interactions and state changes.', evidence(repoRoot, ['src/renderer/audio/uiSfx.ts'])),
            node('live_announcements', 'Live Announcements', 'accessibility', 'renderer', 'HUD polite live regions mirror important state changes in text.', evidence(repoRoot, ['src/renderer/hooks/useHudPoliteLiveAnnouncement.ts'])),
            node('asset_inventory', 'Audio Inventory', 'asset', 'docs', 'Inventory documents available and placeholder audio coverage.', evidence(repoRoot, ['docs/AUDIO_ASSET_INVENTORY.md'])),
            node('coverage_gate', 'Coverage Gate', 'gate', 'renderer', 'Coverage tests prove important interactions have cue coverage.', audioEvidence)
        ],
        edges: [
            edge('feedback_events', 'ui_sfx', 'triggers'),
            edge('feedback_events', 'live_announcements', 'announces'),
            edge('asset_inventory', 'ui_sfx', 'supplies assets'),
            edge('ui_sfx', 'coverage_gate', 'guarded by')
        ],
        findings: [
            finding(
                'feedback-coverage-risk',
                'info',
                'Feedback coverage should move with gameplay systems',
                'New actions, rewards, hazards, and blockers should include audio and announcement coverage so mechanics stay readable without relying only on visuals.',
                audioEvidence
            )
        ],
        actions: [
            action(
                'audio-feedback-coverage-gate',
                'P2',
                'Audio Feedback Pipeline',
                'Add feedback coverage for new action outcomes',
                'When introducing a new visible gameplay outcome, add or update audio interaction coverage and HUD announcement tests.',
                'Important gameplay outcomes have both audible and textual feedback coverage.',
                audioEvidence
            )
        ]
    };
};

const buildAssetCardRenderingDiagram = (repoRoot) => {
    const assetEvidence = evidence(repoRoot, [
        'src/renderer/cardFace/cardIllustrationDraw.ts',
        'src/renderer/cardFace/cardIllustrationDraw.test.ts',
        'src/renderer/components/tileTextures.ts',
        'src/renderer/components/TileBezel.tsx',
        'scripts/audit-renderer-assets.mjs',
        'scripts/build-card-illustration-manifest.mjs'
    ]);
    return {
        id: 'asset-card-rendering',
        title: 'Asset Card Rendering',
        summary: 'Card-face illustrations, generated manifests, texture assets, bezels, asset audits, and board readability tests define the card presentation pipeline.',
        nodes: [
            node('illustration_manifest', 'Illustration Manifest', 'asset', 'scripts', 'Build script emits available card-face illustration metadata.', evidence(repoRoot, ['scripts/build-card-illustration-manifest.mjs'])),
            node('card_draw', 'Card Draw Pipeline', 'render', 'renderer', 'Card-face drawing turns tile identity into readable illustrations.', evidence(repoRoot, ['src/renderer/cardFace/cardIllustrationDraw.ts'])),
            node('tile_textures', 'Tile Textures', 'render', 'renderer', 'Texture helpers and revisions feed the board rendering layers.', evidence(repoRoot, ['src/renderer/components/tileTextures.ts', 'src/renderer/components/tileBoardTextureRevision.ts'])),
            node('bezel_frame', 'Bezel Frame', 'render', 'renderer', 'Tile bezel/frame components provide readable framing and state accents.', evidence(repoRoot, ['src/renderer/components/TileBezel.tsx', 'src/renderer/components/tileBoardFrameVisualState.ts'])),
            node('render_tests', 'Rendering And Asset Tests', 'gate', 'renderer', 'Asset audits, illustration tests, and readability tests catch card-face regressions.', assetEvidence)
        ],
        edges: [
            edge('illustration_manifest', 'card_draw', 'feeds'),
            edge('card_draw', 'tile_textures', 'composed with'),
            edge('tile_textures', 'bezel_frame', 'rendered inside'),
            edge('bezel_frame', 'render_tests', 'guarded by')
        ],
        findings: [
            finding(
                'card-rendering-contract',
                'warning',
                'Card rendering is an asset and code contract',
                'Asset pipeline changes should run the renderer asset audit plus illustration and readability tests because generated manifests and dropped files can drift independently from TypeScript render code.',
                assetEvidence
            )
        ],
        actions: [
            action(
                'asset-rendering-regression-gate',
                'P2',
                'Asset Card Rendering',
                'Run rendering gates for asset or card-face edits',
                'Any card art, manifest, texture, bezel, renderer asset, or board readability change should run the renderer asset audit plus focused card tests before fullcheck.',
                'Card faces remain legible, dropped assets stay referenced, and the asset manifest stays aligned with renderer expectations.',
                assetEvidence
            )
        ]
    };
};

const buildTestGateArchitectureDiagram = (repoRoot) => {
    const gateEvidence = evidence(repoRoot, [
        'package.json',
        'scripts/system-diagrams.mjs',
        'src/shared/system-diagrams.test.ts',
        'docs/agent/GAMEPLAY_RULES_EDIT_MAP.md',
        'docs/system-diagrams/AUDIT.md'
    ]);
    const securityEvidence = evidence(repoRoot, [
        'package.json',
        'yarn.lock',
        'scripts/audit-summary.mjs',
        'scripts/gate-changed.mjs'
    ]);
    const packageHygieneEvidence = evidence(repoRoot, [
        'package.json',
        'knip.json',
        '.depcheckrc.json',
        'scripts/check-depcheck-clean.mjs',
        'scripts/gate-changed.mjs'
    ]);
    const buildOutputEvidence = evidence(repoRoot, [
        'package.json',
        'vite.config.mts',
        'scripts/check-renderer-bundle-budget.mjs',
        'src/shared/renderer-bundle-budget-script.test.ts',
        'scripts/gate-changed.mjs'
    ]);
    const desktopBuildEvidence = evidence(repoRoot, [
        'package.json',
        'tsup.config.ts',
        'src/main/index.ts',
        'src/preload/index.ts',
        'scripts/gate-changed.mjs'
    ]);
    const browserSmokeEvidence = evidence(repoRoot, [
        'package.json',
        'playwright.config.ts',
        'e2e/README.md',
        'e2e/demo-readiness.spec.ts',
        'e2e/playable-path-navigation.spec.ts',
        'e2e/dungeon-board-3d-value.spec.ts'
    ]);
    const rendererQaEvidence = evidence(repoRoot, [
        'package.json',
        'playwright.config.ts',
        'e2e/README.md',
        'e2e/mobile-layout.spec.ts',
        'e2e/navigation-flow.spec.ts',
        'e2e/playable-path-interludes.spec.ts',
        'e2e/tile-card-face-webgl.spec.ts'
    ]);
    return {
        id: 'test-gate-architecture',
        title: 'Test Gate Architecture',
        summary: 'Package scripts, system diagrams, package hygiene, security audit tooling, renderer build budgets, desktop build checks, browser smoke, edit maps, and focused tests define which gates should run for each system change.',
        nodes: [
            node('package_scripts', 'Package Scripts', 'gate', 'root', 'Yarn scripts compose lint, typecheck, focused gates, fullcheck, and CI.', evidence(repoRoot, ['package.json'])),
            node('package_hygiene', 'Package Hygiene', 'gate', 'scripts', 'Depcheck and Knip keep dependency metadata, unused files, production entrypoints, and exported APIs intentional.', packageHygieneEvidence),
            node('security_audit', 'Security Audit', 'gate', 'scripts', 'Dependency advisories are summarized and fail the security gate before fullcheck continues.', securityEvidence),
            node('build_output_budget', 'Build Output Budget', 'gate', 'scripts', 'Renderer builds run against explicit JS, CSS, asset, and total output budgets.', buildOutputEvidence),
            node('desktop_build', 'Desktop Build', 'gate', 'scripts', 'Electron main and preload bundles compile through tsup for packaged desktop entrypoints.', desktopBuildEvidence),
            node('browser_smoke', 'Live Browser Smoke', 'gate', 'e2e', 'Playwright smoke proves demo startup, core navigation, and nonblank 3D board rendering in a real browser.', browserSmokeEvidence),
            node('renderer_qa_shards', 'Renderer QA Shards', 'gate', 'e2e', 'Split Playwright shards cover layout, navigation, interludes, and 3D/WebGL paths without one oversized runner.', rendererQaEvidence),
            node('system_diagrams', 'System Diagrams', 'analysis', 'scripts', 'Diagram generator maps system surfaces, evidence, findings, and audit actions.', evidence(repoRoot, ['scripts/system-diagrams.mjs'])),
            node('diagram_tests', 'Diagram Tests', 'gate', 'shared', 'Tests assert diagram payload shape, evidence links, and markdown output.', evidence(repoRoot, ['src/shared/system-diagrams.test.ts'])),
            node('edit_map', 'Gameplay Edit Map', 'docs', 'docs', 'Agent-facing map routes gameplay edits to matching rules and tests.', evidence(repoRoot, ['docs/agent/GAMEPLAY_RULES_EDIT_MAP.md'])),
            node('audit_docs', 'Audit Docs', 'docs', 'docs', 'Generated audit report exposes action status, commands, and evidence.', evidence(repoRoot, ['docs/system-diagrams/AUDIT.md']))
        ],
        edges: [
            edge('system_diagrams', 'audit_docs', 'generates'),
            edge('system_diagrams', 'diagram_tests', 'covered by'),
            edge('package_scripts', 'diagram_tests', 'runs'),
            edge('package_hygiene', 'package_scripts', 'guards metadata through'),
            edge('security_audit', 'package_scripts', 'fails fullcheck through'),
            edge('build_output_budget', 'package_scripts', 'guards renderer builds through'),
            edge('desktop_build', 'package_scripts', 'guards desktop entrypoints through'),
            edge('browser_smoke', 'package_scripts', 'proves live renderer through'),
            edge('renderer_qa_shards', 'package_scripts', 'proves renderer contracts through'),
            edge('edit_map', 'package_scripts', 'routes to'),
            edge('audit_docs', 'package_scripts', 'names commands')
        ],
        findings: [
            finding(
                'gates-need-single-register',
                'info',
                'System gates need a checked action register',
                'Action status and commands should stay in one validated registry so docs, UI, and CI fail together when an audit action drifts.',
                gateEvidence
            )
        ],
        actions: [
            action(
                'systems-gate-registry',
                'P0',
                'Test Gate Architecture',
                'Keep system actions registered and CI-visible',
                'New diagrams or audit actions must update the action registry and keep `yarn gate:systems` passing.',
                'System diagram docs, audit actions, and CI gate commands remain synchronized.',
                gateEvidence
            ),
            action(
                'dependency-audit-gate',
                'P0',
                'Test Gate Architecture',
                'Keep dependency advisories at zero',
                'Dependency, lockfile, and audit-tooling changes should run `yarn gate:security` before broader handoff.',
                'Yarn audit advisories fail fast instead of being hidden by dependency-only audit scopes.',
                securityEvidence
            ),
            action(
                'package-hygiene-gate',
                'P1',
                'Test Gate Architecture',
                'Keep package hygiene checks green',
                'Package metadata, Knip config, depcheck config, and package-tooling edits should run `yarn gate:package-hygiene` before broader handoff.',
                'Dependency usage, unused files, production entrypoints, and exported APIs stay intentional as the app surface grows.',
                packageHygieneEvidence
            ),
            action(
                'renderer-bundle-budget-gate',
                'P2',
                'Test Gate Architecture',
                'Keep renderer bundle output budgeted',
                'Renderer build, asset, Vite config, and bundle-budget changes should run `yarn gate:build-output` before broader handoff.',
                'Renderer JS chunks, CSS, large assets, and total output size stay inside explicit budgets.',
                buildOutputEvidence
            ),
            action(
                'desktop-build-gate',
                'P1',
                'Test Gate Architecture',
                'Keep Electron desktop entrypoints compiling',
                'Main-process, preload, desktop bridge, package metadata, and tsup config changes should run `yarn gate:desktop-build` before broader handoff.',
                'Packaged desktop entrypoints continue to compile independently from renderer-only validation.',
                desktopBuildEvidence
            ),
            action(
                'browser-smoke-gate',
                'P1',
                'Test Gate Architecture',
                'Keep live browser smoke runnable',
                'Renderer route, asset, WebGL, or Playwright script changes should keep `yarn test:e2e:browser-smoke` green and the slower full smoke shard available.',
                'Demo startup, core navigation, and the bounded 3D board render path work in a real browser instead of only unit/build checks.',
                browserSmokeEvidence
            ),
            action(
                'renderer-qa-shards',
                'P1',
                'Test Gate Architecture',
                'Keep renderer QA shards runnable',
                'Renderer layout, navigation, interlude, tile face, or WebGL changes should run the matching `yarn test:e2e:renderer-qa:*` shard before broader handoff.',
                'Long renderer QA remains resumable by shard while still covering the full live-browser contract surface.',
                rendererQaEvidence
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
    const rawDiagrams = [
        buildNavigationDiagram(repoRoot),
        buildGameplayDiagram(repoRoot),
        buildGameplayInteractionGraphDiagram(repoRoot),
        buildBoardGenerationDiagram(repoRoot),
        buildRewardsEconomyDiagram(repoRoot),
        buildTraitDiagram(repoRoot),
        buildPersistenceDiagram(repoRoot),
        buildRendererInputDiagram(repoRoot),
        buildAudioFeedbackDiagram(repoRoot),
        buildAssetCardRenderingDiagram(repoRoot),
        buildTestGateArchitectureDiagram(repoRoot)
    ];
    const diagrams = mergeActionRegistry(repoRoot, rawDiagrams).map((diagram) => ({ ...diagram, stats: diagramStats(diagram) }));
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
        const commandText = item.command ? ` Command: \`${item.command}\`.` : '';
        lines.push(`- **${item.priority} ${item.title}** (${item.system}, ${item.status}): ${item.detail}${commandText}`);
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

/**
 * @param {ReturnType<typeof buildSystemDiagramData>} payload
 */
export function renderSystemAuditMarkdown(payload) {
    const openActions = payload.actions.filter((item) => item.status === 'open');
    const lines = [
        '# System Audit',
        '',
        'Generated by `yarn docs:system-diagrams`. This report is derived from the system diagram action register.',
        '',
        `- Open actions: ${openActions.length}`,
        `- Total actions: ${payload.actions.length}`,
        `- Diagrams: ${payload.stats.diagramCount}`,
        payload.rulesVersion == null ? '- Rules version: unknown' : `- Rules version: ${payload.rulesVersion}`,
        ''
    ];
    for (const item of payload.actions) {
        lines.push(`## ${item.priority} ${item.title}`, '');
        lines.push(`- Status: ${item.status}`);
        lines.push(`- System: ${item.system}`);
        lines.push(`- Detail: ${item.detail}`);
        lines.push(`- Verifies: ${item.verifies}`);
        if (item.command) {
            lines.push(`- Command: \`${item.command}\``);
        }
        if (item.evidence.length > 0) {
            lines.push(`- Evidence: ${item.evidence.map((p) => `\`${p}\``).join(', ')}`);
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
        const docs = [
            ['docs/system-diagrams/README.md', renderSystemDiagramsMarkdown(payload)],
            ['docs/system-diagrams/AUDIT.md', renderSystemAuditMarkdown(payload)]
        ];
        const stale = docs.filter(([rel, expected]) => {
            const outFile = path.join(defaultRepoRoot, rel);
            const actual = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
            return actual !== expected;
        });
        if (stale.length > 0) {
            process.stderr.write(`${stale.map(([rel]) => rel).join(', ')} stale. Run yarn docs:system-diagrams.\n`);
            process.exitCode = 1;
            return;
        }
        process.stdout.write('docs/system-diagrams docs are current\n');
        return;
    }
    if (process.argv.includes('--write-docs')) {
        const outDir = path.join(defaultRepoRoot, 'docs', 'system-diagrams');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'README.md'), renderSystemDiagramsMarkdown(payload), 'utf8');
        fs.writeFileSync(path.join(outDir, 'AUDIT.md'), renderSystemAuditMarkdown(payload), 'utf8');
        process.stdout.write('Wrote docs/system-diagrams/README.md and docs/system-diagrams/AUDIT.md\n');
        return;
    }
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const thisFile = fileURLToPath(import.meta.url);
if (path.normalize(thisFile) === path.normalize(path.resolve(process.argv[1] ?? ''))) {
    main();
}

export { DIAGRAM_IDS };
