import { LEARNED_RULE_TABLE, mostMatchedSuit } from './learned-rule-rules';
import { dreadComposes, dreadPurchase, NO_DREAD_PURCHASE } from './dread-composition-rules';
import { maskCountFor } from './mask-rules';
import { sleeperCountFor } from './sleeper-rules';
import { spiralHolds } from './spiral-rules';
import { canReprise, reprise, repriseTurnsFor } from './reprise-rules';
import { isCartographerFloor } from './cartographer-rules';
import { isKeeperFloor } from './keeper-rules';
import { canCarve, carve, CARVE_DIRECTIONS, carveLinksFor } from './carve-rules';
import { isWandererStepTurn, wandererCountFor, wandererFootprintCells } from './wanderer-rules';
import { BLUEPRINT_ORDER, offersBossDoors, runBlueprints } from './boss-reward-rules';
import { EVOLUTIONS, footprintTurns, hasEvolution } from './relic-evolution-rules';
import { foldDoorOpenFor, foldRoomOf } from './board-fold-rules';
import { tileCanBreakInChunk } from './chunk-break-rules';
import { applyStillBell, canRingStillBell } from './still-bell-rules';
import { dreadForRun, dreadTier } from './dread-rules';
import { awaitsWardenChoice, descendIntoEndless, isWardenFloor, WARDEN_FELL_PAIRS, wardenTestHolds } from './warden-rules';
import { endlessRentForFloor } from './endless-rent-rules';
import { canReleaseHold, canStartHold, heldPairCount, releaseHold, startHold } from './hold-rules';
import { parTurnsForRun } from './floor-par';
import { canTakeMisersPurse, takeMisersPurse } from './misers-purse-rules';
import { applyStormGlass, canBreakStormGlass } from './storm-glass-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { applyCrucible, crucibleTargetTileId } from './crucible-rules';
import { applyBomb, applyPeek, applyShuffle, bombTargetTileId } from './board-power-actions';
import { COLOSSUS_BREAK_PAIRS, COLOSSUS_CHIPS_PER_HIT, COLOSSUS_MAX_SPLIT_PAIRS } from './colossus-rules';
import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { inspectBoardFairness, allBoardCards } from './board-inspection';
import { advanceToNextLevel, createNewRun, createWildRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { applyMissBudget, missBankCap, missBankGrantLastFloor, missesLeft } from './miss-bank';
import { runComboHeatPerks } from './combo-heat-perks';
import { hasMutator } from './mutators';
import { hasRelic, usesCampUpgrades, heldRelicIds, relicRank, relicSlotsFull, RELIC_SLOTS, RELIC_SLOTS_FROM } from './run-relic-rules';
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
    /** Pairs held before a release (`hold-rules.ts`); three when unset. */
    readonly holdRelease?: number;
    /** Share of turns the player carves when it can (`carve-rules.ts`); never when unset. */
    readonly carveRate?: number;
}

export const SOAK_PLAYERS: Readonly<Record<'careful' | 'average' | 'sloppy' | 'wild' | 'planned', SoakPlayer>> = {
    careful: { missRate: 0.05, bombRate: 0.5, peekRate: 0.1, shuffleRate: 0.02, zoneRate: 0.5, elementRate: 0.9 },
    average: { missRate: 0.18, bombRate: 0.35, peekRate: 0.15, shuffleRate: 0.05, zoneRate: 0.5, elementRate: 0.6 },
    sloppy: { missRate: 0.4, bombRate: 0.25, peekRate: 0.2, shuffleRate: 0.08, zoneRate: 0.5, elementRate: 0.2 },
    wild: { wild: true, missRate: 0.18, bombRate: 0.35, peekRate: 0.15, shuffleRate: 0.05, zoneRate: 0.5, elementRate: 0.6 },
    /*
     * The player the Deep Game pack plays for (DGE-027): good but not perfect, who plans - holds for a
     * stack of five before releasing, so the new verbs meet every invariant in whole runs with the
     * stacks a player who waits would build. The plan also had it take raging doors; current runs
     * travel to a seeded realm with no door to choose, so there is nothing for it to take.
     */
    planned: { missRate: 0.1, bombRate: 0.4, peekRate: 0.1, shuffleRate: 0.02, zoneRate: 0.5, elementRate: 0.8, holdRelease: 5, carveRate: 0.15 }
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
    /** Curios matched (`curio-rules.ts`) and crucibles melted, every one the run was given. */
    curiosClaimed: number;
    cruciblesUsed: number;
    /** Storm glasses broken (`storm-glass-rules.ts`), every one the run was given. */
    stormGlassesBroken: number;
    /** True when the run carried the Miser's Purse (`curio-rules.ts`) at its end. */
    carriedMisersPurse: boolean;
    /** Still bells rung (`still-bell-rules.ts`), whenever the realm held cards. */
    stillBellsRung: number;
    /** The Hold (`hold-rules.ts`): releases made, and pairs the releases popped. */
    holdsReleased: number;
    holdPairsPopped: number;
    /** The most pairs one release held (the planned player waits for five). */
    largestRelease: number;
    /** Boss rewards (`boss-reward-rules.ts`): blueprints held at the end, and boss doors walked through. */
    blueprints: number;
    bossDoorsTaken: number;
    /** The complete Warden (`warden-rules.ts`): met as the test, felled by a release of twelve, and the boards it dealt again. */
    wardenTests: number;
    wardensFelled: number;
    wardenDealsAgain: number;
    /** Carve (`carve-rules.ts`): carves set, and carves a pop spent. */
    carves: number;
    carvesSpent: number;
    /** Masks (`mask-rules.ts`): masks dealt onto floors, and dropped by a first flip. */
    masksDealt: number;
    masksDropped: number;
    /** Sleepers (`sleeper-rules.ts`): woken, and kept down by a chain. */
    sleepersWoken: number;
    sleepersKeptDown: number;
    /** The Spiral (`spiral-rules.ts`): its floors survived, and its rings sealed. */
    spiralFloors: number;
    spiralRings: number;
    /** The dungeon learns you (`learned-rule-rules.ts`): floors told a rule. */
    learnedRules: number;
    /** The Dread spends (`dread-composition-rules.ts`): family pairs and masks it bought. */
    dreadBuys: number;
    /** The Keeper of Halls (`keeper-rules.ts`): its floors met, and its swaps. */
    keeperFloors: number;
    keeperSwaps: number;
    /** The Cartographer (`cartographer-rules.ts`): its floors met, and its turns. */
    cartographerFloors: number;
    cartographerTurns: number;
    /** Reprise (`reprise-rules.ts`): Reprises pressed. */
    reprises: number;
    /** Relic evolutions bought, and by which floor the first came (`relic-evolution-rules.ts`). */
    evolutions: number;
    firstEvolutionFloor: number | null;
    /** The deepest Dread tier the run reached (`dread-rules.ts`), as its index in `DREAD_TIERS`. */
    dreadTierPeak: number;
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
    /** The Wanderers (`wanderer-rules.ts`): floors dealt with them, and the steps they took. */
    wandererFloors: number;
    /** The Fold (`board-fold-rules.ts`): floors dealt as two rooms. */
    foldFloors: number;
    /** Layers (`board-layers-rules.ts`): floors dealt two decks deep, and cards that rose into a cleared cell. */
    layerFloors: number;
    layerCardsRisen: number;
    wandererSteps: number;
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


/** Pairs over every card the floor was dealt: a second deck’s and the cards a rising one took the cell of count too (`board-layers-rules.ts`). */
const pairsOf = (board: BoardState): Map<string, Tile[]> => {
    const byPair = new Map<string, Tile[]>();
    for (const tile of allBoardCards(board).filter((card) => !isSingletonUtilityPairKey(card.pairKey))) byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
    return byPair;
};

const isGone = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const nonNegativeInteger = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Every invariant, in the order a failure is most useful to read. */
export const SOAK_INVARIANTS: Readonly<Record<string, Check>> = {
    'featured reaction progress cannot be lost on a turn of the same floor': (before, run) => {
        if (!before || before.board?.level !== run.board?.level) return null;
        return (before.amplifiedGoalThisFloor && !run.amplifiedGoalThisFloor) || (before.calmGoalThisFloor && !run.calmGoalThisFloor) ? 'secured elemental goal was lost' : null;
    },
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
    'a fixed Colossus breaks into pairs of its own element, dealt face down': (before, run, action) => {
        // A Zone replays several turns in one action: a piece dealt by one of them can be taken by a
        // later one (its pop, a reaction), which is play, not a bad deal. The deal is judged per turn.
        if (action === 'zone-flip' || action === 'zone-resolve') return null;
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
            ['crucibleCharges', run.crucibleCharges ?? 0],
            ['stormGlassCharges', run.stormGlassCharges ?? 0],
            ['stillBellCharges', run.stillBellCharges ?? 0],
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
        // A Candle given up for the Purse (DGE-013) leaves what it lit lit until the next flip.
        if (!before || hasMutator(run, 'lantern_light') || hasRelic(run, 'tallow_candle') || hasRelic(before, 'tallow_candle')) return null;
        // Lantern of Recall keeps what it lit lit for the floor (`relic-evolution-rules.ts`).
        if (hasEvolution(run, 'lantern_of_recall')) return null;
        // A Zone replays several turns in one action, and the combo its matches build lights the
        // later ones: the heat carried into the action is not the heat the last turn resolved on.
        if (action === 'zone-flip' || action === 'zone-resolve') return null;
        // What this action lit: light carried over unchanged (a Candle since given up, a no-op flip) is not the afterglow's.
        const wasLit = new Set(before.lanternLitTileIds ?? []);
        const nowLit = run.lanternLitTileIds ?? [];
        if (nowLit.length === wasLit.size && nowLit.every((id) => wasLit.has(id))) return null;
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
    'a crucible costs one charge and one pair: no turn, no miss and no score': (before, run, action) => {
        if (!before?.board || !run.board || action !== 'crucible') return null;
        if (run.turnsThisFloor !== before.turnsThisFloor) return 'a crucible counted a turn';
        if (run.stats.mismatches !== before.stats.mismatches) return 'a crucible counted a miss';
        if (run.stats.totalScore !== before.stats.totalScore) return 'a crucible paid score';
        if ((run.crucibleCharges ?? 0) !== (before.crucibleCharges ?? 0) - 1) return `crucibles ${before.crucibleCharges} -> ${run.crucibleCharges}`;
        if (run.board.matchedPairs !== before.board.matchedPairs + 1) return `matched ${before.board.matchedPairs} -> ${run.board.matchedPairs}`;
        return run.board.tiles.length === before.board.tiles.length ? null : `${before.board.tiles.length} cards -> ${run.board.tiles.length}`;
    },
    'a storm glass costs one glass, no turn, no miss, and leaves the weather clock where it was': (before, run, action) => {
        if (!before?.board || !run.board || action !== 'storm-glass') return null;
        if (run.turnsThisFloor !== before.turnsThisFloor) return 'a storm glass counted a turn';
        if (run.stats.mismatches !== before.stats.mismatches) return 'a storm glass counted a miss';
        if ((run.stormGlassCharges ?? 0) !== (before.stormGlassCharges ?? 0) - 1) return `glasses ${before.stormGlassCharges} -> ${run.stormGlassCharges}`;
        if ((run.realmWeatherThisFloor ?? 0) !== (before.realmWeatherThisFloor ?? 0)) return `the clock moved ${before.realmWeatherThisFloor} -> ${run.realmWeatherThisFloor}`;
        return run.board.tiles.length === before.board.tiles.length ? null : `${before.board.tiles.length} cards -> ${run.board.tiles.length}`;
    },
    'a held match takes its own pair and nothing else': (before, run, action) => {
        if (!before?.board || !run.board || !before.holding || action !== 'resolve') return null;
        const taken = run.board.matchedPairs - before.board.matchedPairs;
        return taken <= 1 ? null : `a held match took ${taken} pairs`;
    },
    'a footprint lies one step from the Wanderer that left it, on its own turn, and lasts that turn': (before, run, action) => {
        // The Cartographer's Thread (`relic-evolution-rules.ts`) keeps a footprint for three turns: only a fresh one
        // is judged by its turn and its Wanderer; an older one is the Thread's, worn down a turn at a time.
        const prints = wandererFootprintCells(run.board).filter((cell) => runNonNegativeInteger(run.board!.tiles[cell]!.footprint) >= footprintTurns(run));
        if (prints.length === 0 || !run.board) return null;
        if (run.status === 'levelComplete' || run.status === 'gameOver') return `footprints on a floor that is over (${run.status})`;
        // Checked on the turn that left them: a bomb, a shuffle or a release between turns may take or move the
        // Wanderer, and its footprint stays until the next turn resolves.
        if (action !== 'resolve' || !before || run.turnsThisFloor <= before.turnsThisFloor) return null;
        if (!isWandererStepTurn(run.turnsThisFloor)) return `footprints on turn ${run.turnsThisFloor}, not a Wanderer's`;
        // The Warden re-deals after the step (`warden-rules.ts`), which may carry a Wanderer off.
        if (isWardenFloor(run.board)) return null;
        const { columns, tiles } = run.board;
        for (const cell of prints) {
            if (tiles[cell]?.wanderer) return `a Wanderer stands on its own footprint at ${cell}`;
            const near = [cell - columns, cell + columns, cell % columns > 0 ? cell - 1 : -1, cell % columns < columns - 1 ? cell + 1 : -1];
            if (!near.some((index) => index >= 0 && tiles[index]?.wanderer)) return `no Wanderer beside the footprint at ${cell}`;
        }
        return null;
    },
    'on the Fold a turn takes nothing through the wall, and through the door only from a match in the doorway': (before, run, action) => {
        if (action !== 'resolve' || !before?.board?.fold || !run.board || before.board.level !== run.board.level) return null;
        const flipped = before.board.flippedTileIds;
        if (flipped.length < 2) return null;
        const at = (id: string) => before.board!.tiles.findIndex((tile) => tile.id === id);
        const seeds = flipped.map(at).filter((index) => index >= 0);
        if (foldDoorOpenFor(before.board, seeds)) return null;
        const rooms = new Set(seeds.map((index) => foldRoomOf(before.board!, index)));
        for (const [index, tile] of before.board.tiles.entries()) {
            if (tile.state !== 'hidden' || flipped.includes(tile.id)) continue;
            const now = run.board.tiles.find((candidate) => candidate.id === tile.id);
            if (now?.state !== 'removed' || rooms.has(foldRoomOf(before.board, index))) continue;
            // The drop takes a suit left with no pair to pop from anywhere: that is mercy, not a cascade.
            const suitLeft = run.board.tiles.some((other) => other.state === 'hidden' && other.suit === tile.suit && tileCanBreakInChunk(other));
            if (suitLeft) return `${tile.id} was taken through the wall at cell ${index}`;
        }
        return null;
    },
    'no cleared cell sits over a waiting card, unless the Hold keeps it': (_before, run) => {
        const under = run.board?.beneath;
        if (!under || run.status === 'levelComplete' || run.status === 'gameOver') return null;
        const held = new Set(run.heldSeedIds ?? []);
        const stuck = under.flatMap((card, index) => {
            const top = run.board!.tiles[index];
            return card && (top?.state === 'matched' || top?.state === 'removed') && !held.has(top.id) ? [index] : [];
        });
        return stuck.length === 0 ? null : `cleared cells over a waiting card: ${stuck.join(', ')}`;
    },
    'a floor ends only when both decks are cleared': (_before, run) =>
        run.status === 'levelComplete' && run.board?.beneath?.some(Boolean) ? 'the floor cleared with cards still beneath it' : null,
    'a run never holds more relics than its slots': (_before, run) =>
        (run.runRulesVersion ?? 0) >= RELIC_SLOTS_FROM && heldRelicIds(run).length > RELIC_SLOTS ? `${heldRelicIds(run).length} relics: ${heldRelicIds(run).join(',')}` : null,
    'an evolution is bought only with its blueprint, and two never share a first ingredient': (_before, run) => {
        const evolved = run.evolutions ?? [];
        const missing = evolved.filter((id) => !(run.blueprints ?? []).includes(id));
        if (missing.length > 0) return `evolved without a blueprint: ${missing.join(',')}`;
        const firsts = evolved.map((id) => EVOLUTIONS.find((recipe) => recipe.id === id)?.from[0]);
        return new Set(firsts).size === firsts.length ? null : `two evolutions on one first ingredient: ${evolved.join(',')}`;
    },
    'blueprints drop in order and never twice': (_before, run) => {
        const held = run.blueprints ?? [];
        return held.every((id, index) => id === BLUEPRINT_ORDER[index]) ? null : `blueprints out of order: ${held.join(',')}`;
    },
    'nothing is held into a cleared floor, and a held pair is a matched one': (_before, run) => {
        if (run.status === 'levelComplete' && (run.holding || (run.heldSeedIds ?? []).length > 0)) return 'the floor cleared with a hold held';
        const unmatched = (run.heldSeedIds ?? []).filter((id) => run.board?.tiles.find((tile) => tile.id === id)?.state !== 'matched');
        return unmatched.length === 0 ? null : `held seeds not matched: ${unmatched.join(',')}`;
    },
    'an Endless clear paid its rent, or the run ended there': (before, run) => {
        if (!before || !run.endless || before.status === 'levelComplete' || (run.status !== 'levelComplete' && run.status !== 'gameOver')) return null;
        const level = run.board?.level ?? 0;
        const rent = endlessRentForFloor(level, run.runRulesVersion);
        if (rent === 0 || !run.lastLevelResult || run.lastLevelResult.level !== level) return null;
        const paid = run.lastLevelResult.scoreGained;
        if (paid >= rent) return run.status === 'levelComplete' ? null : `paid ${paid} of ${rent} and still ended`;
        return run.runEndReason === 'rent_unpaid' ? null : `paid ${paid} of ${rent}, ended ${String(run.runEndReason)}`;
    },
    'Dread never falls, and every descent raises it': (before, run, action) => {
        if (!before) return null;
        const [was, now] = [dreadForRun(before), dreadForRun(run)];
        if (now < was) return `Dread fell ${was.toFixed(2)} -> ${now.toFixed(2)}`;
        return action === 'descend' && run.board?.level !== before.board?.level && now <= was ? `a descent left Dread at ${now.toFixed(2)}` : null;
    },
    'a still bell costs one bell, no turn, no miss, and leaves the weather clock where it was': (before, run, action) => {
        if (!before?.board || !run.board || action !== 'still-bell') return null;
        if (run.turnsThisFloor !== before.turnsThisFloor) return 'a still bell counted a turn';
        if (run.stats.mismatches !== before.stats.mismatches) return 'a still bell counted a miss';
        if ((run.stillBellCharges ?? 0) !== (before.stillBellCharges ?? 0) - 1) return `bells ${before.stillBellCharges} -> ${run.stillBellCharges}`;
        if ((run.realmWeatherThisFloor ?? 0) !== (before.realmWeatherThisFloor ?? 0)) return `the clock moved ${before.realmWeatherThisFloor} -> ${run.realmWeatherThisFloor}`;
        return run.board.tiles.length === before.board.tiles.length ? null : `${before.board.tiles.length} cards -> ${run.board.tiles.length}`;
    },
    'a miss costs the tries it charged, as far as the bank covers them': (before, run, action) => {
        if (!before || action !== 'resolve' || run.stats.mismatches <= before.stats.mismatches) return null;
        const had = missesLeft(before) ?? 0;
        if (had === 0) return run.status === 'gameOver' ? null : 'a miss on an empty bank did not end the run';
        // On the Warden's floor a turn past par costs one more (`warden-rules.ts`).
        const warden = isWardenFloor(run.board) && run.turnsThisFloor > parTurnsForRun(run) ? 1 : 0;
        const owed = Math.min(had, Math.max(1, run.stats.tries - before.stats.tries) + warden);
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
    'the Cartographer\u2019s turn keeps every card beneath, and a pinned cell keeps its own': (before, run) => {
        if (!before?.board || !run.board || runNonNegativeInteger(run.cartographerTurnsThisFloor) <= runNonNegativeInteger(before.cartographerTurnsThisFloor)) return null;
        if (run.board.level !== before.board.level) return null;
        const pinnedCells = (run.pinnedTileIds ?? []).map((id) => before.board!.tiles.findIndex((tile) => tile.id === id)).filter((cell) => cell >= 0);
        const held = pinnedCells.find((cell) => run.board!.tiles[cell]?.id === before.board!.tiles[cell]?.id && (run.board!.beneath?.[cell]?.id ?? null) !== (before.board!.beneath?.[cell]?.id ?? null));
        return held != null ? `the card under pinned cell ${held} moved` : null;
    },
    'the Keeper\u2019s swap keeps every card and holds every pinned cell': (before, run) => {
        if (!before?.board || !run.board || runNonNegativeInteger(run.keeperSwapsThisFloor) <= runNonNegativeInteger(before.keeperSwapsThisFloor)) return null;
        if (run.board.level !== before.board.level) return null;
        // The same action may also deal (a void's spew into cleared cells), so the swap is judged by count and pins.
        if (run.board.tiles.length !== before.board.tiles.length) return 'the swap changed the size of the board';
        const moved = (run.pinnedTileIds ?? []).find((id) => run.board!.tiles.findIndex((tile) => tile.id === id) !== before.board!.tiles.findIndex((tile) => tile.id === id));
        return moved ? `pinned ${moved} moved in the swap` : null;
    },
    // Which pairs a dealer may take (plain, unmarked, not held by the realm) is the dealer's own and is pinned by
    // `learned-rule-rules.test.ts`; the soak checks what it can see whole: the rule told is the one the run earned.
    'a told rule names the element the run matched most, from the table': (before, run, action) => {
        const rule = run.learnedRule;
        if (action !== 'descend' || !rule || !before) return null;
        if (!LEARNED_RULE_TABLE.includes(rule.id)) return `${rule.id} is not in the table`;
        const learned = mostMatchedSuit(before);
        return rule.suit === learned ? null : `told ${rule.suit}, but the run matched ${String(learned)} most`;
    },
    // The Dread spends (`dread-composition-rules.ts`): what a floor says it bought is what its Dread buys, and a floor
    // never holds more of a family than its schedule and the purchase.
    'the Dread buys what its tier pays for, and the floor holds no more': (before, run, action) => {
        if (action !== 'descend' || !before || !run.board || !dreadComposes(run)) return null;
        const board = run.board;
        const depth = run.depth ?? 0;
        const seeded = { rulesVersion: run.runRulesVersion, depth };
        const scheduled = { sleeper: sleeperCountFor(board, seeded), mask: maskCountFor(board, seeded), wanderer: wandererCountFor(board, seeded) };
        const expected = dreadPurchase(dreadForRun(run), scheduled);
        const told = run.dreadBought ?? NO_DREAD_PURCHASE;
        if (told.sleeper !== expected.sleeper || told.mask !== expected.mask || told.wanderer !== expected.wanderer) return `told ${JSON.stringify(told)}, the Dread buys ${JSON.stringify(expected)}`;
        const pairs = (flag: 'wanderer' | 'sleeper') => new Set(board.tiles.filter((tile) => tile[flag]).map((tile) => tile.pairKey)).size;
        const masks = board.tiles.filter((tile) => tile.mask != null).length;
        if (pairs('wanderer') > scheduled.wanderer + told.wanderer) return `${pairs('wanderer')} Wanderer pairs, past ${scheduled.wanderer} + ${told.wanderer}`;
        if (masks > scheduled.mask + told.mask && !hasEvolution(run, 'unmasking_glass')) return `${masks} masks, past ${scheduled.mask} + ${told.mask}`;
        return null;
    },
    'a Spiral never runs past par, and nothing is dealt into a sealed cell': (_before, run) => {
        if (!run.board || !spiralHolds(run, run.board)) return null;
        if (run.status === 'playing' && runNonNegativeInteger(run.turnsThisFloor) > parTurnsForRun(run)) return `a Spiral at turn ${run.turnsThisFloor}, past par ${parTurnsForRun(run)}`;
        const dealt = run.board.tiles.find((tile) => tile.sealed && tile.state !== 'removed');
        return dealt ? `sealed cell holds ${dealt.id} (${dealt.state})` : null;
    },
    'a woken Sleeper is face down, and none sleeps past a cleared floor': (before, run) => {
        if (!before || !run.board) return null;
        if (run.status === 'levelComplete' && (run.sleepingPairs ?? []).length > 0) return 'a floor cleared with a Sleeper asleep';
        if (run.board.level !== before.board?.level || runNonNegativeInteger(run.sleepersWokenThisFloor) <= runNonNegativeInteger(before.sleepersWokenThisFloor)) return null;
        const woken = new Set((before.sleepingPairs ?? []).map((pair) => pair.pairKey).filter((key) => !(run.sleepingPairs ?? []).some((pair) => pair.pairKey === key)));
        const up = run.board.tiles.find((tile) => woken.has(tile.pairKey) && tile.state !== 'hidden' && tile.state !== 'flipped' && tile.state !== 'matched');
        return up ? `woken ${up.id} came back ${up.state}` : null;
    },
    'a mask is never on both cards of a pair, and no face-up card wears one': (_before, run) => {
        const tiles = run.board?.tiles ?? [];
        const up = tiles.find((tile) => tile.mask != null && (tile.state === 'flipped' || tile.state === 'matched'));
        if (up) return `${up.id} is ${up.state} and masked`;
        const both = tiles.find((tile) => tile.mask != null && tiles.some((other) => other.id !== tile.id && other.pairKey === tile.pairKey && other.mask != null));
        if (both) return `pair ${both.pairKey} masked twice`;
        const false_ = tiles.find((tile) => tile.mask != null && tile.mask === tile.suit);
        return false_ ? `${false_.id} masked as its own element` : null;
    },
    'a Reprise costs no turn and comes once a floor': (before, run, action) => {
        if (action !== 'reprise') return null;
        if (!before || before.repriseUsedThisFloor) return 'a second Reprise on one floor';
        return run.turnsThisFloor === before.turnsThisFloor && run.repriseUsedThisFloor ? null : 'a Reprise cost a turn';
    },
    'a carve is set between turns for two links and no turn, and never outlives its floor': (before, run, action) => {
        if (action === 'carve') {
            if (!before?.board || before.board.flippedTileIds.length > 0) return 'carved with a card face up';
            if ((before.holdLinks ?? 0) - (run.holdLinks ?? 0) !== carveLinksFor(before)) return `links ${String(before.holdLinks)} -> ${String(run.holdLinks)}`;
            return run.turnsThisFloor === before.turnsThisFloor && run.stats.tries === before.stats.tries ? null : 'a carve cost a turn';
        }
        return action === 'descend' && run.carveDirection != null ? 'a carve outlived its floor' : null;
    },
    'the test Warden falls only to a release of twelve, and an empty board is dealt again': (before, run) => {
        if (!before || !run.board || !wardenTestHolds(run)) return null;
        if (run.status === 'levelComplete' && before.status === 'playing') return run.wardenFelled ? null : 'the test Warden cleared without a release of twelve';
        if (run.status === 'playing' && run.board.tiles.every((tile) => tile.state !== 'hidden')) return 'the test Warden left an empty board in play';
        return null;
    },
    'a floor clear selects the next arena; historical runs, and the clear before an act boss, offer doors': (before, run) => {
        if (run.status !== 'levelComplete' || before?.status === 'levelComplete' || !run.realmId) return null;
        // From rules 75 the clear before an act boss offers its three doors again (`boss-reward-rules.ts`).
        if (usesCampUpgrades(run) && !(before && offersBossDoors(before))) return run.nextRealm && !run.realmDoors?.length ? null : 'next arena missing or choices still offered';
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
    campPreference,
    depth = 0,
    observe
}: {
    seed: number;
    player: SoakPlayer;
    playerName: string;
    maxFloors?: number;
    maxActions?: number;
    campPreference?: RunState['campPreference'];
    /** The Depths (`depth-rules.ts`): every rung up to this one in play. */
    depth?: number;
    /** Sees every action as it is taken, for an instrument measuring something the report does not count. */
    observe?: (before: RunState, next: RunState, action: string) => void;
}): SoakRunReport => {
    const rng = createMulberry32(hashStringToSeed(`soak:${seed}:${playerName}`));
    const pick = <T>(items: readonly T[]): T => items[pickRngIndex(rng, items.length)]!;
    const violations: SoakViolation[] = [];
    let run: RunState = player.wild
        ? createWildRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, campPreference, depth })
        : createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, campPreference, depth });
    let step = 0;
    let turns = 0;
    let purchases = 0;
    let bombsUsed = 0;
    let cruciblesUsed = 0;
    let stormGlassesBroken = 0;
    let stillBellsRung = 0;
    let holdsReleased = 0;
    let holdPairsPopped = 0;
    let largestRelease = 0;
    let bossDoorsTaken = 0;
    let wardenTests = 0;
    let wardensFelled = 0;
    let wardenDealsAgain = 0;
    let carves = 0;
    let carvesSpent = 0;
    let masksDealt = 0;
    let masksDropped = 0;
    let sleepersWoken = 0;
    let sleepersKeptDown = 0;
    let spiralFloors = 0;
    let spiralRings = 0;
    let learnedRules = 0;
    let dreadBuys = 0;
    let keeperFloors = 0;
    let keeperSwaps = 0;
    let cartographerFloors = 0;
    let cartographerTurns = 0;
    let reprises = 0;
    let firstEvolutionFloor: number | null = null;
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
    let wandererFloors = 0;
    let foldFloors = 0;
    let layerFloors = 0;
    let layerCardsRisen = 0;
    let wandererSteps = 0;
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
        if (action === 'descend') masksDealt += (next.board?.tiles ?? []).filter((tile) => tile.mask != null).length;
        if (next.status === 'levelComplete' && run.status !== 'levelComplete' && next.spiralSurvived) spiralFloors += 1;
        if (next.board?.level === run.board?.level) spiralRings += Math.max(0, runNonNegativeInteger(next.spiralRingsSealedThisFloor) - runNonNegativeInteger(run.spiralRingsSealedThisFloor));
        if (next.board?.level === run.board?.level) {
            sleepersWoken += Math.max(0, runNonNegativeInteger(next.sleepersWokenThisFloor) - runNonNegativeInteger(run.sleepersWokenThisFloor));
            sleepersKeptDown += Math.max(0, runNonNegativeInteger(next.sleepersKeptDownThisFloor) - runNonNegativeInteger(run.sleepersKeptDownThisFloor));
        }
        if (action === 'descend' && isKeeperFloor(next.board)) keeperFloors += 1;
        if (action === 'descend' && next.learnedRule) learnedRules += 1;
        if (action === 'descend' && next.dreadBought) dreadBuys += next.dreadBought.sleeper + next.dreadBought.mask + next.dreadBought.wanderer;
        if (action === 'descend' && isCartographerFloor(next.board)) cartographerFloors += 1;
        if (next.board?.level === run.board?.level && runNonNegativeInteger(next.cartographerTurnsThisFloor) > runNonNegativeInteger(run.cartographerTurnsThisFloor)) cartographerTurns += 1;
        if (next.board?.level === run.board?.level && runNonNegativeInteger(next.keeperSwapsThisFloor) > runNonNegativeInteger(run.keeperSwapsThisFloor)) keeperSwaps += 1;
        if (next.board?.level === run.board?.level && runNonNegativeInteger(next.masksDroppedThisFloor) > runNonNegativeInteger(run.masksDroppedThisFloor)) masksDropped += 1;
        if (runNonNegativeInteger(next.carvesSpentThisFloor) > runNonNegativeInteger(run.carvesSpentThisFloor) && next.board?.level === run.board?.level) carvesSpent += 1;
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
            if (next.board.tiles.some((tile) => tile.wanderer)) wandererFloors += 1;
            if (next.board.fold) foldFloors += 1;
            if (next.board.beneath?.some(Boolean)) layerFloors += 1;
            if (next.board.tiles.some((tile) => tile.hourglass != null)) hourglassFloors += 1;
        }
        turncoatTurns += Math.max(0, (next.turncoatTurnsThisFloor ?? 0) - (run.turncoatTurnsThisFloor ?? 0));
        if (firstEvolutionFloor === null && (next.evolutions ?? []).length > 0) firstEvolutionFloor = next.board?.level ?? null;
        if (next.board?.level === run.board?.level) layerCardsRisen += Math.max(0, (next.layerCardsRisenThisFloor ?? 0) - (run.layerCardsRisenThisFloor ?? 0));
        if (next.board?.level === run.board?.level) wandererSteps += Math.max(0, (next.wandererStepsThisFloor ?? 0) - (run.wandererStepsThisFloor ?? 0));
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
        if (run.status === 'gameOver') {
            if (run.board && wardenTestHolds(run)) {
                wardenTests += 1;
                wardenDealsAgain += run.wardenDealsAgainThisFloor ?? 0;
            }
            break;
        }
        if (run.status === 'levelComplete') {
            floorsCleared += 1;
            if (run.board && wardenTestHolds(run)) {
                wardenTests += 1;
                if (run.wardenFelled) wardensFelled += 1;
                wardenDealsAgain += run.wardenDealsAgainThisFloor ?? 0;
            }
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
                if (offersBossDoors(run)) bossDoorsTaken += 1;
                act('travel', chooseRealmDoor(run, pickRngIndex(rng, run.realmDoors.length)));
            }
            // A soak that runs past the Warden goes on into Endless (DGE-006), where the rent is charged.
            if (awaitsWardenChoice(run)) act('endless', descendIntoEndless(run));
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
        // Every player takes up the Miser's Purse when a Curio offers it: the soak wants it carried.
        if (canTakeMisersPurse(run)) {
            // With every slot held (DGE-013) it gives up its lowest-ranked relic for it.
            const lowest = relicSlotsFull(run) ? [...heldRelicIds(run)].filter((id) => id !== 'misers_purse').sort((a, b) => relicRank(run, a) - relicRank(run, b))[0] : undefined;
            const taken = takeMisersPurse(run, lowest);
            if (taken) {
                act('take-purse', taken);
                continue;
            }
        }
        // Reprise (`reprise-rules.ts`): every player presses it once its last turns were all matches.
        if (canReprise(run) && (run.repriseTurns ?? []).slice(-repriseTurnsFor(run)).every((turn) => turn.matched)) {
            reprises += 1;
            act('reprise', reprise(run, applyMissBudget));
            continue;
        }
        // Carve (`carve-rules.ts`): a player who carves aims the next pop, a direction at random.
        if (player.carveRate && canCarve(run) && rng() < player.carveRate) {
            carves += 1;
            act('carve', carve(run, pick(CARVE_DIRECTIONS)));
            continue;
        }
        // The Hold: held as soon as it arms, released at three held pairs (`hold-rules.ts`).
        if (canStartHold(run)) {
            act('hold', startHold(run));
            continue;
        }
        // The test Warden falls only to twelve held (`warden-rules.ts`): every player waits for them there.
        if (canReleaseHold(run) && heldPairCount(run) >= (wardenTestHolds(run) ? WARDEN_FELL_PAIRS : (player.holdRelease ?? 3))) {
            const released = releaseHold(run);
            if (released) {
                holdsReleased += 1;
                holdPairsPopped += released.pairs;
                largestRelease = Math.max(largestRelease, released.held);
                act('release', released.run);
                continue;
            }
        }
        // A still bell rings as soon as the realm holds a card.
        if (canRingStillBell(run)) {
            const rung = applyStillBell(run);
            if (rung) {
                stillBellsRung += 1;
                act('still-bell', rung.run);
                continue;
            }
        }
        // Every storm glass the run is given gets broken, at the top of a turn on a realm floor.
        if (canBreakStormGlass(run)) {
            const broken = applyStormGlass(run);
            if (broken) {
                stormGlassesBroken += 1;
                act('storm-glass', broken.run);
                continue;
            }
        }
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
        // Every crucible the run is given gets used, on the first card it can melt.
        if (crucibleTargetTileId(run) === first.id) {
            const melted = applyCrucible(run, first.id);
            if (melted) {
                cruciblesUsed += 1;
                act('crucible', melted.run);
                continue;
            }
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
        curiosClaimed: runNonNegativeInteger(run.curiosClaimedThisRun),
        cruciblesUsed,
        stormGlassesBroken,
        carriedMisersPurse: (run.relics ?? []).includes('misers_purse'),
        stillBellsRung,
        holdsReleased,
        holdPairsPopped,
        largestRelease,
        blueprints: runBlueprints(run).length,
        evolutions: (run.evolutions ?? []).length,
        firstEvolutionFloor,
        bossDoorsTaken,
        wardenTests,
        wardensFelled,
        wardenDealsAgain,
        carves,
        carvesSpent,
        masksDealt,
        masksDropped,
        sleepersWoken,
        sleepersKeptDown,
        spiralFloors,
        spiralRings,
        learnedRules,
        dreadBuys,
        keeperFloors,
        keeperSwaps,
        cartographerFloors,
        cartographerTurns,
        reprises,
        dreadTierPeak: dreadTier(dreadForRun(run)).index,
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
        wandererFloors,
        foldFloors,
        layerFloors,
        layerCardsRisen,
        wandererSteps,
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
