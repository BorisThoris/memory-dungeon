import type { RunState, Tile, TileSuit } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { TILE_SUITS } from './tile-suit-rules';
import { SUIT_REALM } from './realm-sway-rules';
import { tileCharge } from './element-alchemy-rules';

export type ElementalPouch = Partial<Record<TileSuit, number>>;
export type ElementalStoreId = `focus_${TileSuit}` | `prime_${TileSuit}`;
export const ELEMENTAL_LOOT_RULES_VERSION = 55;
export const usesElementalLoot = (run: Pick<RunState, 'runRulesVersion'>): boolean => run.runRulesVersion >= ELEMENTAL_LOOT_RULES_VERSION;
export const essenceOf = (pouch: ElementalPouch | undefined, suit: TileSuit): number => runNonNegativeInteger(pouch?.[suit]);
export const focusOf = (run: Pick<RunState, 'elementalFocus'>, suit: TileSuit): number => essenceOf(run.elementalFocus, suit);
export const isElementalStoreId = (id: string): id is ElementalStoreId =>
    TILE_SUITS.some(suit => id === `focus_${suit}` || id === `prime_${suit}`);
export const storeElement = (id: ElementalStoreId): TileSuit => id.slice(id.indexOf('_') + 1) as TileSuit;

/** A clear yields one essence of its arena and one seeded find; reactions earn a third.
 * Independent from gameplay RNG, and granted once at the clear seam, never by reopening a menu.
 */
export const floorElementalDrops = (run: Pick<RunState, 'runSeed' | 'runRulesVersion' | 'realmId' | 'elementReactionsThisFloor'>, floor: number): ElementalPouch => {
    if (!usesElementalLoot(run)) return {};
    const rng = createMulberry32(hashStringToSeed(`elemental-drops:${run.runSeed}:${floor}`));
    const randomSuit = () => TILE_SUITS[pickRngIndex(rng, TILE_SUITS.length)]!;
    const arenaSuit = TILE_SUITS.find(suit => SUIT_REALM[suit] === run.realmId) ?? randomSuit();
    const drops: ElementalPouch = {};
    for (const suit of [arenaSuit, randomSuit(), ...(runNonNegativeInteger(run.elementReactionsThisFloor) > 0 ? [randomSuit()] : [])]) {
        drops[suit] = essenceOf(drops, suit) + 1;
    }
    return drops;
};

export const addEssence = (pouch: ElementalPouch | undefined, drops: ElementalPouch): ElementalPouch =>
    Object.fromEntries(TILE_SUITS.map(suit => [suit, essenceOf(pouch, suit) + essenceOf(drops, suit)]));

/** One forged rank is one effective resonance tier for casts, without counterfeiting earned stacks. */
export const FOCUS_ESSENCE_COST = 2;
export const PRIME_ESSENCE_COST = 1;

export const FOCUS_EFFECTS: Readonly<Record<TileSuit, string>> = {
    ember: 'Convert one burning card reached by your cast into charge per rank. Charge powers its next match.',
    tide: 'Reveal one card affected by your current per rank until the next flip.',
    bone: 'Every Frost cast banks one calm turn per rank, pausing arena hazards.',
    moss: 'Ripen one seed reached by your cast per rank into a 2-gold bloom. Fire can burn it away.'
};

/** Applied to the real cast's targets, after elemental resistances and movement. */
export const applyForgedCast = (tiles: Tile[], touchedIds: readonly string[], suit: TileSuit, rank: number) => {
    let remaining = runNonNegativeInteger(rank);
    const touched = new Set(touchedIds);
    const lit: string[] = [];
    const charged: string[] = [];
    const bloomed: string[] = [];
    for (let index = 0; index < tiles.length && remaining > 0; index += 1) {
        const tile = tiles[index]!;
        if (!touched.has(tile.id) || tile.state !== 'hidden') continue;
        if (suit === 'ember' && tile.fuse != null) {
            const { fuse: _fuse, ...rest } = tile;
            tiles[index] = { ...rest, empowered: tileCharge(tile) + 1 };
            charged.push(tile.id);
            remaining -= 1;
        } else if (suit === 'tide') {
            lit.push(tile.id);
            remaining -= 1;
        } else if (suit === 'moss' && tile.seeded === 1) {
            tiles[index] = { ...tile, seeded: 2 };
            bloomed.push(tile.id);
            remaining -= 1;
        }
    }
    return { lit, charged, bloomed };
};
