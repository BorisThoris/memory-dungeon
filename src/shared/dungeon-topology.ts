import { DirectedGraph } from 'graphology';
import type {
    BoardState,
    DungeonExitLockKind,
    DungeonKeyKind,
    DungeonRunMapState,
    DungeonRunNode,
    Tile
} from './contracts';
import { activeEnemyHazardsForBoard, allRealBoardPairsCleared } from './enemy-hazard-board-rules';
import { dungeonKeyKindArticleLabel } from './dungeon-key-copy';
import { EXIT_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';

/**
 * Graphology-backed validation for tests, simulations, and audit tooling.
 *
 * Keep this module out of renderer/runtime imports unless `graphology` moves from devDependencies to runtime
 * dependencies and the renderer bundle budget is re-evaluated.
 */

export type DungeonTopologyNodeKind =
    | 'start'
    | 'pair'
    | 'exit'
    | 'key'
    | 'lever'
    | 'boss'
    | 'hazard'
    | 'shop'
    | 'room'
    | 'run_node';

export type DungeonTopologyRequirement =
    | { kind: 'none' }
    | { kind: 'key'; keyKind: DungeonKeyKind }
    | { kind: 'lever'; count: number }
    | { kind: 'boss_defeated' };

export interface DungeonTopologyNodeAttributes {
    kind: DungeonTopologyNodeKind;
    label: string;
    tileIds?: string[];
    pairKey?: string;
    keyKind?: DungeonKeyKind;
    lockKind?: DungeonExitLockKind;
    requiredLeverCount?: number;
    routeNode?: Pick<DungeonRunNode, 'id' | 'floor' | 'status' | 'kind'>;
}

export interface DungeonTopologyEdgeAttributes {
    label: string;
    requirement: DungeonTopologyRequirement;
}

export type DungeonTopologyGraph = DirectedGraph<DungeonTopologyNodeAttributes, DungeonTopologyEdgeAttributes>;

export type DungeonBoardTopologyIssueCode =
    | 'topology_exit_missing'
    | 'topology_exit_lock_source_missing'
    | 'topology_exit_lever_source_shortage'
    | 'topology_boss_source_missing'
    | 'topology_completion_route_missing';

export interface DungeonBoardTopologyIssue {
    code: DungeonBoardTopologyIssueCode;
    message: string;
    nodeId: string | null;
    tileIds?: string[];
}

export interface DungeonBoardTopologyReport {
    graph: DungeonTopologyGraph;
    reachableNodeIds: string[];
    obtainableKeyKinds: DungeonKeyKind[];
    masterKeyCount: number;
    reachableLeverCount: number;
    hasBossRoute: boolean;
    hasExitRoute: boolean;
    issues: DungeonBoardTopologyIssue[];
}

export interface DungeonBoardTopologyOptions {
    dungeonKeys?: Partial<Record<DungeonKeyKind, number>>;
    dungeonMasterKeys?: number;
}

export type DungeonRunMapTopologyIssueCode =
    | 'topology_current_missing'
    | 'topology_current_status_mismatch'
    | 'topology_duplicate_route_node'
    | 'topology_duplicate_route_edge'
    | 'topology_edge_target_missing'
    | 'topology_edge_target_blocked'
    | 'topology_legal_target_missing'
    | 'topology_selected_unreachable'
    | 'topology_revealed_future_unreachable';

export interface DungeonRunMapTopologyIssue {
    code: DungeonRunMapTopologyIssueCode;
    message: string;
    nodeId: string | null;
}

export interface DungeonRunMapTopologyReport {
    graph: DungeonTopologyGraph;
    reachableNodeIds: string[];
    legalTargetIds: string[];
    issues: DungeonRunMapTopologyIssue[];
}

const START_NODE_ID = 'start';

const formatList = (values: readonly string[]): string => (values.length > 0 ? values.join(',') : 'none');

const isTileCleared = (tile: Tile): boolean =>
    tile.state === 'matched' || tile.state === 'removed' || tile.dungeonCardState === 'resolved';

const isTileActionable = (tile: Tile): boolean => tile.state === 'hidden' || tile.state === 'flipped';

const groupTilesByPairKey = (tiles: readonly Tile[]): Map<string, Tile[]> => {
    const groups = new Map<string, Tile[]>();
    for (const tile of tiles) {
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }
    return groups;
};

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const floorHeldKeyCount = (board: BoardState, keyKind: DungeonKeyKind): number =>
    (board.dungeonKeysHeldByKind?.[keyKind] ?? 0) +
    (board.dungeonKeysHeldByKind == null && keyKind === 'iron' ? (board.dungeonKeysHeld ?? 0) : 0);

const bossObjectiveAlreadySettled = (board: BoardState): boolean => {
    if (board.dungeonObjectiveId !== 'defeat_boss' || board.dungeonBossId == null) {
        return false;
    }
    const bossTiles = board.tiles.filter((tile) => tile.dungeonBossId != null);
    if (bossTiles.length > 0 && bossTiles.every(isTileCleared)) {
        return true;
    }
    return allRealBoardPairsCleared(board) && !activeEnemyHazardsForBoard(board).some((hazard) => hazard.bossId != null);
};

const requirementForExit = (lockKind: DungeonExitLockKind, requiredLeverCount: number): DungeonTopologyRequirement => {
    if (lockKind === 'none') return { kind: 'none' };
    if (lockKind === 'lever') return { kind: 'lever', count: requiredLeverCount };
    return { kind: 'key', keyKind: lockKind };
};

const canSatisfyRequirement = (
    requirement: DungeonTopologyRequirement,
    resources: {
        keyKinds: ReadonlySet<DungeonKeyKind>;
        masterKeys: number;
        leverCount: number;
        bossRoute: boolean;
    }
): boolean => {
    if (requirement.kind === 'none') return true;
    if (requirement.kind === 'key') return resources.masterKeys > 0 || resources.keyKinds.has(requirement.keyKind);
    if (requirement.kind === 'lever') return resources.leverCount >= requirement.count;
    return resources.bossRoute;
};

const addNodeOnce = (
    graph: DungeonTopologyGraph,
    id: string,
    attributes: DungeonTopologyNodeAttributes
): void => {
    if (graph.hasNode(id)) {
        graph.updateNodeAttributes(id, (current) => ({ ...current, ...attributes }));
        return;
    }
    graph.addNode(id, attributes);
};

const addEdgeOnce = (
    graph: DungeonTopologyGraph,
    source: string,
    target: string,
    attributes: DungeonTopologyEdgeAttributes
): void => {
    const key = `${source}->${target}:${attributes.label}`;
    if (graph.hasEdge(key)) return;
    graph.addDirectedEdgeWithKey(key, source, target, attributes);
};

const linkExitResourceEdges = (graph: DungeonTopologyGraph): void => {
    const exitNodeIds = graph.filterNodes((_, attributes) => attributes.kind === 'exit');
    for (const exitNodeId of exitNodeIds) {
        const exit = graph.getNodeAttributes(exitNodeId);
        const lockKind = exit.lockKind ?? 'none';
        if (lockKind !== 'none' && lockKind !== 'lever') {
            for (const keyNodeId of graph.filterNodes(
                (_, attributes) => attributes.kind === 'key' && attributes.keyKind === lockKind
            )) {
                addEdgeOnce(graph, keyNodeId, exitNodeId, {
                    label: 'unlocks exit',
                    requirement: { kind: 'none' }
                });
            }
        }
        if (lockKind === 'lever') {
            for (const leverNodeId of graph.filterNodes((_, attributes) => attributes.kind === 'lever')) {
                addEdgeOnce(graph, leverNodeId, exitNodeId, {
                    label: 'powers exit',
                    requirement: { kind: 'lever', count: exit.requiredLeverCount ?? 0 }
                });
            }
        }
    }
};

export const createDungeonBoardTopology = (
    board: BoardState,
    options: DungeonBoardTopologyOptions = {}
): DungeonTopologyGraph => {
    const graph: DungeonTopologyGraph = new DirectedGraph();
    addNodeOnce(graph, START_NODE_ID, { kind: 'start', label: `Floor ${board.level}` });

    const groups = groupTilesByPairKey(board.tiles);
    for (const [pairKey, tiles] of groups) {
        if (isSingletonUtilityPairKey(pairKey) && pairKey !== EXIT_PAIR_KEY) {
            continue;
        }

        const tileIds = tiles.map((tile) => tile.id);
        const first = tiles[0]!;
        const pairNodeId = `pair:${pairKey}`;
        const actionable = tiles.some((tile) => !isTileCleared(tile) && isTileActionable(tile));
        if (!isSingletonUtilityPairKey(pairKey) && actionable) {
            addNodeOnce(graph, pairNodeId, {
                kind: 'pair',
                label: first.label,
                pairKey,
                tileIds
            });
            addEdgeOnce(graph, START_NODE_ID, pairNodeId, { label: 'can match', requirement: { kind: 'none' } });
        }

        const liveDungeonTiles = tiles.filter((tile) => !isTileCleared(tile) && tile.dungeonCardKind != null);
        const dungeonTile = liveDungeonTiles[0];
        if (!dungeonTile) {
            continue;
        }

        if (dungeonTile.dungeonCardKind === 'key') {
            const keyKind = dungeonTile.dungeonKeyKind ?? 'iron';
            const keyNodeId = `key:${keyKind}:${pairKey}`;
            addNodeOnce(graph, keyNodeId, {
                kind: 'key',
                label: dungeonTile.label,
                keyKind,
                pairKey,
                tileIds
            });
            addEdgeOnce(graph, pairNodeId, keyNodeId, { label: 'grants key', requirement: { kind: 'none' } });
        }

        if (dungeonTile.dungeonCardKind === 'lever' && dungeonTile.dungeonCardEffectId === 'lever_floor') {
            const leverNodeId = `lever:${pairKey}`;
            addNodeOnce(graph, leverNodeId, {
                kind: 'lever',
                label: dungeonTile.label,
                pairKey,
                tileIds
            });
            addEdgeOnce(graph, pairNodeId, leverNodeId, { label: 'counts lever', requirement: { kind: 'none' } });
        }

        if (dungeonTile.dungeonBossId != null || (dungeonTile.dungeonCardKind === 'enemy' && dungeonTile.dungeonCardHp != null)) {
            const bossNodeId = `boss:${dungeonTile.dungeonBossId ?? pairKey}`;
            addNodeOnce(graph, bossNodeId, {
                kind: 'boss',
                label: dungeonTile.label,
                pairKey,
                tileIds
            });
            addEdgeOnce(graph, pairNodeId, bossNodeId, { label: 'defeats boss route', requirement: { kind: 'none' } });
        }

        if (dungeonTile.dungeonCardKind === 'shop') {
            const shopNodeId = `shop:${dungeonTile.id}`;
            addNodeOnce(graph, shopNodeId, { kind: 'shop', label: dungeonTile.label, tileIds });
            addEdgeOnce(graph, START_NODE_ID, shopNodeId, { label: 'opens shop', requirement: { kind: 'none' } });
        }

        if (dungeonTile.dungeonCardKind === 'room') {
            const roomNodeId = `room:${pairKey}`;
            addNodeOnce(graph, roomNodeId, { kind: 'room', label: dungeonTile.label, pairKey, tileIds });
            addEdgeOnce(graph, pairNodeId, roomNodeId, { label: 'room service', requirement: { kind: 'none' } });

            if (dungeonTile.dungeonCardEffectId === 'room_key_cache') {
                const keyNodeId = `key:iron:${pairKey}:room_cache`;
                addNodeOnce(graph, keyNodeId, {
                    kind: 'key',
                    label: `${dungeonTile.label} iron key cache`,
                    keyKind: 'iron',
                    pairKey,
                    tileIds
                });
                addEdgeOnce(graph, roomNodeId, keyNodeId, { label: 'grants room key cache', requirement: { kind: 'none' } });
            }
        }
    }

    for (const hazard of activeEnemyHazardsForBoard(board)) {
        const hazardNodeId = `hazard:${hazard.id}`;
        addNodeOnce(graph, hazardNodeId, {
            kind: 'hazard',
            label: hazard.label,
            tileIds: unique([hazard.currentTileId, hazard.nextTileId])
        });
        addEdgeOnce(graph, START_NODE_ID, hazardNodeId, { label: 'active hazard', requirement: { kind: 'none' } });
        if (hazard.bossId != null) {
            const bossNodeId = `boss:${hazard.bossId}`;
            addNodeOnce(graph, bossNodeId, {
                kind: 'boss',
                label: hazard.label,
                tileIds: unique([hazard.currentTileId, hazard.nextTileId])
            });
            addEdgeOnce(graph, hazardNodeId, bossNodeId, { label: 'boss hazard route', requirement: { kind: 'none' } });
        }
    }

    const primaryExit = board.dungeonExitTileId
        ? board.tiles.find((tile) => tile.id === board.dungeonExitTileId) ?? null
        : board.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY) ?? null;
    if (primaryExit) {
        const lockKind = primaryExit.dungeonExitLockKind ?? board.dungeonExitLockKind ?? 'none';
        const requiredLeverCount = primaryExit.dungeonExitRequiredLeverCount ?? board.dungeonExitRequiredLeverCount ?? 0;
        const exitNodeId = `exit:${primaryExit.id}`;
        addNodeOnce(graph, exitNodeId, {
            kind: 'exit',
            label: primaryExit.label,
            lockKind,
            requiredLeverCount,
            tileIds: [primaryExit.id]
        });
        addEdgeOnce(graph, START_NODE_ID, exitNodeId, {
            label: 'activate exit',
            requirement: requirementForExit(lockKind, requiredLeverCount)
        });

        if (lockKind !== 'none' && lockKind !== 'lever' && floorHeldKeyCount(board, lockKind) > 0) {
            const heldKeyNodeId = `floor-key:${lockKind}`;
            addNodeOnce(graph, heldKeyNodeId, { kind: 'key', label: `${lockKind} floor key`, keyKind: lockKind });
            addEdgeOnce(graph, START_NODE_ID, heldKeyNodeId, { label: 'held floor key', requirement: { kind: 'none' } });
        }
    }

    for (const keyKind of Object.keys(options.dungeonKeys ?? {}) as DungeonKeyKind[]) {
        if ((options.dungeonKeys?.[keyKind] ?? 0) <= 0) continue;
        const keyNodeId = `run-key:${keyKind}`;
        addNodeOnce(graph, keyNodeId, { kind: 'key', label: `${keyKind} run key`, keyKind });
        addEdgeOnce(graph, START_NODE_ID, keyNodeId, { label: 'carried key', requirement: { kind: 'none' } });
    }

    linkExitResourceEdges(graph);

    return graph;
};

const collectReachableNodeIds = (
    graph: DungeonTopologyGraph,
    startNodeId: string,
    resources: {
        keyKinds: ReadonlySet<DungeonKeyKind>;
        masterKeys: number;
        leverCount: number;
        bossRoute: boolean;
    }
): string[] => {
    const reachable = new Set<string>();
    const queue = [startNodeId];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (reachable.has(nodeId) || !graph.hasNode(nodeId)) {
            continue;
        }
        reachable.add(nodeId);
        for (const next of graph.outboundNeighbors(nodeId)) {
            const edge = graph.edge(nodeId, next);
            const requirement = edge ? graph.getEdgeAttributes(edge).requirement : { kind: 'none' as const };
            if (canSatisfyRequirement(requirement, resources)) {
                queue.push(next);
            }
        }
    }
    return [...reachable];
};

export const inspectDungeonBoardTopology = (
    board: BoardState,
    options: DungeonBoardTopologyOptions = {}
): DungeonBoardTopologyReport => {
    const graph = createDungeonBoardTopology(board, options);
    const initialKeyKinds = new Set<DungeonKeyKind>();
    for (const keyKind of Object.keys(options.dungeonKeys ?? {}) as DungeonKeyKind[]) {
        if ((options.dungeonKeys?.[keyKind] ?? 0) > 0) {
            initialKeyKinds.add(keyKind);
        }
    }

    const firstPassReachable = collectReachableNodeIds(
        graph,
        START_NODE_ID,
        {
            keyKinds: initialKeyKinds,
            masterKeys: options.dungeonMasterKeys ?? 0,
            leverCount: board.dungeonLeverCount ?? 0,
            bossRoute: false
        }
    );
    const reachableSet = new Set(firstPassReachable);
    const obtainableKeyKinds = new Set(initialKeyKinds);
    let reachableLeverCount = board.dungeonLeverCount ?? 0;
    let hasBossRoute = false;

    for (const nodeId of firstPassReachable) {
        const node = graph.getNodeAttributes(nodeId);
        if (node.kind === 'key' && node.keyKind) {
            obtainableKeyKinds.add(node.keyKind);
        }
        if (node.kind === 'lever') {
            reachableLeverCount += 1;
        }
        if (node.kind === 'boss') {
            hasBossRoute = true;
        }
    }

    const reachableNodeIds = collectReachableNodeIds(
        graph,
        START_NODE_ID,
        {
            keyKinds: obtainableKeyKinds,
            masterKeys: options.dungeonMasterKeys ?? 0,
            leverCount: reachableLeverCount,
            bossRoute: hasBossRoute
        }
    );
    for (const nodeId of reachableNodeIds) {
        reachableSet.add(nodeId);
    }

    const issues: DungeonBoardTopologyIssue[] = [];
    const exitNodeIds = graph.filterNodes((_, attributes) => attributes.kind === 'exit');
    if (board.dungeonExitTileId && exitNodeIds.length === 0) {
        issues.push({
            code: 'topology_exit_missing',
            message: 'Board declares an exit, but the topology has no exit node.',
            nodeId: null,
            tileIds: [board.dungeonExitTileId]
        });
    }

    for (const exitNodeId of exitNodeIds) {
        const exit = graph.getNodeAttributes(exitNodeId);
        const lockKind = exit.lockKind ?? 'none';
        if (lockKind === 'lever' && reachableLeverCount < (exit.requiredLeverCount ?? 0)) {
            issues.push({
                code: 'topology_exit_lever_source_shortage',
                message: `Exit '${exit.label}' needs ${exit.requiredLeverCount ?? 0} lever(s), but topology can reach ${reachableLeverCount}.`,
                nodeId: exitNodeId,
                tileIds: exit.tileIds
            });
        }
        if (lockKind !== 'none' && lockKind !== 'lever') {
            const hasKeyRoute = (options.dungeonMasterKeys ?? 0) > 0 || obtainableKeyKinds.has(lockKind);
            if (!hasKeyRoute) {
                issues.push({
                    code: 'topology_exit_lock_source_missing',
                    message: `Exit '${exit.label}' needs ${dungeonKeyKindArticleLabel(lockKind)}, but topology has no reachable source.`,
                    nodeId: exitNodeId,
                    tileIds: exit.tileIds
                });
            }
        }
    }

    if (board.dungeonObjectiveId === 'defeat_boss' && !hasBossRoute && !bossObjectiveAlreadySettled(board)) {
        issues.push({
            code: 'topology_boss_source_missing',
            message: 'Defeat-boss objective is active, but topology has no reachable boss route.',
            nodeId: null
        });
    }

    const hasExitRoute = exitNodeIds.some((exitNodeId) => reachableSet.has(exitNodeId));
    if (board.dungeonExitTileId && !hasExitRoute) {
        issues.push({
            code: 'topology_completion_route_missing',
            message: 'Board has an exit, but no reachable topology route can activate it.',
            nodeId: board.dungeonExitTileId ? `exit:${board.dungeonExitTileId}` : null,
            tileIds: board.dungeonExitTileId ? [board.dungeonExitTileId] : undefined
        });
    }

    return {
        graph,
        reachableNodeIds: [...reachableSet],
        obtainableKeyKinds: [...obtainableKeyKinds].sort(),
        masterKeyCount: options.dungeonMasterKeys ?? 0,
        reachableLeverCount,
        hasBossRoute,
        hasExitRoute,
        issues
    };
};

export const formatDungeonBoardTopologyDiagnostics = (report: DungeonBoardTopologyReport): string => {
    const exitNodes = report.graph
        .filterNodes((_, attributes) => attributes.kind === 'exit')
        .map((nodeId) => {
            const node = report.graph.getNodeAttributes(nodeId);
            return `${nodeId}[lock=${node.lockKind ?? 'none'} levers=${node.requiredLeverCount ?? 0}]`;
        });
    const bossNodes = report.graph.filterNodes((_, attributes) => attributes.kind === 'boss');

    return [
        `nodes=${report.graph.order}`,
        `edges=${report.graph.size}`,
        `reachable=${report.reachableNodeIds.length}`,
        `keys=${formatList(report.obtainableKeyKinds)}`,
        `masterKeys=${report.masterKeyCount}`,
        `levers=${report.reachableLeverCount}`,
        `bossRoute=${report.hasBossRoute}`,
        `exitRoute=${report.hasExitRoute}`,
        `exits=${formatList(exitNodes)}`,
        `bosses=${formatList(bossNodes)}`
    ].join(' ');
};

export const formatDungeonBoardTopologyIssue = (
    issue: DungeonBoardTopologyIssue,
    report: DungeonBoardTopologyReport
): string => `${issue.code}: ${issue.message} ${formatDungeonBoardTopologyDiagnostics(report)}`;

export const createDungeonRunMapTopology = (state: DungeonRunMapState): DungeonTopologyGraph => {
    const graph: DungeonTopologyGraph = new DirectedGraph();
    for (const node of state.nodes) {
        addNodeOnce(graph, node.id, {
            kind: 'run_node',
            label: node.label,
            routeNode: {
                id: node.id,
                floor: node.floor,
                status: node.status,
                kind: node.kind
            }
        });
    }
    for (const node of state.nodes) {
        if (!graph.hasNode(node.id)) continue;
        for (const targetId of node.edgeIds) {
            if (!graph.hasNode(targetId)) continue;
            addEdgeOnce(graph, node.id, targetId, { label: 'route choice', requirement: { kind: 'none' } });
        }
    }
    return graph;
};

export const inspectDungeonRunMapTopology = (state: DungeonRunMapState): DungeonRunMapTopologyReport => {
    const graph = createDungeonRunMapTopology(state);
    const issues: DungeonRunMapTopologyIssue[] = [];
    const current = state.nodes.find((node) => node.id === state.currentNodeId) ?? null;
    const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    const nodeIdCounts = new Map<string, number>();
    for (const node of state.nodes) {
        nodeIdCounts.set(node.id, (nodeIdCounts.get(node.id) ?? 0) + 1);
    }
    for (const [nodeId, count] of nodeIdCounts) {
        if (count <= 1) continue;
        issues.push({
            code: 'topology_duplicate_route_node',
            message: `Route node '${nodeId}' appears ${count} times before topology normalization.`,
            nodeId
        });
    }

    if (!current || !graph.hasNode(state.currentNodeId)) {
        issues.push({
            code: 'topology_current_missing',
            message: `Current route node '${state.currentNodeId}' is missing from topology.`,
            nodeId: state.currentNodeId
        });
        return { graph, reachableNodeIds: [], legalTargetIds: [], issues };
    }

    if (current.status !== 'current' && (current.status !== 'cleared' || current.edgeIds.length === 0)) {
        issues.push({
            code: 'topology_current_status_mismatch',
            message: `Current route node '${current.id}' is '${current.status}' instead of current or cleared-with-choices.`,
            nodeId: current.id
        });
    }

    for (const node of state.nodes) {
        const seenEdgeIds = new Set<string>();
        for (const targetId of node.edgeIds) {
            if (seenEdgeIds.has(targetId)) {
                issues.push({
                    code: 'topology_duplicate_route_edge',
                    message: `Route node '${node.id}' has duplicate edge '${targetId}' before topology normalization.`,
                    nodeId: targetId
                });
                continue;
            }
            seenEdgeIds.add(targetId);
            if (!graph.hasNode(targetId)) {
                issues.push({
                    code: 'topology_edge_target_missing',
                    message: `Route node '${node.id}' points at missing target '${targetId}'.`,
                    nodeId: targetId
                });
                continue;
            }
            const target = nodeById.get(targetId);
            const selected = state.selectedNodeId ? nodeById.get(state.selectedNodeId) ?? null : null;
            const skippedSelectedSibling =
                selected != null &&
                node.id === state.currentNodeId &&
                target != null &&
                target.status === 'skipped' &&
                target.floor === selected.floor &&
                node.edgeIds.includes(selected.id);
            if (node.id === state.currentNodeId && target && target.status !== 'revealed' && !skippedSelectedSibling) {
                issues.push({
                    code: 'topology_edge_target_blocked',
                    message: `Current route edge '${targetId}' points at '${target.status}' target '${target.id}'.`,
                    nodeId: target.id
                });
            }
        }
    }

    const reachableNodeIds = collectReachableNodeIds(
        graph,
        state.currentNodeId,
        {
            keyKinds: new Set(),
            masterKeys: 0,
            leverCount: 0,
            bossRoute: false
        }
    );
    const legalTargetIds = graph
        .outboundNeighbors(state.currentNodeId)
        .filter((nodeId) => graph.getNodeAttributes(nodeId).routeNode?.status === 'revealed');

    if (current.edgeIds.length > 0 && legalTargetIds.length === 0) {
        issues.push({
            code: 'topology_legal_target_missing',
            message: `Current route node '${current.id}' has no revealed legal topology target.`,
            nodeId: current.id
        });
    }

    if (state.selectedNodeId && !legalTargetIds.includes(state.selectedNodeId)) {
        issues.push({
            code: 'topology_selected_unreachable',
            message: `Selected route node '${state.selectedNodeId}' is not an outbound topology target.`,
            nodeId: state.selectedNodeId
        });
    }

    for (const node of state.nodes) {
        if (node.status !== 'revealed' || node.floor <= current.floor || legalTargetIds.includes(node.id)) {
            continue;
        }
        issues.push({
            code: 'topology_revealed_future_unreachable',
            message: `Revealed future route node '${node.id}' is not reachable from current route '${current.id}'.`,
            nodeId: node.id
        });
    }

    return { graph, reachableNodeIds, legalTargetIds, issues };
};

export const formatDungeonRunMapTopologyDiagnostics = (report: DungeonRunMapTopologyReport): string => {
    const currentNodes = report.graph
        .filterNodes((_, attributes) => attributes.routeNode?.status === 'current')
        .map((nodeId) => {
            const routeNode = report.graph.getNodeAttributes(nodeId).routeNode;
            return `${nodeId}[floor=${routeNode?.floor ?? 'unknown'} kind=${routeNode?.kind ?? 'unknown'}]`;
        });

    return [
        `nodes=${report.graph.order}`,
        `edges=${report.graph.size}`,
        `reachable=${report.reachableNodeIds.length}`,
        `legalTargets=${formatList(report.legalTargetIds)}`,
        `current=${formatList(currentNodes)}`
    ].join(' ');
};

export const formatDungeonRunMapTopologyIssue = (
    issue: DungeonRunMapTopologyIssue,
    report: DungeonRunMapTopologyReport
): string => `${issue.code}: ${issue.message} ${formatDungeonRunMapTopologyDiagnostics(report)}`;
