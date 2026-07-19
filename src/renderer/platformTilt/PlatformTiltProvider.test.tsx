import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlatformTiltContext } from './PlatformTiltContext';
import { PlatformTiltProvider } from './PlatformTiltProvider';

const motionState = vi.hoisted(() => ({ suppressed: false }));

vi.mock('./useParallaxMotionSuppressed', () => ({
    useParallaxMotionSuppressed: () => motionState.suppressed
}));

type PermissionResult = 'granted' | 'denied';

const createDeferredPermission = () => {
    let resolve!: (result: PermissionResult) => void;
    const promise = new Promise<PermissionResult>((fulfill) => {
        resolve = fulfill;
    });

    return { promise, resolve };
};

const installOrientationPermission = (request: () => Promise<PermissionResult>) => {
    const requestPermission = vi.fn(request);
    const orientationCtor = Object.assign(function DeviceOrientationEventMock() {}, { requestPermission });

    vi.stubGlobal('DeviceOrientationEvent', orientationCtor);

    return requestPermission;
};

const ProviderWrapper = ({ children }: { children: ReactNode }) => (
    <PlatformTiltProvider>{children}</PlatformTiltProvider>
);

describe('PlatformTiltProvider motion permission lifecycle', () => {
    beforeEach(() => {
        motionState.suppressed = false;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('attaches orientation input after the current permission request is granted', async () => {
        const permission = createDeferredPermission();
        installOrientationPermission(() => permission.promise);
        const addEventListener = vi.spyOn(window, 'addEventListener');
        const { result } = renderHook(() => usePlatformTiltContext(), { wrapper: ProviderWrapper });

        expect(result.current.permission).toBe('prompt');

        const pendingRequest = result.current.requestMotionPermission();
        await act(async () => {
            permission.resolve('granted');
            await pendingRequest;
        });

        expect(result.current.permission).toBe('granted');
        expect(addEventListener.mock.calls.filter(([event]) => event === 'deviceorientation')).toHaveLength(1);
    });

    it('does not attach orientation input when motion becomes suppressed during the request', async () => {
        const permission = createDeferredPermission();
        installOrientationPermission(() => permission.promise);
        const addEventListener = vi.spyOn(window, 'addEventListener');
        const { result, rerender } = renderHook(() => usePlatformTiltContext(), { wrapper: ProviderWrapper });
        const pendingRequest = result.current.requestMotionPermission();

        motionState.suppressed = true;
        rerender();

        await act(async () => {
            permission.resolve('granted');
            await pendingRequest;
        });

        expect(result.current.permission).toBe('granted');
        expect(addEventListener.mock.calls.filter(([event]) => event === 'deviceorientation')).toHaveLength(0);
    });

    it('does not attach orientation input when a pending request resolves after teardown', async () => {
        const permission = createDeferredPermission();
        installOrientationPermission(() => permission.promise);
        const addEventListener = vi.spyOn(window, 'addEventListener');
        const { result, unmount } = renderHook(() => usePlatformTiltContext(), { wrapper: ProviderWrapper });
        const pendingRequest = result.current.requestMotionPermission();

        unmount();
        await act(async () => {
            permission.resolve('granted');
            await pendingRequest;
        });

        expect(addEventListener.mock.calls.filter(([event]) => event === 'deviceorientation')).toHaveLength(0);
    });

    it('ignores an older permission result that settles after a newer request', async () => {
        const firstPermission = createDeferredPermission();
        const secondPermission = createDeferredPermission();
        const requests = [firstPermission.promise, secondPermission.promise];
        installOrientationPermission(() => {
            const request = requests.shift();

            if (!request) {
                throw new Error('Unexpected motion permission request');
            }

            return request;
        });
        const { result } = renderHook(() => usePlatformTiltContext(), { wrapper: ProviderWrapper });
        const firstRequest = result.current.requestMotionPermission();
        const secondRequest = result.current.requestMotionPermission();

        await act(async () => {
            secondPermission.resolve('granted');
            await secondRequest;
        });
        expect(result.current.permission).toBe('granted');

        await act(async () => {
            firstPermission.resolve('denied');
            await firstRequest;
        });

        expect(result.current.permission).toBe('granted');
    });
});
