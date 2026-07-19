import { useCallback, useEffect, useRef, useState } from 'react';

interface TileBoardWebglContextRecoveryOptions {
    announce: (message: string) => void;
}

export const useTileBoardWebglContextRecovery = ({
    announce
}: TileBoardWebglContextRecoveryOptions) => {
    const cleanupRef = useRef<(() => void) | null>(null);
    const announcementTimeoutRef = useRef<number | null>(null);
    const [gpuSurfaceLost, setGpuSurfaceLost] = useState(false);
    /** Bumped after `webglcontextrestored` so Canvas/scene remounts with a fresh GL context (REF-078). */
    const [webglCanvasRemountKey, setWebglCanvasRemountKey] = useState(0);

    useEffect(
        () => () => {
            cleanupRef.current?.();
            cleanupRef.current = null;
            if (announcementTimeoutRef.current !== null) {
                window.clearTimeout(announcementTimeoutRef.current);
                announcementTimeoutRef.current = null;
            }
        },
        []
    );

    const handleCanvasCreated = useCallback(
        (canvas: HTMLCanvasElement): void => {
            cleanupRef.current?.();

            const onLost = (event: Event): void => {
                event.preventDefault();
                setGpuSurfaceLost(true);
            };
            const onRestored = (): void => {
                setGpuSurfaceLost(false);
                setWebglCanvasRemountKey((key) => key + 1);
                announce('Graphics context restored. Board rebuilt.');
                if (announcementTimeoutRef.current !== null) {
                    window.clearTimeout(announcementTimeoutRef.current);
                }
                announcementTimeoutRef.current = window.setTimeout(() => {
                    announcementTimeoutRef.current = null;
                    announce('');
                }, 3200);
            };

            canvas.addEventListener('webglcontextlost', onLost);
            canvas.addEventListener('webglcontextrestored', onRestored);
            cleanupRef.current = (): void => {
                canvas.removeEventListener('webglcontextlost', onLost);
                canvas.removeEventListener('webglcontextrestored', onRestored);
            };
        },
        [announce]
    );

    return {
        gpuSurfaceLost,
        handleCanvasCreated,
        webglCanvasRemountKey
    };
};
