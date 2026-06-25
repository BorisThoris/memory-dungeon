import type {
    DungeonRunMapState,
    DungeonRunNode,
    DungeonRunNodeKind,
    DungeonRunNodeStatus,
    DungeonObjectiveId,
    FloorArchetypeId,
    FloorTag,
    RouteChoice,
    RouteNodeType
} from './contracts';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';

export type RunMapNodeKind = Exclude<DungeonRunNodeKind, 'entrance' | 'exit' | 'trap' | 'boss'>;
export type RunMapNode = DungeonRunNode;

export interface RunMapPreview {
    seed: number;
    rulesVersion: number;
    currentFloor: number;
    nextNodes: RunMapNode[];
}

export interface RunMapState extends RunMapPreview {
    selectedNodeId: string | null;
}

export type DungeonRoomTone = 'safe' | 'danger' | 'reward' | 'mystery' | 'boss' | 'neutral';

export interface DungeonRoomPresentation {
    id: string;
    label: string;
    eyebrow: string;
    detail: string;
    mechanic: string;
    reward: string;
    risk: string;
    glyph: string;
    tone: DungeonRoomTone;
}

export interface DungeonMapNodePresentation extends DungeonRoomPresentation {
    floor: number;
    lane: number;
    status: DungeonRunNodeStatus;
    edgeIds: string[];
    routeType: RouteNodeType;
    routeApproachLabel?: string;
    routeApproachType?: RouteNodeType;
}

export interface DungeonMapPresentation {
    act: number;
    currentFloor: number;
    bossFloor: number;
    bossDistance: number;
    current: DungeonMapNodePresentation | null;
    selected: DungeonMapNodePresentation | null;
    nodes: DungeonMapNodePresentation[];
    revealed: DungeonMapNodePresentation[];
    cleared: DungeonMapNodePresentation[];
    skipped: DungeonMapNodePresentation[];
}

export interface DungeonRouteDecisionRow {
    id: string;
    routeType: RouteNodeType;
    choiceLabel: string;
    nodeLabel: string;
    approachLabel?: string;
    nodeKind: DungeonRunNodeKind;
    glyph: string;
    tone: DungeonRoomTone;
    risk: string;
    reward: string;
    mechanic: string;
    detail: string;
    sourceNodeId: string | null;
    targetFloor: number;
    selected: boolean;
}

export interface DungeonRouteDecisionPresentation {
    act: number;
    bossFloor: number;
    bossDistance: number;
    current: DungeonMapNodePresentation | null;
    rows: DungeonRouteDecisionRow[];
    summary: string;
}

export interface DungeonNodeTypeContract {
    kind: DungeonRunNodeKind;
    label: string;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    defaultObjectiveId: DungeonObjectiveId;
    mechanic: string;
    rewardPolicy: string;
    cardFamilyBounds: Partial<Record<'enemy' | 'trap' | 'treasure' | 'shop' | 'room' | 'boss' | 'exit' | 'key' | 'lock' | 'shrine' | 'gateway' | 'lever', { min: number; max: number }>>;
    routeType: RouteNodeType;
    uiTone: DungeonRoomTone;
}

export interface RouteProfileBudgetRow {
    routeType: RouteNodeType;
    nodeKinds: DungeonRunNodeKind[];
    minShare: number;
    maxShare: number;
}

export interface RouteProfileBudgetReport {
    total: number;
    counts: Record<RouteNodeType, number>;
    rows: Array<RouteProfileBudgetRow & { actualShare: number; status: 'within_range' | 'out_of_range' }>;
}

export interface RouteSemanticContract {
    floor: number;
    routeType: RouteNodeType;
    nodeKind: DungeonRunNodeKind;
    normalizedRouteType: RouteNodeType;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    objectiveId: DungeonObjectiveId;
    mechanic: string;
    rewardPolicy: string;
}

type RouteChoiceWithApproach = RouteChoice &
    Partial<Pick<DungeonRunNode, 'routeApproachLabel' | 'routeApproachType'>>;

export type DungeonRouteProgressionIssueCode =
    | 'route_current_node_missing'
    | 'route_multiple_current_nodes'
    | 'route_current_node_blocked'
    | 'route_current_floor_mismatch'
    | 'route_entrance_blocked'
    | 'route_duplicate_node_id'
    | 'route_no_legal_progression'
    | 'route_duplicate_edge_target'
    | 'route_edge_target_missing'
    | 'route_edge_target_blocked'
    | 'route_selected_node_unreachable'
    | 'route_exit_unreachable'
    | 'route_boss_transition_unreachable'
    | 'route_orphan_revealed_future'
    | 'route_stale_revealed_backtrack';

export interface DungeonRouteProgressionIssue {
    code: DungeonRouteProgressionIssueCode;
    nodeId: string | null;
    seed: number;
    rulesVersion: number;
    currentFloor: number;
    detail: string;
}

export interface DungeonRouteProgressionReport {
    seed: number;
    rulesVersion: number;
    currentFloor: number;
    currentNodeId: string | null;
    legalTargetIds: string[];
    hasLegalProgressionPath: boolean;
    issues: DungeonRouteProgressionIssue[];
}

const DUNGEON_ROUTE_BLOCKING_ISSUES: readonly DungeonRouteProgressionIssueCode[] = [
    'route_current_node_missing',
    'route_multiple_current_nodes',
    'route_current_node_blocked',
    'route_current_floor_mismatch',
    'route_entrance_blocked',
    'route_duplicate_node_id',
    'route_no_legal_progression',
    'route_edge_target_missing',
    'route_edge_target_blocked',
    'route_selected_node_unreachable',
    'route_exit_unreachable',
    'route_boss_transition_unreachable',
    'route_orphan_revealed_future'
];

const DUNGEON_ACT_LENGTH = 6;
const DUNGEON_BRANCH_LANES = [-1, 0, 1] as const;
const DUNGEON_BRANCH_APPROACHES: readonly {
    label: string;
    routeType: RouteNodeType;
}[] = [
    { label: 'Safe passage', routeType: 'safe' },
    { label: 'Greedy route', routeType: 'greed' },
    { label: 'Mystery route', routeType: 'mystery' }
];
const DUNGEON_RUN_NODE_KINDS: readonly DungeonRunNodeKind[] = [
    'entrance',
    'combat',
    'elite',
    'trap',
    'treasure',
    'shop',
    'rest',
    'event',
    'boss',
    'exit'
];

const nodeId = (floor: number, lane: number, kind: DungeonRunNodeKind): string => `floor-${floor}:lane-${lane}:${kind}`;

const actForFloor = (floor: number): number => Math.max(1, Math.ceil(Math.max(1, floor) / DUNGEON_ACT_LENGTH));

const labelForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'entrance':
            return 'Threshold Archive';
        case 'shop':
            return 'Candle Vendor';
        case 'elite':
            return 'Mnemonic Sentinel';
        case 'trap':
            return 'Latchwork Hall';
        case 'rest':
            return 'Lantern Rest';
        case 'event':
            return 'Omen Archive';
        case 'treasure':
            return 'Sealed Gallery';
        case 'boss':
            return 'Keeper Chamber';
        case 'exit':
            return 'Palimpsest Stair';
        case 'combat':
        default:
            return 'Recall Hall';
    }
};

const detailForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'shop':
            return 'A candlelit vendor is embedded in the next memory board.';
        case 'elite':
            return 'A named sentinel pressures recall for a richer route payout.';
        case 'trap':
            return 'Latch plates and alarm sigils crowd the safest route reads.';
        case 'rest':
            return 'Lantern light turns the next mistake into recovery or guard.';
        case 'event':
            return 'An archive oddity rewrites one reward choice before the next board.';
        case 'treasure':
            return 'Coin memories, keys, and sealed caches are more likely.';
        case 'boss':
            return 'A chapter keeper anchors the room and tests the whole route.';
        case 'exit':
            return 'An overwritten stair closes the current chapter.';
        case 'entrance':
            return 'The first indexed room of the descent.';
        case 'combat':
        default:
            return 'A standard recall encounter with a visible way down.';
    }
};

const glyphForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'shop':
            return '$';
        case 'elite':
            return 'E';
        case 'trap':
            return '!';
        case 'rest':
            return '+';
        case 'event':
            return '?';
        case 'treasure':
            return '*';
        case 'boss':
            return 'B';
        case 'exit':
            return '>';
        case 'entrance':
            return 'G';
        case 'combat':
        default:
            return 'C';
    }
};

const toneForKind = (kind: DungeonRunNodeKind): DungeonRoomTone => {
    if (kind === 'boss') return 'boss';
    if (kind === 'elite' || kind === 'trap') return 'danger';
    if (kind === 'treasure' || kind === 'shop' || kind === 'rest') return 'reward';
    if (kind === 'event') return 'mystery';
    if (kind === 'combat' || kind === 'entrance' || kind === 'exit') return 'safe';
    return 'neutral';
};

const mechanicForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'shop':
            return 'Vendor card appears inside the encounter.';
        case 'elite':
            return 'Sentinel pressure and greed anchors.';
        case 'trap':
            return 'Snare, hex, or bell traps punish noisy mistakes.';
        case 'rest':
            return 'Utility rooms and lantern recovery replace most threats.';
        case 'event':
            return 'Archive and omen choices bend the room texture.';
        case 'treasure':
            return 'Caches, keys, and locks compete for side pockets.';
        case 'boss':
            return 'Named keeper card and pacify objective define the room.';
        case 'exit':
            return 'Commit to the descent and close the chapter.';
        case 'entrance':
            return 'Entry archive teaches the run shape.';
        case 'combat':
        default:
            return 'Standard memory combat with a visible exit route.';
    }
};

const rewardForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'shop':
            return 'Spend gold on run services.';
        case 'elite':
            return 'Higher score and stronger sentinel rewards.';
        case 'trap':
            return 'Safer exits after disarming latchwork.';
        case 'rest':
            return 'Recovery, keys, guard, or shrine utility.';
        case 'event':
            return 'Omen reward, map, favor, or key outcome.';
        case 'treasure':
            return 'Gold, cache cards, keys, and locked loot.';
        case 'boss':
            return 'Keeper multiplier and chapter payoff.';
        case 'exit':
            return 'Next act path opens.';
        case 'entrance':
            return 'Start the descent.';
        case 'combat':
        default:
            return 'Balanced score and survival path.';
    }
};

const riskForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'elite':
            return 'Sentinel pressure.';
        case 'trap':
            return 'Mistakes can cost tempo, guard, or life.';
        case 'boss':
            return 'Keeper danger.';
        case 'event':
            return 'Uncertain omen.';
        case 'treasure':
            return 'Greed can delay the exit.';
        case 'shop':
        case 'rest':
            return 'Low threat.';
        case 'combat':
        case 'entrance':
        case 'exit':
        default:
            return 'Stable path.';
    }
};

const systemsForKind = (kind: DungeonRunNodeKind): string[] =>
    kind === 'shop'
        ? ['REG-015', 'REG-070', 'REG-071']
        : kind === 'event'
          ? ['REG-017', 'REG-069', 'REG-074']
          : kind === 'treasure'
            ? ['REG-017', 'REG-069', 'REG-075']
            : ['REG-017', 'REG-069'];

const routeTypeForKind = (kind: DungeonRunNodeKind): RouteNodeType => {
    if (kind === 'elite' || kind === 'trap' || kind === 'boss') {
        return 'greed';
    }
    if (kind === 'event' || kind === 'treasure') {
        return 'mystery';
    }
    return 'safe';
};

const floorTagForKind = (kind: DungeonRunNodeKind): FloorTag => {
    if (kind === 'boss') return 'boss';
    if (kind === 'rest' || kind === 'shop') return 'breather';
    return 'normal';
};

const floorArchetypeForKind = (kind: DungeonRunNodeKind): FloorArchetypeId | null => {
    if (kind === 'treasure') return 'treasure_gallery';
    if (kind === 'trap') return 'trap_hall';
    if (kind === 'event') return 'script_room';
    if (kind === 'elite' || kind === 'boss') return 'rush_recall';
    if (kind === 'rest' || kind === 'shop') return 'breather';
    return null;
};

const objectiveForKind = (kind: DungeonRunNodeKind): DungeonObjectiveId => {
    if (kind === 'boss') return 'defeat_boss';
    if (kind === 'elite') return 'pacify_floor';
    if (kind === 'trap') return 'disarm_traps';
    if (kind === 'treasure') return 'loot_cache';
    if (kind === 'event') return 'reveal_unknowns';
    return 'find_exit';
};

const cardFamilyBoundsForKind = (kind: DungeonRunNodeKind): DungeonNodeTypeContract['cardFamilyBounds'] => {
    if (kind === 'boss') return { boss: { min: 1, max: 1 }, enemy: { min: 1, max: 4 }, exit: { min: 1, max: 3 } };
    if (kind === 'elite') return { enemy: { min: 1, max: 4 }, treasure: { min: 0, max: 2 }, exit: { min: 1, max: 3 } };
    if (kind === 'trap') return { trap: { min: 1, max: 4 }, enemy: { min: 0, max: 3 }, exit: { min: 1, max: 3 } };
    if (kind === 'treasure') return { treasure: { min: 1, max: 4 }, key: { min: 0, max: 2 }, lock: { min: 0, max: 2 }, exit: { min: 1, max: 3 } };
    if (kind === 'shop') return { shop: { min: 1, max: 1 }, room: { min: 0, max: 2 }, exit: { min: 1, max: 3 } };
    if (kind === 'rest') return { room: { min: 1, max: 3 }, shrine: { min: 0, max: 2 }, exit: { min: 1, max: 3 } };
    if (kind === 'event') return { room: { min: 1, max: 3 }, gateway: { min: 0, max: 2 }, exit: { min: 1, max: 3 } };
    return { enemy: { min: 0, max: 3 }, gateway: { min: 0, max: 3 }, exit: { min: 1, max: 3 } };
};

export const getDungeonNodeTypeContract = (kind: DungeonRunNodeKind): DungeonNodeTypeContract => ({
    kind,
    label: labelForKind(kind),
    floorTag: floorTagForKind(kind),
    floorArchetypeId: floorArchetypeForKind(kind),
    defaultObjectiveId: objectiveForKind(kind),
    mechanic: mechanicForKind(kind),
    rewardPolicy: rewardForKind(kind),
    cardFamilyBounds: cardFamilyBoundsForKind(kind),
    routeType: routeTypeForKind(kind),
    uiTone: toneForKind(kind)
});

export const getDungeonNodeTypeContracts = (): readonly DungeonNodeTypeContract[] =>
    DUNGEON_RUN_NODE_KINDS.map(getDungeonNodeTypeContract);

const kindFromRouteType = (routeType: RouteNodeType, floor: number): DungeonRunNodeKind => {
    if (floor > 0 && floor % DUNGEON_ACT_LENGTH === 0) {
        return 'boss';
    }
    if (routeType === 'greed') {
        return floor % 3 === 0 ? 'shop' : floor % 5 === 0 ? 'trap' : 'elite';
    }
    if (routeType === 'safe') {
        return floor % 4 === 0 ? 'rest' : 'combat';
    }
    return floor % 4 === 0 ? 'treasure' : 'event';
};

export const getDungeonRouteSemanticContract = ({
    routeType,
    floor,
    nodeKind
}: {
    routeType: RouteNodeType;
    floor: number;
    nodeKind?: DungeonRunNodeKind | null;
}): RouteSemanticContract => {
    const kind = nodeKind ?? kindFromRouteType(routeType, floor);
    const contract = getDungeonNodeTypeContract(kind);
    return {
        floor,
        routeType,
        nodeKind: kind,
        normalizedRouteType: contract.routeType,
        floorTag: contract.floorTag,
        floorArchetypeId: contract.floorArchetypeId,
        objectiveId: contract.defaultObjectiveId,
        mechanic: contract.mechanic,
        rewardPolicy: contract.rewardPolicy
    };
};

export const ROUTE_PROFILE_BUDGET_POLICY: readonly RouteProfileBudgetRow[] = [
    { routeType: 'safe', nodeKinds: ['combat', 'rest', 'entrance', 'exit'], minShare: 0.2, maxShare: 0.45 },
    { routeType: 'greed', nodeKinds: ['elite', 'trap', 'shop', 'boss'], minShare: 0.25, maxShare: 0.55 },
    { routeType: 'mystery', nodeKinds: ['event', 'treasure'], minShare: 0.2, maxShare: 0.45 }
];

export const inspectRouteProfileBudgets = (nodes: readonly Pick<DungeonRunNode, 'routeType' | 'kind'>[]): RouteProfileBudgetReport => {
    const counts: Record<RouteNodeType, number> = { safe: 0, greed: 0, mystery: 0 };
    for (const node of nodes) {
        counts[node.routeType] += 1;
    }
    const total = nodes.length;
    return {
        total,
        counts,
        rows: ROUTE_PROFILE_BUDGET_POLICY.map((row) => {
            const actualShare = total > 0 ? counts[row.routeType] / total : 0;
            return {
                ...row,
                actualShare,
                status: actualShare >= row.minShare && actualShare <= row.maxShare ? 'within_range' : 'out_of_range'
            };
        })
    };
};

const kindFromRouteChoice = (choice: RouteChoice, fallbackFloor: number): DungeonRunNodeKind => {
    if (fallbackFloor > 0 && fallbackFloor % DUNGEON_ACT_LENGTH === 0) {
        return 'boss';
    }
    const detail = choice.detail.toLowerCase();
    if (choice.routeType === 'mystery' && detail.includes('treasure')) {
        return 'treasure';
    }
    if (choice.routeType === 'mystery' && detail.includes('secret-room')) {
        return 'event';
    }
    return kindFromRouteType(choice.routeType, fallbackFloor);
};

const createNode = ({
    floor,
    depth,
    lane,
    kind,
    status,
    choice
}: {
    floor: number;
    depth: number;
    lane: number;
    kind: DungeonRunNodeKind;
    status: DungeonRunNodeStatus;
    choice?: RouteChoice;
}): DungeonRunNode => {
    const routeType = kind === 'boss' ? routeTypeForKind(kind) : choice?.routeType ?? routeTypeForKind(kind);
    const choiceApproach = choice as RouteChoiceWithApproach | undefined;
    return {
        id: choice?.id ?? nodeId(floor, lane, kind),
        floor,
        depth,
        lane,
        kind,
        status,
        routeType,
        label: kind === 'boss' && choice ? labelForKind(kind) : choice?.label ?? labelForKind(kind),
        detail: choice?.detail ?? detailForKind(kind),
        rewardPreview: choice?.rewardPreview,
        riskPreview: choice?.riskPreview,
        routeApproachLabel: choiceApproach?.routeApproachLabel ?? choice?.label,
        routeApproachType: choiceApproach?.routeApproachType ?? choice?.routeType,
        edgeIds: [],
        choiceId: choice?.id,
        offlineOnly: true,
        unlocksSystems: systemsForKind(kind)
    };
};

const connect = (nodes: DungeonRunNode[], fromId: string, toIds: string[]): DungeonRunNode[] =>
    nodes.map((node) => (node.id === fromId ? { ...node, edgeIds: [...new Set([...node.edgeIds, ...toIds])] } : node));

const routeIssue = (
    state: DungeonRunMapState,
    code: DungeonRouteProgressionIssueCode,
    nodeId: string | null,
    detail: string
): DungeonRouteProgressionIssue => ({
    code,
    nodeId,
    seed: state.seed,
    rulesVersion: state.rulesVersion,
    currentFloor: state.currentFloor,
    detail
});

const nodeCanBeEntered = (node: DungeonRunNode): boolean => node.status === 'revealed';

const isSkippedSiblingAfterSelection = (
    state: DungeonRunMapState,
    node: DungeonRunNode
): boolean => state.selectedNodeId != null && node.id !== state.selectedNodeId && node.status === 'skipped';

const routeNodeStatusPreference = (status: DungeonRunNodeStatus): number => {
    switch (status) {
        case 'current':
            return 50;
        case 'revealed':
            return 40;
        case 'cleared':
            return 30;
        case 'skipped':
            return 20;
        case 'hidden':
            return 10;
        case 'locked':
        default:
            return 0;
    }
};

const routeNodeRepairPreference = (
    node: DungeonRunNode,
    currentNodeId: string,
    selectedNodeId: string | null
): number =>
    (node.id === currentNodeId ? 1_000 : 0) +
    (node.id === selectedNodeId ? 500 : 0) +
    routeNodeStatusPreference(node.status) +
    Math.min(node.edgeIds.length, 20);

const dedupeDungeonRunNodes = (state: DungeonRunMapState): DungeonRunNode[] => {
    const byId = new Map<string, DungeonRunNode>();
    for (const node of state.nodes) {
        const existing = byId.get(node.id);
        if (!existing) {
            byId.set(node.id, node);
            continue;
        }
        if (
            routeNodeRepairPreference(node, state.currentNodeId, state.selectedNodeId) >
            routeNodeRepairPreference(existing, state.currentNodeId, state.selectedNodeId)
        ) {
            byId.set(node.id, node);
        }
    }
    return [...byId.values()];
};

const getRepairableCurrentEdgeIds = (state: DungeonRunMapState, current: DungeonRunNode): string[] => {
    const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    const ids: string[] = [];
    for (const edgeId of current.edgeIds) {
        if (ids.includes(edgeId)) {
            continue;
        }
        const target = nodeById.get(edgeId);
        if (!target) {
            continue;
        }
        if (target.status === 'revealed' || isSkippedSiblingAfterSelection(state, target)) {
            ids.push(edgeId);
        }
    }
    return ids;
};

export const inspectDungeonRunMapProgression = (state: DungeonRunMapState): DungeonRouteProgressionReport => {
    const issues: DungeonRouteProgressionIssue[] = [];
    const current = state.nodes.find((node) => node.id === state.currentNodeId) ?? null;
    const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    const legalTargetIds: string[] = [];
    const statusCurrentNodes = state.nodes.filter((node) => node.status === 'current');
    const nodeIdCounts = new Map<string, number>();

    for (const node of state.nodes) {
        nodeIdCounts.set(node.id, (nodeIdCounts.get(node.id) ?? 0) + 1);
    }
    for (const [id, count] of nodeIdCounts) {
        if (count > 1) {
            issues.push(
                routeIssue(
                    state,
                    'route_duplicate_node_id',
                    id,
                    `Route node id '${id}' appears ${count} times for seed ${state.seed}.`
                )
            );
        }
    }

    if (!current) {
        issues.push(
            routeIssue(
                state,
                'route_current_node_missing',
                state.currentNodeId,
                `Current route node '${state.currentNodeId}' is missing for seed ${state.seed}.`
            )
        );
    } else if (current.status !== 'current' && (current.status !== 'cleared' || current.edgeIds.length === 0)) {
        issues.push(
            routeIssue(
                state,
                'route_current_node_blocked',
                current.id,
                `Current route node '${current.id}' is '${current.status}' instead of current for seed ${state.seed}.`
            )
        );
    }
    if (current && current.floor !== state.currentFloor) {
        issues.push(
            routeIssue(
                state,
                'route_current_floor_mismatch',
                current.id,
                `Current route node '${current.id}' is on floor ${current.floor}, but map currentFloor is ${state.currentFloor} for seed ${state.seed}.`
            )
        );
    }
    if (statusCurrentNodes.length > 1) {
        issues.push(
            routeIssue(
                state,
                'route_multiple_current_nodes',
                current?.id ?? state.currentNodeId,
                `Route has ${statusCurrentNodes.length} current rooms for seed ${state.seed}: ${statusCurrentNodes.map((node) => node.id).join(', ')}.`
            )
        );
    }

    if (state.currentFloor <= 1) {
        const entrance = current?.kind === 'entrance' ? current : state.nodes.find((node) => node.kind === 'entrance');
        if (!entrance || (entrance.status !== 'current' && (entrance.status !== 'cleared' || entrance.edgeIds.length === 0))) {
            issues.push(
                routeIssue(
                    state,
                    'route_entrance_blocked',
                    entrance?.id ?? null,
                    `Entrance is not the playable current node for seed ${state.seed}.`
                )
            );
        }
    }

    if (current) {
        const seenEdgeIds = new Set<string>();
        for (const edgeId of current.edgeIds) {
            if (seenEdgeIds.has(edgeId)) {
                issues.push(
                    routeIssue(
                        state,
                        'route_duplicate_edge_target',
                        edgeId,
                        `Current route node '${current.id}' has duplicate edge '${edgeId}' for seed ${state.seed}.`
                    )
                );
                continue;
            }
            seenEdgeIds.add(edgeId);
            const target = nodeById.get(edgeId);
            if (!target) {
                issues.push(
                    routeIssue(
                        state,
                        'route_edge_target_missing',
                        edgeId,
                        `Current route edge '${edgeId}' points at a missing node for seed ${state.seed}.`
                    )
                );
                continue;
            }
            if (isSkippedSiblingAfterSelection(state, target)) {
                continue;
            }
            if (!nodeCanBeEntered(target)) {
                issues.push(
                    routeIssue(
                        state,
                        'route_edge_target_blocked',
                        target.id,
                        `Route target '${target.id}' is '${target.status}' and cannot be entered for seed ${state.seed}.`
                    )
                );
                continue;
            }
            legalTargetIds.push(target.id);
        }
    }

    if (current) {
        const edgeIds = new Set(current.edgeIds);
        for (const node of state.nodes) {
            if (node.id === current.id || node.status !== 'revealed' || node.floor > current.floor || edgeIds.has(node.id)) {
                continue;
            }
            issues.push(
                routeIssue(
                    state,
                    'route_stale_revealed_backtrack',
                    node.id,
                    `Route node '${node.id}' is still revealed behind current room '${current.id}' for seed ${state.seed}.`
                )
            );
        }

        for (const node of state.nodes) {
            if (node.status !== 'revealed' || node.floor <= current.floor || edgeIds.has(node.id)) {
                continue;
            }
            issues.push(
                routeIssue(
                    state,
                    'route_orphan_revealed_future',
                    node.id,
                    `Route node '${node.id}' is revealed ahead of current room '${current.id}' but is not a legal edge for seed ${state.seed}.`
                )
            );
        }
    }

    const selected = state.selectedNodeId ? nodeById.get(state.selectedNodeId) ?? null : null;
    if (state.selectedNodeId && (!selected || !legalTargetIds.includes(state.selectedNodeId))) {
        issues.push(
            routeIssue(
                state,
                'route_selected_node_unreachable',
                state.selectedNodeId,
                `Selected route node '${state.selectedNodeId}' is not reachable from '${state.currentNodeId}' for seed ${state.seed}.`
            )
        );
    }

    const revealedExits = state.nodes.filter((node) => node.kind === 'exit' && node.status === 'revealed');
    for (const exit of revealedExits) {
        if (!legalTargetIds.includes(exit.id) && exit.floor > state.currentFloor) {
            issues.push(
                routeIssue(
                    state,
                    'route_exit_unreachable',
                    exit.id,
                    `Exit route node '${exit.id}' is revealed but unreachable from '${state.currentNodeId}' for seed ${state.seed}.`
                )
            );
        }
    }

    const revealedBosses = state.nodes.filter((node) => node.kind === 'boss' && node.status === 'revealed');
    for (const boss of revealedBosses) {
        if (!legalTargetIds.includes(boss.id) && boss.floor > state.currentFloor) {
            issues.push(
                routeIssue(
                    state,
                    'route_boss_transition_unreachable',
                    boss.id,
                    `Boss route node '${boss.id}' is revealed but unreachable from '${state.currentNodeId}' for seed ${state.seed}.`
                )
            );
        }
    }

    if (current && current.edgeIds.length > 0 && legalTargetIds.length === 0) {
        issues.push(
            routeIssue(
                state,
                'route_no_legal_progression',
                current.id,
                `Route node '${current.id}' has no legal progression target for seed ${state.seed}.`
            )
        );
    }

    return {
        seed: state.seed,
        rulesVersion: state.rulesVersion,
        currentFloor: state.currentFloor,
        currentNodeId: state.currentNodeId,
        legalTargetIds,
        hasLegalProgressionPath: issues.every((issue) => !DUNGEON_ROUTE_BLOCKING_ISSUES.includes(issue.code)),
        issues
    };
};

export const repairDungeonRunMapProgression = (state: DungeonRunMapState): DungeonRunMapState => {
    const sourceNodes = dedupeDungeonRunNodes(state);
    const current =
        sourceNodes.find((node) => node.id === state.currentNodeId) ??
        sourceNodes.find((node) => node.status === 'current') ??
        sourceNodes.find((node) => node.status === 'cleared' && node.edgeIds.length > 0);
    if (!current) {
        return createDungeonRunMapState(state.seed, state.rulesVersion, Math.max(1, state.currentFloor));
    }

    const edgeIds = new Set(current.edgeIds);
    const repairedNodes = sourceNodes.map((node) => {
        if (node.id === current.id) {
            return {
                ...node,
                edgeIds: [...edgeIds],
                status: node.status === 'cleared' && node.edgeIds.length > 0 ? ('cleared' as const) : ('current' as const)
            };
        }
        if (isSkippedSiblingAfterSelection(state, node)) {
            return node;
        }
        if (node.status === 'revealed' && node.floor <= current.floor && !edgeIds.has(node.id)) {
            return { ...node, status: 'skipped' as const };
        }
        if (node.status === 'revealed' && node.floor > current.floor && !edgeIds.has(node.id)) {
            return { ...node, status: 'hidden' as const };
        }
        if (edgeIds.has(node.id) && node.floor > current.floor && node.status !== 'revealed') {
            return { ...node, status: 'revealed' as const };
        }
        if (node.status === 'current') {
            if (edgeIds.has(node.id) && node.floor > current.floor) {
                return { ...node, status: 'revealed' as const };
            }
            return { ...node, status: node.floor <= current.floor ? 'skipped' as const : 'hidden' as const };
        }
        return node;
    });

    const selectedForRepair = state.selectedNodeId
        ? sourceNodes.find((node) => node.id === state.selectedNodeId) ?? null
        : null;
    const repairedState = {
        ...state,
        act: actForFloor(current.floor),
        currentFloor: current.floor,
        currentNodeId: current.id,
        selectedNodeId:
            state.selectedNodeId &&
            edgeIds.has(state.selectedNodeId) &&
            selectedForRepair &&
            selectedForRepair.floor === current.floor + 1 &&
            nodeCanBeEntered(selectedForRepair)
                ? state.selectedNodeId
                : null,
        nodes: repairedNodes
    };
    const report = inspectDungeonRunMapProgression(repairedState);
    const currentWithRepairedTargets =
        repairedState.nodes.find((node) => node.id === repairedState.currentNodeId) ?? current;
    const repairableEdgeIds = getRepairableCurrentEdgeIds(repairedState, currentWithRepairedTargets);
    if (
        repairableEdgeIds.length > 0 &&
        report.issues.some((issue) => issue.code === 'route_duplicate_edge_target' || issue.code === 'route_edge_target_missing')
    ) {
        return {
            ...repairedState,
            nodes: repairedState.nodes.map((node) =>
                node.id === repairedState.currentNodeId ? { ...node, edgeIds: repairableEdgeIds } : node
            )
        };
    }
    if (report.issues.some((issue) => issue.code === 'route_no_legal_progression' || issue.code === 'route_edge_target_missing')) {
        const nextFloor = current.floor + 1;
        const fallbackChoices = generateRunMapChoices({
            runSeed: state.seed,
            rulesVersion: state.rulesVersion,
            currentFloor: current.floor
        });
        const fallbackIds = fallbackChoices.map((node) => node.id);
        const nodesWithoutNextFloor = repairedNodes.filter((node) => node.floor !== nextFloor);
        const fallbackCurrent = { ...current, edgeIds: fallbackIds, status: 'current' as const };
        return {
            ...repairedState,
            selectedNodeId: null,
            nodes: nodesWithoutNextFloor
                .map((node) => (node.id === current.id ? fallbackCurrent : node))
                .concat(fallbackChoices)
        };
    }
    return repairedState;
};

export const createDungeonRunMapState = (
    seed: number,
    rulesVersion: number,
    currentFloor: number
): DungeonRunMapState => {
    const currentKind: DungeonRunNodeKind = currentFloor > 0 && currentFloor % DUNGEON_ACT_LENGTH === 0 ? 'boss' : 'combat';
    const current = createNode({
        floor: currentFloor,
        depth: currentFloor,
        lane: 0,
        kind: currentFloor <= 1 ? 'entrance' : currentKind,
        status: 'current'
    });
    return {
        seed,
        rulesVersion,
        act: actForFloor(currentFloor),
        currentFloor,
        currentNodeId: current.id,
        selectedNodeId: null,
        nodes: [current]
    };
};

export const routeChoiceToMapNode = (choice: RouteChoice, fallbackFloor: number, lane = 0): RunMapNode =>
    createNode({
        floor: fallbackFloor,
        depth: fallbackFloor,
        lane,
        kind: kindFromRouteChoice(choice, fallbackFloor),
        status: 'revealed',
        choice
    });

export const revealDungeonChoices = (
    state: DungeonRunMapState,
    currentFloor: number,
    choices: readonly RouteChoice[]
): DungeonRunMapState => {
    const safeState = repairDungeonRunMapProgression(state);
    const current = safeState.nodes.find((node) => node.id === safeState.currentNodeId) ?? null;
    const sourceFloor = Math.max(currentFloor, safeState.currentFloor, current?.floor ?? currentFloor);
    const nextFloor = sourceFloor + 1;
    const revealed =
        choices.length > 0
            ? choices.map((choice, index) => routeChoiceToMapNode(choice, nextFloor, DUNGEON_BRANCH_LANES[index] ?? index))
            : generateRunMapChoices({
                  runSeed: safeState.seed,
                  rulesVersion: safeState.rulesVersion,
                  currentFloor: sourceFloor
              });
    const revealedIds = new Set(revealed.map((node) => node.id));
    const replaceableBranchStatuses: readonly DungeonRunNodeStatus[] = ['hidden', 'revealed', 'skipped', 'locked'];
    const existing = safeState.nodes.filter(
        (node) =>
            !revealedIds.has(node.id) &&
            !(
                node.floor === nextFloor &&
                node.id !== safeState.currentNodeId &&
                replaceableBranchStatuses.includes(node.status)
            )
    );
    const nodes = connect(
        existing.map((node) =>
            node.id === safeState.currentNodeId ? { ...node, status: 'cleared' as const, edgeIds: [] } : node
        ),
        safeState.currentNodeId,
        revealed.map((node) => node.id)
    );
    return repairDungeonRunMapProgression({
        ...safeState,
        currentFloor: sourceFloor,
        selectedNodeId: null,
        nodes: [...nodes, ...revealed]
    });
};

export const clearCurrentDungeonNode = (
    state: DungeonRunMapState,
    currentFloor: number
): DungeonRunMapState => {
    const safeState = repairDungeonRunMapProgression(state);
    return {
        ...safeState,
        currentFloor,
        nodes: safeState.nodes.map((node) =>
            node.id === safeState.currentNodeId ? { ...node, status: 'cleared' as const } : node
        )
    };
};

export const selectDungeonNode = (state: DungeonRunMapState, nodeId: string): DungeonRunMapState => {
    const safeState = repairDungeonRunMapProgression(state);
    const report = inspectDungeonRunMapProgression(safeState);
    const node = safeState.nodes.find((candidate) => candidate.id === nodeId);
    if (!report.legalTargetIds.includes(nodeId)) {
        return safeState;
    }
    if (!node || node.status !== 'revealed') {
        return safeState;
    }
    return {
        ...safeState,
        selectedNodeId: node.id,
        nodes: safeState.nodes.map((candidate) =>
            candidate.status === 'revealed' && candidate.floor === node.floor && candidate.id !== node.id
                ? { ...candidate, status: 'skipped' }
                : candidate
        )
    };
};

export const enterSelectedDungeonNode = (state: DungeonRunMapState): DungeonRunMapState => {
    const safeState = repairDungeonRunMapProgression(state);
    const report = inspectDungeonRunMapProgression(safeState);
    const selected = safeState.nodes.find((node) => node.id === safeState.selectedNodeId);
    if (!selected || !report.legalTargetIds.includes(selected.id)) {
        return safeState;
    }
    return {
        ...safeState,
        currentFloor: selected.floor,
        currentNodeId: selected.id,
        selectedNodeId: null,
        act: actForFloor(selected.floor),
        nodes: safeState.nodes.map((node) =>
            node.id === selected.id
                ? { ...node, status: 'current' }
                : node.status === 'current'
                  ? { ...node, status: 'cleared' }
                  : node
        )
    };
};

export const getCurrentDungeonNode = (state: DungeonRunMapState): DungeonRunNode | null =>
    state.nodes.find((node) => node.id === state.currentNodeId) ?? null;

export const getSelectedDungeonNode = (state: DungeonRunMapState): DungeonRunNode | null =>
    state.selectedNodeId ? state.nodes.find((node) => node.id === state.selectedNodeId) ?? null : null;

export const getRepairedSelectedDungeonNode = (state: DungeonRunMapState): DungeonRunNode | null => {
    const repaired = repairDungeonRunMapProgression(state);
    return getSelectedDungeonNode(repaired);
};

export const getRevealedDungeonNodes = (state: DungeonRunMapState): DungeonRunNode[] =>
    state.nodes
        .filter((node) => node.status === 'revealed')
        .sort((a, b) => a.floor - b.floor || a.lane - b.lane || a.id.localeCompare(b.id));

export const getDungeonRoomPresentation = (node: DungeonRunNode): DungeonRoomPresentation => ({
    id: node.id,
    label: node.label,
    eyebrow:
        node.kind === 'boss'
            ? [
                  `Act ${Math.max(1, Math.ceil(node.floor / DUNGEON_ACT_LENGTH))} boss`,
                  node.routeApproachLabel
              ]
                  .filter(Boolean)
                  .join(' / ')
            : `Depth ${node.floor} / Lane ${node.lane > 0 ? `+${node.lane}` : node.lane}`,
    detail: node.detail,
    mechanic: mechanicForKind(node.kind),
    reward: node.rewardPreview ?? rewardForKind(node.kind),
    risk: node.riskPreview ?? riskForKind(node.kind),
    glyph: glyphForKind(node.kind),
    tone: toneForKind(node.kind)
});

const presentNode = (node: DungeonRunNode): DungeonMapNodePresentation => ({
    ...getDungeonRoomPresentation(node),
    floor: node.floor,
    lane: node.lane,
    status: node.status,
    edgeIds: node.edgeIds,
    routeType: node.routeType,
    routeApproachLabel: node.routeApproachLabel,
    routeApproachType: node.routeApproachType
});

export const getDungeonMapPresentation = (state: DungeonRunMapState): DungeonMapPresentation => {
    const nodes = state.nodes
        .map(presentNode)
        .sort((a, b) => a.floor - b.floor || a.lane - b.lane || a.id.localeCompare(b.id));
    const current = nodes.find((node) => node.id === state.currentNodeId) ?? null;
    const selected = state.selectedNodeId ? nodes.find((node) => node.id === state.selectedNodeId) ?? null : null;
    const bossFloor = Math.ceil(Math.max(1, state.currentFloor) / DUNGEON_ACT_LENGTH) * DUNGEON_ACT_LENGTH;
    return {
        act: state.act,
        currentFloor: state.currentFloor,
        bossFloor,
        bossDistance: Math.max(0, bossFloor - state.currentFloor),
        current,
        selected,
        nodes,
        revealed: nodes.filter((node) => node.status === 'revealed'),
        cleared: nodes.filter((node) => node.status === 'cleared'),
        skipped: nodes.filter((node) => node.status === 'skipped')
    };
};

export const getDungeonRouteDecisionPresentation = (
    state: DungeonRunMapState,
    choices: readonly RouteChoice[]
): DungeonRouteDecisionPresentation => {
    const preview = revealDungeonChoices(state, state.currentFloor, choices);
    const map = getDungeonMapPresentation(preview);
    const rows = choices.map((choice) => {
        const fallbackNode = routeChoiceToMapNode(choice, state.currentFloor + 1);
        const node = map.revealed.find((candidate) => candidate.id === choice.id) ?? presentNode(fallbackNode);
        const source = preview.nodes.find((candidate) => candidate.id === node.id) ?? fallbackNode;
        return {
            id: choice.id,
            routeType: choice.routeType,
            choiceLabel: choice.label,
            nodeLabel:
                source.kind === 'boss' && source.routeApproachLabel
                    ? `${labelForKind(source.kind)} via ${source.routeApproachLabel}`
                    : labelForKind(source.kind),
            approachLabel: source.routeApproachLabel,
            nodeKind: source.kind,
            glyph: node.glyph,
            tone: node.tone,
            risk: node.risk,
            reward: node.reward,
            mechanic: node.mechanic,
            detail: node.detail,
            sourceNodeId: map.current?.id ?? null,
            targetFloor: node.floor,
            selected: state.selectedNodeId === choice.id
        };
    });

    return {
        act: map.act,
        bossFloor: map.bossFloor,
        bossDistance: map.bossDistance,
        current: map.current,
        rows,
        summary: rows
            .map((row) => `${row.choiceLabel} -> ${row.nodeLabel} depth ${row.targetFloor}: ${row.detail}`)
            .join(' | ')
    };
};

export const generateRunMapChoices = ({
    runSeed,
    rulesVersion,
    currentFloor
}: {
    runSeed: number;
    rulesVersion: number;
    currentFloor: number;
}): RunMapNode[] => {
    const nextFloor = currentFloor + 1;
    const base = `${rulesVersion}:${runSeed}:${nextFloor}`;
    const boss = nextFloor > 0 && nextFloor % DUNGEON_ACT_LENGTH === 0;
    const rng = createMulberry32(hashStringToSeed(`dungeonMap:${rulesVersion}:${runSeed}:${currentFloor}`));
    const middleKind = nextFloor % 3 === 0 ? 'shop' : nextFloor % 5 === 0 ? 'trap' : 'elite';
    const mysteryKind = nextFloor % 4 === 0 ? 'treasure' : 'event';
    const nodes = [
        createNode({ floor: nextFloor, depth: nextFloor, lane: -1, kind: boss ? 'boss' : 'combat', status: 'revealed' }),
        createNode({ floor: nextFloor, depth: nextFloor, lane: 0, kind: boss ? 'boss' : middleKind, status: 'revealed' }),
        createNode({ floor: nextFloor, depth: nextFloor, lane: 1, kind: boss ? 'boss' : mysteryKind, status: 'revealed' })
    ].map((node, index) => {
        if (!boss) {
            return node;
        }
        const approach = DUNGEON_BRANCH_APPROACHES[index] ?? DUNGEON_BRANCH_APPROACHES[0]!;
        return {
            ...node,
            routeApproachLabel: approach.label,
            routeApproachType: approach.routeType
        };
    });
    return shuffleWithRng(() => rng(), nodes).map((node, index) => ({
        ...node,
        id: `${base}:${node.routeType}:${index}`,
        choiceId: `${base}:${node.routeType}:${index}`
    }));
};

export const createRunMapState = (seed: number, rulesVersion: number, currentFloor: number): RunMapState => ({
    seed,
    rulesVersion,
    currentFloor,
    nextNodes: generateRunMapChoices({ runSeed: seed, rulesVersion, currentFloor }),
    selectedNodeId: null
});

export const chooseRunMapNode = (state: RunMapState, nodeId: string): RunMapState => {
    if (!state.nextNodes.some((node) => node.id === nodeId)) {
        return state;
    }
    return { ...state, selectedNodeId: nodeId };
};

export const buildRunMapPreview = (
    seed: number,
    rulesVersion: number,
    currentFloor: number,
    choices: readonly RouteChoice[]
): RunMapPreview => ({
    seed,
    rulesVersion,
    currentFloor,
    nextNodes: choices.map((choice, index) => routeChoiceToMapNode(choice, currentFloor + 1, DUNGEON_BRANCH_LANES[index] ?? index))
});

export const runMapHasShopHook = (preview: RunMapPreview): boolean =>
    preview.nextNodes.some((node) => node.kind === 'shop' || node.detail.toLowerCase().includes('shop'));
