import { describe, expect, it } from 'vitest';
import {
    acknowledgePassAndPlayHandoff,
    applyResolvedTurnToPassAndPlay,
    createPassAndPlayState,
    getActiveSeat,
    isPassAndPlayRun,
    PASS_AND_PLAY_MAX_SEATS,
    PASS_AND_PLAY_MIN_SEATS,
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
