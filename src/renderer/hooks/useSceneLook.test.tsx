import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useSceneLook } from './useSceneLook';

/**
 * The hook runs outside React: a listener on the window, a frame loop while the value is settling,
 * and two CSS variables on an element. Every scene on screen mounts one, and a menu opened and
 * closed a hundred times mounts a hundred — so what this really guards is that each one lets go of
 * the window when it leaves.
 */
const renderLook = (enabled: boolean) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const view = renderHook(({ on }: { on: boolean }) => {
        const ref = useRef<HTMLElement | null>(element);
        useSceneLook(ref, on);
        return ref;
    }, { initialProps: { on: enabled } });
    return { element, ...view };
};

const listenerCounts = () => ({
    add: (window.addEventListener as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
    remove: (window.removeEventListener as unknown as { mock: { calls: unknown[][] } }).mock.calls.length
});

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
    frames = [];
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

/** Runs whatever frames are pending, the way a browser would before the next paint. */
const pump = (times = 1): void => {
    for (let i = 0; i < times; i += 1) {
        const pending = frames;
        frames = [];
        for (const frame of pending) {
            frame(performance.now());
        }
    }
};

describe('useSceneLook', () => {
    it('starts a scene looking straight ahead', () => {
        const { element } = renderLook(true);
        expect(element.style.getPropertyValue('--scene-look-x')).toBe('0.000');
        expect(element.style.getPropertyValue('--scene-look-y')).toBe('0.000');
    });

    it('turns toward the pointer, and eases rather than snapping to it', () => {
        const { element } = renderLook(true);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth, clientY: 0 }));

        pump();
        const firstStep = Number(element.style.getPropertyValue('--scene-look-x'));
        // The pointer is hard right, so the room turns that way — but not all the way at once.
        expect(firstStep).toBeGreaterThan(0);
        expect(firstStep).toBeLessThan(0.5);

        pump(20);
        const settled = Number(element.style.getPropertyValue('--scene-look-x'));
        expect(settled).toBeGreaterThan(firstStep);
        expect(settled).toBeLessThanOrEqual(1);
    });

    it('lets the window go when the scene unmounts, and clears what it wrote', () => {
        const { element, unmount } = renderLook(true);
        const before = listenerCounts();
        expect(before.add).toBeGreaterThan(0);

        unmount();

        const after = listenerCounts();
        // Every listener it took is a listener it gave back: a scene reopened all session cannot pile up.
        expect(after.remove).toBe(before.add);
        expect(element.style.getPropertyValue('--scene-look-x')).toBe('');
        expect(element.style.getPropertyValue('--scene-look-y')).toBe('');
    });

    it('does nothing at all on a device that cannot afford it', () => {
        const { element } = renderLook(false);
        expect(listenerCounts().add).toBe(0);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));
        pump(5);
        expect(element.style.getPropertyValue('--scene-look-x')).toBe('');
    });

    it('returns to centre when the pointer leaves the window', () => {
        const { element } = renderLook(true);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth, clientY: 0 }));
        pump(30);
        expect(Number(element.style.getPropertyValue('--scene-look-x'))).toBeGreaterThan(0.1);

        window.dispatchEvent(new Event('pointerleave'));
        pump(60);
        expect(Number(element.style.getPropertyValue('--scene-look-x'))).toBeLessThan(0.05);
    });
});
