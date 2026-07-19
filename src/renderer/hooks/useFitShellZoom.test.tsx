import { act, render } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeFitShellZoomFactor, useFitShellZoom } from './useFitShellZoom';

afterEach(() => {
    vi.useRealTimers();
});

/** Documents unwrap math used in `useFitShellZoom` (zoomed box → intrinsic). */
const intrinsicFromZoomed = (size: number, appliedZoom: number): number => Math.max(2, size / Math.max(0.02, appliedZoom));

describe('computeFitShellZoomFactor', () => {
    it('returns 1 when content fits', () => {
        expect(
            computeFitShellZoomFactor({
                contentHeight: 400,
                contentWidth: 600,
                padding: 14,
                viewportHeight: 800,
                viewportWidth: 1000
            })
        ).toBe(1);
    });

    it('scales down when content is taller than available height', () => {
        const z = computeFitShellZoomFactor({
            contentHeight: 1000,
            contentWidth: 800,
            padding: 12,
            viewportHeight: 600,
            viewportWidth: 900
        });
        expect(z).toBeLessThan(1);
        expect(z).toBeCloseTo(576 / 1000, 2);
    });

    it('scales down for dead-zone width (900) with short height', () => {
        const z = computeFitShellZoomFactor({
            contentHeight: 900,
            contentWidth: 850,
            padding: 12,
            viewportHeight: 700,
            viewportWidth: 900
        });
        expect(z).toBeLessThan(1);
        const availH = 700 - 24;
        expect(z).toBeLessThanOrEqual(availH / 900 + 0.002);
    });

    it('returns 1 for degenerate content size', () => {
        expect(
            computeFitShellZoomFactor({
                contentHeight: 1,
                contentWidth: 100,
                viewportHeight: 600,
                viewportWidth: 800
            })
        ).toBe(1);
    });

    it('unwraps zoomed layout height before comparing to viewport', () => {
        const appliedZoom = 0.5;
        const hAtZoom = 400;
        const intrinsicH = intrinsicFromZoomed(hAtZoom, appliedZoom);
        expect(intrinsicH).toBe(800);
        const z = computeFitShellZoomFactor({
            contentHeight: intrinsicH,
            contentWidth: 900,
            padding: 0,
            viewportHeight: 720,
            viewportWidth: 1280
        });
        expect(z).toBeCloseTo(720 / 800, 3);
    });

    it('returns 1 for degenerate viewport width', () => {
        expect(
            computeFitShellZoomFactor({
                contentHeight: 400,
                contentWidth: 600,
                padding: 14,
                viewportHeight: 800,
                viewportWidth: 0
            })
        ).toBe(1);
    });

    it('applies minFitZoom when raw scale would be smaller (readability floor)', () => {
        const z = computeFitShellZoomFactor({
            contentHeight: 1000,
            contentWidth: 800,
            minFitZoom: 0.8,
            padding: 12,
            viewportHeight: 600,
            viewportWidth: 900
        });
        expect(z).toBe(0.8);
    });
});

const flushDoubleRaf = async (): Promise<void> => {
    await act(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    });
};

const readFitZoomFromDom = (container: HTMLElement): number =>
    Number(container.querySelector('[data-testid="fit-zoom-readout"]')?.getAttribute('data-fit-zoom') ?? Number.NaN);

describe('useFitShellZoom', () => {
    it('cancels pending inner frames when rescheduling and unmounting', () => {
        vi.useFakeTimers();
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

        const FitProbe = () => {
            const measureRef = useRef<HTMLDivElement | null>(null);
            useFitShellZoom({
                measureRef,
                viewportHeight: 700,
                viewportWidth: 900
            });
            return (
                <div ref={measureRef}>
                    <div />
                </div>
            );
        };
        const { unmount } = render(<FitProbe />);
        expect(frames.size).toBe(1);

        const outerFrame = [...frames.entries()][0];
        expect(outerFrame).toBeDefined();
        frames.delete(outerFrame![0]);
        outerFrame![1](0);
        expect(frames.size).toBe(1);
        const staleInnerFrameId = [...frames.keys()][0];

        act(() => vi.advanceTimersByTime(420));

        expect(frames.has(staleInnerFrameId!)).toBe(false);
        expect(frames.size).toBe(1);

        const replacementOuterFrame = [...frames.entries()][0];
        expect(replacementOuterFrame).toBeDefined();
        frames.delete(replacementOuterFrame![0]);
        replacementOuterFrame![1](0);
        expect(frames.size).toBe(1);

        unmount();
        expect(frames.size).toBe(0);
    });

    it('resets fit zoom to 1 when disabled after a shrink', async () => {
        const FitProbe = (p: { enabled: boolean; vw: number; vh: number; ow: number; oh: number }) => {
            const measureRef = useRef<HTMLDivElement | null>(null);
            const setMeasureRef = (node: HTMLDivElement | null): void => {
                measureRef.current = node;
                if (node) {
                    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: p.ow });
                    Object.defineProperty(node, 'offsetHeight', { configurable: true, value: p.oh });
                }
            };
            const { fitZoom } = useFitShellZoom({
                enabled: p.enabled,
                measureRef,
                padding: 14,
                viewportHeight: p.vh,
                viewportWidth: p.vw
            });
            return (
                <div ref={setMeasureRef}>
                    <div
                        data-fit-zoom={fitZoom}
                        data-testid="fit-zoom-readout"
                        style={{ zoom: fitZoom }}
                    />
                </div>
            );
        };

        const { container, rerender } = render(<FitProbe enabled={true} oh={2000} ow={900} vh={700} vw={900} />);
        await flushDoubleRaf();
        expect(readFitZoomFromDom(container)).toBeLessThan(1);

        await act(async () => {
            rerender(<FitProbe enabled={false} oh={2000} ow={900} vh={700} vw={900} />);
        });
        await flushDoubleRaf();
        expect(readFitZoomFromDom(container)).toBe(1);
    });

    it('resets to 1 when the viewport becomes degenerate', async () => {
        const FitProbe = (p: { vw: number; vh: number }) => {
            const measureRef = useRef<HTMLDivElement | null>(null);
            const setMeasureRef = (node: HTMLDivElement | null): void => {
                measureRef.current = node;
                if (node) {
                    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: 900 });
                    Object.defineProperty(node, 'offsetHeight', { configurable: true, value: 2000 });
                }
            };
            const { fitZoom } = useFitShellZoom({
                measureRef,
                padding: 14,
                viewportHeight: p.vh,
                viewportWidth: p.vw
            });
            return (
                <div ref={setMeasureRef}>
                    <div
                        data-fit-zoom={fitZoom}
                        data-testid="fit-zoom-readout"
                        style={{ zoom: fitZoom }}
                    />
                </div>
            );
        };

        const { container, rerender } = render(<FitProbe vh={700} vw={900} />);
        await flushDoubleRaf();
        expect(readFitZoomFromDom(container)).toBeLessThan(1);

        await act(async () => {
            rerender(<FitProbe vh={600} vw={0} />);
        });
        await flushDoubleRaf();
        expect(readFitZoomFromDom(container)).toBe(1);
    });

    it('resets to 1 when the measured box is degenerate (<2px)', async () => {
        const FitProbe = () => {
            const measureRef = useRef<HTMLDivElement | null>(null);
            const setMeasureRef = (node: HTMLDivElement | null): void => {
                measureRef.current = node;
                if (node) {
                    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: 1 });
                    Object.defineProperty(node, 'offsetHeight', { configurable: true, value: 1 });
                }
            };
            const { fitZoom } = useFitShellZoom({
                measureRef,
                padding: 14,
                viewportHeight: 800,
                viewportWidth: 1200
            });
            return (
                <div ref={setMeasureRef}>
                    <div
                        data-fit-zoom={fitZoom}
                        data-testid="fit-zoom-readout"
                        style={{ zoom: fitZoom }}
                    />
                </div>
            );
        };

        const { container } = render(<FitProbe />);
        await flushDoubleRaf();
        expect(readFitZoomFromDom(container)).toBe(1);
    });

    it('resets to 1 when the measure ref is unset (no element)', () => {
        const measureRef = createRef<HTMLDivElement>();
        const FitProbe = () => {
            const { fitZoom } = useFitShellZoom({
                measureRef,
                padding: 14,
                viewportHeight: 800,
                viewportWidth: 1200
            });
            return <span data-zoom={fitZoom} />;
        };
        const { container } = render(<FitProbe />);
        const z = container.querySelector('span')?.getAttribute('data-zoom');
        expect(z).toBe('1');
    });

    it('respects minFitZoom when shrinking would drop below floor', async () => {
        const FitProbe = (p: { minFitZoom?: number }) => {
            const measureRef = useRef<HTMLDivElement | null>(null);
            const setMeasureRef = (node: HTMLDivElement | null): void => {
                measureRef.current = node;
                if (node) {
                    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: 900 });
                    Object.defineProperty(node, 'offsetHeight', { configurable: true, value: 2000 });
                }
            };
            const { fitZoom } = useFitShellZoom({
                measureRef,
                minFitZoom: p.minFitZoom,
                padding: 14,
                viewportHeight: 700,
                viewportWidth: 900
            });
            return (
                <div ref={setMeasureRef}>
                    <div
                        data-fit-zoom={fitZoom}
                        data-testid="fit-zoom-readout"
                        style={{ zoom: fitZoom }}
                    />
                </div>
            );
        };

        const { container: noFloor } = render(<FitProbe />);
        await flushDoubleRaf();
        expect(readFitZoomFromDom(noFloor)).toBeLessThan(0.8);

        const { container: floored } = render(<FitProbe minFitZoom={0.8} />);
        await flushDoubleRaf();
        expect(readFitZoomFromDom(floored)).toBe(0.8);
    });
});
