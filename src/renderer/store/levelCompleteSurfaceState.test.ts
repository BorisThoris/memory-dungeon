import { describe, expect, it } from 'vitest';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import {
    createLevelCompleteContinuationSurfaceResult,
    shouldPrepareMemorizeTimerForContinuation
} from './levelCompleteSurfaceState';

describe('levelCompleteSurfaceState', () => {





    it('advances normal completed floors to the next level and requests memorize timer setup', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const result = createLevelCompleteContinuationSurfaceResult(run);

        expect(result.kind).toBe('nextLevel');
        expect(shouldPrepareMemorizeTimerForContinuation(result)).toBe(true);
        if (result.kind === 'nextLevel') {
            expect(result.patch).toMatchObject({
                boardPinMode: false,
                matchScorePop: null,
                mismatchScorePop: null,
                newlyUnlockedAchievements: [],
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: result.run,
                view: 'playing'
            });
            expect(result.run.status).toBe('memorize');
            expect(result.run.gameplayCommandJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'floor.advance' })
            ]));
            expect(result.run.gameplayCommandJournal?.map((command) => command.type)).not.toContain('floor.parasite_advance');
            expect(result.run.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'floor.advanced', outcome: 'memorize' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'floor.advance.ready' })
            ]));
        }
    });
});
