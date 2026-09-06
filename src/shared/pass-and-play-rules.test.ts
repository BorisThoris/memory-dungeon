import { describe, expect, it } from 'vitest';
import {
    acknowledgePassAndPlayHandoff,
    describePassAndPlayChainLost,
    applyResolvedTurnToPassAndPlay,
    createPassAndPlayState,
    getActiveSeat,
    isPassAndPlayFinalFloor,
    isPassAndPlayRun,
    PASS_AND_PLAY_FLOORS,
    PASS_AND_PLAY_MAX_SEATS,
    PASS_AND_PLAY_MIN_SEATS,
    passAndPlaySeatCounts,
    resolvePassAndPlayOutcome
} from './pass-and-play-rules';

const match = (delta: number) => ({ matched: true, scoreDelta: delta });
const miss = (delta = 0) => ({ matched: false, scoreDelta: delta });

describe('createPassAndPlayState', () => {
    it('seats two players by default, with the first to act', () => {
        const state = createPassAndPlayState();
        expect(state.seats.map((seat) => seat.label)).toEqual(['Player 1', 'Player 2']);
        expect(state.activeSeatIndex).toBe(0);
        expect(state.handoffPending).toBe(false);
        expect(state.seats.every((seat) => seat.score === 0 && seat.turns === 0)).toBe(true);
    });

    it('clamps a seat count nobody could play to the range that is playable', () => {
        expect(createPassAndPlayState(1).seats).toHaveLength(PASS_AND_PLAY_MIN_SEATS);
        expect(createPassAndPlayState(9).seats).toHaveLength(PASS_AND_PLAY_MAX_SEATS);
        expect(createPassAndPlayState(Number.NaN).seats).toHaveLength(PASS_AND_PLAY_MIN_SEATS);
        expect(createPassAndPlayState(3).seats).toHaveLength(3);
    });

    it('gives every seat a distinct id, because the HUD keys on it', () => {
        const ids = createPassAndPlayState(4).seats.map((seat) => seat.id);
        expect(new Set(ids).size).toBe(4);
    });
});

describe('the agreed length', () => {
    it('runs for a stated number of floors rather than until the lives run out', () => {
        // A solo run is endless by design. A table wants a contest it can finish in one sitting,
        // with the same amount of board for everyone.
        expect(PASS_AND_PLAY_FLOORS).toBeGreaterThan(1);
        expect(isPassAndPlayFinalFloor(PASS_AND_PLAY_FLOORS)).toBe(true);
        expect(isPassAndPlayFinalFloor(PASS_AND_PLAY_FLOORS - 1)).toBe(false);
    });

    it('treats anything past the agreed length as finished too, not as another floor', () => {
        expect(isPassAndPlayFinalFloor(PASS_AND_PLAY_FLOORS + 5)).toBe(true);
    });

    it('does not end on a level it cannot read', () => {
        expect(isPassAndPlayFinalFloor(Number.NaN)).toBe(false);
    });
});

describe('passAndPlaySeatCounts', () => {
    it('offers every seat count the rules accept, so none is reachable only from a test', () => {
        expect(passAndPlaySeatCounts()).toEqual([2, 3, 4]);
    });

    it('stays in step with the bounds rather than repeating them', () => {
        const counts = passAndPlaySeatCounts();
        expect(counts[0]).toBe(PASS_AND_PLAY_MIN_SEATS);
        expect(counts[counts.length - 1]).toBe(PASS_AND_PLAY_MAX_SEATS);
        expect(counts.every((seats) => createPassAndPlayState(seats).seats.length === seats)).toBe(true);
    });
});

describe('applyResolvedTurnToPassAndPlay', () => {
    it('keeps the device with a player who found a pair', () => {
        const after = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), match(120));
        expect(after.activeSeatIndex).toBe(0);
        expect(after.handoffPending).toBe(false);
        expect(after.seats[0]).toMatchObject({ matches: 1, score: 120, turns: 1 });
        expect(after.seats[1]).toMatchObject({ matches: 0, score: 0, turns: 0 });
    });

    it('passes the device on a miss and raises the handoff', () => {
        const after = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), miss());
        expect(after.activeSeatIndex).toBe(1);
        expect(after.handoffPending).toBe(true);
        expect(after.seats[0]).toMatchObject({ matches: 0, turns: 1 });
    });

    it('wraps back to the first player at the end of the table', () => {
        let state = createPassAndPlayState(3);
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.activeSeatIndex).toBe(2);
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.activeSeatIndex).toBe(0);
    });

    it('charges a losing turn to whoever took it, not to the player who inherits the board', () => {
        // The whole reason to track a seat: a miss that costs the run points costs them to the
        // player who missed.
        const after = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), miss(-40));
        expect(after.seats[0]?.score).toBe(-40);
        expect(after.seats[1]?.score).toBe(0);
    });

    it('treats a delta it cannot read as no change rather than NaN', () => {
        const after = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), match(Number.NaN));
        expect(after.seats[0]?.score).toBe(0);
    });

    it('runs a whole two-player exchange the way a table would play it', () => {
        let state = createPassAndPlayState();
        state = applyResolvedTurnToPassAndPlay(state, match(100));
        state = applyResolvedTurnToPassAndPlay(state, match(150));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.activeSeatIndex).toBe(1);
        state = applyResolvedTurnToPassAndPlay(state, match(90));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.seats[0]).toMatchObject({ matches: 2, score: 250, turns: 3 });
        expect(state.seats[1]).toMatchObject({ matches: 1, score: 90, turns: 2 });
        expect(state.activeSeatIndex).toBe(0);
    });
});

describe('the chain at a shared table', () => {
    it('credits a chunk to the seat whose turn broke it, and keeps that seat\'s longest chain', () => {
        let state = createPassAndPlayState();
        state = applyResolvedTurnToPassAndPlay(state, { ...match(100), chainAfter: 1 });
        state = applyResolvedTurnToPassAndPlay(state, { ...match(150), chainAfter: 2 });
        state = applyResolvedTurnToPassAndPlay(state, { ...match(400), chainAfter: 5, chunkPairs: 3 });
        expect(state.seats[0]).toMatchObject({ chunkPairs: 3, bestChain: 5, chain: 5 });
        expect(state.seats[1]).toMatchObject({ chunkPairs: 0, bestChain: 0, chain: 0 });
    });

    it('ends the seat\'s chain on a miss and remembers what the handoff cost', () => {
        let state = createPassAndPlayState();
        state = applyResolvedTurnToPassAndPlay(state, { ...match(100), chainAfter: 3 });
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.seats[0]).toMatchObject({ chain: 0, bestChain: 3 });
        expect(state.handoffChainLost).toBe(3);
        expect(describePassAndPlayChainLost(state)).toEqual({ label: 'Player 1', chain: 3 });
        // The next seat's first match clears it: nothing lingers into their turn.
        state = applyResolvedTurnToPassAndPlay(state, { ...match(50), chainAfter: 1 });
        expect(state.handoffChainLost).toBe(0);
        expect(describePassAndPlayChainLost(state)).toBeNull();
    });

    it('does not name a chain too short to notice, and counts a match without a stamped chain as one link', () => {
        let state = createPassAndPlayState(3);
        state = applyResolvedTurnToPassAndPlay(state, match(10));
        expect(state.seats[0]?.chain).toBe(1);
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.handoffChainLost).toBe(1);
        expect(describePassAndPlayChainLost(state)).toBeNull();
        // The seat that lost the device is the one before the active seat, wrapping at the table's end.
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, { ...match(10), chainAfter: 2 });
        state = applyResolvedTurnToPassAndPlay(state, miss());
        expect(state.activeSeatIndex).toBe(0);
        expect(describePassAndPlayChainLost(state)).toEqual({ label: 'Player 3', chain: 2 });
    });
});

describe('acknowledgePassAndPlayHandoff', () => {
    it('clears the prompt once the next player acts', () => {
        const passed = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), miss());
        expect(acknowledgePassAndPlayHandoff(passed).handoffPending).toBe(false);
    });

    it('returns the same state when there is nothing to acknowledge', () => {
        const state = createPassAndPlayState();
        expect(acknowledgePassAndPlayHandoff(state)).toBe(state);
    });
});

describe('resolvePassAndPlayOutcome', () => {
    it('names the higher score the winner', () => {
        let state = createPassAndPlayState();
        state = applyResolvedTurnToPassAndPlay(state, match(300));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, match(120));
        const outcome = resolvePassAndPlayOutcome(state);
        expect(outcome.tied).toBe(false);
        expect(outcome.winners.map((seat) => seat.label)).toEqual(['Player 1']);
        expect(outcome.topScore).toBe(300);
        expect(outcome.standings.map((row) => row.seat.label)).toEqual(['Player 1', 'Player 2']);
    });

    it('reports a draw as a draw instead of handing it to whoever went first', () => {
        let state = createPassAndPlayState();
        state = applyResolvedTurnToPassAndPlay(state, match(200));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, match(200));
        const outcome = resolvePassAndPlayOutcome(state);
        expect(outcome.tied).toBe(true);
        expect(outcome.winners.map((seat) => seat.label)).toEqual(['Player 1', 'Player 2']);
        expect(outcome.standings.every((row) => row.rank === 1 && row.winner)).toBe(true);
    });

    it('shares a rank between tied seats rather than ordering them', () => {
        let state = createPassAndPlayState(3);
        state = applyResolvedTurnToPassAndPlay(state, match(500));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, match(100));
        state = applyResolvedTurnToPassAndPlay(state, miss());
        state = applyResolvedTurnToPassAndPlay(state, match(100));
        const ranks = resolvePassAndPlayOutcome(state).standings.map((row) => [row.seat.label, row.rank]);
        expect(ranks).toEqual([
            ['Player 1', 1],
            ['Player 2', 2],
            ['Player 3', 2]
        ]);
    });

    it('is defined on a table where nobody has scored yet', () => {
        const outcome = resolvePassAndPlayOutcome(createPassAndPlayState());
        expect(outcome.topScore).toBe(0);
        expect(outcome.tied).toBe(true);
    });
});

describe('getActiveSeat and isPassAndPlayRun', () => {
    it('names the seat whose turn it is', () => {
        expect(getActiveSeat(createPassAndPlayState())?.label).toBe('Player 1');
        expect(getActiveSeat(applyResolvedTurnToPassAndPlay(createPassAndPlayState(), miss()))?.label).toBe('Player 2');
    });

    it('says a solo run is not a pass-and-play run', () => {
        expect(isPassAndPlayRun(null)).toBe(false);
        expect(isPassAndPlayRun(undefined)).toBe(false);
        expect(isPassAndPlayRun(createPassAndPlayState())).toBe(true);
    });
});
