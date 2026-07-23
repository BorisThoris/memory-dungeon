import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

const SizeProbe = ({
    height,
    present,
    version,
    width
}: {
    height: number;
    present: boolean;
    version: number;
    width: number;
}) => {
    const [elementRef, size] = useElementSize<HTMLDivElement>();

    return (
        <>
            <output data-testid="element-size">{size ? `${size.width}x${size.height}` : 'unmeasured'}</output>
            {present ? (
                <div
                    key={version}
                    data-test-height={height}
                    data-test-width={width}
                    ref={elementRef}
                />
            ) : null}
        </>
    );
};

describe('useElementSize', () => {
    let frames: Map<number, FrameRequestCallback>;
    let nextFrameId: number;

    const runNextFrame = (now: number): void => {
        const nextFrame = frames.entries().next();

        if (nextFrame.done) {
            throw new Error('Expected a scheduled size frame');
        }

        const [frameId, callback] = nextFrame.value;
        frames.delete(frameId);
        callback(now);
    };

    beforeEach(() => {
        frames = new Map();
        nextFrameId = 0;
        vi.stubGlobal('ResizeObserver', undefined);
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            nextFrameId += 1;
            frames.set(nextFrameId, callback);
            return nextFrameId;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
            frames.delete(frameId);
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const height = Number(this.dataset.testHeight ?? 0);
            const width = Number(this.dataset.testWidth ?? 0);

            return {
                bottom: height,
                height,
                left: 0,
                right: width,
                top: 0,
                width,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('starts measuring when the target appears after the first effect', () => {
        const { rerender } = render(
            <SizeProbe height={60} present={false} version={1} width={120} />
        );

        expect(screen.getByTestId('element-size')).toHaveTextContent('unmeasured');
        expect(frames).toHaveLength(0);

        rerender(<SizeProbe height={60} present version={1} width={120} />);

        expect(frames).toHaveLength(1);
        act(() => runNextFrame(0));
        expect(screen.getByTestId('element-size')).toHaveTextContent('120x60');
    });

    it('moves measurement and pending-frame cleanup to a replacement target', () => {
        const { rerender, unmount } = render(
            <SizeProbe height={50} present version={1} width={100} />
        );

        act(() => runNextFrame(0));
        expect(screen.getByTestId('element-size')).toHaveTextContent('100x50');

        rerender(<SizeProbe height={80} present version={2} width={220} />);

        expect(frames).toHaveLength(1);
        act(() => runNextFrame(16));
        expect(screen.getByTestId('element-size')).toHaveTextContent('220x80');

        act(() => window.dispatchEvent(new Event('resize')));
        expect(frames).toHaveLength(1);

        unmount();

        expect(frames).toHaveLength(0);
    });

    it('clears the last measurement when the target disappears', () => {
        const { rerender } = render(
            <SizeProbe height={50} present version={1} width={100} />
        );

        act(() => runNextFrame(0));
        expect(screen.getByTestId('element-size')).toHaveTextContent('100x50');

        rerender(<SizeProbe height={50} present={false} version={1} width={100} />);

        expect(screen.getByTestId('element-size')).toHaveTextContent('unmeasured');
        expect(frames).toHaveLength(0);
    });

    it('falls back to animation-frame measurement when ResizeObserver construction throws', () => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor() {
                    throw new Error('resize observer unavailable');
                }
            }
        );

        render(<SizeProbe height={70} present version={1} width={140} />);

        expect(frames).toHaveLength(1);
        act(() => runNextFrame(0));
        expect(screen.getByTestId('element-size')).toHaveTextContent('140x70');
    });

    it('falls back to animation-frame measurement when ResizeObserver observe throws', () => {
        const disconnect = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                disconnect = disconnect;
                observe(): void {
                    throw new Error('resize observer observe unavailable');
                }
            }
        );

        render(<SizeProbe height={75} present version={1} width={145} />);

        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(frames).toHaveLength(1);
        act(() => runNextFrame(0));
        expect(screen.getByTestId('element-size')).toHaveTextContent('145x75');
    });
});
