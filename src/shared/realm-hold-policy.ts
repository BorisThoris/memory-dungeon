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
    // Plan both kinds from the same snapshot, then rebuild established cohorts first.
    // A tentative new vine must not make an existing ice cohort appear to block the last free pair.
    const kinds: Hold[] = ['frost', 'vined'];
    kinds.sort((a, b) => Number(original.some(tile => has(tile, b) && !!prior.get(tile.id) && has(prior.get(tile.id)!, b)))
        - Number(original.some(tile => has(tile, a) && !!prior.get(tile.id) && has(prior.get(tile.id)!, a))));
    clear('frost');
    clear('vined');
    for (const kind of kinds) {
        const requested = original.flatMap((tile, cell) => tile.state === 'hidden' && has(tile, kind) ? [cell] : []);
        if (!requested.length) continue;
        const fresh = !!before && requested.some(cell => !prior.get(tiles[cell]!.id) || !has(prior.get(tiles[cell]!.id)!, kind));
        const requestedKeys = new Set(requested.map(cell => tiles[cell]!.pairKey));
        const existingDurations = requested.filter(cell => prior.get(tiles[cell]!.id)?.frost)
            .map(cell => original[cell]!.frost ?? 0).filter(n => n > 0);
        // New hazards join the current expiry; they cannot keep refreshing an old lock.
        const duration = existingDurations.length ? Math.min(...existingDurations)
            : Math.max(1, ...requested.map(cell => original[cell]!.frost ?? 0));
        const bloom = requested.some(cell => original[cell]!.bloom);
        const width = Math.max(1, columns);
        const existingPair = (cells: number[]) => cells.every(cell => {
            const old = prior.get(tiles[cell]!.id);
            return old && has(old, kind) && has(original[cell]!, kind);
        });
        const distance = (cells: number[]) => Math.min(...cells.flatMap(cell => requested.map(from =>
            Math.abs(Math.floor(cell / width) - Math.floor(from / width)) + Math.abs(cell % width - from % width))));
        const candidates = [...pairs.values()].filter(cells => cells.length === 2 && cells.every(cell => {
            const tile = tiles[cell]!;
            const other = kind === 'frost' ? 'vined' : 'frost';
            const establishedOther = has(original[cell]!, other) && (!before || !!prior.get(tile.id) && has(prior.get(tile.id)!, other));
            return !establishedOther && !pinned.has(tile.id) && elementWouldLand(tile, kind === 'frost' ? 'bone' : 'moss')
                && !has(tile, kind === 'frost' ? 'vined' : 'frost') && (fresh || has(original[cell]!, kind));
        })).sort((a, b) => Number(existingPair(b)) - Number(existingPair(a)) ||
            Number(requestedKeys.has(tiles[b[0]!]!.pairKey)) - Number(requestedKeys.has(tiles[a[0]!]!.pairKey)) || distance(a) - distance(b));
        const target = fresh ? Math.max(MIN_HELD_PAIRS, requestedKeys.size) : candidates.length;
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
