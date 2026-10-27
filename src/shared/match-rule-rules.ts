import type { BoardState, FloorTag, RunState, Tile, TileSuit } from './contracts';
import { descentActForLevel, actLevelsFor, pickFloorScheduleEntry } from './floor-mutator-schedule';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Match rules (rules 94, 2026-10-25): some floors change what makes a pair.
 *
 * The owner, after rules 89-93: "we get more powerups but the core mechanic stays the same without any
 * changes, so it feels like it's the same". Every addition so far sat on top of the one core turn - two
 * cards, same picture, gone. A match rule is a room property instead: on its floor the core turn itself
 * reads differently, told on the board crown before the first flip. Each act of a run has one such floor
 * (the Gate's on floor 4 or 5, every other act's on one of its plain floors), drawn from the run's seed,
 * so a run meets a changed core inside the floors real players reach.
 *
 * The first rule is **Opposites**: every pair is one picture in two opposite elements - ember with tide,
 * moss with bone. One card of each pair shows its opposite on its back and its face; the card is its true
 * element to everything it does (what it casts, what it pops, how it reacts), as a mask is. On every other
 * floor a back's colour says "your partner wears this colour too"; here it says "your partner wears the
 * other one". The deduction a player has built over the run turns over.
 */
export const MATCH_RULES_FROM = 94;

export type MatchRuleId = 'opposites' | 'element_pairs' | 'triples' | 'sequences';
export const MATCH_RULES: readonly MatchRuleId[] = ['opposites'];

/**
 * **Element pairs** (rules 95): on its floor any two plain cards of one element are a pair - the picture does
 * not matter, and the backs keep their element to themselves, so a player remembers colours seen face up
 * rather than pictures. A card that carries something of its own (a Wanderer, a mask, a Sleeper, an odd card,
 * the cursed, warded or bounty pair) keeps its own partner. When two plain cards of different pairs meet,
 * their pair keys trade with their old partners' (`rekeyElementPair`), so every rule still sees whole pairs.
 */
export const ELEMENT_PAIRS_FROM = 95;
/**
 * **Triples** (rules 96): on its floor some pictures come in threes. Two of a three turned up stay face up and
 * the turn goes on to a third card: the third of the picture claims all three as one match; any other card is a
 * miss, and all three turn back. Three plain pairs are dealt as two threes - one pair's two cards take the other
 * two pictures - so the floor keeps its cards and its count of sets drops by one for every three dealt
 * (`board.pairCount`). A three is a plain picture only: no card that carries something of its own is dealt into one.
 */
export const TRIPLES_FROM = 96;

/**
 * **Sequences** (rules 97): Triples in order, past the Gate. Each card of a three wears one, two or three pips on
 * its back - its place in the three - and the three is claimed only turned one, two, three. A two turned before
 * the one, or a three before the two, is a miss at once. The back says where a card stands, never its picture:
 * a player turns a one, and must remember which two wears that picture.
 */
export const SEQUENCES_FROM = 97;

/** How many cards a pair key holds on this board: three on a Triples floor's threes, two everywhere else. */
export const setSizeFor = (board: Pick<BoardState, 'tripleKeys'>, pairKey: string): number =>
    (board.tripleKeys ?? []).includes(pairKey) ? 3 : 2;

export const isTripleKey = (board: Pick<BoardState, 'tripleKeys'>, pairKey: string): boolean => setSizeFor(board, pairKey) === 3;

/** Deals Triples: about half of the floor's plain pairs, three at a time, made two threes. */
export const dealTriples = (board: BoardState, runSeed: number): BoardState => {
    const rng = createMulberry32(hashStringToSeed(`triples:${runSeed}:${board.level}`));
    const halves = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        // Nothing the realm holds or marks either: a frozen or vined cohort is whole pairs (`realm-hold-policy.ts`).
        const marked = Boolean(tile.frost || tile.vined || tile.snowed || tile.fuse || tile.rime || tile.seeded);
        if (tile.state === 'hidden' && tile.tileTraitKind == null && !marked && isElementPairable(board, tile)) halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), index]);
    });
    const pool = [...halves.entries()].filter(([key, indices]) => indices.length === 2 && board.tiles.filter((tile) => tile.pairKey === key).length === 2);
    // Shuffled from the seed, then dealt three pairs at a time.
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = pickRngIndex(rng, i + 1);
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const groups = Math.max(pool.length >= 3 ? 1 : 0, Math.floor(pool.length / 6));
    if (groups === 0) return board;
    const tiles = [...board.tiles];
    const tripleKeys: string[] = [];
    for (let g = 0; g < groups; g += 1) {
        const [[keyA, a], [keyB, b], [, given]] = pool.slice(g * 3, g * 3 + 3) as [string, number[]][];
        const takeLook = (index: number, from: number) => {
            const source = tiles[from]!;
            tiles[index] = { ...tiles[index]!, pairKey: source.pairKey, symbol: source.symbol, label: source.label, suit: source.suit, edition: source.edition, atomicVariant: source.atomicVariant };
        };
        takeLook(given![0]!, a![0]!);
        takeLook(given![1]!, b![0]!);
        tripleKeys.push(keyA!, keyB!);
    }
    // Every card of a three wears its mark on its back (`Tile.three`): a player knows a three is there, not its picture.
    const marked = tiles.map((tile) => (tripleKeys.includes(tile.pairKey) ? { ...tile, three: true } : tile));
    return { ...board, tiles: marked, tripleKeys, pairCount: board.pairCount - groups, matchRule: 'triples' };
};

/** Deals Sequences: Triples' threes, each card given its place in the three's order from the seed. */
export const dealSequences = (board: BoardState, runSeed: number): BoardState => {
    const dealt = dealTriples(board, runSeed);
    if (dealt === board) return board;
    const rng = createMulberry32(hashStringToSeed(`sequences:${runSeed}:${board.level}`));
    const places = new Map<string, (1 | 2 | 3)[]>();
    for (const key of dealt.tripleKeys ?? []) {
        const order: (1 | 2 | 3)[] = [1, 2, 3];
        for (let i = order.length - 1; i > 0; i -= 1) {
            const j = pickRngIndex(rng, i + 1);
            [order[i], order[j]] = [order[j]!, order[i]!];
        }
        places.set(key, order);
    }
    const tiles = dealt.tiles.map((tile) => {
        const order = places.get(tile.pairKey);
        return order ? { ...tile, seq: order.shift()! } : tile;
    });
    return { ...dealt, tiles, matchRule: 'sequences' };
};

const matchRulesFor = (rulesVersion: number, actId?: string): readonly MatchRuleId[] =>
    rulesVersion >= SEQUENCES_FROM && actId !== 'gate'
        ? ['opposites', 'element_pairs', 'triples', 'sequences']
        : rulesVersion >= TRIPLES_FROM ? ['opposites', 'element_pairs', 'triples'] : rulesVersion >= ELEMENT_PAIRS_FROM ? ['opposites', 'element_pairs'] : MATCH_RULES;

export const OPPOSITE_SUIT: Readonly<Record<TileSuit, TileSuit>> = { ember: 'tide', tide: 'ember', moss: 'bone', bone: 'moss' };

/** The first Gate floor a match rule may take: after the three authored floors. */
export const MATCH_RULE_GATE_FLOORS: readonly number[] = [4, 5];

/** Which plain floor of its act a run's match rule takes: one per act, from the run's seed. */
export const matchRuleFloorFor = (runSeed: number, rulesVersion: number, level: number): number | null => {
    if (rulesVersion < MATCH_RULES_FROM) return null;
    const act = descentActForLevel(level, rulesVersion);
    const { firstLevel, lastLevel } = actLevelsFor(act, rulesVersion);
    // The Gate's from its fourth floor; every other act's from its second, short of its boss.
    const span = act.id === 'gate' ? [...MATCH_RULE_GATE_FLOORS] : Array.from({ length: Math.max(0, lastLevel - firstLevel - 1) }, (_, i) => firstLevel + 1 + i);
    // Only a plain floor: a boss, a breather or a Spiral keeps its own rules.
    const candidates = span.filter((floor) => {
        const entry = pickFloorScheduleEntry(runSeed, rulesVersion, floor, 'endless');
        return entry.floorTag === 'normal' && entry.floorArchetypeId !== 'spiral_hall';
    });
    if (candidates.length === 0) return null;
    return candidates[pickRngIndex(createMulberry32(hashStringToSeed(`matchRuleFloor:${runSeed}:${act.id}`)), candidates.length)]!;
};

/** The match rule a floor is dealt with, if any: never a boss floor, a breather or past the Descent. */
export const matchRuleFor = (runSeed: number, rulesVersion: number, level: number, floorTag: FloorTag | null | undefined, descentLength: number): MatchRuleId | null => {
    if (rulesVersion < MATCH_RULES_FROM || level > descentLength || floorTag === 'boss' || floorTag === 'breather') return null;
    if (matchRuleFloorFor(runSeed, rulesVersion, level) !== level) return null;
    // Sequences waits past the Gate: a run meets Triples before it meets them in order.
    const pool = matchRulesFor(rulesVersion, descentActForLevel(level, rulesVersion).id);
    return pool[pickRngIndex(createMulberry32(hashStringToSeed(`matchRule:${runSeed}:${level}`)), pool.length)]!;
};

const isOppositeCandidate = (tile: Tile): tile is Tile & { suit: TileSuit } =>
    tile.suit != null && !isSingletonUtilityPairKey(tile.pairKey) && tile.mask == null && tile.turncoat == null && tile.shownSuit == null;

/** Deals Opposites: one card of every two-card pair, chosen from the seed, shows its opposite element. */
export const dealOpposites = (board: BoardState, runSeed: number): BoardState => {
    const rng = createMulberry32(hashStringToSeed(`opposites:${runSeed}:${board.level}`));
    const halves = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        if (isOppositeCandidate(tile)) halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), index]);
    });
    const tiles = [...board.tiles];
    let dealt = 0;
    for (const indices of halves.values()) {
        if (indices.length !== 2) continue;
        const index = indices[pickRngIndex(rng, 2)]!;
        const tile = tiles[index]!;
        tiles[index] = { ...tile, shownSuit: OPPOSITE_SUIT[tile.suit!] };
        dealt += 1;
    }
    return dealt === 0 ? board : { ...board, tiles, matchRule: 'opposites' };
};

/** Deals a floor's match rule onto its board. Element pairs changes no card: the floor's rule is the deal. */
export const dealMatchRule = (board: BoardState, rule: MatchRuleId | null, runSeed: number): BoardState => {
    if (rule == null) return board;
    // A floor dealt two decks deep (`board-layers-rules.ts`) keeps a partner beneath: it takes Opposites instead.
    if (rule === 'opposites' || (board.beneath ?? []).some((card) => card != null)) return dealOpposites(board, runSeed);
    if (rule === 'triples' || rule === 'sequences') {
        // A floor with too few plain pairs for a three takes Opposites as well.
        const dealt = rule === 'sequences' ? dealSequences(board, runSeed) : dealTriples(board, runSeed);
        return dealt === board ? dealOpposites(board, runSeed) : dealt;
    }
    return { ...board, matchRule: 'element_pairs' };
};

/** A card an Element pairs floor may pair by its element: a plain card, carrying nothing of its own. */
export const isElementPairable = (board: Pick<BoardState, 'cursedPairKey' | 'wardPairKey' | 'bountyPairKey'>, tile: Tile): boolean =>
    tile.suit != null &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.mask == null &&
    tile.shownSuit == null &&
    tile.turncoat == null &&
    tile.hourglass == null &&
    !tile.wanderer &&
    !tile.sleeper &&
    tile.findableKind == null &&
    tile.pairKey !== board.cursedPairKey &&
    tile.pairKey !== board.wardPairKey &&
    tile.pairKey !== board.bountyPairKey;

/** Whether two face-up cards are a pair on this board: the plain rule, or two plain cards of one element on Element pairs. */
export const tilesMatchOnBoard = (board: BoardState, a: Tile, b: Tile, plainMatch: (a: Tile, b: Tile) => boolean): boolean =>
    plainMatch(a, b) ||
    (board.matchRule === 'element_pairs' &&
        a.id !== b.id &&
        a.suit === b.suit &&
        isElementPairable(board, a) &&
        isElementPairable(board, b) &&
        // Both old partners on the board, face down and plain too: the two left behind must be able to become a
        // pair, and a mark on a partner (a mask is on one card of its pair) must not travel to another pair.
        [a, b].every((card) => board.tiles.some((tile) => tile.pairKey === card.pairKey && tile.id !== card.id && tile.state === 'hidden' && isElementPairable(board, tile))));

/**
 * Two plain cards of one element, of different pairs, made one pair: `b` takes `a`'s key and `a`'s old partner
 * takes `b`'s, so the two left behind are a pair of the same element too. A board where they already share a
 * key, or where either partner is missing, is handed back as it was.
 */
export const rekeyElementPair = (board: BoardState, aId: string, bId: string): BoardState => {
    const a = board.tiles.find((tile) => tile.id === aId);
    const b = board.tiles.find((tile) => tile.id === bId);
    if (!a || !b || a.pairKey === b.pairKey) return board;
    const aPartner = board.tiles.find((tile) => tile.pairKey === a.pairKey && tile.id !== a.id);
    if (!aPartner) return board;
    const [keyA, keyB] = [a.pairKey, b.pairKey];
    return {
        ...board,
        tiles: board.tiles.map((tile) => (tile.id === b.id ? { ...tile, pairKey: keyA } : tile.id === aPartner.id ? { ...tile, pairKey: keyB } : tile))
    };
};

/**
 * The three a turn is waiting on: two face-up cards of one Triples key, the third still to turn. On Sequences only
 * a one then a two wait; two of a three turned out of order wait for nothing - the turn is a miss.
 */
export const pendingTripleKey = (board: Pick<BoardState, 'tripleKeys' | 'tiles' | 'flippedTileIds'> | null | undefined): string | null => {
    if (!board || !Array.isArray(board.flippedTileIds) || board.flippedTileIds.length !== 2) return null;
    const [a, b] = board.flippedTileIds.map((id) => board.tiles.find((tile) => tile.id === id));
    if (!a || !b || a.pairKey !== b.pairKey || !isTripleKey(board, a.pairKey)) return null;
    return a.seq == null || (a.seq === 1 && b.seq === 2) ? a.pairKey : null;
};

/** A three's cards in the order they claim: by their place on Sequences, as given on Triples. */
export const inSequenceOrder = <T extends Pick<Tile, 'seq'>>(cards: readonly T[]): T[] => [...cards].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

/**
 * For a simulated player (the soak, the survival and balance sims): turns the third card of a three the turn
 * is waiting on. It turns the three's own third when it `knows` where that is (always, given no `knows`);
 * otherwise (given an `rng`) a hidden card it picks, which may be the third by luck. A turn not waiting on a three is
 * handed back as it was.
 */
export const turnTripleThird = (run: RunState, flip: (run: RunState, tileId: string) => RunState, knows?: (tile: Tile) => boolean, rng?: () => number): RunState => {
    const key = pendingTripleKey(run.board);
    if (key == null || !run.board) return run;
    const hidden = run.board.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));
    const third = hidden.find((tile) => tile.pairKey === key);
    const guess = knows && rng && third && !knows(third) && hidden.length > 0;
    const card = guess ? hidden[pickRngIndex(rng, hidden.length)] : third;
    return card ? flip(run, card.id) : run;
};
