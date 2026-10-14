import {
    GAME_RULES_VERSION,
    type BoardState,
    type FeaturedObjectiveId,
    type FloorArchetypeId,
    type FloorTag,
    type GameMode,
    type MutatorId,
    type Tile
} from './contracts';
import { getChapterActBiomeForCycleFloor } from './floor-mutator-schedule';
import {
    assignFindableKindsToTiles,
    createTiles,
    pickCursedPairKey
} from './board-tile-generation-rules';
import { assignTileTraitsToGeneratedBoard } from './tile-trait-rules';
import { authoredFloorLayout, isAuthoredFloor, layAuthoredFloorTiles } from './authored-floors';
import { pairsForFloor } from './pair-curve';
import { isSingletonUtilityPairKey } from './tile-identity';
import { dealBoardSuits, getSuitDealProfile } from './tile-suit-rules';
import { pickShiftingSpotlightKeys } from './shifting-spotlight-rules';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';

/** Two seeded encounter deals. Pair halves retain their identity and are separated across
 * the two halves of the deck. The first circuit supplies two primers and a catalyst;
 * the ribbon interleaves Water and Ice so Freeze-over is a deliberate ordering decision.
 * No card is removed or made unturnable by either layout. */
export const dealElementalEncounter = (tiles: Tile[], seed: number, level: number, goal: FeaturedObjectiveId | null): Tile[] => {
    if (goal !== 'amplified_reaction' && goal !== 'calm_reaction') return tiles;
    const rng = createMulberry32(hashStringToSeed(`elemental-encounter:${seed}:${level}:${goal}`));
    const groups = new Map<string, Tile[]>();
    for (const tile of tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        groups.set(tile.pairKey, [...(groups.get(tile.pairKey) ?? []), tile]);
    }
    const pairs = shuffleWithRng(rng, [...groups.values()].filter(pair => pair.length === 2));
    if (pairs.length < 3) return tiles;
    const suits = goal === 'calm_reaction' ? ['tide', 'tide', 'bone', 'ember', 'moss'] as const : ['ember', 'ember', 'tide', 'moss', 'bone'] as const;
    const dealt = pairs.map((pair, index) => pair.map(tile => ({ ...tile,
        suit: suits[index % suits.length] })));
    const ordered = goal === 'calm_reaction'
        ? [...dealt.filter((_, i) => i % 3 !== 1), ...dealt.filter((_, i) => i % 3 === 1)] : dealt;
    // Shuffle the return half independently: the recipe must never reveal twins by position.
    const columns = Math.ceil(Math.sqrt(tiles.length));
    const firstCells = new Map(ordered.map((pair, index) => [pair[0]!.pairKey, index]));
    const separationCost = (candidate: typeof ordered) => candidate.reduce((sum, pair, index) => {
        const a = firstCells.get(pair[0]!.pairKey)!;
        const b = ordered.length + index;
        const distance = Math.abs(a % columns - b % columns) + Math.abs(Math.floor(a / columns) - Math.floor(b / columns));
        return sum + Math.max(0, 3 - distance);
    }, 0);
    let returnHalf = shuffleWithRng(rng, ordered);
    let cost = separationCost(returnHalf);
    for (let attempt = 0; attempt < 32 && cost > 0; attempt++) {
        const candidate = shuffleWithRng(rng, ordered);
        const nextCost = separationCost(candidate);
        if (nextCost < cost) { returnHalf = candidate; cost = nextCost; }
    }
    return [...ordered.map(pair => pair[0]!), ...returnHalf.map(pair => pair[1]!),
        ...tiles.filter(tile => isSingletonUtilityPairKey(tile.pairKey))];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export interface BuildBoardOptions {
    runSeed?: number;
    runRulesVersion?: number;
    activeMutators?: MutatorId[];
    /** Puzzle mode: skip RNG; copy these tiles as-is. */
    fixedTiles?: Tile[] | null;
    /** `exact` keeps the authored tile order and suits; `enhance` deals suits over the given tiles. */
    fixedTilesMode?: 'enhance' | 'exact';
    /** H4: include one wild tile that pairs with any real symbol. */
    includeWildTile?: boolean;
    floorTag?: FloorTag;
    floorArchetypeId?: FloorArchetypeId | null;
    featuredObjectiveId?: FeaturedObjectiveId | null;
    cycleFloor?: number | null;
    gameMode?: GameMode;
    suppressFindables?: boolean;
}

export const buildBoard = (level: number, options: BuildBoardOptions = {}): BoardState => {
    const runSeed = options.runSeed ?? 0;
    const rulesVersion = options.runRulesVersion ?? GAME_RULES_VERSION;
    const mutators = options.activeMutators ?? [];
    const floorArchetypeId = options.floorArchetypeId ?? null;
    const featuredObjectiveId = options.featuredObjectiveId ?? null;
    const cycleFloor = options.cycleFloor ?? null;
    const actBiome = cycleFloor != null ? getChapterActBiomeForCycleFloor(cycleFloor) : null;
    const floorTag = options.floorTag ?? 'normal';

    // A board someone handed us: these are the tiles. `exact` additionally keeps the authored
    // order, so a softlock fixture stays the board it was written as.
    if (options.fixedTiles && options.fixedTiles.length > 0) {
        const exactFixedTiles = options.fixedTilesMode === 'exact';
        const plannedTiles = options.fixedTiles.map((t) => ({ ...t }));
        const tileCount = plannedTiles.length;
        const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, rulesVersion >= 60 ? 128 : 8);
        // Authored boards placed exactly stay exactly as authored; everything else gets its suits.
        const tiles = exactFixedTiles
            ? plannedTiles
            : dealBoardSuits(plannedTiles, columns, runSeed, level, rulesVersion, getSuitDealProfile(floorArchetypeId));
        const rows = Math.ceil(tileCount / columns);
        const realPairKeys = new Set(tiles.map((t) => t.pairKey).filter((k) => !isSingletonUtilityPairKey(k)));

        return {
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
            biomeTone: actBiome?.biomeTone ?? null
        };
    }

    // Preserve the established early curve; later decks reuse the art with numbered pair badges.
    const pairCount = pairsForFloor(level, rulesVersion);
    /*
     * The dungeon layer used to sit here: a card recipe, a filler pass, an exit tile, a shop tile,
     * a room tile, a hazard pass and a layout plan that pinned all of them (Gen 172). The six route
     * specials sat just before it — a secret door, a guard cache, a fragile cache, a lantern ward,
     * an omen seal, a mimic cache — dealt according to whichever of Safe, Greed or Mystery the
     * player picked on the way in, and they go now with the route offer itself (Gen 173).
     *
     * Every one of them is a *stop*: a tile the player has to resolve before the floor will let
     * them go, in a loop that is about momentum. `docs/REMOVED_DUNGEON_LAYER.md` has what each did.
     *
     * What is left is the floor as the thesis states it (Part V): a board of pairs, shuffled, and
     * nothing on it that is not a pair. The floor ends when the board is empty, which
     * `isBoardComplete` already said the moment there was no exit tile to activate.
     */
    const layoutTiles = options.suppressFindables
        ? createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile)
        : assignFindableKindsToTiles(
              createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile),
              mutators,
              runSeed,
              rulesVersion,
              level
          );
    /*
     * The cursed pair is picked before the tiles are placed: an authored floor keeps it out of
     * the split slot, because a break never takes the cursed pair and the split pair is there to
     * be taken.
     *
     * An authored floor takes no *incidental* cursed pair at all (Gen 193). Those three boards
     * exist to guarantee the pop, the boundary and the reach where a new player meets them, and a
     * pair a break can never take cancels the guarantee silently: a suit of two pairs whose other
     * pair is cursed pops nothing, whatever the layout promised. A cursed pair the floor's own
     * objective asks for is still honoured - it is content the player was told about.
     */
    const cursedPairKey =
        featuredObjectiveId === 'cursed_last' || (featuredObjectiveId === null && !isAuthoredFloor(level))
            ? pickCursedPairKey(layoutTiles, runSeed, rulesVersion, level)
            : null;
    const tileCount = layoutTiles.length;
    /*
     * The first three floors preserve authored lessons (`authored-floors.ts`): from rules 50 their
     * suit geometry and separated pairs are seeded too, so the pop, boundary and isolated pair
     * remain readable without repeating a fixed opening. Historical rules retain their shapes. A board the
     * layout cannot hold - it never happens on the curve, but the fallback is the honest deal,
     * not a wrong shape - is dealt the way every later floor is.
     */
    const authored = authoredFloorLayout(level, runSeed, rulesVersion);
    const authoredTiles = authored
        ? layAuthoredFloorTiles(layoutTiles, authored, {
              runSeed,
              rulesVersion,
              reservedPairKeys: [
                  ...(cursedPairKey ? [cursedPairKey] : []),
                  ...layoutTiles.filter((tile) => tile.findableKind != null).map((tile) => tile.pairKey)
              ]
          })
        : null;
    const columns = authoredTiles && authored ? authored.columns : clamp(Math.ceil(Math.sqrt(tileCount)), 2, rulesVersion >= 60 ? 128 : 8);
    // Suits go on before anything reads positions. Gen 204: shuffled, then repaired so no run of
    // one suit is long enough to read as a painted zone (`tile-suit-rules.ts`).
    const ordinaryTiles =
        authoredTiles ?? dealBoardSuits(layoutTiles, columns, runSeed, level, rulesVersion, getSuitDealProfile(floorArchetypeId));
    const tiles = rulesVersion >= 64 ? dealElementalEncounter(ordinaryTiles, runSeed, level, featuredObjectiveId) : ordinaryTiles;
    const rows = Math.ceil(tileCount / columns);
    const baseBoard: BoardState = {
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
        biomeTone: actBiome?.biomeTone ?? null
    };
    const traitBoard: BoardState = {
        ...baseBoard,
        tiles: assignTileTraitsToGeneratedBoard(baseBoard.tiles, runSeed, rulesVersion, level, baseBoard.columns)
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
