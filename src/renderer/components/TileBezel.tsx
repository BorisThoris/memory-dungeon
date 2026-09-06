import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
    memo,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
    type RefObject
} from 'react';
import {
    PlaneGeometry,
    Vector3,
    type BufferGeometry,
    type Group,
    type Mesh,
    type MeshBasicMaterial,
    type MeshStandardMaterial,
    type ShaderMaterial
} from 'three';
import type { BoardState, GraphicsQualityPreset, HazardTileKind, Tile } from '../../shared/contracts';
import type { TraitInteractionLaneId } from '../copy/traitInteractionLaneMap';
import type { TiltVector } from '../platformTilt/platformTiltTypes';
import type { TileTraitRouteReadabilityIntensity } from './tileBoardReadability';
import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';
import { createCardArcaneGlowMaterial } from './cardArcaneGlowMaterial';
import { createMatchedCardRimFireMaterial } from './matchedCardRimFireMaterial';
import { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import { TileBoardCardSurface } from './TileBoardCardSurface';
import { SuitMarkerPlane } from './SuitMarkerPlane';
import { getBreakWaveDelaySec } from './tileBoardBreakWave';
import { TileBoardEffectOverlays } from './TileBoardEffectOverlays';
import { TileBoardHoverChrome } from './TileBoardHoverChrome';
import { TileBoardReadabilityMarkers } from './TileBoardReadabilityMarkers';
import {
    CARD_BEND_SEGMENTS,
    applyCardWearTextureAnisotropy,
    commitPersistentCardBend,
    computeCardBendSyncState,
    computeCardClickState,
    computeCardPointerDownState,
    computeCardPointerMoveState,
    computeCardPointerOutState,
    computeCardPointerUpState,
    createCardWearAssetSet,
    disposeCardWearAssetSet,
    prepareCardBendBaseGeometryState,
    resolveCardBendFaceFromHit,
    type CardBendFace
} from './tileBoardCardBend';
import {
    getArcaneGlowRoundedRectRingGeometry,
    getFocusRoundedRectRingGeometry,
    getMatchedRoundedRectRingGeometry,
    getResolvingRoundedRectRingGeometry,
    getSharedCurseRingGeometry,
    getSharedFindableCornerRingGeometry,
    getSharedFocusRingGeometry,
    getSharedResolvingCrispRingGeometry
} from './tileBoardRimGeometry';
import {
    createOrUpdateTileBezelFrameBag,
    type TileBezelFrameBag
} from './tileBoardFrameBag';
import type { TileBezelFramePropsSnapshot } from './tileBoardFramePropsSnapshot';
import { advanceTileBezelFrame } from './tileBoardFrameAdvance';
import { isTilePickable, noopMeshRaycast, pickableMeshRaycast } from './tileBoardPick';
import {
    TileBezelFrameRegistryContext,
    TilePickMeshRegistryContext
} from './tileBoardSceneRegistries';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import { getTileBoardSurfaceVariant } from './tileBoardSurfaceVariant';
import { frontRoughnessVariantForSurface, overlayVariantForSurface } from './tileBoardTextureVariant';
import { initialTileBoardCardTint } from './tileBoardInitialCardTint';
import type { TileTransform } from './tileBoardTransform';
import {
    getCardBackRasterNormalMapTexture,
    getCardFaceRasterNormalMapTexture,
    getCardFaceStaticTexture,
    getCardPanelDisplacementTexture,
    getCardPanelNormalTexture,
    getTileFaceOverlayTexture,
    getTileFaceRoughnessTexture,
    getTileFaceTexture
} from './tileTextures';
import { disposeTileBoardResources } from './tileBoardDisposables';
import {
    CARD_PLANE_HEIGHT,
    CARD_PLANE_WIDTH,
    TILE_DEPTH
} from './tileShatter';

interface TileBezelProps {
    faceUp: boolean;
    fieldAmp: number;
    tileFieldParallaxEnabled: boolean;
    fieldTiltRef: MutableRefObject<TiltVector>;
    flipLocked: boolean;
    hoverTiltRef: MutableRefObject<TileHoverTiltState>;
    interactionSuppressed: boolean;
    interactive: boolean;
    isPinned: boolean;
    onTilePick: (tileId: string) => void;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    shuffleMotionDeadlineMs: number;
    shuffleMotionBudgetMs: number;
    shuffleStaggerTileCount: number;
    shuffleBoardOrderIndex: number;
    boardEntranceMotionDeadlineMs: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceStaggerTileCount: number;
    boardRows: number;
    boardColumns: number;
    board: BoardState;
    textureRevision: number;
    tile: Tile;
    transform: TileTransform;
    graphicsQuality: GraphicsQualityPreset;
    sharedCardFrontGeometry: BufferGeometry | null;
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    memorizeCurseHighlight?: boolean;
    spotlightWardHighlight?: boolean;
    spotlightBountyHighlight?: boolean;
    focusDimmed?: boolean;
    stickyFingerSlotMark?: boolean;
    traitComboBack?: boolean;
    traitLaneBack?: TraitInteractionLaneId | null;
    perkArmedBack?: boolean;
    traitRewardHotBack?: boolean;
    traitRouteTargetBack?: boolean;
    hostConsolidatesTileFrames?: boolean;
    keyboardFocused?: boolean;
    pairProximityDistance?: number | null;
    tutorialPairOrdinal?: number | null;
    presentationWideRecall?: boolean;
    presentationSilhouette?: boolean;
    presentationNBackAnchor?: boolean;
    resolvingMatchWaveKey: string | null;
    spotlightWardOnBack?: boolean;
    spotlightBountyOnBack?: boolean;
    powerBackAccent?: 'destroy' | 'peek' | 'stray' | 'pin' | 'swap' | 'swapOrigin' | 'clump' | null;
    hazardBackAccent?: HazardTileKind | null;
    routeBackAccent?: boolean;
    traitRouteReadabilityIntensity?: TileTraitRouteReadabilityIntensity;
    selectedTraitFollowupBack?: boolean;
    objectiveBackAccent?: boolean;
    enemyOccupiedBack?: boolean;
    nonPickableBack?: boolean;
    destroyBlockedDecoyBack?: boolean;
    traitComboSurgeBack?: boolean;
}

export interface TileHoverTiltState {
    tileId: string | null;
    x: number;
    y: number;
}

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
const CARD_FACE_INSET = 0.016;
const CARD_FACE_WIDTH = CARD_WIDTH - CARD_FACE_INSET * 2;
const CARD_FACE_HEIGHT = CARD_HEIGHT - CARD_FACE_INSET * 2;
type BendSourceEvent = ThreeEvent<PointerEvent | MouseEvent>;

const scratchHitLocal = new Vector3();

const TileBezelLegacyFrameDriver = ({ bagRef }: { bagRef: RefObject<TileBezelFrameBag | null> }) => {
    useFrame((state, delta) => {
        const bag = bagRef.current;

        if (bag) {
            advanceTileBezelFrame(bag, state, delta);
        }
    });

    return null;
};

const TileBezelInner = ({
    faceUp,
    fieldAmp,
    tileFieldParallaxEnabled,
    fieldTiltRef,
    flipLocked,
    graphicsQuality,
    hoverTiltRef,
    interactionSuppressed,
    interactive,
    isPinned,
    onTilePick,
    reduceMotion,
    resolvingSelection,
    shuffleMotionDeadlineMs,
    shuffleMotionBudgetMs,
    shuffleStaggerTileCount,
    shuffleBoardOrderIndex,
    boardEntranceMotionDeadlineMs,
    boardEntranceMotionBudgetMs,
    boardEntranceStaggerTileCount,
    boardRows,
    boardColumns,
    board,
    textureRevision,
    tile,
    transform,
    sharedCardFrontGeometry,
    sharedCardBackLayers,
    memorizeCurseHighlight = false,
    spotlightWardHighlight = false,
    spotlightBountyHighlight = false,
    spotlightWardOnBack = false,
    spotlightBountyOnBack = false,
    powerBackAccent = null,
    hazardBackAccent = null,
    routeBackAccent = false,
    traitRouteReadabilityIntensity = 'none',
    selectedTraitFollowupBack = false,
    objectiveBackAccent = false,
    enemyOccupiedBack = false,
    nonPickableBack = false,
    destroyBlockedDecoyBack = false,
    focusDimmed = false,
    stickyFingerSlotMark = false,
    traitComboBack = false,
    traitComboSurgeBack = false,
    traitLaneBack = null,
    perkArmedBack = false,
    traitRewardHotBack = false,
    traitRouteTargetBack = false,
    hostConsolidatesTileFrames = true,
    keyboardFocused = false,
    pairProximityDistance = null,
    tutorialPairOrdinal = null,
    presentationWideRecall = false,
    presentationSilhouette = false,
    presentationNBackAnchor = false,
    resolvingMatchWaveKey
}: TileBezelProps) => {
    const { gl } = useThree();
    const frameRegistry = useContext(TileBezelFrameRegistryContext);
    const pickMeshRegistry = useContext(TilePickMeshRegistryContext);
    const pickSlabRef = useRef<Mesh | null>(null);
    const groupRef = useRef<Group | null>(null);
    const propsRef = useRef<TileBezelFramePropsSnapshot>({} as TileBezelFramePropsSnapshot);
    const bagRef = useRef<TileBezelFrameBag | null>(null);
    const pickable = !interactionSuppressed && isTilePickable(tile, interactive, flipLocked);

    const frontGeometry = useMemo(
        () => new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_BEND_SEGMENTS, CARD_BEND_SEGMENTS),
        []
    );
    const backGeometry = useMemo(
        () => new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_BEND_SEGMENTS, CARD_BEND_SEGMENTS),
        []
    );
    const overlayGeometry = useMemo(
        () =>
            new PlaneGeometry(
                CARD_FACE_WIDTH,
                CARD_FACE_HEIGHT,
                CARD_BEND_SEGMENTS,
                CARD_BEND_SEGMENTS
            ),
        []
    );
    const curseRingGeometry = useMemo(() => getSharedCurseRingGeometry(), []);
    const findableCornerRingGeometry = useMemo(() => getSharedFindableCornerRingGeometry(), []);
    const matchedEdgeGeometry = useMemo(() => getMatchedRoundedRectRingGeometry(), []);
    const arcaneGlowGeometry = useMemo(() => getArcaneGlowRoundedRectRingGeometry(), []);
    const resolvingInnerGeometry = useMemo(
        () =>
            graphicsQuality === 'low'
                ? getSharedResolvingCrispRingGeometry(graphicsQuality)
                : getResolvingRoundedRectRingGeometry(),
        [graphicsQuality]
    );
    const focusRingGeometry = useMemo(
        () =>
            graphicsQuality === 'low'
                ? getSharedFocusRingGeometry(graphicsQuality)
                : getFocusRoundedRectRingGeometry(),
        [graphicsQuality]
    );
    const useSvgMeshFront = sharedCardFrontGeometry != null;
    const useSvgMeshBack = sharedCardBackLayers != null;

    // Where this tile sits in the chunk-break wave, from the board alone: no event plumbing.
    const breakWaveDelaySec = useMemo(() => getBreakWaveDelaySec(board, tile), [board, tile]);
    const propsSnapshot: TileBezelFramePropsSnapshot = {
        boardColumns,
        boardEntranceMotionBudgetMs,
        boardEntranceMotionDeadlineMs,
        boardEntranceStaggerTileCount,
        boardRows,
        breakWaveDelaySec,
        enemyOccupiedBack,
        faceUp,
        fieldAmp,
        fieldTiltRef,
        flipLocked,
        focusDimmed,
        graphicsQuality,
        hazardBackAccent,
        hoverTiltRef,
        interactionSuppressed,
        interactive,
        isPinned,
        keyboardFocused,
        nonPickableBack,
        objectiveBackAccent,
        pickable,
        presentationNBackAnchor,
        presentationSilhouette,
        presentationWideRecall,
        reduceMotion,
        resolvingMatchWaveKey,
        resolvingSelection,
        routeBackAccent,
        traitRouteReadabilityIntensity,
        shuffleBoardOrderIndex,
        shuffleMotionBudgetMs,
        shuffleMotionDeadlineMs,
        shuffleStaggerTileCount,
        textureRevision,
        tile,
        tileFieldParallaxEnabled,
        transform,
        useSvgMeshBack,
        useSvgMeshFront
    };
    useLayoutEffect(() => {
        propsRef.current = propsSnapshot;
    });

    const cardPanelNormalMap = useMemo(() => getCardPanelNormalTexture(), []);
    const cardPanelDisplacementMap = useMemo(() => getCardPanelDisplacementTexture(), []);
    const frontNormalMapEffective = useMemo(() => {
        void textureRevision;
        if (useSvgMeshFront) {
            return cardPanelNormalMap;
        }
        return getCardFaceRasterNormalMapTexture() ?? cardPanelNormalMap;
    }, [useSvgMeshFront, cardPanelNormalMap, textureRevision]);
    const backNormalMapEffective = useMemo(() => {
        void textureRevision;
        void useSvgMeshBack;
        return getCardBackRasterNormalMapTexture() ?? cardPanelNormalMap;
    }, [useSvgMeshBack, cardPanelNormalMap, textureRevision]);

    const frontBaseRef = useRef<Float32Array | null>(null);
    const backBaseRef = useRef<Float32Array | null>(null);
    const overlayBaseRef = useRef<Float32Array | null>(null);

    const vertexCount = (CARD_BEND_SEGMENTS + 1) * (CARD_BEND_SEGMENTS + 1);
    const frontPersistentRef = useRef<Float32Array>(new Float32Array(vertexCount));
    const backPersistentRef = useRef<Float32Array>(new Float32Array(vertexCount));
    const overlayPersistentRef = useRef<Float32Array>(new Float32Array(vertexCount));

    const prevFaceUpRef = useRef(faceUp);
    const flipPopT0Ref = useRef<number | null>(null);
    const faceUpStructBlendRef = useRef(faceUp ? 1 : 0);
    const faceUpStructT0Ref = useRef<number | null>(null);
    const prevResolvingRef = useRef<ResolvingSelectionState | null>(null);
    const lastResolvingWaveKeyRef = useRef<string | null>(null);
    const matchPulseRef = useRef(0);
    const liftSmoothRef = useRef(0);
    const frontCardMatRef = useRef<MeshStandardMaterial | null>(null);
    const backCardMatRef = useRef<MeshStandardMaterial | null>(null);
    const focusDimBlendRef = useRef(0);

    const bendURef = useRef(0.5);
    const bendVRef = useRef(0.5);
    const bendBuildupRef = useRef(0);
    const lastBumpURef = useRef<number | null>(null);
    const lastBumpVRef = useRef<number | null>(null);
    const pressingOnCardRef = useRef(false);
    const hoverRimTopMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverRimBottomMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverRimRightMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverRimLeftMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverFrontRimTopMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverFrontRimBottomMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverFrontRimRightMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverFrontRimLeftMatRef = useRef<MeshBasicMaterial | null>(null);
    const resolvingRimMatRef = useRef<MeshBasicMaterial | null>(null);
    const focusRimMatRef = useRef<MeshBasicMaterial | null>(null);
    const hoverBackGlowMatRef = useRef<ShaderMaterial | null>(null);
    const hoverBackGlowMeshRef = useRef<Mesh | null>(null);
    const hoverFrontGlowMatRef = useRef<ShaderMaterial | null>(null);
    const hoverFrontGlowMeshRef = useRef<Mesh | null>(null);
    const resolvingGlowMatRef = useRef<ShaderMaterial | null>(null);
    const resolvingGlowMeshRef = useRef<Mesh | null>(null);
    const focusGlowMatRef = useRef<ShaderMaterial | null>(null);
    const focusGlowMeshRef = useRef<Mesh | null>(null);
    const matchedVictoryFlameMatRef = useRef<ShaderMaterial | null>(null);
    const matchedVictoryFlameMeshRef = useRef<Mesh | null>(null);
    const matchedVictoryBurstT0Ref = useRef<number | null>(null);
    const hoverBackGlowMaterial = useMemo(
        () => createCardArcaneGlowMaterial(transform.seed + 11),
        [transform.seed]
    );
    const hoverFrontGlowMaterial = useMemo(
        () => createCardArcaneGlowMaterial(transform.seed + 23),
        [transform.seed]
    );
    const resolvingGlowMaterial = useMemo(
        () => createCardArcaneGlowMaterial(transform.seed + 37),
        [transform.seed]
    );
    const focusGlowMaterial = useMemo(
        () => createCardArcaneGlowMaterial(transform.seed + 53),
        [transform.seed]
    );
    const matchedRimFireMaterial = useMemo(
        () => createMatchedCardRimFireMaterial(transform.seed),
        [transform.seed]
    );
    useEffect(() => {
        return () => {
            disposeTileBoardResources([
                hoverBackGlowMaterial,
                hoverFrontGlowMaterial,
                resolvingGlowMaterial,
                focusGlowMaterial,
                matchedRimFireMaterial
            ]);
        };
    }, [focusGlowMaterial, hoverBackGlowMaterial, hoverFrontGlowMaterial, matchedRimFireMaterial, resolvingGlowMaterial]);
    const prevTileMatchedRef = useRef(false);
    const lastActivityVisualGateRef = useRef<{
        textureRevision: number;
        keyboardFocused: boolean;
        focusDimmed: boolean;
        graphicsQuality: GraphicsQualityPreset;
    } | null>(null);

    useLayoutEffect(() => {
        bagRef.current = createOrUpdateTileBezelFrameBag(bagRef.current, {
            groupRef,
            propsRef,
            planeGeometries: { front: frontGeometry, back: backGeometry, overlay: overlayGeometry },
            frontBaseRef,
            backBaseRef,
            overlayBaseRef,
            frontPersistentRef,
            backPersistentRef,
            overlayPersistentRef,
            prevFaceUpRef,
            flipPopT0Ref,
            faceUpStructBlendRef,
            faceUpStructT0Ref,
            prevResolvingRef,
            lastResolvingWaveKeyRef,
            matchPulseRef,
            liftSmoothRef,
            frontCardMatRef,
            backCardMatRef,
            focusDimBlendRef,
            bendURef,
            bendVRef,
            bendBuildupRef,
            lastBumpURef,
            lastBumpVRef,
            pressingOnCardRef,
            hoverRimTopMatRef,
            hoverRimBottomMatRef,
            hoverRimRightMatRef,
            hoverRimLeftMatRef,
            hoverFrontRimTopMatRef,
            hoverFrontRimBottomMatRef,
            hoverFrontRimRightMatRef,
            hoverFrontRimLeftMatRef,
            resolvingRimMatRef,
            focusRimMatRef,
            hoverBackGlowMatRef,
            hoverBackGlowMeshRef,
            hoverFrontGlowMatRef,
            hoverFrontGlowMeshRef,
            resolvingGlowMatRef,
            resolvingGlowMeshRef,
            focusGlowMatRef,
            focusGlowMeshRef,
            matchedVictoryFlameMatRef,
            matchedVictoryFlameMeshRef,
            matchedVictoryBurstT0Ref,
            prevTileMatchedRef,
            lastActivityVisualGateRef
        });

        if (!frameRegistry || !hostConsolidatesTileFrames) {
            return undefined;
        }

        frameRegistry.register(tile.id, bagRef.current);

        return () => {
            frameRegistry.unregister(tile.id);
        };
    }, [backGeometry, frameRegistry, frontGeometry, hostConsolidatesTileFrames, overlayGeometry, tile.id]);

    const [wearAssets] = useState(() => createCardWearAssetSet());

    useLayoutEffect(() => {
        const bendBaseState = prepareCardBendBaseGeometryState({
            backGeometry,
            frontGeometry,
            overlayGeometry
        });
        frontBaseRef.current = bendBaseState.frontBase;
        backBaseRef.current = bendBaseState.backBase;
        overlayBaseRef.current = bendBaseState.overlayBase;
    }, [backGeometry, frontGeometry, overlayGeometry]);

    useLayoutEffect(() => {
        const cap = Math.min(8, gl.capabilities.getMaxAnisotropy());
        applyCardWearTextureAnisotropy(wearAssets, cap);
    }, [gl, wearAssets]);

    useEffect(() => {
        return () => {
            disposeCardWearAssetSet(wearAssets);
        };
    }, [wearAssets]);

    const commitPersistentBend = (): void => {
        if (reduceMotion) {
            return;
        }

        const frontBase = frontBaseRef.current;
        const backBase = backBaseRef.current;
        const overlayBase = overlayBaseRef.current;

        if (!frontBase || !backBase || !overlayBase) {
            return;
        }

        const bu = bendURef.current;
        const bv = bendVRef.current;
        const depthScale = 1 + bendBuildupRef.current * 0.52;
        const bendOverlay = getTileBoardSurfaceVariant(tile, faceUp, resolvingSelection) !== 'hidden';

        commitPersistentCardBend({
            back: {
                base: backBase,
                persistent: backPersistentRef.current
            },
            bendOverlay,
            bendU: bu,
            bendV: bv,
            cardHeight: CARD_HEIGHT,
            cardWidth: CARD_WIDTH,
            depthScale,
            front: {
                base: frontBase,
                persistent: frontPersistentRef.current
            },
            overlay: {
                base: overlayBase,
                persistent: overlayPersistentRef.current
            },
            useSvgMeshBack,
            useSvgMeshFront,
            wear: wearAssets
        });
    };

    const resolveBendFaceFromHit = (event: BendSourceEvent): CardBendFace | null => {
        scratchHitLocal.copy(event.point);
        event.object.worldToLocal(scratchHitLocal);
        return resolveCardBendFaceFromHit({
            faceNormalZ: event.face?.normal.z,
            halfDepth: TILE_DEPTH * 0.5,
            localZ: scratchHitLocal.z
        });
    };

    const syncBendFromPointerEvent = (event: BendSourceEvent, bumpRepeat: boolean): void => {
        const native = event.nativeEvent;
        const face = resolveBendFaceFromHit(event);
        const syncState = computeCardBendSyncState({
            bumpRepeat,
            currentBuildup: bendBuildupRef.current,
            eventType: event.type,
            face,
            lastBumpU: lastBumpURef.current,
            lastBumpV: lastBumpVRef.current,
            pickable,
            pointerButtons: native instanceof PointerEvent ? native.buttons : null,
            pointerType: native instanceof PointerEvent ? native.pointerType : null,
            reduceMotion,
            uv: event.uv
        });

        if (!syncState) {
            return;
        }

        bendURef.current = syncState.bendU;
        bendVRef.current = syncState.bendV;
        bendBuildupRef.current = syncState.buildup;
        lastBumpURef.current = syncState.lastBumpU;
        lastBumpVRef.current = syncState.lastBumpV;
    };

    const handleCardPointerUp = (event: ThreeEvent<PointerEvent>): void => {
        const pointerUpState = computeCardPointerUpState({
            button: event.button,
            pickable,
            pointerType: event.pointerType,
            pressingOnCard: pressingOnCardRef.current,
            reduceMotion
        });

        if (pointerUpState.syncBend) {
            syncBendFromPointerEvent(event, false);
        }

        if (pointerUpState.commitBend) {
            commitPersistentBend();
        }

        pressingOnCardRef.current = pointerUpState.pressingOnCard;
        event.stopPropagation();

        if (!pointerUpState.pickTile) {
            return;
        }

        onTilePick(tile.id);
    };

    const handleCardPointerDown = (event: ThreeEvent<PointerEvent>): void => {
        const pointerDownState = computeCardPointerDownState();

        event.stopPropagation();
        pressingOnCardRef.current = pointerDownState.pressingOnCard;

        if (pointerDownState.syncBend) {
            syncBendFromPointerEvent(event, true);
        }
    };

    const handleCardClick = (event: ThreeEvent<MouseEvent>): void => {
        const clickState = computeCardClickState({ pickable, reduceMotion });

        event.stopPropagation();

        if (!clickState.syncBend) {
            return;
        }

        syncBendFromPointerEvent(event, false);
    };

    const handleCardPointerMove = (event: ThreeEvent<PointerEvent>): void => {
        const pointerMoveState = computeCardPointerMoveState({
            current: hoverTiltRef.current,
            pointerType: event.nativeEvent.pointerType,
            reduceMotion,
            tileId: tile.id,
            uv: event.uv
        });

        if (pointerMoveState.syncBend) {
            syncBendFromPointerEvent(event, false);
        }

        hoverTiltRef.current = pointerMoveState.hoverTilt;
    };

    const handleCardPointerOut = (): void => {
        const pointerOutState = computeCardPointerOutState({
            hoverTilt: hoverTiltRef.current,
            pickable,
            pressingOnCard: pressingOnCardRef.current,
            reduceMotion,
            tileId: tile.id
        });

        if (pointerOutState.commitBend) {
            commitPersistentBend();
        }

        pressingOnCardRef.current = pointerOutState.pressingOnCard;
        hoverTiltRef.current = pointerOutState.hoverTilt;
    };

    const surfaceVariant = getTileBoardSurfaceVariant(tile, faceUp, resolvingSelection);
    const frontRoughnessMap = useMemo(() => {
        void textureRevision;
        return getTileFaceRoughnessTexture(tile, 'front', frontRoughnessVariantForSurface(surfaceVariant), 'panel');
    }, [surfaceVariant, textureRevision, tile]);
    const backRoughnessMap = useMemo(() => {
        void textureRevision;
        return getTileFaceRoughnessTexture(tile, 'back', 'hidden', 'panel');
    }, [textureRevision, tile]);
        const cardTint = initialTileBoardCardTint({ faceUp, isPinned, resolvingSelection, tile });
    const cardBackArtTexture = useSvgMeshBack ? null : getTileFaceTexture(tile, 'back', 'hidden', 'panel');
    const cardFrontArtTexture = useSvgMeshFront ? null : getCardFaceStaticTexture();
    const overlayVariant = overlayVariantForSurface(surfaceVariant);
    const overlayTexture =
        overlayVariant === null ? null : getTileFaceOverlayTexture(tile, overlayVariant, graphicsQuality);
    const forceTextureRefreshKey = textureRevision;

    useLayoutEffect(() => {
        if (!pickMeshRegistry) {
            return;
        }

        const mesh = pickSlabRef.current;

        if (mesh) {
            pickMeshRegistry.register(tile.id, mesh);
        }

        return () => {
            pickMeshRegistry.unregister(tile.id);
        };
    }, [forceTextureRefreshKey, pickMeshRegistry, tile.id]);

    const halfDepth = TILE_DEPTH * 0.5;
    const faceZ = halfDepth + 0.0004;
    const overlayZ = halfDepth + 0.004;
    const renderQuality = gameplayRenderQualityProfile(graphicsQuality);

    return (
        <>
            {!hostConsolidatesTileFrames ? <TileBezelLegacyFrameDriver bagRef={bagRef} /> : null}
            <group ref={groupRef}>
                <group scale={[transform.bezelScale, transform.bezelScale, transform.bezelScale]}>
                    <mesh
                        ref={pickSlabRef}
                        key={`card-pick-${tile.id}-${forceTextureRefreshKey}`}
                        onClick={handleCardClick}
                        onPointerDown={handleCardPointerDown}
                        onPointerMove={handleCardPointerMove}
                        onPointerOut={handleCardPointerOut}
                        onPointerUp={handleCardPointerUp}
                        raycast={pickable ? pickableMeshRaycast : noopMeshRaycast}
                        userData={{ tileId: tile.id }}
                    >
                        <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, TILE_DEPTH]} />
                        <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
                    </mesh>
                    <TileBoardCardSurface
                        backCardMatRef={backCardMatRef}
                        backGeometry={backGeometry}
                        backNormalMap={backNormalMapEffective}
                        backRoughnessMap={backRoughnessMap}
                        cardBackArtTexture={cardBackArtTexture}
                        cardFrontArtTexture={cardFrontArtTexture}
                        cardPanelDisplacementMap={cardPanelDisplacementMap}
                        cardTint={cardTint}
                        faceZ={faceZ}
                        frontCardMatRef={frontCardMatRef}
                        frontGeometry={frontGeometry}
                        frontNormalMap={frontNormalMapEffective}
                        frontRoughnessMap={frontRoughnessMap}
                        reduceMotion={reduceMotion}
                        renderQuality={renderQuality}
                        seed={transform.seed}
                        sharedCardBackLayers={sharedCardBackLayers}
                        sharedCardFrontGeometry={sharedCardFrontGeometry}
                        tutorialPairOrdinal={tutorialPairOrdinal}
                        useSvgMeshBack={useSvgMeshBack}
                        useSvgMeshFront={useSvgMeshFront}
                        wearAssets={wearAssets}
                    />
                    {tile.suit ? <SuitMarkerPlane faceZ={faceZ} suit={tile.suit} /> : null}
                    <TileBoardHoverChrome
                        arcaneGlowGeometry={arcaneGlowGeometry}
                        face="back"
                        faceZ={faceZ}
                        glowMaterial={hoverBackGlowMaterial}
                        glowMaterialRef={hoverBackGlowMatRef}
                        glowMeshRef={hoverBackGlowMeshRef}
                        rimBottomMatRef={hoverRimBottomMatRef}
                        rimLeftMatRef={hoverRimLeftMatRef}
                        rimRightMatRef={hoverRimRightMatRef}
                        rimTopMatRef={hoverRimTopMatRef}
                    />
                    <TileBoardReadabilityMarkers
                        destroyBlockedDecoyBack={destroyBlockedDecoyBack}
                        enemyOccupiedBack={enemyOccupiedBack}
                        faceUp={faceUp}
                        faceZ={faceZ}
                        findableCornerRingGeometry={findableCornerRingGeometry}
                        hazardBackAccent={hazardBackAccent}
                        matchedEdgeGeometry={matchedEdgeGeometry}
                        nonPickableBack={nonPickableBack}
                        objectiveBackAccent={objectiveBackAccent}
                        perkArmedBack={perkArmedBack}
                        powerBackAccent={powerBackAccent}
                        routeBackAccent={routeBackAccent}
                        selectedTraitFollowupBack={selectedTraitFollowupBack}
                        spotlightBountyOnBack={spotlightBountyOnBack}
                        spotlightWardOnBack={spotlightWardOnBack}
                        stickyFingerSlotMark={stickyFingerSlotMark}
                        board={board}
                        tile={tile}
                        traitComboBack={traitComboBack}
                        traitComboSurgeBack={traitComboSurgeBack}
                        traitLaneBack={traitLaneBack}
                        traitRewardHotBack={traitRewardHotBack}
                        traitRouteTargetBack={traitRouteTargetBack}
                    />
                    <TileBoardHoverChrome
                        arcaneGlowGeometry={arcaneGlowGeometry}
                        face="front"
                        faceZ={faceZ}
                        glowMaterial={hoverFrontGlowMaterial}
                        glowMaterialRef={hoverFrontGlowMatRef}
                        glowMeshRef={hoverFrontGlowMeshRef}
                        rimBottomMatRef={hoverFrontRimBottomMatRef}
                        rimLeftMatRef={hoverFrontRimLeftMatRef}
                        rimRightMatRef={hoverFrontRimRightMatRef}
                        rimTopMatRef={hoverFrontRimTopMatRef}
                    />
                    <TileBoardEffectOverlays
                        arcaneGlowGeometry={arcaneGlowGeometry}
                        curseRingGeometry={curseRingGeometry}
                        faceZ={faceZ}
                        findableCornerRingGeometry={findableCornerRingGeometry}
                        focusGlowMatRef={focusGlowMatRef}
                        focusGlowMaterial={focusGlowMaterial}
                        focusGlowMeshRef={focusGlowMeshRef}
                        focusRimMatRef={focusRimMatRef}
                        focusRingGeometry={focusRingGeometry}
                        graphicsQuality={graphicsQuality}
                        matchedEdgeGeometry={matchedEdgeGeometry}
                        matchedRimFireMaterial={matchedRimFireMaterial}
                        matchedVictoryFlameMatRef={matchedVictoryFlameMatRef}
                        matchedVictoryFlameMeshRef={matchedVictoryFlameMeshRef}
                        memorizeCurseHighlight={memorizeCurseHighlight}
                        overlayGeometry={overlayGeometry}
                        overlayTexture={overlayTexture}
                        overlayZ={overlayZ}
                        pairProximityDistance={pairProximityDistance}
                        resolvingGlowMatRef={resolvingGlowMatRef}
                        resolvingGlowMaterial={resolvingGlowMaterial}
                        resolvingGlowMeshRef={resolvingGlowMeshRef}
                        resolvingInnerGeometry={resolvingInnerGeometry}
                        resolvingRimMatRef={resolvingRimMatRef}
                        spotlightBountyHighlight={spotlightBountyHighlight}
                        spotlightWardHighlight={spotlightWardHighlight}
                        stickyFingerSlotMark={stickyFingerSlotMark}
                        surfaceVariant={surfaceVariant}
                        tile={tile}
                    />
                </group>
            </group>
        </>
    );
};

TileBezelInner.displayName = 'TileBezel';

export const TileBezel = memo(TileBezelInner);
