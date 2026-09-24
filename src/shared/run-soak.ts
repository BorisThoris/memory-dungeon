import { applyBomb, applyPeek, applyShuffle, bombTargetTileId } from './board-power-actions';
import type { BoardState, RunState, Tile } from './contracts';
import { advanceToNextLevel, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap, missBankGrantLastFloor, missesLeft } from './miss-bank';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { buyStoreItem, isStoreStopFloor, runGold, storeOffer, type StoreItemId } from './run-store-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The run soak: whole runs, played by seeded random players, with the run's invariants checked after
 * every single action.
 *
 * Every other harness here plays floors - a board built fresh, played to its clear - and every
 * system added since 2026-09-23 lives *between* floors or across them: the miss bank's grants and
 * their three-floor shelf, gold, the store stop, purchases, bombs, relics. A floor harness cannot
 * see a grant that outlives its shelf, gold that goes negative after a purchase, or a store stop
 * that sells into a run the next floor then drops. This plays the run the way a player does -
 * `createNewRun`, study, turns, clear, shop at a stop, descend - through the game's own functions,
 * and stops at the first action that leaves the run in a state the rules say cannot exist.
 *
 * A failure names the seed, the floor, the action and the invariant, so it replays exactly.
 */
export interface SoakPlayer {
    /** Share of turns the player flips two cards that do not match. */
    missRate: number;
    /** Share of turns, with a bomb in hand, the player bombs instead of turning the second card. */
    bombRate: number;
    /** Share of turns the player peeks first, when a peek is in hand. */
    peekRate: number;
    /** Share of turns the player shuffles first, when a shuffle is in hand. */
    shuffleRate: number;
}

export const SOAK_PLAYERS: Readonly<Record<'careful' | 'average' | 'sloppy', SoakPlayer>> = {
    careful: { missRate: 0.05, bombRate: 0.5, peekRate: 0.1, shuffleRate: 0.02 },
    average: { missRate: 0.18, bombRate: 0.35, peekRate: 0.15, shuffleRate: 0.05 },
    sloppy: { missRate: 0.4, bombRate: 0.25, peekRate: 0.2, shuffleRate: 0.08 }
};

export interface SoakViolation {
    seed: number;
    player: string;
    floor: number;
    step: number;
    action: string;
    invariant: string;
}

export interface SoakRunReport {
    seed: number;
    player: string;
    floorsCleared: number;
    turns: number;
    ended: string;
    purchases: number;
    bombsUsed: number;
    /** Every rise in the purse, summed: gold paid at floor clears. */
    goldEarned: number;
    /** Every rise in misses left, summed: floor grants, chain grants and bought misses. */
    missesGranted: number;
    relicsBought: number;
    violations: SoakViolation[];
}

type Check = (before: RunState | null, after: RunState, action: string) => string | null;

const realTiles = (board: BoardState): Tile[] => board.tiles.filter((tile) => !isSingletonUtilityPairKey(tile.pairKey));

const pairsOf = (board: BoardState): Map<string, Tile[]> => {
    const byPair = new Map<string, Tile[]>();
    for (const tile of realTiles(board)) byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
    return byPair;
};

const isGone = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const nonNegativeInteger = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Every invariant, in the order a failure is most useful to read. */
export const SOAK_INVARIANTS: Readonly<Record<string, Check>> = {
    'tile ids are unique': (_b, run) =>
        run.board && new Set(run.board.tiles.map((tile) => tile.id)).size !== run.board.tiles.length ? 'duplicate tile id' : null,
    'every real pair has exactly two halves': (_b, run) => {
        if (!run.board) return null;
        for (const [key, halves] of pairsOf(run.board)) if (halves.length !== 2) return `pair ${key} has ${halves.length} halves`;
        return null;
    },
    'a pair leaves the board whole': (_b, run) => {
        if (!run.board) return null;
        for (const [key, halves] of pairsOf(run.board)) {
            if (halves.some(isGone) && !halves.every(isGone)) return `pair ${key} is half gone: ${halves.map((t) => t.state).join('/')}`;
        }
        return null;
    },
    'matchedPairs counts the pairs that are gone': (_b, run) => {
        if (!run.board) return null;
        const gone = [...pairsOf(run.board).values()].filter((halves) => halves.every(isGone)).length;
        return run.board.matchedPairs === gone ? null : `matchedPairs ${run.board.matchedPairs}, pairs gone ${gone}`;
    },
    'flippedTileIds are exactly the face-up cards': (_b, run) => {
        if (!run.board || (run.status !== 'playing' && run.status !== 'resolving')) return null;
        const faceUp = run.board.tiles.filter((tile) => tile.state === 'flipped').map((tile) => tile.id).sort();
        const listed = [...run.board.flippedTileIds].sort();
        return JSON.stringify(faceUp) === JSON.stringify(listed) ? null : `face up ${faceUp.join(',')} vs listed ${listed.join(',')}`;
    },
    'no more than two cards face up at once, three with the gambit': (_b, run) =>
        run.board && run.board.flippedTileIds.length > 3 ? `${run.board.flippedTileIds.length} face up` : null,
    'charges, gold and counters are whole numbers, never negative': (_b, run) => {
        const fields: Array<[string, unknown]> = [
            ['shuffleCharges', run.shuffleCharges],
            ['regionShuffleCharges', run.regionShuffleCharges],
            ['peekCharges', run.peekCharges],
            ['flashPairCharges', run.flashPairCharges],
            ['bombCharges', run.bombCharges],
            ['gold', run.gold ?? 0],
            ['turnsThisFloor', run.turnsThisFloor],
            ['totalScore', run.stats.totalScore],
            ['currentStreak', run.stats.currentStreak],
            ['mismatches', run.stats.mismatches]
        ];
        const bad = fields.filter(([, value]) => !nonNegativeInteger(value));
        return bad.length === 0 ? null : bad.map(([name, value]) => `${name}=${String(value)}`).join(', ');
    },
    'the miss bank never holds more than its cap': (_b, run) => {
        const left = missesLeft(run);
        return left == null || left <= missBankCap(run) ? null : `${left} misses against a cap of ${missBankCap(run)}`;
    },
    'no miss grant outlives its shelf': (_b, run) => {
        if (!run.missBank || !run.board) return null;
        const stale = run.missBank.filter((grant) => grant.misses > 0 && missBankGrantLastFloor(grant) < run.board!.level);
        return stale.length === 0 ? null : `grants past their shelf on floor ${run.board.level}: ${JSON.stringify(stale)}`;
    },
    'a run ends with a reason, and only a run that ended has one': (_b, run) =>
        (run.runEndReason == null) === (run.status !== 'gameOver') ? null : `status ${run.status}, reason ${String(run.runEndReason)}`,
    'the score never goes down': (before, run) =>
        before && run.stats.totalScore < before.stats.totalScore ? `score ${before.stats.totalScore} -> ${run.stats.totalScore}` : null,
    'a floor only ever moves forward by one': (before, run) => {
        if (!before?.board || !run.board) return null;
        const step = run.board.level - before.board.level;
        return step === 0 || step === 1 ? null : `floor ${before.board.level} -> ${run.board.level}`;
    },
    'a bomb costs no turn, no miss and no score': (before, run, action) => {
        if (!before || action !== 'bomb') return null;
        if (run.turnsThisFloor !== before.turnsThisFloor) return 'a bomb counted a turn';
        if (run.stats.mismatches !== before.stats.mismatches) return 'a bomb counted a miss';
        if (run.stats.totalScore !== before.stats.totalScore) return 'a bomb paid score';
        if (run.bombCharges !== before.bombCharges - 1) return `bombs ${before.bombCharges} -> ${run.bombCharges}`;
        return null;
    },
    'a purchase costs exactly its price': (before, run, action) => {
        if (!before || !action.startsWith('buy:')) return null;
        const id = action.slice(4) as StoreItemId;
        const price = storeOffer(before).find((row) => row.id === id)?.price ?? Number.NaN;
        return runGold(before) - runGold(run) === price ? null : `gold ${runGold(before)} -> ${runGold(run)} for ${id} at ${price}`;
    },
    'the peak rung never falls within a floor': (before, run) => {
        if (!before?.board || !run.board || before.board.level !== run.board.level) return null;
        const order = ['none', 'clean', 'sharp', 'fever'];
        const was = order.indexOf(before.peakChainTierThisFloor ?? 'none');
        const is = order.indexOf(run.peakChainTierThisFloor ?? 'none');
        return is >= was ? null : `peak ${before.peakChainTierThisFloor} -> ${run.peakChainTierThisFloor}`;
    }
};

const checkAll = (before: RunState | null, after: RunState, action: string): string[] =>
    Object.entries(SOAK_INVARIANTS).flatMap(([name, check]) => {
        const problem = check(before, after, action);
        return problem ? [`${name}: ${problem}`] : [];
    });

const hiddenReal = (run: RunState): Tile[] =>
    (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));

export const soakRun = ({
    seed,
    player,
    playerName,
    maxFloors = 30,
    maxActions = 4000
}: {
    seed: number;
    player: SoakPlayer;
    playerName: string;
    maxFloors?: number;
    maxActions?: number;
}): SoakRunReport => {
    const rng = createMulberry32(hashStringToSeed(`soak:${seed}:${playerName}`));
    const pick = <T>(items: readonly T[]): T => items[pickRngIndex(rng, items.length)]!;
    const violations: SoakViolation[] = [];
    let run: RunState = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed });
    let step = 0;
    let turns = 0;
    let purchases = 0;
    let bombsUsed = 0;
    let goldEarned = 0;
    let missesGranted = 0;
    let relicsBought = 0;
    let floorsCleared = 0;

    const act = (action: string, next: RunState): void => {
        step += 1;
        for (const invariant of checkAll(run, next, action)) {
            violations.push({ seed, player: playerName, floor: run.board?.level ?? 0, step, action, invariant });
        }
        goldEarned += Math.max(0, runGold(next) - runGold(run));
        missesGranted += Math.max(0, (missesLeft(next) ?? 0) - (missesLeft(run) ?? 0));
        relicsBought += Math.max(0, (next.relics ?? []).length - (run.relics ?? []).length);
        run = next;
    };

    act('study', finishMemorizePhase(run));
    while (step < maxActions && violations.length === 0) {
        if (run.status === 'gameOver') break;
        if (run.status === 'levelComplete') {
            floorsCleared += 1;
            if (floorsCleared >= maxFloors) break;
            if (isStoreStopFloor(run.lastLevelResult?.level)) {
                // Shop like a player with a plan: buy what can be bought until the purse says no.
                for (let tries = 0; tries < 6; tries += 1) {
                    const affordable = storeOffer(run).filter((row) => row.blocked === null);
                    if (affordable.length === 0) break;
                    const row = pick(affordable);
                    const bought = buyStoreItem(run, row.id);
                    if (!bought) break;
                    purchases += 1;
                    act(`buy:${row.id}`, bought);
                }
            }
            act('descend', advanceToNextLevel(run));
            if ((run as RunState).status === 'memorize') act('study', finishMemorizePhase(run));
            continue;
        }
        if (run.status !== 'playing') {
            act('study', finishMemorizePhase(run));
            continue;
        }
        const hidden = hiddenReal(run);
        if (hidden.length === 0) break;
        // Powers first, the way a player spends them before committing to a turn.
        if (run.peekCharges > 0 && rng() < player.peekRate) {
            const next = applyPeek(run, pick(hidden).id);
            if (next !== run) act('peek', next);
        }
        if (run.shuffleCharges > 0 && rng() < player.shuffleRate) {
            const next = applyShuffle(run);
            if (next !== run) act('shuffle', next);
        }
        const pool = hiddenReal(run);
        const first = pick(pool);
        act('flip', flipTile(run, first.id));
        if (bombTargetTileId(run) === first.id && rng() < player.bombRate) {
            bombsUsed += 1;
            act('bomb', applyBomb(run, first.id));
            continue;
        }
        const rest = hiddenReal(run);
        const partner = rest.find((tile) => tile.pairKey === first.pairKey);
        const others = rest.filter((tile) => tile.pairKey !== first.pairKey);
        const second = partner && (others.length === 0 || rng() >= player.missRate) ? partner : others.length > 0 ? pick(others) : partner;
        if (!second) break;
        act('flip', flipTile(run, second.id));
        turns += 1;
        act('resolve', resolveBoardTurn(run));
    }
    return {
        seed,
        player: playerName,
        floorsCleared,
        turns,
        ended: run.status === 'gameOver' ? String(run.runEndReason) : run.status,
        purchases,
        bombsUsed,
        goldEarned,
        missesGranted,
        relicsBought,
        violations
    };
};
