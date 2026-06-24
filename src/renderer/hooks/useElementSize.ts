import { useEffect, useRef, useState, type RefObject } from 'react';

export interface ElementFootprint {
    height: number;
    width: number;
}

export const useElementSize = <T extends HTMLElement>(): [RefObject<T | null>, ElementFootprint | null] => {
    const elementRef = useRef<T | null>(null);
    const [size, setSize] = useState<ElementFootprint | null>(null);

    useEffect(() => {
        const element = elementRef.current;

        if (!element) {
            return;
        }

        let frameId = 0;
        const updateSize = (): void => {
            frameId = 0;
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
            if (frameId) {
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
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }

            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, []);

    return [elementRef, size];
};
