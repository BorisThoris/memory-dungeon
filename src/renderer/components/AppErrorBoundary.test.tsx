import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_ERROR_COPY } from '../copy/appErrorBoundary';
import { AppErrorBoundary } from './AppErrorBoundary';

const Boom = ({ fail }: { fail: boolean }) => {
    if (fail) {
        throw new Error('the shop screen exploded');
    }
    return <p>the game</p>;
};

/** React logs a caught error to console.error; the noise is not what is under test. */
const silenceReactErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('the top-level error boundary', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stays out of the way when nothing has failed', () => {
        render(
            <AppErrorBoundary>
                <Boom fail={false} />
            </AppErrorBoundary>
        );

        expect(screen.getByText('the game')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a screen rather than an empty window', () => {
        silenceReactErrorLog();
        render(
            <AppErrorBoundary>
                <Boom fail />
            </AppErrorBoundary>
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(APP_ERROR_COPY.title);
        // The first thing anyone assumes they have lost is their save, so the screen has to say.
        expect(alert).toHaveTextContent(APP_ERROR_COPY.detail);
    });

    it('offers a way back and calls it', async () => {
        silenceReactErrorLog();
        const reload = vi.fn();
        const user = userEvent.setup();
        render(
            <AppErrorBoundary reload={reload}>
                <Boom fail />
            </AppErrorBoundary>
        );

        await user.click(screen.getByRole('button', { name: APP_ERROR_COPY.action }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('reports the failure, with the component stack that names the screen', () => {
        silenceReactErrorLog();
        const report = vi.fn();
        render(
            <AppErrorBoundary report={report}>
                <Boom fail />
            </AppErrorBoundary>
        );

        expect(report).toHaveBeenCalledTimes(1);
        const [payload] = report.mock.calls[0] as [{ componentStack: string | null; message: string }];
        expect(payload.message).toBe('the shop screen exploded');
        expect(payload.componentStack).toContain('Boom');
        // The process survives a render error, so renderer_gone never fires; without this call the
        // crash reporter writes nothing at all and the failure leaves no trace.
        expect(screen.getByRole('alert')).toHaveTextContent(APP_ERROR_COPY.reported);
    });

    it('still shows the fallback when reporting itself throws', () => {
        silenceReactErrorLog();
        render(
            <AppErrorBoundary
                report={() => {
                    throw new Error('no main process');
                }}
            >
                <Boom fail />
            </AppErrorBoundary>
        );

        expect(screen.getByRole('alert')).toHaveTextContent(APP_ERROR_COPY.title);
    });

    it('says nothing about a report when there is nowhere to write one', () => {
        silenceReactErrorLog();
        render(
            <AppErrorBoundary>
                <Boom fail />
            </AppErrorBoundary>
        );

        // The browser build has no main process; claiming a file was written would be a lie.
        expect(screen.queryByText(APP_ERROR_COPY.reported)).toBeNull();
    });
});
