import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import StartupIntro from './StartupIntro';
import { getIntroExitDurationMs } from './startupIntroConfig';
import { STARTUP_INTRO_ASSET_FAILSAFE_MS } from './startupIntroContract';

const uiSfxMocks = vi.hoisted(() => ({
    playIntroStingSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 1
}));

const mockHasWebGLSupport = vi.fn();

const mockPreloadStartupCriticalAssets = vi.hoisted(() =>
    vi.fn(() => Promise.resolve({ relicTextureSet: null }))
);

vi.mock('../assets/preloadStartupAssets', () => ({
    preloadStartupCriticalAssets: mockPreloadStartupCriticalAssets
}));

vi.mock('./startupIntroTextures', () => ({
    hasWebGLSupport: () => mockHasWebGLSupport()
}));

vi.mock('../audio/uiSfx', () => uiSfxMocks);
vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: { settings: { masterVolume: number; sfxVolume: number } }) => unknown) =>
        selector({
            settings: {
                masterVolume: 1,
                sfxVolume: 1
            }
        })
}));

const flushIntroPreload = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

const renderIntro = (ui: ReactElement): ReturnType<typeof render> =>
    render(<PlatformTiltProvider>{ui}</PlatformTiltProvider>);

describe('StartupIntro', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockHasWebGLSupport.mockReset();
        mockPreloadStartupCriticalAssets.mockReset();
        mockPreloadStartupCriticalAssets.mockImplementation(() => Promise.resolve({ relicTextureSet: null }));
        mockHasWebGLSupport.mockReturnValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('auto completes after the full runtime by default', async () => {
        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();

        expect(screen.getByRole('dialog', { name: /startup relic intro/i })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /obsidian relic sigil/i })).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(4199);
        });

        expect(onComplete).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(uiSfxMocks.resumeUiSfxContext).toHaveBeenCalled();
        expect(uiSfxMocks.playIntroStingSfx).toHaveBeenCalledTimes(1);
    });

    it('does not restart critical asset preload when the completion callback changes', () => {
        mockHasWebGLSupport.mockReturnValue(true);
        mockPreloadStartupCriticalAssets.mockImplementation(() => new Promise(() => {}));
        const firstOnComplete = vi.fn();
        const nextOnComplete = vi.fn();
        const rendered = renderIntro(<StartupIntro onComplete={firstOnComplete} reduceMotion={false} />);

        expect(mockPreloadStartupCriticalAssets).toHaveBeenCalledTimes(1);

        rendered.rerender(
            <PlatformTiltProvider>
                <StartupIntro onComplete={nextOnComplete} reduceMotion={false} />
            </PlatformTiltProvider>
        );

        expect(mockPreloadStartupCriticalAssets).toHaveBeenCalledTimes(1);
    });

    it('preserves its completion deadline while adopting the latest callback', async () => {
        const firstOnComplete = vi.fn();
        const nextOnComplete = vi.fn();
        const rendered = renderIntro(<StartupIntro onComplete={firstOnComplete} reduceMotion={false} />);

        await flushIntroPreload();
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        rendered.rerender(
            <PlatformTiltProvider>
                <StartupIntro onComplete={nextOnComplete} reduceMotion={false} />
            </PlatformTiltProvider>
        );
        act(() => {
            vi.advanceTimersByTime(3200);
        });

        expect(firstOnComplete).not.toHaveBeenCalled();
        expect(nextOnComplete).toHaveBeenCalledTimes(1);
    });

    it('preserves preload and total runtime when reduced motion changes mid-intro', async () => {
        const onComplete = vi.fn();
        const rendered = renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        rendered.rerender(
            <PlatformTiltProvider>
                <StartupIntro onComplete={onComplete} reduceMotion />
            </PlatformTiltProvider>
        );
        expect(mockPreloadStartupCriticalAssets).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(3200);
        });
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('returns focus to the menu root after the intro unmounts', () => {
        const menuRoot = document.createElement('div');
        menuRoot.dataset.testid = 'main-menu-focus-root';
        menuRoot.tabIndex = -1;
        document.body.append(menuRoot);

        try {
            menuRoot.focus();
            const rendered = renderIntro(<StartupIntro onComplete={vi.fn()} reduceMotion={false} />);
            act(() => {
                vi.advanceTimersByTime(20);
            });
            expect(screen.getByRole('dialog', { name: /startup relic intro/i })).toHaveFocus();

            rendered.unmount();
            act(() => {
                vi.advanceTimersByTime(20);
            });

            expect(menuRoot).toHaveFocus();
        } finally {
            menuRoot.remove();
        }
    });

    it('does not override focus claimed after the intro unmounts', () => {
        const menuRoot = document.createElement('div');
        menuRoot.dataset.testid = 'main-menu-focus-root';
        menuRoot.tabIndex = -1;
        const nextSurfaceButton = document.createElement('button');
        document.body.append(menuRoot, nextSurfaceButton);

        try {
            menuRoot.focus();
            const rendered = renderIntro(<StartupIntro onComplete={vi.fn()} reduceMotion={false} />);
            act(() => {
                vi.advanceTimersByTime(20);
            });
            expect(screen.getByRole('dialog', { name: /startup relic intro/i })).toHaveFocus();

            rendered.unmount();
            nextSurfaceButton.focus();
            act(() => {
                vi.advanceTimersByTime(20);
            });

            expect(nextSurfaceButton).toHaveFocus();
        } finally {
            menuRoot.remove();
            nextSurfaceButton.remove();
        }
    });

    it('uses the shortened reduced-motion runtime and supports keyboard skip', async () => {
        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={true} />);

        await flushIntroPreload();

        act(() => {
            vi.advanceTimersByTime(1399);
        });

        expect(onComplete).not.toHaveBeenCalled();

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(onComplete).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(getIntroExitDurationMs(true));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it.each(['Enter', 'Escape', ' ', 'Spacebar'])('starts the skip contract from %s', async (key) => {
        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={true} />);

        await flushIntroPreload();

        fireEvent.keyDown(window, { key });

        expect(screen.getByTestId('startup-intro-overlay')).toHaveAttribute('data-skip-state', 'requested');

        act(() => {
            vi.advanceTimersByTime(getIntroExitDurationMs(true));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('skips when the intro overlay is clicked', async () => {
        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();

        fireEvent.pointerDown(screen.getByRole('dialog', { name: /startup relic intro/i }), {
            button: 0,
            pointerType: 'mouse'
        });

        expect(onComplete).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(getIntroExitDurationMs(false));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('keeps a readable skip-pending state during slow asset loads, then completes through fallback', async () => {
        const onComplete = vi.fn();
        mockHasWebGLSupport.mockReturnValue(true);
        mockPreloadStartupCriticalAssets.mockImplementationOnce(
            () => new Promise(() => {})
        );

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={true} />);

        expect(screen.getByTestId('startup-intro-loading-state')).toHaveTextContent(/preparing intro assets/i);

        fireEvent.keyDown(window, { key: 'Enter' });

        expect(screen.getByTestId('startup-intro-overlay')).toHaveAttribute('data-assets', 'loading');
        expect(screen.getByTestId('startup-intro-loading-state')).toHaveTextContent(/skip requested/i);

        act(() => {
            vi.advanceTimersByTime(STARTUP_INTRO_ASSET_FAILSAFE_MS);
        });

        expect(screen.getByTestId('startup-intro-overlay')).toHaveAttribute('data-render-mode', 'fallback');

        act(() => {
            vi.advanceTimersByTime(getIntroExitDurationMs(true));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('falls back cleanly when 3D texture generation fails', async () => {
        const onComplete = vi.fn();
        mockHasWebGLSupport.mockReturnValue(true);
        mockPreloadStartupCriticalAssets.mockImplementationOnce(() => Promise.resolve({ relicTextureSet: null }));

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();

        expect(mockPreloadStartupCriticalAssets).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('img', { name: /obsidian relic sigil/i })).toBeInTheDocument();
    });
});

describe('StartupIntro motion CTA', () => {
    let requestPermissionSpy: ReturnType<typeof vi.fn>;
    const originalDeviceOrientation = window.DeviceOrientationEvent;
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        mockHasWebGLSupport.mockReturnValue(false);
        mockPreloadStartupCriticalAssets.mockImplementation(() => Promise.resolve({ relicTextureSet: null }));
        requestPermissionSpy = vi.fn(() => Promise.resolve('granted'));

        const MockCtor = function MockDeviceOrientation() {
            return new Event('deviceorientation');
        } as unknown as typeof DeviceOrientationEvent;

        (MockCtor as unknown as { requestPermission: typeof requestPermissionSpy }).requestPermission = requestPermissionSpy;
        (globalThis as unknown as { DeviceOrientationEvent: typeof DeviceOrientationEvent }).DeviceOrientationEvent = MockCtor;
        window.DeviceOrientationEvent = MockCtor;

        window.matchMedia = vi.fn((query: string) => {
            const coarse = query.includes('pointer: coarse');

            return {
                matches: coarse,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
                onchange: null
            } as MediaQueryList;
        }) as typeof window.matchMedia;
    });

    afterEach(() => {
        (globalThis as unknown as { DeviceOrientationEvent?: typeof DeviceOrientationEvent }).DeviceOrientationEvent =
            originalDeviceOrientation;
        window.DeviceOrientationEvent = originalDeviceOrientation;
        window.matchMedia = originalMatchMedia;
    });

    it('shows Enable motion when permission is promptable and invokes requestPermission without completing the intro', async () => {
        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();

        const cta = await screen.findByTestId('intro-motion-cta');

        expect(cta).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(cta);
            await Promise.resolve();
        });

        expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('supports legacy pointer media query listener APIs', async () => {
        const listeners = new Set<() => void>();
        const addListener = vi.fn((listener: () => void) => listeners.add(listener));
        const removeListener = vi.fn((listener: () => void) => listeners.delete(listener));
        window.matchMedia = vi.fn((query: string) => {
            const coarse = query.includes('pointer: coarse');

            return {
                matches: coarse,
                media: query,
                addListener,
                removeListener,
                dispatchEvent: vi.fn(),
                onchange: null
            } as unknown as MediaQueryList;
        }) as typeof window.matchMedia;
        const { unmount } = renderIntro(<StartupIntro onComplete={vi.fn()} reduceMotion={false} />);

        await flushIntroPreload();

        expect(await screen.findByTestId('intro-motion-cta')).toBeInTheDocument();
        expect(addListener).toHaveBeenCalledWith(expect.any(Function));

        unmount();

        expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0]?.[0]);
        expect(listeners).toHaveLength(0);
    });

    it('keeps the intro usable when pointer media queries are unavailable', async () => {
        window.matchMedia = undefined as unknown as typeof window.matchMedia;

        renderIntro(<StartupIntro onComplete={vi.fn()} reduceMotion={false} />);

        await flushIntroPreload();

        expect(screen.getByRole('dialog', { name: /startup relic intro/i })).toBeInTheDocument();
        expect(screen.queryByTestId('intro-motion-cta')).not.toBeInTheDocument();
    });

    it('keeps the intro usable when pointer media queries throw', async () => {
        window.matchMedia = vi.fn(() => {
            throw new Error('media query unavailable');
        }) as typeof window.matchMedia;

        renderIntro(<StartupIntro onComplete={vi.fn()} reduceMotion={false} />);

        await flushIntroPreload();

        expect(screen.getByRole('dialog', { name: /startup relic intro/i })).toBeInTheDocument();
        expect(screen.queryByTestId('intro-motion-cta')).not.toBeInTheDocument();
    });

    it('lets a normal overlay pointer-down still complete the intro after exit timing', async () => {
        vi.useFakeTimers();

        const onComplete = vi.fn();

        renderIntro(<StartupIntro onComplete={onComplete} reduceMotion={false} />);

        await flushIntroPreload();

        fireEvent.pointerDown(screen.getByRole('dialog', { name: /startup relic intro/i }), {
            button: 0,
            pointerType: 'mouse'
        });

        act(() => {
            vi.advanceTimersByTime(getIntroExitDurationMs(false));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });
});
