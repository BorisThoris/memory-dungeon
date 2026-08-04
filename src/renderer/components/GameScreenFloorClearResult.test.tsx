import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { GameScreenFloorClearResult } from './GameScreenFloorClearResult';
import { useGameScreenFloorClearProjection } from './useGameScreenFloorClearProjection';

const levelCompleteRun = (): RunState => {
    const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
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

const project = (run: RunState, onboardingDismissed = false) =>
    renderHook(() => useGameScreenFloorClearProjection({ onboardingDismissed, run })).result.current;

describe('GameScreenFloorClearResult', () => {
    it('renders nothing while the projected result surface is inactive', () => {
        const { container } = render(
            <GameScreenFloorClearResult projection={project(createNewRun(0))} />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders the projected cashout, carry-forward, and next-action loop', () => {
        render(<GameScreenFloorClearResult projection={project(levelCompleteRun(), true)} />);

        expect(screen.getByTestId('floor-clear-result-stack')).toHaveAttribute(
            'data-route-choice-required',
            'false'
        );
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveAccessibleName(
            expect.stringContaining('Floor clear momentum signals. Score pop: +120. Rating: S.')
        );
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute(
            'data-floor-payoff-stack-audio',
            expect.stringMatching(/^floor-stack-/u)
        );
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveAccessibleName(
            expect.stringContaining('Floor clear cashout read')
        );
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveAccessibleName(
            expect.stringContaining('Carry forward:')
        );
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAccessibleName(
            expect.stringContaining('Next floor loop. First:')
        );
        expect(screen.getByText(/First-run guide complete/u)).toBeTruthy();
        expect(screen.getByText(/Lives carry across the run/u)).toBeTruthy();
    });

    it('renders objective and next-floor multimodal cues from the typed projection', () => {
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

        render(<GameScreenFloorClearResult projection={project(run)} />);

        const objectiveStrip = screen.getByTestId('floor-clear-objective-strip');
        const objectiveReward = objectiveStrip.querySelector('[data-objective-tone="reward"]');
        expect(objectiveReward).toHaveAttribute('data-objective-audio', 'floor-objective-reward');
        expect(objectiveReward).toHaveAttribute('data-objective-beats', '4');
        expect(objectiveReward).toHaveAttribute('data-objective-screen-cue', 'burst');
        expect(objectiveReward?.querySelectorAll('[data-objective-beat]')).toHaveLength(4);

        const nextFloorStrip = screen.getByTestId('floor-clear-next-signal-strip');
        expect(nextFloorStrip).toHaveAccessibleName(
            expect.stringContaining('Next floor preview signals. Floor: Speed Trial')
        );
        expect(nextFloorStrip.querySelector('[data-next-tone="reward"]')).toHaveAttribute(
            'data-next-audio',
            'next-floor-reward'
        );
    });
});
