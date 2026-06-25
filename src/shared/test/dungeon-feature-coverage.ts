import type {
    BoardState,
    DungeonCardEffectId,
    DungeonCardKind,
    DungeonRunNodeKind,
    FloorArchetypeId,
    FloorTag,
    RouteNodeType
} from '../contracts';
import { GAME_RULES_VERSION } from '../contracts';
import { buildBoard, getEffectivePrimaryExitLock } from '../board-generation';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../dungeon-rules';

export const EXPECTED_GAMEPLAY_NODE_KINDS: DungeonRunNodeKind[] = [
    'combat',
    'elite',
    'trap',
    'treasure',
    'shop',
    'rest',
    'event',
    'boss'
];

export const EXPECTED_GAMEPLAY_CARD_KINDS: DungeonCardKind[] = [
    'enemy',
    'trap',
    'treasure',
    'shrine',
    'gateway',
    'key',
    'lock',
    'exit',
    'lever',
    'shop',
    'room'
];

export const EXPECTED_MAJOR_EFFECT_FAMILIES = [
    'enemy',
    'trap',
    'treasure',
    'shrine',
    'gateway',
    'key',
    'lock',
    'exit',
    'lever',
    'shop',
    'room'
] as const;

export interface DungeonFeatureSample {
    label: string;
    nodeKind: DungeonRunNodeKind;
    board: BoardState;
}

export interface DungeonFeatureCoverage {
    samples: DungeonFeatureSample[];
    nodeKinds: Set<DungeonRunNodeKind>;
    cardKinds: Set<DungeonCardKind>;
    effectFamilies: Set<(typeof EXPECTED_MAJOR_EFFECT_FAMILIES)[number]>;
    objectives: Set<string>;
    archetypes: Set<string>;
    routeTypes: Set<RouteNodeType>;
    hasBoss: boolean;
    hasExit: boolean;
    hasShopTile: boolean;
    hasRoomTile: boolean;
    hasLockedExit: boolean;
    hasRouteGateway: boolean;
}

interface SampleSpec {
    label: string;
    level: number;
    runSeed: number;
    nodeKind: DungeonRunNodeKind;
    floorTag?: FloorTag;
    floorArchetypeId?: FloorArchetypeId;
}

const GENERATED_BOARD_SAMPLE_SPECS: SampleSpec[] = [
    { label: 'early combat exit', level: 2, runSeed: 210_000, nodeKind: 'combat' },
    { label: 'standard combat', level: 5, runSeed: 210_001, nodeKind: 'combat' },
    { label: 'elite rush room', level: 5, runSeed: 210_002, nodeKind: 'elite' },
    { label: 'trap hall', level: 5, runSeed: 210_003, nodeKind: 'trap' },
    { label: 'treasure gallery', level: 5, runSeed: 210_004, nodeKind: 'treasure' },
    { label: 'deep treasure lock room', level: 8, runSeed: 210_014, nodeKind: 'treasure' },
    { label: 'vendor alcove', level: 5, runSeed: 210_005, nodeKind: 'shop' },
    { label: 'quiet rest', level: 5, runSeed: 210_006, nodeKind: 'rest' },
    { label: 'script event room', level: 5, runSeed: 210_007, nodeKind: 'event' },
    { label: 'boss chamber', level: 6, runSeed: 210_008, nodeKind: 'boss' },
    { label: 'high-lock trap hall', level: 8, runSeed: 210_009, nodeKind: 'trap' },
    { label: 'script shrine room', level: 7, runSeed: 210_010, nodeKind: 'event' }
];

const effectFamilyFor = (
    effectId: DungeonCardEffectId
): (typeof EXPECTED_MAJOR_EFFECT_FAMILIES)[number] | null => {
    const family = effectId.split('_')[0];
    if (family === 'rune') return 'lever';
    if (EXPECTED_MAJOR_EFFECT_FAMILIES.includes(family as (typeof EXPECTED_MAJOR_EFFECT_FAMILIES)[number])) {
        return family as (typeof EXPECTED_MAJOR_EFFECT_FAMILIES)[number];
    }
    return null;
};

export const collectDungeonFeatureCoverage = (): DungeonFeatureCoverage => {
    const samples = GENERATED_BOARD_SAMPLE_SPECS.map((spec) => ({
        label: spec.label,
        nodeKind: spec.nodeKind,
        board: buildBoard(spec.level, {
            runSeed: spec.runSeed,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: spec.floorTag,
            floorArchetypeId: spec.floorArchetypeId,
            dungeonNodeKind: spec.nodeKind,
            gameMode: 'endless'
        })
    }));
    const coverage: DungeonFeatureCoverage = {
        samples,
        nodeKinds: new Set(samples.map((sample) => sample.nodeKind)),
        cardKinds: new Set(),
        effectFamilies: new Set(),
        objectives: new Set(),
        archetypes: new Set(),
        routeTypes: new Set(),
        hasBoss: false,
        hasExit: false,
        hasShopTile: false,
        hasRoomTile: false,
        hasLockedExit: false,
        hasRouteGateway: false
    };

    for (const sample of samples) {
        if (sample.board.floorArchetypeId) {
            coverage.archetypes.add(sample.board.floorArchetypeId);
        }
        if (sample.board.dungeonObjectiveId) {
            coverage.objectives.add(sample.board.dungeonObjectiveId);
        }
        if (sample.board.dungeonBossId) {
            coverage.hasBoss = true;
        }
        coverage.hasExit ||= sample.board.tiles.some((tile) => tile.pairKey === EXIT_PAIR_KEY);
        coverage.hasShopTile ||= sample.board.tiles.some((tile) => tile.pairKey === SHOP_PAIR_KEY);
        coverage.hasRoomTile ||= sample.board.tiles.some((tile) => tile.pairKey === ROOM_PAIR_KEY);
        coverage.hasLockedExit ||= getEffectivePrimaryExitLock({ board: sample.board }).lockKind !== 'none';

        for (const tile of sample.board.tiles) {
            if (tile.dungeonCardKind) {
                coverage.cardKinds.add(tile.dungeonCardKind);
            }
            if (tile.dungeonCardEffectId) {
                const family = effectFamilyFor(tile.dungeonCardEffectId);
                if (family) {
                    coverage.effectFamilies.add(family);
                }
            }
            if (tile.dungeonRouteType) {
                coverage.routeTypes.add(tile.dungeonRouteType);
                if (tile.dungeonCardKind === 'gateway') {
                    coverage.hasRouteGateway = true;
                }
            }
        }
    }

    return coverage;
};

export const missingCoverage = <T extends string>(expected: readonly T[], actual: ReadonlySet<T>): T[] =>
    expected.filter((item) => !actual.has(item));

export const formatDungeonCoverageFailure = (coverage: DungeonFeatureCoverage): string => {
    const missingNodes = missingCoverage(EXPECTED_GAMEPLAY_NODE_KINDS, coverage.nodeKinds);
    const missingCards = missingCoverage(EXPECTED_GAMEPLAY_CARD_KINDS, coverage.cardKinds);
    const missingEffects = missingCoverage(EXPECTED_MAJOR_EFFECT_FAMILIES, coverage.effectFamilies);
    const missingFlags = [
        coverage.hasBoss ? null : 'boss',
        coverage.hasExit ? null : 'exit',
        coverage.hasShopTile ? null : 'shop tile',
        coverage.hasRoomTile ? null : 'room tile',
        coverage.hasLockedExit ? null : 'locked exit',
        coverage.hasRouteGateway ? null : 'route gateway'
    ].filter((item): item is string => item != null);

    return [
        `missing nodes: ${missingNodes.join(', ') || 'none'}`,
        `missing cards: ${missingCards.join(', ') || 'none'}`,
        `missing effects: ${missingEffects.join(', ') || 'none'}`,
        `missing flags: ${missingFlags.join(', ') || 'none'}`,
        `samples: ${coverage.samples
            .map(
                (sample) =>
                    `${sample.label}=${sample.nodeKind}/${sample.board.floorArchetypeId ?? 'none'}/${sample.board.dungeonObjectiveId ?? 'none'}`
            )
            .join('; ')}`
    ].join('\n');
};
