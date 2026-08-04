import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { getGameScreenNextFloorProjection } from './gameScreenNextFloorProjection';

const completedRun = (gameMode: RunState['gameMode'] = 'endless'): RunState => {
    const base = createNewRun(0, {
        echoFeedbackEnabled: false,
        gameMode,
        runSeed: 42_001
    });
    return {
        ...base,
        relicOffer: null,
        status: 'levelComplete',
        lastLevelResult: {
            level: 1,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: base.lives,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0
        }
    };
};

describe('getGameScreenNextFloorProjection', () => {
    it('does not invent continuation feedback before a floor has completed', () => {
        const projection = getGameScreenNextFloorProjection(
            createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 })
        );

        expect(projection).toBeNull();
    });

    it('projects the deterministic endless schedule into route, objective, pressure, and counterplay facts', () => {
        const projection = getGameScreenNextFloorProjection(completedRun('endless'));

        expect(projection?.signals.map((signal) => signal.id)).toEqual([
            'next-floor',
            'next-objective',
            'next-pressure',
            'next-counterplay'
        ]);
        expect(projection?.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'next-objective',
                audioCue: 'next-floor-reward',
                beatCount: 4,
                screenCue: 'burst',
                tone: 'reward'
            }),
            expect.objectContaining({
                id: 'next-pressure',
                audioCue: 'next-floor-pressure',
                beatCount: 3,
                screenCue: 'guard',
                tone: 'pressure'
            }),
            expect.objectContaining({
                id: 'next-counterplay',
                audioCue: 'next-floor-counterplay',
                beatCount: 4,
                screenCue: 'burst',
                tone: 'counterplay'
            })
        ]));
        expect(projection?.signalsLabel).toContain('Next floor preview signals. Floor: Speed Trial');
        expect(projection?.signalsLabel).toContain('Objective: Flip par - Featured payout target.');
        expect(projection?.clearedNodeCopy).toContain('Cleared node:');
        expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
    });

    it('keeps non-endless floors free of schedule claims while retaining connected-room guidance', () => {
        const projection = getGameScreenNextFloorProjection(completedRun('meditation'));

        expect(projection).toMatchObject({
            signals: [],
            signalsLabel: 'Next floor preview signals'
        });
        expect(projection?.clearedNodeCopy).toContain('Choose a connected room to shape the next board.');
    });
});
