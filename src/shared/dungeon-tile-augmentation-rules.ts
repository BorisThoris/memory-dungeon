import type {
    DungeonCardEffectId,
    DungeonExitLockKind,
    DungeonFloorBlueprint,
    DungeonKeyKind,
    DungeonRunNodeKind,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    RouteNodeType,
    Tile
} from './contracts';
import {
    createMulberry32,
    hashStringToSeed,
    pickRngIndex,
    shuffleWithRng
} from './rng';
import {
    dungeonCardRecipeForFloor,
    minorSupplyCard,
    type DungeonCardAssignment
} from './dungeon-card-recipe-rules';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

const isDungeonKeyKind = (lockKind: DungeonExitLockKind): lockKind is DungeonKeyKind =>
    lockKind !== 'none' && lockKind !== 'lever';

type DungeonExitSpec = DungeonFloorBlueprint['exitSpecs'][number];

const fallbackExitSpecForBlueprint = (blueprint: DungeonFloorBlueprint): DungeonExitSpec => ({
    id: `${blueprint.level}-exit`,
    routeType: 'safe',
    effectId: 'exit_safe',
    lockKind: 'none',
    requiredLeverCount: 0,
    labelPrefix: 'Primary'
});

export const addDungeonExitTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; exitTileId: string; routeType: RouteNodeType; lockKind: DungeonExitLockKind; requiredLevers: number } => {
    const exitSpecs = blueprint.exitSpecs.length > 0 ? blueprint.exitSpecs : [fallbackExitSpecForBlueprint(blueprint)];
    const makeExitTile = (
        id: string,
        exitRouteType: RouteNodeType,
        exitEffectId: DungeonCardEffectId,
        exitLockKind: DungeonExitLockKind,
        exitRequiredLevers: number,
        labelPrefix: string
    ): Tile => ({
        id,
        pairKey: EXIT_PAIR_KEY,
        state: 'hidden',
        symbol: exitRouteType === 'greed' ? '>' : exitRouteType === 'mystery' ? '?' : '^',
        label:
            blueprint.floorTag === 'boss'
                ? `${labelPrefix} Boss Exit`
                : exitRouteType === 'greed'
                  ? `${labelPrefix} Greed Exit`
                  : exitRouteType === 'mystery'
                    ? `${labelPrefix} Mystery Exit`
                    : `${labelPrefix} Safe Exit`,
        atomicVariant: 0,
        dungeonCardKind: 'exit',
        dungeonCardState: 'hidden',
        dungeonCardEffectId: exitEffectId,
        dungeonRouteType: exitRouteType,
        dungeonExitLockKind: exitLockKind,
        dungeonExitRequiredLeverCount: exitRequiredLevers,
        dungeonExitActivated: false
    });
    const exitTiles = exitSpecs.map((spec) =>
        makeExitTile(spec.id, spec.routeType, spec.effectId, spec.lockKind, spec.requiredLeverCount, spec.labelPrefix)
    );
    const primary = exitSpecs[0] ?? fallbackExitSpecForBlueprint(blueprint);
    return {
        tiles: [...tiles, ...exitTiles],
        exitTileId: primary.id,
        routeType: primary.routeType,
        lockKind: primary.lockKind,
        requiredLevers: primary.requiredLeverCount
    };
};

export const addDungeonShopTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; shopTileId: string | null } => {
    if (!blueprint.shopTileId) {
        return { tiles, shopTileId: null };
    }
    const shopTileId = blueprint.shopTileId;
    return {
        tiles: [
            ...tiles,
            {
                id: shopTileId,
                pairKey: SHOP_PAIR_KEY,
                state: 'hidden',
                symbol: 'S',
                label: 'Vendor Alcove',
                atomicVariant: 0,
                dungeonCardKind: 'shop',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'shop_vendor'
            }
        ],
        shopTileId
    };
};

export const addDungeonRoomTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; roomTileId: string | null } => {
    const effectId = blueprint.roomEffectIds[0] ?? null;
    if (!effectId) {
        return { tiles, roomTileId: null };
    }
    const roomTileId = `${blueprint.level}-room`;
    const label =
        effectId === 'room_campfire'
            ? 'Campfire'
            : effectId === 'room_fountain'
              ? 'Fountain'
              : effectId === 'room_map'
                ? 'Map Room'
                : effectId === 'room_shrine'
                  ? 'Shrine'
                  : effectId === 'room_scrying_lens'
                    ? 'Scrying Lens'
                    : effectId === 'room_armory'
                      ? 'Armory'
                      : effectId === 'room_locked_cache'
                        ? 'Locked Cache'
                        : effectId === 'room_key_cache'
                          ? 'Key Cache'
                          : effectId === 'room_trap_workshop'
                            ? 'Trap Workshop'
                            : effectId === 'room_omen_archive'
                              ? 'Omen Archive'
                              : 'Forge';
    const symbol =
        effectId === 'room_campfire'
            ? 'C'
            : effectId === 'room_fountain'
              ? 'F'
              : effectId === 'room_map'
                ? 'M'
                : effectId === 'room_shrine'
                  ? '+'
                  : effectId === 'room_scrying_lens'
                    ? '?'
                    : effectId === 'room_armory'
                      ? 'A'
                      : effectId === 'room_locked_cache'
                        ? 'L'
                        : effectId === 'room_key_cache'
                          ? 'K'
                          : effectId === 'room_trap_workshop'
                            ? 'T'
                            : effectId === 'room_omen_archive'
                              ? 'O'
                              : 'G';
    const dungeonKeyKind =
        effectId === 'room_locked_cache'
            ? blueprint.exitSpecs.map((spec) => spec.lockKind).find(isDungeonKeyKind) ?? 'iron'
            : undefined;
    return {
        tiles: [
            ...tiles,
            {
                id: roomTileId,
                pairKey: ROOM_PAIR_KEY,
                state: 'hidden',
                symbol,
                label,
                atomicVariant: 0,
                dungeonCardKind: 'room',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: effectId,
                dungeonKeyKind,
                dungeonRoomUsed: false
            }
        ],
        roomTileId
    };
};

export const assignDungeonCardsToTiles = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    blueprint?: DungeonFloorBlueprint
): Tile[] => {
    if (!gameMode) {
        return tiles;
    }
    const assignments = blueprint?.pairedCardSpecs ?? dungeonCardRecipeForFloor(level, floorTag, floorArchetypeId, gameMode);
    if (assignments.length === 0) {
        return tiles;
    }
    const eligibleKeys = [
        ...new Set(
            tiles
                .filter(
                    (tile) =>
                        tile.pairKey !== DECOY_PAIR_KEY &&
                        tile.pairKey !== WILD_PAIR_KEY &&
                        tile.routeSpecialKind == null &&
                        tile.routeCardKind == null
                )
                .map((tile) => tile.pairKey)
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonCards:${rulesVersion}:${runSeed}:${level}`));
    const keys = [...eligibleKeys];
    for (let i = keys.length - 1; i > 0; i--) {
        const j = pickRngIndex(rng, i + 1);
        const keyAtI = keys[i];
        const keyAtJ = keys[j];
        if (keyAtI !== undefined && keyAtJ !== undefined) {
            keys[i] = keyAtJ;
            keys[j] = keyAtI;
        }
    }
    const assignmentByPairKey = new Map<string, DungeonCardAssignment>();
    const count = Math.min(assignments.length, keys.length);
    for (let i = 0; i < count; i++) {
        const key = keys[i];
        const assignment = assignments[i];
        if (key !== undefined && assignment !== undefined) {
            assignmentByPairKey.set(key, assignment);
        }
    }
    return tiles.map((tile) => {
        const assignment = assignmentByPairKey.get(tile.pairKey);
        if (!assignment) {
            return tile;
        }
        return {
            ...tile,
            symbol: assignment.symbol,
            label: assignment.label,
            dungeonCardKind: assignment.kind,
            dungeonCardState: 'hidden',
            dungeonCardEffectId: assignment.effectId,
            dungeonCardHp: assignment.hp,
            dungeonCardMaxHp: assignment.hp,
            dungeonRouteType: assignment.routeType,
            dungeonBossId: assignment.bossId ?? undefined,
            dungeonKeyKind:
                assignment.kind === 'key' || assignment.kind === 'lock'
                    ? (assignment.keyKind ?? 'iron')
                    : undefined
        };
    });
};

export const assignDungeonFillerCardsToTiles = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): Tile[] => {
    if (!gameMode || gameMode === 'puzzle' || gameMode === 'meditation' || level <= 1) {
        return tiles;
    }
    const eligibleKeys = [
        ...new Set(
            tiles
                .filter(
                    (tile) =>
                        !isSingletonUtilityPairKey(tile.pairKey) &&
                        tile.pairKey !== DECOY_PAIR_KEY &&
                        tile.pairKey !== WILD_PAIR_KEY &&
                        tile.dungeonCardKind == null &&
                        tile.routeSpecialKind == null &&
                        tile.routeCardKind == null &&
                        tile.findableKind == null
                )
                .map((tile) => tile.pairKey)
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const target =
        dungeonNodeKind === 'treasure'
            ? 3
            : dungeonNodeKind === 'rest' || dungeonNodeKind === 'shop'
              ? 2
              : floorArchetypeId === 'treasure_gallery' || floorTag === 'breather'
                ? 2
                : floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read'
                  ? 1
                  : level >= 5
                    ? 1
                    : 0;
    if (target <= 0) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonFillers:${rulesVersion}:${runSeed}:${level}`));
    const picked = shuffleWithRng(() => rng(), eligibleKeys).slice(0, Math.min(target, eligibleKeys.length));
    const pickedSet = new Set(picked);
    const assignment = minorSupplyCard();
    return tiles.map((tile) =>
        pickedSet.has(tile.pairKey)
            ? {
                  ...tile,
                  symbol: assignment.symbol,
                  label: assignment.label,
                  dungeonCardKind: assignment.kind,
                  dungeonCardState: 'hidden',
                  dungeonCardEffectId: assignment.effectId
              }
            : tile
    );
};
