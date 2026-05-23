import { useFrame, useThree, type RootState, type ThreeEvent } from '@react-three/fiber';
import {
    createContext,
    forwardRef,
    memo,
    useContext,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
    type RefObject
} from 'react';
import {
    Box3,
    CanvasTexture,
    CircleGeometry,
    Color,
    DoubleSide,
    LinearFilter,
    MathUtils,
    MultiplyBlending,
    PlaneGeometry,
    Raycaster,
    SRGBColorSpace,
    Vector2,
    Vector3,
    type BufferAttribute,
    type BufferGeometry,
    type Group,
    type Mesh,
    type MeshBasicMaterial,
    type MeshStandardMaterial,
    type ShaderMaterial,
    type Texture
} from 'three';
import type { BoardState, EnemyHazardState, GraphicsQualityPreset, HazardTileKind, RunStatus, Tile } from '../../shared/contracts';
import { WILD_PAIR_KEY } from '../../shared/tile-identity';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';
import { getBoardAnisotropyCap } from '../../shared/graphicsQuality';
import { preloadCardRankOpentypeFont, subscribeCardRankFontLoaded } from '../cardFace/opentypeCardRankFont';
import {
    applyAnisotropyToCachedTileTextures,
    setTileTextureSamplingQuality,
    getCardBackRasterNormalMapTexture,
    getCardFaceRasterNormalMapTexture,
    getCardFaceStaticTexture,
    getCardPanelDisplacementTexture,
    getCardPanelNormalTexture,
    getTileFaceRoughnessTexture,
    getTileFaceTexture,
    getTileFaceOverlayTexture,
    runDemandDrivenTileFaceOverlayPrewarmSession,
    subscribeTextureImageUpdates,
    type FaceVariant
} from './tileTextures';
import {
    BOARD_LAYOUT_JITTER_XY,
    BOARD_LAYOUT_JITTER_Z,
    BOARD_LAYOUT_ROW_STAGGER_X,
    BOARD_LAYOUT_YAW_MAX,
    CARD_PLANE_HEIGHT,
    CARD_PLANE_WIDTH,
    CORE_SCALE,
    SHELL_SCALE,
    TILE_DEPTH,
    TILE_SPACING
} from './tileShatter';
import type { TiltVector } from '../platformTilt/platformTiltTypes';
import { RENDERER_THEME } from '../styles/theme';
import {
    boardWebglPerfSampleAccumulatePhases,
    boardWebglPerfSampleEnabled,
    boardWebglPerfSampleVerboseEnabled
} from '../dev/boardWebglPerfSample';
import { readTileStepLegacy } from '../dev/legacy/tileStepLegacy';
import { getTileFieldAmplification, shouldApplyTileFieldParallax } from './tileFieldTilt';
import { shouldAdvanceTileBezelThisFrame } from './tileFrameActivity';
import { isTilePickable, noopMeshRaycast, pickableMeshRaycast } from './tileBoardPick';
import { PairProximityHintPlane } from './PairProximityHintPlane';
import { TutorialPairMarkerPlane } from './TutorialPairMarkerPlane';
import {
    getResolvingMatchWaveKey,
    getResolvingSelectionState,
    type ResolvingSelectionState
} from './tileResolvingSelection';
import cardBackSvgUrl from '../assets/textures/cards/authored-card-back.svg?url';
import cardFrontSvgUrl from '../assets/textures/cards/front.svg?url';
import {
    loadSharedCardBackSvgLayerGeometries,
    loadSharedCardSvgPlaneGeometry,
    type CardBackSvgLayerGeometry,
    type CardBackSvgLayerName
} from './cardSvgPlaneGeometry';
import { createRafCoalescedViewportNotifier, type TileBoardViewportState } from './tileBoardViewport';
import {
    computeBoardEntranceMotionTransform,
    computeShuffleMotionTransform
} from './shuffleFlipAnimation';
import {
    getFocusRoundedRectRingGeometry,
    getArcaneGlowRoundedRectRingGeometry,
    getMatchedRoundedRectRingGeometry,
    getResolvingRoundedRectRingGeometry,
    getSharedCurseRingGeometry,
    getSharedFindableCornerRingGeometry,
    getSharedFocusRingGeometry,
    getSharedResolvingCrispRingGeometry
} from './tileBoardRimGeometry';
import { clampMatchedCardRimFireDriverUniforms, createMatchedCardRimFireMaterial } from './matchedCardRimFireMaterial';
import { clampCardArcaneGlowDriverUniforms, createCardArcaneGlowMaterial } from './cardArcaneGlowMaterial';
import { clampBoardRuneFieldDriverUniforms, createBoardRuneFieldMaterial } from './boardRuneFieldMaterial';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import {
    DUNGEON_BOARD_STAGE_LAYER_POLICY,
    getDungeonBoardStageLod,
    getDungeonEnemyMarkerAnchor,
    getDungeonEnemyMarkerVisualProfile,
    type DungeonEnemyMarkerShape
} from './tileBoardStageLayers';

/** FX-006 / HOVER_DOM_WEBGL_TOKENS: border emphasis → warm tint lerp (~20% toward `#fff0d4` in sRGB mix space). */
const HOVER_RIM_TINT = new Color('#fff0d4');
const HOVER_RIM_TINT_LERP = 0.2;
/** Glass decoy pair key — keep in sync with `game.ts`. */
const DECOY_PAIR_KEY = '__decoy__';

const EMPTY_TILE_IDS: ReadonlySet<string> = new Set();
/** Emissive base (theme `goldBright`); intensity scaled by graphics quality when DOM-hover-parity applies. */
const HOVER_GOLD_EMISSIVE = new Color('#f2d39d');
/** Matched face tint on `low` only (no ember-rim shader); medium+ relies on the edge effect + neutral card albedo. */
const MATCH_FACE_GLOW = new Color('#b8f0d0');
const MATCH_VICTORY_EMISSIVE = new Color('#4fdc78');
const MISMATCH_EMISSIVE = new Color(RENDERER_THEME.colors.emberSoft);
/** CARD-018: warm pin read blended on top of resolving face tints. */
const PIN_STACK_TINT = new Color('#d4b870');
/** `n_back_anchor` presentation mutator — forward-read cyan (matches theme `cyanBright`). */
const PRESENTATION_N_BACK_TINT = new Color(RENDERER_THEME.colors.cyanBright);
/** `wide_recall` — cooler, slightly desaturated face during play. */
const PRESENTATION_WIDE_RECALL_TINT = new Color('#c5c0d8');
const scratchCardTint = new Color();
const scratchGlowColor = new Color();

const getHoverGoldQualityScales = (
    quality: GraphicsQualityPreset
): { emissiveIntensity: number; rimOpacity: number } => {
    return GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales[quality];
};

/** TBF-008: face-up pickable hover strips vs hidden-back parity (`getHoverGoldQualityScales.rimOpacity`). */
const getFaceUpHoverRimOpacityMul = (quality: GraphicsQualityPreset): number => {
    return GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul[quality];
};

type MatchedEdgeEffectTier =
    (typeof GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers)[keyof typeof GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers];

const getMatchedEdgeEffectTier = (
    quality: GraphicsQualityPreset,
    reduceMotion: boolean
): MatchedEdgeEffectTier => {
    const tiers = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers;
    if (reduceMotion) {
        return tiers.reduceMotion;
    }
    return quality === 'high' ? tiers.high : tiers.medium;
};

interface TileBoardSceneProps {
    board: BoardState;
    boardViewport: TileBoardViewportState;
    compact: boolean;
    debugPeekActive: boolean;
    fieldTiltRef: MutableRefObject<TiltVector>;
    hoverTiltRef: MutableRefObject<TileHoverTiltState>;
    interactionSuppressed: boolean;
    interactive: boolean;
    onTilePick: (tileId: string) => void;
    onViewportMetricsChange: (viewport: { width: number; height: number }) => void;
    pinnedTileIds: string[];
    previewActive: boolean;
    reduceMotion: boolean;
    /** From `usePlatformTiltField` / `useParallaxMotionSuppressed` — must gate field parallax with `shouldApplyTileFieldParallax`. */
    motionParallaxSuppressed: boolean;
    runStatus: RunStatus;
    peekRevealedTileIds?: string[];
    cursedPairKey?: string | null;
    wardPairKey?: string | null;
    bountyPairKey?: string | null;
    /** Wall-clock ms; while `now < deadline`, tile groups ease XY toward layout targets (shuffle). */
    shuffleMotionDeadlineMs: number;
    /** Motion budget that produced `shuffleMotionDeadlineMs` (FX-013 staggered deal-Z). */
    shuffleMotionBudgetMs: number;
    /** Tile count used for `computeShuffleMotionBudgetMs` when shuffle started (reading-order stagger). */
    shuffleStaggerTileCount: number;
    /** New-board deal-in window (exclusive with shuffle XY motion — shuffle wins). */
    boardEntranceMotionDeadlineMs: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceStaggerTileCount: number;
    /** Hidden tiles to de-emphasize when focus-assist is on (matches 2D `.tileFocusDim`). */
    dimmedTileIds?: ReadonlySet<string>;
    /** When true with two flips, allow picking a third tile (gambit) instead of locking hidden tiles. */
    allowGambitThirdFlip?: boolean;
    /** PERF-007: caps texture anisotropy vs device max. */
    graphicsQuality?: GraphicsQualityPreset;
    /** Keyboard focus ring target — only set while the board application region is actually focused (see `TileBoard`; WebGL canvas is `aria-hidden`, SR uses the app region + live region). */
    focusedTileId?: string | null;
    /** Manhattan distance-to-pair badge on flipped tiles (assist). */
    pairProximityHintsEnabled?: boolean;
    /** Early floors: show pair-index badge on hidden backs (matches DOM tutorial chrome). */
    showTutorialPairMarkers?: boolean;
    /** Presentation mutators: match `GameScreen` / `TileBoard` props (forwarded for WebGL parity). */
    wideRecallInPlay?: boolean;
    silhouetteDuringPlay?: boolean;
    nBackAnchorPairKey?: string | null;
    nBackMutatorActive?: boolean;
    shiftingSpotlightActive?: boolean;
    destroyPowerVisualActive?: boolean;
    destroyEligibleTileIds?: ReadonlySet<string>;
    peekPowerVisualActive?: boolean;
    peekEligibleTileIds?: ReadonlySet<string>;
    strayPowerVisualActive?: boolean;
    strayEligibleTileIds?: ReadonlySet<string>;
    pinModeBoardHintActive?: boolean;
    /** `sticky_fingers`: tile id at `stickyBlockIndex` while the next opening flip is restricted. */
    stickyBlockedTileId?: string | null;
}

interface TileBezelProps {
    faceUp: boolean;
    fieldAmp: number;
    /** False when reduced-motion or platform parallax is suppressed — field tilt contribution must be zero. */
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
    textureRevision: number;
    tile: Tile;
    transform: TileTransform;
    /** PERF-007 + FX-006: scales hover emissive / rim strip opacity. */
    graphicsQuality: GraphicsQualityPreset;
    /** Merged SVG mesh at card plane size; when set, replaces front texture and front-plane bend/wear. */
    sharedCardFrontGeometry: BufferGeometry | null;
    /** Layered SVG meshes for hidden side; when set, replace back texture and animate authored SVG layers. */
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    memorizeCurseHighlight?: boolean;
    spotlightWardHighlight?: boolean;
    spotlightBountyHighlight?: boolean;
    /** Dims card materials when focus-assist targets this hidden tile (not when peek shows face). */
    focusDimmed?: boolean;
    /** Sticky fingers — highlight slot that cannot open the next pair (matched opener or hidden back). */
    stickyFingerSlotMark?: boolean;
    /**
     * When true (default), tile motion is stepped from `TileBoardScene`’s consolidated `useFrame`.
     * When false (dev `tileStepLegacy`), this tile registers its own `useFrame` for A/B comparison.
     */
    hostConsolidatesTileFrames?: boolean;
    /** Keyboard focus from canvas application (arrow keys). */
    keyboardFocused?: boolean;
    /** Grid steps to nearest legal pair partner; only when flipped + setting on. */
    pairProximityDistance?: number | null;
    /** Pair ordinal for tutorial badge on hidden back; null = none. */
    tutorialPairOrdinal?: number | null;
    /** `wide_recall` — cooler, lower-contrast face tint while flipped in play. */
    presentationWideRecall?: boolean;
    /** `silhouette_twist` — darker face read during play. */
    presentationSilhouette?: boolean;
    /** `n_back_anchor` — anchor pair tiles get a cyan forward read. */
    presentationNBackAnchor?: boolean;
    resolvingMatchWaveKey: string | null;
    spotlightWardOnBack?: boolean;
    spotlightBountyOnBack?: boolean;
    powerBackAccent?: 'destroy' | 'peek' | 'stray' | 'pin' | null;
    hazardBackAccent?: HazardTileKind | null;
    routeBackAccent?: boolean;
    objectiveBackAccent?: boolean;
    nonPickableBack?: boolean;
    destroyBlockedDecoyBack?: boolean;
}

export interface TileHoverTiltState {
    tileId: string | null;
    x: number;
    y: number;
}

export interface TileBoardSceneHandle {
    getTileClientRectById: (
        tileId: string
    ) => { bottom: number; height: number; left: number; right: number; top: number; width: number } | null;
    pickTileAtClientPoint: (clientX: number, clientY: number) => boolean;
}

interface TileTransform {
    baseX: number;
    baseY: number;
    baseScale: number;
    bezelScale: number;
    panelScale: number;
    imperfectionRotationX: number;
    imperfectionRotationZ: number;
    imperfectionX: number;
    imperfectionY: number;
    /** Face flip: 0 face-up, PI face-down (hidden back). */
    flipRotationY: number;
    layoutJitterX: number;
    layoutJitterY: number;
    layoutJitterZ: number;
    layoutYaw: number;
    seed: number;
}

interface EnemyHazardMarkerProps {
    hazard: EnemyHazardState;
    currentTransform: TileTransform;
    graphicsQuality: GraphicsQualityPreset;
    nextTransform: TileTransform | null;
    reduceMotion: boolean;
}

const enemyHazardColor = (hazard: EnemyHazardState): string => {
    if (hazard.bossId) return '#ffcf66';
    if (hazard.kind === 'stalker') return '#9cb7ff';
    if (hazard.kind === 'warden') return '#f2d39d';
    if (hazard.kind === 'observer') return '#87d8ee';
    return '#ff9f86';
};

const hazardTileColor = (kind: HazardTileKind): string =>
    kind === 'cascade_cache'
        ? '#5ee0c8'
        : kind === 'mirror_decoy'
          ? '#b99cff'
          : kind === 'fragile_cache'
            ? '#ffcf66'
            : kind === 'toll_cache'
              ? '#7bd88f'
            : '#ff9f86';

const enemyHazardGeometryForShape = (shape: DungeonEnemyMarkerShape): BufferGeometry => {
    if (shape === 'stalker-spear') return ENEMY_STALKER_MARKER_GEOMETRY;
    if (shape === 'warden-shield') return ENEMY_WARDEN_MARKER_GEOMETRY;
    if (shape === 'observer-eye') return ENEMY_OBSERVER_MARKER_GEOMETRY;
    if (shape === 'boss-crown') return ENEMY_BOSS_MARKER_GEOMETRY;
    return ENEMY_MARKER_GEOMETRY;
};

const EnemyHazardMarker = ({ hazard, currentTransform, graphicsQuality, nextTransform, reduceMotion }: EnemyHazardMarkerProps) => {
    const groupRef = useRef<Group | null>(null);
    const color = enemyHazardColor(hazard);
    const lod = getDungeonBoardStageLod(graphicsQuality, reduceMotion);
    const visual = getDungeonEnemyMarkerVisualProfile(hazard, graphicsQuality, reduceMotion);
    const geometry = enemyHazardGeometryForShape(visual.shape);
    const healthRatio = hazard.maxHp > 0 ? MathUtils.clamp(hazard.hp / hazard.maxHp, 0, 1) : 0;
    const scale = (hazard.bossId ? 1.35 : 1) * (0.82 + healthRatio * 0.18);

    useLayoutEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        group.position.set(...getDungeonEnemyMarkerAnchor(currentTransform, 'currentThreat'));
        group.scale.setScalar(scale);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- first render seeds the animated marker at its current tile

    useFrame((state, delta) => {
        const group = groupRef.current;
        if (!group) return;
        const bob =
            lod.markerMotionEnabled && visual.motionHz > 0
                ? Math.sin(state.clock.elapsedTime * (1.6 + visual.motionHz) + currentTransform.seed * 0.017) * 0.025
                : 0;
        const [x, y, baseZ] = getDungeonEnemyMarkerAnchor(currentTransform, 'currentThreat', bob);
        const z = baseZ + (hazard.state === 'revealed' ? 0.035 : 0);
        if (!lod.markerMotionEnabled) {
            group.position.set(x, y, z);
        } else {
            group.position.x = MathUtils.damp(group.position.x, x, 8.5, delta);
            group.position.y = MathUtils.damp(group.position.y, y, 8.5, delta);
            group.position.z = MathUtils.damp(group.position.z, z, 9.5, delta);
            group.rotation.z += delta * (hazard.bossId ? 0.7 : 1.05);
        }
        group.scale.setScalar(scale);
    });

    return (
        <>
            {nextTransform ? (
                <mesh
                    geometry={hazard.bossId ? ENEMY_NEXT_BOSS_MARKER_GEOMETRY : ENEMY_NEXT_MARKER_GEOMETRY}
                    position={getDungeonEnemyMarkerAnchor(nextTransform, 'nextThreatTelegraph')}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.nextThreatTelegraph.renderOrder}
                    rotation={[0, 0, Math.PI / 4]}
                    scale={hazard.bossId ? 1.12 : 0.9}
                >
                    <meshBasicMaterial
                        color={color}
                        depthWrite={false}
                        opacity={lod.nextTelegraphOpacity}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ) : null}
            <group ref={groupRef}>
                <mesh geometry={geometry} renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder} rotation={[0, 0, visual.mainRotation]} scale={visual.mainScale}>
                    <meshBasicMaterial color={color} depthWrite={false} opacity={lod.currentMarkerOpacity} toneMapped={false} transparent />
                </mesh>
                <mesh
                    geometry={hazard.bossId ? ENEMY_BOSS_HALO_GEOMETRY : ENEMY_MARKER_GEOMETRY}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                    rotation={[0, 0, Math.PI / 4]}
                    scale={1.42}
                >
                    <meshBasicMaterial color={color} depthWrite={false} opacity={visual.haloOpacity} toneMapped={false} transparent />
                </mesh>
                {visual.shape === 'observer-eye' ? (
                    <mesh
                        geometry={ENEMY_OBSERVER_MARKER_GEOMETRY}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                        rotation={[0, 0, 0]}
                        scale={[1.34, 0.5, 1]}
                    >
                        <meshBasicMaterial color="#fff8d8" depthWrite={false} opacity={visual.secondaryOpacity} toneMapped={false} transparent />
                    </mesh>
                ) : null}
                {visual.shape === 'boss-crown' ? (
                    <mesh
                        geometry={ENEMY_BOSS_CROWN_GEOMETRY}
                        position={[0, 0.115, 0.001]}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                    >
                        <meshBasicMaterial color="#fff8d8" depthWrite={false} opacity={visual.secondaryOpacity} toneMapped={false} transparent />
                    </mesh>
                ) : null}
            </group>
        </>
    );
};

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
const CARD_FACE_INSET = 0.016;
const CARD_FACE_WIDTH = CARD_WIDTH - CARD_FACE_INSET * 2;
const CARD_FACE_HEIGHT = CARD_HEIGHT - CARD_FACE_INSET * 2;
const ENEMY_MARKER_GEOMETRY = new PlaneGeometry(0.22, 0.22, 1, 1);
const ENEMY_STALKER_MARKER_GEOMETRY = new PlaneGeometry(0.14, 0.28, 1, 1);
const ENEMY_WARDEN_MARKER_GEOMETRY = new PlaneGeometry(0.28, 0.18, 1, 1);
const ENEMY_OBSERVER_MARKER_GEOMETRY = new PlaneGeometry(0.3, 0.08, 1, 1);
const ENEMY_BOSS_MARKER_GEOMETRY = new CircleGeometry(0.16, 32);
const ENEMY_BOSS_HALO_GEOMETRY = new CircleGeometry(0.2, 32);
const ENEMY_BOSS_CROWN_GEOMETRY = new CircleGeometry(0.055, 16);
const ENEMY_NEXT_MARKER_GEOMETRY = new PlaneGeometry(0.32, 0.32, 1, 1);
const ENEMY_NEXT_BOSS_MARKER_GEOMETRY = new CircleGeometry(0.18, 32);

/** FX-006: thin quads approximating DOM `0 0 0 2px` gold ring on the visible back face while hidden. */
const HOVER_GOLD_RIM_STRIP = 0.0036;
const hoverGoldRimGeomH = new PlaneGeometry(CARD_WIDTH, HOVER_GOLD_RIM_STRIP, 1, 1);
const hoverGoldRimGeomV = new PlaneGeometry(HOVER_GOLD_RIM_STRIP, CARD_HEIGHT, 1, 1);

/**
 * Segments per card face: bend deformation + enough tessellation for
 * `displacementMap` (real height — needs dense grid or ridges look blocky).
 */
const CARD_BEND_SEGMENTS = 48;
/** World units: height map × scale + bias displaces vertices along normals (see `getCardPanelDisplacementTexture`). */
/** Keep wear multiply layer above peak displacement (front/back). */
const CARD_WEAR_Z_SLIVER = 0.0052;
/** Shared tangent-space strength for authored + procedural normal maps (front and back). */
/** Base bulge depth (world units); tuned so a single click is clearly visible. */
const CARD_BEND_MAX_DEPTH = 0.038;
const CARD_BEND_RADIUS = 0.52 * Math.min(CARD_WIDTH, CARD_HEIGHT);
/** Extra depth multiplier from repeated presses near the same UV (same face). */
const BEND_BUILDUP_PER_PRESS = 0.5;
const BEND_BUILDUP_MAX = 2.75;
const BEND_UV_SAME_SPOT = 0.14;
/** Wear mask resolution (canvas); drawn on each bend commit. */
const WEAR_TEX_SIZE = 128;
const BOARD_VIEWPORT_IDLE_DAMPING = 5.2;
const BOARD_VIEWPORT_ACTIVE_DAMPING = 7.4;
const BOARD_VIEWPORT_IDLE_SCALE_DAMPING = 4.8;
const BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING = 6.8;

type CardBendFace = 'front' | 'back';

type BendSourceEvent = ThreeEvent<PointerEvent | MouseEvent>;

const scratchHitLocal = new Vector3();

const cloneBasePositions = (geometry: PlaneGeometry): Float32Array =>
    new Float32Array((geometry.attributes.position as BufferAttribute).array);

/**
 * Plane vertex (px, py) → same UV convention as Three.js PlaneGeometry / box face (v = 1 at +Y side of plane).
 */
const planeVertexToUv = (px: number, py: number, width: number, height: number): { u: number; v: number } => ({
    u: px / width + 0.5,
    v: py / height + 0.5
});

const bendFalloffAtUv = (u: number, v: number, bendU: number, bendV: number, width: number, height: number): number => {
    const dx = (u - bendU) * width;
    const dy = (v - bendV) * height;
    const dist = Math.hypot(dx, dy);
    const t = MathUtils.clamp(1 - dist / CARD_BEND_RADIUS, 0, 1);

    return t * t * (3 - 2 * t);
};

/** Map raycast UV to shared card UV so front + back planes bulge at the same spot (back mesh is Y-flipped π). */
const hitUvToCanonicalBendUv = (face: CardBendFace, u: number, v: number): { u: number; v: number } =>
    face === 'front' ? { u, v } : { u: 1 - u, v };

/** Add permanent Z offsets (into persistent) for one bend stamp. */
const addPersistentBendStamp = (
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

const composeCardPositions = (
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

const createWearTextureAndContext = (): {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: CanvasTexture;
} => {
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

const drawWearStamp = (context: CanvasRenderingContext2D, bendU: number, bendV: number, intensity: number): void => {
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

const hashString = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

const getSurfaceVariant = (tile: Tile, faceUp: boolean, resolving: ResolvingSelectionState): FaceVariant => {
    if (tile.state === 'matched') {
        return 'matched';
    }

    if (faceUp && resolving === 'mismatch') {
        return 'mismatch';
    }

    if (faceUp && resolving === 'gambitNeutral') {
        return 'active';
    }

    return faceUp ? 'active' : 'hidden';
};

const layoutNormFromSeed = (seed: number, shift: number): number =>
    (((seed >>> shift) % 1001) / 500) - 1;

const getTileTransform = (
    tile: Tile,
    index: number,
    totalColumns: number,
    totalRows: number,
    compact: boolean,
    faceUp: boolean,
    reduceMotion: boolean
): TileTransform => {
    const seed = hashString(tile.id);
    const column = index % totalColumns;
    const row = Math.floor(index / totalColumns);
    const compactMul = compact ? 0.85 : 1;
    let baseX = (column - (totalColumns - 1) / 2) * TILE_SPACING;
    if (!reduceMotion && row % 2 === 1) {
        baseX += BOARD_LAYOUT_ROW_STAGGER_X * compactMul;
    }
    const baseY = ((totalRows - 1) / 2 - row) * TILE_SPACING;
    const imperfectionX = (((seed % 19) - 9) * 0.0025) / (compact ? 1.2 : 1);
    const imperfectionY = ((((seed >> 3) % 19) - 9) * 0.0024) / (compact ? 1.2 : 1);
    const imperfectionRotationX = (((seed >> 5) % 11) - 5) * 0.0028;
    const imperfectionRotationZ = (((seed >> 7) % 11) - 5) * 0.0026;
    const baseScale = 0.968 + ((seed % 7) * 0.0018);
    const bezelScale = SHELL_SCALE + ((seed % 5) * 0.0028);
    const panelScale = CORE_SCALE + ((seed % 5) * 0.002);
    const flipRotationY = faceUp ? 0 : Math.PI;
    const layoutJitterX =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 11) * BOARD_LAYOUT_JITTER_XY * compactMul;
    const layoutJitterY =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 17) * BOARD_LAYOUT_JITTER_XY * compactMul;
    const layoutJitterZ =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 23) * BOARD_LAYOUT_JITTER_Z * compactMul;
    const layoutYaw =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 29) * BOARD_LAYOUT_YAW_MAX * compactMul;

    return {
        baseScale,
        baseX,
        baseY,
        bezelScale,
        flipRotationY,
        imperfectionRotationX,
        imperfectionRotationZ,
        imperfectionX,
        imperfectionY,
        layoutJitterX,
        layoutJitterY,
        layoutJitterZ,
        layoutYaw,
        panelScale,
        seed
    };
};

interface TileBezelFramePropsSnapshot {
    faceUp: boolean;
    fieldAmp: number;
    flipLocked: boolean;
    focusDimmed: boolean;
    interactionSuppressed: boolean;
    interactive: boolean;
    isPinned: boolean;
    pickable: boolean;
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
    textureRevision: number;
    tile: Tile;
    transform: TileTransform;
    useSvgMeshBack: boolean;
    useSvgMeshFront: boolean;
    graphicsQuality: GraphicsQualityPreset;
    tileFieldParallaxEnabled: boolean;
    fieldTiltRef: MutableRefObject<TiltVector>;
    hoverTiltRef: MutableRefObject<TileHoverTiltState>;
    keyboardFocused: boolean;
    presentationWideRecall: boolean;
    presentationSilhouette: boolean;
    presentationNBackAnchor: boolean;
    nonPickableBack: boolean;
    /** Cancels match pulse / flip pop when a new resolving pair replaces the previous without a full idle frame. */
    resolvingMatchWaveKey: string | null;
}

interface TileBezelPlaneGeometries {
    front: PlaneGeometry;
    back: PlaneGeometry;
    overlay: PlaneGeometry;
}

interface TileBezelFrameBag {
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
    /** CARD-010: 0→1 ease over ~200ms on face-up edge (structural lift/depth); instant when `reduceMotion`. */
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
    /** Props that affect materials without moving the group; synced at end of `advanceTileBezelFrame`. */
    lastActivityVisualGateRef: MutableRefObject<{
        textureRevision: number;
        keyboardFocused: boolean;
        focusDimmed: boolean;
        graphicsQuality: GraphicsQualityPreset;
    } | null>;
}

const advanceTileBezelFrame = (bag: TileBezelFrameBag, state: RootState, delta: number): void => {
    if (typeof document !== 'undefined' && document.hidden) {
        return;
    }

    const p = bag.propsRef.current;
    const group = bag.groupRef.current;

    if (!group) {
        return;
    }

    const waveKey = p.resolvingMatchWaveKey;
    if (waveKey !== bag.lastResolvingWaveKeyRef.current) {
        bag.lastResolvingWaveKeyRef.current = waveKey;
        bag.flipPopT0Ref.current = null;
        bag.matchPulseRef.current = 0;
        bag.prevResolvingRef.current = null;
    }

    const clock = state.clock;
    const prevFace = bag.prevFaceUpRef.current;
    if (p.reduceMotion) {
        bag.flipPopT0Ref.current = null;
    } else if (p.faceUp && !prevFace) {
        /** CARD-003: face-up edge impulse (scale + Z); skipped when `reduceMotion`. */
        bag.flipPopT0Ref.current = clock.elapsedTime;
    }
    bag.prevFaceUpRef.current = p.faceUp;

    /** CARD-010: structural lift/depth follows face-up over ~200ms (aligned with CARD-003 ~0.22s pop). */
    const CARD_FACE_UP_SURFACE_S = 0.2;
    if (p.reduceMotion) {
        bag.faceUpStructT0Ref.current = null;
        bag.faceUpStructBlendRef.current = p.faceUp ? 1 : 0;
    } else if (!p.faceUp) {
        bag.faceUpStructT0Ref.current = null;
        bag.faceUpStructBlendRef.current = 0;
    } else if (!prevFace) {
        bag.faceUpStructT0Ref.current = clock.elapsedTime;
        bag.faceUpStructBlendRef.current = 0;
    } else {
        const t0 = bag.faceUpStructT0Ref.current;
        if (t0 != null) {
            const u = Math.min(1, (clock.elapsedTime - t0) / CARD_FACE_UP_SURFACE_S);
            const eased = 1 - (1 - u) * (1 - u);
            bag.faceUpStructBlendRef.current = eased;
            if (u >= 1) {
                bag.faceUpStructT0Ref.current = null;
                bag.faceUpStructBlendRef.current = 1;
            }
        } else {
            bag.faceUpStructBlendRef.current = 1;
        }
    }

    const prevR = bag.prevResolvingRef.current;
    if (p.resolvingSelection === 'match' && prevR !== 'match' && !p.reduceMotion) {
        bag.matchPulseRef.current = 1;
    }
    bag.prevResolvingRef.current = p.resolvingSelection;

    const wasMatched = bag.prevTileMatchedRef.current;
    if (p.tile.state === 'matched' && !wasMatched) {
        bag.matchedVictoryBurstT0Ref.current = clock.elapsedTime;
    } else if (p.tile.state !== 'matched') {
        bag.matchedVictoryBurstT0Ref.current = null;
    }
    bag.prevTileMatchedRef.current = p.tile.state === 'matched';
    bag.matchPulseRef.current = Math.max(0, bag.matchPulseRef.current - delta * 2.8);
    const matchPulse = bag.matchPulseRef.current;
    let matchedVictoryBurst = 0;
    const matchedBurstT0 = bag.matchedVictoryBurstT0Ref.current;
    if (p.tile.state === 'matched' && matchedBurstT0 != null) {
        const burstDuration = p.reduceMotion
            ? GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.reduceMotion
            : GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.default;
        const burstProgress = Math.min(1, (clock.elapsedTime - matchedBurstT0) / burstDuration);
        matchedVictoryBurst = 1 - MathUtils.smoothstep(burstProgress, 0, 1);
        if (burstProgress >= 1) {
            bag.matchedVictoryBurstT0Ref.current = null;
        }
    }

    let flipPopMul = 1;
    let flipPopZ = 0;
    const fp0 = bag.flipPopT0Ref.current;
    if (fp0 != null && !p.reduceMotion) {
        const td = clock.elapsedTime - fp0;
        if (td < 0.22) {
            const envelope = Math.sin((td / 0.22) * Math.PI);
            flipPopMul = 1 + envelope * 0.065;
            flipPopZ = envelope * 0.014;
        } else {
            bag.flipPopT0Ref.current = null;
        }
    }

    const frontBase = bag.frontBaseRef.current;
    const backBase = bag.backBaseRef.current;
    const overlayBase = bag.overlayBaseRef.current;

    if (frontBase && backBase && overlayBase) {
        const bu = bag.bendURef.current;
        const bv = bag.bendVRef.current;
        const bendOverlay = getSurfaceVariant(p.tile, p.faceUp, p.resolvingSelection) !== 'hidden';
        const depthMultiplier = 1 + bag.bendBuildupRef.current * 0.52;
        const pressing = !p.reduceMotion && p.pickable && bag.pressingOnCardRef.current;
        const live = pressing ? depthMultiplier : 0;
        const liveOverlay = pressing && bendOverlay ? live : 0;

        const { front: frontGeometry, back: backGeometry, overlay: overlayGeometry } = bag.planeGeometries;
        const frontPos = frontGeometry.attributes.position as BufferAttribute;
        const backPos = backGeometry.attributes.position as BufferAttribute;
        const overlayPos = overlayGeometry.attributes.position as BufferAttribute;

        if (!p.useSvgMeshFront) {
            composeCardPositions(
                frontPos,
                frontBase,
                bag.frontPersistentRef.current,
                bu,
                bv,
                CARD_WIDTH,
                CARD_HEIGHT,
                live
            );
        }
        if (!p.useSvgMeshBack) {
            composeCardPositions(
                backPos,
                backBase,
                bag.backPersistentRef.current,
                bu,
                bv,
                CARD_WIDTH,
                CARD_HEIGHT,
                live
            );
        }
        composeCardPositions(
            overlayPos,
            overlayBase,
            bag.overlayPersistentRef.current,
            bu,
            bv,
            CARD_WIDTH,
            CARD_HEIGHT,
            liveOverlay
        );
    }

    const isMatched = p.tile.state === 'matched';
    const time = state.clock.elapsedTime;
    const idleDrift = p.reduceMotion ? 0 : Math.sin(time * 0.09 + p.transform.seed * 0.017) * (isMatched ? 0.00038 : 0.00024);
    const settle = p.reduceMotion ? 0 : Math.sin(time * 0.08 + p.transform.seed * 0.013) * (isMatched ? 0.00048 : 0.0003);
    const field = p.fieldTiltRef.current;
    const fieldOn = p.tileFieldParallaxEnabled;
    const fieldRotX = fieldOn ? MathUtils.clamp(-field.y, -1, 1) * p.fieldAmp * (isMatched ? 0.042 : 0.074) : 0;
    const fieldRotZ = fieldOn ? MathUtils.clamp(field.x, -1, 1) * p.fieldAmp * (isMatched ? 0.038 : 0.068) : 0;
    const fieldLift = fieldOn ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.00035 : 0.00062) : 0;
    const fieldDepth = fieldOn ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.0005 : 0.00095) : 0;
    const hoverTilt = p.hoverTiltRef.current;
    const hovered = !p.reduceMotion && hoverTilt.tileId === p.tile.id;
    /** Mirrors `.fallbackTile:hover:not(.faceUp):not(.matched)` — gold rim / lift / tilt only on hidden backs. */
    const hoverDomParity = hovered && !p.faceUp && p.tile.state !== 'matched';
    /** TBF-008: gambit / face-up pickable — lighter rim on front without full DOM lift stack. */
    const hoverFaceUpPickable = hovered && p.faceUp && p.pickable && p.tile.state !== 'matched';
    const hoverTiltX = hoverDomParity
        ? MathUtils.clamp(-hoverTilt.y, -1, 1) * (isMatched ? 0.05 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltX)
        : 0;
    const hoverTiltZ = hoverDomParity
        ? MathUtils.clamp(hoverTilt.x, -1, 1) * (isMatched ? 0.046 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltZ)
        : 0;
    const hoverLift = hoverDomParity ? (isMatched ? 0.0012 : GAMEPLAY_BOARD_VISUALS.hoverHiddenLift) : 0;
    const hoverDepth = hoverDomParity ? (isMatched ? 0.0018 : GAMEPLAY_BOARD_VISUALS.hoverHiddenDepth) : 0;
    const structBlend = bag.faceUpStructBlendRef.current;
    const baseLiftFull = isMatched ? 0.0024 : p.faceUp ? 0.0012 : 0;
    const baseDepthFull = isMatched ? 0.0036 : p.faceUp ? 0.0018 : 0;
    const structLift = baseLiftFull * structBlend;
    const structDepth = baseDepthFull * structBlend;
    const liftGoal = structLift + hoverLift;
    const liftLambda = p.reduceMotion ? 400 : p.faceUp && !isMatched ? 48 : 200;
    bag.liftSmoothRef.current = MathUtils.damp(bag.liftSmoothRef.current, liftGoal, liftLambda, delta);
    const rotationDamp = p.reduceMotion ? 42 : p.faceUp ? 18 : 16;

    const now = performance.now();
    const shuffleLayoutActive =
        !p.reduceMotion && p.shuffleMotionDeadlineMs > 0 && now < p.shuffleMotionDeadlineMs;
    const entranceLayoutActive =
        !p.reduceMotion &&
        !shuffleLayoutActive &&
        p.boardEntranceMotionDeadlineMs > 0 &&
        now < p.boardEntranceMotionDeadlineMs;

    const shuffleMotion =
        shuffleLayoutActive && p.shuffleMotionBudgetMs > 0 && p.shuffleStaggerTileCount > 0
            ? computeShuffleMotionTransform(
                  now,
                  p.shuffleMotionDeadlineMs,
                  p.shuffleMotionBudgetMs,
                  p.shuffleBoardOrderIndex,
                  p.shuffleStaggerTileCount,
                  p.boardRows,
                  p.boardColumns
              )
            : {
                  rx: 0,
                  ry: 0,
                  rz: 0,
                  rotX: 0,
                  rotY: 0,
                  rotZ: 0
              };
    const entranceMotion =
        entranceLayoutActive && p.boardEntranceMotionBudgetMs > 0 && p.boardEntranceStaggerTileCount > 0
            ? computeBoardEntranceMotionTransform(
                  now,
                  p.boardEntranceMotionDeadlineMs,
                  p.boardEntranceMotionBudgetMs,
                  p.shuffleBoardOrderIndex,
                  p.boardEntranceStaggerTileCount,
                  p.boardRows,
                  p.boardColumns
              )
            : {
                  rx: 0,
                  ry: 0,
                  rz: 0,
                  rotX: 0,
                  rotY: 0,
                  rotZ: 0
              };

    group.rotation.x = MathUtils.damp(
        group.rotation.x,
        p.transform.imperfectionRotationX + fieldRotX + hoverTiltX + shuffleMotion.rotX + entranceMotion.rotX,
        p.reduceMotion ? 42 : 22,
        delta
    );
    group.rotation.z = MathUtils.damp(
        group.rotation.z,
        p.transform.imperfectionRotationZ + fieldRotZ + hoverTiltZ + shuffleMotion.rotZ + entranceMotion.rotZ,
        p.reduceMotion ? 42 : 22,
        delta
    );
    const rotationYTarget =
        p.transform.layoutYaw + p.transform.flipRotationY + shuffleMotion.rotY + entranceMotion.rotY;
    group.rotation.y = p.reduceMotion
        ? rotationYTarget
        : MathUtils.damp(group.rotation.y, rotationYTarget, rotationDamp, delta);
    const baseTargetX = p.transform.baseX + p.transform.imperfectionX + p.transform.layoutJitterX;
    const baseTargetY =
        p.transform.baseY +
        p.transform.imperfectionY +
        p.transform.layoutJitterY +
        bag.liftSmoothRef.current +
        fieldLift +
        idleDrift +
        settle;

    const targetX = baseTargetX + shuffleMotion.rx + entranceMotion.rx;
    const targetY = baseTargetY + shuffleMotion.ry + entranceMotion.ry;
    const targetZ =
        structDepth + hoverDepth + fieldDepth + shuffleMotion.rz + entranceMotion.rz + p.transform.layoutJitterZ;
    const wobbleT = clock.elapsedTime;
    const mismatchShakeX =
        !p.reduceMotion && p.resolvingSelection === 'mismatch'
            ? Math.sin(wobbleT * 36) * GAMEPLAY_BOARD_VISUALS.mismatchShakeX
            : 0;
    const mismatchShakeY =
        !p.reduceMotion && p.resolvingSelection === 'mismatch'
            ? Math.cos(wobbleT * 29) * GAMEPLAY_BOARD_VISUALS.mismatchShakeY
            : 0;
    const posX = targetX + mismatchShakeX;
    const posY = targetY + mismatchShakeY;
    const layoutMotionActive = shuffleLayoutActive || entranceLayoutActive;
    const posLambda = layoutMotionActive ? 9 : 200;

    const zWithFlipPop = targetZ + flipPopZ;
    if (layoutMotionActive) {
        group.position.x = MathUtils.damp(group.position.x, posX, posLambda, delta);
        group.position.y = MathUtils.damp(group.position.y, posY, posLambda, delta);
        group.position.z = MathUtils.damp(group.position.z, zWithFlipPop, posLambda, delta);
    } else {
        group.position.x = posX;
        group.position.y = posY;
        group.position.z = zWithFlipPop;
    }
    const matchPulseMul = p.resolvingSelection === 'match' ? 0.13 : 0.085;
    const scaleMul = p.transform.baseScale * flipPopMul * (1 + matchPulse * matchPulseMul);
    group.scale.x = group.scale.y = group.scale.z = scaleMul;

    const hiddenPinned = p.isPinned && p.tile.state === 'hidden';
    scratchCardTint.set('#ffffff');
    if (hiddenPinned) {
        scratchCardTint.set('#d4b870');
    } else if (p.nonPickableBack) {
        scratchCardTint.set('#9a94a3');
    } else if (p.tile.state === 'matched' && p.faceUp) {
        /** No face tint when the ember rim shows (medium+); low quality uses static matched chrome instead. */
        if (p.graphicsQuality === 'low') {
            scratchCardTint.lerp(MATCH_FACE_GLOW, 0.32);
        }
    } else if (p.resolvingSelection === 'mismatch' && p.faceUp) {
        scratchCardTint.set('#ffb4a6');
    } else if (p.resolvingSelection === 'gambitNeutral' && p.faceUp) {
        scratchCardTint.set('#cfe8f2');
    }
    const pinnedFaceResolving = p.isPinned && p.faceUp && p.resolvingSelection !== null;
    if (pinnedFaceResolving) {
        const pinLerp =
            p.resolvingSelection === 'match' ? 0.36 : p.resolvingSelection === 'gambitNeutral' ? 0.3 : 0.26;
        scratchCardTint.lerp(PIN_STACK_TINT, pinLerp);
    }
    if (hoverDomParity) {
        scratchCardTint.lerp(HOVER_RIM_TINT, HOVER_RIM_TINT_LERP);
    } else if (hoverFaceUpPickable) {
        scratchCardTint.lerp(HOVER_RIM_TINT, GAMEPLAY_BOARD_VISUALS.hoverFaceUpTintLerp);
    }
    /** Presentation mutators (WebGL parity with DOM/CSS assists). Order: anchor tint → wide recall → silhouette. */
    if (p.presentationNBackAnchor) {
        scratchCardTint.lerp(PRESENTATION_N_BACK_TINT, 0.14);
    }
    if (p.presentationWideRecall) {
        scratchCardTint.lerp(PRESENTATION_WIDE_RECALL_TINT, 0.18);
    }
    if (p.presentationSilhouette) {
        scratchCardTint.multiplyScalar(0.84);
    }
    const { emissiveIntensity: hoverEmissiveMul, rimOpacity: hoverRimOpacity } = getHoverGoldQualityScales(
        p.graphicsQuality
    );
    const hoverEmissiveIntensity = hoverDomParity
        ? hoverEmissiveMul
        : hoverFaceUpPickable
          ? hoverEmissiveMul * 0.42
          : 0;
    const hoverRimOpacityTarget = hoverDomParity ? hoverRimOpacity : 0;
    const faceUpHoverMul = getFaceUpHoverRimOpacityMul(p.graphicsQuality);
    const hoverFrontRimOpacityTarget = hoverFaceUpPickable ? hoverRimOpacity * faceUpHoverMul : 0;
    const shaderGlowEnabled = p.graphicsQuality !== 'low';
    const renderQuality = gameplayRenderQualityProfile(p.graphicsQuality);
    for (const matRef of [
        bag.hoverRimTopMatRef,
        bag.hoverRimBottomMatRef,
        bag.hoverRimRightMatRef,
        bag.hoverRimLeftMatRef
    ]) {
        const m = matRef.current;
        if (m) {
            m.opacity = shaderGlowEnabled ? hoverRimOpacityTarget * 0.18 : hoverRimOpacityTarget;
        }
    }
    for (const matRef of [
        bag.hoverFrontRimTopMatRef,
        bag.hoverFrontRimBottomMatRef,
        bag.hoverFrontRimRightMatRef,
        bag.hoverFrontRimLeftMatRef
    ]) {
        const m = matRef.current;
        if (m) {
            m.opacity = shaderGlowEnabled ? hoverFrontRimOpacityTarget * 0.22 : hoverFrontRimOpacityTarget;
        }
    }

    const { colors } = RENDERER_THEME;
    const resolvingRim = bag.resolvingRimMatRef.current;
    const focusRim = bag.focusRimMatRef.current;
    const matchedEdgeEffect = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect;

    const resolvingActive = p.resolvingSelection !== null && p.faceUp;
    /** Matched, post-resolve: show ember rim — hide the crisp resolving bezel so it does not stack over the shader. */
    const matchedVictoryPersistent = p.tile.state === 'matched' && p.faceUp && !resolvingActive;
    const pinnedFaceResolvingFx = p.isPinned && p.faceUp && p.resolvingSelection !== null;
    let resolvingCrispOpacity = 0;

    if (matchedVictoryPersistent) {
        if (resolvingRim) {
            resolvingRim.color.set(colors.emeraldBright);
            resolvingRim.opacity =
                p.graphicsQuality === 'low'
                    ? MathUtils.clamp(
                          matchedEdgeEffect.low.rimOpacity +
                              matchedVictoryBurst * matchedEdgeEffect.low.burstBoost,
                          0,
                          1
                      )
                    : 0;
        }
    } else if (resolvingActive) {
        if (resolvingRim) {
            if (p.resolvingSelection === 'mismatch') {
                resolvingRim.color.set(colors.danger);
            } else if (p.resolvingSelection === 'gambitNeutral') {
                resolvingRim.color.set(colors.cyanBright);
            } else {
                resolvingRim.color.set(colors.emeraldBright);
            }
            const pulse = p.reduceMotion
                ? 0.62
                : 0.38 +
                  0.32 *
                      Math.sin(
                          clock.elapsedTime * (p.resolvingSelection === 'mismatch' ? 5.1 : 4.05)
                      );
            resolvingCrispOpacity = pinnedFaceResolvingFx ? Math.min(1, pulse + 0.2) : pulse;
            resolvingRim.opacity = shaderGlowEnabled ? resolvingCrispOpacity * 0.18 : resolvingCrispOpacity;
        }
    } else {
        if (resolvingRim) {
            resolvingRim.opacity = 0;
        }
    }

    const applyCardGlow = (
        mat: ShaderMaterial | null,
        mesh: Mesh | null,
        intensity: number,
        pulse: number,
        mode: number,
        primary: string,
        secondary: string,
        accent: string
    ): void => {
        if (!mat || !mesh || !mat.uniforms) {
            return;
        }

        mesh.visible = shaderGlowEnabled && intensity > 0.002;
        const u = mat.uniforms;
        u.uTime.value = clock.elapsedTime;
        u.uIntensity.value = shaderGlowEnabled ? intensity : 0;
        u.uPulse.value = pulse;
        u.uMotion.value = p.reduceMotion ? Math.min(renderQuality.cardGlowMotion, 0.08) : renderQuality.cardGlowMotion;
        u.uMode.value = mode;
        scratchGlowColor.set(primary);
        u.uPrimaryColor.value.set(scratchGlowColor.r, scratchGlowColor.g, scratchGlowColor.b);
        scratchGlowColor.set(secondary);
        u.uSecondaryColor.value.set(scratchGlowColor.r, scratchGlowColor.g, scratchGlowColor.b);
        scratchGlowColor.set(accent);
        u.uAccentColor.value.set(scratchGlowColor.r, scratchGlowColor.g, scratchGlowColor.b);
        clampCardArcaneGlowDriverUniforms({ uIntensity: u.uIntensity, uPulse: u.uPulse, uMotion: u.uMotion });
    };

    const focusActive = p.keyboardFocused && p.pickable && p.tile.state !== 'matched';
    const focusPulse = p.reduceMotion ? 0.18 : 0.38 + 0.22 * Math.sin(clock.elapsedTime * 2.35);
    applyCardGlow(
        bag.hoverBackGlowMatRef.current,
        bag.hoverBackGlowMeshRef.current,
        hoverDomParity ? renderQuality.cardGlowIntensity * hoverRimOpacity : 0,
        hoverDomParity ? 0.28 + hoverRimOpacity * 0.28 : 0,
        0,
        colors.goldBright,
        colors.cyanBright,
        colors.emberSoft
    );
    applyCardGlow(
        bag.hoverFrontGlowMatRef.current,
        bag.hoverFrontGlowMeshRef.current,
        hoverFaceUpPickable ? renderQuality.cardGlowIntensity * hoverFrontRimOpacityTarget : 0,
        hoverFaceUpPickable ? 0.2 + hoverFrontRimOpacityTarget * 0.24 : 0,
        0.35,
        colors.goldBright,
        colors.cyanBright,
        colors.emberSoft
    );
    applyCardGlow(
        bag.resolvingGlowMatRef.current,
        bag.resolvingGlowMeshRef.current,
        resolvingActive ? renderQuality.resolveGlowIntensity * Math.max(0.42, resolvingCrispOpacity) : 0,
        resolvingActive ? (p.resolvingSelection === 'mismatch' ? 0.84 : 0.62) : 0,
        p.resolvingSelection === 'mismatch' ? 1.3 : p.resolvingSelection === 'gambitNeutral' ? 0.8 : 1,
        p.resolvingSelection === 'mismatch'
            ? colors.danger
            : p.resolvingSelection === 'gambitNeutral'
              ? colors.cyanBright
              : colors.emeraldBright,
        colors.goldBright,
        p.resolvingSelection === 'mismatch' ? colors.emberSoft : colors.cyanBright
    );
    applyCardGlow(
        bag.focusGlowMatRef.current,
        bag.focusGlowMeshRef.current,
        focusActive ? renderQuality.cardGlowIntensity * 0.68 : 0,
        focusActive ? focusPulse : 0,
        0.55,
        colors.goldBright,
        colors.cyanBright,
        colors.text
    );

    const matchedFlame = bag.matchedVictoryFlameMatRef.current;
    const matchedFlameMesh = bag.matchedVictoryFlameMeshRef.current;
    if (matchedFlame && matchedFlameMesh && matchedFlame.uniforms) {
        const u = matchedFlame.uniforms;
        if (matchedVictoryPersistent && p.graphicsQuality !== 'low') {
            const matchedEdgeTier = getMatchedEdgeEffectTier(p.graphicsQuality, p.reduceMotion);
            matchedFlameMesh.visible = true;
            const ft = clock.elapsedTime;
            u.uTime.value = ft;
            u.uBurst.value = matchedVictoryBurst;
            u.uMotion.value = matchedEdgeTier.motion;
            u.uSoftness.value = matchedEdgeEffect.band.softness;
            u.uInnerWidth.value = matchedEdgeEffect.band.innerWidth * matchedEdgeTier.innerWidthMul;
            u.uOuterWidth.value = matchedEdgeEffect.band.outerWidth * matchedEdgeTier.outerWidthMul;
            u.uEmberStrength.value = matchedEdgeTier.emberStrength;
            u.uIntensity.value =
                matchedEdgeTier.baseIntensity + matchedVictoryBurst * matchedEdgeTier.burstIntensity;
            clampMatchedCardRimFireDriverUniforms({ uIntensity: u.uIntensity, uBurst: u.uBurst });
        } else {
            matchedFlameMesh.visible = false;
        }
    }

    if (focusRim) {
        if (p.tile.state === 'matched') {
            focusRim.opacity = 0;
        } else {
            const fk = p.keyboardFocused && p.pickable;
            if (!fk) {
                focusRim.opacity = 0;
            } else if (p.reduceMotion) {
                focusRim.opacity = 0.68;
            } else {
                const pulse = 0.11 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.35));
                focusRim.opacity = MathUtils.clamp(0.76 + pulse, 0.72, 0.94);
            }
        }
    }

    const dimTarget = p.focusDimmed && !p.faceUp && p.tile.state === 'hidden' ? 1 : 0;
    bag.focusDimBlendRef.current = MathUtils.damp(
        bag.focusDimBlendRef.current,
        dimTarget,
        p.reduceMotion ? 400 : 32,
        delta
    );
    const dimBrightness = MathUtils.lerp(1, 0.52, bag.focusDimBlendRef.current);
    const dimOpacity = MathUtils.lerp(1, 0.88, bag.focusDimBlendRef.current);
    scratchCardTint.multiplyScalar(dimBrightness);
    bag.frontCardMatRef.current?.color.copy(scratchCardTint);
    bag.backCardMatRef.current?.color.copy(scratchCardTint);
    if (bag.frontCardMatRef.current) {
        bag.frontCardMatRef.current.opacity = dimOpacity;
        if (p.tile.state === 'matched') {
            if (p.graphicsQuality === 'low') {
                const mp = p.reduceMotion
                    ? GAMEPLAY_BOARD_VISUALS.lowQualityMatchedFrontEmissive.base
                    : GAMEPLAY_BOARD_VISUALS.lowQualityMatchedFrontEmissive.base +
                      GAMEPLAY_BOARD_VISUALS.lowQualityMatchedFrontEmissive.pulse *
                          (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.05));
                bag.frontCardMatRef.current.emissive.copy(MATCH_VICTORY_EMISSIVE);
                bag.frontCardMatRef.current.emissiveIntensity = mp;
            } else {
                bag.frontCardMatRef.current.emissive.setRGB(0, 0, 0);
                bag.frontCardMatRef.current.emissiveIntensity = 0;
            }
        } else if (p.resolvingSelection === 'mismatch' && p.faceUp) {
            const mismatchPulse = p.reduceMotion
                ? GAMEPLAY_BOARD_VISUALS.mismatchEmissive.base
                : GAMEPLAY_BOARD_VISUALS.mismatchEmissive.base +
                  GAMEPLAY_BOARD_VISUALS.mismatchEmissive.pulse *
                      (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4.2));
            bag.frontCardMatRef.current.emissive.copy(MISMATCH_EMISSIVE);
            bag.frontCardMatRef.current.emissiveIntensity = mismatchPulse;
        } else {
            bag.frontCardMatRef.current.emissive.copy(HOVER_GOLD_EMISSIVE);
            bag.frontCardMatRef.current.emissiveIntensity = hoverEmissiveIntensity;
        }
    }
    if (bag.backCardMatRef.current) {
        bag.backCardMatRef.current.opacity = dimOpacity;
        if (p.tile.state === 'matched') {
            if (p.graphicsQuality === 'low') {
                const mp = p.reduceMotion
                    ? GAMEPLAY_BOARD_VISUALS.lowQualityMatchedBackEmissive.base
                    : GAMEPLAY_BOARD_VISUALS.lowQualityMatchedBackEmissive.base +
                      GAMEPLAY_BOARD_VISUALS.lowQualityMatchedBackEmissive.pulse *
                          (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.05));
                bag.backCardMatRef.current.emissive.copy(MATCH_VICTORY_EMISSIVE);
                bag.backCardMatRef.current.emissiveIntensity = mp;
            } else {
                bag.backCardMatRef.current.emissive.setRGB(0, 0, 0);
                bag.backCardMatRef.current.emissiveIntensity = 0;
            }
        } else {
            bag.backCardMatRef.current.emissive.copy(HOVER_GOLD_EMISSIVE);
            bag.backCardMatRef.current.emissiveIntensity = hoverEmissiveIntensity;
        }
    }

    bag.lastActivityVisualGateRef.current = {
        textureRevision: p.textureRevision,
        keyboardFocused: p.keyboardFocused,
        focusDimmed: p.focusDimmed,
        graphicsQuality: p.graphicsQuality
    };
};

const TileBezelFrameRegistryContext = createContext<{
    register(id: string, bag: TileBezelFrameBag): void;
    unregister(id: string): void;
} | null>(null);

const TilePickMeshRegistryContext = createContext<{
    register(id: string, mesh: Mesh): void;
    unregister(id: string): void;
} | null>(null);

/** Dev legacy path only: per-tile `useFrame` so consolidated mode avoids N no-op subscriptions. */
const TileBezelLegacyFrameDriver = ({ bagRef }: { bagRef: RefObject<TileBezelFrameBag | null> }) => {
    useFrame((state, delta) => {
        const bag = bagRef.current;

        if (bag) {
            advanceTileBezelFrame(bag, state, delta);
        }
    });

    return null;
};

const CARD_BACK_LAYER_BASE_OPACITY: Record<CardBackSvgLayerName, number> = {
    'back-base': 1,
    'back-rims': 0.96,
    'back-corners': 0.9,
    'back-corner-scrolls': 0.62,
    'back-scrolls': 0.82,
    'back-rings': 0.58,
    'back-gem': 0.96,
    'back-vignette': 0.72
};

interface AnimatedCardBackSvgLayersProps {
    backCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    cardPanelDisplacementMap: CanvasTexture | null;
    cardTint: string;
    faceZ: number;
    layers: readonly CardBackSvgLayerGeometry[];
    normalMap: Texture | null;
    reduceMotion: boolean;
    renderQuality: ReturnType<typeof gameplayRenderQualityProfile>;
    roughnessMap: CanvasTexture | null;
    seed: number;
}

const AnimatedCardBackSvgLayers = memo(
    ({
        backCardMatRef,
        cardPanelDisplacementMap,
        cardTint,
        faceZ,
        layers,
        normalMap,
        reduceMotion,
        renderQuality,
        roughnessMap,
        seed
    }: AnimatedCardBackSvgLayersProps) => {
        const meshRefs = useRef<Array<Mesh | null>>([]);
        const matRefs = useRef<Array<MeshStandardMaterial | null>>([]);
        const phase = useMemo(() => ((seed % 997) / 997) * Math.PI * 2, [seed]);

        useFrame((state) => {
            const t = state.clock.elapsedTime;
            for (let index = 0; index < layers.length; index += 1) {
                const layer = layers[index]!;
                const mesh = meshRefs.current[index];
                const mat = matRefs.current[index];
                if (!mesh || !mat) {
                    continue;
                }

                const z = index * 0.000035;
                let x = 0;
                let y = 0;
                let rot = 0;
                let scale = 1;
                let opacity = CARD_BACK_LAYER_BASE_OPACITY[layer.name] ?? 1;
                let emissive = 0;

                if (!reduceMotion) {
                    const wave = Math.sin(t * 0.72 + phase + index * 0.61);
                    if (layer.name === 'back-rims') {
                        y = wave * 0.0012;
                        opacity += wave * 0.035;
                    } else if (layer.name === 'back-corners' || layer.name === 'back-corner-scrolls') {
                        x = Math.sin(t * 0.62 + phase + index) * 0.0013;
                        y = Math.cos(t * 0.58 + phase + index) * 0.0013;
                        opacity += wave * 0.028;
                    } else if (layer.name === 'back-scrolls') {
                        x = wave * 0.0018;
                        opacity += wave * 0.04;
                    } else if (layer.name === 'back-rings') {
                        rot = t * 0.038 + phase * 0.08;
                        opacity += wave * 0.045;
                    } else if (layer.name === 'back-gem') {
                        scale = 1 + wave * 0.012;
                        emissive = 0.08 + (0.5 + 0.5 * wave) * 0.12;
                    }
                }

                mesh.position.set(x, y, z);
                mesh.rotation.z = rot;
                mesh.scale.setScalar(scale);
                mat.opacity = MathUtils.clamp(opacity, 0.24, 1);
                mat.emissiveIntensity = emissive;
            }
        });

        return (
            <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
                {layers.map((layer, index) => (
                    <mesh
                        key={layer.name}
                        geometry={layer.geometry}
                        raycast={noopMeshRaycast}
                        ref={(mesh) => {
                            meshRefs.current[index] = mesh;
                        }}
                        renderOrder={index}
                    >
                        <meshStandardMaterial
                            ref={(mat) => {
                                matRefs.current[index] = mat;
                                if (index === 0) {
                                    backCardMatRef.current = mat;
                                }
                            }}
                            alphaTest={0.03}
                            color={cardTint}
                            depthWrite
                            displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                            displacementMap={cardPanelDisplacementMap ?? undefined}
                            displacementScale={renderQuality.cardDisplacementScale}
                            emissive="#6eb9d8"
                            emissiveIntensity={0}
                            metalness={layer.name === 'back-gem' ? 0.18 : renderQuality.cardMetalness}
                            normalMap={normalMap ?? undefined}
                            normalScale={renderQuality.cardNormalScale}
                            opacity={CARD_BACK_LAYER_BASE_OPACITY[layer.name] ?? 1}
                            roughness={layer.name === 'back-gem' ? 0.34 : renderQuality.cardRoughness}
                            roughnessMap={roughnessMap ?? undefined}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                            vertexColors
                        />
                    </mesh>
                ))}
            </group>
        );
    }
);
AnimatedCardBackSvgLayers.displayName = 'AnimatedCardBackSvgLayers';

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
    objectiveBackAccent = false,
    nonPickableBack = false,
    destroyBlockedDecoyBack = false,
    focusDimmed = false,
    stickyFingerSlotMark = false,
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

    propsRef.current = {
        faceUp,
        fieldAmp,
        flipLocked,
        focusDimmed,
        interactionSuppressed,
        interactive,
        isPinned,
        pickable,
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
        textureRevision,
        tile,
        transform,
        useSvgMeshBack,
        useSvgMeshFront,
        graphicsQuality,
        tileFieldParallaxEnabled,
        fieldTiltRef,
        hoverTiltRef,
        keyboardFocused,
        presentationWideRecall,
        presentationSilhouette,
        presentationNBackAnchor,
        nonPickableBack,
        resolvingMatchWaveKey
    };

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
    /** FX-005 WebGL: brief match scale pulse (DOM hit layer adds CSS spark ring in `TileBoard.module.css`). */
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
            hoverBackGlowMaterial.dispose();
            hoverFrontGlowMaterial.dispose();
            resolvingGlowMaterial.dispose();
            focusGlowMaterial.dispose();
            matchedRimFireMaterial.dispose();
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
        if (bagRef.current === null) {
            bagRef.current = {
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
            };
        } else {
            bagRef.current.planeGeometries = { front: frontGeometry, back: backGeometry, overlay: overlayGeometry };
        }

        if (!frameRegistry || !hostConsolidatesTileFrames) {
            return undefined;
        }

        frameRegistry.register(tile.id, bagRef.current);

        return () => {
            frameRegistry.unregister(tile.id);
        };
    }, [backGeometry, frameRegistry, frontGeometry, hostConsolidatesTileFrames, overlayGeometry, tile.id]);

    const [wearAssets] = useState(() => {
        if (typeof document === 'undefined') {
            return null;
        }

        return {
            back: createWearTextureAndContext(),
            front: createWearTextureAndContext()
        };
    });

    useLayoutEffect(() => {
        frontBaseRef.current = cloneBasePositions(frontGeometry);
        backBaseRef.current = cloneBasePositions(backGeometry);
        overlayBaseRef.current = cloneBasePositions(overlayGeometry);
        for (const geom of [frontGeometry, backGeometry]) {
            if (geom.index) {
                try {
                    geom.computeTangents();
                } catch {
                    /* bend-deformed planes still approximate OK for subtle normal map */
                }
            }
        }
    }, [backGeometry, frontGeometry, overlayGeometry]);

    useLayoutEffect(() => {
        if (!wearAssets) {
            return;
        }

        const cap = Math.min(8, gl.capabilities.getMaxAnisotropy());
        /* eslint-disable react-hooks/immutability -- Three.js CanvasTexture GPU fields are intentionally mutated */
        wearAssets.front.texture.anisotropy = cap;
        wearAssets.back.texture.anisotropy = cap;
        /* eslint-enable react-hooks/immutability */
    }, [gl, wearAssets]);

    useEffect(() => {
        return () => {
            if (!wearAssets) {
                return;
            }
            wearAssets.front.texture.dispose();
            wearAssets.back.texture.dispose();
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
        const bendOverlay = getSurfaceVariant(tile, faceUp, resolvingSelection) !== 'hidden';

        if (!useSvgMeshFront) {
            addPersistentBendStamp(frontPersistentRef.current, frontBase, bu, bv, CARD_WIDTH, CARD_HEIGHT, depthScale);
        }
        if (!useSvgMeshBack) {
            addPersistentBendStamp(backPersistentRef.current, backBase, bu, bv, CARD_WIDTH, CARD_HEIGHT, depthScale);
        }

        if (bendOverlay) {
            addPersistentBendStamp(
                overlayPersistentRef.current,
                overlayBase,
                bu,
                bv,
                CARD_WIDTH,
                CARD_HEIGHT,
                depthScale
            );
        }

        if (wearAssets) {
            if (!useSvgMeshFront) {
                drawWearStamp(wearAssets.front.context, bu, bv, depthScale);
            }
            if (!useSvgMeshBack) {
                drawWearStamp(wearAssets.back.context, bu, bv, depthScale);
            }
            /* eslint-disable react-hooks/immutability */
            if (!useSvgMeshFront) {
                wearAssets.front.texture.needsUpdate = true;
            }
            if (!useSvgMeshBack) {
                wearAssets.back.texture.needsUpdate = true;
            }
            /* eslint-enable react-hooks/immutability */
        }
    };

    const resolveBendFaceFromHit = (event: BendSourceEvent): CardBendFace | null => {
        const hitFace = event.face;

        if (hitFace) {
            const nz = hitFace.normal.z;

            if (Math.abs(nz) > 0.65) {
                return nz > 0 ? 'front' : 'back';
            }
        }

        scratchHitLocal.copy(event.point);
        event.object.worldToLocal(scratchHitLocal);
        const halfDepth = TILE_DEPTH * 0.5;
        const z = scratchHitLocal.z;

        if (z > halfDepth * 0.1) {
            return 'front';
        }

        if (z < -halfDepth * 0.1) {
            return 'back';
        }

        return null;
    };

    const maybeBumpBuildup = (canonicalU: number, canonicalV: number): void => {
        const prevU = lastBumpURef.current;
        const prevV = lastBumpVRef.current;

        if (prevU === null || prevV === null) {
            bendBuildupRef.current = 0;
        } else if (Math.hypot(canonicalU - prevU, canonicalV - prevV) < BEND_UV_SAME_SPOT) {
            bendBuildupRef.current = Math.min(
                BEND_BUILDUP_MAX,
                bendBuildupRef.current + BEND_BUILDUP_PER_PRESS
            );
        } else {
            bendBuildupRef.current = 0;
        }

        lastBumpURef.current = canonicalU;
        lastBumpVRef.current = canonicalV;
    };

    const syncBendFromPointerEvent = (event: BendSourceEvent, bumpRepeat: boolean): void => {
        if (reduceMotion || !pickable) {
            return;
        }

        if (event.type === 'pointermove') {
            const native = event.nativeEvent;

            if (
                native instanceof PointerEvent &&
                native.pointerType === 'mouse' &&
                (native.buttons & 1) === 0
            ) {
                return;
            }
        }

        const face = resolveBendFaceFromHit(event);
        const { uv } = event;

        if (!face || !uv) {
            return;
        }

        const { u: canonicalU, v: canonicalV } = hitUvToCanonicalBendUv(face, uv.x, uv.y);

        if (bumpRepeat) {
            maybeBumpBuildup(canonicalU, canonicalV);
        }

        bendURef.current = canonicalU;
        bendVRef.current = canonicalV;
    };

    const handleCardPointerUp = (event: ThreeEvent<PointerEvent>): void => {
        if (pickable && !reduceMotion) {
            if (event.pointerType !== 'mouse' || event.button === 0) {
                syncBendFromPointerEvent(event, false);
            }
        }

        if (pressingOnCardRef.current && pickable && !reduceMotion) {
            commitPersistentBend();
        }

        pressingOnCardRef.current = false;
        event.stopPropagation();

        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        if (!pickable) {
            return;
        }

        onTilePick(tile.id);
    };

    const handleCardPointerDown = (event: ThreeEvent<PointerEvent>): void => {
        event.stopPropagation();
        pressingOnCardRef.current = true;
        syncBendFromPointerEvent(event, true);
    };

    const handleCardClick = (event: ThreeEvent<MouseEvent>): void => {
        event.stopPropagation();

        if (!pickable || reduceMotion) {
            return;
        }

        syncBendFromPointerEvent(event, false);
    };

    const handleCardPointerMove = (event: ThreeEvent<PointerEvent>): void => {
        syncBendFromPointerEvent(event, false);

        const pointerType = event.nativeEvent.pointerType;

        if (reduceMotion || pointerType === 'touch' || pointerType === 'pen') {
            if (hoverTiltRef.current.tileId === tile.id) {
                hoverTiltRef.current = { tileId: null, x: 0, y: 0 };
            }

            return;
        }

        const { uv } = event;

        if (!uv) {
            return;
        }

        const x = MathUtils.clamp(uv.x * 2 - 1, -1, 1);
        const y = MathUtils.clamp(-(uv.y * 2 - 1), -1, 1);

        hoverTiltRef.current = { tileId: tile.id, x, y };
    };

    const handleCardPointerOut = (): void => {
        if (pressingOnCardRef.current && pickable && !reduceMotion) {
            commitPersistentBend();
        }

        pressingOnCardRef.current = false;

        if (hoverTiltRef.current.tileId === tile.id) {
            hoverTiltRef.current = { tileId: null, x: 0, y: 0 };
        }
    };

    const surfaceVariant = getSurfaceVariant(tile, faceUp, resolvingSelection);
    const frontRoughnessMap = useMemo(() => {
        void textureRevision;
        return getTileFaceRoughnessTexture(tile, 'front', surfaceVariant === 'hidden' ? 'active' : surfaceVariant, 'panel');
    }, [surfaceVariant, textureRevision, tile]);
    const backRoughnessMap = useMemo(() => {
        void textureRevision;
        return getTileFaceRoughnessTexture(tile, 'back', 'hidden', 'panel');
    }, [textureRevision, tile]);
    const hiddenPinned = isPinned && tile.state === 'hidden';
    const cardTint =
        hiddenPinned
            ? '#d4b870'
            : resolvingSelection === 'mismatch' && faceUp
              ? '#ffb4a6'
              : resolvingSelection === 'gambitNeutral' && faceUp
                ? '#cfe8f2'
                : '#ffffff';
    /** Hidden side: shared SVG mesh when loaded, else raster fallback. Face-up: same for front. */
    const cardBackArtTexture = useSvgMeshBack ? null : getTileFaceTexture(tile, 'back', 'hidden', 'panel');
    const cardFrontArtTexture = useSvgMeshFront ? null : getCardFaceStaticTexture();
    const overlayTexture =
        surfaceVariant === 'hidden' ? null : getTileFaceOverlayTexture(tile, surfaceVariant, graphicsQuality);
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
            {/*
              Rounded card art is transparent in the corners. A box mesh exposes dark side quads there.
              Invisible pick slab + two planes lets corners composite to the scene instead.
            */}
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
                {useSvgMeshFront && sharedCardFrontGeometry ? (
                    <mesh geometry={sharedCardFrontGeometry} position={[0, 0, faceZ]} raycast={noopMeshRaycast}>
                        <meshStandardMaterial
                            ref={frontCardMatRef}
                            alphaTest={0.06}
                            color={cardTint}
                            depthWrite
                            displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                            displacementMap={cardPanelDisplacementMap ?? undefined}
                            displacementScale={renderQuality.cardDisplacementScale}
                            metalness={renderQuality.cardMetalness}
                            normalMap={frontNormalMapEffective ?? undefined}
                            normalScale={renderQuality.cardNormalScale}
                            roughness={renderQuality.cardRoughness}
                            roughnessMap={frontRoughnessMap ?? undefined}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                            vertexColors
                        />
                    </mesh>
                ) : (
                    <mesh geometry={frontGeometry} position={[0, 0, faceZ]} raycast={noopMeshRaycast}>
                        <meshStandardMaterial
                            ref={frontCardMatRef}
                            alphaTest={0.06}
                            color={cardTint}
                            depthWrite
                            displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                            displacementMap={cardPanelDisplacementMap ?? undefined}
                            displacementScale={renderQuality.cardDisplacementScale}
                            map={cardFrontArtTexture ?? undefined}
                            metalness={renderQuality.cardMetalness}
                            normalMap={frontNormalMapEffective ?? undefined}
                            normalScale={renderQuality.cardNormalScale}
                            roughness={renderQuality.cardRoughness}
                            roughnessMap={frontRoughnessMap ?? undefined}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                )}
                {wearAssets ? (
                    <mesh
                        geometry={frontGeometry}
                        position={[0, 0, faceZ + CARD_WEAR_Z_SLIVER]}
                        raycast={noopMeshRaycast}
                        renderOrder={6}
                    >
                        <meshBasicMaterial
                            blending={MultiplyBlending}
                            depthWrite={false}
                            map={wearAssets.front.texture}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            premultipliedAlpha
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {useSvgMeshBack && sharedCardBackLayers ? (
                    <AnimatedCardBackSvgLayers
                        backCardMatRef={backCardMatRef}
                        cardPanelDisplacementMap={cardPanelDisplacementMap}
                        cardTint={cardTint}
                        faceZ={faceZ}
                        layers={sharedCardBackLayers}
                        normalMap={backNormalMapEffective}
                        reduceMotion={reduceMotion}
                        renderQuality={renderQuality}
                        roughnessMap={backRoughnessMap}
                        seed={transform.seed}
                    />
                ) : (
                    <mesh geometry={backGeometry} position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]} raycast={noopMeshRaycast}>
                        <meshStandardMaterial
                            ref={backCardMatRef}
                            alphaTest={0.06}
                            color={cardTint}
                            depthWrite
                            displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                            displacementMap={cardPanelDisplacementMap ?? undefined}
                            displacementScale={renderQuality.cardDisplacementScale}
                            map={cardBackArtTexture ?? undefined}
                            metalness={renderQuality.cardMetalness}
                            normalMap={backNormalMapEffective ?? undefined}
                            normalScale={renderQuality.cardNormalScale}
                            roughness={renderQuality.cardRoughness}
                            roughnessMap={backRoughnessMap ?? undefined}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                )}
                {wearAssets ? (
                    <mesh
                        geometry={backGeometry}
                        position={[0, 0, -faceZ - CARD_WEAR_Z_SLIVER]}
                        raycast={noopMeshRaycast}
                        renderOrder={6}
                        rotation={[0, Math.PI, 0]}
                    >
                        <meshBasicMaterial
                            blending={MultiplyBlending}
                            depthWrite={false}
                            map={wearAssets.back.texture}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            premultipliedAlpha
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {tutorialPairOrdinal != null ? (
                    <TutorialPairMarkerPlane faceZ={faceZ} ordinal={tutorialPairOrdinal} />
                ) : null}
                {/*
                  FX-006: gold frame strips on the pickable hidden face (same transform stack as `.fallbackTile:hover` rim).
                  Opacity driven in `advanceTileBezelFrame`; shared geometry keeps perf sane across tiles.
                */}
                <group position={[0, 0, -faceZ - 0.00028]} rotation={[0, Math.PI, 0]}>
                    <mesh
                        ref={hoverBackGlowMeshRef}
                        geometry={arcaneGlowGeometry}
                        position={[0, 0, 0.00064]}
                        raycast={noopMeshRaycast}
                        renderOrder={8}
                        visible={false}
                    >
                        <primitive ref={hoverBackGlowMatRef} object={hoverBackGlowMaterial} attach="material" />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomH}
                        position={[0, CARD_HEIGHT * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, 0.00045]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverRimTopMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomH}
                        position={[0, -CARD_HEIGHT * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, 0.00045]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverRimBottomMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomV}
                        position={[CARD_WIDTH * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, 0, 0.00045]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverRimRightMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomV}
                        position={[-CARD_WIDTH * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, 0, 0.00045]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverRimLeftMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                </group>
                {/* Shifting spotlight + board-power hints on hidden card backs */}
                {(spotlightWardOnBack ||
                    spotlightBountyOnBack ||
                    destroyBlockedDecoyBack ||
                    powerBackAccent != null ||
                    hazardBackAccent != null ||
                    routeBackAccent ||
                    objectiveBackAccent ||
                    nonPickableBack ||
                    (stickyFingerSlotMark && tile.state === 'hidden')) &&
                !faceUp ? (
                    <group position={[0, 0, -faceZ - 0.00033]} rotation={[0, Math.PI, 0]}>
                        {spotlightWardOnBack ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[-CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, 0.00052]}
                                raycast={noopMeshRaycast}
                                renderOrder={9}
                            >
                                <meshBasicMaterial
                                    color="#ff7a6a"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.88}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {spotlightBountyOnBack ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00052]}
                                raycast={noopMeshRaycast}
                                renderOrder={9}
                            >
                                <meshBasicMaterial
                                    color="#5ee0c8"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.88}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {destroyBlockedDecoyBack ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[0, CARD_HEIGHT * 0.38, 0.00053]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#9480a8"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.82}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {powerBackAccent === 'destroy' ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[-CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00054]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#d94848"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.92}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {powerBackAccent === 'peek' ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, 0.00054]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#59b4d9"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.9}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {powerBackAccent === 'stray' ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00054]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#d4a03d"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.9}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {powerBackAccent === 'pin' ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[0, -CARD_HEIGHT * 0.42, 0.00054]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#e8c878"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.88}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {hazardBackAccent ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[0, CARD_HEIGHT * 0.4, 0.00055]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color={hazardTileColor(hazardBackAccent)}
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.92}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {routeBackAccent ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[-CARD_WIDTH * 0.34, 0, 0.00057]}
                                rotation={[0, 0, Math.PI / 4]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#59b4d9"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.86}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {objectiveBackAccent ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[CARD_WIDTH * 0.34, 0, 0.00058]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#f2d39d"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.9}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {nonPickableBack ? (
                            <mesh
                                geometry={hoverGoldRimGeomH}
                                position={[0, -CARD_HEIGHT * 0.5 + HOVER_GOLD_RIM_STRIP * 1.15, 0.00059]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.passiveHover.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#b6a4bd"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.34}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                        {stickyFingerSlotMark && tile.state === 'hidden' ? (
                            <mesh
                                geometry={findableCornerRingGeometry}
                                position={[CARD_WIDTH * 0.34, CARD_HEIGHT * 0.39, 0.00056]}
                                raycast={noopMeshRaycast}
                                renderOrder={10}
                            >
                                <meshBasicMaterial
                                    color="#c65a28"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.88}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        ) : null}
                    </group>
                ) : null}
                {/*
                  TBF-008: softer gold strips on the front face when face-up + pickable (gambit third pick path).
                */}
                <group position={[0, 0, faceZ + 0.00032]}>
                    <mesh
                        ref={hoverFrontGlowMeshRef}
                        geometry={arcaneGlowGeometry}
                        position={[0, 0, 0.00068]}
                        raycast={noopMeshRaycast}
                        renderOrder={8}
                        visible={false}
                    >
                        <primitive ref={hoverFrontGlowMatRef} object={hoverFrontGlowMaterial} attach="material" />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomH}
                        position={[0, CARD_HEIGHT * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, 0.00042]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverFrontRimTopMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomH}
                        position={[0, -CARD_HEIGHT * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, 0.00042]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverFrontRimBottomMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomV}
                        position={[CARD_WIDTH * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, 0, 0.00042]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverFrontRimRightMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={hoverGoldRimGeomV}
                        position={[-CARD_WIDTH * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, 0, 0.00042]}
                        raycast={noopMeshRaycast}
                        renderOrder={7}
                    >
                        <meshBasicMaterial
                            ref={hoverFrontRimLeftMatRef}
                            color={RENDERER_THEME.colors.goldBright}
                            depthWrite={false}
                            opacity={0}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                </group>
                {memorizeCurseHighlight ? (
                    <mesh geometry={curseRingGeometry} position={[0, 0, faceZ + 0.014]} raycast={noopMeshRaycast} renderOrder={9}>
                        <meshBasicMaterial
                            color="#c49cff"
                            depthTest
                            depthWrite={false}
                            opacity={0.88}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {spotlightWardHighlight ? (
                    <mesh
                        geometry={findableCornerRingGeometry}
                        position={[-CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, faceZ + 0.018]}
                        raycast={noopMeshRaycast}
                        renderOrder={9}
                    >
                        <meshBasicMaterial
                            color="#ff7a6a"
                            depthTest
                            depthWrite={false}
                            opacity={0.9}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {spotlightBountyHighlight ? (
                    <mesh
                        geometry={findableCornerRingGeometry}
                        position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, faceZ + 0.018]}
                        raycast={noopMeshRaycast}
                        renderOrder={9}
                    >
                        <meshBasicMaterial
                            color="#5ee0c8"
                            depthTest
                            depthWrite={false}
                            opacity={0.9}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {stickyFingerSlotMark && tile.state === 'matched' ? (
                    <mesh
                        geometry={findableCornerRingGeometry}
                        position={[0, CARD_HEIGHT * 0.41, faceZ + 0.019]}
                        raycast={noopMeshRaycast}
                        renderOrder={9}
                    >
                        <meshBasicMaterial
                            color="#c65a28"
                            depthTest
                            depthWrite={false}
                            opacity={0.87}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {overlayTexture ? (
                    <mesh geometry={overlayGeometry} position={[0, 0, overlayZ]} raycast={noopMeshRaycast} renderOrder={10}>
                        <meshBasicMaterial
                            alphaTest={0.08}
                            color={
                                surfaceVariant === 'matched' && graphicsQuality === 'high'
                                    ? '#fff9f2'
                                    : surfaceVariant === 'matched' && graphicsQuality === 'medium'
                                      ? '#fff6ec'
                                      : '#ffffff'
                            }
                            depthTest={false}
                            depthWrite={false}
                            map={overlayTexture}
                            opacity={surfaceVariant === 'matched' && graphicsQuality !== 'low' ? 0.97 : 0.93}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {pairProximityDistance != null ? (
                    <PairProximityHintPlane distance={pairProximityDistance} faceZ={faceZ} />
                ) : null}
                <mesh
                    ref={matchedVictoryFlameMeshRef}
                    geometry={matchedEdgeGeometry}
                    position={[0, 0, faceZ + 0.024]}
                    raycast={noopMeshRaycast}
                    renderOrder={18}
                    visible={false}
                >
                    <primitive ref={matchedVictoryFlameMatRef} object={matchedRimFireMaterial} attach="material" />
                </mesh>
                <mesh
                    geometry={resolvingInnerGeometry}
                    position={[0, 0, faceZ + 0.024]}
                    raycast={noopMeshRaycast}
                    renderOrder={13}
                >
                    <meshBasicMaterial
                        ref={resolvingRimMatRef}
                        color={RENDERER_THEME.colors.emeraldBright}
                        depthTest
                        depthWrite={false}
                        opacity={0}
                        polygonOffset
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
                <mesh
                    ref={resolvingGlowMeshRef}
                    geometry={arcaneGlowGeometry}
                    position={[0, 0, faceZ + 0.026]}
                    raycast={noopMeshRaycast}
                    renderOrder={14}
                    visible={false}
                >
                    <primitive ref={resolvingGlowMatRef} object={resolvingGlowMaterial} attach="material" />
                </mesh>
                <mesh geometry={focusRingGeometry} position={[0, 0, faceZ + 0.027]} raycast={noopMeshRaycast} renderOrder={15}>
                    <meshBasicMaterial
                        ref={focusRimMatRef}
                        color={RENDERER_THEME.colors.goldBright}
                        depthTest
                        depthWrite={false}
                        opacity={0}
                        polygonOffset
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
                <mesh
                    ref={focusGlowMeshRef}
                    geometry={arcaneGlowGeometry}
                    position={[0, 0, faceZ + 0.029]}
                    raycast={noopMeshRaycast}
                    renderOrder={16}
                    visible={false}
                >
                    <primitive ref={focusGlowMatRef} object={focusGlowMaterial} attach="material" />
                </mesh>
            </group>
        </group>
        </>
    );
};

TileBezelInner.displayName = 'TileBezel';
const TileBezel = memo(TileBezelInner);

const TileBoardScene = forwardRef<TileBoardSceneHandle, TileBoardSceneProps>(({
    board,
    boardViewport,
    compact,
    debugPeekActive,
    fieldTiltRef,
    hoverTiltRef,
    interactionSuppressed,
    interactive,
    onTilePick,
    onViewportMetricsChange,
    pinnedTileIds,
    previewActive,
    reduceMotion,
    motionParallaxSuppressed,
    runStatus,
    peekRevealedTileIds = [],
    cursedPairKey = null,
    wardPairKey = null,
    bountyPairKey = null,
    shuffleMotionDeadlineMs,
    shuffleMotionBudgetMs,
    shuffleStaggerTileCount,
    boardEntranceMotionDeadlineMs = 0,
    boardEntranceMotionBudgetMs = 0,
    boardEntranceStaggerTileCount = 0,
    dimmedTileIds,
    allowGambitThirdFlip = false,
    graphicsQuality = 'medium',
    focusedTileId = null,
    pairProximityHintsEnabled = true,
    wideRecallInPlay = false,
    silhouetteDuringPlay = false,
    nBackAnchorPairKey = null,
    nBackMutatorActive = false,
    showTutorialPairMarkers = true,
    shiftingSpotlightActive = false,
    destroyPowerVisualActive = false,
    destroyEligibleTileIds = EMPTY_TILE_IDS,
    peekPowerVisualActive = false,
    peekEligibleTileIds = EMPTY_TILE_IDS,
    strayPowerVisualActive = false,
    strayEligibleTileIds = EMPTY_TILE_IDS,
    pinModeBoardHintActive = false,
    stickyBlockedTileId = null
}: TileBoardSceneProps, ref) => {
    const { camera, gl, viewport } = useThree();
    const { colors } = RENDERER_THEME;
    const sceneRenderQuality = gameplayRenderQualityProfile(graphicsQuality);
    const tileFieldParallaxEnabled = useMemo(
        () => shouldApplyTileFieldParallax({ motionParallaxSuppressed, reduceMotion }),
        [motionParallaxSuppressed, reduceMotion]
    );
    const resolvingMatchWaveKey = useMemo(
        () => getResolvingMatchWaveKey(board, runStatus),
        [board, runStatus]
    );
    const totalColumns = board.columns;
    const totalRows = board.rows;
    const [textureRevision, setTextureRevision] = useState(0);
    const [sharedCardFrontGeometry, setSharedCardFrontGeometry] = useState<BufferGeometry | null>(null);
    const [sharedCardBackLayers, setSharedCardBackLayers] = useState<readonly CardBackSvgLayerGeometry[] | null>(null);
    const flippedN = board.flippedTileIds.length;
    const flipLocked = flippedN >= 2 && !(allowGambitThirdFlip && flippedN === 2);
    const pinnedSet = useMemo(() => new Set(pinnedTileIds), [pinnedTileIds]);
    const peekSet = useMemo(() => new Set(peekRevealedTileIds), [peekRevealedTileIds]);
    const tutorialPairOrdinalByKey = useMemo(() => {
        if (!showTutorialPairMarkers) {
            return null;
        }
        const keys = [
            ...new Set(
                board.tiles
                    .map((t) => t.pairKey)
                    .filter((k) => k !== DECOY_PAIR_KEY && k !== WILD_PAIR_KEY)
            )
        ].sort();
        const m = new Map<string, number>();
        for (let i = 0; i < keys.length; i += 1) {
            m.set(keys[i]!, i + 1);
        }
        return m;
    }, [board.tiles, showTutorialPairMarkers]);

    const tileStepLegacy = useMemo(() => readTileStepLegacy(), []);
    const hostConsolidatesTileFrames = !tileStepLegacy;
    const tileBezelRows = useMemo(() => {
        return board.tiles.map((tile, index) => {
            const faceUp =
                tile.state !== 'hidden' || previewActive || debugPeekActive || peekSet.has(tile.id);
            const memorizeCurseHighlight =
                Boolean(previewActive) &&
                Boolean(cursedPairKey) &&
                tile.pairKey === cursedPairKey &&
                tile.state === 'hidden';
            const spotlightWardHighlight =
                Boolean(wardPairKey) && faceUp && tile.state !== 'matched' && tile.pairKey === wardPairKey;
            const spotlightBountyHighlight =
                Boolean(bountyPairKey) && faceUp && tile.state !== 'matched' && tile.pairKey === bountyPairKey;
            const pairProximityDistance =
                pairProximityHintsEnabled &&
                (runStatus === 'playing' || runStatus === 'resolving') &&
                tile.state === 'flipped'
                    ? getPairProximityGridDistance(board, tile.id)
                    : null;
            const inPlayFlip =
                runStatus === 'playing' && faceUp && tile.state === 'flipped';
            const presentationWideRecall = Boolean(wideRecallInPlay && inPlayFlip);
            const presentationSilhouette = Boolean(silhouetteDuringPlay && inPlayFlip);
            const presentationNBackAnchor = Boolean(
                nBackMutatorActive &&
                    nBackAnchorPairKey != null &&
                    tile.pairKey === nBackAnchorPairKey &&
                    inPlayFlip
            );
            const tutorialPairOrdinal =
                showTutorialPairMarkers && tile.state === 'hidden' && !faceUp
                    ? tutorialPairOrdinalByKey?.get(tile.pairKey) ?? null
                    : null;
            const spotlightWardOnBack =
                shiftingSpotlightActive &&
                Boolean(wardPairKey) &&
                !faceUp &&
                tile.pairKey === wardPairKey;
            const spotlightBountyOnBack =
                shiftingSpotlightActive &&
                Boolean(bountyPairKey) &&
                !faceUp &&
                tile.pairKey === bountyPairKey;
            const destroyBlockedDecoyBack =
                destroyPowerVisualActive &&
                !faceUp &&
                tile.state === 'hidden' &&
                tile.pairKey === DECOY_PAIR_KEY;
            const stickyFingerSlotMark =
                stickyBlockedTileId != null &&
                stickyBlockedTileId === tile.id &&
                flippedN === 0 &&
                (tile.state === 'matched' || (tile.state === 'hidden' && !faceUp));
            let powerBackAccent: 'destroy' | 'peek' | 'stray' | 'pin' | null = null;
            let hazardBackAccent: HazardTileKind | null = null;
            let routeBackAccent = false;
            let objectiveBackAccent = false;
            let nonPickableBack = false;
            if (tile.state === 'hidden' && !faceUp) {
                hazardBackAccent = tile.tileHazardKind ?? null;
                routeBackAccent = Boolean(tile.routeSpecialKind || tile.routeCardKind);
                objectiveBackAccent = Boolean(tile.dungeonCardKind || tile.dungeonBossId);
                nonPickableBack = !isTilePickable(tile, interactive, flipLocked);
                if (pinModeBoardHintActive) {
                    powerBackAccent = 'pin';
                } else if (destroyBlockedDecoyBack) {
                    powerBackAccent = null;
                } else if (destroyPowerVisualActive && destroyEligibleTileIds.has(tile.id)) {
                    powerBackAccent = 'destroy';
                } else if (peekPowerVisualActive && peekEligibleTileIds.has(tile.id)) {
                    powerBackAccent = 'peek';
                } else if (strayPowerVisualActive && strayEligibleTileIds.has(tile.id)) {
                    powerBackAccent = 'stray';
                }
            }
            return {
                destroyBlockedDecoyBack,
                faceUp,
                fieldAmp: getTileFieldAmplification(index, totalColumns, totalRows),
                focusDimmed: Boolean(dimmedTileIds?.has(tile.id)),
                isPinned: pinnedSet.has(tile.id),
                memorizeCurseHighlight,
                pairProximityDistance,
                powerBackAccent,
                hazardBackAccent,
                routeBackAccent,
                objectiveBackAccent,
                nonPickableBack,
                presentationNBackAnchor,
                presentationSilhouette,
                presentationWideRecall,
                resolvingSelection: getResolvingSelectionState(board, runStatus, tile.id),
                shuffleBoardOrderIndex: index,
                spotlightBountyHighlight,
                spotlightBountyOnBack,
                spotlightWardHighlight,
                spotlightWardOnBack,
                stickyFingerSlotMark,
                tile,
                transform: getTileTransform(tile, index, totalColumns, totalRows, compact, faceUp, reduceMotion),
                tutorialPairOrdinal
            };
        });
    }, [
        board,
        bountyPairKey,
        compact,
        cursedPairKey,
        debugPeekActive,
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        dimmedTileIds,
        flipLocked,
        nBackAnchorPairKey,
        nBackMutatorActive,
        pairProximityHintsEnabled,
        peekEligibleTileIds,
        peekPowerVisualActive,
        peekSet,
        pinModeBoardHintActive,
        pinnedSet,
        previewActive,
        reduceMotion,
        runStatus,
        interactive,
        shiftingSpotlightActive,
        showTutorialPairMarkers,
        silhouetteDuringPlay,
        strayEligibleTileIds,
        strayPowerVisualActive,
        stickyBlockedTileId,
        flippedN,
        totalColumns,
        totalRows,
        tutorialPairOrdinalByKey,
        wardPairKey,
        wideRecallInPlay
    ]);
    const overlayPrewarmDemandPairKeys = useMemo(() => {
        const keys = new Set<string>();

        for (const row of tileBezelRows) {
            const { tile, faceUp, resolvingSelection } = row;

            if (faceUp) {
                keys.add(tile.pairKey);
            }

            if (resolvingSelection != null) {
                keys.add(tile.pairKey);
            }

            const pickable = !interactionSuppressed && isTilePickable(tile, interactive, flipLocked);

            if (pickable) {
                keys.add(tile.pairKey);
            }
        }

        return [...keys];
    }, [tileBezelRows, flipLocked, interactionSuppressed, interactive]);
    const enemyHazardRows = useMemo(() => {
        const byTileId = new Map(tileBezelRows.map((row) => [row.tile.id, row.transform]));
        return (board.enemyHazards ?? [])
            .filter((hazard) => hazard.state !== 'defeated')
            .map((hazard) => {
                const currentTransform = byTileId.get(hazard.currentTileId) ?? null;
                if (!currentTransform) {
                    return null;
                }
                return {
                    hazard,
                    currentTransform,
                    nextTransform: byTileId.get(hazard.nextTileId) ?? null
                };
            })
            .filter((row): row is { hazard: EnemyHazardState; currentTransform: TileTransform; nextTransform: TileTransform | null } =>
                row != null
            );
    }, [board.enemyHazards, tileBezelRows]);
    const boardRuneFieldMetrics = useMemo(() => {
        if (tileBezelRows.length === 0) {
            return { centerX: 0, centerY: 0, height: CARD_HEIGHT * 3, width: CARD_WIDTH * 4 };
        }

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const row of tileBezelRows) {
            const { transform } = row;
            const x = transform.baseX + transform.imperfectionX + transform.layoutJitterX;
            const y = transform.baseY + transform.imperfectionY + transform.layoutJitterY;
            minX = Math.min(minX, x - CARD_WIDTH * 0.78);
            maxX = Math.max(maxX, x + CARD_WIDTH * 0.78);
            minY = Math.min(minY, y - CARD_HEIGHT * 0.78);
            maxY = Math.max(maxY, y + CARD_HEIGHT * 0.78);
        }

        const padX = TILE_SPACING * 0.72;
        const padY = TILE_SPACING * 0.6;

        return {
            centerX: (minX + maxX) * 0.5,
            centerY: (minY + maxY) * 0.5,
            height: Math.max(CARD_HEIGHT * 2.6, maxY - minY + padY),
            width: Math.max(CARD_WIDTH * 3.4, maxX - minX + padX)
        };
    }, [tileBezelRows]);
    const boardRuneFieldGeometry = useMemo(
        () => new PlaneGeometry(boardRuneFieldMetrics.width, boardRuneFieldMetrics.height, 1, 1),
        [boardRuneFieldMetrics.height, boardRuneFieldMetrics.width]
    );
    const boardRuneFieldMaterial = useMemo(() => createBoardRuneFieldMaterial(), []);
    const boardRuneFieldMatRef = useRef<ShaderMaterial | null>(null);
    const boardGroupRef = useRef<Group | null>(null);
    const pickRaycasterRef = useRef<Raycaster>(new Raycaster());
    const pickPointerRef = useRef<Vector2>(new Vector2());
    const tileFrameBagsRef = useRef(new Map<string, TileBezelFrameBag>());
    const tileFrameIdleStreakRef = useRef(new Map<string, number>());
    const tilePickMeshesRef = useRef(new Map<string, Mesh>());
    const tileFrameRegistry = useMemo(
        () => ({
            register(id: string, bag: TileBezelFrameBag): void {
                tileFrameBagsRef.current.set(id, bag);
                tileFrameIdleStreakRef.current.delete(id);
            },
            unregister(id: string): void {
                tileFrameBagsRef.current.delete(id);
                tileFrameIdleStreakRef.current.delete(id);
            }
        }),
        []
    );
    const pickMeshRegistry = useMemo(
        () => ({
            register(id: string, mesh: Mesh): void {
                tilePickMeshesRef.current.set(id, mesh);
            },
            unregister(id: string): void {
                tilePickMeshesRef.current.delete(id);
            }
        }),
        []
    );

    useEffect(() => {
        return () => {
            boardRuneFieldGeometry.dispose();
        };
    }, [boardRuneFieldGeometry]);

    useEffect(() => {
        return () => {
            boardRuneFieldMaterial.dispose();
        };
    }, [boardRuneFieldMaterial]);

    useEffect(() => subscribeTextureImageUpdates(() => setTextureRevision((current) => current + 1)), []);

    useEffect(() => {
        return runDemandDrivenTileFaceOverlayPrewarmSession(overlayPrewarmDemandPairKeys, graphicsQuality);
    }, [graphicsQuality, overlayPrewarmDemandPairKeys]);

    /** Chain front → back so two huge SVGLoader.parse passes never run in parallel (main-thread + memory). */
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const loadedFront = await loadSharedCardSvgPlaneGeometry(cardFrontSvgUrl);
            if (loadedFront == null) {
                return;
            }
            const frontG = loadedFront;
            if (cancelled) {
                frontG.dispose();
                return;
            }
            setSharedCardFrontGeometry(frontG);
            const loadedBackLayers = await loadSharedCardBackSvgLayerGeometries(cardBackSvgUrl);
            if (loadedBackLayers == null) {
                return;
            }
            if (cancelled) {
                for (const layer of loadedBackLayers) {
                    layer.geometry.dispose();
                }
                frontG.dispose();
                return;
            }
            setSharedCardBackLayers(loadedBackLayers);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            sharedCardFrontGeometry?.dispose();
        };
    }, [sharedCardFrontGeometry]);

    useEffect(() => {
        return () => {
            for (const layer of sharedCardBackLayers ?? []) {
                layer.geometry.dispose();
            }
        };
    }, [sharedCardBackLayers]);

    const viewportNotifier = useMemo(
        () => createRafCoalescedViewportNotifier((w, h) => onViewportMetricsChange({ width: w, height: h })),
        [onViewportMetricsChange]
    );

    useEffect(() => {
        viewportNotifier.schedule(viewport.width, viewport.height);
        return () => {
            viewportNotifier.cancel();
        };
    }, [viewport.height, viewport.width, viewportNotifier]);

    useLayoutEffect(() => {
        setTileTextureSamplingQuality(graphicsQuality);
        preloadCardRankOpentypeFont(graphicsQuality);
        const tierCap = getBoardAnisotropyCap(graphicsQuality);
        applyAnisotropyToCachedTileTextures(Math.min(tierCap, gl.capabilities.getMaxAnisotropy()));
    }, [gl, graphicsQuality, textureRevision]);

    useEffect(() => subscribeCardRankFontLoaded(() => setTextureRevision((n) => n + 1)), []);

    useImperativeHandle(
        ref,
        () => ({
            getTileClientRectById: (tileId: string) => {
                const boardGroup = boardGroupRef.current;

                if (!boardGroup) {
                    return null;
                }

                const rect = gl.domElement.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                    return null;
                }

                const tileObject = tilePickMeshesRef.current.get(tileId) ?? null;

                if (!tileObject) {
                    return null;
                }

                const worldBounds = new Box3().setFromObject(tileObject);
                if (worldBounds.isEmpty()) {
                    return null;
                }

                const corners = [
                    new Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.min.z),
                    new Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.max.z),
                    new Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.min.z),
                    new Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.max.z),
                    new Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.min.z),
                    new Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.max.z),
                    new Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.min.z),
                    new Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.max.z)
                ];

                let left = Number.POSITIVE_INFINITY;
                let right = Number.NEGATIVE_INFINITY;
                let top = Number.POSITIVE_INFINITY;
                let bottom = Number.NEGATIVE_INFINITY;

                for (const corner of corners) {
                    corner.project(camera);
                    const x = rect.left + ((corner.x + 1) * 0.5) * rect.width;
                    const y = rect.top + ((1 - corner.y) * 0.5) * rect.height;
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                }

                if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
                    return null;
                }

                return {
                    bottom,
                    height: Math.max(0, bottom - top),
                    left,
                    right,
                    top,
                    width: Math.max(0, right - left)
                };
            },
            pickTileAtClientPoint: (clientX: number, clientY: number): boolean => {
                const boardGroup = boardGroupRef.current;

                if (!boardGroup) {
                    return false;
                }

                const rect = gl.domElement.getBoundingClientRect();

                if (rect.width <= 0 || rect.height <= 0) {
                    return false;
                }

                pickPointerRef.current.set(
                    ((clientX - rect.left) / rect.width) * 2 - 1,
                    -(((clientY - rect.top) / rect.height) * 2 - 1)
                );
                pickRaycasterRef.current.setFromCamera(pickPointerRef.current, camera);

                const pickTargets = [...tilePickMeshesRef.current.values()];
                const hit = pickRaycasterRef.current
                    .intersectObjects(pickTargets, false)
                    .find((intersection) => typeof intersection.object.userData?.tileId === 'string');

                if (!hit) {
                    return false;
                }

                onTilePick(String(hit.object.userData.tileId));
                return true;
            }
        }),
        [camera, gl, onTilePick]
    );

    useLayoutEffect(() => {
        const boardGroup = boardGroupRef.current;

        if (!boardGroup) {
            return;
        }

        const initialScale = boardViewport.fitZoom * boardViewport.zoom;
        boardGroup.position.set(boardViewport.panX, boardViewport.panY, 0);
        boardGroup.scale.setScalar(initialScale);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only; useFrame updates boardGroup each frame

    useFrame((state, delta) => {
        const perfOn = boardWebglPerfSampleEnabled() || boardWebglPerfSampleVerboseEnabled();
        let tileStepMs = 0;
        let viewportMs = 0;

        if (!tileStepLegacy) {
            const tTile0 = perfOn ? performance.now() : 0;
            const nowMs = performance.now();
            const clockElapsedTime = state.clock.elapsedTime;

            for (const [id, bag] of tileFrameBagsRef.current) {
                const want = shouldAdvanceTileBezelThisFrame(bag, clockElapsedTime, nowMs);
                const prevStreak = tileFrameIdleStreakRef.current.get(id) ?? 0;
                const streakNext = want ? 0 : prevStreak + 1;
                tileFrameIdleStreakRef.current.set(id, streakNext);
                const runThis = want || streakNext <= 2;

                if (runThis) {
                    advanceTileBezelFrame(bag, state, delta);
                }
            }

            if (perfOn) {
                tileStepMs = performance.now() - tTile0;
            }
        }

        const tViewport0 = perfOn ? performance.now() : 0;
        const boardGroup = boardGroupRef.current;

        if (boardGroup) {
            const targetScale = boardViewport.fitZoom * boardViewport.zoom;

            if (reduceMotion) {
                boardGroup.position.x = boardViewport.panX;
                boardGroup.position.y = boardViewport.panY;
                boardGroup.scale.setScalar(targetScale);
            } else {
                const panDamping = interactionSuppressed ? BOARD_VIEWPORT_ACTIVE_DAMPING : BOARD_VIEWPORT_IDLE_DAMPING;
                const scaleDamping = interactionSuppressed
                    ? BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING
                    : BOARD_VIEWPORT_IDLE_SCALE_DAMPING;

                boardGroup.position.x = MathUtils.damp(boardGroup.position.x, boardViewport.panX, panDamping, delta);
                boardGroup.position.y = MathUtils.damp(boardGroup.position.y, boardViewport.panY, panDamping, delta);
                boardGroup.scale.x = MathUtils.damp(boardGroup.scale.x, targetScale, scaleDamping, delta);
                boardGroup.scale.y = MathUtils.damp(boardGroup.scale.y, targetScale, scaleDamping, delta);
                boardGroup.scale.z = MathUtils.damp(boardGroup.scale.z, targetScale, scaleDamping, delta);
            }
        }

        if (perfOn) {
            viewportMs = performance.now() - tViewport0;
            boardWebglPerfSampleAccumulatePhases({ tileStepMs, viewportMs });
        }

        const runeMat = boardRuneFieldMatRef.current;
        if (runeMat?.uniforms) {
            const u = runeMat.uniforms;
            u.uTime.value = state.clock.elapsedTime;
            u.uIntensity.value = reduceMotion
                ? sceneRenderQuality.stageRuneFieldIntensity * 0.46
                : sceneRenderQuality.stageRuneFieldIntensity;
            u.uMotion.value = reduceMotion
                ? Math.min(sceneRenderQuality.stageRuneFieldMotion, 0.06)
                : sceneRenderQuality.stageRuneFieldMotion;
            u.uGrid.value.set(boardRuneFieldMetrics.width, boardRuneFieldMetrics.height);
            clampBoardRuneFieldDriverUniforms({ uIntensity: u.uIntensity, uMotion: u.uMotion });
        }
    });

    return (
        <TileBezelFrameRegistryContext.Provider value={tileFrameRegistry}>
        <TilePickMeshRegistryContext.Provider value={pickMeshRegistry}>
        <>
            <ambientLight color={colors.text} intensity={compact ? 0.54 : 0.62} />
            <hemisphereLight
                color={colors.text}
                groundColor={colors.smokeDeep}
                intensity={compact ? 0.24 : 0.3}
            />
            <directionalLight
                castShadow={false}
                color={colors.text}
                intensity={compact ? 0.18 : 0.24}
                position={[0, 2.2, 12]}
            />
            <directionalLight
                castShadow={false}
                color={colors.goldBright}
                intensity={compact ? sceneRenderQuality.goldKeyLight * 0.86 : sceneRenderQuality.goldKeyLight}
                position={[5.4, 7.2, 8.5]}
            />
            <directionalLight
                color={colors.cyanBright}
                intensity={compact ? sceneRenderQuality.cyanKeyLight * 0.82 : sceneRenderQuality.cyanKeyLight}
                position={[-5.8, 2.2, 6.8]}
            />
            <pointLight
                color={colors.gold}
                intensity={compact ? sceneRenderQuality.stagePointLight * 0.82 : sceneRenderQuality.stagePointLight}
                position={[0, -2.2, 5.4]}
            />

            <group ref={boardGroupRef} rotation={[0, 0, 0]}>
                {graphicsQuality !== 'low' ? (
                    <mesh
                        geometry={boardRuneFieldGeometry}
                        position={[boardRuneFieldMetrics.centerX, boardRuneFieldMetrics.centerY, -0.075]}
                        raycast={noopMeshRaycast}
                        renderOrder={-20}
                    >
                        <primitive ref={boardRuneFieldMatRef} object={boardRuneFieldMaterial} attach="material" />
                    </mesh>
                ) : null}
                {tileBezelRows.map(
                    ({
                        destroyBlockedDecoyBack,
                        faceUp,
                        fieldAmp,
                        focusDimmed,
                        hazardBackAccent,
                        isPinned,
                        memorizeCurseHighlight,
                        nonPickableBack,
                        objectiveBackAccent,
                        pairProximityDistance,
                        powerBackAccent,
                        presentationNBackAnchor,
                        presentationSilhouette,
                        presentationWideRecall,
                        resolvingSelection,
                        routeBackAccent,
                        shuffleBoardOrderIndex,
                        spotlightBountyHighlight,
                        spotlightBountyOnBack,
                        spotlightWardHighlight,
                        spotlightWardOnBack,
                        stickyFingerSlotMark,
                        tile,
                        transform,
                        tutorialPairOrdinal: tileTutorialPairOrdinal
                    }) => (
                        <TileBezel
                            key={tile.id}
                            destroyBlockedDecoyBack={destroyBlockedDecoyBack}
                            faceUp={faceUp}
                            fieldAmp={fieldAmp}
                            fieldTiltRef={fieldTiltRef}
                            tileFieldParallaxEnabled={tileFieldParallaxEnabled}
                            flipLocked={flipLocked}
                            focusDimmed={focusDimmed}
                            hazardBackAccent={hazardBackAccent}
                            routeBackAccent={routeBackAccent}
                            objectiveBackAccent={objectiveBackAccent}
                            nonPickableBack={nonPickableBack}
                            stickyFingerSlotMark={stickyFingerSlotMark}
                            hostConsolidatesTileFrames={hostConsolidatesTileFrames}
                            hoverTiltRef={hoverTiltRef}
                            keyboardFocused={focusedTileId === tile.id}
                            pairProximityDistance={pairProximityDistance}
                            powerBackAccent={powerBackAccent}
                            tutorialPairOrdinal={tileTutorialPairOrdinal}
                            presentationNBackAnchor={presentationNBackAnchor}
                            presentationSilhouette={presentationSilhouette}
                            presentationWideRecall={presentationWideRecall}
                            spotlightBountyHighlight={spotlightBountyHighlight}
                            spotlightBountyOnBack={spotlightBountyOnBack}
                            spotlightWardHighlight={spotlightWardHighlight}
                            spotlightWardOnBack={spotlightWardOnBack}
                            interactionSuppressed={interactionSuppressed}
                            interactive={interactive}
                            isPinned={isPinned}
                            memorizeCurseHighlight={memorizeCurseHighlight}
                            onTilePick={onTilePick}
                            reduceMotion={reduceMotion}
                            resolvingMatchWaveKey={resolvingMatchWaveKey}
                            resolvingSelection={resolvingSelection}
                            shuffleBoardOrderIndex={shuffleBoardOrderIndex}
                            shuffleMotionBudgetMs={shuffleMotionBudgetMs}
                            shuffleMotionDeadlineMs={shuffleMotionDeadlineMs}
                            shuffleStaggerTileCount={shuffleStaggerTileCount}
                            boardEntranceMotionDeadlineMs={boardEntranceMotionDeadlineMs}
                            boardEntranceMotionBudgetMs={boardEntranceMotionBudgetMs}
                            boardEntranceStaggerTileCount={boardEntranceStaggerTileCount}
                            boardRows={totalRows}
                            boardColumns={totalColumns}
                            sharedCardBackLayers={sharedCardBackLayers}
                            sharedCardFrontGeometry={sharedCardFrontGeometry}
                            textureRevision={textureRevision}
                            tile={tile}
                            transform={transform}
                            graphicsQuality={graphicsQuality}
                        />
                    )
                )}
                {enemyHazardRows.map(({ hazard, currentTransform, nextTransform }) => (
                    <EnemyHazardMarker
                        key={hazard.id}
                        currentTransform={currentTransform}
                        graphicsQuality={graphicsQuality}
                        hazard={hazard}
                        nextTransform={nextTransform}
                        reduceMotion={reduceMotion}
                    />
                ))}
            </group>
        </>
        </TilePickMeshRegistryContext.Provider>
        </TileBezelFrameRegistryContext.Provider>
    );
});

TileBoardScene.displayName = 'TileBoardScene';

export default TileBoardScene;
