import { REALM_IDS, type BoardState, type RealmId, type Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * Omens: the environment cards.
 *
 * From the third floor on, one pair on every realm board is an omen of another realm. It is an
 * ordinary pair to find and match - its faces carry the omen's sigil once turned - and matching it
 * sets off a reaction: the floor's realm becomes the omen's realm for the rest of the floor, what
 * the old realm left on the board goes (frozen cards thaw, fires go out, vines fall, each paying a
 * gold as it goes), and the new weather starts on the next turn. Two reactions do more than clear:
 * wildfire through a grove sets every vine alight, and a storm breaking strikes at once.
 *
 * The reaction is the player's lever on the environment. The omen has to be matched to finish the
 * floor, so the choice is when: early, to get out of weather that is hurting; late, to keep weather
 * that is paying; or at all, for the route - the travel doors always offer the realm a floor
 * ended in.
 */

/** The floor omens first appear on: the first two are small enough that one pair is a third of them. */
export const OMEN_FIRST_FLOOR = 3;

/** What a reaction between two realms is called. */
export const REALM_REACTION_NAMES: Readonly<Record<RealmId, Readonly<Record<RealmId, string>>>> = {
    frost: { frost: 'Deep Freeze', ember: 'Thaw', tide: 'Meltwater', storm: 'Hailstorm', grove: 'First Spring' },
    ember: { frost: 'Quench', ember: 'Flare', tide: 'Steam', storm: 'Firestorm', grove: 'Ashbloom' },
    tide: { frost: 'Freeze-over', ember: 'Boil', tide: 'Surge', storm: 'Downpour', grove: 'Mire' },
    storm: { frost: 'Whiteout', ember: 'Kindled Sky', tide: 'Deluge', storm: 'Squall', grove: 'Thornstorm' },
    grove: { frost: 'Frostbloom', ember: 'Wildfire', tide: 'Flood', storm: 'Green Lightning', grove: 'Overrun' }
};

export const realmReactionName = (from: RealmId, to: RealmId): string => REALM_REACTION_NAMES[from][to];

const omenCandidatePairKeys = (board: BoardState): string[] => {
    const counts = new Map<string, number>();
    for (const tile of board.tiles) {
        if (
            tile.state === 'hidden' &&
            !isSingletonUtilityPairKey(tile.pairKey) &&
            tile.findableKind == null &&
            tile.tileTraitKind == null
        ) {
            counts.set(tile.pairKey, (counts.get(tile.pairKey) ?? 0) + 1);
        }
    }
    return [...counts.entries()].filter(([, count]) => count === 2).map(([key]) => key).sort();
};

/** Seats the floor's omen: one plain pair carries another realm's sigil. Seeded per run and floor. */
export const seatRealmOmen = (
    board: BoardState,
    realmId: RealmId | null,
    runSeed: number,
    rulesVersion: number
): BoardState => {
    if (!realmId || board.level < OMEN_FIRST_FLOOR) {
        return board;
    }
    const keys = omenCandidatePairKeys(board);
    if (keys.length < 2) {
        return board;
    }
    const rng = createMulberry32(hashStringToSeed(`realm-omen:${Math.floor(runSeed)}:${rulesVersion}:${board.level}`));
    const pairKey = keys[pickRngIndex(rng, keys.length)]!;
    const elements = REALM_IDS.filter((id) => id !== realmId);
    const omen = elements[pickRngIndex(rng, elements.length)]!;
    return {
        ...board,
        tiles: board.tiles.map((tile): Tile => (tile.pairKey === pairKey ? { ...tile, omen } : tile))
    };
};

/** The omen a matched pair carries, if it is one that would change the realm. */
export const omenOfMatch = (tiles: readonly Tile[], current: RealmId | null): RealmId | null => {
    const omen = tiles.find((tile) => tile.omen != null)?.omen ?? null;
    return omen && omen !== current ? omen : null;
};
