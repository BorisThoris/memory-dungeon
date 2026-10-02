import type { Tile } from './contracts';
import { elementWouldLand } from './element-alchemy-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';

/** Four indistinguishable held cards preserve ambiguity; one held pair would reveal its identity. */
export const MIN_HELD_PAIRS = 2;
const real = (tile: Tile) => !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);
const held = (tile: Tile) => (tile.frost ?? 0) > 0 || tile.vined === true;
type Hold = 'frost' | 'vined';
const has = (tile: Tile, kind: Hold) => kind === 'frost' ? (tile.frost ?? 0) > 0 : tile.vined === true;
const freePair = (tiles: readonly Tile[]) => {
    const keys = new Set<string>();
    for (const tile of tiles) {
        if (tile.state !== 'hidden' || held(tile) || !real(tile)) continue;
        if (keys.has(tile.pairKey)) return true;
        keys.add(tile.pairKey);
    }
    return false;
};

/**
 * Finalize a whole cohort, never an individual half. A fresh request may recruit a second pair.
 * Cleanup (no `before`) can only release cards; it never recruits a new pair after a cut or bomb.
 * Every held pair uses the same duration/bloom appearance, so the mark does not encode partners.
 */
export function reconcileRealmHolds(tiles: Tile[], columns: number, before?: readonly Tile[], pinned: ReadonlySet<string> = new Set()) {
    const original = [...tiles];
    const prior = new Map(before?.map(tile => [tile.id, tile]));
    const pairs = new Map<string, number[]>();
    tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && real(tile)) pairs.set(tile.pairKey, [...(pairs.get(tile.pairKey) ?? []), index]);
    });
    const clear = (kind: Hold) => tiles.forEach((tile, index) => {
        if (tile.state !== 'hidden' || !has(tile, kind)) return;
        if (kind === 'frost') { const { frost: _f, ...rest } = tile; tiles[index] = rest; }
        else { const { vined: _v, bloom: _b, ...rest } = tile; tiles[index] = rest; }
    });
    for (const kind of ['frost', 'vined'] as const) {
        const requested = tiles.flatMap((tile, cell) => tile.state === 'hidden' && has(tile, kind) ? [cell] : []);
        if (!requested.length) continue;
        const fresh = !!before && requested.some(cell => !prior.get(tiles[cell]!.id) || !has(prior.get(tiles[cell]!.id)!, kind));
        const requestedKeys = new Set(requested.map(cell => tiles[cell]!.pairKey));
        const existingDurations = requested.filter(cell => prior.get(tiles[cell]!.id)?.frost)
            .map(cell => tiles[cell]!.frost ?? 0).filter(n => n > 0);
        // New hazards join the current expiry; they cannot keep refreshing an old lock.
        const duration = existingDurations.length ? Math.min(...existingDurations)
            : Math.max(1, ...requested.map(cell => tiles[cell]!.frost ?? 0));
        const bloom = requested.some(cell => tiles[cell]!.bloom);
        const width = Math.max(1, columns);
        const existingPair = (cells: number[]) => cells.every(cell => {
            const old = prior.get(tiles[cell]!.id);
            return old && has(old, kind) && has(tiles[cell]!, kind);
        });
        const distance = (cells: number[]) => Math.min(...cells.flatMap(cell => requested.map(from =>
            Math.abs(Math.floor(cell / width) - Math.floor(from / width)) + Math.abs(cell % width - from % width))));
        const candidates = [...pairs.values()].filter(cells => cells.length === 2 && cells.every(cell => {
            const tile = tiles[cell]!;
            return !pinned.has(tile.id) && elementWouldLand(tile, kind === 'frost' ? 'bone' : 'moss')
                && !has(tile, kind === 'frost' ? 'vined' : 'frost') && (fresh || has(tile, kind));
        })).sort((a, b) => Number(existingPair(b)) - Number(existingPair(a)) ||
            Number(requestedKeys.has(tiles[b[0]!]!.pairKey)) - Number(requestedKeys.has(tiles[a[0]!]!.pairKey)) || distance(a) - distance(b));
        clear(kind);
        const target = fresh ? Math.min(3, Math.max(MIN_HELD_PAIRS, requestedKeys.size)) : candidates.length;
        let chosen = 0;
        for (const cells of candidates) {
            if (chosen >= target) break;
            const saved = cells.map(cell => tiles[cell]!);
            for (const cell of cells) tiles[cell] = { ...tiles[cell]!, ...(kind === 'frost' ? { frost: duration } : { vined: true, ...(bloom ? { bloom: true } : {}) }) };
            if (freePair(tiles)) chosen += 1;
            else cells.forEach((cell, index) => { tiles[cell] = saved[index]!; });
        }
        if (chosen < MIN_HELD_PAIRS) clear(kind);
    }
    // Preserve identity on unchanged rows (important for the board's incremental renderer).
    tiles.forEach((tile, index) => {
        const old = original[index]!;
        if (tile.frost === old.frost && tile.vined === old.vined && tile.bloom === old.bloom) tiles[index] = old;
    });
    return {
        added: tiles.filter((tile, index) => held(tile) && !held(original[index]!)).map(tile => tile.id),
        freed: tiles.filter((tile, index) => !held(tile) && held(original[index]!)).map(tile => tile.id)
    };
}
