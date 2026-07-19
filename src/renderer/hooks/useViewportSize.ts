import { useEffect, useState } from 'react';

interface ViewportSize {
    width: number;
    height: number;
}

const readViewportSize = (): ViewportSize => {
    if (typeof window === 'undefined') {
        return { width: 1280, height: 800 };
    }

    const viewport = window.visualViewport;

    return {
        width: Math.round(viewport?.width ?? window.innerWidth),
        height: Math.round(viewport?.height ?? window.innerHeight)
    };
};

export const useViewportSize = (): ViewportSize => {
    const [viewportSize, setViewportSize] = useState(readViewportSize);

    useEffect(() => {
        let frameId: number | null = null;
        const visualViewport = window.visualViewport;

        const commitViewportSize = (): void => {
            frameId = null;
            const next = readViewportSize();
            setViewportSize((current) =>
                current.width === next.width && current.height === next.height ? current : next
            );
        };

        const scheduleViewportSizeUpdate = (): void => {
            if (frameId !== null) {
                return;
            }
            frameId = window.requestAnimationFrame(commitViewportSize);
        };

        commitViewportSize();

        window.addEventListener('resize', scheduleViewportSizeUpdate);
        window.addEventListener('orientationchange', scheduleViewportSizeUpdate);
        visualViewport?.addEventListener('resize', scheduleViewportSizeUpdate);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
            }
            window.removeEventListener('resize', scheduleViewportSizeUpdate);
            window.removeEventListener('orientationchange', scheduleViewportSizeUpdate);
            visualViewport?.removeEventListener('resize', scheduleViewportSizeUpdate);
        };
    }, []);

    return viewportSize;
};
