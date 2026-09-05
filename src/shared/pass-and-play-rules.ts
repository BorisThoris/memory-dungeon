/**
 * Pass-and-play: two to four people, one device, one board.
 *
 * The scope note in `social-play-scope` deferred this for want of four things — turn ownership,
 * per-player labels, scoring handoff, and a restart/game-over policy. All four are local rules, so
 * they live here, as pure functions over a small state that rides along on the run.
 *
 * The turn rule is Concentration's, the one every player at a kitchen table already knows: find a
 * pair and you go again, miss and the device moves on. Nothing about the board changes — the same
 * floors, the same powers, the same lives. What changes is who is credited, and the lives stay
 * shared on purpose: they are the clock the table is racing, not a resource one player can spend
 * out from under another.
 *
 * The seat scores are projected from the `board.turn_resolved` event rather than computed inside
 * the turn transition. The core decides what happened and says so; this reads what it said. That
 * keeps the command journal, replay and every determinism test untouched by multiplayer.
 */

import type { PassAndPlaySeat, PassAndPlayState } from './contracts';

export type { PassAndPlaySeat, PassAndPlayState };

/** Two people is the point; four is where a single device stops being fair to the person waiting. */
export const PASS_AND_PLAY_MIN_SEATS = 2;
export const PASS_AND_PLAY_MAX_SEATS = 4;

const clampSeatCount = (requested: number): number => {
    if (!Number.isFinite(requested)) {
        return PASS_AND_PLAY_MIN_SEATS;
    }
    return Math.min(PASS_AND_PLAY_MAX_SEATS, Math.max(PASS_AND_PLAY_MIN_SEATS, Math.trunc(requested)));
};

export const createPassAndPlayState = (seatCount: number = PASS_AND_PLAY_MIN_SEATS): PassAndPlayState => ({
    activeSeatIndex: 0,
    handoffPending: false,
    seats: Array.from({ length: clampSeatCount(seatCount) }, (_unused, index) => ({
        id: `seat-${index + 1}`,
        label: `Player ${index + 1}`,
        matches: 0,
        score: 0,
        turns: 0
    }))
});

/**
 * Every seat count the rules accept, so a screen can offer them all instead of picking one and
 * leaving the rest reachable only from a unit test.
 */
export const passAndPlaySeatCounts = (): readonly number[] =>
    Array.from(
        { length: PASS_AND_PLAY_MAX_SEATS - PASS_AND_PLAY_MIN_SEATS + 1 },
        (_unused, index) => PASS_AND_PLAY_MIN_SEATS + index
    );

export const getActiveSeat = (state: PassAndPlayState): PassAndPlaySeat | null =>
    state.seats[state.activeSeatIndex] ?? null;

export interface ResolvedTurnFacts {
    /** A pair was found, so the same player keeps the device. */
    readonly matched: boolean;
    /** Change in the run's total score across this turn, credited whichever way it went. */
    readonly scoreDelta: number;
}

/**
 * Credits the turn to whoever took it, then decides whether the device moves.
 *
 * The delta is credited whether it is positive or not: a miss that costs the run points costs them
 * to the player who missed, which is the whole reason to track a seat at all.
 */
export const applyResolvedTurnToPassAndPlay = (
    state: PassAndPlayState,
    { matched, scoreDelta }: ResolvedTurnFacts
): PassAndPlayState => {
    const delta = Number.isFinite(scoreDelta) ? Math.trunc(scoreDelta) : 0;
    const seats = state.seats.map((seat, index) =>
        index === state.activeSeatIndex
            ? {
                  ...seat,
                  matches: seat.matches + (matched ? 1 : 0),
                  score: seat.score + delta,
                  turns: seat.turns + 1
              }
            : seat
    );
    if (matched) {
        return { ...state, handoffPending: false, seats };
    }
    return {
        activeSeatIndex: (state.activeSeatIndex + 1) % Math.max(1, seats.length),
        handoffPending: true,
        seats
    };
};

/** Called when the next player acts, so the handoff prompt stops covering their board. */
export const acknowledgePassAndPlayHandoff = (state: PassAndPlayState): PassAndPlayState =>
    state.handoffPending ? { ...state, handoffPending: false } : state;

export interface PassAndPlayStanding {
    readonly seat: PassAndPlaySeat;
    /** Shared by every seat on the same score, so a tie reads as a tie rather than an order. */
    readonly rank: number;
    readonly winner: boolean;
}

export interface PassAndPlayOutcome {
    readonly standings: readonly PassAndPlayStanding[];
    /** Every seat on the top score. More than one means the table drew. */
    readonly winners: readonly PassAndPlaySeat[];
    readonly tied: boolean;
    readonly topScore: number;
}

/**
 * Who won. A draw is reported as a draw rather than broken by seat order — the first player already
 * has the advantage of going first, and quietly handing them ties as well would be a rule nobody
 * agreed to.
 */
export const resolvePassAndPlayOutcome = (state: PassAndPlayState): PassAndPlayOutcome => {
    const scores = state.seats.map((seat) => seat.score);
    const topScore = scores.length > 0 ? Math.max(...scores) : 0;
    const ordered = [...state.seats].sort((left, right) => right.score - left.score);
    const standings = ordered.map((seat) => ({
        rank: ordered.filter((other) => other.score > seat.score).length + 1,
        seat,
        winner: seat.score === topScore
    }));
    const winners = state.seats.filter((seat) => seat.score === topScore);
    return { standings, tied: winners.length > 1, topScore, winners };
};

/** A run carries this only when it is a pass-and-play run; every solo run leaves it null. */
export const isPassAndPlayRun = (state: PassAndPlayState | null | undefined): state is PassAndPlayState =>
    state != null && state.seats.length >= PASS_AND_PLAY_MIN_SEATS;
