import graphData from './gameplay-interaction-graph-data.json';
import { z } from 'zod';
import { GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES } from './gameplay-feedback-facts';

export type GameplayInteractionMechanicKind =
    | 'board'
    | 'trait'
    | 'power'
    | 'build'
    | 'core'
    | 'economy'
    | 'feedback'
    | 'findable'
    | 'hazard'
    | 'boss'
    | 'exit'
    | 'inventory'
    | 'lock'
    | 'perk'
    | 'persistence'
    | 'progression'
    | 'relic'
    | 'reward'
    | 'route'
    | 'simulation'
    | 'shop'
    | 'stats'
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
    | 'priority_guard'
    | 'belongs_to'
    | 'consumes'
    | 'consequence'
    | 'displays'
    | 'gates'
    | 'grants'
    | 'modifies'
    | 'persists'
    | 'tested_by'
    | 'triggers';

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
    blockerWithoutProtectiveEdgeIds: string[];
    mechanicCount: number;
    edgeCount: number;
    blockerCount: number;
    traitCount: number;
    counterplayEdgeCount: number;
    generatedFloorCoverageGapIds: string[];
    highLeverageMechanicIds: string[];
    playerVisibleWriteWithoutHudIds: string[];
    recommendations: string[];
    shopCounterplayWithoutPriorityGuardIds: string[];
}

const nonEmptyStringSchema = z.string().min(1);
const mechanicKindSchema = z.enum([
    'board',
    'trait',
    'power',
    'build',
    'core',
    'economy',
    'feedback',
    'findable',
    'hazard',
    'boss',
    'exit',
    'inventory',
    'lock',
    'perk',
    'persistence',
    'progression',
    'relic',
    'reward',
    'route',
    'simulation',
    'shop',
    'stats',
    'objective',
    'safety'
]);
const edgeKindSchema = z.enum([
    'synergy',
    'risk',
    'counterplay',
    'enables',
    'guarded_by',
    'unblocks',
    'blocks',
    'priority_guard',
    'belongs_to',
    'consumes',
    'consequence',
    'displays',
    'gates',
    'grants',
    'modifies',
    'persists',
    'tested_by',
    'triggers'
]);
const stringListSchema = z.array(nonEmptyStringSchema);

export const gameplayInteractionGraphSchema = z
    .object({
        version: z.number().int().positive(),
        mechanics: z.array(
            z
                .object({
                    id: nonEmptyStringSchema,
                    label: nonEmptyStringSchema,
                    kind: mechanicKindSchema,
                    role: nonEmptyStringSchema,
                    evidence: stringListSchema,
                    reads: stringListSchema,
                    writes: stringListSchema,
                    enables: stringListSchema,
                    blocks: stringListSchema,
                    softlockGuards: stringListSchema,
                    tests: stringListSchema
                })
                .strict()
        ),
        edges: z.array(
            z
                .object({
                    source: nonEmptyStringSchema,
                    target: nonEmptyStringSchema,
                    kind: edgeKindSchema,
                    label: nonEmptyStringSchema
                })
                .strict()
        ),
        coverage: z
            .object({
                tileTraits: stringListSchema,
                blockingKinds: z.array(mechanicKindSchema),
                requiredObjectives: stringListSchema,
                requiredSafetyNodes: stringListSchema
            })
            .strict()
    })
    .strict();

export const gameplayInteractionGraph: GameplayInteractionGraph = gameplayInteractionGraphSchema.parse(graphData);

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
    const protectiveEdgeKinds = new Set<GameplayInteractionEdgeKind>(['counterplay', 'guarded_by', 'unblocks', 'priority_guard']);
    const blockerWithoutProtectiveEdgeIds = blockers
        .filter(
            (mechanic) =>
                !graph.edges.some(
                    (edge) =>
                        (edge.source === mechanic.id || edge.target === mechanic.id) &&
                        protectiveEdgeKinds.has(edge.kind)
                )
        )
        .map((mechanic) => mechanic.id);
    // GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES is the right source of truth for fields
    // that owe critical feedback, but it is narrower than the set of writes a player can
    // see: switching to it alone silently dropped 11 entries (score, routeChoices,
    // relicOffer, lastLevelResult, feedbackLines, sessionStats, nextFloor, triesDelta,
    // interactionTags, achievementProgress, bossTrophyCacheOutcome), so the HUD audit
    // stopped covering them and passed vacuously. Union both.
    const playerVisibleWrites = new Set<string>([
        ...Object.values(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES),
        'achievementProgress',
        'bossTrophyCacheOutcome',
        'feedbackLines',
        'interactionTags',
        'lastLevelResult',
        'nextFloor',
        'relicOffer',
        'routeChoices',
        'score',
        'sessionStats',
        'triesDelta'
    ]);
    const playerVisibleWriteWithoutHudIds = graph.mechanics
        .filter((mechanic) => mechanic.writes.some((write) => playerVisibleWrites.has(write)))
        .filter(
            (mechanic) =>
                mechanic.id !== 'feedback.gameplay_hud' &&
                !graph.edges.some(
                    (edge) =>
                        (edge.source === mechanic.id && edge.target === 'feedback.gameplay_hud') ||
                        (edge.target === mechanic.id && edge.source === 'feedback.gameplay_hud')
                ) &&
                !mechanic.evidence.some((path) => path.includes('GameplayHudBar') || path.includes('gameScreenFeedback'))
        )
        .map((mechanic) => mechanic.id);
    const shopCounterplayWithoutPriorityGuardIds = graph.mechanics
        .filter((mechanic) => mechanic.kind === 'shop' && mechanic.role.includes('counterplay'))
        .filter(
            (mechanic) =>
                !graph.edges.some(
                    (edge) =>
                        edge.source === mechanic.id &&
                        edge.kind === 'priority_guard' &&
                        (edge.target === 'lock.iron_key' ||
                            edge.target === 'lock.typed_key' ||
                            edge.target === 'boss.moving_patrol')
                )
        )
        .map((mechanic) => mechanic.id);
    const generatedFloorCoverageGapIds = graph.mechanics
        .filter((mechanic) => ['boss', 'exit', 'hazard', 'lock', 'objective', 'trait'].includes(mechanic.kind))
        .filter(
            (mechanic) =>
                !mechanic.tests.some(
                    (testPath) =>
                        testPath.includes('softlock-generator-contract') ||
                        testPath.includes('softlock-fairness') ||
                        testPath.includes('game.test')
                )
        )
        .map((mechanic) => mechanic.id);
    const recommendations: string[] = [
        'Keep trait routing tools available when the graph shows swap-created trait routes.',
        'Keep boss and lock counterplay ahead of optional rewards in shop priority.',
        'Add a topology, softlock-fairness, or generator-contract case for every new blocking edge.',
        'Add renderer/HUD feedback evidence when a mechanic writes player-visible state.'
    ];
    return {
        blockerWithoutProtectiveEdgeIds,
        mechanicCount: graph.mechanics.length,
        edgeCount: graph.edges.length,
        blockerCount: blockers.length,
        traitCount: traits.length,
        counterplayEdgeCount: counterplayEdges.length,
        generatedFloorCoverageGapIds,
        highLeverageMechanicIds,
        playerVisibleWriteWithoutHudIds,
        recommendations,
        shopCounterplayWithoutPriorityGuardIds
    };
};
