import { useFrame, useThree } from '@react-three/fiber';
import {
    forwardRef,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    type MutableRefObject
} from 'react';
import {
    type Group,
    type Mesh
} from 'three';
import type { BoardState, GraphicsQualityPreset, RunStatus } from '../../shared/contracts';
import {
    CARD_PLANE_HEIGHT,
    CARD_PLANE_WIDTH,
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
import { shouldApplyTileFieldParallax } from './tileFieldTilt';
import {
    getResolvingMatchWaveKey
} from './tileResolvingSelection';
import { createRafCoalescedViewportNotifier, type TileBoardViewportState } from './tileBoardViewport';
import { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import { TileBoardSceneLights } from './TileBoardSceneLights';
import {
    type TileHoverTiltState
} from './TileBezel';
import {
    TileBezelFrameRegistryContext,
    TilePickMeshRegistryContext
} from './tileBoardSceneRegistries';
import {
    type TileBoardRuneFieldUniformTarget
} from './tileBoardRuneField';
import { buildTileBoardSceneModel } from './tileBoardSceneModel';
import {
    applyInitialTileBoardViewportMotionState,
    computeInitialTileBoardViewportMotionState
} from './tileBoardViewportMotionState';
import {
    useTileBoardItemRegistry
} from './tileBoardRegistry';
import type { TileBezelFrameBag } from './tileBoardFrameBag';
import { advanceTileBezelFrame } from './tileBoardFrameAdvance';
import { useTileBoardSharedCardSvgAssets } from './useTileBoardSharedCardSvgAssets';
import { useTileBoardTextureRevision } from './useTileBoardTextureRevision';
import { runTileBoardSceneFrame } from './tileBoardSceneFrame';
import { TileBoardSceneBoardGroup } from './TileBoardSceneBoardGroup';
import { useTileBoardSceneResources } from './useTileBoardSceneResources';
import {
    useTileBoardSceneImperativeHandle,
    type TileBoardSceneHandle
} from './useTileBoardSceneImperativeHandle';

export type { TileHoverTiltState } from './TileBezel';

/** FX-006 / HOVER_DOM_WEBGL_TOKENS: border emphasis -> warm tint lerp (~20% toward `#fff0d4` in sRGB mix space). */
/** Glass decoy pair key - keep in sync with `game.ts`. */
const EMPTY_TILE_IDS: ReadonlySet<string> = new Set();
/** Emissive base (theme `goldBright`); intensity scaled by graphics quality when DOM-hover-parity applies. */
/** Matched face tint on `low` only (no ember-rim shader); medium+ relies on the edge effect + neutral card albedo. */
/** CARD-018: warm pin read blended on top of resolving face tints. */
/** `n_back_anchor` presentation mutator - forward-read cyan (matches theme `cyanBright`). */
/** `wide_recall` - cooler, slightly desaturated face during play. */
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
    /** From `usePlatformTiltField` / `useParallaxMotionSuppressed` - must gate field parallax with `shouldApplyTileFieldParallax`. */
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
    /** New-board deal-in window (exclusive with shuffle XY motion - shuffle wins). */
    boardEntranceMotionDeadlineMs: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceStaggerTileCount: number;
    /** Hidden tiles to de-emphasize when focus-assist is on (matches 2D `.tileFocusDim`). */
    dimmedTileIds?: ReadonlySet<string>;
    /** When true with two flips, allow picking a third tile (gambit) instead of locking hidden tiles. */
    allowGambitThirdFlip?: boolean;
    /** PERF-007: caps texture anisotropy vs device max. */
    graphicsQuality?: GraphicsQualityPreset;
    /** Keyboard focus ring target - only set while the board application region is actually focused (see `TileBoard`; WebGL canvas is `aria-hidden`, SR uses the app region + live region). */
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
    tileSwapPowerVisualActive?: boolean;
    tileSwapEligibleTileIds?: ReadonlySet<string>;
    tileSwapFirstTileId?: string | null;
    pinModeBoardHintActive?: boolean;
    /** `sticky_fingers`: tile id at `stickyBlockIndex` while the next opening flip is restricted. */
    stickyBlockedTileId?: string | null;
}

export type { TileBoardSceneHandle } from './useTileBoardSceneImperativeHandle';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
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
    tileSwapPowerVisualActive = false,
    tileSwapEligibleTileIds = EMPTY_TILE_IDS,
    tileSwapFirstTileId = null,
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
    const textureRevision = useTileBoardTextureRevision();
    const { sharedCardBackLayers, sharedCardFrontGeometry } = useTileBoardSharedCardSvgAssets();

    const tileStepLegacy = useMemo(() => readTileStepLegacy(), []);
    const hostConsolidatesTileFrames = !tileStepLegacy;
    const {
        boardRuneFieldMetrics,
        enemyHazardRows,
        flipLocked,
        overlayPrewarmDemandPairKeys,
        tileBezelRows
    } = useMemo(() => {
        return buildTileBoardSceneModel({
            allowGambitThirdFlip,
            board,
            bountyPairKey,
            cardHeight: CARD_HEIGHT,
            cardWidth: CARD_WIDTH,
            compact,
            cursedPairKey,
            debugPeekActive,
            destroyEligibleTileIds,
            destroyPowerVisualActive,
            dimmedTileIds,
            interactionSuppressed,
            interactive,
            nBackAnchorPairKey,
            nBackMutatorActive,
            pairProximityHintsEnabled,
            peekEligibleTileIds,
            peekPowerVisualActive,
            peekRevealedTileIds,
            pinModeBoardHintActive,
            pinnedTileIds,
            previewActive,
            reduceMotion,
            runStatus,
            shiftingSpotlightActive,
            showTutorialPairMarkers,
            silhouetteDuringPlay,
            strayEligibleTileIds,
            strayPowerVisualActive,
            stickyBlockedTileId,
            tileSwapEligibleTileIds,
            tileSwapFirstTileId,
            tileSwapPowerVisualActive,
            tileSpacing: TILE_SPACING,
            wardPairKey,
            wideRecallInPlay
        });
    }, [
        allowGambitThirdFlip,
        board,
        bountyPairKey,
        compact,
        cursedPairKey,
        debugPeekActive,
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        dimmedTileIds,
        interactionSuppressed,
        interactive,
        nBackAnchorPairKey,
        nBackMutatorActive,
        pairProximityHintsEnabled,
        peekEligibleTileIds,
        peekPowerVisualActive,
        peekRevealedTileIds,
        pinModeBoardHintActive,
        pinnedTileIds,
        previewActive,
        reduceMotion,
        runStatus,
        shiftingSpotlightActive,
        showTutorialPairMarkers,
        silhouetteDuringPlay,
        strayEligibleTileIds,
        strayPowerVisualActive,
        stickyBlockedTileId,
        tileSwapEligibleTileIds,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive,
        wardPairKey,
        wideRecallInPlay
    ]);
    const {
        boardRuneFieldGeometry,
        boardRuneFieldMaterial,
        boardRuneFieldMatRef
    } = useTileBoardSceneResources({
        boardRuneFieldMetrics,
        gl,
        graphicsQuality,
        overlayPrewarmDemandPairKeys,
        textureRevision
    });
    const boardGroupRef = useRef<Group | null>(null);
    const tileFrameBagsRef = useRef(new Map<string, TileBezelFrameBag>());
    const tileFrameIdleStreakRef = useRef(new Map<string, number>());
    const tilePickMeshesRef = useRef(new Map<string, Mesh>());
    const tileFrameRegistry = useTileBoardItemRegistry(tileFrameBagsRef, {
        clearOnRegister: tileFrameIdleStreakRef,
        clearOnUnregister: tileFrameIdleStreakRef
    });
    const pickMeshRegistry = useTileBoardItemRegistry(tilePickMeshesRef);

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

    useTileBoardSceneImperativeHandle({
        boardGroupRef,
        camera,
        gl,
        onTilePick,
        ref,
        tilePickMeshesRef
    });

    useLayoutEffect(() => {
        const boardGroup = boardGroupRef.current;

        if (!boardGroup) {
            return;
        }

        applyInitialTileBoardViewportMotionState(
            boardGroup,
            computeInitialTileBoardViewportMotionState({ boardViewport })
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only; useFrame updates boardGroup each frame

    useFrame((state, delta) => {
        const perfOn = boardWebglPerfSampleEnabled() || boardWebglPerfSampleVerboseEnabled();
        runTileBoardSceneFrame({
            accumulatePerfPhases: boardWebglPerfSampleAccumulatePhases,
            advanceTileFrame: (bag) => advanceTileBezelFrame(bag, state, delta),
            bags: tileFrameBagsRef.current,
            boardGroup: boardGroupRef.current,
            boardRuneFieldMetrics,
            boardViewport,
            clockElapsedTime: state.clock.elapsedTime,
            delta,
            idleStreaks: tileFrameIdleStreakRef.current,
            interactionSuppressed,
            now: () => performance.now(),
            perfOn,
            reduceMotion,
            runeFieldUniforms: (boardRuneFieldMatRef.current?.uniforms as TileBoardRuneFieldUniformTarget | undefined) ?? null,
            sceneRenderQuality,
            tileStepLegacy
        });
    });

    return (
        <TileBezelFrameRegistryContext.Provider value={tileFrameRegistry}>
        <TilePickMeshRegistryContext.Provider value={pickMeshRegistry}>
        <>
            <TileBoardSceneLights colors={colors} compact={compact} renderQuality={sceneRenderQuality} />

            <TileBoardSceneBoardGroup
                boardColumns={totalColumns}
                boardEntranceMotionBudgetMs={boardEntranceMotionBudgetMs}
                boardEntranceMotionDeadlineMs={boardEntranceMotionDeadlineMs}
                boardEntranceStaggerTileCount={boardEntranceStaggerTileCount}
                boardGroupRef={boardGroupRef}
                boardRows={totalRows}
                boardRuneFieldGeometry={boardRuneFieldGeometry}
                boardRuneFieldMaterial={boardRuneFieldMaterial}
                boardRuneFieldMatRef={boardRuneFieldMatRef}
                boardRuneFieldMetrics={boardRuneFieldMetrics}
                enemyHazardRows={enemyHazardRows}
                fieldTiltRef={fieldTiltRef}
                flipLocked={flipLocked}
                focusedTileId={focusedTileId}
                graphicsQuality={graphicsQuality}
                hostConsolidatesTileFrames={hostConsolidatesTileFrames}
                hoverTiltRef={hoverTiltRef}
                interactionSuppressed={interactionSuppressed}
                interactive={interactive}
                onTilePick={onTilePick}
                reduceMotion={reduceMotion}
                resolvingMatchWaveKey={resolvingMatchWaveKey}
                sharedCardBackLayers={sharedCardBackLayers}
                sharedCardFrontGeometry={sharedCardFrontGeometry}
                shuffleMotionBudgetMs={shuffleMotionBudgetMs}
                shuffleMotionDeadlineMs={shuffleMotionDeadlineMs}
                shuffleStaggerTileCount={shuffleStaggerTileCount}
                textureRevision={textureRevision}
                tileBezelRows={tileBezelRows}
                tileFieldParallaxEnabled={tileFieldParallaxEnabled}
            />
        </>
        </TilePickMeshRegistryContext.Provider>
        </TileBezelFrameRegistryContext.Provider>
    );
});

TileBoardScene.displayName = 'TileBoardScene';

export default TileBoardScene;
