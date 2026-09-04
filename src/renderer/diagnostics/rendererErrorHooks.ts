import type { RendererErrorReport } from '../../shared/contracts';

/**
 * The renderer's async failures, which nothing was catching.
 *
 * The main process reports `uncaughtException` and `unhandledRejection`; the renderer reported
 * neither. A persistence write that rejects, an asset that fails to decode, an error thrown out of
 * a timer — all of it went to a console nobody sees and no file anywhere. The top-level error
 * boundary added alongside this catches renders, which is the other half; this is everything that
 * fails when React is not on the stack.
 *
 * The hard part is not listening, it is not drowning. An error thrown inside a requestAnimationFrame
 * loop fires roughly sixty times a second, so an unbounded reporter turns one bug into a full disk.
 * Repeats of a message are dropped and the whole session is capped.
 */

/** Distinct failures reported per session. Past this, the log has enough to work from. */
export const RENDERER_ERROR_REPORT_LIMIT = 5;

export type RendererErrorSource = 'renderer_window_error' | 'renderer_unhandled_rejection';

export interface RendererErrorHookTarget {
    addEventListener: (type: string, listener: (event: Event) => void) => void;
    removeEventListener: (type: string, listener: (event: Event) => void) => void;
}

export interface RendererErrorHookOptions {
    readonly target: RendererErrorHookTarget;
    readonly report: (source: RendererErrorSource, report: RendererErrorReport) => void;
    readonly limit?: number;
}

/** Whatever was thrown or rejected with, turned into something recordable. */
export const describeThrownValue = (value: unknown): RendererErrorReport => {
    if (value instanceof Error) {
        return { componentStack: null, message: value.message || value.name, stack: value.stack ?? null };
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return { componentStack: null, message: value, stack: null };
    }
    // A promise rejected with a plain object, a number, or nothing at all is common and still
    // worth a line in the log: the fact that it happened is most of the information.
    return { componentStack: null, message: `Non-error value thrown: ${typeof value}`, stack: null };
};

export const registerRendererErrorHooks = ({
    limit = RENDERER_ERROR_REPORT_LIMIT,
    report,
    target
}: RendererErrorHookOptions): (() => void) => {
    const seen = new Set<string>();

    const reportOnce = (source: RendererErrorSource, value: unknown): void => {
        const described = describeThrownValue(value);
        const key = `${source}:${described.message}`;
        if (seen.has(key) || seen.size >= limit) {
            return;
        }
        seen.add(key);
        try {
            report(source, described);
        } catch {
            // Reporting a failure must never be the thing that fails; the listener has to survive
            // to catch the next one.
        }
    };

    const onError = (event: Event): void => {
        const errorEvent = event as ErrorEvent;
        reportOnce('renderer_window_error', errorEvent.error ?? errorEvent.message);
    };
    const onRejection = (event: Event): void => {
        reportOnce('renderer_unhandled_rejection', (event as PromiseRejectionEvent).reason);
    };

    target.addEventListener('error', onError);
    target.addEventListener('unhandledrejection', onRejection);

    return () => {
        target.removeEventListener('error', onError);
        target.removeEventListener('unhandledrejection', onRejection);
    };
};
