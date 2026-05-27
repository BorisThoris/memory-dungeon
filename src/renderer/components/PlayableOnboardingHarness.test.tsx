import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { createDefaultSaveData } from '../../shared/save-data';

describe('REG-026 playable onboarding harness', () => {
    it('derives prompt targets from actual first-run board actions', () => {
        const save = createDefaultSaveData();
        const run = finishMemorizePhase(createNewRun(0));
        const step = getPlayableOnboardingStep(run, save);

        render(
            <div data-testid="onboarding-harness" data-targets={step?.targetTileIds.join(',') ?? ''}>
                <strong>{step?.title}</strong>
                <span>{step?.prompt}</span>
            </div>
        );

        expect(screen.getByTestId('onboarding-harness')).toHaveAttribute(
            'data-targets',
            step?.targetTileIds.join(',')
        );
        expect(step?.targetTileIds).toHaveLength(2);
        expect(screen.getByText(/Make your first match/i)).toBeInTheDocument();
        expect(screen.getByText(/Flip a marked tile/i)).toBeInTheDocument();
    });
});
