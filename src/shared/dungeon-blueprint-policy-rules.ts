import type {
    DungeonCardEffectId,
    DungeonExitLockKind,
    DungeonFloorBlueprint,
    DungeonRunNodeKind,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    RouteNodeType
} from './contracts';
import { createDungeonEncounterContext } from './dungeon-encounter-context-rules';
import {
    createMulberry32,
    hashStringToSeed,
    pickRngIndex
} from './rng';
import { NUMBER_SYMBOLS } from './tile-symbol-catalog';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const exitRouteTypeForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): RouteNodeType => {
    if (floorTag === 'boss' || floorArchetypeId === 'trap_hall' || floorArchetypeId === 'rush_recall') {
        return 'greed';
    }
    if (floorArchetypeId === 'treasure_gallery' || floorArchetypeId === 'spotlight_hunt' || level % 4 === 0) {
        return 'mystery';
    }
    return 'safe';
};

export const primaryExitLockKindForFloor = (
    level: number,
    floorArchetypeId: FloorArchetypeId | null
): DungeonExitLockKind => {
    if (level <= 2) {
        return 'none';
    }
    if (
        floorArchetypeId === 'script_room' ||
        floorArchetypeId === 'spotlight_hunt' ||
        floorArchetypeId === 'rush_recall' ||
        level % 3 === 0
    ) {
        return 'lever';
    }
    return 'none';
};

export const requiredLeverCountForFloor = (level: number, lockKind: DungeonExitLockKind): number =>
    lockKind === 'lever' ? (level >= 8 ? 2 : 1) : 0;

export const budgetForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): Pick<DungeonFloorBlueprint, 'threatBudget' | 'rewardBudget' | 'utilityBudget' | 'lockBudget' | 'gatewayBudget'> => {
    const boss = floorTag === 'boss';
    if (floorArchetypeId === 'treasure_gallery') {
        return { threatBudget: boss ? 2 : 1, rewardBudget: 3, utilityBudget: 2, lockBudget: level >= 4 ? 2 : 1, gatewayBudget: level >= 5 ? 1 : 0 };
    }
    if (floorArchetypeId === 'trap_hall') {
        return { threatBudget: 4, rewardBudget: 1, utilityBudget: 1, lockBudget: 1, gatewayBudget: boss ? 1 : 0 };
    }
    if (floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read') {
        return { threatBudget: 1, rewardBudget: 1, utilityBudget: 2, lockBudget: level >= 4 ? 1 : 0, gatewayBudget: 1 };
    }
    if (floorArchetypeId === 'breather' || floorTag === 'breather') {
        return { threatBudget: 0, rewardBudget: 2, utilityBudget: 2, lockBudget: 0, gatewayBudget: 0 };
    }
    if (boss) {
        return { threatBudget: 2, rewardBudget: 1, utilityBudget: 1, lockBudget: 1, gatewayBudget: 1 };
    }
    return {
        threatBudget: level >= 2 ? 1 : 0,
        rewardBudget: level % 3 === 0 ? 1 : 0,
        utilityBudget: level >= 2 ? 1 : 0,
        lockBudget: level >= 4 ? 1 : 0,
        gatewayBudget: level >= 5 && level % 5 === 0 ? 1 : 0
    };
};

export const dungeonObjectiveForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['objectiveId'] => {
    if (floorTag === 'boss') {
        return 'defeat_boss';
    }
    if (floorArchetypeId === 'trap_hall') {
        return 'disarm_traps';
    }
    if (floorArchetypeId === 'rush_recall') {
        return 'pacify_floor';
    }
    if (floorArchetypeId === 'treasure_gallery') {
        return 'loot_cache';
    }
    if (floorArchetypeId === 'shadow_read' || floorArchetypeId === 'script_room') {
        return 'reveal_unknowns';
    }
    if (budgetForFloor(level, floorTag, floorArchetypeId).gatewayBudget > 0) {
        return 'claim_route';
    }
    return 'find_exit';
};

export const dungeonBossForFloor = (
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['bossId'] => {
    if (floorTag !== 'boss') {
        return null;
    }
    if (floorArchetypeId === 'trap_hall') {
        return 'trap_warden';
    }
    if (floorArchetypeId === 'treasure_gallery') {
        return 'treasure_keeper';
    }
    if (floorArchetypeId === 'spotlight_hunt') {
        return 'spire_observer';
    }
    return 'rush_sentinel';
};

export const exitSpecsForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['exitSpecs'] => {
    const routeType = exitRouteTypeForFloor(level, floorTag, floorArchetypeId);
    const lockKind = primaryExitLockKindForFloor(level, floorArchetypeId);
    const requiredLeverCount = requiredLeverCountForFloor(level, lockKind);
    const effectId: DungeonCardEffectId =
        floorTag === 'boss'
            ? 'exit_boss'
            : routeType === 'greed'
              ? 'exit_greed'
              : routeType === 'mystery'
                ? 'exit_mystery'
                : 'exit_safe';
    const specs: DungeonFloorBlueprint['exitSpecs'] = [
        {
            id: `${level}-exit`,
            routeType,
            effectId,
            lockKind,
            requiredLeverCount,
            labelPrefix: 'Primary'
        }
    ];
    const alternateRouteType: RouteNodeType | null =
        level >= 4 && (floorTag === 'boss' || floorArchetypeId === 'treasure_gallery' || level % 4 === 0)
            ? routeType === 'greed'
                ? 'safe'
                : 'greed'
            : null;
    if (alternateRouteType) {
        specs.push({
            id: `${level}-exit-alt`,
            routeType: alternateRouteType,
            effectId: alternateRouteType === 'greed' ? 'exit_greed' : 'exit_safe',
            lockKind: floorArchetypeId === 'treasure_gallery' ? 'treasure' : level >= 6 ? 'iron' : 'none',
            requiredLeverCount: 0,
            labelPrefix: 'Alternate'
        });
    }
    return specs;
};

export const shouldAddDungeonShopTile = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): boolean => {
    if (!gameMode || gameMode === 'puzzle' || level <= 1 || floorTag === 'boss') {
        return false;
    }
    if (dungeonNodeKind === 'shop') {
        return true;
    }
    if (dungeonNodeKind === 'rest') {
        return false;
    }
    if (floorTag === 'breather' || floorArchetypeId === 'treasure_gallery') {
        return true;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonShop:${rulesVersion}:${runSeed}:${level}`));
    const threshold = floorArchetypeId === 'script_room' || floorArchetypeId === 'spotlight_hunt' ? 0.45 : 0.3;
    return rng() < threshold;
};

export const roomEffectForFloor = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): DungeonCardEffectId | null => {
    if (!gameMode || gameMode === 'puzzle' || level <= 1 || floorTag === 'boss') {
        return null;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonRoom:${rulesVersion}:${runSeed}:${level}`));
    const pickRoomEffect = (options: readonly DungeonCardEffectId[]): DungeonCardEffectId | null =>
        options[pickRngIndex(rng, options.length)] ?? null;
    if (dungeonNodeKind === 'rest') {
        const options: DungeonCardEffectId[] = [
            'room_campfire',
            'room_fountain',
            'room_shrine',
            'room_map',
            'room_scrying_lens',
            'room_armory'
        ];
        return pickRoomEffect(options);
    }
    if (dungeonNodeKind === 'event') {
        const options: DungeonCardEffectId[] = ['room_map', 'room_omen_archive', 'room_scrying_lens', 'room_forge'];
        return pickRoomEffect(options);
    }
    if (dungeonNodeKind === 'treasure') {
        const options: DungeonCardEffectId[] = ['room_key_cache', 'room_locked_cache', 'room_armory', 'room_scrying_lens'];
        return pickRoomEffect(options);
    }
    if (dungeonNodeKind === 'trap') {
        return 'room_trap_workshop';
    }
    const chance = floorTag === 'breather' ? 0.65 : floorArchetypeId === 'script_room' ? 0.45 : 0.28;
    if (rng() >= chance) {
        return null;
    }
    const options: DungeonCardEffectId[] =
        floorArchetypeId === 'script_room'
            ? ['room_map', 'room_omen_archive', 'room_forge', 'room_fountain', 'room_scrying_lens']
            : floorArchetypeId === 'treasure_gallery'
              ? ['room_key_cache', 'room_forge', 'room_armory', 'room_locked_cache', 'room_scrying_lens']
              : floorTag === 'breather'
              ? [
                    'room_campfire',
                    'room_fountain',
                    'room_forge',
                    'room_shrine',
                    'room_map',
                    'room_scrying_lens',
                    'room_armory',
                    'room_key_cache'
                ]
              : floorArchetypeId === 'trap_hall'
                  ? ['room_trap_workshop', 'room_scrying_lens', 'room_armory', 'room_fountain']
                  : floorArchetypeId === 'shadow_read'
                    ? ['room_omen_archive', 'room_map', 'room_scrying_lens', 'room_shrine']
                    : [
                          'room_campfire',
                          'room_fountain',
                          'room_map',
                          'room_forge',
                          'room_shrine',
                          'room_scrying_lens',
                          'room_armory',
                          'room_key_cache'
                      ];
    return pickRoomEffect(options);
};

export const chooseRoomEffectsForFloor = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): DungeonCardEffectId[] => {
    const effectId = roomEffectForFloor(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind);
    return effectId ? [effectId] : [];
};

export const pairCapacityForDungeonEncounter = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    dungeonNodeKind?: DungeonRunNodeKind | null
): number => {
    const encounter = createDungeonEncounterContext(dungeonNodeKind, floorTag, floorArchetypeId);
    return clamp(level + 1 + encounter.pairCountDelta, Math.min(2, NUMBER_SYMBOLS.length), NUMBER_SYMBOLS.length);
};
