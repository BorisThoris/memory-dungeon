import { describe, expect, it } from 'vitest';
import { createPassAndPlayState } from '../../shared/pass-and-play-rules';
import type { BoardTurnResolvedEvent } from './gameplayFeedbackAdapter';
import { projectPassAndPlayTurn } from './passAndPlayProjection';

type ChainFacts = Pick<BoardTurnResolvedEvent['announcement'], 'chunkPairsBrokenBefore' | 'chunkPairsBrokenAfter' | 'chainAfter'>;

const turnEvent = (
    partial: Partial<Omit<BoardTurnResolvedEvent, 'announcement'>> & { announcement?: Partial<ChainFacts> }
): BoardTurnResolvedEvent =>
    ({
        outcome: 'match',
        totalScoreBefore: 0,
        totalScoreAfter: 0,
        ...partial,
        announcement: { chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 0, chainAfter: 0, ...partial.announcement }
    }) as unknown as BoardTurnResolvedEvent;

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

    it('credits the chunk and the chain the event stamped to the seat that took the turn', () => {
        const state = createPassAndPlayState();
        const broke = projectPassAndPlayTurn(
            state,
            turnEvent({ announcement: { chunkPairsBrokenBefore: 2, chunkPairsBrokenAfter: 6, chainAfter: 5 }, totalScoreAfter: 900 })
        );
        expect(broke?.seats[0]).toMatchObject({ chunkPairs: 4, chain: 5, bestChain: 5, score: 900 });
        const dropped = projectPassAndPlayTurn(broke, turnEvent({ outcome: 'mismatch', announcement: { chainAfter: 0 } }));
        expect(dropped?.handoffChainLost).toBe(5);
        expect(dropped?.seats[0]).toMatchObject({ chain: 0, bestChain: 5 });
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
