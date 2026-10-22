import { preferredDrawIndex } from './learned-rule-rules';
import type { BoardState, RunState, SleepingPair, Tile, TileSuit } from './contracts';
import { isRealmHeld } from './odd-card-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Sleepers (DGE-020, rules 84): the Abyss's card family, pairs that come back.
 *
 * From floor 41, two pairs a floor (three from floor 51) are Sleepers. Matched on a chain of three or
 * more, a Sleeper stays down. Matched on less, it sleeps: four turns later it returns face down, in
 * two other cleared cells, and must be found and matched again. Clearing fast is the only way to
 * clear at all. A board cleared with a Sleeper still asleep wakes it at once, so the floor always has
 * a way to finish (`floor-clear-transition.ts`). A Sleeper matched while a Hold is held wakes out of the
 * Hold: a card back in play is no held seed.
 *
 * The plan marked Sleepers on the back. The owner's rule for face-down cards (`player-visible-board.ts`:
 * nothing set apart before a flip) outranks it: a Sleeper is a Sleeper on its face only, as a Wanderer
 * is. The plan's Dread price (9) is a floor count here, as for the Masks.
 */
export const SLEEPER_RULES_FROM = 84;
export const SLEEPER_FROM_FLOOR = 41;
export const SLEEPER_THIRD_FLOOR = 51;
export const SLEEPER_WAKE_TURNS = 4;
/** The chain a Sleeper's match must reach to keep it down. */
export const SLEEPER_CHAIN_HOLDS = 3;
export const SLEEPER_MIN_PAIRS = 8;

export const sleepersForFloor = (level: number): number => (level >= SLEEPER_THIRD_FLOOR ? 3 : level >= SLEEPER_FROM_FLOOR ? 2 : 0);

const isPlainPair = (pair: readonly Tile[]): boolean =>
    pair.length === 2 && pair.every((tile) => tile.state === 'hidden' && tile.suit != null && tile.turncoat == null && !tile.wanderer && !tile.sleeper && !isRealmHeld(tile));

/** Deals the floor's Sleepers onto plain pairs, from the run's seed. */
export const dealSleepers = (
    board: BoardState,
    { runSeed, rulesVersion, preferSuit = null }: { runSeed: number; rulesVersion: number; preferSuit?: TileSuit | null }
): BoardState => {
    const wanted = sleepersForFloor(board.level);
    if (rulesVersion < SLEEPER_RULES_FROM || wanted === 0 || board.pairCount < SLEEPER_MIN_PAIRS) return board;
    const marked = new Set([board.cursedPairKey, board.wardPairKey, board.bountyPairKey]);
    const halves = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), tile]);
    }
    const pool = [...halves.entries()].filter(([pairKey, pair]) => !marked.has(pairKey) && isPlainPair(pair)).map(([pairKey]) => pairKey);
    const rng = createMulberry32(hashStringToSeed(`sleepers:${runSeed}:${rulesVersion}:${board.level}`));
    const chosen = new Set<string>();
    while (chosen.size < wanted && pool.length > 0) {
        // A learned rule (`learned-rule-rules.ts`) draws from its element's pairs first.
        const [pairKey] = pool.splice(preferredDrawIndex(pool, rng, preferSuit ? (key) => halves.get(key)?.[0]?.suit === preferSuit : null), 1);
        if (pairKey) chosen.add(pairKey);
    }
    if (chosen.size === 0) return board;
    return { ...board, tiles: board.tiles.map((tile) => (chosen.has(tile.pairKey) ? { ...tile, sleeper: true } : tile)) };
};

/** A woken pair leaves the Hold (`hold-rules.ts`): a card back in play is no held seed. */
const withoutWokenSeeds = (heldSeedIds: readonly string[] | undefined, board: BoardState, pairKeys: ReadonlySet<string>): string[] =>
    (heldSeedIds ?? []).filter((id) => !pairKeys.has(board.tiles.find((tile) => tile.id === id)?.pairKey ?? ''));

/** Whether this many turns into the floor wakes a sleeping pair. */
const awake = (pair: SleepingPair, turns: number): boolean => turns >= pair.wakeTurn;

/**
 * A sleeping pair returns: its two cards, face down, into two other cleared cells (the cards there take
 * the Sleeper's old cells). With fewer than two other cleared cells it returns where it was.
 */
export const wakeSleeper = (board: BoardState, pairKey: string, seed: string, keepIds: ReadonlySet<string> = new Set()): BoardState => {
    const rng = createMulberry32(hashStringToSeed(seed));
    const tiles = [...board.tiles];
    const own = tiles.flatMap((tile, index) => (tile.pairKey === pairKey ? [index] : []));
    // A Sleeper whose card a Spiral's ring sealed (`spiral-rules.ts`) is off the board: it stays down.
    // Nothing to wake when its cards are not gone (a Zone settled them face down) or are off the board.
    if (own.length !== 2 || own.some((cell) => tiles[cell]!.sealed || (tiles[cell]!.state !== 'matched' && tiles[cell]!.state !== 'removed'))) return board;
    const free = tiles.flatMap((tile, index) =>
        tile.pairKey !== pairKey && (tile.state === 'matched' || tile.state === 'removed') && !tile.sealed && !keepIds.has(tile.id) ? [index] : []
    );
    for (const from of own) {
        const to = free.length >= own.length ? free.splice(pickRngIndex(rng, free.length), 1)[0]! : from;
        const sleeper = { ...tiles[from]!, state: 'hidden' as const };
        if (to !== from) tiles[from] = tiles[to]!;
        tiles[to] = sleeper;
    }
    return { ...board, tiles, matchedPairs: Math.max(0, runNonNegativeInteger(board.matchedPairs) - 1) };
};

/** Every sleeping pair woken now (a board cleared with a Sleeper asleep: `finalizeLevel`). */
export const wakeAllSleepers = (run: RunState, board: BoardState): { run: RunState; board: BoardState } => {
    const sleeping = run.sleepingPairs ?? [];
    let next = board;
    let woken = 0;
    sleeping.forEach((pair, index) => {
        const waking = wakeSleeper(next, pair.pairKey, `sleeper-wake:${run.runSeed}:${run.runRulesVersion}:${board.level}:${pair.pairKey}:${index}:clear`, new Set(run.heldSeedIds ?? []));
        if (waking !== next) woken += 1;
        next = waking;
    });
    const heldSeedIds = withoutWokenSeeds(run.heldSeedIds, board, new Set(sleeping.map((pair) => pair.pairKey)));
    return { run: { ...run, heldSeedIds, sleepingPairs: [], sleepersWokenThisFloor: runNonNegativeInteger(run.sleepersWokenThisFloor) + woken }, board: next };
};

/**
 * Applied after every resolved turn: a Sleeper matched this turn sleeps, unless its match reached the
 * chain that holds it down; a Sleeper whose four turns are up wakes.
 */
export const applySleeperTurn = (before: RunState, after: RunState): RunState => {
    if ((after.runRulesVersion ?? 0) < SLEEPER_RULES_FROM || !before.board || !after.board || after.board.level !== before.board.level) return after;
    if (after.status !== 'playing') return after;
    const turns = runNonNegativeInteger(after.turnsThisFloor);
    if (turns === runNonNegativeInteger(before.turnsThisFloor)) return after;
    const wasMatched = new Set(before.board.tiles.filter((tile) => tile.state === 'matched').map((tile) => tile.id));
    const newlyMatched = [...new Set(after.board.tiles.filter((tile) => tile.sleeper && tile.state === 'matched' && !wasMatched.has(tile.id)).map((tile) => tile.pairKey))];
    const chained = runNonNegativeInteger(after.stats.currentStreak) >= SLEEPER_CHAIN_HOLDS;
    let sleeping = [...(after.sleepingPairs ?? [])];
    let keptDown = runNonNegativeInteger(after.sleepersKeptDownThisFloor);
    for (const pairKey of newlyMatched) {
        if (chained) keptDown += 1;
        else sleeping.push({ pairKey, wakeTurn: turns + SLEEPER_WAKE_TURNS });
    }
    let board = after.board;
    let woken = runNonNegativeInteger(after.sleepersWokenThisFloor);
    const keep = new Set(after.heldSeedIds ?? []);
    const wokenKeys = new Set<string>();
    sleeping = sleeping.filter((pair, index) => {
        if (!awake(pair, turns)) return true;
        const next = wakeSleeper(board, pair.pairKey, `sleeper-wake:${after.runSeed}:${after.runRulesVersion}:${board.level}:${pair.pairKey}:${turns}:${index}`, keep);
        // A Sleeper a Spiral sealed (`spiral-rules.ts`) does not come back: it is kept down.
        if (next === board) keptDown += 1;
        else {
            wokenKeys.add(pair.pairKey);
            woken += 1;
        }
        board = next;
        return false;
    });
    if (newlyMatched.length === 0 && woken === runNonNegativeInteger(after.sleepersWokenThisFloor) && keptDown === runNonNegativeInteger(after.sleepersKeptDownThisFloor) && sleeping.length === (after.sleepingPairs ?? []).length) return after;
    const heldSeedIds = wokenKeys.size > 0 ? withoutWokenSeeds(after.heldSeedIds, after.board, wokenKeys) : after.heldSeedIds;
    return { ...after, board, heldSeedIds, sleepingPairs: sleeping, sleepersWokenThisFloor: woken, sleepersKeptDownThisFloor: keptDown };
};
