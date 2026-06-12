import type { MutableRefObject, RefObject } from 'react';
import type {
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    ShaderMaterial
} from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import type { TileBezelFramePropsSnapshot } from './tileBoardFramePropsSnapshot';

export interface TileBezelPlaneGeometries {
    front: PlaneGeometry;
    back: PlaneGeometry;
    overlay: PlaneGeometry;
}

export interface TileBezelFrameBag {
    groupRef: RefObject<Group | null>;
    propsRef: MutableRefObject<TileBezelFramePropsSnapshot>;
    planeGeometries: TileBezelPlaneGeometries;
    frontBaseRef: MutableRefObject<Float32Array | null>;
    backBaseRef: MutableRefObject<Float32Array | null>;
    overlayBaseRef: MutableRefObject<Float32Array | null>;
    frontPersistentRef: MutableRefObject<Float32Array>;
    backPersistentRef: MutableRefObject<Float32Array>;
    overlayPersistentRef: MutableRefObject<Float32Array>;
    prevFaceUpRef: MutableRefObject<boolean>;
    flipPopT0Ref: MutableRefObject<number | null>;
    faceUpStructBlendRef: MutableRefObject<number>;
    faceUpStructT0Ref: MutableRefObject<number | null>;
    prevResolvingRef: MutableRefObject<ResolvingSelectionState | null>;
    lastResolvingWaveKeyRef: MutableRefObject<string | null>;
    matchPulseRef: MutableRefObject<number>;
    liftSmoothRef: MutableRefObject<number>;
    frontCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    backCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    focusDimBlendRef: MutableRefObject<number>;
    bendURef: MutableRefObject<number>;
    bendVRef: MutableRefObject<number>;
    bendBuildupRef: MutableRefObject<number>;
    lastBumpURef: MutableRefObject<number | null>;
    lastBumpVRef: MutableRefObject<number | null>;
    pressingOnCardRef: MutableRefObject<boolean>;
    hoverRimTopMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverRimBottomMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverRimRightMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverRimLeftMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverFrontRimTopMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverFrontRimBottomMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverFrontRimRightMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverFrontRimLeftMatRef: MutableRefObject<MeshBasicMaterial | null>;
    resolvingRimMatRef: MutableRefObject<MeshBasicMaterial | null>;
    focusRimMatRef: MutableRefObject<MeshBasicMaterial | null>;
    hoverBackGlowMatRef: MutableRefObject<ShaderMaterial | null>;
    hoverBackGlowMeshRef: MutableRefObject<Mesh | null>;
    hoverFrontGlowMatRef: MutableRefObject<ShaderMaterial | null>;
    hoverFrontGlowMeshRef: MutableRefObject<Mesh | null>;
    resolvingGlowMatRef: MutableRefObject<ShaderMaterial | null>;
    resolvingGlowMeshRef: MutableRefObject<Mesh | null>;
    focusGlowMatRef: MutableRefObject<ShaderMaterial | null>;
    focusGlowMeshRef: MutableRefObject<Mesh | null>;
    matchedVictoryFlameMatRef: MutableRefObject<ShaderMaterial | null>;
    matchedVictoryFlameMeshRef: MutableRefObject<Mesh | null>;
    matchedVictoryBurstT0Ref: MutableRefObject<number | null>;
    prevTileMatchedRef: MutableRefObject<boolean>;
    lastActivityVisualGateRef: MutableRefObject<{
        textureRevision: number;
        keyboardFocused: boolean;
        focusDimmed: boolean;
        graphicsQuality: GraphicsQualityPreset;
    } | null>;
}

export type CreateTileBezelFrameBagInput = Omit<TileBezelFrameBag, 'planeGeometries'> & {
    planeGeometries: TileBezelPlaneGeometries;
};

export const createOrUpdateTileBezelFrameBag = (
    current: TileBezelFrameBag | null,
    input: CreateTileBezelFrameBagInput
): TileBezelFrameBag => {
    if (current) {
        current.planeGeometries = input.planeGeometries;
        return current;
    }

    return { ...input };
};
