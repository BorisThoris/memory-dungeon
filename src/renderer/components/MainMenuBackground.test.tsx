import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { zeroTilt } from '../platformTilt/platformTiltMotion';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import MainMenuBackground from './MainMenuBackground';

type MenuBgHarnessProps = { graphicsQuality?: GraphicsQualityPreset; height: number; reduceMotion: boolean; width: number };

const MenuBackgroundHarness = ({ graphicsQuality, height, reduceMotion, width }: MenuBgHarnessProps) => {
    const fieldTiltRef = useRef(zeroTilt());

    return (
        <MainMenuBackground
            fieldTiltRef={fieldTiltRef}
            graphicsQuality={graphicsQuality}
            height={height}
            reduceMotion={reduceMotion}
            width={width}
        />
    );
};

const renderMenuBackground = (props: MenuBgHarnessProps): ReturnType<typeof render> =>
    render(
        <PlatformTiltProvider>
            <MenuBackgroundHarness {...props} />
        </PlatformTiltProvider>
    );

const initSpy = vi.fn(async () => {});
const startSpy = vi.fn();
const stopSpy = vi.fn();
const renderSpy = vi.fn();
const destroySpy = vi.fn();
const tickerAddSpy = vi.fn();
const tickerRemoveSpy = vi.fn();
const textureDestroySpy = vi.fn();
const applicationInstances: MockApplication[] = [];

class MockContainer {
    children: Array<MockContainer | MockSprite> = [];
    destroy = vi.fn();
    position = { set: vi.fn(), x: 0, y: 0 };
    rotation = 0;

    addChild<T extends MockContainer | MockSprite>(child: T): T {
        this.children.push(child);
        return child;
    }

    removeChildren(): Array<MockContainer | MockSprite> {
        const children = [...this.children];
        this.children = [];
        return children;
    }
}

class MockSprite {
    alpha = 1;
    anchor = { set: vi.fn() };
    destroy = vi.fn();
    height = 0;
    rotation = 0;
    scale = { set: vi.fn() };
    tint = 0;
    width = 0;
    x = 0;
    y = 0;

    constructor(public texture: { destroy: typeof textureDestroySpy; height: number; width: number }) {}
}

const asMockContainer = (value: MockContainer | MockSprite | undefined): MockContainer | undefined =>
    value instanceof MockContainer ? value : undefined;

class MockApplication {
    canvas = document.createElement('canvas');
    destroy = destroySpy;
    init = initSpy;
    render = renderSpy;
    renderer = { resolution: 1 };
    stage = new MockContainer();
    start = startSpy;
    stop = stopSpy;
    ticker = {
        add: tickerAddSpy,
        remove: tickerRemoveSpy
    };

    constructor() {
        applicationInstances.push(this);
    }
}

vi.mock('pixi.js', () => ({
    Application: MockApplication,
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: {
        from: vi.fn((source: HTMLCanvasElement) => ({
            destroy: textureDestroySpy,
            height: source.height || 1,
            width: source.width || 1
        }))
    }
}));

const createGradient = () => ({
    addColorStop: vi.fn()
});

beforeEach(() => {
    initSpy.mockClear();
    startSpy.mockClear();
    stopSpy.mockClear();
    renderSpy.mockClear();
    destroySpy.mockClear();
    tickerAddSpy.mockClear();
    tickerRemoveSpy.mockClear();
    textureDestroySpy.mockClear();
    applicationInstances.length = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        ((contextId: string) => {
            if (contextId !== '2d') {
                return null;
            }

            const gradient = createGradient();

            return {
                beginPath: vi.fn(),
                createLinearGradient: vi.fn(() => gradient),
                createRadialGradient: vi.fn(() => gradient),
                fillRect: vi.fn(),
                lineTo: vi.fn(),
                moveTo: vi.fn(),
                stroke: vi.fn()
            } as unknown as CanvasRenderingContext2D;
        }) as typeof HTMLCanvasElement.prototype.getContext
    );
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('MainMenuBackground', () => {
    it('initializes Pixi with a transparent auto-resizing canvas and destroys it on unmount', async () => {
        const { unmount } = renderMenuBackground({ height: 720, reduceMotion: false, width: 1280 });

        await waitFor(() => {
            expect(initSpy).toHaveBeenCalledTimes(1);
        });

        expect(initSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                antialias: true,
                autoDensity: true,
                autoStart: false,
                backgroundAlpha: 0,
                resizeTo: expect.any(HTMLElement)
            })
        );
        expect(tickerAddSpy).toHaveBeenCalledTimes(1);
        expect(startSpy).toHaveBeenCalledTimes(1);

        unmount();

        expect(destroySpy).toHaveBeenCalledWith({ removeView: true }, { children: true });
    });

    it('disables Pixi antialiasing on the low graphics preset', async () => {
        renderMenuBackground({ graphicsQuality: 'low', height: 720, reduceMotion: false, width: 1280 });

        await waitFor(() => {
            expect(initSpy).toHaveBeenCalledTimes(1);
        });

        expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ antialias: false }));
    });

    it('rebuilds the animated scene when graphics quality changes without waiting for resize', async () => {
        const { rerender } = render(
            <PlatformTiltProvider>
                <MenuBackgroundHarness graphicsQuality="low" height={800} reduceMotion={false} width={1280} />
            </PlatformTiltProvider>
        );

        await waitFor(() => {
            expect(initSpy).toHaveBeenCalledTimes(1);
        });

        const rootLayer = asMockContainer(applicationInstances[0]?.stage.children[0]);
        const particleLayer = asMockContainer(rootLayer?.children[3]);
        const lowParticleSprites = particleLayer?.children.length ?? 0;

        rerender(
            <PlatformTiltProvider>
                <MenuBackgroundHarness graphicsQuality="high" height={800} reduceMotion={false} width={1280} />
            </PlatformTiltProvider>
        );

        await waitFor(() => {
            expect((particleLayer?.children.length ?? 0)).toBeGreaterThan(lowParticleSprites);
        });
    });

    it('builds a static scene when reduced motion is enabled', async () => {
        renderMenuBackground({ height: 720, reduceMotion: true, width: 1280 });

        await waitFor(() => {
            expect(initSpy).toHaveBeenCalledTimes(1);
        });

        expect(tickerAddSpy).not.toHaveBeenCalled();
        expect(startSpy).not.toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
    });

    it('falls back to the static CSS background when Pixi initialization fails', async () => {
        initSpy.mockImplementationOnce(async () => {
            throw new Error('renderer unavailable');
        });

        const { container } = renderMenuBackground({ height: 720, reduceMotion: false, width: 1280 });

        await waitFor(() => {
            expect(container.querySelector('[data-render-status="fallback"]')).not.toBeNull();
        });

        expect(startSpy).not.toHaveBeenCalled();
        expect(tickerAddSpy).not.toHaveBeenCalled();
    });
});
