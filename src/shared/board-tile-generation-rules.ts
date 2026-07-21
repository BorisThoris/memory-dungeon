import { type FindableKind, type MutatorId, type Tile } from './contracts';
import { getFindableSpawnWeightRows } from './findables';
import {
    createMulberry32,
    deriveLevelTileRngSeed,
    hashStringToSeed,
    pickRngIndex,
    shuffleWithRng
} from './rng';
import {
    LETTER_SYMBOLS,
    getSymbolSetForLevel as getSymbolSetForLevelFromCatalog
} from './tile-symbol-catalog';
import {
    DECOY_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

const PICKUP_BASELINE_RULES_VERSION = 8;

type SymbolEntry = { symbol: string; label: string };

const getSymbolSetForLevel = (level: number): readonly SymbolEntry[] => getSymbolSetForLevelFromCatalog(level);

export const atomicVariantForPairKey = (pairKey: string): number => {
    let h = 0;
    for (let i = 0; i < pairKey.length; i++) {
        h = (h * 31 + pairKey.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 8;
};

export const pickCursedPairKey = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number
): string | null => {
    const realKeys = [
        ...new Set(
            tiles
                .map((t) => t.pairKey)
                .filter((k) => !isSingletonUtilityPairKey(k))
        )
    ];
    if (realKeys.length < 2) {
        return null;
    }
    const rng = createMulberry32(hashStringToSeed(`cursed:${rulesVersion}:${runSeed}:${level}`));
    return realKeys[pickRngIndex(rng, realKeys.length)]!;
};

export const createTiles = (
    level: number,
    pairCount: number,
    runSeed: number,
    rulesVersion: number,
    mutators: MutatorId[],
    includeWildTile?: boolean
): Tile[] => {
    const rng = createMulberry32(deriveLevelTileRngSeed(runSeed, level, rulesVersion));
    const symbolSource = mutators.includes('category_letters') ? LETTER_SYMBOLS : getSymbolSetForLevel(level);
    const symbols = symbolSource.slice(0, pairCount);
    const pairs: Tile[] = symbols.flatMap((entry, index) => {
        const pairKey = `${level}-${index}`;
        const atomicVariant = atomicVariantForPairKey(pairKey);
        return [
            {
                id: `${pairKey}-A`,
                pairKey,
                state: 'hidden' as const,
                symbol: entry.symbol,
                label: entry.label,
                atomicVariant
            },
            {
                id: `${pairKey}-B`,
                pairKey,
                state: 'hidden' as const,
                symbol: entry.symbol,
                label: entry.label,
                atomicVariant
            }
        ];
    });

    if (mutators.includes('glass_floor')) {
        pairs.push({
            id: `${level}-decoy`,
            pairKey: DECOY_PAIR_KEY,
            state: 'hidden' as const,
            symbol: 'X',
            label: 'Decoy',
            atomicVariant: 0
        });
    }

    if (includeWildTile) {
        pairs.push({
            id: `${level}-wild`,
            pairKey: WILD_PAIR_KEY,
            state: 'hidden' as const,
            symbol: '?',
            label: 'Wild',
            atomicVariant: 0
        });
    }

    return shuffleWithRng(() => rng(), pairs);
};

export const countFindablePairs = (tiles: readonly Tile[]): number =>
    new Set(tiles.filter((tile) => tile.findableKind != null).map((tile) => tile.pairKey)).size;

const pickFindableKind = (roll: number): FindableKind => {
    const rows = getFindableSpawnWeightRows().filter((row) => row.weight > 0);
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    let cursor = roll * total;
    for (const row of rows) {
        if (cursor < row.weight) {
            return row.id;
        }
        cursor -= row.weight;
    }
    return rows[rows.length - 1]?.id ?? 'shard_spark';
};

export const assignFindableKindsToTiles = (
    tiles: Tile[],
    mutators: MutatorId[],
    runSeed: number,
    rulesVersion: number,
    level: number
): Tile[] => {
    const eligibleKeys = [
        ...new Set(
            tiles
                .map((t) => t.pairKey)
                .filter((k) => !isSingletonUtilityPairKey(k))
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const legacyFindables = rulesVersion < PICKUP_BASELINE_RULES_VERSION;
    if (legacyFindables && !mutators.includes('findables_floor')) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`findables:${rulesVersion}:${runSeed}:${level}`));
    let pairCountTarget = 0;
    if (legacyFindables) {
        const roll = rng();
        pairCountTarget = roll < 0.2 ? 0 : roll < 0.7 ? 1 : 2;
    } else if (mutators.includes('findables_floor')) {
        pairCountTarget = 2;
    } else if (level <= 3) {
        pairCountTarget = 1;
    } else {
        pairCountTarget = rng() < 0.5 ? 1 : 2;
    }
    const n = Math.min(pairCountTarget, eligibleKeys.length);
    if (n === 0) {
        return tiles;
    }
    const keys = [...eligibleKeys];
    for (let i = keys.length - 1; i > 0; i--) {
        const j = pickRngIndex(rng, i + 1);
        const tmp = keys[i]!;
        keys[i] = keys[j]!;
        keys[j] = tmp;
    }
    const picked = keys.slice(0, n);
    const kindByKey = new Map<string, FindableKind>();
    for (const key of picked) {
        kindByKey.set(key, pickFindableKind(rng()));
    }
    return tiles.map((t) => {
        const kind = kindByKey.get(t.pairKey);
        return kind ? { ...t, findableKind: kind } : t;
    });
};
