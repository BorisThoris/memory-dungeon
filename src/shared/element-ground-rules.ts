import type { BoardState, RealmId, Tile, TileSuit } from './contracts';
import { ELEMENT_NAMES, tileCharge, type AlchemyLog } from './element-alchemy-rules';
import { elementReactionOf, type ElementReactionKind } from './element-resonance-rules';
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
    tide: 'The arena is wet: fire makes Steam, frost Ice bridges, grove Irrigation.',
    frost: 'The arena is frozen: fire makes Thaw, water Ice bridges, grove Frostbloom.',
    grove: 'The arena is fertile: fire makes Blaze, water Irrigation, frost Frostbloom.',
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
    tiles.filter((tile, index) => tile.state === 'hidden' && ground[index] === 'bone').map((tile) => tile.id);

export interface GroundCastResult {
    ground: (TileSuit | null)[];
    cells: number;
    touchedTileIds: string[];
    litTileIds: string[];
    gold: number;
    reaction: string | null;
    detail: string;
    quenchFire: boolean;
}

/**
 * Every elemental match writes its cells and their orthogonal neighbours, even on an empty board.
 * The nearest different patch reacts once per cast. Bare ground uses the arena's material; a
 * confluence uses its secondary material when the primary matches the cast. Written ground wins
 * over both. These are local reactions, independent of the stronger primed-streak reactions.
 * No random targeting, pair changes, new holds or extra turns. Effects share the alchemy ledger.
 */
export const castElementalGround = ({
    tiles, columns, ground: previous, groupTileIds, suit, realmId, secondaryId, alchemy
}: {
    tiles: Tile[];
    columns: number;
    ground: readonly (TileSuit | null)[];
    groupTileIds: readonly string[];
    suit: TileSuit;
    realmId: RealmId;
    secondaryId: RealmId | null;
    alchemy: AlchemyLog;
}): GroundCastResult => {
    const ground = tiles.map((_tile, index) => previous[index] ?? null);
    const sources = groupTileIds.map((id) => tiles.findIndex((tile) => tile.id === id)).filter((i) => i >= 0);
    const footprint = [...new Set([...sources, ...sources.flatMap((index) => orthogonalNeighbourIndices(index, Math.max(1, columns), tiles.length))])];
    const neighbours = footprint.filter((i) => tiles[i]?.state === 'hidden' && real(tiles[i]!));
    const touched = new Set<string>();
    const lit = new Set<string>();
    const notes: string[] = [];
    const gold = sources.some((i) => previous[i] === 'moss') ? 1 : 0;
    if (gold) notes.push('Roots harvested +1 gold');
    const primary = realmSuit(realmId);
    const substrate = primary === suit ? realmSuit(secondaryId) ?? primary : primary;
    // Source cells come first: players can deliberately match on an existing patch to choose chemistry.
    const met = footprint.map((i) => previous[i] ?? substrate).find((other) => other != null && other !== suit);
    const reaction = met ? elementReactionOf(suit, met) : null;
    for (const i of footprint) ground[i] = suit;

    const clear = (keys: readonly ('frost' | 'snowed' | 'vined' | 'bloom' | 'fuse')[]): number => {
        let count = 0;
        for (const i of neighbours) {
            const tile = tiles[i]!;
            if (!keys.some((key) => tile[key] != null)) continue;
            const next = { ...tile };
            for (const key of keys) delete next[key];
            tiles[i] = next;
            touched.add(tile.id);
            count += 1;
        }
        return count;
    };
    const reveal = (count: number): number => {
        for (const i of neighbours.slice(0, count)) lit.add(tiles[i]!.id);
        return Math.min(count, neighbours.length);
    };
    const charge = (count: number): number => {
        let charged = 0;
        // Like kin charging, at most one charge per card per turn, including casts and weather.
        for (const i of neighbours.filter((index) => !alchemy.empowered.includes(tiles[index]!.id)).slice(0, count)) {
            const tile = tiles[i]!;
            tiles[i] = { ...tile, empowered: tileCharge(tile) + 1 };
            alchemy.empowered.push(tile.id);
            touched.add(tile.id);
            charged += 1;
        }
        return charged;
    };
    const reactions: Record<ElementReactionKind, () => void> = {
        steam: () => { clear(['fuse']); const count = reveal(2); notes.push(count ? `Steam reveals ${count} nearby ${count === 1 ? 'face' : 'faces'}` : 'Steam settles on the ground'); },
        blaze: () => { const count = clear(['vined', 'bloom']); notes.push(count ? `Blaze clears ${count} nearby vines` : 'Blaze scorches the ground'); },
        melt: () => { const count = clear(['frost', 'snowed']); const shown = reveal(1); notes.push(`Thaw${count ? ` frees ${count} icy cards` : ' melts the ground'}${shown ? ' and reveals a face' : ''}`); },
        freezeover: () => {
            for (const i of footprint) ground[i] = 'bone';
            clear(['fuse']);
            notes.push('Ice bridges anchor this ground');
        },
        flood: () => {
            for (const i of footprint) ground[i] = 'moss';
            clear(['fuse']);
            const count = charge(1);
            notes.push(`Irrigation plants roots${count ? ' and charges a card' : ''}`);
        },
        frostbloom: () => { const count = charge(2); notes.push(count ? `Frostbloom charges ${count} nearby ${count === 1 ? 'card' : 'cards'}` : 'Frostbloom spreads across the ground'); }
    };
    if (reaction) reactions[reaction.kind]();

    if (realmId === 'storm' || secondaryId === 'storm') {
        if (reveal(1)) notes.push('Storm conducts a face reveal');
    }
    for (const id of lit) touched.add(id);
    const name = reaction?.kind === 'freezeover' ? 'Ice bridges' : reaction?.kind === 'flood' ? 'Irrigation' : reaction?.name ?? null;
    if (notes.length === 0) notes.push(suit === 'bone' ? 'Ice anchors the ground' : suit === 'moss' ? 'Roots planted for your next match' : `${ELEMENT_NAMES[suit]} ground spreads`);
    return { ground, cells: footprint.length, touchedTileIds: [...touched], litTileIds: [...lit], gold, reaction: name, detail: notes.join(' · '), quenchFire: reaction?.kind === 'steam' || reaction?.kind === 'melt' };
};
