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
    rewardPolicy: string;
}

const DUNGEON_ACT_LENGTH = 6;
const DUNGEON_BRANCH_LANES = [-1, 0, 1] as const;
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

const labelForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'entrance':
            return 'Dungeon gate';
        case 'shop':
            return 'Vendor alcove';
        case 'elite':
            return 'Elite memory';
        case 'trap':
            return 'Trap hall';
        case 'rest':
            return 'Quiet rest';
        case 'event':
            return 'Odd event';
        case 'treasure':
            return 'Treasure gallery';
        case 'boss':
            return 'Boss chamber';
        case 'exit':
            return 'Descent stair';
        case 'combat':
        default:
            return 'Survey hall';
    }
};

const detailForKind = (kind: DungeonRunNodeKind): string => {
    switch (kind) {
        case 'shop':
            return 'A vendor room is embedded in the next board.';
        case 'elite':
            return 'A harder memory room with richer reward pressure.';
        case 'trap':
            return 'Hazards are denser and safer paths are less obvious.';
        case 'rest':
            return 'A breather room with more utility and recovery hooks.';
        case 'event':
            return 'A scripted oddity changes the next encounter texture.';
        case 'treasure':
            return 'Reward cards and locked caches are more likely.';
        case 'boss':
            return 'A chapter guardian anchors the room.';
        case 'exit':
            return 'A descent marker that closes the current chapter.';
        case 'entrance':
            return 'The first room of the run.';
        case 'combat':
        default:
            return 'A standard memory encounter.';
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
            return 'Elite enemy pressure and greed anchors.';
        case 'trap':
            return 'Snare, hex, or alarm traps disrupt mistakes.';
        case 'rest':
            return 'Utility rooms and recovery cards replace most threats.';
        case 'event':
            return 'Archive and omen cards bend the room texture.';
        case 'treasure':
            return 'Caches, keys, and locks compete for side pockets.';
        case 'boss':
            return 'Named boss card and pacify objective define the room.';
        case 'exit':
            return 'Commit to the descent and close the chapter.';
        case 'entrance':
            return 'Entry room teaches the run shape.';
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
            return 'Higher score and stronger route rewards.';
        case 'trap':
            return 'Safer exits after disarming hazards.';
        case 'rest':
            return 'Recovery, keys, guard, or shrine utility.';
        case 'event':
            return 'Odd reward, map, favor, or key outcome.';
        case 'treasure':
            return 'Gold, cache cards, keys, and locked loot.';
        case 'boss':
            return 'Boss multiplier and chapter payoff.';
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
            return 'High pressure.';
        case 'trap':
            return 'Mistakes can cost tempo, guard, or life.';
        case 'boss':
            return 'Chapter danger.';
        case 'event':
            return 'Unusual rules.';
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
    const routeType = choice?.routeType ?? routeTypeForKind(kind);
    return {
        id: choice?.id ?? nodeId(floor, lane, kind),
        floor,
        depth,
        lane,
        kind,
        status,
        routeType,
        label: kind === 'boss' && choice ? 'Boss chamber' : choice?.label ?? labelForKind(kind),
        detail: choice?.detail ?? detailForKind(kind),
        rewardPreview: choice?.rewardPreview,
        riskPreview: choice?.riskPreview,
        edgeIds: [],
        choiceId: choice?.id,
        offlineOnly: true,
        unlocksSystems: systemsForKind(kind)
    };
};

const connect = (nodes: DungeonRunNode[], fromId: string, toIds: string[]): DungeonRunNode[] =>
    nodes.map((node) => (node.id === fromId ? { ...node, edgeIds: [...new Set([...node.edgeIds, ...toIds])] } : node));

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
        act: Math.max(1, Math.ceil(currentFloor / DUNGEON_ACT_LENGTH)),
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
    const nextFloor = currentFloor + 1;
    const revealed = choices.map((choice, index) =>
        routeChoiceToMapNode(choice, nextFloor, DUNGEON_BRANCH_LANES[index] ?? index)
    );
    const revealedIds = new Set(revealed.map((node) => node.id));
    const existing = state.nodes.filter((node) => !revealedIds.has(node.id));
    const nodes = connect(
        existing.map((node) =>
            node.id === state.currentNodeId ? { ...node, status: 'cleared' as const } : node
        ),
        state.currentNodeId,
        revealed.map((node) => node.id)
    );
    return {
        ...state,
        currentFloor,
        selectedNodeId: null,
        nodes: [...nodes, ...revealed]
    };
};

export const selectDungeonNode = (state: DungeonRunMapState, nodeId: string): DungeonRunMapState => {
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.status !== 'revealed') {
        return state;
    }
    return {
        ...state,
        selectedNodeId: node.id,
        nodes: state.nodes.map((candidate) =>
            candidate.status === 'revealed' && candidate.floor === node.floor && candidate.id !== node.id
                ? { ...candidate, status: 'skipped' }
                : candidate
        )
    };
};

export const enterSelectedDungeonNode = (state: DungeonRunMapState): DungeonRunMapState => {
    const selected = state.nodes.find((node) => node.id === state.selectedNodeId);
    if (!selected) {
        return state;
    }
    return {
        ...state,
        currentFloor: selected.floor,
        currentNodeId: selected.id,
        selectedNodeId: null,
        act: Math.max(1, Math.ceil(selected.floor / DUNGEON_ACT_LENGTH)),
        nodes: state.nodes.map((node) =>
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

export const getRevealedDungeonNodes = (state: DungeonRunMapState): DungeonRunNode[] =>
    state.nodes
        .filter((node) => node.status === 'revealed')
        .sort((a, b) => a.floor - b.floor || a.lane - b.lane || a.id.localeCompare(b.id));

export const getDungeonRoomPresentation = (node: DungeonRunNode): DungeonRoomPresentation => ({
    id: node.id,
    label: node.label,
    eyebrow:
        node.kind === 'boss'
            ? `Act ${Math.max(1, Math.ceil(node.floor / DUNGEON_ACT_LENGTH))} boss`
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
    routeType: node.routeType
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
            nodeLabel: labelForKind(source.kind),
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
        summary: rows.map((row) => `${row.choiceLabel}: ${row.detail}`).join(' · ')
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
    ];
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
