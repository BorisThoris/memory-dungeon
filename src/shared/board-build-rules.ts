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
import {
    DECOY_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';
import { dealBoardSuits, getSuitDealProfile } from './tile-suit-rules';
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

    /*
     * A board someone handed us. It used to be augmented on the way through — an exit, a shop, a
     * room, a layout plan, roaming hazards — which meant a caller who asked for exactly these
     * tiles got those tiles plus six systems it never mentioned. With the dungeon layer gone the
     * branch says what it always should have: these are the tiles. `exact` additionally keeps the
     * authored order, so a softlock fixture stays the board it was written as.
     */
    if (options.fixedTiles && options.fixedTiles.length > 0) {
        const exactFixedTiles = options.fixedTilesMode === 'exact';
        const plannedTiles = options.fixedTiles.map((t) => ({ ...t }));
        const tileCount = plannedTiles.length;
        const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
        // Authored boards placed exactly stay exactly as authored; everything else gets its suits.
        const tiles = exactFixedTiles
            ? plannedTiles
            : dealBoardSuits(plannedTiles, columns, runSeed, level, rulesVersion, getSuitDealProfile(floorArchetypeId), options.relicIds ?? []);
        const rows = Math.ceil(tileCount / columns);
        const realPairKeys = new Set(tiles.map((t) => t.pairKey).filter((k) => !isSingletonUtilityPairKey(k)));

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
            dungeonExitTileId: null,
            dungeonExitActivated: false,
            dungeonExitLockKind: 'none',
            dungeonExitRequiredLeverCount: 0,
            dungeonLeverCount: 0,
            dungeonShopTileId: null,
            dungeonShopVisited: false,
            dungeonBossId: null,
            dungeonObjectiveId: 'find_exit',
            enemyHazards: [],
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
    /*
     * The dungeon layer used to sit here, between the route specials and the suit deal: a card
     * recipe, a filler pass, an exit tile, a shop tile, a room tile, a hazard pass and a layout
     * plan that pinned all of them. Every one of those is a *stop* — a tile the player has to
     * resolve before the floor will let them go — and the loop this game is about is a loop of
     * momentum. `docs/REMOVED_DUNGEON_LAYER.md` has what each one did.
     *
     * What is left is the floor as the thesis states it (Part V): a board of pairs, dealt in
     * clumps, and nothing on it that is not a pair. The floor ends when the board is empty, which
     * `isBoardComplete` already said the moment there was no exit tile to activate.
     */
    const layoutTiles = routeTiles;
    const tileCount = layoutTiles.length;
    const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
    /*
     * Suits go on after the layout plan and before anything reads positions: the plan has put the
     * exit, branches, hazards and rewards where it wants them and those stay pinned; the plain
     * pairs are dealt in clumps around them so the floor opens as a map rather than a field.
     */
    const tiles = dealBoardSuits(layoutTiles, columns, runSeed, level, rulesVersion, getSuitDealProfile(floorArchetypeId), options.relicIds ?? []);
    const rows = Math.ceil(tileCount / columns);
    const cursedPairKey =
        featuredObjectiveId === 'cursed_last' || featuredObjectiveId === null
            ? pickCursedPairKey(tiles, runSeed, rulesVersion, level)
            : null;
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
        dungeonExitTileId: null,
        dungeonExitActivated: false,
        dungeonExitLockKind: 'none',
        dungeonExitRequiredLeverCount: 0,
        dungeonLeverCount: 0,
        dungeonShopTileId: null,
        dungeonShopVisited: false,
        dungeonBossId: null,
        dungeonObjectiveId: 'find_exit',
        enemyHazards: [],
        enemyHazardTurn: 0
    });
    const traitBoard: BoardState = {
        ...baseBoard,
        tiles: assignTileTraitsToGeneratedBoard(
            baseBoard.tiles,
            runSeed,
            rulesVersion,
            level,
            routeWorldProfile?.intensity,
            options.relicIds ?? [],
            options.startingLoadoutId ?? null,
            baseBoard.columns
        )
    };
    if (!mutators.includes('shifting_spotlight')) {
        return { ...traitBoard, wardPairKey: null, bountyPairKey: null };
    }
    const { wardPairKey, bountyPairKey } = pickShiftingSpotlightKeys(
        traitBoard,
        runSeed,
        rulesVersion,
        level,
        'init'
    );
    return { ...traitBoard, wardPairKey, bountyPairKey };
};
