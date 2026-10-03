import type { BoardState, RealmId, Tile, TileSuit } from './contracts';
import { ELEMENT_NAMES, type AlchemyLog } from './element-alchemy-rules';
import { elementReactionOf, resolveElementReaction, elementReactionSummary } from './element-resonance-rules';
import { SUIT_REALM } from './realm-sway-rules';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';

/** Ground is geometry, not a card status. A current carries the card, never the pool beneath it. */
export const ELEMENT_GROUND_RULES: Readonly<Record<TileSuit, string>> = {
    ember: 'Cinders react with later water or frost casts. Fire matches kindle vulnerable cards.',
    tide: 'Water casts douse fires and carry unanchored cards. Pools meet cinders for a Steam reveal.',
    bone: 'Ice anchors cards against elemental currents, wind and lightning. Cards can still be turned.',
    moss: 'Roots bear fruit: a later match on planted roots harvests one gold, at most once per turn.'
};

export const ARENA_GROUND_RULES: Readonly<Record<RealmId, string>> = {
    ember: 'The arena is hot: water makes Steam, frost Thaw, grove Blaze.',
    tide: 'The arena is wet: fire makes Steam, frost Freeze-over, grove Flood.',
    frost: 'The arena is frozen: fire makes Thaw, water Freeze-over, grove Frostbloom.',
    grove: 'The arena is fertile: fire makes Blaze, water Flood, frost Frostbloom.',
    storm: 'The arena conducts every cast: one nearby face flashes into view.'
};

const SUITS: readonly TileSuit[] = ['ember', 'tide', 'bone', 'moss'];
const realmSuit = (realm: RealmId | null): TileSuit | null => SUITS.find((suit) => SUIT_REALM[suit] === realm) ?? null;
const real = (tile: Tile): boolean => !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);

/** Also supplies the empty field for old/authored boards. Ignore malformed or excess cells. */
export const readElementalGround = (board: Pick<BoardState, 'tiles' | 'elementalGround'>): (TileSuit | null)[] =>
    board.tiles.map((_tile, index) => {
        const suit = board.elementalGround?.[index];
        return suit && SUITS.includes(suit) ? suit : null;
    });

export const groundAnchoredTileIds = (tiles: readonly Tile[], ground: readonly (TileSuit | null)[]): string[] =>
    tiles.filter((tile, index) => tile.state === 'hidden' && (ground[index] === 'bone' || tile.rime)).map((tile) => tile.id);

export interface GroundCastResult {
    ground: (TileSuit | null)[];
    cells: number;
    touchedTileIds: string[];
    litTileIds: string[];
    gold: number;
    score: number;
    stillTurns: number;
    resonanceGain: number;
    reactionElements: readonly TileSuit[];
    reaction: string | null;
    detail: string;
    quenchFire: boolean;
}

/**
 * Every elemental match writes its cells and their orthogonal neighbours, even on an empty board.
 * Only ground under the matched cards chooses chemistry, in board order. Bare ground uses the arena material; a
 * confluence uses its secondary material when the primary matches the cast. Written ground wins
 * over both. Local and primed reactions use one recipe; local chemistry has power 1 and a smaller footprint.
 * No random targeting, pair changes, new holds or extra turns. Effects share the alchemy ledger.
 */
export const castElementalGround = ({
    tiles, columns, ground: previous, groupTileIds, reactionTileIds = groupTileIds, suit, realmId, secondaryId, alchemy
}: {
    tiles: Tile[];
    columns: number;
    ground: readonly (TileSuit | null)[];
    groupTileIds: readonly string[];
    /** The player-selected pair chooses chemistry; extra burst pairs only extend the paint. */
    reactionTileIds?: readonly string[];
    suit: TileSuit;
    realmId: RealmId;
    secondaryId: RealmId | null;
    alchemy: AlchemyLog;
}): GroundCastResult => {
    const ground = tiles.map((_tile, index) => previous[index] ?? null);
    const sources = groupTileIds.map((id) => tiles.findIndex((tile) => tile.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
    const footprint = [...new Set([...sources, ...sources.flatMap((index) => orthogonalNeighbourIndices(index, Math.max(1, columns), tiles.length))])];
    const neighbours = footprint.filter((i) => tiles[i]?.state === 'hidden' && real(tiles[i]!));
    const touched = new Set<string>();
    const lit = new Set<string>();
    const notes: string[] = [];
    let gold = sources.some((i) => previous[i] === 'moss') ? 1 : 0;
    if (gold) notes.push('Roots harvested +1 gold');
    const primary = realmSuit(realmId);
    const substrate = primary === suit ? realmSuit(secondaryId) ?? primary : primary;
    const origins = reactionTileIds.map(id => tiles.findIndex(tile => tile.id === id)).filter(i => i >= 0).sort((a, b) => a - b);
    const met = origins.map((i) => previous[i] ?? substrate).find((other) => other != null && other !== suit);
    const reaction = met ? elementReactionOf(suit, met) : null;
    for (const i of footprint) ground[i] = suit;

    const chemistry = reaction ? resolveElementReaction(reaction.kind, 1, tiles, neighbours, alchemy) : null;
    if (chemistry) {
        gold += chemistry.gold;
        for (const id of chemistry.touchedTileIds) touched.add(id);
        for (const id of chemistry.litTileIds) lit.add(id);
        notes.push(`${ELEMENT_NAMES[suit]} + ${ELEMENT_NAMES[met!]} ground → ${reaction!.name}: ${elementReactionSummary(reaction!.kind, 1)}`);
        if (reaction!.kind === 'freezeover') for (const i of footprint) ground[i] = 'bone';
        if (reaction!.kind === 'flood') for (const i of footprint) ground[i] = 'moss';
    }

    if (realmId === 'storm' || secondaryId === 'storm') {
        const index = neighbours.find(i => !lit.has(tiles[i]!.id));
        if (index != null) { lit.add(tiles[index]!.id); notes.push('Storm reveals an extra face'); }
    }
    for (const id of lit) touched.add(id);
    const name = reaction?.name ?? null;
    if (notes.length === 0) notes.push(suit === 'bone' ? 'Ice anchors the ground' : suit === 'moss' ? 'Roots planted for your next match' : `${ELEMENT_NAMES[suit]} ground spreads`);
    return { ground, cells: footprint.length, touchedTileIds: [...touched], litTileIds: [...lit], gold, score: chemistry?.score ?? 0, stillTurns: chemistry?.stillTurns ?? 0, resonanceGain: chemistry?.resonanceGain ?? 0, reactionElements: reaction?.elements ?? [], reaction: name, detail: notes.join(' · '), quenchFire: reaction?.kind === 'steam' || reaction?.kind === 'melt' };
};
