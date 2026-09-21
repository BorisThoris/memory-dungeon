import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { RunLoadingScreen } from './RunLoadingScreen';

const runWith = (overrides: Partial<RunState>): RunState => overrides as RunState;

describe('RunLoadingScreen', () => {
    it('names the chosen run and the floor being dealt', () => {
        render(<RunLoadingScreen run={runWith({ board: { level: 4 }, gameMode: 'endless' } as Partial<RunState>)} />);

        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Classic Run');
        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Floor 4');
    });

    it('announces politely so the transition is not silent for screen readers', () => {
        render(<RunLoadingScreen run={runWith({ board: { level: 1 }, gameMode: 'endless' } as Partial<RunState>)} />);

        const screenEl = screen.getByRole('status');
        expect(screenEl).toHaveAttribute('aria-live', 'polite');
        expect(screenEl).toHaveTextContent(/dealing the board/i);
    });

    it('falls back to floor 1 when the board has not been built yet', () => {
        // The chunk can resolve before the first board exists; "Floor undefined" would be worse
        // than a sane default the next render corrects.
        render(<RunLoadingScreen run={runWith({ board: null, gameMode: 'endless' } as Partial<RunState>)} />);

        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Floor 1');
    });

    it('renders generic descent copy when there is no run at all', () => {
        render(<RunLoadingScreen run={null} />);

        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Descending');
        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Floor 1');
    });

    it('says Descending rather than printing a mode id when the run has no mode', () => {
        render(<RunLoadingScreen run={runWith({ board: { level: 3 } } as Partial<RunState>)} />);

        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Descending');
        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('Floor 3');
    });

    it('falls back to the raw mode id rather than blanking on an unknown mode', () => {
        render(
            <RunLoadingScreen run={runWith({ board: { level: 2 }, gameMode: 'not-a-mode' } as unknown as Partial<RunState>)} />
        );

        expect(screen.getByTestId('run-loading-screen')).toHaveTextContent('not-a-mode');
    });
});
