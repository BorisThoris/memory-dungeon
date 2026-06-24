import graphData from './gameplay-interaction-graph-data.json';

export type GameplayInteractionMechanicKind =
    | 'trait'
    | 'power'
    | 'hazard'
    | 'boss'
    | 'exit'
    | 'lock'
    | 'shop'
    | 'objective'
    | 'safety';

export type GameplayInteractionEdgeKind =
    | 'synergy'
    | 'risk'
    | 'counterplay'
    | 'enables'
    | 'guarded_by'
    | 'unblocks'
    | 'blocks'
    | 'priority_guard';

export interface GameplayInteractionMechanic {
    id: string;
    label: string;
    kind: GameplayInteractionMechanicKind;
    role: string;
    evidence: string[];
    reads: string[];
    writes: string[];
    enables: string[];
    blocks: string[];
    softlockGuards: string[];
    tests: string[];
}

export interface GameplayInteractionEdge {
    source: string;
    target: string;
    kind: GameplayInteractionEdgeKind;
    label: string;
}

export interface GameplayInteractionGraph {
    version: number;
    mechanics: GameplayInteractionMechanic[];
    edges: GameplayInteractionEdge[];
    coverage: {
        tileTraits: string[];
        blockingKinds: GameplayInteractionMechanicKind[];
        requiredObjectives: string[];
        requiredSafetyNodes: string[];
    };
}

export interface GameplayInteractionGraphIssue {
    code:
        | 'duplicate_mechanic'
        | 'edge_missing_source'
        | 'edge_missing_target'
        | 'missing_evidence'
        | 'blocking_without_counterplay'
        | 'objective_without_completion_route'
        | 'trait_without_interaction'
        | 'write_without_reader'
        | 'required_node_missing'
        | 'missing_test';
    mechanicId?: string;
    edgeLabel?: string;
    detail: string;
}

export interface GameplayInteractionGraphAudit {
    mechanicCount: number;
    edgeCount: number;
    blockerCount: number;
    traitCount: number;
    counterplayEdgeCount: number;
    highLeverageMechanicIds: string[];
    recommendations: string[];
}

export const gameplayInteractionGraph = graphData as GameplayInteractionGraph;

export const getGameplayInteractionMechanicById = (id: string): GameplayInteractionMechanic | null =>
    gameplayInteractionGraph.mechanics.find((mechanic) => mechanic.id === id) ?? null;

export const getGameplayInteractionEdgesForMechanic = (id: string): GameplayInteractionEdge[] =>
    gameplayInteractionGraph.edges.filter((edge) => edge.source === id || edge.target === id);

const hasCounterplayOrGuardEdge = (mechanic: GameplayInteractionMechanic): boolean =>
    mechanic.softlockGuards.length > 0 ||
    gameplayInteractionGraph.edges.some(
        (edge) =>
            (edge.source === mechanic.id || edge.target === mechanic.id) &&
            (edge.kind === 'counterplay' || edge.kind === 'guarded_by' || edge.kind === 'unblocks' || edge.kind === 'priority_guard')
    );

const hasCompletionRoute = (mechanic: GameplayInteractionMechanic): boolean =>
    gameplayInteractionGraph.edges.some(
        (edge) =>
            edge.source === mechanic.id &&
            (edge.target === 'objective.floor_clear' || edge.target === 'exit.primary' || edge.kind === 'unblocks')
    );

export const validateGameplayInteractionGraph = (
    graph: GameplayInteractionGraph = gameplayInteractionGraph
): GameplayInteractionGraphIssue[] => {
    const issues: GameplayInteractionGraphIssue[] = [];
    const ids = new Set<string>();
    const duplicateIds = new Set<string>();
    for (const mechanic of graph.mechanics) {
        if (ids.has(mechanic.id)) {
            duplicateIds.add(mechanic.id);
        }
        ids.add(mechanic.id);
    }
    for (const mechanicId of duplicateIds) {
        issues.push({ code: 'duplicate_mechanic', mechanicId, detail: `Duplicate mechanic id ${mechanicId}.` });
    }

    for (const edge of graph.edges) {
        if (!ids.has(edge.source)) {
            issues.push({
                code: 'edge_missing_source',
                edgeLabel: edge.label,
                detail: `Edge "${edge.label}" references missing source ${edge.source}.`
            });
        }
        if (!ids.has(edge.target)) {
            issues.push({
                code: 'edge_missing_target',
                edgeLabel: edge.label,
                detail: `Edge "${edge.label}" references missing target ${edge.target}.`
            });
        }
    }

    const readers = new Set(graph.mechanics.flatMap((mechanic) => mechanic.reads));
    for (const mechanic of graph.mechanics) {
        if (mechanic.evidence.length === 0) {
            issues.push({
                code: 'missing_evidence',
                mechanicId: mechanic.id,
                detail: `${mechanic.id} has no implementation evidence.`
            });
        }
        if (mechanic.tests.length === 0) {
            issues.push({
                code: 'missing_test',
                mechanicId: mechanic.id,
                detail: `${mechanic.id} has no regression test evidence.`
            });
        }
        if (mechanic.blocks.length > 0 && !hasCounterplayOrGuardEdge(mechanic)) {
            issues.push({
                code: 'blocking_without_counterplay',
                mechanicId: mechanic.id,
                detail: `${mechanic.id} blocks ${mechanic.blocks.join(', ')} without counterplay or a softlock guard.`
            });
        }
        if (mechanic.kind === 'objective' && !hasCompletionRoute(mechanic) && mechanic.id !== 'objective.floor_clear') {
            issues.push({
                code: 'objective_without_completion_route',
                mechanicId: mechanic.id,
                detail: `${mechanic.id} does not connect to exit or floor clear.`
            });
        }
        if (mechanic.kind === 'trait' && getGameplayInteractionEdgesForMechanic(mechanic.id).length === 0) {
            issues.push({
                code: 'trait_without_interaction',
                mechanicId: mechanic.id,
                detail: `${mechanic.id} has no graph interaction edge.`
            });
        }
        for (const write of mechanic.writes) {
            if (!readers.has(write) && !write.endsWith('Report') && !write.endsWith('Plan')) {
                issues.push({
                    code: 'write_without_reader',
                    mechanicId: mechanic.id,
                    detail: `${mechanic.id} writes ${write}, but no graph mechanic declares it as a read.`
                });
            }
        }
    }

    for (const required of [...graph.coverage.requiredObjectives, ...graph.coverage.requiredSafetyNodes]) {
        if (!ids.has(required)) {
            issues.push({
                code: 'required_node_missing',
                mechanicId: required,
                detail: `Required gameplay graph node ${required} is missing.`
            });
        }
    }

    for (const trait of graph.coverage.tileTraits) {
        const id = `trait.${trait}`;
        if (!ids.has(id)) {
            issues.push({
                code: 'required_node_missing',
                mechanicId: id,
                detail: `Tile trait ${trait} is missing from the gameplay interaction graph.`
            });
        }
    }

    return issues;
};

export const auditGameplayInteractionGraph = (
    graph: GameplayInteractionGraph = gameplayInteractionGraph
): GameplayInteractionGraphAudit => {
    const blockers = graph.mechanics.filter((mechanic) => mechanic.blocks.length > 0);
    const traits = graph.mechanics.filter((mechanic) => mechanic.kind === 'trait');
    const counterplayEdges = graph.edges.filter(
        (edge) => edge.kind === 'counterplay' || edge.kind === 'guarded_by' || edge.kind === 'unblocks'
    );
    const edgeCountByMechanic = new Map<string, number>();
    for (const edge of graph.edges) {
        edgeCountByMechanic.set(edge.source, (edgeCountByMechanic.get(edge.source) ?? 0) + 1);
        edgeCountByMechanic.set(edge.target, (edgeCountByMechanic.get(edge.target) ?? 0) + 1);
    }
    const highLeverageMechanicIds = graph.mechanics
        .filter((mechanic) => (edgeCountByMechanic.get(mechanic.id) ?? 0) >= 3 || mechanic.blocks.length > 0)
        .map((mechanic) => mechanic.id);
    const recommendations: string[] = [
        'Keep trait routing tools available when the graph shows swap-created trait routes.',
        'Keep boss and lock counterplay ahead of optional rewards in shop priority.',
        'Add a softlock-fairness or generator-contract case for every new blocking edge.',
        'Add renderer/HUD feedback evidence when a mechanic writes player-visible state.'
    ];
    return {
        mechanicCount: graph.mechanics.length,
        edgeCount: graph.edges.length,
        blockerCount: blockers.length,
        traitCount: traits.length,
        counterplayEdgeCount: counterplayEdges.length,
        highLeverageMechanicIds,
        recommendations
    };
};
