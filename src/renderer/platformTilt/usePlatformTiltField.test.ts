import { act, renderHook } from '@testing-library/react';
import { createElement, type MutableRefObject, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformTiltContext } from './PlatformTiltContext';
import {
    shouldCommitTiltCssVars,
    shouldUseGyroForPointerCapabilities,
    usePlatformTiltField
} from './usePlatformTiltField';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('shouldUseGyroForPointerCapabilities', () => {
    it('uses gyro on coarse-only devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: false }, false)).toBe(true);
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: false }, true)).toBe(true);
    });

    it('uses pointer input on fine-only devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: false, fine: true }, false)).toBe(false);
        expect(shouldUseGyroForPointerCapabilities({ coarse: false, fine: true }, true)).toBe(false);
    });

    it('lets recent mouse movement override gyro on hybrid devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: true }, false)).toBe(true);
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: true }, true)).toBe(false);
    });
});

describe('shouldCommitTiltCssVars', () => {
    it('skips repeated tilt CSS writes for the same node and rounded values', () => {
        const node = document.createElement('div');
        const tilt = { x: '0.1250', y: '-0.2500' };

        expect(shouldCommitTiltCssVars(null, null, tilt, node)).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, node)).toBe(false);
        expect(shouldCommitTiltCssVars(tilt, node, { x: '0.1251', y: '-0.2500' }, node)).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, document.createElement('div'))).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, null)).toBe(false);
    });
});

describe('usePlatformTiltField surface lifecycle', () => {
    it('clears tilt CSS from replaced surfaces and the active surface on teardown', () => {
        let nextFrameId = 0;
        const frames = new Map<number, FrameRequestCallback>();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            nextFrameId += 1;
            frames.set(nextFrameId, callback);
            return nextFrameId;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
            frames.delete(frameId);
        });
        const runNextFrame = (now: number): void => {
            const nextFrame = frames.entries().next();

            if (nextFrame.done) {
                throw new Error('Expected a scheduled tilt frame');
            }

            const [frameId, callback] = nextFrame.value;
            frames.delete(frameId);
            callback(now);
        };
        const firstSurface = document.createElement('div');
        const replacementSurface = document.createElement('div');
        const surfaceRef: MutableRefObject<HTMLElement | null> = { current: firstSurface };
        const contextValue = {
            gyroTiltRef: { current: { x: 0, y: 0 } },
            permission: 'granted' as const,
            requestMotionPermission: vi.fn(async (): Promise<void> => undefined)
        };
        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(PlatformTiltContext.Provider, { value: contextValue }, children);
        const { unmount } = renderHook(
            () =>
                usePlatformTiltField({
                    enabled: true,
                    reduceMotion: false,
                    surfaceRef
                }),
            { wrapper }
        );

        act(() => runNextFrame(0));
        expect(firstSurface.style.getPropertyValue('--tilt-x')).toBe('0.0000');

        surfaceRef.current = replacementSurface;
        act(() => runNextFrame(16));

        expect(firstSurface.style.getPropertyValue('--tilt-x')).toBe('');
        expect(replacementSurface.style.getPropertyValue('--tilt-x')).toBe('0.0000');

        unmount();

        expect(replacementSurface.style.getPropertyValue('--tilt-x')).toBe('');
        expect(frames).toHaveLength(0);
    });
});
