import type {
    DungeonRunNodeKind,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    HazardTileKind,
    Tile
} from './contracts';
import {
    createMulberry32,
    hashStringToSeed,
    shuffleWithRng
} from './rng';
import { getHazardTileDefinition } from './hazard-tiles';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

const HAZARD_TILE_BASELINE_RULES_VERSION = 20;
const FRAGILE_CACHE_BASELINE_LEVEL = 3;
const TOLL_CACHE_BASELINE_LEVEL = 5;
const FUSE_CACHE_BASELINE_LEVEL = 7;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const tileCanCarryHazard = (tile: Tile): boolean =>
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.findableKind == null &&
    tile.tileHazardKind == null;

export const assignHazardTilesToGeneratedBoard = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    gameMode?: GameMode
): Tile[] => {
    if (!gameMode || rulesVersion < HAZARD_TILE_BASELINE_RULES_VERSION || level <= 1) {
        return tiles;
    }

    const eligibleKeys = [
        ...new Set(tiles.filter(tileCanCarryHazard).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanCarryHazard(tile)).length === 2);
    const rng = createMulberry32(hashStringToSeed(`hazardTiles:${rulesVersion}:${runSeed}:${level}:${gameMode}`));
    const shuffledKeys = shuffleWithRng(() => rng(), eligibleKeys);
    const candidateHazardKinds: HazardTileKind[] = ['shuffle_snare', 'cascade_cache'];
    if (level >= FRAGILE_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('fragile_cache');
    }
    if (level >= TOLL_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('toll_cache');
    }
    if (level >= FUSE_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('fuse_cache');
    }
    const hazardKinds: HazardTileKind[] =
        candidateHazardKinds.length > 2
            ? shuffleWithRng(() => rng(), candidateHazardKinds).slice(0, 2)
            : candidateHazardKinds;
    const hazardByPairKey = new Map<string, HazardTileKind>();
    for (let i = 0; i < Math.min(hazardKinds.length, shuffledKeys.length); i += 1) {
        hazardByPairKey.set(shuffledKeys[i]!, hazardKinds[i]!);
    }

    const assignedTiles = tiles.map((tile) => {
        const kind = hazardByPairKey.get(tile.pairKey);
        return kind ? { ...tile, tileHazardKind: kind } : tile;
    });

    const mirrorSourceKey = shuffledKeys.find((key) => !hazardByPairKey.has(key));
    const mirrorSource =
        (mirrorSourceKey ? assignedTiles.find((tile) => tile.pairKey === mirrorSourceKey) : null) ??
        assignedTiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey));
    if (!mirrorSource || assignedTiles.some((tile) => tile.tileHazardKind === 'mirror_decoy')) {
        return assignedTiles;
    }

    const mirrorDefinition = getHazardTileDefinition('mirror_decoy');
    return [
        ...assignedTiles,
        {
            id: `hazard-mirror-${rulesVersion}-${runSeed}-${level}`,
            pairKey: DECOY_PAIR_KEY,
            symbol: mirrorSource.symbol,
            label: mirrorDefinition.label,
            state: 'hidden',
            tileHazardKind: 'mirror_decoy'
        }
    ];
};

interface DungeonGraphSlots {
    mainPath: number[];
    branches: number[];
    hazards: number[];
    rewards: number[];
}

const uniqueSlotOrder = (slots: number[], total: number): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const slot of slots) {
        if (slot < 0 || slot >= total || seen.has(slot)) {
            continue;
        }
        seen.add(slot);
        out.push(slot);
    }
    return out;
};

const makeDungeonGraphSlots = (total: number, columns: number, rng: () => number): DungeonGraphSlots => {
    const rows = Math.max(1, Math.ceil(total / columns));
    const path: number[] = [];
    let col = Math.min(columns - 1, Math.max(0, Math.floor(rng() * columns)));
    for (let row = 0; row < rows; row += 1) {
        const step = Math.floor(rng() * 3) - 1;
        col = Math.min(columns - 1, Math.max(0, col + step));
        const slot = row * columns + col;
        if (slot < total) {
            path.push(slot);
        }
    }
    const pathSet = new Set(path);
    const branches: number[] = [];
    for (const slot of path) {
        const row = Math.floor(slot / columns);
        const slotCol = slot % columns;
        for (const delta of [-1, 1]) {
            const nextCol = slotCol + delta;
            const next = row * columns + nextCol;
            if (nextCol >= 0 && nextCol < columns && next < total && !pathSet.has(next)) {
                branches.push(next);
            }
        }
    }
    const all = Array.from({ length: total }, (_, index) => index);
    const offPath = all.filter((slot) => !pathSet.has(slot));
    return {
        mainPath: uniqueSlotOrder(path, total),
        branches: uniqueSlotOrder(branches, total),
        hazards: uniqueSlotOrder([...path.slice(1), ...branches, ...offPath], total),
        rewards: uniqueSlotOrder([...branches, ...offPath, ...path], total)
    };
};

const nearestAvailableSlot = (
    preferred: number,
    available: Set<number>,
    total: number,
    allowed: (slot: number) => boolean
): number | null => {
    const ordered = [...available].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
    return ordered.find((slot) => slot >= 0 && slot < total && allowed(slot)) ?? null;
};

const dungeonLayoutPriority = (tile: Tile): number => {
    if (tile.pairKey === EXIT_PAIR_KEY) return 0;
    if (tile.pairKey === SHOP_PAIR_KEY || tile.pairKey === ROOM_PAIR_KEY) return 1;
    if (tile.dungeonBossId) return 2;
    if (tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap') return 3;
    if (tile.dungeonCardKind === 'lever' || tile.dungeonCardKind === 'gateway') return 4;
    if (tile.dungeonCardKind === 'treasure' || tile.dungeonCardKind === 'shrine' || tile.dungeonCardKind === 'key' || tile.dungeonCardKind === 'lock') return 5;
    if (tile.dungeonCardKind != null) return 6;
    return 7;
};

export const applyDungeonLayoutPlan = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): Tile[] => {
    if (!gameMode || !tiles.some((tile) => tile.dungeonCardKind != null)) {
        return tiles;
    }
    const total = tiles.length;
    if (total <= 3) {
        return tiles;
    }
    const columns = clamp(Math.ceil(Math.sqrt(total)), 2, 8);
    const rng = createMulberry32(hashStringToSeed(`dungeonLayout:${rulesVersion}:${runSeed}:${level}:${dungeonNodeKind ?? 'floor'}`));
    const graph = makeDungeonGraphSlots(total, columns, rng);
    const shuffledTiles = shuffleWithRng(() => rng(), tiles);
    const orderedTiles = [...shuffledTiles].sort(
        (a, b) => dungeonLayoutPriority(a) - dungeonLayoutPriority(b) || a.id.localeCompare(b.id)
    );
    const available = new Set(Array.from({ length: total }, (_, index) => index));
    const placed = new Map<number, Tile>();
    const exitSlots: number[] = [];
    const lastRowStart = Math.max(0, Math.floor((total - 1) / columns) * columns);
    const tailStart = Math.max(0, total - 3);
    const preferredFrom = (slots: number[], fallback: number, offset: number): number => slots[offset % Math.max(1, slots.length)] ?? fallback;

    orderedTiles.forEach((tile, order) => {
        const isExit = tile.pairKey === EXIT_PAIR_KEY;
        const isBranch = tile.pairKey === SHOP_PAIR_KEY || tile.pairKey === ROOM_PAIR_KEY;
        const isHazard = tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap' || tile.dungeonBossId != null;
        const isReward =
            tile.dungeonCardKind === 'treasure' ||
            tile.dungeonCardKind === 'shrine' ||
            tile.dungeonCardKind === 'key' ||
            tile.dungeonCardKind === 'lock';
        const fallback = Math.floor(((order + 1) / (orderedTiles.length + 1)) * total);
        const preferred = isExit
            ? preferredFrom(graph.mainPath, Math.floor(total * 0.58), graph.mainPath.length - 2 - exitSlots.length)
            : isBranch
              ? preferredFrom(
                    graph.branches,
                    dungeonNodeKind === 'shop' || dungeonNodeKind === 'rest' ? Math.floor(total * 0.28) : Math.floor(total * 0.42),
                    order
                )
              : isHazard
                ? preferredFrom(
                      graph.hazards,
                      dungeonNodeKind === 'trap' || dungeonNodeKind === 'elite' || dungeonNodeKind === 'boss'
                          ? Math.floor(total * 0.32)
                          : Math.floor(total * 0.35),
                      order
                  )
                : isReward
                  ? preferredFrom(
                        graph.rewards,
                        dungeonNodeKind === 'treasure' ? Math.floor(total * 0.45) : Math.floor(total * 0.5),
                        order
                    )
                  : fallback;
        const slot =
            nearestAvailableSlot(preferred, available, total, (candidate) => {
                if (!isExit) {
                    return true;
                }
                const notTail = total <= columns + 3 || (candidate < tailStart && candidate < lastRowStart);
                const separated = exitSlots.every((existing) => Math.abs(existing - candidate) > 1);
                return notTail && separated;
            }) ??
            nearestAvailableSlot(preferred, available, total, (candidate) => !isExit || exitSlots.every((existing) => Math.abs(existing - candidate) > 1)) ??
            nearestAvailableSlot(preferred, available, total, () => true);
        if (slot == null) {
            return;
        }
        available.delete(slot);
        placed.set(slot, tile);
        if (isExit) {
            exitSlots.push(slot);
        }
    });

    return Array.from({ length: total }, (_, index) => placed.get(index)).filter((tile): tile is Tile => tile != null);
};
