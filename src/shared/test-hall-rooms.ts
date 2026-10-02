import {
    applyBomb,
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    bombTargetTileId,
    cancelResolvingWithUndo
} from './board-power-actions';
import { inspectRunFairness } from './board-inspection';
import type { BoardState, MutatorId, RunState, Tile, TileSuit, TileTraitKind } from './contracts';
import { togglePinnedTile } from './board-power-state';
import { countFindablePairs } from './board-tile-generation-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { FLOOR_CURIOS, MIN_CURIO_MEMORIZE_MS } from './floor-curio-rules';
import { advanceToNextLevel, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap, missesLeft } from './miss-bank';
import { buyStoreItem, isStoreStopFloor, runGold, type StoreItemId } from './run-store-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { anchorMarkedTileId } from './n-back-anchor-rules';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { WILD_PAIR_KEY } from './tile-identity';
import { runChainTier } from './chain-tier-rules';
import { igniteZone, resolveZone, zoneFlipTile } from './zone-rules';
import { chooseRealmDoor } from './realm-rules';
import { isTileFlipBlocked } from './realm-weather-rules';
import { tileCharge } from './element-alchemy-rules';

/**
 * The test hall: one small authored room per mechanic, the game-dev "flat" where every system can
 * be walked up to and poked.
 *
 * A generated floor exercises what the deal happens to deal; a room exercises exactly one thing,
 * on a board laid out so the thing is the first thing that happens. Each room is three things at
 * once:
 *
 * - a **place a person can stand** - the dev screen at `/__hall` loads any room straight into play,
 *   with a line saying what to try;
 * - a **scripted walkthrough** - steps played through the game's own functions, each followed by
 *   an expectation, which `test-hall-rooms.test.ts` runs for every room on every commit;
 * - a **node in the interaction graph** - `graphMechanicIds` names the mechanics the room exercises,
 *   so the hall can say which parts of the graph nothing has ever been walked through.
 *
 * The browser sweep (`e2e/test-hall.spec.ts`) loads every room in the real app and plays the same
 * script through the board, which is the half of a mechanic a unit test cannot see.
 */
export type TestHallRoomId =
    | 'pairs'
    | 'combo-carries'
    | 'combo-ends-on-miss'
    | 'miss-bank-edge'
    | 'chain-earns-miss'
    | 'clean-pop'
    | 'severance-drop'
    | 'fever-bridge'
    | 'bomb'
    | 'bomb-last-pair'
    | 'store-stop'
    | 'deep-pockets'
    | 'long-look'
    | 'tallow-candle'
    | 'restless-floor'
    | 'magpie'
    | 'score-glint'
    | 'peek'
    | 'shuffle'
    | 'tile-swap'
    | 'row-shuffle'
    | 'undo'
    | 'flash-pair'
    | 'echo'
    | 'heavy'
    | 'gambit'
    | 'pin'
    | 'wild'
    | 'conduit'
    | 'stasis'
    | 'sticky-fingers'
    | 'skittish'
    | 'lantern'
    | 'heat-afterglow'
    | 'heat-pop'
    | 'zone'
    | 'void-spew'
    | 'n-back'
    | 'spotlight'
    | 'wide-recall'
    | 'silhouette'
    | 'floor-pay'
    | 'featured-streak'
    | 'featured-streak-miss'
    | 'next-floor'
    | 'short-memorize'
    | 'dense-pickups'
    | 'wild-run'
    | 'no-shuffle'
    | 'session-stats'
    | 'journal'
    | 'realm-frostbite'
    | 'realm-blizzard'
    | 'realm-wildfire'
    | 'realm-burnout'
    | 'realm-current'
    | 'realm-lightning'
    | 'realm-vines'
    | 'realm-overgrowth'
    | 'realm-travel'
    | 'realm-whiteout'
    | 'realm-thunderclap'
    | 'realm-bloom'
    | 'realm-confluence'
    | 'realm-attunement'
    | 'realm-smoke'
    | 'realm-chill'
    | 'realm-scald'
    | 'realm-undertow'
    | 'realm-static'
    | 'realm-snare'
    | 'realm-sway'
    | 'element-fire'
    | 'element-water'
    | 'element-frost'
    | 'element-grove'
    | 'element-kin'
    | 'element-neutralize'
    | 'element-resonance'
    | 'element-steam'
    | 'element-blaze'
    | 'element-thaw'
    | 'element-freezeover'
    | 'element-flood'
    | 'element-frostbloom'
    | 'realm-depth';

export type TestHallStep =
    | { readonly do: 'match'; readonly pairKey: string }
    | { readonly do: 'miss'; readonly a: string; readonly b: string }
    | { readonly do: 'flip'; readonly tileId: string }
    | { readonly do: 'bomb' }
    | { readonly do: 'peek'; readonly tileId: string }
    | { readonly do: 'shuffle' }
    | { readonly do: 'swap'; readonly a: string; readonly b: string }
    | { readonly do: 'rowShuffle'; readonly row: number }
    | { readonly do: 'undo' }
    | { readonly do: 'flash' }
    | { readonly do: 'matchAnchor' }
    | { readonly do: 'matchOther' }
    | { readonly do: 'pin'; readonly tileId: string }
    | { readonly do: 'gambit'; readonly a: string; readonly b: string; readonly third: string }
    | { readonly do: 'wild'; readonly tileId: string }
    | { readonly do: 'buy'; readonly item: StoreItemId }
    /** The Zone: ignite it, turn a card inside it, or end it early. */
    | { readonly do: 'ignite' }
    | { readonly do: 'zoneFlip'; readonly tileId: string }
    | { readonly do: 'zoneResolve' }
    /** Miss on the first two face-down cards of different pairs, whatever a pop has left. */
    | { readonly do: 'missAny' }
    | { readonly do: 'clear' }
    /** Descend from a cleared floor to the next one, which opens on its study window. */
    | { readonly do: 'advance' }
    /** Walk through a travel door at a floor clear (`realm-rules.ts`). */
    | { readonly do: 'travel'; readonly door: number }
    /** Match the pair of the card that is burning (an ember realm's wildfire). */
    | { readonly do: 'matchBurning' }
    /** End the study window and start play. */
    | { readonly do: 'study' };

export interface TestHallScriptLine {
    readonly step: TestHallStep;
    /** What the rules say is true after the step: `null` when it is, the reason when it is not. */
    readonly expect: (run: RunState, before: RunState) => string | null;
    readonly says: string;
}

export interface TestHallRoom {
    readonly id: TestHallRoomId;
    readonly title: string;
    /** The one thing the room is for. */
    readonly mechanic: string;
    /** Interaction-graph mechanic ids (`gameplay-interaction-graph-data.json`) the room exercises. */
    readonly graphMechanicIds: readonly string[];
    /** What a person standing in the room should try. */
    readonly tryThis: string;
    readonly build: () => RunState;
    readonly script: readonly TestHallScriptLine[];
}

// ---- Building rooms ------------------------------------------------------------------------

const tile = (id: string, pairKey: string, suit: TileSuit, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: pairKey.toUpperCase(),
    label: pairKey.toUpperCase(),
    state: 'hidden',
    suit,
    ...extra
});

/** A row-major layout: each string is a row, each cell `pairKey:suit` (suit e/t/m/b). */
const layout = (rows: readonly string[]): { tiles: Tile[]; columns: number } => {
    const suits: Record<string, TileSuit> = { e: 'ember', t: 'tide', m: 'moss', b: 'bone' };
    const seen = new Map<string, number>();
    const tiles: Tile[] = [];
    for (const row of rows) {
        for (const cell of row.trim().split(/\s+/)) {
            const [pairKey, suitCode] = cell.split(':') as [string, string];
            const half = (seen.get(pairKey) ?? 0) + 1;
            seen.set(pairKey, half);
            tiles.push(tile(`${pairKey}-${half}`, pairKey, suits[suitCode] ?? 'ember'));
        }
    }
    return { tiles, columns: rows[0]!.trim().split(/\s+/).length };
};

const room = (
    rows: readonly string[],
    {
        level = 4,
        misses = 3,
        streak = 0,
        mutators = [] as MutatorId[],
        run: extra = {} as Partial<RunState>,
        board: boardExtra = {} as Partial<BoardState>,
        tiles: editTiles = (tiles: Tile[]) => tiles
    } = {}
): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 90_210, realm: null }));
    const { tiles, columns } = layout(rows);
    const laid = editTiles(tiles);
    const board: BoardState = {
        ...base.board!,
        level,
        columns,
        rows: rows.length,
        // The joker is a single card, not a pair: counting it made every Wild room's board fail the
        // fairness inspector's tile count.
        pairCount: new Set(laid.filter((t) => t.pairKey !== WILD_PAIR_KEY).map((t) => t.pairKey)).size,
        matchedPairs: 0,
        flippedTileIds: [],
        cursedPairKey: null,
        wardPairKey: null,
        bountyPairKey: null,
        featuredObjectiveId: null,
        tiles: laid,
        ...boardExtra
    };
    return {
        ...base,
        board,
        status: 'playing',
        activeMutators: mutators,
        missBank: [{ floor: level, misses }],
        turnsThisFloor: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: laid.filter((t) => t.findableKind).length / 2,
        chunkPairsThisChain: 0,
        skipMomentumThisChain: 0,
        stats: { ...base.stats, currentStreak: streak, highestLevel: level },
        ...extra
    };
};

// ---- Expectations ----------------------------------------------------------------------------

const gone = (run: RunState, pairKey: string): boolean =>
    (run.board?.tiles ?? []).filter((t) => t.pairKey === pairKey).every((t) => t.state === 'matched' || t.state === 'removed');
const standing = (run: RunState, pairKey: string): boolean =>
    (run.board?.tiles ?? []).filter((t) => t.pairKey === pairKey).every((t) => t.state === 'hidden');
const expectAll =
    (...checks: Array<(run: RunState, before: RunState) => string | null>) =>
    (run: RunState, before: RunState): string | null => {
        for (const check of checks) {
            const problem = check(run, before);
            if (problem) return problem;
        }
        return null;
    };
const isGone = (pairKey: string) => (run: RunState) => (gone(run, pairKey) ? null : `pair ${pairKey} is still on the board`);
const isStanding = (pairKey: string) => (run: RunState) => (standing(run, pairKey) ? null : `pair ${pairKey} left the board`);
const missesAre = (n: number) => (run: RunState) => (missesLeft(run) === n ? null : `misses left ${missesLeft(run)}, expected ${n}`);
const statusIs = (status: RunState['status']) => (run: RunState) => (run.status === status ? null : `status ${run.status}, expected ${status}`);
const order = (run: RunState): string => (run.board?.tiles ?? []).map((t) => t.id).join(',');
const positionOf = (run: RunState, tileId: string): number => (run.board?.tiles ?? []).findIndex((t) => t.id === tileId);
/** A power that is not a turn: no turn counted, no miss spent. */
const costsNothing = (run: RunState, before: RunState): string | null =>
    run.turnsThisFloor !== before.turnsThisFloor ? 'it counted a turn' : missesLeft(run) !== missesLeft(before) ? 'it cost a miss' : null;
const withTrait = (pairKey: string, kind: TileTraitKind) => (tiles: Tile[]) =>
    tiles.map((t) => (t.pairKey === pairKey ? { ...t, tileTraitKind: kind } : t));
const turnsAre = (n: number) => (run: RunState) => (run.turnsThisFloor === n ? null : `turns ${run.turnsThisFloor}, expected ${n}`);
const paid = (run: RunState, before: RunState): number => run.stats.totalScore - before.stats.totalScore;
/**
 * The match pays `delta` against the same match played on `plain(before)` - the room with the
 * thing under test taken away - so a room states a difference instead of a total it would have to
 * keep in step with every other scoring rule.
 */
const matchPaysBeside =
    (pairKey: string, delta: number, plain: (before: RunState) => RunState) =>
    (run: RunState, before: RunState): string | null => {
        const without = plain(before);
        const plainRun = playTestHallStep(without, { do: 'match', pairKey });
        if (!plainRun) return `the plain match of ${pairKey} could not be played`;
        const difference = paid(run, before) - paid(plainRun, without);
        return difference === delta ? null : `paid ${paid(run, before)} against ${paid(plainRun, without)} plain (${difference}), expected ${delta}`;
    };
const withoutMutators = (run: RunState): RunState => ({ ...run, activeMutators: [] });
/** The board inspector's "a way left to finish": no issue, and a route to the clear. */
const finishable = (run: RunState): string | null => {
    const report = inspectRunFairness(run);
    return report.issues.length === 0 && report.hasCompletionRoute ? null : `fairness: ${report.issues.map((i) => i.code).join(',') || 'no completion route'}`;
};
const journaledOneTurn = (run: RunState, before: RunState): string | null => {
    const added = (run.gameplayCommandJournal ?? []).slice((before.gameplayCommandJournal ?? []).length);
    return added.length === 1 && added[0]?.type === 'board.turn_resolve' ? null : `journaled ${added.map((c) => c.type).join(',') || 'nothing'}`;
};
const scheduled = (run: RunState) => pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, run.board?.level ?? 0, run.gameMode);

// ---- The rooms --------------------------------------------------------------------------------

// ---- Realms -----------------------------------------------------------------------------------

const tileById = (run: RunState, id: string): Tile | undefined => (run.board?.tiles ?? []).find((t) => t.id === id);
const realmRun = (realmId: NonNullable<RunState['realmId']>, realmSeverity: NonNullable<RunState['realmSeverity']>, extra: Partial<RunState> = {}): Partial<RunState> => ({
    realmId,
    realmSeverity,
    realmWeatherThisFloor: 0,
    realmReactionsThisFloor: 0,
    realmDousedThisFloor: 0,
    realmBurnoutsThisFloor: 0,
    realmVinesCutThisFloor: 0,
    realmFrozenThisFloor: 0,
    realmLitTileIds: [],
    realmPeaksThisFloor: 0,
    realmSecondaryId: null,
    lastRealmEvent: null,
    ...extra
});
const realmEventIs = (kind: NonNullable<RunState['lastRealmEvent']>['kind']) => (run: RunState) =>
    run.lastRealmEvent?.kind === kind ? null : `the realm's last event was ${run.lastRealmEvent?.kind ?? 'nothing'}, expected ${kind}`;
const goldIs = (n: number) => (run: RunState) => (runGold(run) === n ? null : `gold ${runGold(run)}, expected ${n}`);
const frostIs = (id: string, n: number | undefined) => (run: RunState) =>
    tileById(run, id)?.frost === n ? null : `${id} frost ${tileById(run, id)?.frost}, expected ${n}`;
// A checkerboard of two suits: no card touches one of its own suit, so a match takes its own pair
// and nothing else, and a room can count turns without a pop clearing pairs it means to play.
const EIGHT_PAIRS = ['a:e b:t c:e d:t', 'f:t e:e h:t g:e', 'c:e d:t a:e b:t', 'h:t g:e f:t e:e'];
/**
 * The same board in other elements (`element-alchemy-rules.ts`): a card is untouched by its own
 * element and by the one it puts out, so a room about fire is dealt grove and frost cards, and a
 * room about frost grove and water cards.
 */
const EIGHT_PAIRS_GROWN = EIGHT_PAIRS.map((row) => row.replace(/:e/g, ':m').replace(/:t/g, ':b'));
const EIGHT_PAIRS_THAWED = EIGHT_PAIRS.map((row) => row.replace(/:e/g, ':m'));
/**
 * The resonance rooms' floor (`element-resonance-rules.ts`): fire and water along the top and the
 * bottom, grove and frost between them. On a realm floor a plain match takes its own pair and
 * nothing else; only a reaction bursts more (`elementPopSpec`).
 */
const SIX_ELEMENTS = ['a:e b:t a:e b:t', 'e:m f:b e:m f:b', 'c:e d:t c:e d:t'];
const resonanceIs = (suit: TileSuit, stacks: number) => (run: RunState) =>
    (run.elementResonance?.[suit] ?? 0) === stacks ? null : `${suit} resonance ${run.elementResonance?.[suit] ?? 0}, expected ${stacks}`;
const streakIs = (suit: TileSuit | null, links = 0) => (run: RunState) =>
    (suit === null ? run.elementStreak == null : run.elementStreak?.suit === suit && run.elementStreak.links === links)
        ? null
        : `streak ${JSON.stringify(run.elementStreak ?? null)}, expected ${suit ? `${suit} x${links}` : 'none'}`;
const chargeIs = (id: string, charge: number) => (run: RunState) =>
    tileCharge(tileById(run, id)) === charge ? null : `${id} charge ${tileCharge(tileById(run, id))}, expected ${charge}`;
const reactedOnce = (kind: NonNullable<RunState['lastRealmEvent']>['kind'], potency: number) =>
    expectAll(
        realmEventIs(kind),
        (r) => (r.lastRealmEvent?.potency === potency ? null : `potency ${r.lastRealmEvent?.potency}, expected ${potency}`),
        (r) => ((r.elementReactionsThisFloor ?? 0) === 1 ? null : `reactions ${r.elementReactionsThisFloor}`)
    );

export const TEST_HALL_ROOMS: readonly TestHallRoom[] = [
    {
        id: 'pairs',
        title: 'Pairs',
        mechanic: 'A match takes its pair; a miss costs a turn, a miss from the bank and the chain.',
        graphMechanicIds: ['core.board_turn_resolution', 'objective.floor_clear'],
        tryThis: 'Match a, then miss b against c, then clear the floor.',
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m']),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the match takes pair a', expect: expectAll(isGone('a'), turnsAre(1), (r) => (r.stats.currentStreak === 1 ? null : `streak ${r.stats.currentStreak}`)) },
            { step: { do: 'miss', a: 'b-1', b: 'c-1' }, says: 'the miss spends one miss and resets the chain', expect: expectAll(isStanding('b'), isStanding('c'), missesAre(2), turnsAre(2), (r) => (r.stats.currentStreak === 0 ? null : `streak ${r.stats.currentStreak}`)) },
            { step: { do: 'clear' }, says: 'the floor clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'combo-carries',
        title: 'The combo carries',
        mechanic: 'The combo and its whole ladder cross the stairs and keep climbing: the meter you built is the meter the next floor opens on.',
        graphMechanicIds: ['board.chain_chunk_fever', 'progression.run_flow'],
        tryThis: 'Your combo stands at seven. Match, clear the floor and descend: the combo, its tier and its cascade momentum are all still there.',
        build: () => room(['a:e b:t c:m', 'c:m a:e b:t'], { streak: 7, run: { chunkPairsThisChain: 2 } }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the match adds a link', expect: (r) => (r.stats.currentStreak === 8 ? null : `combo ${r.stats.currentStreak}`) },
            { step: { do: 'clear' }, says: 'the floor clears with the combo standing', expect: expectAll(statusIs('levelComplete'), (r) => (r.stats.currentStreak >= 8 ? null : `combo ${r.stats.currentStreak}`)) },
            {
                step: { do: 'advance' },
                says: 'the next floor opens holding the whole combo, its cascade momentum and its tier',
                expect: expectAll(statusIs('memorize'), (r, b) =>
                    r.stats.currentStreak !== b.stats.currentStreak
                        ? `combo ${b.stats.currentStreak} -> ${r.stats.currentStreak}`
                        : r.chunkPairsThisChain !== b.chunkPairsThisChain
                          ? `cascade momentum ${b.chunkPairsThisChain} -> ${r.chunkPairsThisChain}`
                          : runChainTier(r) !== runChainTier(b)
                            ? `tier ${runChainTier(b)} -> ${runChainTier(r)}`
                            : null)
            }
        ]
    },
    {
        id: 'combo-ends-on-miss',
        title: 'A miss ends the combo',
        mechanic: 'A combo carried down the stairs keeps climbing until a miss, and the miss ends all of it.',
        graphMechanicIds: ['board.chain_chunk_fever', 'core.board_turn_resolution'],
        tryThis: 'You arrive with a combo of twelve at Fever. Match once, then miss.',
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m'], { streak: 12, run: { chunkPairsThisChain: 3 } }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the match adds a link to the combo, still at Fever',
                expect: (r) => (r.stats.currentStreak === 13 && runChainTier(r) === 'fever' ? null : `combo ${r.stats.currentStreak}, tier ${runChainTier(r)}`)
            },
            {
                step: { do: 'miss', a: 'b-1', b: 'c-1' },
                says: 'the miss ends the combo, carried links, cascade momentum and all',
                expect: expectAll(missesAre(2), (r) =>
                    r.stats.currentStreak === 0 && r.chunkPairsThisChain === 0 && runChainTier(r) === 'none' ? null : `combo ${r.stats.currentStreak}, cascade ${r.chunkPairsThisChain}`)
            }
        ]
    },
    {
        id: 'miss-bank-edge',
        title: 'The last miss',
        mechanic: 'A miss with misses left spends one; a miss with none ends the run.',
        graphMechanicIds: ['core.board_turn_resolution', 'economy.miss_bank'],
        tryThis: 'Miss twice. The first is your last; the second ends the run.',
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m'], { misses: 1 }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'the last miss is spent, the run goes on', expect: expectAll(missesAre(0), statusIs('playing')) },
            { step: { do: 'miss', a: 'a-1', b: 'c-1' }, says: 'a miss with none left ends the run', expect: expectAll(statusIs('gameOver'), (r) => (r.runEndReason === 'miss_budget' ? null : `reason ${r.runEndReason}`)) }
        ]
    },
    {
        id: 'chain-earns-miss',
        title: 'Five in a row',
        mechanic: 'Every fifth match in a row earns a miss.',
        graphMechanicIds: ['economy.miss_bank', 'board.chain_chunk_fever', 'feedback.gameplay_hud'],
        tryThis: 'Your chain stands at four. Match any pair: the fifth in a row earns a miss.',
        /*
         * The chain starts at four rather than being played up from nothing. Played up on a small
         * board, the severance drop takes a suit's lone survivor partway through and the "five
         * matches" become four and a pair that is no longer there - a room testing two rules at
         * once, which is what the first version of this one was.
         */
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m'], { misses: 2, streak: 4 }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the fifth in a row earns a miss', expect: expectAll(isGone('a'), missesAre(3)) },
            { step: { do: 'miss', a: 'b-1', b: 'c-1' }, says: 'a miss spends it again', expect: missesAre(2) }
        ]
    },
    {
        id: 'clean-pop',
        title: 'The Clean pop',
        mechanic: 'At Clean a match pops the one same-suit pair it is touching; below Clean it pops nothing.',
        graphMechanicIds: ['board.chain_chunk_fever'],
        tryThis: 'Your chain is at two. Match a: it reaches Clean and pops b, which is touching it.',
        build: () => room(['a:e a:e b:e b:e c:e c:e d:e d:e t:t t:t s:t s:t'], { streak: 2 }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'Clean pops b and nothing further', expect: expectAll(isGone('a'), isGone('b'), isStanding('c'), isStanding('d')) }
        ]
    },
    {
        id: 'severance-drop',
        title: 'The drop',
        mechanic: 'A suit left unable to pop loses its last pair.',
        graphMechanicIds: ['board.cleanup', 'board.chain_chunk_fever'],
        tryThis: 'Chain at two. Match a: Clean pops b, and c - cut off by tide - drops with nothing touching it.',
        build: () => room(['a:e b:e d:t c:e', 'a:e b:e e:t c:e', 'd:t f:t e:t f:t'], { streak: 2 }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'b pops and c drops', expect: expectAll(isGone('b'), isGone('c'), isStanding('d')) }
        ]
    },
    {
        id: 'fever-bridge',
        title: 'The Fever bridge',
        mechanic: 'At Fever a break crosses into the clump its cards were touching, up to four pairs.',
        graphMechanicIds: ['board.chain_chunk_fever'],
        tryThis: 'Chain at Fever. Match a: the ember clump breaks and the fire bridges into tide.',
        build: () => room(['a:e b:e c:e d:t', 'a:e b:e e:t f:t', 'd:t c:e e:t f:t'], { streak: 9 }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'b and c break, then the bridge takes tide up to the cap of four',
                expect: (run, before) => {
                    const took = (run.board?.matchedPairs ?? 0) - (before.board?.matchedPairs ?? 0) - 1;
                    if (!gone(run, 'b') || !gone(run, 'c')) return 'the ember clump did not break';
                    if (!['d', 'e', 'f'].some((key) => gone(run, key))) return 'the fire did not bridge into tide';
                    return took <= 5 ? null : `the break took ${took} pairs, past the cap`;
                }
            }
        ]
    },
    {
        id: 'bomb',
        title: 'The bomb',
        mechanic: 'Flip a card, bomb it: its pair leaves the board with no miss, no turn, no score.',
        graphMechanicIds: ['power.bomb'],
        tryThis: 'Press Bomb, then choose a card. You can also flip a card first and press Bomb.',
        // Uses the normal starting inventory, so this room catches an unreachable starter bomb.
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m']),
        script: [
            { step: { do: 'flip', tileId: 'b-1' }, says: 'one card face up lights the bomb', expect: (r) => (bombTargetTileId(r) === 'b-1' ? null : 'the bomb is not aimed at the flipped card') },
            { step: { do: 'bomb' }, says: 'pair b is gone, nothing else moved', expect: expectAll(isGone('b'), missesAre(3), turnsAre(0), (r) => (r.bombCharges === 0 ? null : `bombs ${r.bombCharges}`)) }
        ]
    },
    {
        id: 'bomb-last-pair',
        title: 'The bomb and the last pair',
        mechanic: 'A bomb never takes the floor\'s last pair: that pair is the clear.',
        graphMechanicIds: ['power.bomb', 'objective.floor_clear'],
        tryThis: 'One real pair and a joker left. Flip a card: the Bomb stays dark. Match the pair instead.',
        build: () =>
            room(['a:e b:t', 'a:e b:t'], {
                run: { bombCharges: 1 },
                board: { matchedPairs: 1, rows: 3 },
                tiles: (tiles) => [
                    ...tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t)),
                    tile('joker', WILD_PAIR_KEY, 'bone')
                ]
            }),
        script: [
            { step: { do: 'flip', tileId: 'b-1' }, says: 'the bomb has no target on the last pair', expect: (r) => (bombTargetTileId(r) === null ? null : 'the bomb would take the last pair') }
        ]
    },
    {
        id: 'store-stop',
        title: 'The store stop',
        mechanic: 'Every third floor, the store opens before the next floor; purchases cost their price.',
        graphMechanicIds: ['progression.store_stop', 'economy.gold'],
        tryThis: 'Clear the floor: the store opens because this is floor 3. Buy a bomb and Descend.',
        build: () => room(['a:e b:t', 'b:t a:e'], { level: 3, run: { gold: 12 } }),
        script: [
            { step: { do: 'clear' }, says: 'floor 3 clears and is a store stop', expect: (r) => (r.status === 'levelComplete' && isStoreStopFloor(r.lastLevelResult?.level) ? null : `status ${r.status}`) },
            { step: { do: 'buy', item: 'bomb' }, says: 'a bomb costs 4 gold', expect: (r, b) => (r.bombCharges === b.bombCharges + 1 && runGold(b) - runGold(r) === 4 ? null : `bombs ${r.bombCharges}, gold ${runGold(b)} -> ${runGold(r)}`) }
        ]
    },
    {
        id: 'deep-pockets',
        title: 'Deep Pockets',
        mechanic: 'The relic lifts the miss bank to five.',
        graphMechanicIds: ['inventory.relics', 'economy.miss_bank'],
        tryThis: 'You hold Deep Pockets and four misses. Clear the floor, then buy another miss at the stop.',
        build: () => room(['a:e b:t', 'b:t a:e'], { level: 3, misses: 4, run: { gold: 20, relics: ['deep_pockets'] } }),
        script: [
            { step: { do: 'clear' }, says: 'the floor clears', expect: statusIs('levelComplete') },
            { step: { do: 'buy', item: 'miss' }, says: 'a fifth miss fits', expect: (r) => (missesLeft(r) === 5 && missBankCap(r) === 5 ? null : `misses ${missesLeft(r)}, cap ${missBankCap(r)}`) }
        ]
    },
    {
        id: 'long-look',
        title: 'Long Look',
        mechanic: 'The relic adds a second to every study window.',
        graphMechanicIds: ['inventory.relics', 'phase.memorize'],
        tryThis: 'Compare the study window with and without Long Look.',
        build: () => room(['a:e b:t', 'b:t a:e'], { run: { relics: ['long_look'] } }),
        script: [
            {
                step: { do: 'shuffle' },
                says: 'the window is a second longer than the same floor without the relic',
                expect: (r) => {
                    const withRelic = getMemorizeDurationForRun(r, 4);
                    const without = getMemorizeDurationForRun({ ...r, relics: [] }, 4);
                    return withRelic - without === 1000 ? null : `difference ${withRelic - without}ms`;
                }
            }
        ]
    },
    {
        id: 'tallow-candle',
        title: 'Tallow Candle',
        mechanic: 'The relic lights the face-down cards beside a floor\'s first match until the next flip; later matches light nothing.',
        graphMechanicIds: ['inventory.relics', 'board.lantern_light'],
        tryThis: 'You hold the Tallow Candle. Open the floor in the middle: the cards beside that first match light up. The second match lights nothing.',
        build: () => room(['a:e b:t c:m d:b', 'e:e x:t x:t f:b', 'a:e b:t c:m d:b', 'e:e f:b g:m g:m'], { run: { relics: ['tallow_candle'] } }),
        script: [
            { step: { do: 'match', pairKey: 'x' }, says: 'the first match lights the cards beside it', expect: (r) => (r.lanternLitTileIds.length > 0 && r.peekRevealedTileIds.length === 0 ? null : `lit ${r.lanternLitTileIds.length}`) },
            { step: { do: 'match', pairKey: 'g' }, says: 'the second match lights nothing', expect: (r) => (r.lanternLitTileIds.length === 0 ? null : `lit ${r.lanternLitTileIds.join(',')}`) }
        ]
    },
    {
        id: 'restless-floor',
        title: 'The restless floor',
        mechanic: 'Every third turn, hidden cards trade places.',
        graphMechanicIds: ['hazard.restless_floor'],
        tryThis: 'Play three turns and watch two face-down cards trade places on the third.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { mutators: ['restless_floor'] }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'turn one, nothing moves', expect: (r) => (r.restlessDriftsThisFloor ?? 0) === 0 ? null : 'drifted on turn one' },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'turn two, nothing moves', expect: (r) => (r.restlessDriftsThisFloor ?? 0) === 0 ? null : 'drifted on turn two' },
            {
                step: { do: 'miss', a: 'e-1', b: 'f-1' },
                says: 'turn three, hidden cards trade places',
                expect: (r, before) => {
                    if ((r.restlessDriftsThisFloor ?? 0) !== 1) return `drifts ${r.restlessDriftsThisFloor}`;
                    const order = (run: RunState) => (run.board?.tiles ?? []).map((t) => t.id).join(',');
                    return order(r) !== order(before) ? null : 'no card moved';
                }
            }
        ]
    },
    {
        id: 'magpie',
        title: 'The magpie',
        mechanic: 'Every third miss of the run, the magpie takes a matched pair back.',
        graphMechanicIds: ['hazard.magpie_thief'],
        tryThis: 'Match a, then miss three times: the bird puts a pair back face down.',
        build: () => room(['a:e b:t c:m d:b', 'a:e b:t c:m d:b'], { mutators: ['magpie_thief'], misses: 4 }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'a is matched', expect: isGone('a') },
            { step: { do: 'miss', a: 'b-1', b: 'c-1' }, says: 'miss one', expect: (r) => (r.magpieTheftsThisFloor === 0 ? null : 'stole on miss one') },
            { step: { do: 'miss', a: 'b-1', b: 'd-1' }, says: 'miss two', expect: (r) => (r.magpieTheftsThisFloor === 0 ? null : 'stole on miss two') },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'miss three: the bird takes a back', expect: (r) => (r.magpieTheftsThisFloor === 1 && standing(r, 'a') ? null : `thefts ${r.magpieTheftsThisFloor}, a standing ${standing(r, 'a')}`) }
        ]
    },
    {
        id: 'score-glint',
        title: 'The score glint',
        mechanic: 'A glint pair pays 25 on top of its match.',
        graphMechanicIds: ['findable.score_glint'],
        tryThis: 'Match the glint pair, then a plain one, and compare what each paid.',
        build: () =>
            room(['a:e b:t', 'c:m a:e', 'b:t c:m'], {
                tiles: (tiles) => tiles.map((t) => (t.pairKey === 'a' ? { ...t, findableKind: 'score_glint' as const } : t))
            }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the glint pays its 25',
                expect: (r, before) => (r.stats.totalScore - before.stats.totalScore >= 25 && r.findablesClaimedThisFloor === 1 ? null : `paid ${r.stats.totalScore - before.stats.totalScore}, claimed ${r.findablesClaimedThisFloor}`)
            }
        ]
    },
    {
        id: 'peek',
        title: 'Peek',
        mechanic: 'A peek shows one hidden card for a moment: no turn, no miss, one charge.',
        graphMechanicIds: ['power.peek', 'inventory.peek_charge'],
        tryThis: 'Press Peek and pick a card. It shows its face, then goes back down.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { peekCharges: 1 } }),
        script: [
            {
                step: { do: 'peek', tileId: 'a-1' },
                says: 'a-1 is shown, the charge is spent, nothing else moved',
                expect: expectAll(costsNothing, (r) => (r.peekCharges === 0 && r.peekRevealedTileIds.includes('a-1') ? null : `peeks ${r.peekCharges}, shown ${r.peekRevealedTileIds.join(',')}`))
            }
        ]
    },
    {
        id: 'shuffle',
        title: 'Shuffle',
        mechanic: 'A shuffle deals the hidden cards again: no turn, no miss, one charge.',
        graphMechanicIds: ['power.shuffle', 'inventory.shuffle_charge'],
        tryThis: 'Press Shuffle and watch the face-down cards move.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { shuffleCharges: 1 } }),
        script: [
            {
                step: { do: 'shuffle' },
                says: 'the hidden cards move and the charge is spent',
                expect: expectAll(costsNothing, (r, b) => (r.shuffleCharges === 0 && order(r) !== order(b) ? null : `shuffles ${r.shuffleCharges}, moved ${order(r) !== order(b)}`))
            }
        ]
    },
    {
        id: 'tile-swap',
        title: 'Swap two cards',
        mechanic: 'A swap trades two hidden cards you choose, from the row/swap charge.',
        graphMechanicIds: ['power.tile_swap', 'inventory.region_shuffle_charge'],
        tryThis: 'Press Swap, then pick the top-left card and the bottom-right one.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { regionShuffleCharges: 1 } }),
        script: [
            {
                step: { do: 'swap', a: 'a-1', b: 'f-2' },
                says: 'a-1 and f-2 trade places',
                expect: expectAll(costsNothing, (r, b) =>
                    positionOf(r, 'a-1') === positionOf(b, 'f-2') && positionOf(r, 'f-2') === positionOf(b, 'a-1') && r.regionShuffleCharges === 0
                        ? null
                        : `a-1 at ${positionOf(r, 'a-1')}, charges ${r.regionShuffleCharges}`
                )
            }
        ]
    },
    {
        id: 'row-shuffle',
        title: 'Shuffle a row',
        mechanic: 'A row shuffle deals one row again and leaves every other row where it was.',
        graphMechanicIds: ['power.region_shuffle', 'inventory.region_shuffle_charge'],
        tryThis: 'Press the row shuffle and pick the top row.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { regionShuffleCharges: 1 } }),
        script: [
            {
                step: { do: 'rowShuffle', row: 0 },
                says: 'the top row moves, the rest stay',
                expect: expectAll(costsNothing, (r, b) => {
                    const top = (run: RunState) => order(run).split(',').slice(0, 3).join(',');
                    const rest = (run: RunState) => order(run).split(',').slice(3).join(',');
                    return top(r) !== top(b) && rest(r) === rest(b) && r.regionShuffleCharges === 0 ? null : 'the wrong cards moved';
                })
            }
        ]
    },
    {
        id: 'undo',
        title: 'Undo',
        mechanic: 'Undo takes back a second flip before the turn resolves: no miss, one use a floor.',
        graphMechanicIds: ['power.undo_resolve', 'inventory.undo_charge'],
        tryThis: 'Flip two cards that do not match, and press Undo before they turn back.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { undoUsesThisFloor: 1 } }),
        script: [
            { step: { do: 'flip', tileId: 'a-1' }, says: 'one card up', expect: statusIs('playing') },
            { step: { do: 'flip', tileId: 'b-1' }, says: 'two cards up, the turn is resolving', expect: statusIs('resolving') },
            {
                step: { do: 'undo' },
                says: 'both go back down and nothing was charged',
                expect: expectAll(statusIs('playing'), costsNothing, isStanding('a'), isStanding('b'), (r) => (r.undoUsesThisFloor === 0 ? null : `undo ${r.undoUsesThisFloor}`))
            }
        ]
    },
    {
        id: 'flash-pair',
        title: 'Flash pair',
        mechanic: 'In practice and wild runs, a flash shows both halves of one hidden pair.',
        graphMechanicIds: ['power.flash_pair', 'inventory.flash_pair_charge'],
        tryThis: 'Press Flash: two matching cards show their faces for a moment.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { flashPairCharges: 1, practiceMode: true } }),
        script: [
            {
                step: { do: 'flash' },
                says: 'both halves of one pair are shown and the charge is spent',
                expect: expectAll(costsNothing, (r) => {
                    const shown = r.flashPairRevealedTileIds.map((id) => r.board?.tiles.find((t) => t.id === id)?.pairKey);
                    return r.flashPairCharges === 0 && shown.length === 2 && shown[0] === shown[1] ? null : `charges ${r.flashPairCharges}, shown ${shown.join(',')}`;
                })
            }
        ]
    },
    {
        id: 'echo',
        title: 'Echo',
        mechanic: 'Matching an Echo pair cleanly grants a peek charge.',
        graphMechanicIds: ['trait.echo', 'inventory.peek_charge'],
        tryThis: 'Match the Echo pair a and watch the Peek count go up.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { peekCharges: 0 }, tiles: withTrait('a', 'echo') }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the clean Echo match grants a peek', expect: (r) => (r.peekCharges === 1 ? null : `peeks ${r.peekCharges}`) }
        ]
    },
    {
        id: 'heavy',
        title: 'Heavy',
        mechanic: 'A Heavy pair pays 35 more on a clean match, and a miss on it costs two from the bank.',
        graphMechanicIds: ['trait.heavy', 'economy.miss_bank'],
        tryThis: 'Miss with the Heavy card: two misses go. Then match it for the bonus.',
        /*
         * Until Gen 262 the bank charged one miss for every mismatch whatever the turn charged in
         * tries, so the extra miss printed on this card had cost nothing since the bank replaced
         * the try counter. This room is where that is walked.
         */
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { tiles: withTrait('a', 'heavy') }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'a miss on Heavy costs two', expect: missesAre(1) },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'a plain miss costs one', expect: missesAre(0) },
            { step: { do: 'match', pairKey: 'a' }, says: 'the Heavy match still pays its 35 on top', expect: (r, b) => (r.stats.totalScore - b.stats.totalScore >= 35 ? null : `paid ${r.stats.totalScore - b.stats.totalScore}`) }
        ]
    },
    {
        id: 'gambit',
        title: 'The Gambit',
        mechanic: 'Once a floor, a third card after two that miss: if it completes a pair, the turn is a match.',
        graphMechanicIds: ['power.gambit', 'inventory.gambit_token'],
        tryThis: 'Flip a and b, then before they turn back flip the other a: the gambit makes it a match.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { gambitAvailableThisFloor: true, gambitThirdFlipUsed: false } }),
        script: [
            {
                step: { do: 'gambit', a: 'a-1', b: 'b-1', third: 'a-2' },
                says: 'the third card completes a: a match, no miss, the gambit is spent',
                expect: expectAll(isGone('a'), isStanding('b'), missesAre(3), (r) => (r.gambitThirdFlipUsed && !r.gambitAvailableThisFloor ? null : 'the gambit was not spent'))
            }
        ]
    },
    {
        id: 'pin',
        title: 'Pins',
        mechanic: 'A pin marks a hidden card to remember; a shuffle moves the cards, so it clears the pins.',
        graphMechanicIds: ['power.pin', 'power.shuffle'],
        tryThis: 'Pin a card, then shuffle: the pin goes, because the card it marked has moved.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { shuffleCharges: 1 } }),
        script: [
            { step: { do: 'pin', tileId: 'a-1' }, says: 'a-1 carries a pin', expect: expectAll(costsNothing, (r) => (r.pinnedTileIds.includes('a-1') ? null : 'a-1 is not pinned')) },
            { step: { do: 'shuffle' }, says: 'the shuffle clears the pin it would have made a lie of', expect: (r) => (r.pinnedTileIds.length === 0 ? null : `pins ${r.pinnedTileIds.join(',')}`) }
        ]
    },
    {
        id: 'wild',
        title: 'The wild joker',
        mechanic: 'The joker matches any card, and its pair goes with it: the joker stands in for the partner.',
        graphMechanicIds: ['board.wild_joker_tile', 'power.wild_match', 'inventory.wild_match_token'],
        tryThis: 'Flip the joker, then any card: that whole pair is gone. Clear the rest and the floor ends.',
        /*
         * Gen 262: the joker used to claim only the card it was flipped with, leaving the partner face
         * down with nothing to pair - every Wild run softlocked on its first joker. The clear at the
         * end is the half of this room that matters.
         */
        build: () =>
            room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b w:e'], {
                run: { wildMenuRun: true, wildMatchesRemaining: 1 },
                tiles: (tiles) => tiles.map((t) => (t.pairKey === 'w' ? { ...t, id: 'joker', pairKey: WILD_PAIR_KEY } : t))
            }),
        script: [
            { step: { do: 'wild', tileId: 'a-1' }, says: 'the joker takes the whole of pair a', expect: expectAll(isGone('a'), missesAre(3), (r) => (r.wildMatchesRemaining === 0 ? null : `jokers ${r.wildMatchesRemaining}`)) },
            { step: { do: 'clear' }, says: 'the rest clears and so does the floor', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'conduit',
        title: 'Conduit',
        mechanic: 'A clean Conduit match turns neighbouring traits into score; an Echo next to it adds a peek.',
        graphMechanicIds: ['trait.conduit', 'trait.echo'],
        tryThis: 'Both Conduit cards (a) sit next to an Echo card (c). Match a and count the peeks.',
        build: () =>
            room(['a:e c:t b:m d:b', 'e:e c:t a:e f:m', 'b:m d:b e:e f:m'], {
                run: { peekCharges: 0 },
                tiles: (tiles) => withTrait('c', 'echo')(withTrait('a', 'conduit')(tiles))
            }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the Conduit sparks the Echo beside it: a peek, and more score than a plain match',
                expect: (r) => (r.peekCharges === 1 ? null : `peeks ${r.peekCharges}`)
            }
        ]
    },
    {
        id: 'stasis',
        title: 'Stasis',
        mechanic: 'A clean Stasis match locks a neighbouring trait card: it cannot be the first card of the next turn.',
        graphMechanicIds: ['trait.stasis', 'trait.heavy'],
        tryThis: 'Match the Stasis pair (s). The Heavy card beside it will not open first - but it will open second.',
        build: () => room(['s:e h:t a:m b:b', 'c:b d:m h:t s:e', 'a:m b:b c:b d:m'], { tiles: (tiles) => withTrait('h', 'heavy')(withTrait('s', 'stasis')(tiles)) }),
        script: [
            { step: { do: 'match', pairKey: 's' }, says: 'the Stasis match locks h-1', expect: (r) => (r.stickyBlockIndex === positionOf(r, 'h-1') ? null : `lock at ${r.stickyBlockIndex}`) },
            { step: { do: 'flip', tileId: 'a-1' }, says: 'a first card elsewhere is fine', expect: statusIs('playing') },
            { step: { do: 'flip', tileId: 'h-1' }, says: 'the locked card opens as the second card', expect: (r) => (r.board?.flippedTileIds.includes('h-1') ? null : 'the locked card would not open second') }
        ]
    },
    {
        id: 'sticky-fingers',
        title: 'Sticky fingers',
        mechanic: 'After a match, the first face-down card touching it cannot be the first card of the next turn (the Trap Hall).',
        graphMechanicIds: ['board.cleanup'],
        tryThis: 'Match a in the corner. b-1 beside it is marked: it will not open first, but it opens second.',
        build: () => room(['a:e b:t c:m d:b', 'e:m f:b g:e h:t', 'a:e b:t c:m d:b', 'e:m f:b g:e h:t'], { mutators: ['sticky_fingers'] }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the match locks b-1, the face-down card beside a-1 - not the matched card',
                expect: (r) => (r.stickyBlockIndex === positionOf(r, 'b-1') ? null : `lock at ${r.stickyBlockIndex}`)
            },
            {
                step: { do: 'flip', tileId: 'b-1' },
                says: 'b-1 will not open the turn',
                expect: (r) => ((r.board?.flippedTileIds.length ?? 0) === 0 ? null : 'the locked card opened a turn')
            },
            { step: { do: 'flip', tileId: 'c-1' }, says: 'a first card elsewhere is fine', expect: statusIs('playing') },
            { step: { do: 'flip', tileId: 'b-1' }, says: 'the locked card opens as the second card', expect: (r) => (r.board?.flippedTileIds.includes('b-1') ? null : 'the locked card would not open second') }
        ]
    },
    {
        id: 'skittish',
        title: 'Skittish cards',
        mechanic: 'Miss, and each of the two cards you saw flinches one step into a face-down neighbour. Pinned cards stay.',
        graphMechanicIds: ['hazard.skittish_cards', 'power.pin'],
        tryThis: 'Pin c-1, then miss a against b: both flinch one step, and never into the pinned card. Then find them.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t g:m h:b', 'a:e b:t c:m d:b', 'e:e f:t g:m h:b'], { mutators: ['skittish_cards'] }),
        script: [
            { step: { do: 'pin', tileId: 'c-1' }, says: 'c-1 is pinned', expect: (r) => (r.pinnedTileIds.includes('c-1') ? null : 'c-1 is not pinned') },
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'a-1 and b-1 each step into a neighbouring cell, the pinned card stays',
                expect: (r, b) => {
                    const columns = b.board?.columns ?? 4;
                    const count = b.board?.tiles.length ?? 0;
                    for (const id of ['a-1', 'b-1']) {
                        const from = positionOf(b, id);
                        const to = positionOf(r, id);
                        if (to === from) continue; // a card whose neighbours were all taken may stay
                        if (!orthogonalNeighbourIndices(from, columns, count).includes(to)) return `${id} jumped from ${from} to ${to}`;
                    }
                    if (positionOf(r, 'a-1') === positionOf(b, 'a-1') && positionOf(r, 'b-1') === positionOf(b, 'b-1')) return 'neither missed card moved';
                    if (positionOf(r, 'c-1') !== positionOf(b, 'c-1')) return 'the pinned card moved';
                    return r.skittishFlinchesThisFloor === 1 ? null : `flinches ${r.skittishFlinchesThisFloor}`;
                }
            },
            { step: { do: 'match', pairKey: 'h' }, says: 'a match never flinches', expect: expectAll(isGone('h'), (r) => (r.skittishFlinchesThisFloor === 1 ? null : `flinches ${r.skittishFlinchesThisFloor}`)) }
        ]
    },
    {
        id: 'lantern',
        title: 'Lantern light',
        mechanic: 'A match lights up to three face-down cards touching it, until the next card is turned. It is not a peek.',
        graphMechanicIds: ['board.lantern_light'],
        tryThis: 'Match x in the middle and read the faces that light up around it, then turn a card: they go dark.',
        build: () => room(['a:e b:t c:m d:b', 'e:e x:t x:t f:b', 'a:e b:t c:m d:b', 'e:e f:b g:m g:m'], { mutators: ['lantern_light'] }),
        script: [
            {
                step: { do: 'match', pairKey: 'x' },
                says: 'three cards beside x light up, and no peek is spent or recorded',
                expect: (r) =>
                    r.lanternLitTileIds.length === 3 && r.peekRevealedTileIds.length === 0 && r.lanternLightsThisFloor === 1
                        ? null
                        : `lit ${r.lanternLitTileIds.join(',')}, peeks ${r.peekRevealedTileIds.length}`
            },
            { step: { do: 'flip', tileId: 'g-1' }, says: 'the next flip puts the light out', expect: (r) => (r.lanternLitTileIds.length === 0 ? null : `still lit ${r.lanternLitTileIds.join(',')}`) }
        ]
    },
    {
        id: 'heat-afterglow',
        title: 'Afterglow',
        mechanic: 'From a Hot combo, every match lights face-down cards beside it until the next flip: one at Hot, two at Blazing, three from Inferno. A miss puts the fire out.',
        graphMechanicIds: ['board.combo_heat_perks', 'board.lantern_light'],
        tryThis: 'You arrive with a combo of ten (Blazing). Match x in the middle: two faces beside it light. Miss once, then match g: nothing lights.',
        build: () => room(['a:e b:m c:e d:m', 'e:b x:t x:t f:b', 'a:e b:m c:e d:m', 'e:b f:b g:m g:m'], { streak: 10 }),
        script: [
            {
                step: { do: 'match', pairKey: 'x' },
                says: 'at Blazing the match lights two cards beside it, no peek spent; the perks count the turn and the lantern does not',
                expect: (r) =>
                    r.lanternLitTileIds.length === 2 && r.peekRevealedTileIds.length === 0 && r.heatPerkTurnsThisFloor === 1 && r.lanternLightsThisFloor === 0 && r.stats.currentStreak === 11
                        ? null
                        : `lit ${r.lanternLitTileIds.length}, perk turns ${r.heatPerkTurnsThisFloor}, combo ${r.stats.currentStreak}`
            },
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'a miss ends the combo, and with it the fire', expect: (r) => (r.stats.currentStreak === 0 && r.lanternLitTileIds.length === 0 ? null : `combo ${r.stats.currentStreak}, lit ${r.lanternLitTileIds.length}`) },
            {
                step: { do: 'match', pairKey: 'g' },
                says: 'cold again, the next match lights nothing and the census does not count it',
                expect: (r) => (r.lanternLitTileIds.length === 0 && r.heatPerkTurnsThisFloor === 1 ? null : `lit ${r.lanternLitTileIds.length}, perk turns ${r.heatPerkTurnsThisFloor}`)
            }
        ]
    },
    {
        id: 'heat-pop',
        title: 'The wider pop',
        mechanic: 'From Blazing a break may take one pair more than its rung allows; from Inferno the first wave walks a step further.',
        graphMechanicIds: ['board.combo_heat_perks', 'board.chain_chunk_fever'],
        tryThis: 'One suit over the whole floor and a combo of ten. Match x at the bottom left: a Fever break takes four pairs, and Blazing lets it take a fifth.',
        build: () => room(['a:e b:e c:e d:e', 'a:e b:e c:e d:e', 'x:e f:e g:e h:e', 'x:e f:e g:e h:e'], { streak: 10 }),
        script: [
            {
                step: { do: 'match', pairKey: 'x' },
                says: 'the break takes five pairs on top of the match: the Fever cap of four and one more for Blazing',
                expect: (r) => (r.board?.matchedPairs === 6 && r.heatPerkTurnsThisFloor === 1 ? null : `matched ${r.board?.matchedPairs}, perk turns ${r.heatPerkTurnsThisFloor}`)
            }
        ]
    },
    {
        id: 'zone',
        title: 'The Zone',
        mechanic: 'At Inferno the combo can be burned to open the Zone: cards turned inside it stay up and nothing resolves until it ends. Then every pair matches at once, and what is left is played as misses at full price.',
        graphMechanicIds: ['power.ignition_zone', 'board.chain_chunk_fever', 'economy.miss_bank'],
        tryThis: 'You arrive at a combo of sixteen. Ignite: the combo is spent and the Zone opens for three pairs. Turn both a cards, both b cards, then c and d. Resolve: a and b match, c and d miss.',
        build: () => room(['a:e b:m c:t d:b', 'e:b x:t x:t f:e', 'a:e b:m c:t d:b', 'e:b f:e g:m g:m'], { streak: 16 }),
        script: [
            {
                step: { do: 'ignite' },
                says: 'the Zone opens for three pairs and the combo burns to zero',
                expect: (r) => (r.zone?.pairs === 3 && r.stats.currentStreak === 0 && r.zonesThisRun === 1 ? null : `zone ${JSON.stringify(r.zone)}, combo ${r.stats.currentStreak}`)
            },
            { step: { do: 'zoneFlip', tileId: 'a-1' }, says: 'a card turned in the Zone stays up and nothing resolves', expect: (r) => (r.status === 'playing' && r.board?.flippedTileIds.length === 1 ? null : `status ${r.status}, up ${r.board?.flippedTileIds.length}`) },
            { step: { do: 'zoneFlip', tileId: 'a-2' }, says: 'its partner joins it face up: still nothing resolves', expect: (r) => (r.status === 'playing' && r.board?.flippedTileIds.length === 2 && r.board.matchedPairs === 0 ? null : `status ${r.status}, up ${r.board?.flippedTileIds.length}, matched ${r.board?.matchedPairs}`) },
            { step: { do: 'zoneFlip', tileId: 'b-1' }, says: 'a third card, which no turn allows', expect: (r) => (r.board?.flippedTileIds.length === 3 ? null : `up ${r.board?.flippedTileIds.length}`) },
            { step: { do: 'zoneFlip', tileId: 'b-2' }, says: 'a fourth', expect: (r) => (r.board?.flippedTileIds.length === 4 ? null : `up ${r.board?.flippedTileIds.length}`) },
            { step: { do: 'zoneFlip', tileId: 'c-1' }, says: 'a fifth', expect: (r) => (r.board?.flippedTileIds.length === 5 ? null : `up ${r.board?.flippedTileIds.length}`) },
            {
                step: { do: 'zoneFlip', tileId: 'd-1' },
                says: 'the sixth card closes the Zone: a and b match (the drop may take more), c and d are one miss, the bonus is paid, and the miss ends the combo the matches rebuilt',
                expect: (r, b) => {
                    if (r.zone !== null) return 'zone still open';
                    if (!r.board || !r.board.tiles.filter((t) => t.pairKey === 'a' || t.pairKey === 'b').every((t) => t.state === 'matched')) return 'a or b still standing';
                    if (r.stats.mismatches !== b.stats.mismatches + 1) return `mismatches ${r.stats.mismatches}`;
                    if (r.lastZone?.matched !== 2 || r.lastZone.missed !== 1 || r.lastZone.bonus !== 400) return `last zone ${JSON.stringify(r.lastZone)}`;
                    if (r.zonePairsThisRun !== 2) return `zone pairs ${r.zonePairsThisRun}`;
                    if (r.stats.currentStreak !== 0) return `combo ${r.stats.currentStreak}`;
                    return r.board.flippedTileIds.length === 0 && r.status === 'playing' ? null : `up ${r.board.flippedTileIds.length}, status ${r.status}`;
                }
            }
        ]
    },
    {
        id: 'void-spew',
        title: 'The void spews',
        mechanic: 'A miss that kills a combo of Inferno or better opens the black hole: it spits brand-new pairs into cells already cleared and reshuffles every face-down card on the board.',
        graphMechanicIds: ['hazard.void_spew', 'economy.miss_bank'],
        tryThis: 'You arrive at a combo of twenty-six. Match a and b, then miss: new cards fill cleared cells and the whole board reshuffles.',
        build: () => room(['a:e b:t c:m d:b', 'e:b f:m g:t h:e', 'a:e b:t c:m d:b', 'e:b f:m g:t h:e'], { streak: 26 }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the combo climbs', expect: (r) => (r.stats.currentStreak === 27 ? null : 'combo ' + r.stats.currentStreak) },
            { step: { do: 'match', pairKey: 'b' }, says: 'and climbs', expect: (r) => (r.stats.currentStreak === 28 ? null : 'combo ' + r.stats.currentStreak) },
            {
                step: { do: 'missAny' },
                says: 'the miss opens the void: new pairs fill cleared cells, and every face-down card moves',
                expect: (r, b) => {
                    if (r.voidSpewsThisFloor !== 1) return 'spews ' + r.voidSpewsThisFloor;
                    const fresh = (r.board?.tiles ?? []).filter((t) => t.pairKey.includes('-void-'));
                    if (fresh.length !== 4 || fresh.some((t) => t.state !== 'hidden')) return 'new cards ' + fresh.length;
                    const before = new Set((b.board?.tiles ?? []).map((t) => t.symbol));
                    if (fresh.some((t) => before.has(t.symbol))) return 'a new card wears a face the board already showed';
                    const gone = new Set((r.board?.tiles ?? []).filter((t) => t.state === 'matched' || t.state === 'removed').map((t) => t.pairKey)).size;
                    if (r.board?.matchedPairs !== gone) return 'matchedPairs ' + r.board?.matchedPairs + ' vs gone ' + gone;
                    const moved = (r.board?.tiles ?? []).filter((t, index) => t.state === 'hidden' && !t.pairKey.includes('-void-') && b.board?.tiles[index]?.id !== t.id).length;
                    return moved > 0 ? null : 'nothing moved';
                }
            }
        ]
    },
    {
        id: 'n-back',
        title: 'The anchor',
        mechanic: 'After a match the floor marks one card of a face-down pair; match that pair for an extra chain link. Two matches without it and it moves on.',
        graphMechanicIds: ['board.n_back_anchor', 'board.chain_chunk_fever'],
        tryThis: 'Match any pair: one face-down card is marked. Find its partner and match them for two links instead of one.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t', 'g:m h:b g:m h:b'], { mutators: ['n_back_anchor'], run: { runSeed: 90_211 } }),
        script: [
            {
                step: { do: 'matchOther' },
                says: 'a first match names an anchor and marks one of its face-down cards',
                expect: (r) => {
                    const marked = anchorMarkedTileId(r.board, r.nBackAnchorPairKey);
                    return r.nBackAnchorPairKey && marked && standing(r, r.nBackAnchorPairKey) ? null : `anchor ${r.nBackAnchorPairKey}, marked ${marked}`;
                }
            },
            {
                step: { do: 'matchAnchor' },
                says: 'matching the anchor pays two links, and a new anchor is named',
                expect: (r, b) =>
                    r.stats.currentStreak === b.stats.currentStreak + 2 && r.anchorClaimsThisFloor === 1 && r.nBackAnchorPairKey !== b.nBackAnchorPairKey
                        ? null
                        : `streak ${b.stats.currentStreak} -> ${r.stats.currentStreak}, claims ${r.anchorClaimsThisFloor}, anchor ${r.nBackAnchorPairKey}`
            },
            { step: { do: 'matchOther' }, says: 'one match past it, the anchor stays', expect: (r, b) => (r.nBackAnchorPairKey === b.nBackAnchorPairKey ? null : 'the anchor moved after one match') },
            { step: { do: 'matchOther' }, says: 'two matches past it, the anchor moves on', expect: (r, b) => (r.nBackAnchorPairKey !== b.nBackAnchorPairKey ? null : 'the anchor stayed after two matches') }
        ]
    },
    {
        id: 'spotlight',
        title: 'The shifting spotlight',
        mechanic: 'The Bounty pair pays 30 more and the Ward pair 22 less; every turn moves both.',
        graphMechanicIds: ['economy.score_and_rewards'],
        tryThis: 'Match the Bounty (b), then the new Ward, then miss: the two marks move every turn.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { mutators: ['shifting_spotlight'], run: { runSeed: 90_211 }, board: { wardPairKey: 'a', bountyPairKey: 'b' } }),
        script: [
            {
                step: { do: 'match', pairKey: 'b' },
                says: 'the Bounty pays 30 over a plain match, and the marks move to pairs still standing',
                expect: expectAll(matchPaysBeside('b', 30, (b) => ({ ...withoutMutators(b), board: { ...b.board!, wardPairKey: null, bountyPairKey: null } })), (r) => {
                    const { wardPairKey: ward, bountyPairKey: bounty } = r.board ?? {};
                    return ward && bounty && standing(r, ward) && standing(r, bounty) ? null : `ward ${ward}, bounty ${bounty}`;
                })
            },
            {
                step: { do: 'match', pairKey: 'd' },
                says: 'd is the Ward now: it pays 22 under a plain match',
                expect: (r, b) =>
                    b.board?.wardPairKey !== 'd'
                        ? `the Ward moved to ${b.board?.wardPairKey}, not d`
                        : matchPaysBeside('d', -22, (before) => ({ ...withoutMutators(before), board: { ...before.board!, wardPairKey: null, bountyPairKey: null } }))(r, b)
            },
            { step: { do: 'miss', a: 'a-1', b: 'c-1' }, says: 'a miss moves the marks too', expect: (r, b) => ((r.shiftingSpotlightNonce ?? 0) === (b.shiftingSpotlightNonce ?? 0) + 1 ? null : `spotlight moved ${r.shiftingSpotlightNonce} times`) }
        ]
    },
    {
        id: 'wide-recall',
        title: 'Wide recall',
        mechanic: 'Faces read wide in play, and every match pays 5 less.',
        graphMechanicIds: ['economy.score_and_rewards'],
        tryThis: 'Match a and compare what it paid with the same match on a plain floor.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { mutators: ['wide_recall'] }),
        script: [{ step: { do: 'match', pairKey: 'a' }, says: 'the match pays 5 under a plain one', expect: matchPaysBeside('a', -5, withoutMutators) }]
    },
    {
        id: 'silhouette',
        title: 'Silhouette twist',
        mechanic: 'Faces show as silhouettes in play, and every match pays 5 less.',
        graphMechanicIds: ['economy.score_and_rewards'],
        tryThis: 'Match a and compare what it paid with the same match on a plain floor.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { mutators: ['silhouette_twist'] }),
        script: [{ step: { do: 'match', pairKey: 'a' }, says: 'the match pays 5 under a plain one', expect: matchPaysBeside('a', -5, withoutMutators) }]
    },
    {
        id: 'floor-pay',
        title: "The floor's pay",
        mechanic: 'A clear pays 100 x floor times the chain tier standing, plus 50 x floor for every turn under par.',
        graphMechanicIds: ['economy.score_and_rewards', 'objective.floor_clear'],
        tryThis: 'Clear floor 4 under its par and read the floor-end bonus.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t']),
        script: [
            {
                step: { do: 'clear' },
                says: 'the bonus is the tiered clear plus the turns saved, and the floor pays play + bonus + objectives',
                expect: (r) => {
                    const result = r.lastLevelResult;
                    if (r.status !== 'levelComplete' || !result) return `status ${r.status}`;
                    const { parTurns = 0, turnsTaken = 0, floorEfficiencyBonus = 0, floorBonus = 0, floorBonusTierMult = 1, playScore = 0 } = result;
                    if (turnsTaken >= parTurns) return `took ${turnsTaken} turns against a par of ${parTurns}`;
                    if (floorEfficiencyBonus !== 50 * 4 * (parTurns - turnsTaken)) return `efficiency ${floorEfficiencyBonus} for ${parTurns - turnsTaken} turns saved`;
                    if (floorBonus !== Math.round(100 * 4 * floorBonusTierMult) + floorEfficiencyBonus) return `floor bonus ${floorBonus} at x${floorBonusTierMult}`;
                    const sum = playScore + floorBonus + (result.objectiveBonusScore ?? 0) + (result.featuredObjectiveStreakBonus ?? 0);
                    return result.scoreGained === sum ? null : `the floor paid ${result.scoreGained}, its parts add to ${sum}`;
                }
            }
        ]
    },
    {
        id: 'featured-streak',
        title: 'The objective streak',
        mechanic: 'Each featured objective cleared in a row adds 10 on top of the objective, up to 50.',
        graphMechanicIds: ['objective.featured_streak', 'economy.score_and_rewards'],
        tryThis: 'Your streak is one and this floor features Flip par. Clear it under par: the streak goes to two and pays its 10.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: { featuredObjectiveStreak: 1 }, board: { featuredObjectiveId: 'flip_par' } }),
        script: [
            {
                step: { do: 'clear' },
                says: 'Flip par pays 45, the streak goes to two and adds its 10',
                expect: (r) => {
                    const result = r.lastLevelResult;
                    return r.featuredObjectiveStreak === 2 && result?.featuredObjectiveCompleted && result.objectiveBonusScore === 45 && result.featuredObjectiveStreakBonus === 10
                        ? null
                        : `streak ${r.featuredObjectiveStreak}, objective ${result?.objectiveBonusScore}, kicker ${result?.featuredObjectiveStreakBonus}`;
                }
            }
        ]
    },
    {
        id: 'featured-streak-miss',
        title: 'The objective streak, missed',
        mechanic: 'Clearing a floor without its featured objective takes two off the objective streak.',
        graphMechanicIds: ['objective.featured_streak'],
        tryThis: 'Your streak is three and the floor features Flip par. Miss three times, then clear: over par, the streak drops to one.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: { featuredObjectiveStreak: 3 }, board: { featuredObjectiveId: 'flip_par' } }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'a miss', expect: missesAre(2) },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'a miss', expect: missesAre(1) },
            { step: { do: 'miss', a: 'e-1', b: 'f-1' }, says: 'a miss', expect: missesAre(0) },
            {
                step: { do: 'clear' },
                says: 'over par: no objective, no kicker, the streak falls by two',
                expect: (r) => {
                    const result = r.lastLevelResult;
                    if (r.status !== 'levelComplete' || !result) return `status ${r.status}`;
                    if ((result.turnsTaken ?? 0) <= (result.parTurns ?? 0)) return `took ${result.turnsTaken}, inside a par of ${result.parTurns}`;
                    return r.featuredObjectiveStreak === 1 && !result.featuredObjectiveCompleted && !result.objectiveBonusScore && !result.featuredObjectiveStreakBonus
                        ? null
                        : `streak ${r.featuredObjectiveStreak}, objective ${result.objectiveBonusScore}, kicker ${result.featuredObjectiveStreakBonus}`;
                }
            }
        ]
    },
    {
        id: 'next-floor',
        title: 'The next floor',
        mechanic: 'A cleared floor descends to the next: a new board, face down, on its study window, with its own mutators and a miss earned.',
        graphMechanicIds: ['progression.run_flow', 'inventory.mutator_loadout', 'economy.miss_bank'],
        tryThis: 'Clear floor 4 with two misses left, then descend: floor 5 opens with three and its own mutators.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 2 }),
        script: [
            { step: { do: 'clear' }, says: 'the floor clears', expect: statusIs('levelComplete') },
            {
                step: { do: 'advance' },
                says: 'floor 5 opens face down on its study window, a miss richer, carrying the mutators its schedule names',
                expect: expectAll(statusIs('memorize'), turnsAre(0), missesAre(3), (r) => {
                    const board = r.board;
                    if (board?.level !== 5) return `level ${board?.level}`;
                    if (!board.tiles.every((t) => t.state === 'hidden')) return 'a card on the new floor is not face down';
                    const entry = scheduled(r);
                    return r.activeMutators.join(',') === entry.mutators.join(',') && board.featuredObjectiveId === entry.featuredObjectiveId
                        ? null
                        : `mutators ${r.activeMutators.join(',')} / ${entry.mutators.join(',')}, objective ${board.featuredObjectiveId} / ${entry.featuredObjectiveId}`;
                })
            },
            { step: { do: 'study' }, says: 'the study window ends and play starts, with a way to finish', expect: expectAll(statusIs('playing'), finishable) }
        ]
    },
    {
        id: 'short-memorize',
        title: 'Short memorize',
        mechanic: 'Short memorize takes 350 ms off the study window.',
        graphMechanicIds: ['phase.memorize', 'inventory.mutator_loadout'],
        tryThis: 'Clear floor 1 and descend: floor 2 is a speed trial, and its study window is shorter.',
        build: () => room(['a:e b:t', 'b:t a:e'], { level: 1 }),
        script: [
            { step: { do: 'clear' }, says: 'floor 1 clears', expect: statusIs('levelComplete') },
            {
                step: { do: 'advance' },
                says: 'floor 2 carries Short memorize, and its window is 350 ms under the same floor without it',
                expect: (r) => {
                    if (!r.activeMutators.includes('short_memorize')) return `floor 2 carries ${r.activeMutators.join(',') || 'nothing'}`;
                    const without = getMemorizeDurationForRun({
                        ...r,
                        activeMutators: r.activeMutators.filter((mutator) => mutator !== 'short_memorize')
                    }, 2);
                    const withShort = getMemorizeDurationForRun(r, 2);
                    const welcomeBonus = FLOOR_CURIOS.find((curio) => curio.id === r.floorCurioId)?.effect.memorizeBonusMs ?? 0;
                    const expectedWindow = Math.max(MIN_CURIO_MEMORIZE_MS, withShort + welcomeBonus);
                    return without - withShort === 350 && r.timerState.memorizeRemainingMs === expectedWindow
                        ? null : `window ${r.timerState.memorizeRemainingMs} against ${expectedWindow} after the resident's welcome`;
                }
            }
        ]
    },
    {
        id: 'dense-pickups',
        title: 'Dense pickups',
        mechanic: 'The Dense pickups mutator deals two glint pairs on its floor.',
        graphMechanicIds: ['findable.score_glint', 'inventory.mutator_loadout'],
        tryThis: 'Clear floor 2 and descend: floor 3 is a treasure gallery with two glint pairs to find.',
        build: () => room(['a:e b:t', 'b:t a:e'], { level: 2 }),
        script: [
            { step: { do: 'clear' }, says: 'floor 2 clears', expect: statusIs('levelComplete') },
            {
                step: { do: 'advance' },
                says: 'floor 3 deals two glint pairs, and the run counts two to find',
                expect: (r) => {
                    if (!r.activeMutators.includes('findables_floor')) return `floor 3 carries ${r.activeMutators.join(',') || 'nothing'}`;
                    const pairs = countFindablePairs(r.board?.tiles ?? []);
                    return pairs === 2 && r.findablesTotalThisFloor === 2 ? null : `glint pairs ${pairs}, counted ${r.findablesTotalThisFloor}`;
                }
            }
        ]
    },
    {
        id: 'wild-run',
        title: 'The Wild run',
        mechanic: 'An unspent joker is carried to the next floor, which deals it again.',
        graphMechanicIds: ['mode.wild_run', 'safety.softlock_fairness'],
        tryThis: 'Clear the real pairs and leave the joker: the floor still clears, and the joker comes down with you.',
        build: () =>
            room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b w:e'], {
                run: { wildMenuRun: true, wildMatchesRemaining: 1 },
                tiles: (tiles) => tiles.map((t) => (t.pairKey === 'w' ? { ...t, id: 'joker', pairKey: WILD_PAIR_KEY } : t))
            }),
        script: [
            { step: { do: 'clear' }, says: 'the real pairs clear the floor with the joker standing', expect: expectAll(statusIs('levelComplete'), (r) => (r.wildMatchesRemaining === 1 ? null : `jokers ${r.wildMatchesRemaining}`)) },
            {
                step: { do: 'advance' },
                says: 'the next floor deals one joker and the token comes too, with no floor mutators',
                expect: (r) => {
                    const jokers = (r.board?.tiles ?? []).filter((t) => t.pairKey === WILD_PAIR_KEY).length;
                    return jokers === 1 && r.wildMatchesRemaining === 1 && r.activeMutators.length === 0 ? null : `jokers dealt ${jokers}, tokens ${r.wildMatchesRemaining}, mutators ${r.activeMutators.join(',')}`;
                }
            },
            { step: { do: 'study' }, says: 'play starts with a way to finish', expect: expectAll(statusIs('playing'), finishable) }
        ]
    },
    {
        id: 'no-shuffle',
        title: 'The no-shuffle contract',
        mechanic: 'A run under the no-shuffle contract cannot shuffle, whatever charges it holds.',
        graphMechanicIds: ['inventory.contract_loadout', 'power.shuffle'],
        tryThis: 'You hold a shuffle charge under a no-shuffle contract. Press Shuffle: nothing moves and the charge stays.',
        build: () => room(['a:e b:t c:m', 'd:b a:e b:t', 'c:m d:b e:e', 'e:e f:t f:t'], { run: { shuffleCharges: 1, activeContract: { noShuffle: true, maxMismatches: null } } }),
        script: [
            {
                step: { do: 'shuffle' },
                says: 'the shuffle is refused: nothing moved, the charge is kept',
                expect: expectAll(costsNothing, (r, b) => (order(r) === order(b) && r.shuffleCharges === 1 ? null : `moved ${order(r) !== order(b)}, charges ${r.shuffleCharges}`))
            }
        ]
    },
    {
        id: 'session-stats',
        title: 'Session stats',
        mechanic: 'The run counts matches, misses, tries, the best chain, trait cards and floors cleared.',
        graphMechanicIds: ['stats.session_tracking'],
        tryThis: 'Miss with the Echo card, match it and one more, then clear: watch each count move once.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { tiles: withTrait('a', 'echo') }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'one mismatch, one try, one Echo card missed',
                expect: (r) => (r.stats.mismatches === 1 && r.stats.tries === 1 && r.stats.tileTraitMismatches.echo === 1 ? null : `mismatches ${r.stats.mismatches}, tries ${r.stats.tries}, echo missed ${r.stats.tileTraitMismatches.echo}`)
            },
            { step: { do: 'match', pairKey: 'a' }, says: 'one match, one Echo pair matched', expect: (r) => (r.stats.matchesFound === 1 && r.stats.tileTraitMatches.echo === 1 ? null : `matches ${r.stats.matchesFound}, echo matched ${r.stats.tileTraitMatches.echo}`) },
            { step: { do: 'match', pairKey: 'c' }, says: 'two in a row is the best chain', expect: (r) => (r.stats.matchesFound === 2 && r.stats.bestStreak === 2 ? null : `matches ${r.stats.matchesFound}, best chain ${r.stats.bestStreak}`) },
            { step: { do: 'clear' }, says: 'one floor cleared, and the miss still counted', expect: (r, b) => (r.stats.levelsCleared === b.stats.levelsCleared + 1 && r.stats.mismatches === 1 ? null : `cleared ${r.stats.levelsCleared}, mismatches ${r.stats.mismatches}`) }
        ]
    },
    {
        id: 'journal',
        title: 'The command journal',
        mechanic: 'Every turn is journaled as one command, match or miss, so a run can be replayed.',
        graphMechanicIds: ['core.gameplay_commands'],
        tryThis: 'Match a pair, then miss: each turn adds one line to the journal.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t']),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the match is one journaled turn', expect: (r, b) => journaledOneTurn(r, b) },
            { step: { do: 'miss', a: 'b-1', b: 'c-1' }, says: 'the miss is one more', expect: (r, b) => journaledOneTurn(r, b) }
        ]
    },
    {
        id: 'realm-frostbite',
        title: 'Frostbite',
        mechanic: 'In the Frozen Reach a miss freezes both cards it showed for two turns: they cannot be turned until the ice goes.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Miss a against b, then try to turn a: it is frozen. Two more turns and the ice is gone.',
        build: () => room(['a:m b:t c:t d:m', 'e:e f:b a:m b:t', 'c:t d:m e:e f:b'], { misses: 4, run: realmRun('frost', 'calm') }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'both cards freeze for two turns', expect: expectAll(frostIs('a-1', 2), frostIs('b-1', 2), realmEventIs('frostbite'), (r) => (r.realmFrozenThisFloor === 2 ? null : `frozen ${r.realmFrozenThisFloor}`)) },
            { step: { do: 'flip', tileId: 'a-1' }, says: 'a frozen card will not turn', expect: (r) => ((r.board?.flippedTileIds.length ?? 0) === 0 ? null : 'the frozen card turned') },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'a turn later the ice is thinner', expect: expectAll(frostIs('a-1', 1), frostIs('c-1', 2)) },
            { step: { do: 'miss', a: 'e-1', b: 'f-1' }, says: 'and then it is gone', expect: expectAll(frostIs('a-1', undefined), frostIs('b-1', undefined)) }
        ]
    },
    {
        id: 'realm-blizzard',
        title: 'Blizzard',
        mechanic: 'On a raging floor the realm keeps its own clock: every third turn in the Frozen Reach a blizzard slides one row of face-down cards with the wind and snows their backs over.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Take three turns on a raging floor and watch the third slide a row and bury its suits in snow.',
        build: () => room(EIGHT_PAIRS, { level: 6, misses: 5, run: realmRun('frost', 'raging') }),
        script: [
            { step: { do: 'miss', a: 'a-1', b: 'b-1' }, says: 'turn one, no weather', expect: (r) => (r.realmWeatherThisFloor === 0 ? null : 'weather on turn one') },
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'turn two, no weather', expect: (r) => (r.realmWeatherThisFloor === 0 ? null : 'weather on turn two') },
            {
                step: { do: 'miss', a: 'e-1', b: 'f-1' },
                says: 'turn three: a row slides and its backs are snowed over',
                expect: expectAll(realmEventIs('blizzard'), (r, b) => {
                    const snowed = (r.board?.tiles ?? []).map((t, index) => ({ t, index })).filter(({ t }) => t.snowed);
                    if (snowed.length < 2) return `${snowed.length} cards snowed`;
                    const cols = r.board!.columns;
                    if (new Set(snowed.map(({ index }) => Math.floor(index / cols))).size !== 1) return 'snow on more than one row';
                    return order(r) !== order(b) ? null : 'no card moved';
                })
            }
        ]
    },
    {
        id: 'realm-wildfire',
        title: 'Wildfire',
        mechanic: 'Every second turn on a raging Cinder Deep, wildfire sets two face-down cards on a three-turn fuse; matched in time a fire is doused for two gold.',
        graphMechanicIds: ['board.realm_weather', 'economy.gold'],
        tryThis: 'Take two turns on a raging floor: the second lights two cards. Match one before its fuse runs out.',
        build: () => room(EIGHT_PAIRS_GROWN, { level: 6, run: realmRun('ember', 'raging', { gold: 0 }) }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'turn one', expect: (r) => ((r.board?.tiles ?? []).some((t) => t.fuse != null) ? 'fire on turn one' : null) },
            { step: { do: 'match', pairKey: 'h' }, says: 'turn two lights two cards on a three-turn fuse', expect: expectAll(realmEventIs('wildfire'), (r) => ((r.board?.tiles ?? []).filter((t) => t.fuse === 3).length === 2 ? null : 'not two cards on a fresh fuse')) },
            { step: { do: 'matchBurning' }, says: 'matched in time, the fire is doused for two gold', expect: expectAll(goldIs(2), (r) => (r.realmDousedThisFloor === 1 ? null : `doused ${r.realmDousedThisFloor}`)) }
        ]
    },
    {
        id: 'realm-burnout',
        title: 'Burnout',
        mechanic: 'A fuse that runs out burns a gold and spreads the fire to a face-down neighbour.',
        graphMechanicIds: ['board.realm_weather', 'economy.gold'],
        tryThis: 'Card c is on its last turn of fuse. Take any turn and watch it burn out and catch beside it.',
        build: () =>
            room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], {
                run: realmRun('ember', 'calm', { gold: 5 }),
                tiles: (tiles) => tiles.map((t) => (t.id === 'c-1' ? { ...t, fuse: 1 } : t))
            }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'the fuse runs out: a gold burns and the fire spreads to a neighbour',
                expect: expectAll(realmEventIs('burnout'), goldIs(4), (r) => (tileById(r, 'c-1')?.fuse == null ? null : 'c-1 still burning'), (r) =>
                    (r.board?.tiles ?? []).filter((t) => t.fuse === 3).length === 1 ? null : 'the fire did not spread')
            }
        ]
    },
    {
        id: 'realm-current',
        title: 'The current',
        mechanic: 'Every second turn on a raging Drowned Vault the tide runs one column of face-down cards down a step, the bottom card to the top, and sweeps across the room.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'One turn into a raging floor, match c: the tide runs the first column down a step.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 4, run: realmRun('tide', 'raging', { turnsThisFloor: 1 }) }),
        script: [
            {
                // A lone moss pair with nothing to pop casts no hold, so the current is all that moves.
                step: { do: 'match', pairKey: 'c' },
                says: 'turn two: the first column runs down a step, the bottom card to the top',
                expect: expectAll(realmEventIs('current'), (r, b) => {
                    const cols = b.board!.columns;
                    const column = b.board!.tiles.map((t, i) => ({ t, i })).filter(({ t, i }) => i % cols === 0 && t.state === 'hidden' && t.pairKey !== 'c');
                    return column.every(({ t }, k) => r.board!.tiles[column[(k + 1) % column.length]!.i]!.id === t.id)
                        ? null
                        : `column 0 reads ${[0, 4, 8].map((i) => r.board!.tiles[i]!.id).join(',')}`;
                })
            }
        ]
    },
    {
        id: 'realm-lightning',
        title: 'Lightning',
        mechanic: 'Every third turn on a raging Thunder Spire lightning strikes twice: two swaps of face-down cards, all four left lit until the next flip.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Two turns into a raging floor, match c: lightning swaps two pairs of cards, and they show where they landed.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 5, run: realmRun('storm', 'raging', { turnsThisFloor: 2 }) }),
        script: [
            {
                step: { do: 'match', pairKey: 'c' },
                says: 'turn three: four cards swap and stay lit',
                expect: expectAll(realmEventIs('lightning'), (r, b) => {
                    const lit = r.realmLitTileIds ?? [];
                    if (lit.length !== 4) return `${lit.length} lit`;
                    return lit.every((id) => positionOf(r, id) !== positionOf(b, id)) ? null : 'a lit card did not move';
                })
            },
            { step: { do: 'flip', tileId: 'b-2' }, says: 'the next flip puts the light out', expect: (r) => ((r.realmLitTileIds ?? []).length === 0 ? null : 'still lit') }
        ]
    },
    {
        id: 'realm-vines',
        title: 'Vines',
        mechanic: 'In the Overgrown Crypt a vined card cannot be turned; a match beside it cuts the vine for a gold.',
        graphMechanicIds: ['board.realm_weather', 'economy.gold'],
        tryThis: 'Try to turn b: the vines hold it. Match a beside it and the vine is cut.',
        build: () =>
            room(['a:e b:t c:m d:b', 'a:e e:t f:m c:b', 'b:t d:b e:t f:m'], {
                run: realmRun('grove', 'calm', { gold: 0 }),
                tiles: (tiles) => tiles.map((t) => (t.id === 'b-1' ? { ...t, vined: true } : t))
            }),
        script: [
            { step: { do: 'flip', tileId: 'b-1' }, says: 'the vined card will not turn', expect: (r) => ((r.board?.flippedTileIds.length ?? 0) === 0 ? null : 'the vined card turned') },
            { step: { do: 'match', pairKey: 'a' }, says: 'the match beside it cuts the vine for a gold', expect: expectAll(realmEventIs('harvest'), goldIs(1), (r) => (tileById(r, 'b-1')?.vined == null ? null : 'b-1 is still vined')) }
        ]
    },
    {
        id: 'realm-overgrowth',
        title: 'Overgrowth',
        mechanic: 'Every second turn on a raging Overgrown Crypt vines creep over two face-down cards, next to vines already there when they can.',
        graphMechanicIds: ['board.realm_weather', 'safety.softlock_fairness'],
        tryThis: 'One turn into a raging floor, match d: vines take two cards; the floor always keeps a pair you can turn.',
        build: () => room(['a:e b:t c:t d:e', 'e:e f:t a:e b:t', 'c:t d:e e:e f:t'], { misses: 4, run: realmRun('grove', 'raging', { turnsThisFloor: 1 }) }),
        script: [
            {
                // A lone bone pair with nothing to pop holds nothing, so the vines are all the weather's.
                step: { do: 'match', pairKey: 'd' },
                says: 'turn two: vines take two cards, and the floor can still be finished',
                expect: expectAll(realmEventIs('overgrowth'), (r) => ((r.board?.tiles ?? []).filter((t) => t.vined).length === 2 ? null : 'not two cards vined'), finishable)
            },
            { step: { do: 'clear' }, says: 'the floor clears around the vines', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'realm-travel',
        title: 'The travel doors',
        mechanic: 'A floor clear offers three doors - three realms, one calm, one wild, one raging - and the next floor is built behind the one walked through.',
        graphMechanicIds: ['economy.realm_travel', 'progression.run_flow'],
        tryThis: 'Clear the floor, pick the second door and descend: the next floor is in that realm.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: realmRun('frost', 'calm') }),
        script: [
            {
                step: { do: 'clear' },
                says: 'the clear offers three doors, the frost among them',
                expect: expectAll(statusIs('levelComplete'), (r) => {
                    const doors = r.realmDoors ?? [];
                    if (doors.length !== 3) return `${doors.length} doors`;
                    if (doors.map((d) => d.severity).sort().join(',') !== 'calm,raging,wild') return 'not one of each severity';
                    return doors.some((d) => d.realmId === 'frost') ? null : 'the realm the floor ended in is not a door';
                })
            },
            { step: { do: 'travel', door: 1 }, says: 'the second door is walked through', expect: (r) => (r.nextRealm?.realmId === r.realmDoors?.[1]?.realmId ? null : 'the door was not taken') },
            {
                step: { do: 'advance' },
                says: 'the next floor is built in that realm, at that severity',
                expect: (r, b) => (r.realmId === b.realmDoors?.[1]?.realmId && r.realmSeverity === b.realmDoors?.[1]?.severity ? null : `built in ${r.realmId}/${r.realmSeverity}`)
            }
        ]
    },
    {
        id: 'realm-whiteout',
        title: 'Whiteout',
        mechanic: 'Every third weather of a floor is the realm\u2019s peak; the Frozen Reach\u2019s is a whiteout that snows over every face-down card.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Two blizzards have blown already. Take one turn: the whiteout buries every suit on the board.',
        build: () => room(EIGHT_PAIRS_THAWED, { level: 6, misses: 3, run: realmRun('frost', 'raging', { realmWeatherThisFloor: 2, turnsThisFloor: 2 }) }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'the peak: every face-down card is snowed over',
                expect: expectAll(realmEventIs('whiteout'), (r) =>
                    (r.board?.tiles ?? []).filter((t) => t.state === 'hidden').every((t) => t.snowed) ? null : 'a face-down card has no snow', (r) =>
                    r.realmPeaksThisFloor === 1 ? null : `peaks ${r.realmPeaksThisFloor}`)
            }
        ]
    },
    {
        id: 'realm-thunderclap',
        title: 'Thunderclap',
        mechanic: 'The Thunder Spire\u2019s peak lights a whole row of face-down cards until the next flip, and moves nothing.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Two strikes have fallen. Take one turn: a whole row shows its faces. Read it before you flip.',
        build: () => room(EIGHT_PAIRS, { level: 6, misses: 3, run: realmRun('storm', 'raging', { realmWeatherThisFloor: 2, turnsThisFloor: 2 }) }),
        script: [
            {
                // A match, not a miss: a raging storm throws a miss's cards, and this peak moves nothing.
                step: { do: 'match', pairKey: 'a' },
                says: 'a whole row lit, and nothing moved',
                expect: expectAll(realmEventIs('thunderclap'), (r) => ((r.realmLitTileIds ?? []).length === 4 ? null : `${(r.realmLitTileIds ?? []).length} lit`), (r, b) =>
                    order(r) === order(b) ? null : 'a card moved')
            }
        ]
    },
    {
        id: 'realm-bloom',
        title: 'Bloom',
        mechanic: 'The Overgrown Crypt\u2019s peak makes its vines bloom: a bloom cut by a match beside it pays three gold.',
        graphMechanicIds: ['board.realm_weather', 'economy.gold'],
        tryThis: 'Card b is vined. Take a turn and the vines bloom; then match a beside it for three gold.',
        build: () =>
            room(['a:e b:t c:e d:t', 'a:e e:t f:e c:e', 'b:t d:t e:t f:e'], {
                misses: 3,
                run: realmRun('grove', 'raging', { gold: 0, realmWeatherThisFloor: 2, turnsThisFloor: 1 }),
                tiles: (tiles) => tiles.map((t) => (t.id === 'b-1' ? { ...t, vined: true } : t))
            }),
        script: [
            { step: { do: 'miss', a: 'c-1', b: 'd-1' }, says: 'the peak: the vines bloom', expect: expectAll(realmEventIs('bloom'), (r) => (tileById(r, 'b-1')?.bloom === true ? null : 'b-1 did not bloom')) },
            { step: { do: 'match', pairKey: 'a' }, says: 'the bloom beside the match is cut for three gold', expect: expectAll((r) => ((r.realmVinesCutThisFloor ?? 0) >= 1 ? null : 'nothing cut'), (r) => (runGold(r) >= 3 ? null : `gold ${runGold(r)}`), (r) => (tileById(r, 'b-1')?.vined == null ? null : 'still vined')) }
        ]
    },
    {
        id: 'realm-confluence',
        title: 'Confluence',
        mechanic: 'A confluence floor is two realms at once: their weather comes by turns, and both answer the player.',
        graphMechanicIds: ['economy.realm_travel', 'board.realm_weather'],
        tryThis: 'Storm meets frost. The next weather is the frost\u2019s, and a miss here freezes like the frost does.',
        build: () => room(EIGHT_PAIRS_THAWED, { level: 6, misses: 3, run: realmRun('storm', 'raging', { realmSecondaryId: 'frost', realmWeatherThisFloor: 1, turnsThisFloor: 2 }) }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'the frost\u2019s blizzard comes on the storm floor, and the miss freezes',
                expect: expectAll(realmEventIs('blizzard'), frostIs('a-1', 3), (r) => (r.realmId === 'storm' && r.realmSecondaryId === 'frost' ? null : `realms ${r.realmId}/${r.realmSecondaryId}`))
            },
            { step: { do: 'clear' }, says: 'and the clear pays double gold', expect: expectAll(statusIs('levelComplete'), (r, b) => ((r.lastLevelResult?.goldEarned ?? 0) >= 4 && runGold(r) > runGold(b) ? null : `earned ${r.lastLevelResult?.goldEarned}`)) }
        ]
    },
    {
        id: 'realm-attunement',
        title: 'Attunement',
        mechanic: 'Every clear in a realm deepens the player\u2019s attunement to it by a level, two when the floor was clean by that realm\u2019s measure, with no cap: a quarter more gold on its clears a level to three, a twentieth after.',
        graphMechanicIds: ['economy.realm_travel', 'economy.gold'],
        tryThis: 'You are nine deep in the Cinder Deep and two in the frost. Clear this ember floor without letting a fire burn out: eleven deep now, and the frost has faded a level.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: realmRun('ember', 'calm', { realmAttunement: { ember: 9, frost: 2 } }) }),
        script: [
            {
                step: { do: 'clear' },
                says: 'a clean clear deepens Ember by two, past any cap, and the frost fades by one',
                expect: expectAll(statusIs('levelComplete'), (r) =>
                    r.realmAttunement?.ember === 11 && r.realmAttunement?.frost === 1 && r.lastLevelResult?.realmAttuned === 'ember' ? null : `attunement ${JSON.stringify(r.realmAttunement)}`)
            }
        ]
    },
    {
        id: 'realm-smoke',
        title: 'Smoke',
        mechanic: 'Every fire that burnt out on a floor hangs in the next room as smoke: its study window is twelve per cent shorter per burnout, up to three.',
        graphMechanicIds: ['board.realm_weather', 'phase.memorize'],
        tryThis: 'Two fires burnt out on this floor. Clear it and descend: the next study is shorter.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: realmRun('ember', 'calm', { realmBurnoutsThisFloor: 2 }) }),
        script: [
            { step: { do: 'clear' }, says: 'the clear sends the smoke on', expect: expectAll(statusIs('levelComplete'), (r) => (r.realmSmoke === 2 && r.lastLevelResult?.realmSmoke === 2 ? null : `smoke ${r.realmSmoke}`)) },
            {
                step: { do: 'advance' },
                says: 'the next floor studies through it: a shorter window',
                expect: expectAll(statusIs('memorize'), (r) => {
                    const clear = getMemorizeDurationForRun({ ...r, realmSmoke: 0 }, r.board?.level ?? 0);
                    const smoky = r.timerState.memorizeRemainingMs ?? 0;
                    return smoky < clear ? null : `study ${smoky} against ${clear} without smoke`;
                })
            }
        ]
    },
    {
        id: 'realm-chill',
        title: 'The chill',
        mechanic: 'A floor that froze four cards or more sends the cold on: the next floor opens with two cards already frozen.',
        graphMechanicIds: ['board.realm_weather', 'progression.run_flow'],
        tryThis: 'Four cards froze on this floor. Clear it and descend: two cards on the next board start frozen.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: realmRun('frost', 'calm', { realmFrozenThisFloor: 4 }) }),
        script: [
            { step: { do: 'clear' }, says: 'the clear sends the cold on', expect: (r) => (r.realmChill === 2 ? null : `chill ${r.realmChill}`) },
            {
                step: { do: 'advance' },
                says: 'two cards of the next floor start frozen, and the chill is spent',
                expect: (r) => {
                    const frozen = (r.board?.tiles ?? []).filter((t) => (t.frost ?? 0) > 0).length;
                    return frozen === 2 && !r.realmChill ? null : `${frozen} frozen, chill ${r.realmChill}`;
                }
            }
        ]
    },
    {
        id: 'realm-scald',
        title: 'Scald',
        mechanic: 'A raging Cinder Deep strikes back at a miss: both cards it showed catch fire on a two-turn fuse.',
        graphMechanicIds: ['board.realm_weather', 'economy.gold'],
        tryThis: 'Miss a against b: both are burning now. Match a before its fuse runs out and the fire is doused for gold.',
        build: () => room(['a:m b:b c:e d:t', 'e:e f:t a:m b:b', 'c:e d:t e:e f:t'], { misses: 4, run: realmRun('ember', 'raging', { gold: 0 }) }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'the miss is scalded: both cards burn on a two-turn fuse',
                expect: expectAll(realmEventIs('scald'), (r) => (tileById(r, 'a-1')?.fuse === 2 && tileById(r, 'b-1')?.fuse === 2 ? null : `fuses ${tileById(r, 'a-1')?.fuse},${tileById(r, 'b-1')?.fuse}`), (r) => (r.realmBacklashesThisFloor === 1 ? null : `backlashes ${r.realmBacklashesThisFloor}`))
            },
            { step: { do: 'match', pairKey: 'a' }, says: 'matched in time, the scald is doused for two gold (the weather comes on this turn too)', expect: expectAll(goldIs(2), (r) => (r.realmDousedThisFloor === 1 ? null : `doused ${r.realmDousedThisFloor}`)) }
        ]
    },
    {
        id: 'realm-undertow',
        title: 'Undertow',
        mechanic: 'A raging Drowned Vault strikes back at a miss: the undertow drags each card it showed one cell down its column.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Miss a against b along the top row: each is dragged a cell down, and the cards below rise to take their places.',
        build: () => room(['a:e b:b c:m d:t', 'e:e f:b a:e b:b', 'c:m d:t e:e f:b'], { misses: 4, run: realmRun('tide', 'raging') }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'both cards are dragged one cell down',
                expect: expectAll(realmEventIs('undertow'), (r, b) => {
                    const cols = b.board!.columns;
                    const a = positionOf(b, 'a-1');
                    const bb = positionOf(b, 'b-1');
                    if (positionOf(r, 'a-1') !== a + cols) return `a-1 at ${positionOf(r, 'a-1')}, expected ${a + cols}`;
                    if (positionOf(r, 'b-1') !== bb + cols) return `b-1 at ${positionOf(r, 'b-1')}, expected ${bb + cols}`;
                    return r.realmBacklashesThisFloor === 1 ? null : `backlashes ${r.realmBacklashesThisFloor}`;
                })
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'realm-static',
        title: 'Static',
        mechanic: 'A raging Thunder Spire strikes back at a miss: static throws each card it showed across the board, swapped with a card of another pair, and lights neither.',
        graphMechanicIds: ['board.realm_weather'],
        tryThis: 'Miss a against b: both are thrown somewhere else, and nothing shows you where.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 4, run: realmRun('storm', 'raging') }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'both cards are thrown elsewhere, unlit',
                expect: expectAll(realmEventIs('static'), (r, b) => {
                    if (positionOf(r, 'a-1') === positionOf(b, 'a-1') || positionOf(r, 'b-1') === positionOf(b, 'b-1')) return 'a missed card stayed put';
                    if ((r.realmLitTileIds ?? []).length > 0) return 'static lit a card';
                    const into = (id: string) => r.board!.tiles[positionOf(b, id)]!;
                    if (into('a-1').pairKey === 'a' || into('b-1').pairKey === 'b') return 'a card swapped with its own pair';
                    return null;
                }, finishable)
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'realm-snare',
        title: 'Snare',
        mechanic: 'A raging Overgrown Crypt strikes back at a miss: both cards it showed are snared in vines and cannot be turned until a match beside them cuts them.',
        graphMechanicIds: ['board.realm_weather', 'safety.softlock_fairness'],
        tryThis: 'Miss a against b, then try to turn a: the vines hold it. Match c beside b to cut b free.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 4, run: realmRun('grove', 'raging', { gold: 0 }) }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'both cards are snared',
                expect: expectAll(realmEventIs('snare'), (r) => (tileById(r, 'a-1')?.vined && tileById(r, 'b-1')?.vined ? null : 'a missed card is not vined'), finishable)
            },
            { step: { do: 'flip', tileId: 'a-1' }, says: 'a snared card will not turn', expect: (r) => ((r.board?.flippedTileIds.length ?? 0) === 0 ? null : 'the snared card turned') },
            { step: { do: 'match', pairKey: 'c' }, says: 'a match beside the snare cuts it, though this turn’s overgrowth may creep back over it', expect: expectAll((r) => ((r.realmVinesCutThisFloor ?? 0) >= 1 ? null : 'no vine was cut'), finishable) }
        ]
    },
    {
        id: 'realm-sway',
        title: 'The sway',
        mechanic: 'Matching pairs of a suit whose realm the floor is not in leans the world toward it; at five pairs, carried between floors and wiped by a miss, the floor tips into that realm.',
        graphMechanicIds: ['board.realm_sway', 'board.realm_weather'],
        tryThis: 'Four tide pairs are already carried into the Frozen Reach. Match b, a tide pair: the fifth tips the floor into the Drowned Vault.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { misses: 4, run: realmRun('frost', 'calm', { realmSway: { tide: 4, moss: 2 } }) }),
        script: [
            {
                step: { do: 'match', pairKey: 'b' },
                says: 'the fifth tide pair tips the floor into the Drowned Vault, and empties the sway',
                expect: expectAll(
                    realmEventIs('reaction'),
                    (r) => (r.realmId === 'tide' ? null : `the floor is in ${r.realmId}`),
                    (r) => (r.lastRealmEvent?.cause === 'sway' && r.lastRealmEvent.from === 'frost' ? null : `event ${JSON.stringify(r.lastRealmEvent)}`),
                    (r) => (r.realmTipsThisFloor === 1 ? null : `tips ${r.realmTipsThisFloor}`),
                    (r) => (Object.keys(r.realmSway ?? {}).length === 0 ? null : `sway left ${JSON.stringify(r.realmSway)}`)
                )
            },
            {
                step: { do: 'match', pairKey: 'c' },
                says: 'a moss pair now leans toward the grove again, from nothing',
                expect: (r) => (r.realmSway?.moss === 1 && r.realmId === 'tide' ? null : `sway ${JSON.stringify(r.realmSway)} in ${r.realmId}`)
            },
            { step: { do: 'missAny' }, says: 'a miss wipes the sway (the grove has snared some of the cards around its match)', expect: (r) => (Object.keys(r.realmSway ?? {}).length === 0 ? null : `sway ${JSON.stringify(r.realmSway)}`) }
        ]
    },
    {
        id: 'element-fire',
        title: 'Fire',
        mechanic: 'The suits are the elements, and a matched group casts its own. An ember group is Fire: it burns vines, ice and snow off the face-down cards within two steps of every card in the group, for nothing.',
        graphMechanicIds: ['board.element_groups'],
        tryThis: 'c-2 is vined and d-2 frozen, out of reach of a plain match. Match a: its pop takes e, and the fire from all four cards burns both clear.',
        build: () =>
            room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], {
                run: realmRun('frost', 'calm'),
                tiles: (tiles) => tiles.map((t) => (t.id === 'c-2' ? { ...t, vined: true } : t.id === 'd-2' ? { ...t, frost: 3 } : t))
            }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the fire group burns the vine and the ice away',
                expect: expectAll(realmEventIs('scorch'), (r) => (tileById(r, 'c-2')?.vined == null && tileById(r, 'd-2')?.frost == null ? null : `c-2 vined ${tileById(r, 'c-2')?.vined}, d-2 frost ${tileById(r, 'd-2')?.frost}`), (r) => ((r.elementCastsThisFloor ?? 0) === 1 ? null : `casts ${r.elementCastsThisFloor}`))
            }
        ]
    },
    {
        id: 'element-water',
        title: 'Water',
        mechanic: 'A tide group is Water: it puts out every fire within two steps of the group and washes the face-down cards it reaches one place along.',
        graphMechanicIds: ['board.element_groups'],
        tryThis: 'e-1, a fire card, is burning. Match b: the water puts the fire out and the cards around it drift.',
        build: () =>
            room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { run: realmRun('frost', 'calm'), tiles: (tiles) => tiles.map((t) => (t.id === 'e-1' ? { ...t, fuse: 2 } : t)) }),
        script: [
            {
                step: { do: 'match', pairKey: 'b' },
                says: 'the fire is out and the cards around the group have moved',
                expect: expectAll(realmEventIs('wash'), (r) => (tileById(r, 'e-1')?.fuse == null ? null : 'e-1 still burning'), (r, b) => {
                    const moved = (r.board?.tiles ?? []).filter((t, i) => t.state === 'hidden' && b.board!.tiles[i]?.id !== t.id);
                    return moved.length >= 2 ? null : `${moved.length} cards moved`;
                })
            }
        ]
    },
    {
        id: 'element-frost',
        title: 'Frost',
        mechanic: 'A bone group is Frost: it kills every fire it reaches, and a group a reaction burst freezes the nearest face-down card it reaches for a turn.',
        graphMechanicIds: ['board.element_groups', 'board.element_resonance', 'safety.softlock_fairness'],
        tryThis: 'Two grove matches are in hand. Match a (frost): the Frostbloom bursts the other frost pair with it, and the frost group freezes the nearest card.',
        build: () => room(['a:b b:b c:m d:e', 'e:t f:t c:m d:e', 'a:b b:b e:t f:t'], { run: realmRun('ember', 'calm', { elementStreak: { suit: 'moss', links: 2 } }) }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the reaction bursts the other frost pair, and the frost group freezes one card, for a turn',
                expect: expectAll(isGone('b'), (r) => ((r.board?.tiles ?? []).filter((t) => t.state === 'hidden' && (t.frost ?? 0) > 0).length === 1 ? null : 'not exactly one frozen card'), finishable)
            },
            { step: { do: 'missAny' }, says: 'a turn later the ice is gone', expect: (r) => ((r.board?.tiles ?? []).some((t) => (t.frost ?? 0) > 0) ? 'still frozen' : null) }
        ]
    },
    {
        id: 'element-grove',
        title: 'Grove',
        mechanic: 'A moss group is Grove: a group a reaction burst snares the nearest face-down card it reaches in vines, until a match beside it or a fire cuts it.',
        graphMechanicIds: ['board.element_groups', 'board.element_resonance', 'safety.softlock_fairness'],
        tryThis: 'Two frost matches are in hand. Match a (grove): the Frostbloom bursts the other grove pair with it, and the vines take the nearest card.',
        build: () => room(['a:m b:m c:e d:t', 'e:b f:b c:e d:t', 'a:m b:m e:b f:b'], { run: realmRun('frost', 'calm', { elementStreak: { suit: 'bone', links: 2 } }) }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the reaction bursts the other grove pair, and the grove group snares one card',
                expect: expectAll(isGone('b'), (r) => ((r.board?.tiles ?? []).filter((t) => t.state === 'hidden' && t.vined).length === 1 ? null : 'not exactly one vined card'), finishable)
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-kin',
        title: 'Kin: a card drinks its own element',
        mechanic: 'Every card is made of its element. An element that reaches a card of its own kind does not act on it: the card drinks it and gains a charge, and a charge matched is a stack of its element\'s resonance.',
        graphMechanicIds: ['board.element_alchemy', 'board.realm_weather'],
        tryThis: 'In the Frozen Reach, miss a frost card (a, ice) with a water card (b): the frost freezes the water card, and the ice card drinks it and glows. Match a and its charge becomes resonance.',
        build: () => room(['a:b b:t c:m d:e', 'e:e f:t a:b b:t', 'c:m d:e e:e f:t'], { run: realmRun('frost', 'calm', { gold: 0 }) }),
        script: [
            {
                step: { do: 'miss', a: 'a-1', b: 'b-1' },
                says: 'the frost freezes the water card; the frost card drinks it and is empowered',
                expect: expectAll(frostIs('a-1', undefined), chargeIs('a-1', 1), (r) => ((tileById(r, 'b-1')?.frost ?? 0) > 0 ? null : 'b-1 not frozen'), (r) => ((r.elementEmpoweredThisFloor ?? 0) === 1 ? null : `empowered ${r.elementEmpoweredThisFloor}`))
            },
            { step: { do: 'match', pairKey: 'a' }, says: 'matched, its charge joins the frost\'s resonance: a stack for the pair and one for the charge', expect: resonanceIs('bone', 2) }
        ]
    },
    {
        id: 'element-neutralize',
        title: 'Counter: a card puts an element out',
        mechanic: 'Each element puts out one other: water puts out fire, fire melts frost, frost kills growth, roots hold against water. That element reaching the card does nothing.',
        graphMechanicIds: ['board.element_alchemy', 'board.realm_weather'],
        tryThis: 'In the Frozen Reach, miss a fire card (d) with a grove card (c): the grove card freezes, the fire card melts the frost and stays free.',
        build: () => room(['a:b b:t c:m d:e', 'e:e f:t a:b b:t', 'c:m d:e e:e f:t'], { run: realmRun('frost', 'calm') }),
        script: [
            {
                step: { do: 'miss', a: 'd-1', b: 'c-1' },
                says: 'the fire card is untouched, the grove card frozen',
                expect: expectAll(frostIs('d-1', undefined), (r) => ((tileById(r, 'c-1')?.frost ?? 0) > 0 ? null : 'c-1 not frozen'), (r) => ((r.elementNeutralizedThisFloor ?? 0) === 1 ? null : `neutralized ${r.elementNeutralizedThisFloor}`), (r) => (tileById(r, 'd-1')?.empowered == null ? null : 'd-1 empowered'))
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-resonance',
        title: 'Resonance: the elements stack',
        mechanic: 'Every pair matched of an element is a stack of it for the run, with no cap; a plain match takes its own pair and nothing else, and is one link of the streak. A missed card sheds a stack of its element and loses its charge, and the miss breaks the streak.',
        graphMechanicIds: ['board.element_resonance'],
        tryThis: 'Water already stands at 40 stacks. Match a (fire): one pair, one stack, one link, and nothing pops with it. Miss a water card: water sheds a stack and the streak is gone. Match water: it climbs again, past forty.',
        build: () => room(SIX_ELEMENTS, { misses: 4, run: realmRun('storm', 'calm', { elementResonance: { tide: 40 } }) }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'the match is a stack of fire and a link in hand, and the other fire pair stands: nothing pops without a reaction', expect: expectAll(isStanding('c'), resonanceIs('ember', 1), streakIs('ember', 1)) },
            { step: { do: 'miss', a: 'b-1', b: 'e-1' }, says: 'the missed water card sheds a stack of water, and the streak breaks', expect: expectAll(resonanceIs('tide', 39), resonanceIs('ember', 1), streakIs(null)) },
            { step: { do: 'match', pairKey: 'b' }, says: 'water stacks on, with no cap to stop at', expect: expectAll(isStanding('d'), resonanceIs('tide', 40), streakIs('tide', 1)) },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-steam',
        title: 'Steam: fire meets water',
        mechanic: 'Two matches of one element in a row prime the streak. A different element matched next spends it: the two react, with a potency of the links in hand plus half the spent element\'s tier, and the reaction bursts that many of the nearest pairs of each of its two elements - the only pop there is. Fire and water make Steam: that many face-down cards nearest the match also show their faces until the next flip.',
        graphMechanicIds: ['board.element_resonance'],
        tryThis: 'One fire match is in hand from the floor above. Match fire again (a): nothing pops. Then a water pair (b): Steam bursts the other fire pair and the other water pair, and two cards beside the match show their faces.',
        build: () => room(SIX_ELEMENTS, { run: realmRun('storm', 'calm', { elementStreak: { suit: 'ember', links: 1 } }) }),
        script: [
            { step: { do: 'match', pairKey: 'a' }, says: 'two links: the streak is primed, nothing has reacted, and nothing popped', expect: expectAll(streakIs('ember', 2), isStanding('c'), (r) => ((r.elementReactionsThisFloor ?? 0) === 0 ? null : 'reacted early')) },
            {
                step: { do: 'match', pairKey: 'b' },
                says: 'water on the primed fire is Steam at potency two: the other fire pair and the other water pair burst, two faces lit, and the hand is water now',
                expect: expectAll(reactedOnce('steam', 2), isGone('c'), isGone('d'), streakIs('tide', 1), (r) => ((r.realmLitTileIds ?? []).length === 2 ? null : `lit ${(r.realmLitTileIds ?? []).length}`))
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-blaze',
        title: 'Blaze: fire meets grove',
        mechanic: 'Fire and grove make a Blaze: every vine and bloom on the floor burns away, and it pays a gold for every two of its potency, rounded up.',
        graphMechanicIds: ['board.element_resonance', 'economy.gold'],
        tryThis: 'Three fire matches are in hand. Match the grove pair (e): the vines across the floor burn off and the Blaze pays two gold.',
        build: () =>
            room(SIX_ELEMENTS, {
                run: realmRun('storm', 'calm', { gold: 0, elementStreak: { suit: 'ember', links: 3 } }),
                tiles: (tiles) => tiles.map((t) => (t.id === 'b-1' || t.id === 'd-1' ? { ...t, vined: true } : t))
            }),
        script: [
            {
                step: { do: 'match', pairKey: 'e' },
                says: 'the Blaze burns both vines and pays two gold',
                expect: expectAll(reactedOnce('blaze', 3), goldIs(2), (r) => ((r.board?.tiles ?? []).some((t) => t.vined) ? 'a vine is left' : null), finishable)
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-thaw',
        title: 'Thaw: fire meets frost',
        mechanic: 'Fire and frost make a Thaw: every card on the floor is freed of ice and snow, and it scores twenty-five times its potency squared.',
        graphMechanicIds: ['board.element_resonance', 'board.realm_weather'],
        tryThis: 'Two frost matches are in hand. Match a fire pair (a): the ice and the snow across the floor are gone at once.',
        build: () =>
            room(SIX_ELEMENTS, {
                run: realmRun('storm', 'calm', { elementStreak: { suit: 'bone', links: 2 } }),
                tiles: (tiles) => tiles.map((t) => (t.id === 'd-1' ? { ...t, frost: 3 } : t.id === 'd-2' ? { ...t, snowed: true } : t))
            }),
        script: [
            {
                step: { do: 'match', pairKey: 'a' },
                says: 'the Thaw frees the frozen card and the snowed one, three steps from the match',
                expect: expectAll(reactedOnce('melt', 2), frostIs('d-1', undefined), (r) => (tileById(r, 'd-2')?.snowed == null ? null : 'd-2 still snowed'))
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-freezeover',
        title: 'Freeze-over: water meets frost',
        mechanic: 'Water and frost make a Freeze-over: the floor holds still for its potency plus one turns. No weather comes, no realm strikes back, a miss in the frost freezes nothing, and no fuse burns down.',
        graphMechanicIds: ['board.element_resonance', 'board.realm_weather'],
        tryThis: 'In a raging Frozen Reach with two water matches in hand, match the frost pair (f): the water pairs burst and the floor holds still. Now miss: nothing freezes.',
        build: () => room(SIX_ELEMENTS, { misses: 4, run: realmRun('frost', 'raging', { elementStreak: { suit: 'tide', links: 2 } }) }),
        script: [
            { step: { do: 'match', pairKey: 'f' }, says: 'the floor holds still for three turns', expect: expectAll(reactedOnce('freezeover', 2), (r) => (r.realmStillTurns === 3 ? null : `still ${r.realmStillTurns}`)) },
            {
                step: { do: 'miss', a: 'e-1', b: 'c-1' },
                says: 'a miss in the raging frost freezes nothing while it holds, and a turn of the stillness is spent',
                expect: expectAll((r) => ((r.board?.tiles ?? []).some((t) => (t.frost ?? 0) > 0) ? 'a card froze' : null), (r) => (r.realmStillTurns === 2 ? null : `still ${r.realmStillTurns}`), (r) => ((r.realmFrozenThisFloor ?? 0) === 0 ? null : `frozen ${r.realmFrozenThisFloor}`))
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-flood',
        title: 'Flood: water meets grove',
        mechanic: 'Water and grove make a Flood: both elements gain its potency in resonance. The potency is the links in hand plus half the spent element\'s tier, so deep water floods deeper.',
        graphMechanicIds: ['board.element_resonance'],
        tryThis: 'Two water matches are in hand and water stands at six stacks (tier two). Match the grove pair (e): the Flood is potency three, it bursts both water pairs, and both elements rise by three.',
        build: () => room(SIX_ELEMENTS, { run: realmRun('storm', 'calm', { elementStreak: { suit: 'tide', links: 2 }, elementResonance: { tide: 6, moss: 1 } }) }),
        script: [
            { step: { do: 'match', pairKey: 'e' }, says: 'water rises by three and by the two pairs the Flood burst, and grove by its pair and three', expect: expectAll(reactedOnce('flood', 3), isGone('b'), isGone('d'), resonanceIs('tide', 11), resonanceIs('moss', 5)) },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'element-frostbloom',
        title: 'Frostbloom: frost meets grove',
        mechanic: 'Frost and grove make a Frostbloom: as many face-down cards as its potency, the nearest to the match, each gain a charge, whatever their element.',
        graphMechanicIds: ['board.element_resonance', 'board.element_alchemy'],
        tryThis: 'Two grove matches are in hand. Match the frost pair (f): the grove pair bursts with it, and the two cards nearest gain a charge, a fire card and a water card.',
        build: () => room(SIX_ELEMENTS, { run: realmRun('storm', 'calm', { elementStreak: { suit: 'moss', links: 2 } }) }),
        script: [
            { step: { do: 'match', pairKey: 'f' }, says: 'the grove pair bursts, and the two nearest cards are charged', expect: expectAll(reactedOnce('frostbloom', 2), isGone('e'), chargeIs('a-1', 1), chargeIs('b-1', 1)) },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    },
    {
        id: 'realm-depth',
        title: 'Depth: a deep realm bites back',
        mechanic: 'Attunement has no cap: every clear in a realm deepens it. A deep realm strikes back at a miss sooner: a wild floor from depth three, and even a calm one from depth six.',
        graphMechanicIds: ['economy.realm_travel', 'board.realm_weather'],
        tryThis: 'This Overgrown Crypt is calm, and you are six deep in it. Miss two water cards: the grove snares them, as only a raging floor used to.',
        build: () => room(SIX_ELEMENTS, { misses: 4, run: realmRun('grove', 'calm', { realmAttunement: { grove: 6 } }) }),
        script: [
            {
                step: { do: 'miss', a: 'b-1', b: 'd-1' },
                says: 'the calm floor strikes back: both missed cards are held in vines',
                expect: expectAll(realmEventIs('snare'), (r) => (tileById(r, 'b-1')?.vined === true && tileById(r, 'd-1')?.vined === true ? null : 'the missed cards are not vined'), (r) => (r.realmBacklashesThisFloor === 1 ? null : `backlashes ${r.realmBacklashesThisFloor}`), finishable)
            },
            { step: { do: 'clear' }, says: 'the floor still clears', expect: statusIs('levelComplete') }
        ]
    }
];

// ---- Playing a room ---------------------------------------------------------------------------

const halvesOf = (run: RunState, pairKey: string): Tile[] =>
    (run.board?.tiles ?? []).filter((t) => t.pairKey === pairKey && t.state === 'hidden');

/**
 * One step through the game's own functions, or `null` when the step cannot be played at all - a
 * pair already gone, a bomb with nothing to aim at. A step that silently did nothing would let a
 * room pass on a script it never played, which is how the first version of "five in a row" passed
 * four matches and one no-op.
 */
export const playTestHallStep = (run: RunState, step: TestHallStep): RunState | null => {
    switch (step.do) {
        case 'match': {
            const [first, second] = halvesOf(run, step.pairKey);
            if (!first || !second) return null;
            return resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
        }
        case 'miss':
            return resolveBoardTurn(flipTile(flipTile(run, step.a), step.b));
        case 'flip':
            return flipTile(run, step.tileId);
        case 'bomb': {
            const target = bombTargetTileId(run);
            return target ? applyBomb(run, target) : null;
        }
        case 'peek':
            return applyPeek(run, step.tileId);
        case 'shuffle':
            return applyShuffle(run);
        case 'swap':
            return applyTileSwap(run, step.a, step.b);
        case 'rowShuffle':
            return applyRegionShuffle(run, step.row);
        case 'undo':
            return cancelResolvingWithUndo(run);
        case 'flash':
            return applyFlashPair(run);
        case 'matchAnchor':
            return run.nBackAnchorPairKey ? playTestHallStep(run, { do: 'match', pairKey: run.nBackAnchorPairKey }) : null;
        case 'matchOther': {
            const other = (run.board?.tiles ?? []).find(
                (t) => t.state === 'hidden' && t.pairKey !== run.nBackAnchorPairKey && halvesOf(run, t.pairKey).length === 2
            );
            return other ? playTestHallStep(run, { do: 'match', pairKey: other.pairKey }) : null;
        }
        case 'missAny': {
            // Turnable cards only: a frozen or vined card refuses the flip, which would leave a half turn.
            const hidden = (run.board?.tiles ?? []).filter((t) => t.state === 'hidden' && t.pairKey !== WILD_PAIR_KEY && !isTileFlipBlocked(t));
            const first = hidden[0];
            const second = hidden.find((t) => first && t.pairKey !== first.pairKey);
            if (!first || !second) return null;
            const next = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
            return next.stats.tries > run.stats.tries ? next : null;
        }
        case 'pin':
            return togglePinnedTile(run, step.tileId);
        case 'ignite': {
            const next = igniteZone(run);
            return next === run ? null : next;
        }
        case 'zoneFlip': {
            const next = zoneFlipTile(run, step.tileId);
            return next === run ? null : next;
        }
        case 'zoneResolve': {
            const next = resolveZone(run);
            return next === run ? null : next;
        }
        case 'gambit':
            return resolveBoardTurn(flipTile(flipTile(flipTile(run, step.a), step.b), step.third));
        case 'wild': {
            const joker = (run.board?.tiles ?? []).find((t) => t.pairKey === WILD_PAIR_KEY && t.state === 'hidden');
            return joker ? resolveBoardTurn(flipTile(flipTile(run, joker.id), step.tileId)) : null;
        }
        case 'buy':
            return buyStoreItem(run, step.item);
        case 'clear': {
            // Real pairs only: a joker left standing is the Wild run's to carry, not a pair to clear.
            let next = run;
            for (let guard = 0; guard < 64 && next.status === 'playing'; guard += 1) {
                // A frozen or vined card cannot be turned yet: clear the pairs that can be.
                const tiles = next.board?.tiles ?? [];
                const pairKey = tiles.find(
                    (t) =>
                        t.state === 'hidden' &&
                        t.pairKey !== WILD_PAIR_KEY &&
                        tiles.filter((other) => other.pairKey === t.pairKey && other.state === 'hidden').every((half) => !isTileFlipBlocked(half))
                )?.pairKey;
                if (!pairKey) break;
                next = playTestHallStep(next, { do: 'match', pairKey }) ?? next;
            }
            return next;
        }
        case 'advance':
            return run.status === 'levelComplete' ? advanceToNextLevel(run) : null;
        case 'travel': {
            const next = chooseRealmDoor(run, step.door);
            return next === run ? null : next;
        }
        case 'matchBurning': {
            const burning = (run.board?.tiles ?? []).find((t) => t.state === 'hidden' && t.fuse != null);
            return burning ? playTestHallStep(run, { do: 'match', pairKey: burning.pairKey }) : null;
        }
        case 'study':
            return run.status === 'memorize' ? finishMemorizePhase(run) : null;
    }
};

export interface TestHallRoomReport {
    readonly id: TestHallRoomId;
    readonly failures: readonly string[];
}

export const walkTestHallRoom = (hallRoom: TestHallRoom): TestHallRoomReport => {
    const failures: string[] = [];
    let run = hallRoom.build();
    hallRoom.script.forEach((line, index) => {
        const before = run;
        const next = playTestHallStep(run, line.step);
        if (next === null) {
            failures.push(`step ${index + 1} (${line.says}): could not be played - ${JSON.stringify(line.step)}`);
            return;
        }
        run = next;
        const problem = line.expect(run, before);
        if (problem) failures.push(`step ${index + 1} (${line.says}): ${problem}`);
    });
    return { id: hallRoom.id, failures };
};

export const testHallRoom = (id: TestHallRoomId): TestHallRoom => TEST_HALL_ROOMS.find((candidate) => candidate.id === id)!;
