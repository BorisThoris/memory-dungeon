import type { RootState } from '@react-three/fiber';
import { Color, type BufferAttribute } from 'three';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getTileBoardSurfaceVariant } from './tileBoardSurfaceVariant';
import {
    applyLiveCardBend,
    computeLiveCardBendState
} from './tileBoardCardBend';
import { computeTileBoardFramePulseTransitionState } from './tileBoardFramePulseState';
import {
    applyTileBoardCardGroupMotionState,
    computeTileBoardCardGroupMotionState,
    computeTileBoardLayoutMotionState
} from './tileBoardLayoutMotionState';
import {
    computeTileBoardInteractionMotionState,
    computeTileBoardLiftSmooth
} from './tileBoardInteractionMotionState';
import {
    applyTileBoardFrameVisualState,
    computeTileBoardFrameVisualState
} from './tileBoardFrameVisualState';
import { applyTileBoardFrameMaterialState } from './tileBoardFrameMaterialState';
import type { TileBezelFrameBag } from './tileBoardFrameBag';
import { sampleMatchImpact } from './boardMatchImpact';
import {
    REALM_GLIDE_SHAPE,
    addRealmOffsets,
    putRealmOffset,
    sampleRealmJolt,
    sampleRealmSway,
    takeBackRealmOffset,
    REALM_JOLT_MS,
    ZERO_REALM_OFFSET
} from './realmCardMotion';
import { useRealmAmbience, useRealmEventPulse } from './realmAmbience';
import { setCardDissolve } from './cardDissolveMaterial';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;

const scratchCardTint = new Color();
const scratchGlowColor = new Color();

export const advanceTileBezelFrame = (bag: TileBezelFrameBag, state: RootState, delta: number, visualTime = state.clock.elapsedTime): void => {
    if (typeof document !== 'undefined' && document.hidden) {
        return;
    }

    const p = bag.propsRef.current;
    const group = bag.groupRef.current;

    if (!group) {
        return;
    }

    const clock = { elapsedTime: visualTime };
    const pulseTransition = computeTileBoardFramePulseTransitionState({
        current: {
            faceUpStructBlend: bag.faceUpStructBlendRef.current,
            faceUpStructStartedAt: bag.faceUpStructT0Ref.current,
            flipPopStartedAt: bag.flipPopT0Ref.current,
            lastResolvingWaveKey: bag.lastResolvingWaveKeyRef.current,
            matchedVictoryBurstStartedAt: bag.matchedVictoryBurstT0Ref.current,
            matchPulse: bag.matchPulseRef.current,
            prevFaceUp: bag.prevFaceUpRef.current,
            prevResolvingSelection: bag.prevResolvingRef.current,
            trauma: bag.traumaRef.current,
            wasMatched: bag.prevTileMatchedRef.current
        },
        delta,
        faceUp: p.faceUp,
        reduceMotion: p.reduceMotion,
        resolvingSelection: p.resolvingSelection,
        resolvingWaveKey: p.resolvingMatchWaveKey,
        breakWaveDelaySec: p.breakWaveDelaySec,
        time: clock.elapsedTime,
        tileState: p.tile.state
    });
    const pulseRefs = pulseTransition.refs;
    bag.faceUpStructBlendRef.current = pulseRefs.faceUpStructBlend;
    bag.faceUpStructT0Ref.current = pulseRefs.faceUpStructStartedAt;
    bag.flipPopT0Ref.current = pulseRefs.flipPopStartedAt;
    bag.lastResolvingWaveKeyRef.current = pulseRefs.lastResolvingWaveKey;
    bag.matchedVictoryBurstT0Ref.current = pulseRefs.matchedVictoryBurstStartedAt;
    bag.matchPulseRef.current = pulseRefs.matchPulse;
    bag.prevFaceUpRef.current = pulseRefs.prevFaceUp;
    bag.prevResolvingRef.current = pulseRefs.prevResolvingSelection;
    bag.traumaRef.current = pulseRefs.trauma;
    bag.prevTileMatchedRef.current = pulseRefs.wasMatched;
    const matchPulse = bag.matchPulseRef.current;
    const matchedVictoryBurst = pulseTransition.matchedVictoryBurst;
    // A departing tile shares the flip-pop scale channel: once its burst is done it shrinks to
    // nothing, and a group at scale zero is a tile that has left the board. It keeps most of its
    // size while it burns, so the break-up reads, and shrinks hardest at the end.
    const departure = pulseTransition.departure;
    const flipPopMul = pulseTransition.flipPopScaleMultiplier * (p.reduceMotion ? 1 - departure : 1 - departure * departure * departure);
    // ...and burns away as it shrinks (`cardDissolveMaterial.ts`), unless motion is reduced.
    const dissolve = p.reduceMotion ? 0 : Math.min(1, departure * 1.1);
    setCardDissolve(bag.frontCardMatRef.current, dissolve);
    setCardDissolve(bag.backCardMatRef.current, dissolve);
    const flipPopZ = pulseTransition.flipPopZ;

    const frontBase = bag.frontBaseRef.current;
    const backBase = bag.backBaseRef.current;
    const overlayBase = bag.overlayBaseRef.current;

    if (frontBase && backBase && overlayBase) {
        const bu = bag.bendURef.current;
        const bv = bag.bendVRef.current;
        const bendOverlay = getTileBoardSurfaceVariant(p.tile, p.faceUp, p.resolvingSelection) !== 'hidden';
        const liveBendState = computeLiveCardBendState({
            bendBuildup: bag.bendBuildupRef.current,
            bendOverlay,
            pickable: p.pickable,
            pressingOnCard: bag.pressingOnCardRef.current,
            reduceMotion: p.reduceMotion
        });
        applyLiveCardBend({
            back: {
                base: backBase,
                persistent: bag.backPersistentRef.current,
                positions: bag.planeGeometries.back.attributes.position as BufferAttribute
            },
            bendU: bu,
            bendV: bv,
            cardHeight: CARD_HEIGHT,
            cardWidth: CARD_WIDTH,
            front: {
                base: frontBase,
                persistent: bag.frontPersistentRef.current,
                positions: bag.planeGeometries.front.attributes.position as BufferAttribute
            },
            liveDepthScale: liveBendState.liveDepthScale,
            liveOverlayDepthScale: liveBendState.liveOverlayDepthScale,
            overlay: {
                base: overlayBase,
                persistent: bag.overlayPersistentRef.current,
                positions: bag.planeGeometries.overlay.attributes.position as BufferAttribute
            },
        });
    }

    const isMatched = p.tile.state === 'matched';
    const time = visualTime;
    const interactionMotion = computeTileBoardInteractionMotionState({
        faceUp: p.faceUp,
        fieldAmp: p.fieldAmp,
        fieldTilt: p.fieldTiltRef.current,
        hoverTilt: p.hoverTiltRef.current,
        isMatched,
        pickable: p.pickable,
        reduceMotion: p.reduceMotion,
        routeReadabilityIntensity: p.traitRouteReadabilityIntensity,
        seed: p.transform.seed,
        tileFieldParallaxEnabled: p.tileFieldParallaxEnabled,
        tileId: p.tile.id,
        tileState: p.tile.state,
        time
    });
    const {
        baseDepthFull,
        baseLiftFull,
        fieldDepth,
        fieldLift,
        fieldRotX,
        fieldRotZ,
        hoverDepth,
        hoverDomParity,
        hoverFaceUpPickable,
        hoverLift,
        hoverTiltX,
        hoverTiltZ,
        idleDrift,
        liftLambda,
        rotationDamp,
        settle
    } = interactionMotion;
    const structBlend = bag.faceUpStructBlendRef.current;
    const structLift = baseLiftFull * structBlend;
    const structDepth = baseDepthFull * structBlend;
    const liftGoal = structLift + hoverLift;
    bag.liftSmoothRef.current = computeTileBoardLiftSmooth({
        current: bag.liftSmoothRef.current,
        delta,
        liftLambda,
        target: liftGoal
    });

    const now = performance.now();
    const { entranceMotion, layoutMotionActive, posLambda, shuffleMotion } =
        computeTileBoardLayoutMotionState({
            boardColumns: p.boardColumns,
            boardEntranceMotionBudgetMs: p.boardEntranceMotionBudgetMs,
            boardEntranceMotionDeadlineMs: p.boardEntranceMotionDeadlineMs,
            boardEntranceStaggerTileCount: p.boardEntranceStaggerTileCount,
            boardRows: p.boardRows,
            now,
            reduceMotion: p.reduceMotion,
            shuffleBoardOrderIndex: p.shuffleBoardOrderIndex,
            shuffleMotionBudgetMs: p.shuffleMotionBudgetMs,
            shuffleMotionDeadlineMs: p.shuffleMotionDeadlineMs,
            shuffleStaggerTileCount: p.shuffleStaggerTileCount
        });

    const cardGroupMotionState = computeTileBoardCardGroupMotionState({
        entranceMotion,
        fieldDepth,
        fieldLift,
        fieldRotX,
        fieldRotZ,
        flipPopScaleMultiplier: flipPopMul,
        flipPopZ,
        hoverDepth,
        hoverTiltX,
        hoverTiltZ,
        idleDrift,
        layoutMotionActive,
        liftSmooth: bag.liftSmoothRef.current,
        matchPulse,
        posLambda,
        reduceMotion: p.reduceMotion,
        resolvingSelection: p.resolvingSelection,
        rotationDamp,
        settle,
        shuffleMotion,
        structDepth,
        transform: p.transform,
        trauma: bag.traumaRef.current,
        wobbleTime: clock.elapsedTime
    });
    // The realm's sway and jolts (`realmCardMotion.ts`) are added after the damping; take last frame's back first.
    takeBackRealmOffset(group);
    const realmEvent = useRealmEventPulse.getState().event;
    const joltMs = realmEvent && realmEvent.tileIds.has(p.tile.id) ? now - realmEvent.at : -1;
    const jolting = realmEvent != null && joltMs >= 0 && joltMs < REALM_JOLT_MS;
    applyTileBoardCardGroupMotionState(
        group,
        cardGroupMotionState,
        delta,
        jolting ? REALM_GLIDE_SHAPE[realmEvent.family] : undefined
    );
    if (isMatched && pulseRefs.matchedVictoryBurstStartedAt != null) {
        const impact = sampleMatchImpact(time - pulseRefs.matchedVictoryBurstStartedAt, p.reduceMotion);
        group.position.z += impact.z;
        group.scale.x *= impact.scaleX;
        group.scale.y *= impact.scaleY;
    }

    if (!p.reduceMotion) {
        const ambience = useRealmAmbience.getState();
        const phase = (p.transform.seed % 997) * 0.0063;
        const sway = p.graphicsQuality !== 'low' && p.tile.state === 'hidden' && !p.faceUp && !p.tile.vined && !(p.tile.frost ?? 0)
            ? sampleRealmSway(ambience.realm, ambience.strength, time, phase, p.transform.baseX / 1.18, -p.transform.baseY / 1.18)
            : ZERO_REALM_OFFSET;
        const jolt = jolting ? sampleRealmJolt(realmEvent.family, joltMs, phase) : ZERO_REALM_OFFSET;
        putRealmOffset(group, addRealmOffsets(sway, jolt));
    }

    const frameVisualState = computeTileBoardFrameVisualState({
        faceUp: p.faceUp,
        graphicsQuality: p.graphicsQuality,
        hoverDomParity,
        hoverFaceUpPickable,
        isPinned: p.isPinned,
        keyboardFocused: Boolean(p.keyboardFocused),
        matchedVictoryBurst,
        pickable: p.pickable,
        reduceMotion: p.reduceMotion,
        resolvingSelection: p.resolvingSelection,
        routeReadabilityIntensity: p.traitRouteReadabilityIntensity,
        tileState: p.tile.state,
        time: clock.elapsedTime
    });
    const { hoverGoldState } = frameVisualState;
    applyTileBoardFrameVisualState({
        elapsedTime: clock.elapsedTime,
        matchedVictoryBurst,
        reduceMotion: p.reduceMotion,
        state: frameVisualState,
        targets: {
            focusGlow: { mat: bag.focusGlowMatRef.current, mesh: bag.focusGlowMeshRef.current },
            focusRimMaterial: bag.focusRimMatRef.current,
            hoverBackGlow: { mat: bag.hoverBackGlowMatRef.current, mesh: bag.hoverBackGlowMeshRef.current },
            hoverBackRimMaterials: [
                bag.hoverRimTopMatRef.current,
                bag.hoverRimBottomMatRef.current,
                bag.hoverRimRightMatRef.current,
                bag.hoverRimLeftMatRef.current
            ],
            hoverFrontGlow: { mat: bag.hoverFrontGlowMatRef.current, mesh: bag.hoverFrontGlowMeshRef.current },
            hoverFrontRimMaterials: [
                bag.hoverFrontRimTopMatRef.current,
                bag.hoverFrontRimBottomMatRef.current,
                bag.hoverFrontRimRightMatRef.current,
                bag.hoverFrontRimLeftMatRef.current
            ],
            matchedVictoryFlame: {
                mat: bag.matchedVictoryFlameMatRef.current,
                mesh: bag.matchedVictoryFlameMeshRef.current
            },
            resolvingGlow: { mat: bag.resolvingGlowMatRef.current, mesh: bag.resolvingGlowMeshRef.current },
            resolvingRimMaterial: bag.resolvingRimMatRef.current
        }
    });

    const materialResult = applyTileBoardFrameMaterialState({
        backMaterial: bag.backCardMatRef.current,
        frontMaterial: bag.frontCardMatRef.current,
        scratchColor: scratchGlowColor,
        state: {
            cardTint: {
                faceUp: p.faceUp,
                graphicsQuality: p.graphicsQuality,
                hoverDomParity,
                hoverFaceUpPickable,
                isPinned: p.isPinned,
                nonPickableBack: Boolean(p.nonPickableBack),
                presentationNBackAnchor: Boolean(p.presentationNBackAnchor),
                presentationSilhouette: Boolean(p.presentationSilhouette),
                presentationWideRecall: Boolean(p.presentationWideRecall),
                resolvingSelection: p.resolvingSelection,
                tile: p.tile
            },
            currentFocusDimBlend: bag.focusDimBlendRef.current,
            delta,
            faceUp: p.faceUp,
            focusDimmed: p.focusDimmed,
            graphicsQuality: p.graphicsQuality,
            hoverEmissiveIntensity: hoverGoldState.hoverEmissiveIntensity,
            reduceMotion: p.reduceMotion,
            resolvingSelection: p.resolvingSelection,
            tileState: p.tile.state,
            time: clock.elapsedTime
        },
        tint: scratchCardTint
    });
    bag.focusDimBlendRef.current = materialResult.focusDimBlend;

    bag.lastActivityVisualGateRef.current = {
        traitRouteReadabilityIntensity: p.traitRouteReadabilityIntensity,
        textureRevision: p.textureRevision,
        keyboardFocused: p.keyboardFocused,
        focusDimmed: p.focusDimmed,
        graphicsQuality: p.graphicsQuality,
        tileState: p.tile.state,
        faceUp: p.faceUp,
        pickable: p.pickable
    };
};
