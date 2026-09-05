import { describe, expect, it } from 'vitest';
import { createPassAndPlayState } from '../../shared/pass-and-play-rules';
import type { BoardTurnResolvedEvent } from './gameplayFeedbackAdapter';
import { projectPassAndPlayTurn } from './passAndPlayProjection';

const turnEvent = (partial: Partial<BoardTurnResolvedEvent>): BoardTurnResolvedEvent =>
    ({
        outcome: 'match',
        totalScoreBefore: 0,
        totalScoreAfter: 0,
        ...partial
    }) as BoardTurnResolvedEvent;

describe('projectPassAndPlayTurn', () => {
    it('leaves a solo run alone rather than inventing a table', () => {
        expect(projectPassAndPlayTurn(null, turnEvent({}))).toBeNull();
        expect(projectPassAndPlayTurn(undefined, turnEvent({}))).toBeNull();
    });

    it('returns the seats unchanged when the core resolved no turn', () => {
        const state = createPassAndPlayState();
        expect(projectPassAndPlayTurn(state, null)).toBe(state);
    });

    it('credits a match to the active seat and leaves the device with them', () => {
        const after = projectPassAndPlayTurn(
            createPassAndPlayState(),
            turnEvent({ outcome: 'match', totalScoreBefore: 40, totalScoreAfter: 190 })
        );
        expect(after?.seats[0]).toMatchObject({ matches: 1, score: 150 });
        expect(after?.activeSeatIndex).toBe(0);
    });

    it('counts a gambit match as a match, because it is one', () => {
        const after = projectPassAndPlayTurn(
            createPassAndPlayState(),
            turnEvent({ outcome: 'gambit_match', totalScoreBefore: 0, totalScoreAfter: 60 })
        );
        expect(after?.seats[0]?.matches).toBe(1);
        expect(after?.activeSeatIndex).toBe(0);
    });

    it('passes the device on a mismatch and on a failed gambit alike', () => {
        expect(projectPassAndPlayTurn(createPassAndPlayState(), turnEvent({ outcome: 'mismatch' }))?.activeSeatIndex).toBe(1);
        expect(
            projectPassAndPlayTurn(createPassAndPlayState(), turnEvent({ outcome: 'gambit_mismatch' }))?.activeSeatIndex
        ).toBe(1);
    });

    it('reads the score delta from the event rather than from the run', () => {
        // The whole point of the boundary: the seats never diff a run snapshot, so nothing about
        // multiplayer can reach the command journal or move a seed.
        const after = projectPassAndPlayTurn(
            createPassAndPlayState(),
            turnEvent({ outcome: 'mismatch', totalScoreBefore: 500, totalScoreAfter: 450 })
        );
        expect(after?.seats[0]?.score).toBe(-50);
        expect(after?.seats[1]?.score).toBe(0);
    });
});
