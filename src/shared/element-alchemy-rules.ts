import type { Tile, TileSuit } from './contracts';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';

/**
 * Elemental alchemy (2026-10-01): every card is made of its group's element, and an element that
 * reaches a card meets the card's own.
 *
 * The owner, retiring the omen cards: "All cards are elemental cards now, given their group ... we
 * would give them immunities to elements given the element they themselves are, or we would make
 * them get neutralized or empowered by an element that's trying to hit them ... sort of an
 * alchemy / living world system." So a card's suit is its element (ember is Fire, tide is Water,
 * bone is Frost, moss is Grove, as in `element-group-rules.ts`), and whenever an element would act
 * on a face-down card - a matched group's cast, the realm's weather, a raging realm's backlash, a
 * miss's frostbite - the card answers first:
 *
 * - **Kin, charged.** An element does not act on a card made of it: the card drinks it instead
 *   and gains a charge (`Tile.empowered`, a count with no cap since 2026-10-02). Fire does not burn
 *   a fire card, frost does not freeze a frost card, vines do not hold a grove card, water does not
 *   carry a water card off. A matched group's cast charges every connected card of its own element reached by the wave, whether or not it would have acted on it (`chargeKin`). A charged card matched adds
 *   its charge to its element's resonance (`element-resonance-rules.ts`) and pays a gold for every
 *   `CHARGES_PER_GOLD` charges; it glows until then, brighter the more it holds.
 * - **Counter, neutralized.** Each element puts out one other (`ELEMENT_NEUTRALIZES`): water puts
 *   out fire, fire melts frost, frost kills growth, and roots hold against water. That element
 *   reaching the card is snuffed on contact and does nothing.
 * - Anything else lands as it always did.
 *
 * So every card is immune to two of the four elements and open to the other two, and a player who
 * can read a card's material can read what the weather can do to it. The storm is no element: its
 * lightning moves cards of every kind.
 *
 * A travelling cast visibly meets counter-elements throughout its reach, including on a clean
 * board. Holds pass those immune cards to find a vulnerable target; kin charging follows the same reached blocks. Weather retains its own targeting and only meets the cards it tries to affect.
 */

/** The element a card's suit puts out: a card of the key is untouched by the value. */
export const ELEMENT_NEUTRALIZES: Readonly<Record<TileSuit, TileSuit>> = {
    tide: 'ember',
    ember: 'bone',
    bone: 'moss',
    moss: 'tide'
};

/** The element names the player reads, by suit. */
export const ELEMENT_NAMES: Readonly<Record<TileSuit, string>> = {
    ember: 'Fire',
    tide: 'Water',
    bone: 'Frost',
    moss: 'Grove'
};

/** Charges a matched card pays a gold for. */
export const CHARGES_PER_GOLD = 4;

/** A card's charge: how many times it has drunk its own element (`true` is an old save's one). */
export const tileCharge = (tile: Pick<Tile, 'empowered'> | undefined): number =>
    tile?.empowered === true ? 1 : typeof tile?.empowered === 'number' && Number.isFinite(tile.empowered) ? Math.max(0, Math.floor(tile.empowered)) : 0;

export type ElementAlchemy = 'empowered' | 'neutralized';

const isElemental = (tile: Tile): boolean =>
    tile.suit != null && !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);

/** How a card answers `element` reaching it: drinks it, puts it out, or (null) lets it land. */
export const elementAlchemy = (tile: Tile, element: TileSuit): ElementAlchemy | null => {
    if (!isElemental(tile)) return null;
    if (tile.suit === element) return 'empowered';
    if (ELEMENT_NEUTRALIZES[tile.suit!] === element) return 'neutralized';
    return null;
};

/** The cards alchemy answered for, over a turn: drunk (and empowered) and neutralized. */
export interface AlchemyLog {
    empowered: string[];
    neutralized: string[];
}

export const createAlchemyLog = (): AlchemyLog => ({ empowered: [], neutralized: [] });

/**
 * Whether `element` acts on `tiles[index]`. When the card answers instead, the answer is logged and
 * a kin card is empowered (mutating `tiles`, like the realm's other steps), and this returns false.
 */
export const elementLands = (tiles: Tile[], index: number, element: TileSuit, log: AlchemyLog): boolean => {
    const tile = tiles[index];
    if (!tile) return false;
    const answer = elementAlchemy(tile, element);
    if (answer === null) return true;
    if (answer === 'empowered') {
        // One charge a card a turn, however many elements of its kind reach it.
        if (!log.empowered.includes(tile.id)) {
            tiles[index] = { ...tile, empowered: tileCharge(tile) + 1 };
            log.empowered.push(tile.id);
        }
    } else if (!log.neutralized.includes(tile.id)) {
        log.neutralized.push(tile.id);
    }
    return false;
};

/** Whether `element` would act on a card, without logging or empowering anything. */
export const elementWouldLand = (tile: Tile, element: TileSuit): boolean => elementAlchemy(tile, element) === null;

/**
 * A cast charges its own kind: every card of `element` among `indices` drinks it, acted on or not.
 * Returns the ids it charged.
 */
export const chargeKin = (tiles: Tile[], indices: readonly number[], element: TileSuit, log: AlchemyLog): string[] => {
    const charged: string[] = [];
    for (const index of indices) {
        const tile = tiles[index];
        if (!tile || elementAlchemy(tile, element) !== 'empowered' || log.empowered.includes(tile.id)) continue;
        elementLands(tiles, index, element, log);
        charged.push(tile.id);
    }
    return charged;
};

/** What the charged cards among `tiles` pay when they are matched: a gold for every `CHARGES_PER_GOLD` charges. */
export const empoweredMatchGold = (tiles: readonly Tile[]): number =>
    Math.floor(tiles.reduce((sum, tile) => sum + tileCharge(tile), 0) / CHARGES_PER_GOLD);
