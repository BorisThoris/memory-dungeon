import type { PassAndPlayState } from '../../shared/contracts';
import { applyResolvedTurnToPassAndPlay } from '../../shared/pass-and-play-rules';
import type { BoardTurnResolvedEvent } from './gameplayFeedbackAdapter';

/**
 * Advances the pass-and-play seats from the turn the core already resolved.
 *
 * Deliberately a projection, not a rule inside the turn transition. Every mutating path in this
 * game runs through a command journal that replay and determinism tests read back, and threading a
 * second player through it would put multiplayer bookkeeping into the record of what the board did.
 * The core decides the turn and says so in a typed event; this reads the event and decides who gets
 * credited. Nothing about the board, the seeds or the journal changes because two people are playing.
 */
export const projectPassAndPlayTurn = (
    previous: PassAndPlayState | null | undefined,
    turnEvent: BoardTurnResolvedEvent | null
): PassAndPlayState | null => {
    if (!previous) {
        return null;
    }
    if (!turnEvent) {
        return previous;
    }
    return applyResolvedTurnToPassAndPlay(previous, {
        matched: turnEvent.outcome === 'match' || turnEvent.outcome === 'gambit_match',
        scoreDelta: turnEvent.totalScoreAfter - turnEvent.totalScoreBefore
    });
};
