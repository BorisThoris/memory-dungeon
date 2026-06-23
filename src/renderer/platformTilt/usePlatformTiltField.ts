import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import { applyDeadzoneTilt, dampTilt, zeroTilt } from './platformTiltMotion';
import { usePlatformTiltContext } from './PlatformTiltContext';
import type { MotionPermissionState, TiltSource, TiltVector } from './platformTiltTypes';
import { useParallaxMotionSuppressed } from './useParallaxMotionSuppressed';

const FIELD_DAMP = 18;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

interface PointerCapabilities {
    coarse: boolean;
    fine: boolean;
}

interface CssTiltWrite {
    x: string;
    y: string;
}

export const shouldUseGyroForPointerCapabilities = (
    { coarse, fine }: PointerCapabilities,
    mouseDriving: boolean
): boolean => {
    const hybrid = fine && coarse;
    const coarseOnly = coarse && !fine;

    if (coarseOnly) {
        return true;
    }

    if (hybrid) {
        return !mouseDriving;
    }

    return false;
};

export const shouldCommitTiltCssVars = (
    previousTilt: CssTiltWrite | null,
    previousNode: HTMLElement | null,
    nextTilt: CssTiltWrite,
    nextNode: HTMLElement | null
): boolean =>
    nextNode !== null &&
    (previousNode !== nextNode || previousTilt?.x !== nextTilt.x || previousTilt?.y !== nextTilt.y);

const normalizePointerInViewport = (clientX: number, clientY: number): TiltVector => {
    if (typeof window === 'undefined') {
        return zeroTilt();
    }

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const x = clamp((clientX / width) * 2 - 1, -1, 1);
    const y = clamp((clientY / height) * 2 - 1, -1, 1);

    return applyDeadzoneTilt({ x, y });
};

interface UsePlatformTiltFieldOptions {
    enabled: boolean;
    reduceMotion: boolean;
    surfaceRef: RefObject<HTMLElement | null>;
    suspended?: boolean;
    /** Scales written CSS vars and tiltRef output on the bound surface. */
    strength?: number;
}

interface UsePlatformTiltFieldResult {
    tiltRef: MutableRefObject<TiltVector>;
    sourceRef: MutableRefObject<TiltSource>;
    /** In-app reduce motion and/or `prefers-reduced-motion` — use for permission chip visibility. */
    motionParallaxSuppressed: boolean;
    permission: MotionPermissionState;
    requestMotionPermission: () => Promise<void>;
}

export const usePlatformTiltField = ({
    enabled,
    reduceMotion,
    surfaceRef,
    suspended = false,
    strength: strengthProp = 1
}: UsePlatformTiltFieldOptions): UsePlatformTiltFieldResult => {
    const { gyroTiltRef, permission, requestMotionPermission } = usePlatformTiltContext();
    const motionParallaxSuppressed = useParallaxMotionSuppressed(reduceMotion);
    const tiltRef = useRef<TiltVector>(zeroTilt());
    const sourceRef = useRef<TiltSource>('none');
    const pointerActiveRef = useRef(false);
    const mouseDrivingRef = useRef(false);
    const pointerTargetRef = useRef<TiltVector>(zeroTilt());
    const lastFrameRef = useRef<number | null>(null);
    const lastCssTiltRef = useRef<CssTiltWrite | null>(null);
    const lastCssNodeRef = useRef<HTMLElement | null>(null);
    const pointerCapabilitiesRef = useRef<PointerCapabilities>({ coarse: false, fine: false });

    const strength = strengthProp;

    const shouldUseGyro = (): boolean => {
        if (typeof window === 'undefined') {
            return false;
        }

        return shouldUseGyroForPointerCapabilities(pointerCapabilitiesRef.current, mouseDrivingRef.current);
    };

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const resetPointer = (): void => {
            pointerActiveRef.current = false;
            pointerTargetRef.current = zeroTilt();
        };

        const onPointerMove = (event: PointerEvent): void => {
            if (event.pointerType === 'mouse') {
                mouseDrivingRef.current = true;
                pointerActiveRef.current = true;
                pointerTargetRef.current = normalizePointerInViewport(event.clientX, event.clientY);
                return;
            }

            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                mouseDrivingRef.current = false;
                resetPointer();
            }
        };

        const onPointerDown = (event: PointerEvent): void => {
            if (event.pointerType === 'mouse') {
                mouseDrivingRef.current = true;
                pointerActiveRef.current = true;
                pointerTargetRef.current = normalizePointerInViewport(event.clientX, event.clientY);
                return;
            }

            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                mouseDrivingRef.current = false;
                resetPointer();
            }
        };

        const onMouseOut = (event: MouseEvent): void => {
            if (event.relatedTarget === null) {
                resetPointer();
            }
        };

        const onBlur = (): void => {
            mouseDrivingRef.current = false;
            resetPointer();
        };

        window.addEventListener('pointerdown', onPointerDown, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('mouseout', onMouseOut);
        window.addEventListener('blur', onBlur);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('mouseout', onMouseOut);
            window.removeEventListener('blur', onBlur);
            pointerActiveRef.current = false;
            mouseDrivingRef.current = false;
            pointerTargetRef.current = zeroTilt();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const fineQuery = window.matchMedia('(pointer: fine)');
        const coarseQuery = window.matchMedia('(pointer: coarse)');

        const updatePointerCapabilities = (): void => {
            pointerCapabilitiesRef.current = {
                coarse: coarseQuery.matches,
                fine: fineQuery.matches
            };
        };

        updatePointerCapabilities();
        fineQuery.addEventListener?.('change', updatePointerCapabilities);
        coarseQuery.addEventListener?.('change', updatePointerCapabilities);

        return () => {
            fineQuery.removeEventListener?.('change', updatePointerCapabilities);
            coarseQuery.removeEventListener?.('change', updatePointerCapabilities);
        };
    }, []);

    useEffect(() => {
        const surfaceNode = surfaceRef.current;

        if (!enabled || motionParallaxSuppressed || suspended) {
            tiltRef.current = zeroTilt();
            sourceRef.current = 'none';
            lastFrameRef.current = null;
            lastCssTiltRef.current = null;
            lastCssNodeRef.current = null;

            if (surfaceNode) {
                surfaceNode.style.removeProperty('--tilt-x');
                surfaceNode.style.removeProperty('--tilt-y');
            }

            return;
        }

        let frameId = 0;

        const tick = (now: number): void => {
            const last = lastFrameRef.current ?? now;
            const dt = Math.min(0.05, (now - last) / 1000);

            lastFrameRef.current = now;

            const useGyro = shouldUseGyro();
            const target = useGyro ? gyroTiltRef.current : pointerTargetRef.current;
            const pointerActive = pointerActiveRef.current;

            if (useGyro) {
                sourceRef.current = 'gyro';
            } else if (pointerActive) {
                sourceRef.current = 'pointer';
            } else {
                sourceRef.current = 'none';
            }

            const effectiveTarget = useGyro || pointerActive ? target : zeroTilt();

            tiltRef.current = dampTilt(tiltRef.current, effectiveTarget, FIELD_DAMP, dt);

            const sx = (tiltRef.current.x * strength).toFixed(4);
            const sy = (tiltRef.current.y * strength).toFixed(4);
            const node = surfaceRef.current;

            const nextCssTilt = { x: sx, y: sy };
            if (node && shouldCommitTiltCssVars(lastCssTiltRef.current, lastCssNodeRef.current, nextCssTilt, node)) {
                node.style.setProperty('--tilt-x', sx);
                node.style.setProperty('--tilt-y', sy);
                lastCssTiltRef.current = nextCssTilt;
                lastCssNodeRef.current = node;
            }

            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(frameId);
            lastFrameRef.current = null;
            lastCssTiltRef.current = null;
            lastCssNodeRef.current = null;

            if (surfaceNode) {
                surfaceNode.style.removeProperty('--tilt-x');
                surfaceNode.style.removeProperty('--tilt-y');
            }
        };
    }, [enabled, motionParallaxSuppressed, strength, surfaceRef, gyroTiltRef, suspended]);

    return useMemo(
        () => ({
            tiltRef,
            sourceRef,
            motionParallaxSuppressed,
            permission,
            requestMotionPermission
        }),
        [motionParallaxSuppressed, permission, requestMotionPermission]
    );
};
