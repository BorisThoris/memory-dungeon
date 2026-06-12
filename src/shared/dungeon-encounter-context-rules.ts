import type {
    DungeonBossId,
    DungeonRunNodeKind,
    EnemyHazardKind,
    EnemyHazardPattern,
    FloorArchetypeId,
    FloorTag
} from './contracts';
import {
    DUNGEON_BOSS_DEFINITIONS,
    getDungeonBossDefinition
} from './dungeon-boss-rules';

export interface DungeonEncounterContext {
    nodeKind: DungeonRunNodeKind | null;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    pairCountDelta: number;
}

export const floorTagForDungeonNode = (kind: DungeonRunNodeKind | null | undefined, fallback: FloorTag): FloorTag => {
    if (kind === 'boss') {
        return 'boss';
    }
    if (kind === 'rest' || kind === 'shop') {
        return 'breather';
    }
    return fallback;
};

export const floorArchetypeForDungeonNode = (
    kind: DungeonRunNodeKind | null | undefined,
    fallback: FloorArchetypeId | null
): FloorArchetypeId | null => {
    if (kind === 'treasure') {
        return 'treasure_gallery';
    }
    if (kind === 'trap') {
        return 'trap_hall';
    }
    if (kind === 'event') {
        return 'script_room';
    }
    if (kind === 'elite') {
        return 'rush_recall';
    }
    if (kind === 'rest' || kind === 'shop') {
        return 'breather';
    }
    return fallback;
};

export const createDungeonEncounterContext = (
    nodeKind: DungeonRunNodeKind | null | undefined,
    fallbackFloorTag: FloorTag,
    fallbackFloorArchetypeId: FloorArchetypeId | null
): DungeonEncounterContext => {
    const normalizedKind = nodeKind ?? null;
    const pairCountDelta =
        normalizedKind === 'elite' || normalizedKind === 'trap' || normalizedKind === 'boss'
            ? 1
            : normalizedKind === 'rest' || normalizedKind === 'shop'
              ? -1
              : normalizedKind === 'treasure' || normalizedKind === 'event'
                ? 0
                : 0;
    return {
        nodeKind: normalizedKind,
        floorTag: floorTagForDungeonNode(normalizedKind, fallbackFloorTag),
        floorArchetypeId: floorArchetypeForDungeonNode(normalizedKind, fallbackFloorArchetypeId),
        pairCountDelta
    };
};

export const enemyHazardProfileForBoss = (
    bossId: DungeonBossId | null
): { kind: EnemyHazardKind; pattern: EnemyHazardPattern; label: string; hp: number } => {
    const definition = getDungeonBossDefinition(bossId) ?? DUNGEON_BOSS_DEFINITIONS.rush_sentinel;
    return {
        kind: definition.hazardKind,
        pattern: definition.hazardPattern,
        label: definition.label,
        hp: definition.hp
    };
};
