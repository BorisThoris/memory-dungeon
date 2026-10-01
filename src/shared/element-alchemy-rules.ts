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
 * - **Kin, empowered.** An element does not act on a card made of it: the card drinks it instead
 *   and is empowered (`Tile.empowered`). Fire does not burn a fire card, frost does not freeze a
 *   frost card, vines do not hold a grove card, water does not carry a water card off. An empowered
 *   card pays `EMPOWERED_MATCH_GOLD` when it is matched, and it glows until then.
 * - **Counter, neutralized.** Each element puts out one other (`ELEMENT_NEUTRALIZES`): water puts
 *   out fire, fire melts frost, frost kills growth, and roots hold against water. That element
 *   reaching the card is snuffed on contact and does nothing.
 * - Anything else lands as it always did.
 *
 * So every card is immune to two of the four elements and open to the other two, and a player who
 * can read a card's material can read what the weather can do to it. The storm is no element: its
 * lightning moves cards of every kind.
 *
 * Alchemy answers an element only where it would have acted: a fire burning vines off cards
 * meets only the cards it would have cleared, a hold meets the one card it would have held (and is
 * spent on it, neutralized or drunk, rather than passing on to the next card), and a current meets
 * the cards it would have moved. A card that only stood in reach is not touched.
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

/** Gold an empowered card pays when it is matched. */
export const EMPOWERED_MATCH_GOLD = 1;

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
        if (tile.empowered !== true) tiles[index] = { ...tile, empowered: true };
        if (!log.empowered.includes(tile.id)) log.empowered.push(tile.id);
    } else if (!log.neutralized.includes(tile.id)) {
        log.neutralized.push(tile.id);
    }
    return false;
};

/** Whether `element` would act on a card, without logging or empowering anything. */
export const elementWouldLand = (tile: Tile, element: TileSuit): boolean => elementAlchemy(tile, element) === null;

/** What the empowered cards among `tiles` pay when they are matched. */
export const empoweredMatchGold = (tiles: readonly Tile[]): number =>
    tiles.filter((tile) => tile.empowered === true).length * EMPOWERED_MATCH_GOLD;
