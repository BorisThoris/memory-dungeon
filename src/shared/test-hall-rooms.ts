import { applyBomb, applyPeek, applyShuffle, bombTargetTileId } from './board-power-actions';
import type { BoardState, MutatorId, RunState, Tile, TileSuit } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap, missesLeft } from './miss-bank';
import { buyStoreItem, isStoreStopFloor, runGold, type StoreItemId } from './run-store-rules';
import { getMemorizeDurationForRun } from './scoring-rules';

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
    | 'score-glint';

export type TestHallStep =
    | { readonly do: 'match'; readonly pairKey: string }
    | { readonly do: 'miss'; readonly a: string; readonly b: string }
    | { readonly do: 'flip'; readonly tileId: string }
    | { readonly do: 'bomb' }
    | { readonly do: 'peek'; readonly tileId: string }
    | { readonly do: 'shuffle' }
    | { readonly do: 'buy'; readonly item: StoreItemId }
    | { readonly do: 'clear' };

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
        pairCount: new Set(laid.map((t) => t.pairKey)).size,
        matchedPairs: 0,
        flippedTileIds: [],
        cursedPairKey: null,
        wardPairKey: null,
        bountyPairKey: null,
        tiles: laid
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
const turnsAre = (n: number) => (run: RunState) => (run.turnsThisFloor === n ? null : `turns ${run.turnsThisFloor}, expected ${n}`);

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
        case 'buy':
            return buyStoreItem(run, step.item);
        case 'clear': {
            let next = run;
            for (let guard = 0; guard < 64 && next.status === 'playing'; guard += 1) {
                const pairKey = (next.board?.tiles ?? []).find((t) => t.state === 'hidden')?.pairKey;
                if (!pairKey) break;
                next = playTestHallStep(next, { do: 'match', pairKey }) ?? next;
            }
            return next;
        }
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
