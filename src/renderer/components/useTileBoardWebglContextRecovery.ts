import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestRef } from '../hooks/useLatestRef';

interface TileBoardWebglContextRecoveryOptions {
    announce: (message: string) => void;
}

export const useTileBoardWebglContextRecovery = ({
    announce
}: TileBoardWebglContextRecoveryOptions) => {
    const cleanupRef = useRef<(() => void) | null>(null);
    const announcementTimeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const announceRef = useLatestRef(announce);
    const [gpuSurfaceLost, setGpuSurfaceLost] = useState(false);
    /** Bumped after `webglcontextrestored` so Canvas/scene remounts with a fresh GL context (REF-078). */
    const [webglCanvasRemountKey, setWebglCanvasRemountKey] = useState(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cleanupRef.current?.();
            cleanupRef.current = null;
            if (announcementTimeoutRef.current !== null) {
                window.clearTimeout(announcementTimeoutRef.current);
                announcementTimeoutRef.current = null;
            }
        };
    }, []);

    const handleCanvasCreated = useCallback(
        (canvas: HTMLCanvasElement): void => {
            if (!mountedRef.current) {
                return;
            }
            cleanupRef.current?.();
            cleanupRef.current = null;
            if (announcementTimeoutRef.current !== null) {
                window.clearTimeout(announcementTimeoutRef.current);
                announcementTimeoutRef.current = null;
            }
            setGpuSurfaceLost(false);

            const onLost = (event: Event): void => {
                event.preventDefault();
                setGpuSurfaceLost(true);
            };
            const onRestored = (): void => {
                setGpuSurfaceLost(false);
                setWebglCanvasRemountKey((key) => key + 1);
                announceRef.current('Graphics context restored. Board rebuilt.');
                if (announcementTimeoutRef.current !== null) {
                    window.clearTimeout(announcementTimeoutRef.current);
                }
                announcementTimeoutRef.current = window.setTimeout(() => {
                    announcementTimeoutRef.current = null;
                    announceRef.current('');
                }, 3200);
            };

            canvas.addEventListener('webglcontextlost', onLost);
            canvas.addEventListener('webglcontextrestored', onRestored);
            cleanupRef.current = (): void => {
                canvas.removeEventListener('webglcontextlost', onLost);
                canvas.removeEventListener('webglcontextrestored', onRestored);
            };
        },
        [announceRef]
    );

    return {
        gpuSurfaceLost,
        handleCanvasCreated,
        webglCanvasRemountKey
    };
};
