import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import type { RunState } from '../../shared/contracts';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { FEVER_DUCK_MULTIPLIER, feverDuckEventId, feverDuckMultiplier } from './feverDuck';

const runWithTurn = (announcement: Record<string, unknown>): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
    const event = createBoardTurnResolvedEventFixture({ commandId: 'duck-test', announcement });
    return { ...base, gameplayEventJournal: [event] } as RunState;
};

describe('the Fever duck', () => {
    it('is keyed to a turn that broke a chunk at Fever, and to nothing else', () => {
        expect(feverDuckEventId(null)).toBeNull();
        expect(feverDuckEventId(runWithTurn({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 0, chainTierAfter: 'fever' }))).toBeNull();
        expect(feverDuckEventId(runWithTurn({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 2, chainTierAfter: 'sharp' }))).toBeNull();
        expect(feverDuckEventId(runWithTurn({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 2, chainTierAfter: 'fever' }))).toMatch(/./);
    });

    it('ducks once per event and releases when that event is spent', () => {
        expect(FEVER_DUCK_MULTIPLIER).toBeLessThan(1);
        expect(feverDuckMultiplier('evt-1', null)).toBe(FEVER_DUCK_MULTIPLIER);
        expect(feverDuckMultiplier('evt-1', 'evt-1')).toBe(1);
        expect(feverDuckMultiplier(null, null)).toBe(1);
    });
});
