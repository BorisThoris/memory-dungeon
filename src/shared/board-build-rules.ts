import {
    GAME_RULES_VERSION,
    type BoardState,
    type DungeonRunNodeKind,
    type FeaturedObjectiveId,
    type FloorArchetypeId,
    type FloorTag,
    type GameMode,
    type MutatorId,
    type RelicId,
    type RouteCardPlan,
    type RouteWorldProfile,
    type StartingLoadoutId,
    type Tile
} from './contracts';
import { getChapterActBiomeForCycleFloor } from './floor-mutator-schedule';
import { assignRouteWorldSpecials, deriveRouteWorldProfile } from './route-world';
import { NUMBER_SYMBOLS } from './tile-symbol-catalog';
import {
    assignFindableKindsToTiles,
    createTiles,
    pickCursedPairKey
} from './board-tile-generation-rules';
import { assignTileTraitsToGeneratedBoard } from './tile-trait-rules';
import { createDungeonEncounterContext } from './dungeon-encounter-context-rules';
import { createDungeonFloorBlueprint } from './dungeon-floor-blueprint-rules';
import {
    addDungeonExitTile,
    addDungeonRoomTile,
    addDungeonShopTile,
    assignDungeonCardsToTiles,
    assignDungeonFillerCardsToTiles
} from './dungeon-tile-augmentation-rules';
import {
    applyDungeonLayoutPlan,
    assignHazardTilesToGeneratedBoard
} from './dungeon-board-generation-rules';
import { createEnemyHazardsForBoard } from './dungeon-enemy-hazard-rules';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';
import { pickShiftingSpotlightKeys } from './shifting-spotlight-rules';
import { repairDungeonExitSoftlocks } from './board-inspection';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export interface BuildBoardOptions {
    runSeed?: number;
    runRulesVersion?: number;
    activeMutators?: MutatorId[];
    /** Puzzle mode: skip RNG; copy these tiles as-is. */
    fixedTiles?: Tile[] | null;
    /** `enhance` preserves legacy dungeon additions; `exact` copies fixed tiles without encounter layers. */
    fixedTilesMode?: 'enhance' | 'exact';
    /** H4: include one wild tile that pairs with any real symbol. */
    includeWildTile?: boolean;
    floorTag?: FloorTag;
    floorArchetypeId?: FloorArchetypeId | null;
    featuredObjectiveId?: FeaturedObjectiveId | null;
    cycleFloor?: number | null;
    routeCardPlan?: RouteCardPlan | null;
    routeWorldProfile?: RouteWorldProfile | null;
    dungeonNodeKind?: DungeonRunNodeKind | null;
    gameMode?: GameMode;
    suppressFindables?: boolean;
    relicIds?: readonly RelicId[];
    startingLoadoutId?: StartingLoadoutId | null;
}

export const buildBoard = (level: number, options: BuildBoardOptions = {}): BoardState => {
    const runSeed = options.runSeed ?? 0;
    const rulesVersion = options.runRulesVersion ?? GAME_RULES_VERSION;
    const mutators = options.activeMutators ?? [];
    const encounter = createDungeonEncounterContext(
        options.dungeonNodeKind,
        options.floorTag ?? 'normal',
        options.floorArchetypeId ?? null
    );
    const floorArchetypeId = encounter.floorArchetypeId;
    const featuredObjectiveId = options.featuredObjectiveId ?? null;
    const cycleFloor = options.cycleFloor ?? null;
    const actBiome = cycleFloor != null ? getChapterActBiomeForCycleFloor(cycleFloor) : null;
    const floorTag = encounter.floorTag;
    const dungeonBlueprint = options.gameMode
        ? createDungeonFloorBlueprint({
              runSeed,
              rulesVersion,
              level,
              floorTag,
              floorArchetypeId,
              gameMode: options.gameMode,
              dungeonNodeKind: encounter.nodeKind
          })
        : null;

    if (options.fixedTiles && options.fixedTiles.length > 0) {
        const exactFixedTiles = options.fixedTilesMode === 'exact';
        const exitTiles = options.gameMode && !exactFixedTiles
            ? addDungeonExitTile(
                  options.fixedTiles.map((t) => ({ ...t })),
                  dungeonBlueprint!
              ).tiles
            : options.fixedTiles.map((t) => ({ ...t }));
        const shopAdded = dungeonBlueprint && !exactFixedTiles
            ? addDungeonShopTile(exitTiles, dungeonBlueprint)
            : { tiles: exitTiles, shopTileId: null };
        const roomAdded = dungeonBlueprint && !exactFixedTiles
            ? addDungeonRoomTile(shopAdded.tiles, dungeonBlueprint)
            : { tiles: shopAdded.tiles, roomTileId: null };
        const tiles = exactFixedTiles
            ? roomAdded.tiles
            : applyDungeonLayoutPlan(
                  roomAdded.tiles,
                  runSeed,
                  rulesVersion,
                  level,
                  floorTag,
                  floorArchetypeId,
                  options.gameMode,
                  encounter.nodeKind
              );
        const tileCount = tiles.length;
        const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
        const rows = Math.ceil(tileCount / columns);
        const realPairKeys = new Set(tiles.map((t) => t.pairKey).filter((k) => !isSingletonUtilityPairKey(k)));
        const exit = tiles.find((t) => t.pairKey === EXIT_PAIR_KEY);
        const enemyHazards = exactFixedTiles
            ? []
            : createEnemyHazardsForBoard({
                  tiles,
                  runSeed,
                  rulesVersion,
                  level,
                  floorTag,
                  floorArchetypeId,
                  nodeKind: encounter.nodeKind,
                  bossId: dungeonBlueprint?.bossId ?? null,
                  gameMode: options.gameMode
              });

        return repairDungeonExitSoftlocks({
            level,
            pairCount: realPairKeys.size,
            columns,
            rows,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorTag,
            cursedPairKey: null,
            wardPairKey: null,
            bountyPairKey: null,
            floorArchetypeId,
            featuredObjectiveId,
            cycleFloor,
            actTitle: actBiome?.actTitle ?? null,
            actFloorNumber: actBiome?.actFloorNumber ?? null,
            actFloorCount: actBiome?.actFloorCount ?? null,
            biomeTitle: actBiome?.biomeTitle ?? null,
            biomeTone: actBiome?.biomeTone ?? null,
            routeWorldProfile: options.routeWorldProfile ?? null,
            selectedGatewayRouteType: null,
            dungeonKeysHeld: 0,
            dungeonExitTileId: exit?.id ?? null,
            dungeonExitActivated: false,
            dungeonExitLockKind: exit?.dungeonExitLockKind ?? 'none',
            dungeonExitRequiredLeverCount: exit?.dungeonExitRequiredLeverCount ?? 0,
            dungeonLeverCount: 0,
            dungeonShopTileId: shopAdded.shopTileId,
            dungeonShopVisited: false,
            dungeonBossId: exactFixedTiles ? null : dungeonBlueprint?.bossId ?? null,
            dungeonObjectiveId: exactFixedTiles ? 'find_exit' : dungeonBlueprint?.objectiveId ?? 'find_exit',
            enemyHazards,
            enemyHazardTurn: 0
        });
    }

    const pairCount = clamp(level + 1 + encounter.pairCountDelta, Math.min(2, NUMBER_SYMBOLS.length), NUMBER_SYMBOLS.length);
    const routeWorldProfile =
        options.routeWorldProfile ??
        deriveRouteWorldProfile({
            plan: options.routeCardPlan,
            level,
            floorTag,
            floorArchetypeId,
            mutators
        });
    const routeTiles = assignRouteWorldSpecials({
        tiles: options.suppressFindables
            ? createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile)
            : assignFindableKindsToTiles(
                  createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile),
                  mutators,
                  runSeed,
                  rulesVersion,
                  level
              ),
        profile: routeWorldProfile,
        runSeed,
        rulesVersion,
        level,
        forbiddenPairKeys: [DECOY_PAIR_KEY, WILD_PAIR_KEY]
    });
    const dungeonPairTiles = assignDungeonCardsToTiles(
        routeTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode,
        dungeonBlueprint ?? undefined
    );
    const dungeonFillerTiles = assignDungeonFillerCardsToTiles(
        dungeonPairTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode,
        encounter.nodeKind
    );
    const exitAdded = options.gameMode
        ? addDungeonExitTile(dungeonFillerTiles, dungeonBlueprint!)
        : null;
    const shopAdded = dungeonBlueprint
        ? addDungeonShopTile(exitAdded?.tiles ?? dungeonFillerTiles, dungeonBlueprint)
        : { tiles: exitAdded?.tiles ?? dungeonFillerTiles, shopTileId: null };
    const roomAdded = dungeonBlueprint
        ? addDungeonRoomTile(shopAdded.tiles, dungeonBlueprint)
        : { tiles: shopAdded.tiles, roomTileId: null };
    const hazardTiles = assignHazardTilesToGeneratedBoard(
        roomAdded.tiles,
        runSeed,
        rulesVersion,
        level,
        options.gameMode
    );
    const traitTiles = assignTileTraitsToGeneratedBoard(
        hazardTiles,
        runSeed,
        rulesVersion,
        level,
        routeWorldProfile?.intensity,
        options.relicIds ?? [],
        options.startingLoadoutId ?? null
    );
    const tiles = applyDungeonLayoutPlan(
        traitTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode
    );
    const tileCount = tiles.length;
    const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
    const rows = Math.ceil(tileCount / columns);
    const cursedPairKey =
        featuredObjectiveId === 'cursed_last' || featuredObjectiveId === null
            ? pickCursedPairKey(tiles, runSeed, rulesVersion, level)
            : null;
    const enemyHazards = createEnemyHazardsForBoard({
        tiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        nodeKind: encounter.nodeKind,
        bossId: dungeonBlueprint?.bossId ?? null,
        gameMode: options.gameMode
    });
    const baseBoard: BoardState = repairDungeonExitSoftlocks({
        level,
        pairCount,
        columns,
        rows,
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        floorTag,
        cursedPairKey,
        floorArchetypeId,
        featuredObjectiveId,
        cycleFloor,
        actTitle: actBiome?.actTitle ?? null,
        actFloorNumber: actBiome?.actFloorNumber ?? null,
        actFloorCount: actBiome?.actFloorCount ?? null,
        biomeTitle: actBiome?.biomeTitle ?? null,
        biomeTone: actBiome?.biomeTone ?? null,
        routeWorldProfile,
        selectedGatewayRouteType: null,
        dungeonKeysHeld: 0,
        dungeonExitTileId: exitAdded?.exitTileId ?? null,
        dungeonExitActivated: false,
        dungeonExitLockKind: exitAdded?.lockKind ?? 'none',
        dungeonExitRequiredLeverCount: exitAdded?.requiredLevers ?? 0,
        dungeonLeverCount: 0,
        dungeonShopTileId: shopAdded.shopTileId,
        dungeonShopVisited: false,
        dungeonBossId: dungeonBlueprint?.bossId ?? null,
        dungeonObjectiveId: dungeonBlueprint?.objectiveId ?? 'find_exit',
        enemyHazards,
        enemyHazardTurn: 0
    });
    if (!mutators.includes('shifting_spotlight')) {
        return { ...baseBoard, wardPairKey: null, bountyPairKey: null };
    }
    const { wardPairKey, bountyPairKey } = pickShiftingSpotlightKeys(
        baseBoard,
        runSeed,
        rulesVersion,
        level,
        'init'
    );
    return { ...baseBoard, wardPairKey, bountyPairKey };
};
