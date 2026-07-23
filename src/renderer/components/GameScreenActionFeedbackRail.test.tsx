import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameScreenActionFeedbackRail } from './GameScreenActionFeedbackRail';

describe('GameScreenActionFeedbackRail', () => {
    it('ignores malformed detail payloads before building action lanes', () => {
        render(
            <GameScreenActionFeedbackRail
                burstTier="reward"
                details={
                    [
                        { label: 'Route paid', tone: 'reward' },
                        { label: 7, tone: 'reward' },
                        { label: 'Chain x3', tone: 'chain' },
                        { label: 'Unknown', tone: 'unknown' }
                    ] as never
                }
                followup="Keep the reward chain alive"
                label="Action result"
                message="Reward stack ready"
                tone="info"
            />
        );

        const rail = screen.getByTestId('action-feedback-rail');
        const details = screen.getByTestId('action-feedback-details');
        const laneMap = screen.getByTestId('action-feedback-lane-map');

        expect(details).toHaveTextContent('Route paid');
        expect(details).toHaveTextContent('Chain x3');
        expect(details).not.toHaveTextContent('Unknown');
        expect(rail).toHaveAttribute('data-action-feedback-lane-map', 'route:1>chain:1');
        expect(laneMap).toHaveAttribute('data-action-feedback-lane-actions', 'route:Route next:1>chain:Protect streak:1');
    });

    it('falls back when the details prop is a length-bearing non-array', () => {
        render(
            <GameScreenActionFeedbackRail
                details={{ length: 2 } as never}
                followup={null}
                label="Action result"
                message="Cache opened"
                tone="info"
            />
        );

        expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-lane-map', 'none');
        expect(screen.queryByTestId('action-feedback-details')).not.toBeInTheDocument();
        expect(screen.queryByTestId('action-feedback-lane-map')).not.toBeInTheDocument();
    });
});
