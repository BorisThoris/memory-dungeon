import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { useGameScreenFloorClearProjection } from './useGameScreenFloorClearProjection';

const levelCompleteRun = (): RunState => {
    const base = createNewRun(0);
    return {
        ...base,
        status: 'levelComplete',
        lives: 5,
        relicOffer: null,
        stats: {
            ...base.stats,
            totalScore: 120,
            currentLevelScore: 120,
            tries: 1,
            rating: 'S',
            levelsCleared: 1,
            matchesFound: 2,
            highestLevel: 1,
            currentStreak: 2,
            bestStreak: 2,
            comboShards: 1
        },
        lastLevelResult: {
            level: 1,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: 5,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0
        }
    };
};

describe('useGameScreenFloorClearProjection', () => {
    it('returns an inert floor-clear projection during active play', () => {
        const run = createNewRun(0);
        const { result } = renderHook(() => useGameScreenFloorClearProjection({
            onboardingDismissed: false,
            run
        }));

        expect(result.current.floorClearVisible).toBe(false);
        expect(result.current.clearLifeBonusLabel).toBeNull();
        expect(result.current.floorClearCashoutRows).toEqual([]);
        expect(result.current.floorClearPayoffStackSignal).toBeNull();
        expect(result.current.floorClearPayoffStackProjection).toBeNull();
        expect(result.current.routeChoiceRequired).toBe(false);
    });

    it('projects one floor result into cashout, momentum, continuation, and onboarding facts', () => {
        const run = levelCompleteRun();
        const { result } = renderHook(() => useGameScreenFloorClearProjection({
            onboardingDismissed: true,
            run
        }));

        expect(result.current.floorClearVisible).toBe(true);
        expect(result.current.floorClearMomentumRows).toEqual(expect.arrayContaining([
            { id: 'score', label: 'Score pop', value: '+120' },
            { id: 'rating', label: 'Rating', value: 'S' }
        ]));
        expect(result.current.floorClearCashoutRows).toHaveLength(3);
        expect(result.current.floorClearCarryForwardCue).not.toBeNull();
        expect(result.current.floorClearCarryForwardAriaLabel).toContain('Carry forward:');
        expect(result.current.floorClearActionSequenceCue).not.toBeNull();
        expect(result.current.floorClearActionSequenceAriaLabel).toContain('Next floor loop. First:');
        expect(result.current.floorClearPayoffStackProjection).toMatchObject({
            action: expect.any(String),
            ariaLabel: expect.stringContaining('beats'),
            audioCue: expect.stringMatching(/^floor-stack-/u),
            beatCount: expect.any(Number),
            screenCue: expect.any(String)
        });
        expect(result.current.firstClearOnboardingLine).toContain('First-run guide complete');
        expect(result.current.nextFloorProjection?.signals.map((signal) => signal.id)).toEqual([
            'next-floor',
            'next-objective',
            'next-pressure',
            'next-counterplay'
        ]);
    });

    it('keeps accepted wager stake, payoff, primary cue, and accessibility copy synchronized', () => {
        const base = levelCompleteRun();
        const run = {
            ...base,
            featuredObjectiveStreak: 4,
            endlessRiskWager: {
                acceptedOnLevel: 1,
                bonusFavorOnSuccess: 3,
                streakAtRisk: 4
            }
        } as RunState;
        const { result } = renderHook(() => useGameScreenFloorClearProjection({
            onboardingDismissed: false,
            run
        }));

        expect(result.current.visibleRiskWagerSignalRows).toEqual(expect.arrayContaining([
            { label: 'Armed', value: 'x4 streak', tone: 'armed' },
            { label: 'Payoff', value: '+3 Favor', tone: 'reward' }
        ]));
        expect(result.current.riskWagerPrimaryCue).toMatchObject({ label: 'Wager armed', risk: 'x4 streak' });
        expect(result.current.riskWagerArmAriaLabel).toContain('Payoff: +3 Favor');
    });

    it('projects objective audio, beat, and screen cues before presentation', () => {
        const base = levelCompleteRun();
        const run: RunState = {
            ...base,
            featuredObjectiveStreak: 2,
            lastLevelResult: {
                ...base.lastLevelResult!,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: 2,
                featuredObjectiveStreakBonus: 10,
                objectiveBonusScore: 30,
                relicFavorGained: 1
            }
        };
        const { result } = renderHook(() => useGameScreenFloorClearProjection({
            onboardingDismissed: false,
            run
        }));

        expect(result.current.floorClearObjectiveSignalProjections).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'featured-objective',
                audioCue: 'floor-objective-reward',
                beatCount: 4,
                screenCue: 'burst'
            }),
            expect.objectContaining({
                id: 'objective-streak',
                audioCue: 'floor-objective-momentum',
                beatCount: 3,
                screenCue: 'pulse'
            })
        ]));
    });
});
