import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { grantMisses, missBankCap } from './miss-bank';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isTileFlipBlocked } from './realm-weather-rules';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';

/**
 * **The crawl** (prototype, 2026-10-28; `?crawl=1`). The owner, after rules 100-103: "its still just the same
 * mechanic of match 2 pairs. It gets boring", and asked for a second verb beside memory - the hero walks the
 * board, and the monsters on it fight back. Both together.
 *
 * - The board is the dungeon. A card turned and matched leaves open floor. The **hero** stands on a cell and
 *   holds the open floor joined to it; a turn's first card must touch that ground (the second card is free:
 *   memory still finds the partner). A match moves the hero onto the partner's cell - where the partner lay
 *   is where you go next.
 * - **Monsters** stand on cards. Each strikes the hero's **health** when its count runs out, then counts again.
 *   Turning a monster's card stabs it for one; a match hurts every monster touching either matched card (an
 *   Ember match burns for two); matching a monster's own card kills it. A kill pays gold.
 * - Health is not the miss bank: misses still spend the bank, and a hero at no health is slain.
 */
export const CRAWL_HEALTH = 8;
export const CRAWL_HEAL_PER_FLOOR = 3;
export const CRAWL_STRIKE_EVERY = 5;
export const CRAWL_HEAL_PER_KILL = 1;
/** A kill also wins back a miss, good for the miss bank's three floors (`miss-bank.ts`). */
export const CRAWL_MISSES_PER_KILL = 1;
export const CRAWL_PAIRS_PER_MONSTER = 8;
export const CRAWL_MAX_MONSTERS = 4;
export const CRAWL_KILL_GOLD = 4;
export const CRAWL_EMBER_BURN = 2;
export const CRAWL_BRUTES_FROM_FLOOR = 8;

export type CrawlMonsterKind = 'ghoul' | 'wisp' | 'brute';

export interface CrawlMonster {
    cell: number;
    kind: CrawlMonsterKind;
    hp: number;
    maxHp: number;
    /** Turns left before it strikes. */
    clock: number;
    every: number;
    damage: number;
}

export interface CrawlFloor {
    hero: number;
    monsters: CrawlMonster[];
    /** Monsters killed this floor. */
    slain: number;
    /** The last turn's blows, for the board and the HUD to show: who struck, who was hurt, who died. */
    lastStrikes?: number;
    /** The cells of the monsters that struck on the last turn. */
    lastStrikers?: number[];
    /** Turns the crawl has counted this floor: the board keys each turn's blows by it. */
    turn?: number;
    lastHits?: number[];
    lastKills?: number[];
}

/**
 * **The crawl is the game** (rules 104, 2026-10-28). The owner played the prototype behind `?crawl=1` and said:
 * make it the game. From rules 104 every solo run is a crawl; a run on older rules (a saved run, a test pinned
 * to its rules) never is, whatever its fields say.
 */
export const CRAWL_FROM = 104;

export const isCrawlRun = (run: Pick<RunState, 'crawl'> & Partial<Pick<RunState, 'runRulesVersion'>>): boolean =>
    run.crawl === true && (run.runRulesVersion ?? 0) >= CRAWL_FROM;

/** Monsters a floor deals: one, and one more for every `CRAWL_PAIRS_PER_MONSTER` pairs it holds, at most `CRAWL_MAX_MONSTERS`. */
export const crawlMonsterCountFor = (pairs: number): number => Math.min(CRAWL_MAX_MONSTERS, 1 + Math.floor(Math.max(0, pairs) / CRAWL_PAIRS_PER_MONSTER));

const monsterFor = (kind: CrawlMonsterKind, level: number, cell: number, stagger: number): CrawlMonster => {
    const depth = Math.floor(Math.max(0, level - 1) / 8);
    const base =
        kind === 'brute' ? { hp: 5 + depth, every: CRAWL_STRIKE_EVERY + 1, damage: 2 }
            : kind === 'wisp' ? { hp: 2 + depth, every: CRAWL_STRIKE_EVERY - 1, damage: 1 }
                : { hp: 3 + depth, every: CRAWL_STRIKE_EVERY, damage: 1 };
    return { cell, kind, hp: base.hp, maxHp: base.hp, every: base.every, damage: base.damage, clock: base.every + stagger };
};

/** Deal the hero and the monsters onto a fresh board: the hero at the bottom-left, monsters away from it. */
export const dealCrawl = (board: BoardState, runSeed: number): BoardState => {
    const cells = board.tiles.length;
    if (cells === 0) return board;
    const columns = Math.max(1, board.columns);
    const hero = Math.max(0, Math.min(cells - 1, (Math.max(1, board.rows) - 1) * columns));
    const heroRow = Math.floor(hero / columns);
    const heroCol = hero % columns;
    const rng = createMulberry32(hashStringToSeed(`crawl:${runSeed}:${board.level}`));
    const open = board.tiles
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile, index }) => tile.state === 'hidden' && Math.abs(Math.floor(index / columns) - heroRow) + Math.abs((index % columns) - heroCol) > 2)
        .map(({ index }) => index);
    const monsters: CrawlMonster[] = [];
    const count = Math.min(crawlMonsterCountFor(board.pairCount), open.length);
    for (let i = 0; i < count; i += 1) {
        const pick = pickRngIndex(rng, open.length);
        const cell = open.splice(pick, 1)[0]!;
        const roll = pickRngIndex(rng, 6);
        const kind: CrawlMonsterKind = board.level >= CRAWL_BRUTES_FROM_FLOOR && roll === 0 ? 'brute' : roll <= 2 ? 'wisp' : 'ghoul';
        monsters.push(monsterFor(kind, board.level, cell, i % 2));
    }
    return { ...board, crawl: { hero, monsters, slain: 0 } };
};

const isOpen = (tile: Tile | undefined): boolean => tile != null && tile.state !== 'hidden';

/** The hero's ground: its own cell and every open cell joined to it through open cells. */
export const crawlGround = (board: Pick<BoardState, 'tiles' | 'columns' | 'fold' | 'crawl'>): Set<number> => {
    const ground = new Set<number>();
    const crawl = board.crawl;
    if (!crawl) return ground;
    const queue = [crawl.hero];
    ground.add(crawl.hero);
    while (queue.length > 0) {
        const at = queue.shift()!;
        for (const next of orthogonalNeighbourIndices(at, board.columns, board.tiles.length, board.fold)) {
            if (ground.has(next) || !isOpen(board.tiles[next])) continue;
            ground.add(next);
            queue.push(next);
        }
    }
    return ground;
};

/**
 * The cells a turn's first card may be turned on: face-down cards on the hero's ground or touching it, that frost or vines do not hold.
 * Never empty while a card can be turned: a hero walled in may turn any.
 */
export const crawlReachableCells = (board: Pick<BoardState, 'tiles' | 'columns' | 'fold' | 'crawl'>, stickyCell: number | null = null): Set<number> => {
    const reach = new Set<number>();
    if (!board.crawl) return reach;
    const turnable = (cell: number): boolean => { const tile = board.tiles[cell]; return cell !== stickyCell && tile?.state === 'hidden' && !isTileFlipBlocked(tile); };
    const ground = crawlGround(board);
    for (const cell of ground) {
        if (turnable(cell)) reach.add(cell);
        for (const next of orthogonalNeighbourIndices(cell, board.columns, board.tiles.length, board.fold)) {
            if (turnable(next)) reach.add(next);
        }
    }
    // Frost and vines can wall the hero in: then any card that can be turned can be.
    if (reach.size === 0) board.tiles.forEach((_tile, index) => { if (turnable(index)) reach.add(index); });
    return reach;
};

/** True when a turn's first card may not be turned here. */
export const crawlBlocksFirstFlip = (run: Pick<RunState, 'crawl' | 'runRulesVersion' | 'stickyBlockIndex'>, board: BoardState, tileIndex: number): boolean =>
    isCrawlRun(run) && board.crawl != null && !crawlReachableCells(board, run.stickyBlockIndex).has(tileIndex);

const SUIT_BURN: Partial<Record<TileSuit, number>> = { ember: CRAWL_EMBER_BURN };

/**
 * After a turn: the hero walks, the blows land, the monsters count down and strike. `before` is the run as the
 * turn was played (its flipped cards), `after` the run the turn left.
 */
export const applyCrawlTurn = (before: RunState, after: RunState): RunState => {
    const crawl = after.board?.crawl;
    const beforeBoard = before.board;
    if (!isCrawlRun(after) || !crawl || !beforeBoard || !after.board) return after;
    if (runNonNegativeInteger(after.turnsThisFloor) <= runNonNegativeInteger(before.turnsThisFloor)) return after;
    const flipped = beforeBoard.flippedTileIds;
    if (flipped.length < 2) return after;
    const cells = flipped.map((id) => beforeBoard.tiles.findIndex((tile) => tile.id === id)).filter((cell) => cell >= 0);
    const matched = flipped.every((id) => after.board!.tiles.find((tile) => tile.id === id)?.state !== 'hidden');
    const suit = beforeBoard.tiles.find((tile) => tile.id === flipped[0])?.suit;

    const hits: number[] = [];
    const kills: number[] = [];
    let monsters = crawl.monsters.map((monster) => {
        let damage = 0;
        if (cells.includes(monster.cell)) damage += matched ? monster.hp : 1;
        if (matched) {
            const touching = cells.some((cell) => orthogonalNeighbourIndices(cell, after.board!.columns, after.board!.tiles.length, after.board!.fold).includes(monster.cell));
            if (touching) damage += (suit && SUIT_BURN[suit]) || 1;
        }
        if (damage <= 0) return monster;
        hits.push(monster.cell);
        const hp = Math.max(0, monster.hp - damage);
        if (hp === 0) kills.push(monster.cell);
        return { ...monster, hp };
    });
    monsters = monsters.filter((monster) => monster.hp > 0);

    // The survivors count down; the clearing turn ends the floor before they can strike.
    let strikes = 0;
    const strikers: number[] = [];
    let damageTaken = 0;
    if (after.status === 'playing') {
        monsters = monsters.map((monster) => {
            const clock = monster.clock - 1;
            if (clock > 0) return { ...monster, clock };
            strikes += 1;
            strikers.push(monster.cell);
            damageTaken += monster.damage;
            return { ...monster, clock: monster.every };
        });
    }
    // A kill heals: hunting the monsters is how the hero stays up.
    const health = Math.min(CRAWL_HEALTH, Math.max(0, runNonNegativeInteger(after.crawlHealth ?? CRAWL_HEALTH) - damageTaken + kills.length * CRAWL_HEAL_PER_KILL));
    const hero = matched ? cells[cells.length - 1]! : crawl.hero;
    const next: RunState = {
        ...after,
        crawlHealth: health,
        gold: runNonNegativeInteger(after.gold) + kills.length * CRAWL_KILL_GOLD,
        // A kill on a match wins a miss back; one that a miss struck does not pay for the miss.
        ...(matched && kills.length > 0 && after.missBank ? { missBank: grantMisses(after.missBank, after.board.level, kills.length * CRAWL_MISSES_PER_KILL, missBankCap(after)) } : {}),
        board: { ...after.board, crawl: { hero, monsters, slain: crawl.slain + kills.length, lastStrikes: strikes, lastStrikers: strikers, lastHits: hits, lastKills: kills, turn: (crawl.turn ?? 0) + 1 } }
    };
    if (health === 0 && next.status === 'playing') {
        // The run ends on this turn: the Wanderers' footprints go with the floor, as on any ending.
        const tiles = next.board!.tiles.map((tile) => (tile.footprint ? { ...tile, footprint: undefined } : tile));
        return { ...next, status: 'gameOver', runEndReason: 'slain', board: { ...next.board!, tiles, flippedTileIds: [] } };
    }
    return next;
};

/** A crawl run: the flag, full health, and the first floor dealt. */
export const withCrawl = (run: RunState): RunState =>
    run.passAndPlay || (run.runRulesVersion ?? 0) < CRAWL_FROM ? run : { ...run, crawl: true, crawlHealth: CRAWL_HEALTH, board: run.board ? dealCrawl(run.board, run.runSeed) : run.board };


/** The next floor of a crawl run: dealt, and the hero healed a little. */
export const crawlNextFloor = (run: RunState): RunState =>
    !isCrawlRun(run) || !run.board
        ? run
        : { ...run, crawlHealth: Math.min(CRAWL_HEALTH, runNonNegativeInteger(run.crawlHealth ?? CRAWL_HEALTH) + CRAWL_HEAL_PER_FLOOR), board: dealCrawl(run.board, run.runSeed) };

/** `strike in 2`: the soonest monster's count, and how hard it hits. */
export const crawlNextStrikeLine = (monsters: readonly CrawlMonster[]): string => {
    const next = monsters.reduce((soonest, monster) => (monster.clock < soonest.clock ? monster : soonest), monsters[0]!);
    const together = monsters.filter((monster) => monster.clock === next.clock).reduce((sum, monster) => sum + monster.damage, 0);
    return next.clock <= 1 ? `−${together} next turn` : `−${together} in ${next.clock}`;
};

/**
 * A player who knows the board, under the crawl: of the pairs it would match, one with a card the hero can reach,
 * that card first - and a pair that hurts a monster before any other. Off the crawl, the first pair as given.
 */
export const crawlOrderPair = <T extends { id: string }>(run: RunState, groups: readonly (readonly T[])[]): [T, T] | null => {
    const board = run.board;
    if (!board || !isCrawlRun(run) || !board.crawl) return groups[0] ? [groups[0][0]!, groups[0][1]!] : null;
    const reach = crawlReachableCells(board, run.stickyBlockIndex);
    const cellOf = (tile: T): number => board.tiles.findIndex((candidate) => candidate.id === tile.id);
    const monsterCells = new Set(board.crawl.monsters.map((monster) => monster.cell));
    const near = (cell: number): boolean => monsterCells.has(cell) || orthogonalNeighbourIndices(cell, board.columns, board.tiles.length, board.fold).some((next) => monsterCells.has(next));
    let best: [T, T] | null = null;
    for (const group of groups) {
        const [a, b] = [group[0], group[1]];
        if (!a || !b) continue;
        const ordered: [T, T] | null = reach.has(cellOf(a)) ? [a, b] : reach.has(cellOf(b)) ? [b, a] : null;
        if (!ordered) continue;
        if (near(cellOf(ordered[0])) || near(cellOf(ordered[1]))) return ordered;
        best ??= ordered;
    }
    return best;
};

/** Of a list of face-down cards, the ones a turn may open with: all of them off the crawl. */
export const crawlFirstCards = <T extends { id: string }>(run: RunState, cards: readonly T[]): T[] => {
    const board = run.board;
    if (!board || !isCrawlRun(run) || !board.crawl) return [...cards];
    const reach = crawlReachableCells(board, run.stickyBlockIndex);
    return cards.filter((card) => reach.has(board.tiles.findIndex((tile) => tile.id === card.id)));
};

/** The Zone (`zone-rules.ts`) carries the hero: a turn it replays opens where the Zone's first card lies. */
export const crawlCarryHeroTo = (run: RunState, tileId: string): RunState => {
    const board = run.board;
    if (!isCrawlRun(run) || !board?.crawl) return run;
    const cell = board.tiles.findIndex((tile) => tile.id === tileId);
    return cell < 0 ? run : { ...run, board: { ...board, crawl: { ...board.crawl, hero: cell } } };
};
