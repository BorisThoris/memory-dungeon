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
import { advanceToNextLevel, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap, missesLeft } from './miss-bank';
import { buyStoreItem, isStoreStopFloor, runGold, type StoreItemId } from './run-store-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { anchorMarkedTileId } from './n-back-anchor-rules';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { WILD_PAIR_KEY } from './tile-identity';

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
    | 'journal';

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
    | { readonly do: 'clear' }
    /** Descend from a cleared floor to the next one, which opens on its study window. */
    | { readonly do: 'advance' }
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
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 90_210 }));
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
        tryThis: 'Flip any card, then press Bomb on the dock.',
        build: () => room(['a:e b:t', 'c:m a:e', 'b:t c:m'], { run: { bombCharges: 1 } }),
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
        tryThis: 'One pair left. Flip a card: the Bomb stays dark. Match it instead.',
        build: () =>
            room(['a:e b:t', 'a:e b:t'], {
                run: { bombCharges: 1 },
                tiles: (tiles) => tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t))
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
            { step: { do: 'buy', item: 'bomb' }, says: 'a bomb costs 4 gold', expect: (r, b) => (r.bombCharges === 1 && runGold(b) - runGold(r) === 4 ? null : `bombs ${r.bombCharges}, gold ${runGold(b)} -> ${runGold(r)}`) }
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
        id: 'n-back',
        title: 'The anchor',
        mechanic: 'After a match the floor marks one card of a face-down pair; match that pair for an extra chain link. Two matches without it and it moves on.',
        graphMechanicIds: ['board.n_back_anchor', 'board.chain_chunk_fever'],
        tryThis: 'Match any pair: one face-down card is marked. Find its partner and match them for two links instead of one.',
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t', 'g:m h:b g:m h:b'], { mutators: ['n_back_anchor'] }),
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
        build: () => room(['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t'], { mutators: ['shifting_spotlight'], board: { wardPairKey: 'a', bountyPairKey: 'b' } }),
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
                    const without = getMemorizeDurationForRun(withoutMutators(r), 2);
                    return without - (r.timerState.memorizeRemainingMs ?? without) === 350 ? null : `window ${r.timerState.memorizeRemainingMs} against ${without}`;
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
        case 'pin':
            return togglePinnedTile(run, step.tileId);
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
                const pairKey = (next.board?.tiles ?? []).find((t) => t.state === 'hidden' && t.pairKey !== WILD_PAIR_KEY)?.pairKey;
                if (!pairKey) break;
                next = playTestHallStep(next, { do: 'match', pairKey }) ?? next;
            }
            return next;
        }
        case 'advance':
            return run.status === 'levelComplete' ? advanceToNextLevel(run) : null;
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
