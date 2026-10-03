import type { ElementCastImpact, RealmEvent, RealmId, Tile, TileSuit } from './contracts';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { reconcileRealmHolds } from './realm-hold-policy';
import { runNonNegativeInteger } from './run-number-guards';
import { SUIT_REALM } from './realm-sway-rules';
import { chargeKin, createAlchemyLog, elementAlchemy, elementLands, elementWouldLand, type AlchemyLog } from './element-alchemy-rules';

/** Every pair casts its element. Fire ignites, Water moves, Frost freezes and Grove binds.
 * Kin absorb; counters resist. Holds use the same complete-cohort safety as arena hazards.
 * Failed attempts remain in the impact record, with the reason they could not land. */

export type ElementCastKind = Extract<RealmEvent['kind'], 'scorch' | 'wash' | 'freeze' | 'entangle'>;

export const ELEMENT_CAST_KIND: Readonly<Record<TileSuit, ElementCastKind>> = {
    ember: 'scorch',
    tide: 'wash',
    bone: 'freeze',
    moss: 'entangle'
};

export const ELEMENT_REACH = 2;
export const ELEMENT_REACH_IN_OWN_REALM = 3;
export const ELEMENT_HOLD_CAP = 2;
export const ELEMENT_HOLD_CAP_GROUP = 6;
export const ELEMENT_WASH_CAP = 6;
export const ELEMENT_WASH_PER_TIER = 2;

/** Shared thresholds. The budget chooses blocks; the last block always finishes. */
export const elementCastPower = (combo: number, tier: number, groupPairs = 1, multiplier = 1) => ({
    extraReach: Math.floor(runNonNegativeInteger(combo) / 3) + runNonNegativeInteger(tier),
    targets: Math.min(ELEMENT_HOLD_CAP_GROUP, ELEMENT_HOLD_CAP + Math.floor(runNonNegativeInteger(combo) / 6) + Math.floor(runNonNegativeInteger(tier) / 2) + Math.max(0, groupPairs - 1) + Math.floor(Math.log2(Math.max(1, runNonNegativeInteger(multiplier))))),
    blooming: runNonNegativeInteger(combo) >= 6 || runNonNegativeInteger(tier) >= 2
});

/** Currents move more cards instead of applying holds; they share the cast's amplification. */
export const elementWashCapacity = (power: ReturnType<typeof elementCastPower>): number =>
    ELEMENT_WASH_CAP + ELEMENT_WASH_PER_TIER * (power.extraReach + power.targets - ELEMENT_HOLD_CAP);

export const ELEMENT_MATCH_RULES: Readonly<Record<TileSuit, string>> = {
    ember: 'Every match burns vines and seeds, melts ice, then ignites a vulnerable block. Match burning cards for +2 gold; an expired fuse costs 1 gold per card. Steam or Thaw quenches the ignition.',
    tide: 'Every match douses fires, waters seeds into 2-gold blooms and carries vulnerable, unanchored cards one place along.',
    bone: 'Every match attempts to freeze vulnerable blocks. Frozen cards cannot turn. Ice lasts 1 turn at base power, 2 at power 3, 3 at power 6. Match nearby or use Fire to break it early. A hold keeps at least two pairs under identical ice and leaves a free pair.',
    moss: 'Every match attempts to tie down vulnerable blocks with vines. Vined cards cannot turn or drift. Match nearby to cut vines for gold, or use Fire to burn them. Combo 6 or tier 2 grows blooming vines worth 3 gold when cut. Holds keep two pairs together and leave a free pair.'
};

const isReal = (tile: Tile): boolean => !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);

/** Face-down real cards within `reach` steps of any of `from`, nearest first, never one of `from`. */
export const cardsWithinReach = (tiles: readonly Tile[], columns: number, from: readonly number[], reach: number): number[] => {
    const seen = new Map<number, number>();
    for (const index of from) seen.set(index, 0);
    let frontier = [...from];
    for (let step = 1; step <= reach; step += 1) {
        const next: number[] = [];
        for (const index of frontier) {
            for (const near of orthogonalNeighbourIndices(index, columns, tiles.length)) {
                if (seen.has(near)) continue;
                seen.set(near, step);
                next.push(near);
            }
        }
        frontier = next;
    }
    return [...seen.entries()]
        .filter(([index, step]) => step > 0 && tiles[index]?.state === 'hidden' && isReal(tiles[index]!))
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([index]) => index);
};

export interface ElementCast {
    kind: ElementCastKind;
    suit: TileSuit;
    /** The group that cast it (for the bursts), and the cards it changed or moved. */
    groupTileIds: string[];
    touchedTileIds: string[];
    summary: string;
    sourceCells: number[];
    contacts: ElementCastImpact['contacts'];
    power: number;
    multiplier: number;
    groupPairs: number;
}

/** A cast travels through touching cards of one element before jumping to the next block. */
export const elementalContactGroups = (tiles: readonly Tile[], columns: number, reached: readonly number[]): number[][] => {
    const remaining = new Set(tiles.flatMap((tile, index) => tile.state === 'hidden' && isReal(tile) ? [index] : []));
    const groups: number[][] = [];
    for (const start of reached) {
        if (!remaining.delete(start)) continue;
        const group = [start];
        for (let at = 0; at < group.length; at += 1) {
            for (const next of orthogonalNeighbourIndices(group[at]!, columns, tiles.length)) {
                if (remaining.has(next) && tiles[next]?.suit === tiles[start]?.suit) {
                    remaining.delete(next);
                    group.push(next);
                }
            }
        }
        groups.push(group);
    }
    return groups;
};

/** Spend the card budget on nearest eligible blocks, always finishing the last block. */
const wholeBlockTargets = (groups: readonly (readonly number[])[], budget: number, eligible: (index: number) => boolean): number[] => {
    const selected: number[] = [];
    for (const block of groups) {
        if (selected.length >= budget) break;
        selected.push(...block.filter(eligible));
    }
    return selected;
};

/**
 * Cast the element of a matched group on `tiles` (mutated in place, like the realm's other steps).
 * `groupTileIds` are the matched pair and the cards its pop took; their suit is the element.
 * Returns null when the group has no element (the joker, a singleton, a card with no suit).
 */
export const castElement = ({
    tiles,
    columns,
    groupTileIds,
    realmId,
    secondaryId = null,
    pinned,
    anchored = pinned,
    alchemy = createAlchemyLog(),
    tier = 0,
    combo = 0,
    quenchFire = false,
    multiplier = 1
}: {
    tiles: Tile[];
    columns: number;
    groupTileIds: readonly string[];
    realmId: RealmId | null;
    secondaryId?: RealmId | null;
    pinned: ReadonlySet<string>;
    /** Movement protection from ground, separate from actual pinned cards. */
    anchored?: ReadonlySet<string>;
    alchemy?: AlchemyLog;
    /** The element's resonance tier: a step of reach each. */
    tier?: number;
    /** Retained call-site compatibility: calm pauses arena hazards, never the player cast. */
    still?: boolean;
    combo?: number;
    quenchFire?: boolean;
    multiplier?: number;
}): ElementCast | null => {
    const group = groupTileIds.map((id) => tiles.findIndex((tile) => tile.id === id)).filter((index) => index >= 0);
    const suit = group.map((index) => tiles[index]!).find((tile) => tile.suit && isReal(tile))?.suit;
    if (!suit) return null;
    const kind = ELEMENT_CAST_KIND[suit];
    const steps = runNonNegativeInteger(tier);
    const groupPairs = new Set(group.map((index) => tiles[index]!.pairKey)).size;
    const power = elementCastPower(combo, steps, groupPairs, multiplier);
    const reach = (SUIT_REALM[suit] === realmId || SUIT_REALM[suit] === secondaryId ? ELEMENT_REACH_IN_OWN_REALM : ELEMENT_REACH) + power.extraReach;
    const groups = elementalContactGroups(tiles, Math.max(1, columns), cardsWithinReach(tiles, Math.max(1, columns), group, Math.min(tiles.length, reach)));
    const reached = groups.flat();
    const before = [...tiles];
    // The visible wave meets counter-elements too. Their response must survive into the impact
    // record, even when another card receives the actual hold or ignition.
    for (const index of reached) if (elementAlchemy(tiles[index]!, suit) === 'neutralized') elementLands(tiles, index, suit, alchemy);
    const outcomes: string[] = [];
    const attempts = new Map<string, 'ignited' | 'frozen' | 'entangled'>();
    const blocked = new Map<string, string>();
    const movedIds = new Set<string>();
    for (const index of reached) {
        const tile = tiles[index]!;
        if (!elementWouldLand(tile, suit) || kind === 'wash') continue;
        const attempt = kind === 'scorch' ? 'ignited' : kind === 'freeze' ? 'frozen' : 'entangled';
        const reason = pinned.has(tile.id) ? 'Pinned card' : kind === 'scorch' && quenchFire ? 'Steam or Thaw quenched the fire'
            : kind === 'freeze' && tile.vined ? 'Already tied down' : kind !== 'scorch' && tile.rime ? 'Protective rime' : kind === 'entangle' && (tile.frost ?? 0) > 0 ? 'Ice protects this card' : null;
        if (reason) { attempts.set(tile.id, attempt); blocked.set(tile.id, reason); }
    }
    // Every reached kin block charges once through the same turn ledger.
    const touched: string[] = chargeKin(tiles, reached, suit, alchemy);
    switch (kind) {
        case 'scorch': {
            let cleared = 0;
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.vined == null && tile.frost == null && tile.snowed == null && tile.bloom == null && !tile.rime && !tile.seeded) continue;
                if (!elementLands(tiles, index, suit, alchemy)) continue;
                const { vined: _v, bloom: _b, frost: _f, snowed: _s, rime: _r, seeded: _seed, ...rest } = tile;
                tiles[index] = rest;
                touched.push(tile.id);
                cleared += 1;
            }
            let ignited = 0;
            const targets = wholeBlockTargets(groups, power.targets, index => elementWouldLand(tiles[index]!, suit) && !blocked.has(tiles[index]!.id));
            for (const index of targets) {
                const tile = tiles[index]!;
                attempts.set(tile.id, 'ignited');
                if (pinned.has(tile.id) || quenchFire) {
                    blocked.set(tile.id, quenchFire ? 'Steam or Thaw quenched the fire' : 'Pinned card');
                    continue;
                }
                // Calm pauses arena hazards and fuse clocks, not the player's cast.
                tiles[index] = { ...tile, fuse: Math.max(tile.fuse ?? 0, 3) };
                touched.push(tile.id);
                ignited += 1;
            }
            if (cleared) outcomes.push(`${cleared} scorched clear`);
            if (ignited) outcomes.push(`${ignited} ignited · 3-turn fuse`);
            break;
        }
        case 'wash': {
            let nurtured = 0;
            let doused = 0;
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.fuse == null && tile.seeded !== 1) continue;
                if (!elementLands(tiles, index, suit, alchemy)) continue;
                const { fuse: _fuse, ...rest } = tiles[index]!;
                tiles[index] = { ...rest, ...(tile.seeded === 1 ? { seeded: 2 } : {}) };
                if (tile.seeded === 1) nurtured += 1;
                if (tile.fuse != null) doused += 1;
                touched.push(tile.id);
            }
            if (doused) outcomes.push(`${doused} fires doused`);
            if (nurtured) outcomes.push(`${nurtured} seeds watered into 2-gold blooms`);
            const carried = reached.filter((index) => !anchored.has(tiles[index]!.id) && !tiles[index]!.rime && !tiles[index]!.vined && !(tiles[index]!.frost ?? 0));
            // Water and grove cards are not carried: the water flows around them.
            const movable = wholeBlockTargets(groups, elementWashCapacity(power), index => carried.includes(index) && elementWouldLand(tiles[index]!, suit));
            if (movable.length >= 2) {
                for (const index of carried) if (!elementWouldLand(tiles[index]!, suit)) elementLands(tiles, index, suit, alchemy);
                const moved = movable.map((index) => tiles[index]!);
                movable.forEach((index, at) => {
                    tiles[index] = moved[(at - 1 + moved.length) % moved.length]!;
                });
                for (const tile of moved) { movedIds.add(tile.id); if (!touched.includes(tile.id)) touched.push(tile.id); }
                outcomes.push(`${moved.length} carried by the current`);
            }
            break;
        }
        case 'freeze': {
            const targets = wholeBlockTargets(groups, power.targets, index => elementWouldLand(tiles[index]!, suit) && !blocked.has(tiles[index]!.id));
            for (const index of targets) {
                const tile = tiles[index]!;
                attempts.set(tile.id, 'frozen');
                if (pinned.has(tile.id) || tile.rime) { blocked.set(tile.id, tile.rime ? 'Protective rime' : 'Pinned card'); continue; }
                tiles[index] = { ...tile, frost: Math.max(tile.frost ?? 0, 1 + Math.floor(power.targets / 3)) };
                touched.push(tile.id);
            }
            break;
        }
        case 'entangle': {
            const targets = wholeBlockTargets(groups, power.targets, index => elementWouldLand(tiles[index]!, suit) && !blocked.has(tiles[index]!.id));
            for (const index of targets) {
                const tile = tiles[index]!;
                attempts.set(tile.id, 'entangled');
                if (pinned.has(tile.id) || tile.rime || (tile.frost ?? 0) > 0) {
                    blocked.set(tile.id, pinned.has(tile.id) ? 'Pinned card' : 'Ice protects this card'); continue;
                }
                tiles[index] = { ...tile, vined: true, ...(power.blooming ? { bloom: true } : {}) };
                touched.push(tile.id);
            }
            break;
        }
    }
    if (kind === 'freeze' || kind === 'entangle') {
        const protectedIds = new Set([...pinned, ...tiles.filter(tile => tile.rime).map(tile => tile.id)]);
        const policy = reconcileRealmHolds(tiles, columns, before, protectedIds);
        for (const id of policy.added) {
            touched.push(id);
            attempts.set(id, kind === 'freeze' ? 'frozen' : 'entangled');
        }
        for (const [id, attempt] of attempts) {
            const tile = tiles.find(tile => tile.id === id)!;
            if (!(attempt === 'frozen' ? (tile.frost ?? 0) > 0 : tile.vined) && !blocked.has(id)) {
                blocked.set(id, 'A hold needs two complete pairs and must leave a free pair');
            }
            if (!blocked.has(id)) {
                const index = tiles.findIndex(candidate => candidate.id === id);
                if (attempt === 'frozen') {
                    const { seeded: _seed, fuse: _fuse, ...rest } = tile;
                    tiles[index] = rest;
                } else tiles[index] = { ...tile, seeded: Math.max(tile.seeded ?? 0, power.blooming ? 2 : 1) };
            }
        }
        const held = [...attempts].filter(([id]) => !blocked.has(id)).length;
        outcomes.push(held ? `${held} ${kind === 'freeze' ? 'frozen' : 'tied down'}` : `${attempts.size} hold attempts blocked`);
    }
    const charged = reached.filter(index => alchemy.empowered.includes(before[index]!.id)).length;
    const resisted = reached.filter(index => alchemy.neutralized.includes(before[index]!.id)).length;
    if (charged) outcomes.push(`${charged} cards charged`);
    if (resisted) outcomes.push(`${resisted} counter-cards resisted`);
    if (outcomes.length === 0) outcomes.push(touched.length > 0 ? `${new Set(touched).size} cards affected` : 'No vulnerable cards in reach');
    const contacts: ElementCastImpact['contacts'] = [];
    // Cohort completion can reach a partner outside the original wave. It gets a real contact too.
    for (const id of attempts.keys()) {
        const cell = before.findIndex(tile => tile.id === id);
        if (cell >= 0 && !reached.includes(cell)) groups.push([cell]);
    }
    groups.forEach((indices, groupIndex) => indices.forEach((originalCell) => {
        const original = before[originalCell]!;
        const originalId = original.id;
        const cell = tiles.findIndex(tile => tile.id === originalId);
        const outcome = blocked.has(originalId) ? 'blocked' : attempts.has(originalId) && touched.includes(originalId) ? 'affected' : alchemy.neutralized.includes(originalId) ? 'neutralized' : alchemy.empowered.includes(originalId) ? 'charged' : touched.includes(originalId) ? 'affected' : null;
        const tile = tiles[cell]!;
        const effect = movedIds.has(originalId) ? 'current' : tile.vined ? 'entangled' : (tile.frost ?? 0) > 0 ? 'frozen' : tile.fuse != null ? 'ignited' : tile.rime ? 'rimed' : tile.seeded ? 'seeded' : kind === 'wash' ? 'current' : 'cleared';
        if (outcome && original.suit) contacts.push({ tileId: originalId, cell, suit: original.suit, outcome, effect, group: groupIndex, ...(attempts.has(originalId) ? { attempt: attempts.get(originalId) } : {}), ...(blocked.has(originalId) ? { reason: blocked.get(originalId) } : {}) });
    }));
    return { kind, suit, sourceCells: group, contacts, power: power.targets, multiplier, groupPairs, groupTileIds: group.map((index) => tiles[index]!.id), touchedTileIds: [...new Set(touched)].filter(id => kind === 'scorch' || !blocked.has(id)), summary: outcomes.join(' · ') };
};
