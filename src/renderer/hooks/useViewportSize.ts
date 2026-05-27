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
        let frameId = 0;

        const commitViewportSize = (): void => {
            frameId = 0;
            const next = readViewportSize();
            setViewportSize((current) =>
                current.width === next.width && current.height === next.height ? current : next
            );
        };

        const scheduleViewportSizeUpdate = (): void => {
            if (frameId !== 0) {
                return;
            }
            frameId = window.requestAnimationFrame(commitViewportSize);
        };

        commitViewportSize();

        window.addEventListener('resize', scheduleViewportSizeUpdate);
        window.addEventListener('orientationchange', scheduleViewportSizeUpdate);
        window.visualViewport?.addEventListener('resize', scheduleViewportSizeUpdate);

        return () => {
            if (frameId !== 0) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener('resize', scheduleViewportSizeUpdate);
            window.removeEventListener('orientationchange', scheduleViewportSizeUpdate);
            window.visualViewport?.removeEventListener('resize', scheduleViewportSizeUpdate);
        };
    }, []);

    return viewportSize;
};
