import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { PlatformTiltContext, type PlatformTiltContextValue } from './PlatformTiltContext';
import {
    dampTilt,
    degreeTiltToProcessed,
    deviceOrientationToDegreeTilt,
    subtractBaselineDegrees,
    zeroTilt
} from './platformTiltMotion';
import type { MotionPermissionState, TiltVector } from './platformTiltTypes';
import { useParallaxMotionSuppressed } from './useParallaxMotionSuppressed';

const GYRO_DAMP = 14;

const getScreenAngleDeg = (): number => {
    if (typeof window === 'undefined') {
        return 0;
    }

    const o = window.screen?.orientation;

    if (o && typeof o.angle === 'number') {
        return o.angle;
    }

    return 0;
};

const getDeviceOrientationEventCtor = (): typeof DeviceOrientationEvent | undefined => {
    const globalRef = globalThis as unknown as { DeviceOrientationEvent?: typeof DeviceOrientationEvent };

    return typeof globalRef.DeviceOrientationEvent !== 'undefined' ? globalRef.DeviceOrientationEvent : undefined;
};

const hasRequestPermission = (): boolean => {
    const ctor = getDeviceOrientationEventCtor();

    if (!ctor) {
        return false;
    }

    return (
        typeof (ctor as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }).requestPermission === 'function'
    );
};

export const PlatformTiltProvider = ({ children }: { children: ReactNode }) => {
    const reduceMotionFromSettings = useAppStore(useShallow((s) => s.settings.reduceMotion));
    const motionParallaxSuppressed = useParallaxMotionSuppressed(reduceMotionFromSettings);
    const [permission, setPermission] = useState<MotionPermissionState>(() => {
        if (typeof window === 'undefined' || !getDeviceOrientationEventCtor()) {
            return 'unsupported';
        }

        return hasRequestPermission() ? 'prompt' : 'granted';
    });

    const gyroTiltRef = useRef<TiltVector>(zeroTilt());
    const targetGyroRef = useRef<TiltVector>(zeroTilt());
    const baselineDegreesRef = useRef<TiltVector | null>(null);
    const lastFrameRef = useRef<number | null>(null);
    const listenerAttachedRef = useRef(false);

    const resetBaseline = useCallback((): void => {
        baselineDegreesRef.current = null;
        targetGyroRef.current = zeroTilt();
    }, []);

    const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
        const raw = deviceOrientationToDegreeTilt(event.beta, event.gamma);

        if (!raw) {
            return;
        }

        if (baselineDegreesRef.current === null) {
            baselineDegreesRef.current = { ...raw };
        }

        const relative = subtractBaselineDegrees(raw, baselineDegreesRef.current);
        const processed = degreeTiltToProcessed(relative, getScreenAngleDeg());

        targetGyroRef.current = processed;
    }, []);

    const attachListener = useCallback((): void => {
        if (listenerAttachedRef.current || typeof window === 'undefined') {
            return;
        }

        window.addEventListener('deviceorientation', handleOrientation, { capture: true, passive: true });
        listenerAttachedRef.current = true;
    }, [handleOrientation]);

    const detachListener = useCallback((): void => {
        if (!listenerAttachedRef.current || typeof window === 'undefined') {
            return;
        }

        window.removeEventListener('deviceorientation', handleOrientation, true);
        listenerAttachedRef.current = false;
    }, [handleOrientation]);

    useEffect(() => {
        if (typeof window === 'undefined' || !getDeviceOrientationEventCtor()) {
            return;
        }

        if (motionParallaxSuppressed || permission !== 'granted') {
            detachListener();

            return;
        }

        attachListener();

        return () => {
            detachListener();
        };
    }, [motionParallaxSuppressed, permission, attachListener, detachListener]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const onOrientationChange = (): void => {
            resetBaseline();
        };

        window.addEventListener('orientationchange', onOrientationChange);

        return () => {
            window.removeEventListener('orientationchange', onOrientationChange);
        };
    }, [resetBaseline]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const onVisibility = (): void => {
            if (document.visibilityState === 'visible') {
                resetBaseline();
            }
        };

        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [resetBaseline]);

    useEffect(() => {
        if (motionParallaxSuppressed) {
            targetGyroRef.current = zeroTilt();
            gyroTiltRef.current = zeroTilt();
            lastFrameRef.current = null;

            return;
        }

        let frameId = 0;

        const tick = (now: number): void => {
            const last = lastFrameRef.current ?? now;
            const dt = Math.min(0.05, (now - last) / 1000);

            lastFrameRef.current = now;
            gyroTiltRef.current = dampTilt(gyroTiltRef.current, targetGyroRef.current, GYRO_DAMP, dt);
            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(frameId);
            lastFrameRef.current = null;
        };
    }, [motionParallaxSuppressed]);

    const requestMotionPermission = useCallback(async (): Promise<void> => {
        const orientationCtor = getDeviceOrientationEventCtor();

        if (typeof window === 'undefined' || !orientationCtor) {
            setPermission('unsupported');

            return;
        }

        const ctor = orientationCtor as unknown as {
            requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (typeof ctor.requestPermission === 'function') {
            try {
                const result = await ctor.requestPermission();

                if (result === 'granted') {
                    setPermission('granted');
                    resetBaseline();
                    attachListener();
                } else {
                    setPermission('denied');
                }
            } catch {
                setPermission('denied');
            }

            return;
        }

        setPermission('granted');
        resetBaseline();
        attachListener();
    }, [attachListener, resetBaseline]);

    const value = useMemo<PlatformTiltContextValue>(
        () => ({
            gyroTiltRef,
            permission,
            requestMotionPermission
        }),
        [permission, requestMotionPermission]
    );

    return <PlatformTiltContext.Provider value={value}>{children}</PlatformTiltContext.Provider>;
};
