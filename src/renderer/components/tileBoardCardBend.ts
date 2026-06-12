import {
    CanvasTexture,
    LinearFilter,
    MathUtils,
    SRGBColorSpace
} from 'three';
import type { BufferAttribute, PlaneGeometry } from 'three';

/** Segments per card face: bend deformation + enough tessellation for displacement maps. */
export const CARD_BEND_SEGMENTS = 48;
/** Keep wear multiply layer above peak displacement (front/back). */
export const CARD_WEAR_Z_SLIVER = 0.0052;
/** Base bulge depth (world units); tuned so a single click is clearly visible. */
export const CARD_BEND_MAX_DEPTH = 0.038;
/** Extra depth multiplier from repeated presses near the same UV (same face). */
export const BEND_BUILDUP_PER_PRESS = 0.5;
export const BEND_BUILDUP_MAX = 2.75;
export const BEND_UV_SAME_SPOT = 0.14;
/** Wear mask resolution (canvas); drawn on each bend commit. */
export const WEAR_TEX_SIZE = 128;

export type CardBendFace = 'front' | 'back';

export interface CardWearTextureAssets {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: CanvasTexture;
}

export interface CardWearAssetSet {
    back: CardWearTextureAssets;
    front: CardWearTextureAssets;
}

export interface CardBendBaseGeometryState {
    backBase: Float32Array;
    frontBase: Float32Array;
    overlayBase: Float32Array;
}

export type CardBendPointerEventType = 'click' | 'pointerdown' | 'pointermove' | 'pointerup' | string;

export interface CardBendSyncDecision {
    u: number;
    v: number;
}

export interface CardBendSyncStateInput {
    bumpRepeat: boolean;
    currentBuildup: number;
    eventType: CardBendPointerEventType;
    face: CardBendFace | null;
    lastBumpU: number | null;
    lastBumpV: number | null;
    pickable: boolean;
    pointerButtons: number | null;
    pointerType: string | null;
    reduceMotion: boolean;
    uv: { x: number; y: number } | null | undefined;
}

export interface CardBendSyncState {
    bendU: number;
    bendV: number;
    buildup: number;
    lastBumpU: number | null;
    lastBumpV: number | null;
}

export type CardHoverTiltDecision =
    | { kind: 'clear' }
    | { kind: 'set'; x: number; y: number }
    | { kind: 'unchanged' };

export interface CardHoverTiltState {
    tileId: string | null;
    x: number;
    y: number;
}

export interface CardHoverTiltStateInput {
    current: CardHoverTiltState;
    pointerType: string | null;
    reduceMotion: boolean;
    tileId: string;
    uv: { x: number; y: number } | null | undefined;
}

export interface CardPointerUpDecision {
    commitBend: boolean;
    pickTile: boolean;
    syncBend: boolean;
}

export interface CardPointerDownState {
    pressingOnCard: boolean;
    syncBend: boolean;
}

export interface CardClickStateInput {
    pickable: boolean;
    reduceMotion: boolean;
}

export interface CardClickState {
    syncBend: boolean;
}

export type CardPointerMoveStateInput = CardHoverTiltStateInput;

export interface CardPointerMoveState {
    hoverTilt: CardHoverTiltState;
    syncBend: boolean;
}

export interface CardPointerUpStateInput {
    button: number;
    pickable: boolean;
    pointerType: string;
    pressingOnCard: boolean;
    reduceMotion: boolean;
}

export interface CardPointerUpState extends CardPointerUpDecision {
    pressingOnCard: boolean;
}

export interface CardPointerOutDecision {
    clearHoverTilt: boolean;
    commitBend: boolean;
}

export interface CardPointerOutStateInput {
    hoverTilt: CardHoverTiltState;
    pickable: boolean;
    pressingOnCard: boolean;
    reduceMotion: boolean;
    tileId: string;
}

export interface CardPointerOutState {
    commitBend: boolean;
    hoverTilt: CardHoverTiltState;
    pressingOnCard: boolean;
}

export interface CardBendPlaneTarget {
    base: Float32Array;
    persistent: Float32Array;
    positions: BufferAttribute;
}

export interface ApplyLiveCardBendInput {
    back: CardBendPlaneTarget | null;
    bendU: number;
    bendV: number;
    cardHeight: number;
    cardWidth: number;
    front: CardBendPlaneTarget | null;
    liveDepthScale: number;
    liveOverlayDepthScale: number;
    overlay: CardBendPlaneTarget | null;
    useSvgMeshBack: boolean;
    useSvgMeshFront: boolean;
}

export interface LiveCardBendStateInput {
    bendBuildup: number;
    bendOverlay: boolean;
    pickable: boolean;
    pressingOnCard: boolean;
    reduceMotion: boolean;
}

export interface LiveCardBendState {
    liveDepthScale: number;
    liveOverlayDepthScale: number;
}

export interface CardBendPersistentTarget {
    base: Float32Array;
    persistent: Float32Array;
}

export interface CardWearStampTarget {
    context: CanvasRenderingContext2D;
    texture: {
        needsUpdate: boolean;
    };
}

export interface CardWearStampTargets {
    back: CardWearStampTarget;
    front: CardWearStampTarget;
}

export interface CommitPersistentCardBendInput {
    back: CardBendPersistentTarget | null;
    bendOverlay: boolean;
    bendU: number;
    bendV: number;
    cardHeight: number;
    cardWidth: number;
    depthScale: number;
    front: CardBendPersistentTarget | null;
    overlay: CardBendPersistentTarget | null;
    useSvgMeshBack: boolean;
    useSvgMeshFront: boolean;
    wear: CardWearStampTargets | null;
}

export const resolveCardBendFaceFromHit = ({
    faceNormalZ,
    halfDepth,
    localZ
}: {
    faceNormalZ: number | null | undefined;
    halfDepth: number;
    localZ: number;
}): CardBendFace | null => {
    if (faceNormalZ != null && Math.abs(faceNormalZ) > 0.65) {
        return faceNormalZ > 0 ? 'front' : 'back';
    }

    if (localZ > halfDepth * 0.1) {
        return 'front';
    }

    if (localZ < -halfDepth * 0.1) {
        return 'back';
    }

    return null;
};

export const cloneBasePositions = (geometry: PlaneGeometry): Float32Array =>
    new Float32Array((geometry.attributes.position as BufferAttribute).array);

/** Plane vertex (px, py) to the same UV convention as Three.js PlaneGeometry. */
export const planeVertexToUv = (px: number, py: number, width: number, height: number): { u: number; v: number } => ({
    u: px / width + 0.5,
    v: py / height + 0.5
});

export const bendFalloffAtUv = (
    u: number,
    v: number,
    bendU: number,
    bendV: number,
    width: number,
    height: number
): number => {
    const radius = 0.52 * Math.min(width, height);
    const dx = (u - bendU) * width;
    const dy = (v - bendV) * height;
    const dist = Math.hypot(dx, dy);
    const t = MathUtils.clamp(1 - dist / radius, 0, 1);

    return t * t * (3 - 2 * t);
};

/** Map raycast UV to shared card UV so front + back planes bulge at the same spot. */
export const hitUvToCanonicalBendUv = (face: CardBendFace, u: number, v: number): { u: number; v: number } =>
    face === 'front' ? { u, v } : { u: 1 - u, v };

export const computeCardBendSyncDecision = ({
    eventType,
    face,
    pointerButtons,
    pointerType,
    uv
}: {
    eventType: CardBendPointerEventType;
    face: CardBendFace | null;
    pointerButtons: number | null;
    pointerType: string | null;
    uv: { x: number; y: number } | null | undefined;
}): CardBendSyncDecision | null => {
    if (
        eventType === 'pointermove' &&
        pointerType === 'mouse' &&
        pointerButtons != null &&
        (pointerButtons & 1) === 0
    ) {
        return null;
    }

    if (!face || !uv) {
        return null;
    }

    return hitUvToCanonicalBendUv(face, uv.x, uv.y);
};

export const computeCardBendSyncState = ({
    bumpRepeat,
    currentBuildup,
    eventType,
    face,
    lastBumpU,
    lastBumpV,
    pickable,
    pointerButtons,
    pointerType,
    reduceMotion,
    uv
}: CardBendSyncStateInput): CardBendSyncState | null => {
    if (reduceMotion || !pickable) {
        return null;
    }

    const bendSync = computeCardBendSyncDecision({
        eventType,
        face,
        pointerButtons,
        pointerType,
        uv
    });

    if (!bendSync) {
        return null;
    }

    if (!bumpRepeat) {
        return {
            bendU: bendSync.u,
            bendV: bendSync.v,
            buildup: currentBuildup,
            lastBumpU,
            lastBumpV
        };
    }

    return {
        bendU: bendSync.u,
        bendV: bendSync.v,
        buildup: nextBendBuildupForHit({
            currentBuildup,
            hitU: bendSync.u,
            hitV: bendSync.v,
            previousU: lastBumpU,
            previousV: lastBumpV
        }),
        lastBumpU: bendSync.u,
        lastBumpV: bendSync.v
    };
};

export const nextBendBuildupForHit = ({
    currentBuildup,
    hitU,
    hitV,
    previousU,
    previousV
}: {
    currentBuildup: number;
    hitU: number;
    hitV: number;
    previousU: number | null;
    previousV: number | null;
}): number => {
    if (previousU === null || previousV === null) {
        return 0;
    }

    if (Math.hypot(hitU - previousU, hitV - previousV) < BEND_UV_SAME_SPOT) {
        return Math.min(BEND_BUILDUP_MAX, currentBuildup + BEND_BUILDUP_PER_PRESS);
    }

    return 0;
};

export const pointerUvToHoverTilt = (u: number, v: number): { x: number; y: number } => ({
    x: MathUtils.clamp(u * 2 - 1, -1, 1),
    y: MathUtils.clamp(-(v * 2 - 1), -1, 1)
});

export const computeCardHoverTiltDecision = ({
    pointerType,
    reduceMotion,
    uv
}: {
    pointerType: string | null;
    reduceMotion: boolean;
    uv: { x: number; y: number } | null | undefined;
}): CardHoverTiltDecision => {
    if (reduceMotion || pointerType === 'touch' || pointerType === 'pen') {
        return { kind: 'clear' };
    }

    if (!uv) {
        return { kind: 'unchanged' };
    }

    return { kind: 'set', ...pointerUvToHoverTilt(uv.x, uv.y) };
};

export const computeCardHoverTiltState = ({
    current,
    pointerType,
    reduceMotion,
    tileId,
    uv
}: CardHoverTiltStateInput): CardHoverTiltState => {
    const decision = computeCardHoverTiltDecision({ pointerType, reduceMotion, uv });

    if (decision.kind === 'clear') {
        return current.tileId === tileId ? { tileId: null, x: 0, y: 0 } : current;
    }

    if (decision.kind === 'unchanged') {
        return current;
    }

    return { tileId, x: decision.x, y: decision.y };
};

export const computeCardPointerDownState = (): CardPointerDownState => ({
    pressingOnCard: true,
    syncBend: true
});

export const computeCardClickState = ({ pickable, reduceMotion }: CardClickStateInput): CardClickState => ({
    syncBend: pickable && !reduceMotion
});

export const computeCardPointerMoveState = (input: CardPointerMoveStateInput): CardPointerMoveState => ({
    hoverTilt: computeCardHoverTiltState(input),
    syncBend: true
});

export const computeCardPointerUpDecision = ({
    button,
    pickable,
    pointerType,
    pressingOnCard,
    reduceMotion
}: CardPointerUpStateInput): CardPointerUpDecision => {
    const acceptsPointerPick = pointerType !== 'mouse' || button === 0;
    const canBend = pickable && !reduceMotion;

    return {
        commitBend: pressingOnCard && canBend,
        pickTile: pickable && acceptsPointerPick,
        syncBend: canBend && acceptsPointerPick
    };
};

export const computeCardPointerUpState = (input: CardPointerUpStateInput): CardPointerUpState => ({
    ...computeCardPointerUpDecision(input),
    pressingOnCard: false
});

export const computeCardPointerOutDecision = ({
    activeHoverTileId,
    pickable,
    pressingOnCard,
    reduceMotion,
    tileId
}: {
    activeHoverTileId: string | null;
    pickable: boolean;
    pressingOnCard: boolean;
    reduceMotion: boolean;
    tileId: string;
}): CardPointerOutDecision => ({
    clearHoverTilt: activeHoverTileId === tileId,
    commitBend: pressingOnCard && pickable && !reduceMotion
});

export const computeCardPointerOutState = ({
    hoverTilt,
    pickable,
    pressingOnCard,
    reduceMotion,
    tileId
}: CardPointerOutStateInput): CardPointerOutState => {
    const decision = computeCardPointerOutDecision({
        activeHoverTileId: hoverTilt.tileId,
        pickable,
        pressingOnCard,
        reduceMotion,
        tileId
    });

    return {
        commitBend: decision.commitBend,
        hoverTilt: decision.clearHoverTilt ? { tileId: null, x: 0, y: 0 } : hoverTilt,
        pressingOnCard: false
    };
};

export const computeLiveCardBendState = ({
    bendBuildup,
    bendOverlay,
    pickable,
    pressingOnCard,
    reduceMotion
}: LiveCardBendStateInput): LiveCardBendState => {
    const depthMultiplier = 1 + bendBuildup * 0.52;
    const liveDepthScale = !reduceMotion && pickable && pressingOnCard ? depthMultiplier : 0;

    return {
        liveDepthScale,
        liveOverlayDepthScale: bendOverlay ? liveDepthScale : 0
    };
};

/** Add permanent Z offsets into a persistent per-vertex depth buffer for one bend stamp. */
export const addPersistentBendStamp = (
    persistent: Float32Array,
    base: Float32Array,
    bendU: number,
    bendV: number,
    width: number,
    height: number,
    depthScale: number
): void => {
    const depth = CARD_BEND_MAX_DEPTH * depthScale;
    const vertexCount = persistent.length;

    for (let index = 0; index < vertexCount; index += 1) {
        const offset = index * 3;
        const px = base[offset];
        const py = base[offset + 1];
        const { u, v } = planeVertexToUv(px, py, width, height);
        const wgt = bendFalloffAtUv(u, v, bendU, bendV, width, height);
        persistent[index] += depth * wgt;
    }
};

export const composeCardPositions = (
    positions: BufferAttribute,
    base: Float32Array,
    persistentZ: Float32Array,
    bendU: number,
    bendV: number,
    width: number,
    height: number,
    liveDepthScale: number
): void => {
    const array = positions.array as Float32Array;
    const vertexCount = array.length / 3;
    const liveDepth = CARD_BEND_MAX_DEPTH * liveDepthScale;

    for (let index = 0; index < vertexCount; index += 1) {
        const offset = index * 3;
        const px = base[offset];
        const py = base[offset + 1];
        const z0 = base[offset + 2];
        const { u, v } = planeVertexToUv(px, py, width, height);
        const wgt = bendFalloffAtUv(u, v, bendU, bendV, width, height);
        array[offset] = px;
        array[offset + 1] = py;
        array[offset + 2] = z0 + persistentZ[index] + liveDepth * wgt;
    }

    positions.needsUpdate = true;
};

export const applyLiveCardBend = ({
    back,
    bendU,
    bendV,
    cardHeight,
    cardWidth,
    front,
    liveDepthScale,
    liveOverlayDepthScale,
    overlay,
    useSvgMeshBack,
    useSvgMeshFront
}: ApplyLiveCardBendInput): void => {
    if (front && !useSvgMeshFront) {
        composeCardPositions(
            front.positions,
            front.base,
            front.persistent,
            bendU,
            bendV,
            cardWidth,
            cardHeight,
            liveDepthScale
        );
    }

    if (back && !useSvgMeshBack) {
        composeCardPositions(
            back.positions,
            back.base,
            back.persistent,
            bendU,
            bendV,
            cardWidth,
            cardHeight,
            liveDepthScale
        );
    }

    if (overlay) {
        composeCardPositions(
            overlay.positions,
            overlay.base,
            overlay.persistent,
            bendU,
            bendV,
            cardWidth,
            cardHeight,
            liveOverlayDepthScale
        );
    }
};

export const createWearTextureAndContext = (): CardWearTextureAssets => {
    const canvas = document.createElement('canvas');
    canvas.width = WEAR_TEX_SIZE;
    canvas.height = WEAR_TEX_SIZE;
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('2D canvas context required for card wear texture');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, WEAR_TEX_SIZE, WEAR_TEX_SIZE);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.premultiplyAlpha = true;
    texture.needsUpdate = true;

    return { canvas, context, texture };
};

export const createCardWearAssetSet = (): CardWearAssetSet | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    return {
        back: createWearTextureAndContext(),
        front: createWearTextureAndContext()
    };
};

export const applyCardWearTextureAnisotropy = (
    wear: CardWearAssetSet | null,
    anisotropy: number
): void => {
    if (!wear) {
        return;
    }

    wear.front.texture.anisotropy = anisotropy;
    wear.back.texture.anisotropy = anisotropy;
};

export const disposeCardWearAssetSet = (wear: CardWearAssetSet | null): void => {
    if (!wear) {
        return;
    }

    wear.front.texture.dispose();
    wear.back.texture.dispose();
};

export const prepareCardBendBaseGeometryState = ({
    backGeometry,
    frontGeometry,
    overlayGeometry
}: {
    backGeometry: PlaneGeometry;
    frontGeometry: PlaneGeometry;
    overlayGeometry: PlaneGeometry;
}): CardBendBaseGeometryState => {
    const frontBase = cloneBasePositions(frontGeometry);
    const backBase = cloneBasePositions(backGeometry);
    const overlayBase = cloneBasePositions(overlayGeometry);

    for (const geometry of [frontGeometry, backGeometry]) {
        if (!geometry.index) {
            continue;
        }

        try {
            geometry.computeTangents();
        } catch {
            /* bend-deformed planes still approximate OK for subtle normal map */
        }
    }

    return { backBase, frontBase, overlayBase };
};

export const drawWearStamp = (
    context: CanvasRenderingContext2D,
    bendU: number,
    bendV: number,
    intensity: number
): void => {
    const gx = bendU * WEAR_TEX_SIZE;
    const gy = (1 - bendV) * WEAR_TEX_SIZE;
    const radius = WEAR_TEX_SIZE * 0.14;
    const gradient = context.createRadialGradient(gx, gy, 0, gx, gy, radius);
    const a = MathUtils.clamp(0.05 + intensity * 0.07, 0.06, 0.22);
    gradient.addColorStop(0, `rgba(45,35,28,${a})`);
    gradient.addColorStop(0.55, `rgba(55,42,32,${a * 0.45})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = gradient;
    context.fillRect(0, 0, WEAR_TEX_SIZE, WEAR_TEX_SIZE);
    context.restore();
};

export const commitPersistentCardBend = ({
    back,
    bendOverlay,
    bendU,
    bendV,
    cardHeight,
    cardWidth,
    depthScale,
    front,
    overlay,
    useSvgMeshBack,
    useSvgMeshFront,
    wear
}: CommitPersistentCardBendInput): void => {
    if (front && !useSvgMeshFront) {
        addPersistentBendStamp(front.persistent, front.base, bendU, bendV, cardWidth, cardHeight, depthScale);
    }

    if (back && !useSvgMeshBack) {
        addPersistentBendStamp(back.persistent, back.base, bendU, bendV, cardWidth, cardHeight, depthScale);
    }

    if (overlay && bendOverlay) {
        addPersistentBendStamp(overlay.persistent, overlay.base, bendU, bendV, cardWidth, cardHeight, depthScale);
    }

    if (!wear) {
        return;
    }

    if (!useSvgMeshFront) {
        drawWearStamp(wear.front.context, bendU, bendV, depthScale);
        wear.front.texture.needsUpdate = true;
    }

    if (!useSvgMeshBack) {
        drawWearStamp(wear.back.context, bendU, bendV, depthScale);
        wear.back.texture.needsUpdate = true;
    }
};
