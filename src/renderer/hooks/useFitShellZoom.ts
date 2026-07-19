import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

interface UseFitShellZoomArgs {
    /** Element whose intrinsic `offsetWidth` / `offsetHeight` define the unscaled shell size. */
    measureRef: RefObject<HTMLElement | null>;
    viewportWidth: number;
    viewportHeight: number;
    /** Inset from each edge when comparing to the viewport (CSS px). */
    padding?: number;
    /** Do not shrink uniform zoom below this (readable UI); overflow scrolls when combined with caller layout. */
    minFitZoom?: number;
    /** Disable fit zoom entirely when the shell should not scale (caller applies zoom: 1). */
    enabled?: boolean;
    /** Re-run fit measurement when shell content changes without a viewport resize (e.g. tab/category switch). */
    recomputeKey?: unknown;
}

interface ComputeFitShellZoomFactorArgs {
    viewportWidth: number;
    viewportHeight: number;
    contentWidth: number;
    contentHeight: number;
    padding?: number;
    /** Optional floor for uniform zoom (same semantics as `useFitShellZoom`). */
    minFitZoom?: number;
}

/**
 * Pure zoom factor for unit tests and documentation (same math as the hook).
 * Returns a value in (0, 1] capped at 1 when the content already fits.
 */
export function computeFitShellZoomFactor({
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
    padding = 14,
    minFitZoom
}: ComputeFitShellZoomFactorArgs): number {
    if (viewportWidth < 1 || viewportHeight < 1 || contentWidth < 2 || contentHeight < 2) {
        return 1;
    }
    const availW = Math.max(1, viewportWidth - padding * 2);
    const availH = Math.max(1, viewportHeight - padding * 2);
    let raw = Math.min(1, availW / contentWidth, availH / contentHeight);
    raw = Math.round(raw * 1000) / 1000;
    if (minFitZoom != null && Number.isFinite(minFitZoom)) {
        const floor = Math.min(1, Math.max(0.02, minFitZoom));
        raw = Math.min(1, Math.max(floor, raw));
    }
    return raw;
}

/**
 * Uniform zoom so a meta shell fits the viewport without scrolling (Chromium / Electron primary).
 * Phone/desktop shell layout is latched with width hysteresis in `GameScreen` / `latchPhoneWidthForMobileCamera`
 * so this hook is not fighting single-frame `cameraViewportMode` toggles during resize.
 * Apply `style={{ zoom: fitZoom }}` on the **first child** of `measureRef` (wrapper has no zoom).
 *
 * Measured `offsetWidth` / `offsetHeight` on the wrapper already reflect the **current** zoom.
 * Dividing by the **currently applied** zoom (from the zoomed child’s inline style when present)
 * recovers ~intrinsic size. We intentionally **do not** use ResizeObserver on the shell wrapper:
 * zoom changes the box size, so observing it caused a slow shrink loop until zoom bottomed out.
 */
export function useFitShellZoom({
    measureRef,
    viewportWidth,
    viewportHeight,
    padding = 14,
    minFitZoom,
    enabled = true,
    recomputeKey
}: UseFitShellZoomArgs): { fitZoom: number } {
    const [fitZoom, setFitZoom] = useState(1);
    const appliedZoomRef = useRef(1);

    useLayoutEffect(() => {
        if (!enabled) {
            /* Fit disabled: snap zoom back to 1 when toggled off (ResizeObserver path is inactive). */
            appliedZoomRef.current = 1;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset before return; no external subscription
            setFitZoom(1);
            return;
        }

        const el = measureRef.current;
        if (!el || viewportWidth < 1 || viewportHeight < 1) {
            /* No usable measure target or viewport: snap to unity zoom (avoids stale shrink from a prior size). */
            appliedZoomRef.current = 1;
            setFitZoom(1);
            return;
        }

        let outerRaf: number | null = null;
        let innerRaf: number | null = null;
        let delayed = 0;
        let cancelled = false;

        const recompute = (): void => {
            const node = measureRef.current;
            if (!node || cancelled) {
                return;
            }
            const inner = node.firstElementChild instanceof HTMLElement ? node.firstElementChild : null;
            const parsedZoom = inner?.style?.zoom ? Number.parseFloat(inner.style.zoom) : Number.NaN;
            const s =
                Number.isFinite(parsedZoom) && parsedZoom >= 0.02
                    ? parsedZoom
                    : Math.max(0.02, appliedZoomRef.current);
            const wAtZoom = node.offsetWidth;
            const hAtZoom = node.offsetHeight;
            if (wAtZoom < 2 || hAtZoom < 2) {
                appliedZoomRef.current = 1;
                setFitZoom(1);
                return;
            }
            const intrinsicW = Math.max(2, wAtZoom / s);
            const intrinsicH = Math.max(2, hAtZoom / s);
            const next = computeFitShellZoomFactor({
                viewportWidth,
                viewportHeight,
                contentWidth: intrinsicW,
                contentHeight: intrinsicH,
                padding,
                minFitZoom
            });
            setFitZoom((prev) => {
                if (Math.abs(prev - next) < 0.004) {
                    appliedZoomRef.current = prev;
                    return prev;
                }
                appliedZoomRef.current = next;
                return next;
            });
        };

        const cancelScheduledFrames = (): void => {
            if (outerRaf !== null) {
                cancelAnimationFrame(outerRaf);
                outerRaf = null;
            }
            if (innerRaf !== null) {
                cancelAnimationFrame(innerRaf);
                innerRaf = null;
            }
        };

        /** Double rAF: run after layout + fonts/paint for stable box metrics. */
        const schedule = (): void => {
            cancelScheduledFrames();
            outerRaf = requestAnimationFrame(() => {
                outerRaf = null;
                innerRaf = requestAnimationFrame(() => {
                    innerRaf = null;
                    recompute();
                });
            });
        };

        schedule();

        const fontsDone = document.fonts?.ready?.then(() => {
            if (!cancelled) {
                schedule();
            }
        });

        delayed = window.setTimeout(() => {
            if (!cancelled) {
                schedule();
            }
        }, 420);

        return () => {
            cancelled = true;
            cancelScheduledFrames();
            window.clearTimeout(delayed);
            void fontsDone;
        };
    }, [measureRef, viewportWidth, viewportHeight, padding, minFitZoom, enabled, recomputeKey]);

    return { fitZoom };
}
