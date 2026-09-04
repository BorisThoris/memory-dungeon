import { describe, expect, it, vi } from 'vitest';
import {
    describeThrownValue,
    RENDERER_ERROR_REPORT_LIMIT,
    registerRendererErrorHooks,
    type RendererErrorHookTarget
} from './rendererErrorHooks';

/** A stand-in for `window` that lets a test fire the events the real one would. */
const createTarget = () => {
    const listeners = new Map<string, ((event: Event) => void)[]>();
    const target: RendererErrorHookTarget = {
        addEventListener: (type, listener) => {
            listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        },
        removeEventListener: (type, listener) => {
            listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
        }
    };
    return {
        fireError: (error: unknown, message = 'boom') => {
            for (const listener of listeners.get('error') ?? []) {
                listener({ error, message } as unknown as Event);
            }
        },
        fireRejection: (reason: unknown) => {
            for (const listener of listeners.get('unhandledrejection') ?? []) {
                listener({ reason } as unknown as Event);
            }
        },
        listenerCount: () => [...listeners.values()].flat().length,
        target
    };
};

describe('describing whatever was thrown', () => {
    it('keeps an Error whole', () => {
        const described = describeThrownValue(new TypeError('cannot read x of null'));

        expect(described.message).toBe('cannot read x of null');
        expect(described.stack).toContain('TypeError');
    });

    it('records a rejection that carried no error at all', () => {
        // `Promise.reject()` and `reject({code: 500})` are both common and both worth a line: that
        // it happened is most of the information.
        for (const value of [undefined, null, 42, { code: 500 }]) {
            expect(describeThrownValue(value).message.length).toBeGreaterThan(0);
        }
        expect(describeThrownValue('a plain string').message).toBe('a plain string');
    });
});

describe('the renderer error hooks', () => {
    it('reports a window error and a rejected promise', () => {
        const report = vi.fn();
        const { fireError, fireRejection, target } = createTarget();
        registerRendererErrorHooks({ report, target });

        fireError(new Error('window blew up'));
        fireRejection(new Error('save write rejected'));

        expect(report.mock.calls.map(([kind]) => kind)).toEqual([
            'renderer_window_error',
            'renderer_unhandled_rejection'
        ]);
    });

    it('does not write the same failure twice', () => {
        const report = vi.fn();
        const { fireRejection, target } = createTarget();
        registerRendererErrorHooks({ report, target });

        for (let index = 0; index < 50; index += 1) {
            fireRejection(new Error('the same thing, again'));
        }

        expect(report).toHaveBeenCalledTimes(1);
    });

    it('caps a storm of distinct failures rather than filling the disk', () => {
        const report = vi.fn();
        const { fireError, target } = createTarget();
        registerRendererErrorHooks({ report, target });

        // An error thrown inside a requestAnimationFrame loop fires about sixty times a second.
        for (let index = 0; index < 500; index += 1) {
            fireError(new Error(`distinct failure ${index}`));
        }

        expect(report).toHaveBeenCalledTimes(RENDERER_ERROR_REPORT_LIMIT);
    });

    it('keeps listening when reporting itself throws', () => {
        const report = vi.fn().mockImplementationOnce(() => {
            throw new Error('the bridge is gone');
        });
        const { fireError, target } = createTarget();
        registerRendererErrorHooks({ report, target });

        expect(() => fireError(new Error('first'))).not.toThrow();
        fireError(new Error('second'));
        expect(report).toHaveBeenCalledTimes(2);
    });

    it('detaches cleanly', () => {
        const report = vi.fn();
        const { fireError, listenerCount, target } = createTarget();
        const stop = registerRendererErrorHooks({ report, target });

        expect(listenerCount()).toBe(2);
        stop();
        fireError(new Error('after detach'));

        expect(listenerCount()).toBe(0);
        expect(report).not.toHaveBeenCalled();
    });
});
