import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Test DOM (happy-dom) provides `matchMedia` with desktop-like defaults: `(pointer: coarse)` → false,
 * `(pointer: fine)` → true. Tests that need touch-first behavior should assign `window.matchMedia` in that file.
 *
 * `visualViewport` is missing in happy-dom; hooks subscribe to `visualViewport` + `window` resize. Install a stable
 * object whose width/height track `innerWidth`/`innerHeight` and forward `resize` subscriptions to `window`.
 */
const installVisualViewportPolyfill = (): void => {
    if (window.visualViewport != null) {
        return;
    }

    const listenerMap = new Map<EventListenerOrEventListenerObject, (ev: Event) => void>();

    const wrapListener = (listener: EventListenerOrEventListenerObject): ((ev: Event) => void) => {
        if (typeof listener === 'function') {
            return (ev: Event) => listener.call(window as unknown as Window & typeof globalThis, ev);
        }
        return (ev: Event) => {
            listener.handleEvent(ev);
        };
    };

    const visualViewport = {
        get width(): number {
            return window.innerWidth;
        },
        get height(): number {
            return window.innerHeight;
        },
        scale: 1,
        offsetLeft: 0,
        offsetTop: 0,
        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void {
            void options;
            if (type !== 'resize' || listener == null) {
                return;
            }
            if (listenerMap.has(listener)) {
                return;
            }
            const wrapped = wrapListener(listener);
            window.addEventListener('resize', wrapped);
            listenerMap.set(listener, wrapped);
        },
        removeEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions
        ): void {
            void options;
            if (type !== 'resize' || listener == null) {
                return;
            }
            const wrapped = listenerMap.get(listener);
            if (!wrapped) {
                return;
            }
            window.removeEventListener('resize', wrapped);
            listenerMap.delete(listener);
        }
    };

    Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        enumerable: true,
        get: (): typeof visualViewport => visualViewport
    });
};

const installLocalStoragePolyfill = (): void => {
    const values = new Map<string, string>();
    const storage: Storage = {
        get length(): number {
            return values.size;
        },
        clear: () => {
            values.clear();
        },
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        removeItem: (key: string) => {
            values.delete(key);
        },
        setItem: (key: string, value: string) => {
            values.set(key, String(value));
        }
    };

    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        enumerable: true,
        value: storage
    });
};

installVisualViewportPolyfill();
installLocalStoragePolyfill();

/**
 * RTL cleanup runs every test; Vitest `restoreMocks`/`clearMocks` (see `vite.config.mts`) reset `vi.fn` spies.
 * For `window.matchMedia` / `Audio` overrides, restore in the same file or rely on module re-init between files.
 * Random order: `yarn test --sequence.shuffle` should pass locally (REF-070).
 */
afterEach(() => {
    cleanup();
});
