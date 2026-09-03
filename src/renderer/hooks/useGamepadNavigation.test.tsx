import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMEPAD_ACTIVE_ATTRIBUTE } from '../input/gamepadNavigation';
import { STANDARD_GAMEPAD_BUTTONS } from '../../shared/gamepad-input';
import { useGamepadConnected, useGamepadNavigation } from './useGamepadNavigation';

const pad = (pressed: number[] = []): Gamepad =>
    ({
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, (_unused, index) => ({ pressed: pressed.includes(index) }))
    }) as unknown as Gamepad;

/** A hand-cranked frame clock: the hook's loop only advances when a test says so. */
let frames: Array<() => void> = [];
let pads: Array<Gamepad | null> = [];

const stepFrame = (): void => {
    const queued = frames;
    frames = [];
    act(() => {
        for (const run of queued) {
            run();
        }
    });
};

beforeEach(() => {
    frames = [];
    pads = [];
    document.body.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(() => callback(0));
        return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
        frames = [];
    });
    // happy-dom ships no Gamepad API at all — the same reason the hook feature-detects it.
    Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => pads as ReturnType<Navigator['getGamepads']>,
        writable: true
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'getGamepads');
    document.documentElement.removeAttribute(GAMEPAD_ACTIVE_ATTRIBUTE);
});

const buttonAt = (label: string, top: number): HTMLButtonElement => {
    const element = document.createElement('button');
    element.textContent = label;
    element.getBoundingClientRect = () =>
        ({ bottom: top + 40, height: 40, left: 0, right: 100, toJSON: () => ({}), top, width: 100, x: 0, y: top }) as DOMRect;
    document.body.append(element);
    return element;
};

describe('useGamepadNavigation', () => {
    it('does not poll while nothing is plugged in', () => {
        renderHook(() => useGamepadNavigation());
        expect(frames).toHaveLength(0);
    });

    it('picks up a pad that was already held through a reload', () => {
        pads = [pad()];
        renderHook(() => useGamepadNavigation());
        expect(frames.length).toBeGreaterThan(0);
    });

    it('starts polling when a pad is plugged in and drives the focus ring', () => {
        const first = buttonAt('first', 0);
        const second = buttonAt('second', 100);
        first.focus();

        renderHook(() => useGamepadNavigation());
        act(() => {
            window.dispatchEvent(new Event('gamepadconnected'));
        });

        pads = [pad([STANDARD_GAMEPAD_BUTTONS.dpadDown])];
        stepFrame();

        expect(document.activeElement).toBe(second);
        expect(document.documentElement.getAttribute(GAMEPAD_ACTIVE_ATTRIBUTE)).toBe('true');
    });

    it('keeps the pad marked active across the synthetic keys it dispatches itself', () => {
        buttonAt('only', 0).focus();
        pads = [pad([STANDARD_GAMEPAD_BUTTONS.b])];
        renderHook(() => useGamepadNavigation());
        stepFrame();
        expect(document.documentElement.getAttribute(GAMEPAD_ACTIVE_ATTRIBUTE)).toBe('true');
    });

    it('hands the focus ring back to the keyboard on a real keypress', () => {
        buttonAt('only', 0).focus();
        pads = [pad([STANDARD_GAMEPAD_BUTTONS.a])];
        renderHook(() => useGamepadNavigation());
        stepFrame();
        expect(document.documentElement.getAttribute(GAMEPAD_ACTIVE_ATTRIBUTE)).toBe('true');

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        });
        expect(document.documentElement.hasAttribute(GAMEPAD_ACTIVE_ATTRIBUTE)).toBe(false);
    });

    it('stops polling and clears the marker when the last pad is unplugged', () => {
        pads = [pad()];
        renderHook(() => useGamepadNavigation());
        stepFrame();
        pads = [];
        act(() => {
            window.dispatchEvent(new Event('gamepaddisconnected'));
        });
        expect(frames).toHaveLength(0);
        expect(document.documentElement.hasAttribute(GAMEPAD_ACTIVE_ATTRIBUTE)).toBe(false);
    });

    it('is inert when it is switched off', () => {
        pads = [pad()];
        renderHook(() => useGamepadNavigation(false));
        expect(frames).toHaveLength(0);
    });
});

describe('useGamepadConnected', () => {
    it('tracks whether a pad is plugged in', () => {
        const { result } = renderHook(() => useGamepadConnected());
        expect(result.current).toBe(false);

        pads = [pad()];
        act(() => {
            window.dispatchEvent(new Event('gamepadconnected'));
        });
        expect(result.current).toBe(true);

        pads = [];
        act(() => {
            window.dispatchEvent(new Event('gamepaddisconnected'));
        });
        expect(result.current).toBe(false);
    });
});
