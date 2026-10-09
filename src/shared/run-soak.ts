import { applyBomb, applyPeek, applyShuffle, bombTargetTileId } from './board-power-actions';
import { COLOSSUS_BREAK_PAIRS, COLOSSUS_CHIPS_PER_HIT, COLOSSUS_MAX_SPLIT_PAIRS } from './colossus-rules';
import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { inspectBoardFairness } from './board-inspection';
import { advanceToNextLevel, createNewRun, createWildRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap, missBankGrantLastFloor, missesLeft } from './miss-bank';
import { runComboHeatPerks } from './combo-heat-perks';
import { hasMutator } from './mutators';
import { hasRelic, usesCampUpgrades } from './run-relic-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { buyStoreItem, isStoreStopFloor, runGold, storeOffer, type StoreItemId } from './run-store-rules';
import { essenceOf, focusOf, isElementalStoreId, storeElement } from './elemental-loot-rules';
import { TILE_SUITS } from './tile-suit-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { canIgniteZone, igniteZone, isZoneActive, resolveZone, zoneFlipTile, zoneFlipsLeft } from './zone-rules';
import { boardHasTurnablePair, isTileFlipBlocked } from './realm-weather-rules';
import { elementWouldLand, tileCharge } from './element-alchemy-rules';
import { isStreakPrimed, runElementStreak } from './element-resonance-rules';
import { chooseRealmDoor, REALM_DOOR_COUNT } from './realm-rules';

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
    /** Start from the Wild setup (a joker on the board) instead of a classic run. */
    readonly wild?: boolean;
    /** Share of turns the player flips two cards that do not match. */
    missRate: number;
    /** Share of turns, with a bomb in hand, the player bombs instead of turning the second card. */
    bombRate: number;
    /** Share of turns the player peeks first, when a peek is in hand. */
    peekRate: number;
    /** Share of turns the player shuffles first, when a shuffle is in hand. */
    shuffleRate: number;
    /** Share of turns the player ignites the Zone, when the combo allows it. */
    zoneRate: number;
    /**
     * Share of turns the player plays the elements (`element-resonance-rules.ts`): the backs show
     * every card's element, so they open on the element in hand until the streak is primed, and on a
     * different one once it is, which is the reaction and, since 2026-10-02, the only pop.
     */
    elementRate: number;
}

export const SOAK_PLAYERS: Readonly<Record<'careful' | 'average' | 'sloppy' | 'wild', SoakPlayer>> = {
    careful: { missRate: 0.05, bombRate: 0.5, peekRate: 0.1, shuffleRate: 0.02, zoneRate: 0.5, elementRate: 0.9 },
    average: { missRate: 0.18, bombRate: 0.35, peekRate: 0.15, shuffleRate: 0.05, zoneRate: 0.5, elementRate: 0.6 },
    sloppy: { missRate: 0.4, bombRate: 0.25, peekRate: 0.2, shuffleRate: 0.08, zoneRate: 0.5, elementRate: 0.2 },
    wild: { wild: true, missRate: 0.18, bombRate: 0.35, peekRate: 0.15, shuffleRate: 0.05, zoneRate: 0.5, elementRate: 0.6 }
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
    focusesForged: number;
    essenceFound: number;
    /** Misses that opened the void and spat new pairs onto a reshuffled board. */
    voidSpews: number;
    /** The Colossus (`colossus-rules.ts`): boss floors it stood over, hits landed on it, times it fell, times it split. */
    colossiRaised: number;
    colossusHits: number;
    colossiFelled: number;
    colossusSplits: number;
    /** The odd cards (`odd-card-rules.ts`): floors dealt a Turncoat, times one turned, floors dealt an Hourglass, prizes caught, and Hourglasses that ran out. */
    turncoatFloors: number;
    turncoatTurns: number;
    hourglassFloors: number;
    hourglassesCaught: number;
    hourglassesSpent: number;
    /** Jokers spent: every fall in wildMatchesRemaining. */
    wildMatches: number;
    /** Matches resolved with a heat perk on: every rise in heatPerkTurnsThisFloor. */
    heatPerkTurns: number;
    /** Zones ignited, and pairs matched inside them. */
    zones: number;
    zonePairs: number;
    /** The realms (`realm-rules.ts`): weather events, reactions (the sway tipping a floor), fires doused and burnt out, vines cut, cards frozen, doors walked through. */
    realmWeather: number;
    realmReactions: number;
    realmDoused: number;
    realmBurnouts: number;
    realmVinesCut: number;
    realmFrozen: number;
    /** A raging realm striking back at a miss (`resolveRealmBacklash`). */
    realmBacklashes: number;
    /** The sway tipping a floor into another realm (`realm-sway-rules.ts`). */
    realmTips: number;
    /** Matched groups casting their element on the board (`element-group-rules.ts`). */
    elementCasts: number;
    /** Elemental alchemy (`element-alchemy-rules.ts`): cards that drank their own element, and elements a card put out. */
    elementEmpowered: number;
    elementNeutralized: number;
    /** Resonance (`element-resonance-rules.ts`): reactions two elements made, and the deepest stack, charge and realm depth a run reached. */
    elementReactions: number;
    /** Pairs a reaction burst off the floor: the only pop a realm floor has. */
    elementBurstPairs: number;
    elementResonancePeak: number;
    elementChargePeak: number;
    realmDepthPeak: number;
    realmDoors: number;
    /** Peak weather (every third weather event of a floor), and floors played at a confluence of two realms. */
    realmPeaks: number;
    realmConfluences: number;
    /** What realm floors sent on: attunements earned, floors studied through smoke, floors opened in the cold. */
    realmAttunements: number;
    realmSmokeFloors: number;
    realmChillFloors: number;
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
    'a standing Colossus has hits and turns left, and either one element of its own or an order of two or more': (_b, run) => {
        const colossus = run.board?.colossus;
        if (!colossus || colossus.status !== 'standing') return null;
        if (colossus.hits < 1 || colossus.hits > colossus.hitsMax) return `standing with ${colossus.hits} of ${colossus.hitsMax} hits`;
        if (colossus.turnsLeft < 1 || colossus.turnsLeft > colossus.turnsMax) return `standing with ${colossus.turnsLeft} of ${colossus.turnsMax} turns`;
        if (colossus.chips < 0 || colossus.chips >= COLOSSUS_CHIPS_PER_HIT) return `holding ${colossus.chips} chips`;
        // Rules 63: one element all fight long, and no chips (`COLOSSUS_FIXED_FROM`).
        if (colossus.form === 'fixed') return colossus.cycle.length === 1 && colossus.chips === 0 && colossus.step === 0 ? null : `a fixed Colossus showing ${colossus.cycle.join(',')} at step ${colossus.step} with ${colossus.chips} chips`;
        return new Set(colossus.cycle).size >= 2 ? null : `its order is ${colossus.cycle.join(',')}`;
    },
    'a Colossus splits once, into its pairs, and only out of turns': (_b, run) => {
        const colossus = run.board?.colossus;
        if ((run.colossusSplitsThisFloor ?? 0) > 1) return `split ${run.colossusSplitsThisFloor} times on one floor`;
        if (!colossus || colossus.status !== 'split') return null;
        const pairs = colossus.splitPairKeys?.length ?? 0;
        if (colossus.form === 'fixed') {
            if (pairs !== COLOSSUS_BREAK_PAIRS) return `a fixed Colossus broke into ${pairs} pairs, not ${COLOSSUS_BREAK_PAIRS}`;
        } else if (pairs < 1 || pairs > COLOSSUS_MAX_SPLIT_PAIRS || pairs > colossus.hits) return `split into ${pairs} pairs with ${colossus.hits} hits left`;
        return colossus.turnsLeft === 0 ? null : `split with ${colossus.turnsLeft} turns left`;
    },
    'a fixed Colossus breaks into pairs of its own element, dealt face down': (before, run) => {
        const colossus = run.board?.colossus;
        if (!colossus || colossus.form !== 'fixed' || colossus.status !== 'split' || before?.board?.colossus?.status !== 'standing' || !run.board) return null;
        const element = colossus.cycle[0];
        const pieces = run.board.tiles.filter((tile) => colossus.splitPairKeys?.includes(tile.pairKey));
        if (pieces.length !== 2 * COLOSSUS_BREAK_PAIRS) return `it broke into ${pieces.length} cards`;
        const wrong = pieces.find((tile) => tile.suit !== element || tile.state !== 'hidden' || (run.realmLitTileIds ?? []).includes(tile.id));
        return wrong ? `piece ${wrong.id} is ${wrong.suit} ${wrong.state}${(run.realmLitTileIds ?? []).includes(wrong.id) ? ' and shown' : ''}, expected a face-down ${element} card` : null;
    },
    'the Colossus moves only when a turn is counted': (before, run) => {
        if (!before) return null;
        const was = before.board?.colossus;
        const now = run.board?.colossus;
        if (!was || !now || before.board?.level !== run.board?.level || before.turnsThisFloor !== run.turnsThisFloor) return null;
        return was.step === now.step && was.turnsLeft === now.turnsLeft && was.hits === now.hits && was.status === now.status ? null : 'it changed without a turn';
    },
    'a Turncoat pair is whole: two halves, one element, one promise, and only on standing cards': (_b, run) => {
        if (!run.board) return null;
        for (const [key, halves] of pairsOf(run.board)) {
            if (!halves.some((tile) => tile.turncoat != null)) continue;
            if (halves.some(isGone)) return `pair ${key} is gone and still a Turncoat`;
            if (halves.some((tile) => tile.turncoat !== halves[0]!.turncoat || tile.suit !== halves[0]!.suit)) return `pair ${key} is split: ${halves.map((t) => `${t.suit}>${t.turncoat}`).join(' / ')}`;
        }
        return null;
    },
    'an Hourglass pair is whole, standing, and has sand': (_b, run) => {
        if (!run.board) return null;
        for (const [key, halves] of pairsOf(run.board)) {
            if (!halves.some((tile) => tile.hourglass != null)) continue;
            if (halves.some(isGone)) return `pair ${key} is gone and still an Hourglass`;
            if (halves.some((tile) => tile.hourglass !== halves[0]!.hourglass || !(tile.hourglass! >= 1))) return `pair ${key} holds ${halves.map((t) => t.hourglass).join(' / ')} turns of sand`;
        }
        return null;
    },
    'the odd cards move only when a turn is counted': (before, run) => {
        if (!before?.board || !run.board || before.board.level !== run.board.level || before.turnsThisFloor !== run.turnsThisFloor) return null;
        const was = new Map(before.board.tiles.map((tile) => [tile.id, tile]));
        const moved = run.board.tiles.find((tile) => {
            const prior = was.get(tile.id);
            return prior != null && !isGone(tile) && (prior.turncoat !== tile.turncoat || prior.hourglass !== tile.hourglass || (tile.turncoat != null && prior.suit !== tile.suit));
        });
        return moved ? `${moved.id} changed without a turn` : null;
    },
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
    'no more than two cards face up at once, three with the gambit, twice the Zone\'s pairs in a Zone': (_b, run) => {
        if (!run.board) return null;
        const cap = isZoneActive(run) ? run.zone!.pairs * 2 : 3;
        return run.board.flippedTileIds.length > cap ? `${run.board.flippedTileIds.length} face up against ${cap}` : null;
    },
    'a Zone is open only while the floor is played, and never past its own pairs': (_b, run) => {
        if (!isZoneActive(run)) return null;
        if (run.status !== 'playing') return `zone open while ${run.status}`;
        return run.zone!.pairs >= 2 && run.zone!.pairs <= 6 ? null : `zone of ${run.zone!.pairs} pairs`;
    },
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
    'the afterglow lights no more cards than the heat the run carried in allows': (before, run, action) => {
        if (!before || hasMutator(run, 'lantern_light') || hasRelic(run, 'tallow_candle')) return null;
        // A Zone replays several turns in one action, and the combo its matches build lights the
        // later ones: the heat carried into the action is not the heat the last turn resolved on.
        if (action === 'zone-flip' || action === 'zone-resolve') return null;
        const lit = Array.isArray(run.lanternLitTileIds) ? run.lanternLitTileIds.length : 0;
        const allowed = runComboHeatPerks(before).afterglow;
        return lit <= allowed ? null : `${lit} lit at a combo of ${before.stats.currentStreak}, which allows ${allowed}`;
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
    'the combo falls only on a miss or an ignition, and then to nothing': (before, run, action) => {
        if (!before || run.stats.currentStreak >= before.stats.currentStreak) return null;
        // The Zone burns the combo to open (`zone-rules.ts`): the one fall that is not a miss.
        if (action === 'ignite') return run.stats.currentStreak === 0 && run.zone != null ? null : `ignition left a combo of ${run.stats.currentStreak}`;
        if (run.stats.mismatches <= before.stats.mismatches) return `combo ${before.stats.currentStreak} -> ${run.stats.currentStreak} without a miss`;
        return run.stats.currentStreak === 0 ? null : `a miss left a combo of ${run.stats.currentStreak}`;
    },
    'the ladder crosses the stairs whole': (before, run) => {
        if (!before?.board || !run.board || run.board.level !== before.board.level + 1) return null;
        const carried = run.stats.currentStreak === before.stats.currentStreak &&
            (run.chunkPairsThisChain ?? 0) === (before.chunkPairsThisChain ?? 0) &&
            (run.skipMomentumThisChain ?? 0) === (before.skipMomentumThisChain ?? 0);
        return carried ? null : `combo ${before.stats.currentStreak}+${before.chunkPairsThisChain ?? 0} -> ${run.stats.currentStreak}+${run.chunkPairsThisChain ?? 0} on the stairs`;
    },
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
    'a miss costs the tries it charged, as far as the bank covers them': (before, run, action) => {
        if (!before || action !== 'resolve' || run.stats.mismatches <= before.stats.mismatches) return null;
        const had = missesLeft(before) ?? 0;
        if (had === 0) return run.status === 'gameOver' ? null : 'a miss on an empty bank did not end the run';
        const owed = Math.min(had, Math.max(1, run.stats.tries - before.stats.tries));
        const paid = had - (missesLeft(run) ?? 0);
        return paid === owed ? null : `paid ${paid} of ${owed} (tries ${before.stats.tries} -> ${run.stats.tries})`;
    },
    /*
     * The board inspector's structural checks - pairs whole, counters honest, a way left to finish.
     * It existed and nothing ran it over live play: the wild joker claimed a card and left its
     * partner face down with nothing to pair, and the floor could never clear. Only between turns,
     * since a card mid-flip is legitimately half of an unresolved pair.
     */
    'the board always has a way to finish': (_b, run) => {
        if (!run.board || run.status === 'resolving' || run.board.flippedTileIds.length > 0) return null;
        const issues = inspectBoardFairness(run.board).issues;
        return issues.length === 0 ? null : issues.map((issue) => issue.code).join(', ');
    },
    'a purchase costs exactly its price': (before, run, action) => {
        if (!before || !action.startsWith('buy:')) return null;
        const id = action.slice(4) as StoreItemId;
        const price = storeOffer(before).find((row) => row.id === id)?.price ?? Number.NaN;
        return runGold(before) - runGold(run) === price ? null : `gold ${runGold(before)} -> ${runGold(run)} for ${id} at ${price}`;
    },
    'elemental purchases spend exactly their essence and never create negative resources': (before, run, action) => {
        for (const suit of TILE_SUITS) {
            for (const value of [run.elementalEssence?.[suit] ?? 0, run.elementalFocus?.[suit] ?? 0]) {
                if (!Number.isSafeInteger(value) || value < 0) return `invalid ${suit} resource ${value}`;
            }
        }
        if (!before || !action.startsWith('buy:')) return null;
        const id = action.slice(4);
        if (!isElementalStoreId(id)) return null;
        const cost = storeOffer(before).find(row => row.id === id)?.essenceCost;
        const suit = storeElement(id);
        return essenceOf(before.elementalEssence, suit) - essenceOf(run.elementalEssence, suit) === cost
            ? null : `wrong essence debit for ${id}`;
    },
    /*
     * The realms (`realm-rules.ts`). The weather may freeze, vine, burn and move cards, and none
     * of it may leave a floor that cannot be finished or turn a card the rules say cannot be turned.
     */
    'frozen and vined cards always leave a pair that can be turned': (_b, run) => {
        if (!run.board || run.status !== 'playing' || run.board.flippedTileIds.length > 0) return null;
        return boardHasTurnablePair(run.board.tiles) ? null : 'no pair left that can be turned';
    },
    'arena holds cover complete cohorts of at least two pairs': (_b, run) => {
        if (!run.board || run.status === 'resolving' || run.board.flippedTileIds.length) return null;
        for (const kind of ['frost', 'vined'] as const) {
            const held = run.board.tiles.filter(t => t.state === 'hidden' && t[kind]);
            if (!held.length) continue;
            const keys = new Set(held.map(t => t.pairKey));
            if (keys.size < 2) return kind + ' exposed a single pair';
            for (const key of keys) if (held.filter(t => t.pairKey === key).length !== 2) return kind + ' split pair ' + key;
            if (kind === 'frost' && new Set(held.map(t => t.frost)).size !== 1) return 'ice expiry identifies partners';
        }
        return null;
    },
    'a frozen or vined card is never turned face up': (before, run, action) => {
        if (!before?.board || !run.board || (action !== 'flip' && action !== 'zone-flip')) return null;
        const turned = run.board.tiles.filter((tile) => tile.state === 'flipped' && before.board!.tiles.find((was) => was.id === tile.id)?.state === 'hidden');
        const blocked = turned.filter((tile) => {
            const was = before.board!.tiles.find((candidate) => candidate.id === tile.id)!;
            return isTileFlipBlocked(was);
        });
        return blocked.length === 0 ? null : `turned blocked ${blocked.map((tile) => tile.id).join(',')}`;
    },
    'a floor clear selects the next arena; historical runs offer doors': (before, run) => {
        if (run.status !== 'levelComplete' || before?.status === 'levelComplete' || !run.realmId) return null;
        if (usesCampUpgrades(run)) return run.nextRealm && !run.realmDoors?.length ? null : 'next arena missing or choices still offered';
        const doors = run.realmDoors ?? [];
        if (doors.length !== REALM_DOOR_COUNT) return `${doors.length} doors`;
        return doors.some((door) => door.realmId === run.realmId) ? null : `doors ${doors.map((door) => door.realmId).join(',')} miss ${run.realmId}`;
    },
    'smoke stays within its cap, and depth, resonance and charge are whole and never negative': (_b, run) => {
        if ((run.realmSmoke ?? 0) > 3) return `smoke ${run.realmSmoke}`;
        const whole = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0;
        if (!Object.values(run.realmAttunement ?? {}).every(whole)) return `attunement ${JSON.stringify(run.realmAttunement)}`;
        if (!Object.values(run.elementResonance ?? {}).every(whole)) return `resonance ${JSON.stringify(run.elementResonance)}`;
        const charged = run.board?.tiles.find((tile) => tile.empowered != null && tile.empowered !== true && !(whole(tile.empowered) && tile.empowered > 0));
        return charged ? `charge ${String(charged.empowered)} on ${charged.id}` : null;
    },
    'a reaction spends a primed streak of another element, and a miss breaks the streak': (before, run, action) => {
        // One resolved turn at a time: a Zone resolves several matches in one action.
        if (!before || action !== 'resolve' || before.board?.level !== run.board?.level) return null;
        const reacted = (run.elementReactionsThisFloor ?? 0) - (before.elementReactionsThisFloor ?? 0);
        if (reacted > 0) {
            const spent = runElementStreak(before);
            if (!isStreakPrimed(spent)) return `reaction on streak ${JSON.stringify(before.elementStreak)}`;
            if (run.elementStreak?.suit === spent!.suit) return `reaction kept the ${spent!.suit} streak`;
        }
        // The pop is the reaction's: on a realm floor a turn that takes more than its own pair reacted.
        const pairsGone = (run.board?.matchedPairs ?? 0) - (before.board?.matchedPairs ?? 0);
        if (run.realmId && pairsGone > 1 && reacted <= 0) return `${pairsGone} pairs left the floor with no reaction`;
        if ((run.stats.mismatches ?? 0) > (before.stats.mismatches ?? 0) && run.elementStreak != null) {
            return `streak ${JSON.stringify(run.elementStreak)} survived a miss`;
        }
        return null;
    },
    'the chill a floor sends on freezes that many cards of the next, and is spent': (before, run, action) => {
        if (action !== 'descend' || !before?.realmChill || !run.board) return null;
        const frozen = run.board.tiles.filter((tile) => (tile.frost ?? 0) > 0).length;
        if (run.realmChill) return `chill ${run.realmChill} still carried`;
        return frozen === 0 || frozen >= 4 ? null : `${frozen} frozen against a chill of ${before.realmChill}`;
    },
    /*
     * Elemental alchemy (`element-alchemy-rules.ts`): a card is untouched by its own element and by
     * the one it puts out, so no card may newly take ice or snow as a frost or fire card, a fire as
     * a fire or water card, or vines as a grove or frost card.
     */
    'no card takes the mark of an element it answers': (before, run) => {
        if (!before?.board || !run.board) return null;
        const was = new Map(before.board.tiles.map((tile) => [tile.id, tile]));
        const wrong = run.board.tiles.filter((tile) => {
            const prior = was.get(tile.id);
            if (!prior || tile.state !== 'hidden') return false;
            const gained = (key: 'frost' | 'snowed' | 'fuse' | 'vined', element: TileSuit): boolean =>
                tile[key] != null && prior[key] == null && !elementWouldLand(tile, element);
            return gained('frost', 'bone') || gained('snowed', 'bone') || gained('fuse', 'ember') || gained('vined', 'moss');
        });
        return wrong.length === 0 ? null : `${wrong.map((tile) => `${tile.id} (${tile.suit})`).join(', ')} took an element it answers`;
    },
    'a confluence is two different realms': (_b, run) =>
        run.realmSecondaryId != null && run.realmSecondaryId === run.realmId ? `confluence of ${run.realmId} with itself` : null,
    'a floor is built in the realm of the door walked through': (before, run, action) => {
        if (action !== 'descend' || !before?.nextRealm || !run.board) return null;
        return run.realmId === before.nextRealm.realmId && run.realmSeverity === before.nextRealm.severity
            ? null
            : `walked into ${before.nextRealm.realmId}/${before.nextRealm.severity}, built in ${String(run.realmId)}/${String(run.realmSeverity)}`;
    },
    'a confluence door builds a floor in both its realms': (before, run, action) => {
        if (action !== 'descend' || !before?.nextRealm || !run.board) return null;
        return (before.nextRealm.confluence ?? null) === (run.realmSecondaryId ?? null)
            ? null
            : `walked into a confluence with ${String(before.nextRealm.confluence)}, built with ${String(run.realmSecondaryId)}`;
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

// A player can only turn what the realm lets them: frozen and vined cards are passed over.
const hiddenReal = (run: RunState): Tile[] =>
    (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey) && !isTileFlipBlocked(tile));

export const soakRun = ({
    seed,
    player,
    playerName,
    maxFloors = 30,
    maxActions = 4000,
    observe
}: {
    seed: number;
    player: SoakPlayer;
    playerName: string;
    maxFloors?: number;
    maxActions?: number;
    /** Sees every action as it is taken, for an instrument measuring something the report does not count. */
    observe?: (before: RunState, next: RunState, action: string) => void;
}): SoakRunReport => {
    const rng = createMulberry32(hashStringToSeed(`soak:${seed}:${playerName}`));
    const pick = <T>(items: readonly T[]): T => items[pickRngIndex(rng, items.length)]!;
    const violations: SoakViolation[] = [];
    let run: RunState = player.wild
        ? createWildRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })
        : createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed });
    let step = 0;
    let turns = 0;
    let purchases = 0;
    let bombsUsed = 0;
    let goldEarned = 0;
    let missesGranted = 0;
    let relicsBought = 0;
    let focusesForged = 0;
    let essenceFound = 0;
    let voidSpews = 0;
    let colossiRaised = 0;
    let colossusHits = 0;
    let colossiFelled = 0;
    let colossusSplits = 0;
    let turncoatFloors = 0;
    let turncoatTurns = 0;
    let hourglassFloors = 0;
    let hourglassesCaught = 0;
    let hourglassesSpent = 0;
    let wildMatches = 0;
    let heatPerkTurns = 0;
    let zones = 0;
    let zonePairs = 0;
    let floorsCleared = 0;
    let realmWeather = 0;
    let realmReactions = 0;
    let realmDoused = 0;
    let realmBurnouts = 0;
    let realmVinesCut = 0;
    let realmFrozen = 0;
    let realmBacklashes = 0;
    let realmTips = 0;
    let elementCasts = 0;
    let elementEmpowered = 0;
    let elementNeutralized = 0;
    let elementReactions = 0;
    let elementBurstPairs = 0;
    let elementResonancePeak = 0;
    let elementChargePeak = 0;
    let realmDepthPeak = 0;
    let realmDoors = 0;
    let realmPeaks = 0;
    let realmConfluences = 0;
    let realmAttunements = 0;
    let realmSmokeFloors = 0;
    let realmChillFloors = 0;

    const act = (action: string, next: RunState): void => {
        step += 1;
        observe?.(run, next, action);
        for (const invariant of checkAll(run, next, action)) {
            violations.push({ seed, player: playerName, floor: run.board?.level ?? 0, step, action, invariant });
        }
        goldEarned += Math.max(0, runGold(next) - runGold(run));
        missesGranted += Math.max(0, (missesLeft(next) ?? 0) - (missesLeft(run) ?? 0));
        relicsBought += Math.max(0, (next.relics ?? []).length - (run.relics ?? []).length);
        focusesForged += TILE_SUITS.reduce((sum, suit) => sum + Math.max(0, focusOf(next, suit) - focusOf(run, suit)), 0);
        essenceFound += TILE_SUITS.reduce((sum, suit) => sum + Math.max(0, essenceOf(next.elementalEssence, suit) - essenceOf(run.elementalEssence, suit)), 0);
        voidSpews += Math.max(0, (next.voidSpewsThisFloor ?? 0) - (run.voidSpewsThisFloor ?? 0));
        if (next.board?.colossus && next.board.level !== run.board?.level) colossiRaised += 1;
        colossusHits += Math.max(0, (next.colossusHitsThisFloor ?? 0) - (run.colossusHitsThisFloor ?? 0));
        colossiFelled += Math.max(0, (next.colossiFelledThisRun ?? 0) - (run.colossiFelledThisRun ?? 0));
        colossusSplits += Math.max(0, (next.colossusSplitsThisFloor ?? 0) - (run.colossusSplitsThisFloor ?? 0));
        if (next.board && next.board.level !== run.board?.level) {
            if (next.board.tiles.some((tile) => tile.turncoat != null)) turncoatFloors += 1;
            if (next.board.tiles.some((tile) => tile.hourglass != null)) hourglassFloors += 1;
        }
        turncoatTurns += Math.max(0, (next.turncoatTurnsThisFloor ?? 0) - (run.turncoatTurnsThisFloor ?? 0));
        hourglassesCaught += Math.max(0, (next.hourglassesCaughtThisRun ?? 0) - (run.hourglassesCaughtThisRun ?? 0));
        hourglassesSpent += Math.max(0, (next.hourglassesSpentThisFloor ?? 0) - (run.hourglassesSpentThisFloor ?? 0));
        wildMatches += Math.max(0, (run.wildMatchesRemaining ?? 0) - (next.wildMatchesRemaining ?? 0));
        heatPerkTurns += Math.max(0, (next.heatPerkTurnsThisFloor ?? 0) - (run.heatPerkTurnsThisFloor ?? 0));
        zones += Math.max(0, (next.zonesThisRun ?? 0) - (run.zonesThisRun ?? 0));
        zonePairs += Math.max(0, (next.zonePairsThisRun ?? 0) - (run.zonePairsThisRun ?? 0));
        // Per-floor realm counters reset on the stairs; a rise within a floor is what happened.
        if (next.board?.level === run.board?.level) {
            realmWeather += Math.max(0, (next.realmWeatherThisFloor ?? 0) - (run.realmWeatherThisFloor ?? 0));
            realmReactions += Math.max(0, (next.realmReactionsThisFloor ?? 0) - (run.realmReactionsThisFloor ?? 0));
            realmDoused += Math.max(0, (next.realmDousedThisFloor ?? 0) - (run.realmDousedThisFloor ?? 0));
            realmBurnouts += Math.max(0, (next.realmBurnoutsThisFloor ?? 0) - (run.realmBurnoutsThisFloor ?? 0));
            realmVinesCut += Math.max(0, (next.realmVinesCutThisFloor ?? 0) - (run.realmVinesCutThisFloor ?? 0));
            realmFrozen += Math.max(0, (next.realmFrozenThisFloor ?? 0) - (run.realmFrozenThisFloor ?? 0));
            realmBacklashes += Math.max(0, (next.realmBacklashesThisFloor ?? 0) - (run.realmBacklashesThisFloor ?? 0));
            realmTips += Math.max(0, (next.realmTipsThisFloor ?? 0) - (run.realmTipsThisFloor ?? 0));
            elementCasts += Math.max(0, (next.elementCastsThisFloor ?? 0) - (run.elementCastsThisFloor ?? 0));
            elementEmpowered += Math.max(0, (next.elementEmpoweredThisFloor ?? 0) - (run.elementEmpoweredThisFloor ?? 0));
            elementNeutralized += Math.max(0, (next.elementNeutralizedThisFloor ?? 0) - (run.elementNeutralizedThisFloor ?? 0));
            realmPeaks += Math.max(0, (next.realmPeaksThisFloor ?? 0) - (run.realmPeaksThisFloor ?? 0));
            const reactedNow = Math.max(0, (next.elementReactionsThisFloor ?? 0) - (run.elementReactionsThisFloor ?? 0));
            elementReactions += reactedNow;
            if (reactedNow > 0 && action === 'resolve') elementBurstPairs += Math.max(0, (next.board?.matchedPairs ?? 0) - (run.board?.matchedPairs ?? 0) - 1);
        } else {
            if (next.realmSecondaryId) realmConfluences += 1;
            if ((next.realmSmoke ?? 0) > 0) realmSmokeFloors += 1;
            if ((run.realmChill ?? 0) > 0) realmChillFloors += 1;
        }
        realmAttunements += Math.max(
            0,
            Object.values(next.realmAttunement ?? {}).reduce((sum, level) => sum + (level ?? 0), 0) -
                Object.values(run.realmAttunement ?? {}).reduce((sum, level) => sum + (level ?? 0), 0)
        );
        elementResonancePeak = Math.max(elementResonancePeak, ...Object.values(next.elementResonance ?? {}).map((stacks) => stacks ?? 0));
        elementChargePeak = Math.max(elementChargePeak, ...(next.board?.tiles ?? []).map((tile) => tileCharge(tile)));
        realmDepthPeak = Math.max(realmDepthPeak, ...Object.values(next.realmAttunement ?? {}).map((level) => level ?? 0));
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
            // Current runs already have a seed-random destination. Legacy replays retain doors.
            if (usesCampUpgrades(run) && run.nextRealm) realmDoors += 1;
            if (Array.isArray(run.realmDoors) && run.realmDoors.length > 0) {
                realmDoors += 1;
                act('travel', chooseRealmDoor(run, pickRngIndex(rng, run.realmDoors.length)));
            }
            act('descend', advanceToNextLevel(run));
            if ((run as RunState).status === 'memorize') act('study', finishMemorizePhase(run));
            continue;
        }
        if (run.status === 'resolving') {
            act('resolve', resolveBoardTurn(run));
            continue;
        }
        if (run.status !== 'playing') {
            act('study', finishMemorizePhase(run));
            continue;
        }
        const hidden = hiddenReal(run);
        if (hidden.length === 0) break;
        // The Zone, when the fire allows it: ignite, turn cards until it closes on its own or the
        // player closes it early, half the time each. The Zone's flips are turns of a kind.
        if (canIgniteZone(run) && rng() < player.zoneRate) {
            act('ignite', igniteZone(run));
            const early = rng() < 0.5;
            while (isZoneActive(run) && zoneFlipsLeft(run) > 0) {
                const pool = hiddenReal(run).filter((tile) => tile.state === 'hidden');
                if (pool.length === 0) break;
                act('zone-flip', zoneFlipTile(run, pick(pool).id));
                if (early && isZoneActive(run) && zoneFlipsLeft(run) <= 2) break;
            }
            if (isZoneActive(run)) act('zone-resolve', resolveZone(run));
            turns += 1;
            continue;
        }
        // Powers first, the way a player spends them before committing to a turn.
        if (run.peekCharges > 0 && rng() < player.peekRate) {
            const next = applyPeek(run, pick(hidden).id);
            if (next !== run) act('peek', next);
        }
        if (run.shuffleCharges > 0 && rng() < player.shuffleRate) {
            const next = applyShuffle(run);
            if (next !== run) act('shuffle', next);
        }
        // The joker, played the way a player with a wild in hand plays it: early, on any card.
        const joker = (run.board?.tiles ?? []).find((tile) => tile.state === 'hidden' && isWildPairKey(tile.pairKey));
        if (joker && (run.wildMatchesRemaining ?? 0) > 0 && rng() < 0.5) {
            act('flip', flipTile(run, joker.id));
            act('flip', flipTile(run, pick(hiddenReal(run)).id));
            turns += 1;
            act('resolve', resolveBoardTurn(run));
            continue;
        }
        const pool = hiddenReal(run);
        // Playing the elements: the element in hand again until it is primed, then another.
        const inHand = runElementStreak(run);
        const wanted = inHand && rng() < player.elementRate ? pool.filter((tile) => (tile.suit === inHand.suit) !== isStreakPrimed(inHand)) : [];
        const first = pick(wanted.length > 0 ? wanted : pool);
        act('flip', flipTile(run, first.id));
        // A previously refused opener can leave one card up. This flip may already complete
        // that pair; resolve it before looking for a second hidden card (there may be none free).
        if ((run as RunState).status === 'resolving') {
            turns += 1;
            act('resolve', resolveBoardTurn(run));
            continue;
        }
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
        focusesForged,
        essenceFound,
        voidSpews,
        colossiRaised,
        colossusHits,
        colossiFelled,
        colossusSplits,
        turncoatFloors,
        turncoatTurns,
        hourglassFloors,
        hourglassesCaught,
        hourglassesSpent,
        wildMatches,
        heatPerkTurns,
        zones,
        zonePairs,
        realmWeather,
        realmReactions,
        realmDoused,
        realmBurnouts,
        realmVinesCut,
        realmFrozen,
        realmBacklashes,
        realmTips,
        elementCasts,
        elementEmpowered,
        elementNeutralized,
        elementReactions,
        elementBurstPairs,
        elementResonancePeak,
        elementChargePeak,
        realmDepthPeak,
        realmDoors,
        realmPeaks,
        realmConfluences,
        realmAttunements,
        realmSmokeFloors,
        realmChillFloors,
        violations
    };
};
