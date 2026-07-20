import { useCallback, useEffect, useState, type RefCallback } from 'react';

export interface ElementFootprint {
    height: number;
    width: number;
}

export const useElementSize = <T extends HTMLElement>(): [RefCallback<T>, ElementFootprint | null] => {
    const [element, setElement] = useState<T | null>(null);
    const [size, setSize] = useState<ElementFootprint | null>(null);
    const elementRef = useCallback((nextElement: T | null): void => {
        setElement(nextElement);
        if (!nextElement) {
            setSize(null);
        }
    }, []);

    useEffect(() => {
        if (!element) {
            return;
        }

        let frameId: number | null = null;
        const updateSize = (): void => {
            frameId = null;
            const nextRect = element.getBoundingClientRect();

            if (nextRect.width < 1 || nextRect.height < 1) {
                return;
            }

            setSize((previousSize) => {
                const nextSize = {
                    height: nextRect.height,
                    width: nextRect.width
                };

                if (
                    previousSize &&
                    Math.abs(previousSize.width - nextSize.width) < 0.5 &&
                    Math.abs(previousSize.height - nextSize.height) < 0.5
                ) {
                    return previousSize;
                }

                return nextSize;
            });
        };
        const scheduleUpdate = (): void => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(updateSize);
        };
        const resizeObserver =
            typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleUpdate());

        resizeObserver?.observe(element);

        if (element.parentElement) {
            resizeObserver?.observe(element.parentElement);
        }

        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
            }

            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, [element]);

    return [elementRef, size];
};
