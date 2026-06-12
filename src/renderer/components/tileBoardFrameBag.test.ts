import { describe, expect, it } from 'vitest';
import { PlaneGeometry } from 'three';

import {
    createOrUpdateTileBezelFrameBag,
    type CreateTileBezelFrameBagInput
} from './tileBoardFrameBag';

const ref = <T>(current: T) => ({ current });

const createInput = (
    planeGeometries = {
        back: new PlaneGeometry(1, 1),
        front: new PlaneGeometry(1, 1),
        overlay: new PlaneGeometry(1, 1)
    }
): CreateTileBezelFrameBagInput => ({
    backBaseRef: ref<Float32Array | null>(null),
    backCardMatRef: ref(null),
    backPersistentRef: ref(new Float32Array(1)),
    bendBuildupRef: ref(0),
    bendURef: ref(0.5),
    bendVRef: ref(0.5),
    faceUpStructBlendRef: ref(0),
    faceUpStructT0Ref: ref<number | null>(null),
    flipPopT0Ref: ref<number | null>(null),
    focusDimBlendRef: ref(0),
    focusGlowMatRef: ref(null),
    focusGlowMeshRef: ref(null),
    focusRimMatRef: ref(null),
    frontBaseRef: ref<Float32Array | null>(null),
    frontCardMatRef: ref(null),
    frontPersistentRef: ref(new Float32Array(1)),
    groupRef: ref(null),
    hoverBackGlowMatRef: ref(null),
    hoverBackGlowMeshRef: ref(null),
    hoverFrontGlowMatRef: ref(null),
    hoverFrontGlowMeshRef: ref(null),
    hoverFrontRimBottomMatRef: ref(null),
    hoverFrontRimLeftMatRef: ref(null),
    hoverFrontRimRightMatRef: ref(null),
    hoverFrontRimTopMatRef: ref(null),
    hoverRimBottomMatRef: ref(null),
    hoverRimLeftMatRef: ref(null),
    hoverRimRightMatRef: ref(null),
    hoverRimTopMatRef: ref(null),
    lastActivityVisualGateRef: ref(null),
    lastBumpURef: ref<number | null>(null),
    lastBumpVRef: ref<number | null>(null),
    lastResolvingWaveKeyRef: ref<string | null>(null),
    liftSmoothRef: ref(0),
    matchedVictoryBurstT0Ref: ref<number | null>(null),
    matchedVictoryFlameMatRef: ref(null),
    matchedVictoryFlameMeshRef: ref(null),
    matchPulseRef: ref(0),
    overlayBaseRef: ref<Float32Array | null>(null),
    overlayPersistentRef: ref(new Float32Array(1)),
    planeGeometries,
    pressingOnCardRef: ref(false),
    prevFaceUpRef: ref(false),
    prevResolvingRef: ref(null),
    prevTileMatchedRef: ref(false),
    propsRef: ref({} as CreateTileBezelFrameBagInput['propsRef']['current']),
    resolvingGlowMatRef: ref(null),
    resolvingGlowMeshRef: ref(null),
    resolvingRimMatRef: ref(null)
});

const disposeInputGeometries = (input: CreateTileBezelFrameBagInput): void => {
    input.planeGeometries.back.dispose();
    input.planeGeometries.front.dispose();
    input.planeGeometries.overlay.dispose();
};

describe('tileBoardFrameBag', () => {
    it('creates a frame bag while preserving input ref objects', () => {
        const input = createInput();

        const bag = createOrUpdateTileBezelFrameBag(null, input);

        expect(bag).not.toBe(input);
        expect(bag.propsRef).toBe(input.propsRef);
        expect(bag.groupRef).toBe(input.groupRef);
        expect(bag.planeGeometries).toBe(input.planeGeometries);

        disposeInputGeometries(input);
    });

    it('updates only plane geometries for an existing frame bag', () => {
        const input = createInput();
        const bag = createOrUpdateTileBezelFrameBag(null, input);
        const nextGeometries = {
            back: new PlaneGeometry(2, 2),
            front: new PlaneGeometry(2, 2),
            overlay: new PlaneGeometry(2, 2)
        };
        const nextInput = createInput(nextGeometries);

        const updated = createOrUpdateTileBezelFrameBag(bag, nextInput);

        expect(updated).toBe(bag);
        expect(updated.propsRef).toBe(input.propsRef);
        expect(updated.groupRef).toBe(input.groupRef);
        expect(updated.planeGeometries).toBe(nextGeometries);

        disposeInputGeometries(input);
        disposeInputGeometries(nextInput);
    });
});
