import type { ElementCastImpact, RealmEvent, RealmId, Tile, TileSuit } from './contracts';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { runNonNegativeInteger } from './run-number-guards';
import { SUIT_REALM } from './realm-sway-rules';
import { chargeKin, createAlchemyLog, elementAlchemy, elementLands, elementWouldLand, type AlchemyLog } from './element-alchemy-rules';

/**
 * Elemental groups (2026-10-01): the suits are the elements, and a matched group casts its element
 * on the board.
 *
 * The owner, after the realms' weather and their screen and card effects had shipped: "All cards
 * currently have effects/groups on them. You are further adding an elemental system on top of that,
 * that triggers the effect. The effects need to trigger from the base cards and their groups. Their
 * groups should be made the elements." So the four suits every card already carries are the four
 * elements (ember is Fire, tide is Water, moss is Grove, bone is Frost), and a match is a cast: the
 * matched pair and every pair its pop took (one suit, so one element) act on the face-down cards
 * around them.
 *
 * - **Fire** scorches: vines burn off, ice melts, snow is gone. It pays nothing (a harvest pays
 *   because the player's match cut the vine; a fire is the element doing it).
 * - **Water** washes: fires are put out, and the cards it reaches drift one place along.
 * - **Frost** coats playable cards in rime: they resist movement and arena holds; matching banks a calm turn.
 * - **Grove** seeds playable cards: matching harvests gold; Water nurtures seeds and Fire burns them away.
 *
 * Reach is counted in steps from every card of the group, so a bigger pop reaches further by having
 * more cards: two steps, three when the floor is in the element's own realm. Every match already
 * thaws and cuts what is right beside it (`realm-weather-rules.ts` step 2), so an element starts
 * where that ends. Every match acts on two targets at base strength, scaling to six with combo,
 * resonance, popped pairs and multiplier. Touching same-element blocks receive the spell together, beyond the initial reach and card budget.
 * Every three combo and every resonance tier adds reach. Ordinary casts never block flipping.
 * Water never moves a pinned card. Only arena hazards create paired holds.
 *
 * Every card the cast would act on answers first (`element-alchemy-rules.ts`): a card of the
 * cast's own element drinks it and is empowered, a card of the element that puts it out is left
 * as it was. Neither consumes a hold target: the cast seeks the next vulnerable card.
 *
 * Since 2026-10-02 the cast grows with the element's resonance (`element-resonance-rules.ts`): a
 * step of reach and two more cards washed for every tier, and it charges every connected card of its own
 * element that the wave reaches, acted on or not. Freeze-over suppresses ignition, not beneficial coatings.
 */

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
    bone: 'Every match douses fires and coats a vulnerable block in rime. Cards stay playable and resist currents and arena holds, but frost destroys their seeds. Match rime to calm the next turn.',
    moss: 'Every match seeds a vulnerable block. Cards stay playable; matching harvests 1 gold per seed. At combo 6 or resonance tier 2, blooms pay 2 gold. Fire burns them away.'
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
    still = false,
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
    /** Freeze-over suppresses ignition while beneficial coatings still land. */
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
            if (!still && !quenchFire) {
                const targets = wholeBlockTargets(groups, power.targets, index => {
                    const tile = tiles[index]!;
                    return tile.fuse == null && !pinned.has(tile.id) && elementWouldLand(tile, suit);
                });
                for (const index of targets) {
                    const tile = tiles[index]!;
                    tiles[index] = { ...tile, fuse: 3 };
                    touched.push(tile.id);
                    ignited += 1;
                }
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
            const carried = reached.filter((index) => !anchored.has(tiles[index]!.id) && !tiles[index]!.rime);
            // Water and grove cards are not carried: the water flows around them.
            const movable = wholeBlockTargets(groups, elementWashCapacity(power), index => carried.includes(index) && elementWouldLand(tiles[index]!, suit));
            if (movable.length >= 2) {
                for (const index of carried) if (!elementWouldLand(tiles[index]!, suit)) elementLands(tiles, index, suit, alchemy);
                const moved = movable.map((index) => tiles[index]!);
                movable.forEach((index, at) => {
                    tiles[index] = moved[(at - 1 + moved.length) % moved.length]!;
                });
                for (const tile of moved) if (!touched.includes(tile.id)) touched.push(tile.id);
                outcomes.push(`${moved.length} carried by the current`);
            }
            break;
        }
        case 'freeze': {
            let doused = 0;
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.fuse != null && elementLands(tiles, index, suit, alchemy)) {
                    const { fuse: _fuse, ...rest } = tiles[index]!;
                    tiles[index] = rest;
                    touched.push(tile.id);
                    doused += 1;
                }
            }
            const targets = wholeBlockTargets(groups, power.targets, index => !tiles[index]!.rime && !pinned.has(tiles[index]!.id) && elementWouldLand(tiles[index]!, suit));
            let lostSeeds = 0;
            for (const index of targets) {
                const tile = tiles[index]!;
                if (tile.seeded) lostSeeds += 1;
                const { seeded: _seed, ...rest } = tile;
                tiles[index] = { ...rest, rime: true };
                touched.push(tile.id);
            }
            if (doused) outcomes.push(`${doused} fires doused`);
            if (targets.length) outcomes.push(`${targets.length} protected by rime · playable, anchored · match for one calm turn`);
            if (lostSeeds) outcomes.push(`${lostSeeds} seeds lost to frost`);
            break;
        }
        case 'entangle': {
            const targets = wholeBlockTargets(groups, power.targets, index => {
                const tile = tiles[index]!;
                return (tile.seeded ?? 0) < (power.blooming ? 2 : 1) && !tile.rime && !pinned.has(tile.id) && elementWouldLand(tile, suit);
            });
            for (const index of targets) {
                const tile = tiles[index]!;
                tiles[index] = { ...tile, seeded: power.blooming ? 2 : 1 };
                touched.push(tile.id);
            }
            if (targets.length) outcomes.push(`${targets.length} ${power.blooming ? 'blooms · match for 2 gold each' : 'seeds · match for 1 gold each'} · cards stay playable`);
            break;
        }
    }
    const charged = reached.filter(index => alchemy.empowered.includes(before[index]!.id)).length;
    const resisted = reached.filter(index => alchemy.neutralized.includes(before[index]!.id)).length;
    if (charged) outcomes.push(`${charged} cards charged`);
    if (resisted) outcomes.push(`${resisted} counter-cards resisted`);
    if (outcomes.length === 0) outcomes.push(still ? 'Freeze-over holds hazards still' : touched.length > 0 ? `${new Set(touched).size} cards affected` : 'No vulnerable cards in reach');
    const contacts: ElementCastImpact['contacts'] = [];
    groups.forEach((indices, groupIndex) => indices.forEach((originalCell) => {
        const original = before[originalCell]!;
        const originalId = original.id;
        const cell = tiles.findIndex(tile => tile.id === originalId);
        const outcome = alchemy.neutralized.includes(originalId) ? 'neutralized' : alchemy.empowered.includes(originalId) ? 'charged' : touched.includes(originalId) ? 'affected' : null;
        const tile = tiles[cell]!;
        const effect = tile.vined ? 'entangled' : (tile.frost ?? 0) > 0 ? 'frozen' : tile.fuse != null ? 'ignited' : tile.rime ? 'rimed' : tile.seeded ? 'seeded' : kind === 'wash' ? 'current' : 'cleared';
        if (outcome && original.suit) contacts.push({ tileId: originalId, cell, suit: original.suit, outcome, effect, group: groupIndex });
    }));
    return { kind, suit, sourceCells: group, contacts, power: power.targets, multiplier, groupPairs, groupTileIds: group.map((index) => tiles[index]!.id), touchedTileIds: [...new Set(touched)], summary: outcomes.join(' · ') };
};
