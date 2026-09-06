export interface TileBoardWorldMetrics {
    boardHeight: number;
    boardWidth: number;
    viewportHeight: number;
    viewportWidth: number;
}

export interface TileBoardViewportState {
    fitZoom: number;
    panX: number;
    panY: number;
    zoom: number;
}

export interface TileBoardViewportMetrics extends TileBoardWorldMetrics {
    fitZoom: number;
}

interface TileBoardPanBounds {
    maxPanX: number;
    maxPanY: number;
}

export interface TileBoardScreenPoint {
    clientX: number;
    clientY: number;
}

export type TileBoardGesturePoint = TileBoardScreenPoint;

export interface TileBoardPinchGestureSnapshot {
    anchorBoardX: number;
    anchorBoardY: number;
    pointerIds: [number, number];
    startDistance: number;
    startZoom: number;
}

interface TileBoardMouseDragSnapshot {
    startPanX: number;
    startPanY: number;
    startWorldX: number;
    startWorldY: number;
}

const BOARD_CAMERA_FIT_ZOOM = 1;
const MOBILE_CAMERA_MIN_ZOOM = 0.01;
const MOBILE_CAMERA_MAX_ZOOM = 2.8;
/** REG-001: phone camera mode is board-first; fit the board between fixed HUD/dock chrome before pinch zoom. */
export const MOBILE_CAMERA_FIT_MARGIN = 0.76;
/**
 * A phone held upright: the width is the scarce axis and nothing sits beside the board, so the
 * bleed margin that keeps a sideways phone's board clear of its chrome only made the tiles small.
 * On a 390px phone the 6×4 clumped board took a third of its stage at 0.76; the suits and the clump
 * rings need the width more than the pinch gesture needs a margin.
 */
export const PORTRAIT_CAMERA_FIT_MARGIN = 0.92;

/** The camera-mode fit margin for a stage: tighter when the stage is taller than it is wide. */
export const getCameraFitMargin = ({ viewportHeight, viewportWidth }: { viewportHeight: number; viewportWidth: number }): number =>
    viewportHeight > viewportWidth ? PORTRAIT_CAMERA_FIT_MARGIN : MOBILE_CAMERA_FIT_MARGIN;
export const COMPACT_BOARD_FIT_MARGIN = 0.72;
/** REG-002: desktop stage should feel dense and board-forward without the mobile bleed margin. */
export const DESKTOP_STAGE_FIT_MARGIN = 0.94;
export const ROOMY_BOARD_FIT_MARGIN = 0.94;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getBoardFitZoom = ({
    boardHeight,
    boardWidth,
    margin,
    viewportHeight,
    viewportWidth
}: TileBoardWorldMetrics & {
    margin: number;
}): number => {
    if (boardHeight <= 0 || boardWidth <= 0 || viewportHeight <= 0 || viewportWidth <= 0) {
        return 1;
    }

    return Math.min((viewportWidth * margin) / boardWidth, (viewportHeight * margin) / boardHeight);
};

export const createFittedBoardViewport = (fitZoom: number): TileBoardViewportState => ({
    fitZoom,
    panX: 0,
    panY: 0,
    zoom: BOARD_CAMERA_FIT_ZOOM
});

export const clampBoardZoom = (zoom: number): number => clamp(zoom, MOBILE_CAMERA_MIN_ZOOM, MOBILE_CAMERA_MAX_ZOOM);

const getBoardPanBounds = ({
    boardHeight,
    boardWidth,
    fitZoom,
    viewportHeight,
    viewportWidth,
    zoom
}: TileBoardWorldMetrics & Pick<TileBoardViewportState, 'fitZoom' | 'zoom'>): TileBoardPanBounds => {
    const activeScale = Math.max(fitZoom * clampBoardZoom(zoom), 0);
    const scaledBoardWidth = boardWidth * activeScale;
    const scaledBoardHeight = boardHeight * activeScale;

    // Keep the board contained in the stage when it fits, and keep the camera contained by the board when zoomed in.
    return {
        maxPanX: Math.abs(scaledBoardWidth - viewportWidth) / 2,
        maxPanY: Math.abs(scaledBoardHeight - viewportHeight) / 2
    };
};

const clampBoardPan = ({
    boardHeight,
    boardWidth,
    fitZoom,
    panX,
    panY,
    viewportHeight,
    viewportWidth,
    zoom
}: TileBoardWorldMetrics &
    Pick<TileBoardViewportState, 'fitZoom' | 'panX' | 'panY' | 'zoom'>): Pick<TileBoardViewportState, 'panX' | 'panY'> => {
    const { maxPanX, maxPanY } = getBoardPanBounds({
        boardHeight,
        boardWidth,
        fitZoom,
        viewportHeight,
        viewportWidth,
        zoom
    });

    return {
        panX: clamp(panX, -maxPanX, maxPanX),
        panY: clamp(panY, -maxPanY, maxPanY)
    };
};

export const clampBoardViewport = ({
    boardHeight,
    boardWidth,
    fitZoom,
    panX,
    panY,
    viewportHeight,
    viewportWidth,
    zoom
}: TileBoardWorldMetrics & TileBoardViewportState): TileBoardViewportState => {
    const clampedZoom = clampBoardZoom(zoom);
    const clampedPan = clampBoardPan({
        boardHeight,
        boardWidth,
        fitZoom,
        panX,
        panY,
        viewportHeight,
        viewportWidth,
        zoom: clampedZoom
    });

    return {
        fitZoom,
        panX: clampedPan.panX,
        panY: clampedPan.panY,
        zoom: clampedZoom
    };
};

const normalizePanAxis = (pan: number, maxPan: number): number => {
    if (maxPan <= 0) {
        return 0;
    }

    return pan / maxPan;
};

export const carryBoardViewportForward = ({
    nextMetrics,
    previousMetrics,
    previousViewport
}: {
    nextMetrics: TileBoardViewportMetrics;
    previousMetrics: TileBoardViewportMetrics;
    previousViewport: TileBoardViewportState;
}): TileBoardViewportState => {
    const previousZoom = clampBoardZoom(previousViewport.zoom);
    const previousBounds = getBoardPanBounds({
        boardHeight: previousMetrics.boardHeight,
        boardWidth: previousMetrics.boardWidth,
        fitZoom: previousViewport.fitZoom,
        viewportHeight: previousMetrics.viewportHeight,
        viewportWidth: previousMetrics.viewportWidth,
        zoom: previousZoom
    });
    const nextBounds = getBoardPanBounds({
        boardHeight: nextMetrics.boardHeight,
        boardWidth: nextMetrics.boardWidth,
        fitZoom: nextMetrics.fitZoom,
        viewportHeight: nextMetrics.viewportHeight,
        viewportWidth: nextMetrics.viewportWidth,
        zoom: previousZoom
    });

    return clampBoardViewport({
        boardHeight: nextMetrics.boardHeight,
        boardWidth: nextMetrics.boardWidth,
        fitZoom: nextMetrics.fitZoom,
        panX: normalizePanAxis(previousViewport.panX, previousBounds.maxPanX) * nextBounds.maxPanX,
        panY: normalizePanAxis(previousViewport.panY, previousBounds.maxPanY) * nextBounds.maxPanY,
        viewportHeight: nextMetrics.viewportHeight,
        viewportWidth: nextMetrics.viewportWidth,
        zoom: previousZoom
    });
};

/**
 * Coalesces rapid viewport size updates (resize, DPR, R3F `viewport` churn) to at most one callback per frame,
 * reducing redundant React state updates and WebGL resize work.
 */
export const createRafCoalescedViewportNotifier = (
    onFlush: (width: number, height: number) => void
): {
    schedule: (width: number, height: number) => void;
    cancel: () => void;
} => {
    let raf: number | null = null;
    let pendingW = 0;
    let pendingH = 0;
    let hasPending = false;

    const flush = (): void => {
        raf = null;
        if (!hasPending) {
            return;
        }
        hasPending = false;
        onFlush(pendingW, pendingH);
    };

    return {
        schedule(width: number, height: number): void {
            pendingW = width;
            pendingH = height;
            hasPending = true;
            if (raf === null) {
                raf = requestAnimationFrame(flush);
            }
        },
        cancel(): void {
            if (raf !== null) {
                cancelAnimationFrame(raf);
                raf = null;
            }
            hasPending = false;
        }
    };
};

export const screenPointToWorld = (
    point: TileBoardScreenPoint,
    rect: DOMRect | Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
    viewportWidth: number,
    viewportHeight: number
): Pick<TileBoardViewportState, 'panX' | 'panY'> => {
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    const normalizedX = (point.clientX - rect.left) / width - 0.5;
    const normalizedY = 0.5 - (point.clientY - rect.top) / height;

    return {
        panX: normalizedX * viewportWidth,
        panY: normalizedY * viewportHeight
    };
};

export const safelySetPointerCapture = (element: Pick<HTMLElement, 'setPointerCapture'>, pointerId: number): boolean => {
    try {
        element.setPointerCapture(pointerId);
        return true;
    } catch {
        return false;
    }
};

export const safelyReleasePointerCapture = (
    element: Pick<HTMLElement, 'hasPointerCapture' | 'releasePointerCapture'>,
    pointerId: number
): void => {
    try {
        if (element.hasPointerCapture(pointerId)) {
            element.releasePointerCapture(pointerId);
        }
    } catch {
        // Pointer capture cleanup is best-effort; gesture state cleanup must still complete.
    }
};

export const getGestureCentroid = (
    first: TileBoardGesturePoint,
    second: TileBoardGesturePoint
): TileBoardGesturePoint => ({
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2
});

export const getGestureDistance = (first: TileBoardGesturePoint, second: TileBoardGesturePoint): number =>
    Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));

export const createPinchBoardGestureSnapshot = ({
    centroidWorld,
    firstPointerId,
    firstTouch,
    secondPointerId,
    secondTouch,
    viewport
}: {
    centroidWorld: Pick<TileBoardViewportState, 'panX' | 'panY'>;
    firstPointerId: number;
    firstTouch: TileBoardGesturePoint;
    secondPointerId: number;
    secondTouch: TileBoardGesturePoint;
    viewport: TileBoardViewportState;
}): TileBoardPinchGestureSnapshot => {
    const activeScale = Math.max(viewport.fitZoom * viewport.zoom, 0.0001);

    return {
        anchorBoardX: (centroidWorld.panX - viewport.panX) / activeScale,
        anchorBoardY: (centroidWorld.panY - viewport.panY) / activeScale,
        pointerIds: [firstPointerId, secondPointerId],
        startDistance: getGestureDistance(firstTouch, secondTouch),
        startZoom: viewport.zoom
    };
};

export const resolveAnchoredBoardViewport = ({
    boardHeight,
    boardWidth,
    currentViewport,
    nextZoom,
    pointerWorld,
    viewportHeight,
    viewportWidth
}: TileBoardWorldMetrics & {
    currentViewport: TileBoardViewportState;
    nextZoom: number;
    pointerWorld: Pick<TileBoardViewportState, 'panX' | 'panY'>;
}): TileBoardViewportState => {
    const currentScale = Math.max(currentViewport.fitZoom * currentViewport.zoom, 0.0001);
    const anchorBoardX = (pointerWorld.panX - currentViewport.panX) / currentScale;
    const anchorBoardY = (pointerWorld.panY - currentViewport.panY) / currentScale;

    return clampBoardViewport({
        boardHeight,
        boardWidth,
        fitZoom: currentViewport.fitZoom,
        panX: pointerWorld.panX - anchorBoardX * currentViewport.fitZoom * nextZoom,
        panY: pointerWorld.panY - anchorBoardY * currentViewport.fitZoom * nextZoom,
        viewportHeight,
        viewportWidth,
        zoom: nextZoom
    });
};

export const resolveWheelBoardViewport = ({
    boardHeight,
    boardWidth,
    currentViewport,
    deltaY,
    pointerWorld,
    viewportHeight,
    viewportWidth
}: TileBoardWorldMetrics & {
    currentViewport: TileBoardViewportState;
    deltaY: number;
    pointerWorld: Pick<TileBoardViewportState, 'panX' | 'panY'>;
}): TileBoardViewportState =>
    resolveAnchoredBoardViewport({
        boardHeight,
        boardWidth,
        currentViewport,
        nextZoom: clampBoardZoom(currentViewport.zoom * Math.exp(-deltaY * 0.0016)),
        pointerWorld,
        viewportHeight,
        viewportWidth
    });

export const resolvePinchBoardViewport = ({
    boardHeight,
    boardWidth,
    centroidWorld,
    firstTouch,
    fitZoom,
    secondTouch,
    snapshot,
    viewportHeight,
    viewportWidth
}: TileBoardWorldMetrics & {
    centroidWorld: Pick<TileBoardViewportState, 'panX' | 'panY'>;
    firstTouch: TileBoardGesturePoint;
    fitZoom: number;
    secondTouch: TileBoardGesturePoint;
    snapshot: TileBoardPinchGestureSnapshot;
}): TileBoardViewportState => {
    const nextZoom = snapshot.startZoom * (getGestureDistance(firstTouch, secondTouch) / snapshot.startDistance);

    return clampBoardViewport({
        boardHeight,
        boardWidth,
        fitZoom,
        panX: centroidWorld.panX - snapshot.anchorBoardX * fitZoom * nextZoom,
        panY: centroidWorld.panY - snapshot.anchorBoardY * fitZoom * nextZoom,
        viewportHeight,
        viewportWidth,
        zoom: nextZoom
    });
};

export const resolveDraggedBoardViewport = ({
    boardHeight,
    boardWidth,
    currentZoom,
    currentWorld,
    fitZoom,
    snapshot,
    viewportHeight,
    viewportWidth
}: TileBoardWorldMetrics & {
    currentWorld: Pick<TileBoardViewportState, 'panX' | 'panY'>;
    currentZoom: number;
    fitZoom: number;
    snapshot: TileBoardMouseDragSnapshot;
}): TileBoardViewportState =>
    clampBoardViewport({
        boardHeight,
        boardWidth,
        fitZoom,
        panX: snapshot.startPanX + (currentWorld.panX - snapshot.startWorldX),
        panY: snapshot.startPanY + (currentWorld.panY - snapshot.startWorldY),
        viewportHeight,
        viewportWidth,
        zoom: currentZoom
    });
