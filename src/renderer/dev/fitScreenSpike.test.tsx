import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FitScreen from '@fit-screen/react';

/**
 * Keeps `@fit-screen/react` wired for branch spikes (see docs/VIEWPORT_FIT_UI.md).
 * Production shells lay out fluidly (clamp() and dvh); the fit-zoom hook this spike led to was retired with the title-page menu.
 */
describe('@fit-screen/react (viewport-fit spike)', () => {
    it('renders children inside a scaled design frame', () => {
        const { container } = render(
            <div style={{ height: 360, width: 640 }}>
                <FitScreen executeMode="none" height={720} mode="fit" width={1280}>
                    <div data-testid="design-surface" style={{ height: 720, width: 1280 }}>
                        Spike
                    </div>
                </FitScreen>
            </div>
        );

        expect(screen.getByTestId('design-surface')).toHaveTextContent('Spike');
        const scaled = container.querySelector('[style*="transform"]');
        expect(scaled).toBeTruthy();
    });
});
