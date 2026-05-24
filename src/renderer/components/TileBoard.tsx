import { Canvas } from '@react-three/fiber';
import {
    Component,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type FocusEvent,
    type ReactNode
} from 'react';
import { flushSync } from 'react-dom';
import type { BoardScreenSpaceAA, BoardState, GraphicsQualityPreset, RunStatus, Tile } from '../../shared/contracts';
import { getFindableRewardText } from '../../shared/findables';
import { getDungeonCardCopy } from '../../shared/dungeon-rules';
import { getDungeonCardKnowledge } from '../../shared/dungeon-cards';
import { getHazardTileTelegraph } from '../../shared/hazard-tiles';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import { resolveAdaptiveBoardRenderQuality } from '../../shared/graphicsQuality';
import { isNarrowShortLandscapeForMenuStack, VIEWPORT_MOBILE_MAX } from '../breakpoints';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { useViewportSize } from '../hooks/useViewportSize';
import { getMotionPermissionButtonLabels, shouldOfferDeviceMotionPermission } from '../platformTilt/platformTiltPermissionUi';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import styles from './TileBoard.module.css';
import { playShuffleSfx, resumeAudioContext } from '../audio/gameSfx';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';
import { pairProximityUiStrings } from '../ui/strings/pairProximityUi';
import { isTilePickable } from './tileBoardPick';
import TileBoardPostFx from './TileBoardPostFx';
import TileBoardScene, { type TileBoardSceneHandle, type TileHoverTiltState } from './TileBoardScene';
import { getResolvingSelectionState } from './tileResolvingSelection';
import { DUNGEON_BOARD_STAGE_LAYER_POLICY, DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET } from './tileBoardStageLayers';
import {
    COMPACT_BOARD_FIT_MARGIN,
    MOBILE_CAMERA_FIT_MARGIN,
    ROOMY_BOARD_FIT_MARGIN,
    carryBoardViewportForward,
    clampBoardZoom,
    clampBoardViewport,
    createFittedBoardViewport,
    getBoardFitZoom,
    screenPointToWorld,
    type TileBoardViewportMetrics,
    type TileBoardViewportState
} from './tileBoardViewport';
import { BOARD_LAYOUT_VIEWPORT_PADDING, TILE_SPACING } from './tileShatter';
import { computeBoardEntranceMotionBudgetMs, computeShuffleMotionBudgetMs } from './shuffleFlipAnimation';
import { boardWebglPerfSampleRecordReactCommit, boardWebglPerfSampleVerboseEnabled } from '../dev/boardWebglPerfSample';
import { preloadTileTextureImages } from './tileTextures';
import {
    DNG065_BOARD_APPLICATION_LABEL,
    DNG065_DUNGEON_COMFORT_FOCUS_ORDER,
    DNG065_MOBILE_BOARD_PRIORITY,
    REG103_BOARD_TOUCH_ACTION,
    REG105_DATA_DAIS,
    REG105_DATA_STAGEVIEW
} from '../gameplay/regPhase4PlayContract';

/** Minimum time the pre-board “gather / release” motif stays visible while GPU warm-up runs in parallel. */
const BOARD_PRESTAGE_DWELL_MS = 360;

/** Decorative deck cards in the prestaging overlay (must match `--prestage-cards` in CSS math). */
const PRESTAGE_CARD_COUNT = 8;

export type TileBoardClientRect = {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
};

export type TileBoardHandle = {
    getTileClientRectAtGrid: (row: number, col: number) => TileBoardClientRect | null;
    getTileClientRectById: (tileId: string) => TileBoardClientRect | null;
    runShuffleAnimation: (applyShuffle: () => void) => void;
};

interface TileBoardProps {
    board: BoardState;
    debugPeekActive: boolean;
    interactive: boolean;
    mobileCameraMode: boolean;
    pinnedTileIds?: string[];
    previewActive: boolean;
    reduceMotion: boolean;
    /** When `auto`, matches legacy: SMAA when motion is on, MSAA when Reduce Motion is on. */
    boardScreenSpaceAA?: BoardScreenSpaceAA;
    graphicsQuality?: GraphicsQualityPreset;
    boardBloomEnabled?: boolean;
    viewportResetToken: number;
    frameStyle?: CSSProperties;
    /** Hidden tiles to dim when focus-assist is on (2D fallback and WebGL scene). */
    dimmedTileIds?: ReadonlySet<string>;
    /** REG-026: optional guided first-run target ids; keyboard focus/picking starts with these tiles. */
    guidedTargetTileIds?: readonly string[];
    peekRevealedTileIds?: string[];
    allowGambitThirdFlip?: boolean;
    wideRecallInPlay?: boolean;
    silhouetteDuringPlay?: boolean;
    nBackAnchorPairKey?: string | null;
    nBackMutatorActive?: boolean;
    /** Memorize-phase marker for the cursed pair objective (non-color-only ring). */
    cursedPairKey?: string | null;
    /** `shifting_spotlight`: current ward pair (lower match score if matched now). */
    wardPairKey?: string | null;
    /** `shifting_spotlight`: current bounty pair (bonus if matched now). */
    bountyPairKey?: string | null;
    runStatus?: RunStatus;
    /**
     * When false, hides early-tutorial **pair marker** chrome (face-down tiles: DOM inset ring + WebGL back-face badge).
     */
    showTutorialPairMarkers?: boolean;
    /** Guided first-run target tiles that should remain visually emphasized while prompts teach by doing. */
    onboardingTargetTileIds?: readonly string[];
    /** Distance-to-pair badge on flipped tiles (Manhattan grid steps). */
    pairProximityHintsEnabled?: boolean;
    onTileSelect: (tileId: string) => void;
    /** `shifting_spotlight` — show ward/bounty corner markers on face-down tiles. */
    shiftingSpotlightActive?: boolean;
    /** Board power affordances: destroy pair armed and valid run + board state. */
    destroyPowerVisualActive?: boolean;
    destroyEligibleTileIds?: ReadonlySet<string>;
    peekPowerVisualActive?: boolean;
    peekEligibleTileIds?: ReadonlySet<string>;
    strayPowerVisualActive?: boolean;
    strayEligibleTileIds?: ReadonlySet<string>;
    pinModeBoardHintActive?: boolean;
    /** Effective SFX gain (0–1) for shuffle whoosh; from settings in GameScreen. */
    shuffleSfxGain?: number;
    /** Sticky fingers: board slot that cannot start the next pair (from `RunState.stickyBlockIndex`). */
    stickyBlockedTileId?: string | null;
    /** Fired once the board has finished prestage/deal-in and is stable enough to begin memorize timing. */
    onMemorizeBoardReady?: (boardKey: string) => void;
}

interface StageWorldViewport {
    height: number;
    width: number;
}

interface TouchPoint {
    clientX: number;
    clientY: number;
}

interface TouchGestureSnapshot {
    anchorBoardX: number;
    anchorBoardY: number;
    pointerIds: [number, number];
    startDistance: number;
    startZoom: number;
}

interface MouseDragSnapshot {
    dragActive: boolean;
    pickOnRelease: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    startWorldX: number;
    startWorldY: number;
}

const MOUSE_PAN_DRAG_THRESHOLD_PX = 8;
const DECOY_PAIR_KEY = '__decoy__';

const EMPTY_TILE_IDS: ReadonlySet<string> = new Set();

const PRELOAD_READY_TIMEOUT_MS = 320;

const canUseWebGL = (): boolean => {
    if (typeof document === 'undefined') {
        return false;
    }

    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'));
    } catch {
        return false;
    }
};

const getTilePosition = (index: number, columns: number): { row: number; column: number } => ({
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1
});

const getDungeonCardText = (tile: Tile): string => {
    const copy = getDungeonCardCopy(tile);
    return copy ? ` ${copy}` : '';
};

const getEnemyHazardText = (board: BoardState, tileId: string): string => {
    const hazard = board.enemyHazards?.find((candidate) => candidate.currentTileId === tileId && candidate.state !== 'defeated');
    if (hazard) {
        const revealed = hazard.state === 'revealed' ? 'revealed ' : 'hidden ';
        return ` Occupied by ${revealed}moving enemy patrol ${hazard.label}, ${hazard.hp}/${hazard.maxHp} HP, ${hazard.damage} damage.`;
    }
    const nextHazard = board.enemyHazards?.find((candidate) => candidate.nextTileId === tileId && candidate.state !== 'defeated');
    return nextHazard
        ? ` Next target of moving enemy patrol ${nextHazard.label}, ${nextHazard.hp}/${nextHazard.maxHp} HP, ${nextHazard.damage} damage.`
        : '';
};

const getHazardTileText = (tile: Tile): string => {
    const telegraph = getHazardTileTelegraph(tile);
    return telegraph.hasHazard && telegraph.label && telegraph.telegraph
        ? ` Hazard tile: ${telegraph.label}. ${telegraph.telegraph}`
        : '';
};

const getTileAriaLabel = (board: BoardState, tile: Tile, faceUp: boolean, row: number, column: number): string => {
    const base = faceUp
        ? tile.pairKey === DECOY_PAIR_KEY
            ? `Decoy trap tile, row ${row}, column ${column}. It never forms a pair.`
            : `Tile ${tile.label}, row ${row}, column ${column}`
        : `Hidden tile, row ${row}, column ${column}`;
    const findableNote = tile.findableKind && faceUp && tile.state !== 'matched' ? ` ${getFindableRewardText(tile.findableKind)}` : '';
    const scoutSourceNote =
        tile.scoutRevealSource === 'omen_seal'
            ? ' Scouted by Omen Seal.'
            : tile.scoutRevealSource === 'lantern_ward' || tile.lanternScouted
              ? ' Scouted by Lantern Ward.'
              : '';
    const routeNote =
        (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched'
            ? ` Route card: ${
                  tile.routeSpecialKind
                      ? `${routeSpecialLabel(tile.routeSpecialKind)}. ${routeSpecialRewardLine(tile.routeSpecialKind)}`
                      : tile.routeCardKind === 'safe_ward'
                        ? 'Safe ward.'
                        : tile.routeCardKind === 'greed_cache'
                          ? 'Greed cache.'
                          : 'Mystery veil.'
              }${
                  (tile.routeSpecialKind === 'mystery_veil' ||
                      tile.routeSpecialKind === 'secret_door' ||
                      tile.routeSpecialKind === 'omen_seal' ||
                      tile.routeSpecialKind === 'mimic_cache' ||
                      tile.routeSpecialKind === 'loaded_gateway' ||
                      tile.routeSpecialKind === 'parasite_vessel') &&
                  tile.routeSpecialRevealed
                      ? tile.routeSpecialRevealSource === 'lantern_ward'
                          ? ' Scouted by Lantern Ward.'
                          : tile.routeSpecialRevealSource === 'omen_seal'
                            ? ' Scouted by Omen Seal.'
                          : ' Revealed by peek.'
                      : ''
              }`
            : '';
    const dungeonKnowledge = getDungeonCardKnowledge(tile, faceUp);
    const dungeonNote = dungeonKnowledge.familyKnown ? getDungeonCardText(tile) : '';
    const passiveScoutNote = scoutSourceNote && !routeNote.includes(scoutSourceNote.trim()) ? scoutSourceNote : '';
    return `${base}${findableNote}${routeNote}${dungeonNote}${getHazardTileText(tile)}${passiveScoutNote}${getEnemyHazardText(board, tile.id)}`;
};

const getPowerTargetAriaText = (
    tile: Tile,
    destroyPowerVisualActive: boolean,
    destroyEligibleTileIds: ReadonlySet<string>,
    peekPowerVisualActive: boolean,
    peekEligibleTileIds: ReadonlySet<string>,
    strayPowerVisualActive: boolean,
    strayEligibleTileIds: ReadonlySet<string>
): string => {
    if (destroyPowerVisualActive) {
        if (destroyEligibleTileIds.has(tile.id)) {
            return ' Destroy target: valid. Forfeits match score and pickups or rewards on this pair.';
        }
        return tile.state === 'hidden' ? ' Destroy target: invalid for this power.' : '';
    }
    if (peekPowerVisualActive) {
        return peekEligibleTileIds.has(tile.id)
            ? ' Peek target: valid. Reveals this one tile and locks Perfect Memory.'
            : tile.state === 'hidden'
              ? ' Peek target: invalid or already revealed.'
              : '';
    }
    if (strayPowerVisualActive) {
        return strayEligibleTileIds.has(tile.id)
            ? ' Stray target: valid. Removes this safe singleton tile from play and locks Perfect Memory.'
            : tile.state === 'hidden'
              ? ' Stray target: invalid, paired, or protected.'
              : '';
    }
    return '';
};

const getTouchCentroid = (first: TouchPoint, second: TouchPoint): TouchPoint => ({
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2
});

const getTouchDistance = (first: TouchPoint, second: TouchPoint): number =>
    Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));

const getPickableTileIds = (board: BoardState, interactive: boolean, allowGambitThirdFlip: boolean): string[] => {
    const flippedN = board.flippedTileIds.length;
    const flipLocked = flippedN >= 2 && !(allowGambitThirdFlip && flippedN === 2);
    const ids: string[] = [];
    for (const tile of board.tiles) {
        if (tile.state === 'removed') {
            continue;
        }
        if (isTilePickable(tile, interactive, flipLocked)) {
            ids.push(tile.id);
        }
    }
    return ids;
};

const gridIndexFromTileId = (board: BoardState, tileId: string): number => {
    const i = board.tiles.findIndex((t) => t.id === tileId);
    return i >= 0 ? i : 0;
};

const moveFocusInGrid = (
    board: BoardState,
    fromId: string | null,
    dir: 'up' | 'down' | 'left' | 'right',
    interactive: boolean,
    allowGambitThirdFlip: boolean
): string | null => {
    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
    if (pickable.size === 0) {
        return null;
    }
    const cols = board.columns;
    const rows = board.rows;
    let startIdx = 0;
    if (fromId && pickable.has(fromId)) {
        startIdx = gridIndexFromTileId(board, fromId);
    } else {
        const firstPickable = board.tiles.find((t) => pickable.has(t.id));
        startIdx = firstPickable ? gridIndexFromTileId(board, firstPickable.id) : 0;
    }
    const r = Math.floor(startIdx / cols);
    const c = startIdx % cols;
    const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const t = board.tiles[nr * cols + nc];
        if (t.state !== 'removed' && pickable.has(t.id)) {
            return t.id;
        }
        nr += dr;
        nc += dc;
    }
    return fromId;
};

class TileBoardErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    render(): ReactNode {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

// FX-016 matrix: docs/new_design/FX_REDUCE_MOTION_MATRIX.md
const TileBoard = forwardRef<TileBoardHandle, TileBoardProps>(function TileBoard(
    {
        board,
        debugPeekActive,
        interactive,
        mobileCameraMode,
        pinnedTileIds = [],
        previewActive,
        reduceMotion,
        boardScreenSpaceAA = 'auto',
        graphicsQuality = 'medium',
        boardBloomEnabled = false,
        viewportResetToken,
        frameStyle,
        dimmedTileIds,
        guidedTargetTileIds = [],
        peekRevealedTileIds = [],
        allowGambitThirdFlip = false,
        wideRecallInPlay = false,
        silhouetteDuringPlay = false,
        nBackAnchorPairKey = null,
        nBackMutatorActive = false,
        cursedPairKey = null,
        wardPairKey = null,
        bountyPairKey = null,
        runStatus = 'playing',
        showTutorialPairMarkers = true,
        pairProximityHintsEnabled = true,
        onTileSelect,
        shiftingSpotlightActive = false,
        destroyPowerVisualActive = false,
        destroyEligibleTileIds = EMPTY_TILE_IDS,
        peekPowerVisualActive = false,
        peekEligibleTileIds = EMPTY_TILE_IDS,
        strayPowerVisualActive = false,
        strayEligibleTileIds = EMPTY_TILE_IDS,
        pinModeBoardHintActive = false,
        shuffleSfxGain = 1,
        stickyBlockedTileId = null,
        onMemorizeBoardReady
    },
    ref
) {
    const { height, width } = useViewportSize();
    const peekSet = useMemo(() => new Set(peekRevealedTileIds), [peekRevealedTileIds]);
    const compact =
        width <= VIEWPORT_MOBILE_MAX || isNarrowShortLandscapeForMenuStack(width, height);
    const touchPrimary = useCoarsePointer();
    const baselineWebGl = useMemo(() => canUseWebGL(), []);
    const [gpuSurfaceLost, setGpuSurfaceLost] = useState(false);
    /** Bumped after `webglcontextrestored` so Canvas/scene remounts with a fresh GL context (REF-078). */
    const [webglCanvasRemountKey, setWebglCanvasRemountKey] = useState(0);
    const webglContextListenersCleanupRef = useRef<(() => void) | null>(null);
    const boardGraphicsOk = baselineWebGl && !gpuSurfaceLost;
    const cameraViewportMode = mobileCameraMode && boardGraphicsOk;
    const touchGestureMode = cameraViewportMode && touchPrimary;
    /** Mouse wheel / drag pan remains available with WebGL, including hybrid touch + pointer devices. */
    const desktopCameraMode = boardGraphicsOk;
    const frameRef = useRef<HTMLDivElement>(null);
    const boardAppRef = useRef<HTMLDivElement>(null);
    const shuffleClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const entranceClearTimeoutRef = useRef<number | null>(null);
    const [shuffleAnimating, setShuffleAnimating] = useState(false);
    const [shuffleMotionDeadlineMs, setShuffleMotionDeadlineMs] = useState(0);
    /** Mirrors FLIP motion budget for WebGL FX-013 staggered deal-Z (0 = inactive). */
    const [shuffleMotionBudgetMs, setShuffleMotionBudgetMs] = useState(0);
    const [shuffleStaggerTileCount, setShuffleStaggerTileCount] = useState(0);
    const [boardEntranceMotionDeadlineMs, setBoardEntranceMotionDeadlineMs] = useState(0);
    const [boardEntranceMotionBudgetMs, setBoardEntranceMotionBudgetMs] = useState(0);
    const [boardEntranceStaggerTileCount, setBoardEntranceStaggerTileCount] = useState(0);
    const [boardEntranceAnimating, setBoardEntranceAnimating] = useState(false);
    const [boardPreStage, setBoardPreStage] = useState<'dealIn' | 'idle' | 'loading'>('idle');
    const prestageRunIdRef = useRef(0);
    const sceneHandleRef = useRef<TileBoardSceneHandle | null>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const hoverTiltRef = useRef<TileHoverTiltState>({ tileId: null, x: 0, y: 0 });
    const activeTouchPointsRef = useRef<Map<number, TouchPoint>>(new Map());
    const gestureSnapshotRef = useRef<TouchGestureSnapshot | null>(null);
    const mouseDragSnapshotRef = useRef<MouseDragSnapshot | null>(null);
    const gestureActiveRef = useRef(false);
    const selectionSuppressedRef = useRef(false);
    const [gestureActive, setGestureActive] = useState(false);
    const [selectionSuppressed, setSelectionSuppressed] = useState(false);
    const [stageWorldViewport, setStageWorldViewport] = useState<StageWorldViewport>({ height: 0, width: 0 });
    const [viewportState, setViewportState] = useState<TileBoardViewportState>(() => createFittedBoardViewport(1));
    const viewportStateRef = useRef<TileBoardViewportState>(viewportState);
    const viewportMetricsRef = useRef<TileBoardViewportMetrics | null>(null);
    const viewportResetTokenRef = useRef(viewportResetToken);
    const [focusedTileId, setFocusedTileId] = useState<string | null>(null);
    /** When false, no tile should show the keyboard focus ring (avoids a permanent “hover” on first pickable tile). */
    const [boardApplicationFocused, setBoardApplicationFocused] = useState(false);
    const [boardLiveMessage, setBoardLiveMessage] = useState('');
    const [trapResolutionMessage, setTrapResolutionMessage] = useState('');
    const [lastResolutionFeedback, setLastResolutionFeedback] = useState('');
    const previousResolvedTrapTileCountRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            webglContextListenersCleanupRef.current?.();
            webglContextListenersCleanupRef.current = null;
        },
        []
    );
    const { tiltRef: fieldTiltRef, motionParallaxSuppressed, permission, requestMotionPermission } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: frameRef,
        strength: 1,
        suspended: gestureActive
    });
    const mergedFrameStyle = useMemo(() => ({ ...frameStyle }), [frameStyle]);

    const boardMotionAnimating =
        shuffleAnimating || boardEntranceAnimating || boardPreStage === 'loading';

    const boardRenderDigest = useMemo(
        () =>
            `${board.level}|${board.tiles.map((t) => `${t.id}:${t.state}`).join(',')}|${board.flippedTileIds.join(',')}`,
        [board.flippedTileIds, board.level, board.tiles]
    );

    useLayoutEffect(() => {
        if (!import.meta.env.DEV || !boardWebglPerfSampleVerboseEnabled()) {
            return;
        }

        const t0 = performance.now();
        queueMicrotask(() => {
            boardWebglPerfSampleRecordReactCommit(performance.now() - t0);
        });
    }, [boardRenderDigest]);

    const hiddenTileCount = useMemo(
        () => board.tiles.filter((t) => t.state === 'hidden').length,
        [board.tiles]
    );

    /** Row,col pairs for tiles still hidden — used by e2e (canvas picking has no per-tile DOM). */
    const hiddenSlotsAttr = useMemo(
        () =>
            board.tiles
                .map((tile, index) => {
                    if (tile.state !== 'hidden') {
                        return null;
                    }
                    const row = Math.floor(index / board.columns) + 1;
                    const col = (index % board.columns) + 1;
                    return `${row},${col}`;
                })
                .filter((v): v is string => v != null)
                .join(';'),
        [board.columns, board.tiles]
    );
    const hiddenTrapSlotsAttr = useMemo(() => {
        if (!import.meta.env.DEV) {
            return undefined;
        }
        return board.tiles
            .map((tile, index) => {
                if (tile.state !== 'hidden' || tile.dungeonCardKind !== 'trap' || tile.dungeonCardState !== 'hidden') {
                    return null;
                }
                const row = Math.floor(index / board.columns) + 1;
                const col = (index % board.columns) + 1;
                return `${row},${col}`;
            })
            .filter((v): v is string => v != null)
            .join(';');
    }, [board.columns, board.tiles]);
    const resolvedTrapSlotsAttr = useMemo(
        () =>
            board.tiles
                .map((tile, index) => {
                    if (tile.dungeonCardKind !== 'trap' || tile.dungeonCardState !== 'resolved') {
                        return null;
                    }
                    const row = Math.floor(index / board.columns) + 1;
                    const col = (index % board.columns) + 1;
                    return `${row},${col}`;
                })
                .filter((v): v is string => v != null)
                .join(';'),
        [board.columns, board.tiles]
    );
    const resolvedTrapTileCount = useMemo(
        () =>
            board.tiles.filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved')
                .length,
        [board.tiles]
    );
    const pickableHiddenSlotsAttr = useMemo(() => {
        if (!import.meta.env.DEV) {
            return undefined;
        }
        const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
        return board.tiles
            .map((tile, index) => {
                if (tile.state !== 'hidden' || !pickable.has(tile.id)) {
                    return null;
                }
                const row = Math.floor(index / board.columns) + 1;
                const col = (index % board.columns) + 1;
                return `${row},${col}`;
            })
            .filter((v): v is string => v != null)
            .join(';');
    }, [allowGambitThirdFlip, board, interactive]);

    const cardFeedbackStatesAttr = useMemo(() => {
        const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
        const counts = new Map<string, number>();
        const add = (key: string): void => {
            counts.set(key, (counts.get(key) ?? 0) + 1);
        };

        for (const tile of board.tiles) {
            if (tile.state === 'removed') {
                add('removed');
                continue;
            }

            const faceUp = tile.state !== 'hidden' || previewActive || debugPeekActive || peekSet.has(tile.id);
            const resolvingSelection = getResolvingSelectionState(board, runStatus, tile.id);

            if (tile.state === 'hidden' && !faceUp) {
                add('hidden');
            }
            if (faceUp && tile.state === 'flipped') {
                add('flipped');
            }
            if (tile.state === 'matched') {
                add('matched');
            }
            if (resolvingSelection) {
                add(resolvingSelection);
            }
            if (!pickable.has(tile.id) && tile.state !== 'matched') {
                add('non-pickable');
            }
            if (pickable.has(tile.id)) {
                add('pickable');
            }
            if (focusedTileId === tile.id && boardApplicationFocused) {
                add('focused');
            }
            if (tile.tileHazardKind) {
                add('hazard');
            }
            if (tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved') {
                add('trap-resolved');
            }
            if (tile.routeSpecialKind || tile.routeCardKind) {
                add('route');
            }
            if (tile.dungeonCardKind || tile.dungeonBossId) {
                add('objective');
            }
        }

        return [...counts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => `${key}:${count}`)
            .join(';');
    }, [
        allowGambitThirdFlip,
        board,
        boardApplicationFocused,
        debugPeekActive,
        focusedTileId,
        interactive,
        peekSet,
        previewActive,
        runStatus
    ]);

    useEffect(() => {
        const previous = previousResolvedTrapTileCountRef.current;
        previousResolvedTrapTileCountRef.current = resolvedTrapTileCount;
        if (previous == null || resolvedTrapTileCount <= previous) {
            return undefined;
        }

        const trapCount = Math.max(1, Math.round((resolvedTrapTileCount - previous) / 2));
        const trapLabel =
            board.tiles.find((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved')
                ?.label ?? 'Trap';
        const message =
            trapCount === 1
                ? `${trapLabel} resolved. Effect applied; next tile ready.`
                : `${trapCount} traps resolved. Effects applied; next tile ready.`;
        setTrapResolutionMessage(message);
        return undefined;
    }, [board.tiles, resolvedTrapTileCount]);

    useEffect(() => {
        if (resolvedTrapTileCount === 0 && trapResolutionMessage) {
            setTrapResolutionMessage('');
        }
    }, [resolvedTrapTileCount, trapResolutionMessage]);

    useEffect(() => {
        const counts = new Map<string, number>();
        for (const tile of board.tiles) {
            const resolvingSelection = getResolvingSelectionState(board, runStatus, tile.id);
            if (resolvingSelection === 'match' || resolvingSelection === 'mismatch') {
                counts.set(resolvingSelection, (counts.get(resolvingSelection) ?? 0) + 1);
            }
        }
        const next = [...counts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => `${key}:${count}`)
            .join(';');
        if (next) {
            // Keep the reduced-motion feedback test hook in lockstep with resolution state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLastResolutionFeedback(next);
        }
    }, [board, runStatus]);

    const boardEntranceKey = useMemo(
        () =>
            `${board.level}|${board.columns}x${board.rows}|${[...board.tiles].map((t) => t.id).sort().join('|')}`,
        [board.columns, board.level, board.rows, board.tiles]
    );
    const prevBoardEntranceKeyRef = useRef<string | null>(null);
    const notifiedBoardReadyKeyRef = useRef<string | null>(null);

    const notifyMemorizeBoardReady = useCallback(
        (key: string): void => {
            if (notifiedBoardReadyKeyRef.current === key) {
                return;
            }
            notifiedBoardReadyKeyRef.current = key;
            onMemorizeBoardReady?.(key);
        },
        [onMemorizeBoardReady]
    );

    useEffect(() => {
        if (reduceMotion) {
            prevBoardEntranceKeyRef.current = boardEntranceKey;
            queueMicrotask(() => {
                setBoardPreStage('idle');
                requestAnimationFrame(() => notifyMemorizeBoardReady(boardEntranceKey));
            });
            return;
        }
        if (prevBoardEntranceKeyRef.current === boardEntranceKey) {
            notifyMemorizeBoardReady(boardEntranceKey);
            return;
        }

        prestageRunIdRef.current += 1;
        const runId = prestageRunIdRef.current;
        queueMicrotask(() => {
            setBoardPreStage('loading');
        });

        const armEntrance = (): void => {
            const tileCountForBudget = board.tiles.filter((t) => t.state !== 'removed').length;
            const motionBudgetMs = computeBoardEntranceMotionBudgetMs(tileCountForBudget);
            const deadline = performance.now() + motionBudgetMs;

            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
                entranceClearTimeoutRef.current = null;
            }

            setBoardEntranceMotionDeadlineMs(deadline);
            setBoardEntranceMotionBudgetMs(motionBudgetMs);
            setBoardEntranceStaggerTileCount(tileCountForBudget);
            setBoardEntranceAnimating(true);
            setBoardPreStage('dealIn');

            entranceClearTimeoutRef.current = window.setTimeout(() => {
                prevBoardEntranceKeyRef.current = boardEntranceKey;
                setBoardEntranceMotionDeadlineMs(0);
                setBoardEntranceMotionBudgetMs(0);
                setBoardEntranceStaggerTileCount(0);
                setBoardEntranceAnimating(false);
                setBoardPreStage('idle');
                entranceClearTimeoutRef.current = null;
                requestAnimationFrame(() => notifyMemorizeBoardReady(boardEntranceKey));
            }, motionBudgetMs + 100);
        };

        void (async () => {
            const preloadReady = preloadTileTextureImages().catch(() => {
                /* resilient */
            });
            const preloadTimeout = new Promise<void>((resolve) => {
                window.setTimeout(resolve, PRELOAD_READY_TIMEOUT_MS);
            });

            await Promise.all([
                new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                }),
                new Promise<void>((resolve) => {
                    window.setTimeout(resolve, BOARD_PRESTAGE_DWELL_MS);
                }),
                Promise.race([preloadReady, preloadTimeout])
            ]);

            if (runId !== prestageRunIdRef.current) {
                return;
            }

            armEntrance();
        })();

        return () => {
            prestageRunIdRef.current += 1;
        };
    }, [board.tiles, boardEntranceKey, notifyMemorizeBoardReady, reduceMotion]);

    useEffect(
        () => () => {
            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
            }
        },
        []
    );

    /**
     * DEV-only: pairKey → two grid positions for Playwright (WebGL has no memorize-phase button aria-labels).
     * Omitted in production builds — see `e2e/memorizeSnapshot.ts` `readDevPairPositionsFromFrame`.
     */
    const devE2ePairPositionsJson = useMemo(() => {
        if (!import.meta.env.DEV) {
            return undefined;
        }
        const byKey: Record<string, { row: number; col: number }[]> = {};
        board.tiles.forEach((tile, index) => {
            const row = Math.floor(index / board.columns) + 1;
            const col = (index % board.columns) + 1;
            const k = tile.pairKey;
            if (!byKey[k]) {
                byKey[k] = [];
            }
            byKey[k]!.push({ row, col });
        });
        const keys = Object.keys(byKey).filter((k) => byKey[k]!.length === 2);
        if (keys.length < 2) {
            return undefined;
        }
        const slim: Record<string, { row: number; col: number }[]> = {};
        for (const k of keys) {
            slim[k] = byKey[k]!;
        }
        return JSON.stringify(slim);
    }, [board.columns, board.tiles]);

    useEffect(() => {
        const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
        queueMicrotask(() => {
            setFocusedTileId((cur) => {
                if (pickable.length === 0) {
                    return null;
                }
                if (cur && pickable.includes(cur)) {
                    return cur;
                }
                return null;
            });
        });
    }, [board, interactive, allowGambitThirdFlip]);

    const focusedTileLabel = useMemo(() => {
        if (!focusedTileId) {
            return '';
        }
        const idx = board.tiles.findIndex((t) => t.id === focusedTileId);
        if (idx < 0) {
            return '';
        }
        const tile = board.tiles[idx];
        const faceUp =
            tile.state !== 'hidden' || debugPeekActive || previewActive || peekSet.has(tile.id);
        const { row, column } = getTilePosition(idx, board.columns);
        let label = getTileAriaLabel(board, tile, faceUp, row, column);
        label += getPowerTargetAriaText(
            tile,
            destroyPowerVisualActive,
            destroyEligibleTileIds,
            peekPowerVisualActive,
            peekEligibleTileIds,
            strayPowerVisualActive,
            strayEligibleTileIds
        );
        if (
            pairProximityHintsEnabled &&
            (runStatus === 'playing' || runStatus === 'resolving') &&
            tile.state === 'flipped'
        ) {
            const d = getPairProximityGridDistance(board, tile.id);
            if (d != null) {
                label += pairProximityUiStrings.focusPairSteps(d);
            }
        }
        return label;
    }, [
        board,
        debugPeekActive,
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        focusedTileId,
        pairProximityHintsEnabled,
        peekEligibleTileIds,
        peekPowerVisualActive,
        peekSet,
        previewActive,
        runStatus,
        strayEligibleTileIds,
        strayPowerVisualActive
    ]);

    useEffect(() => {
        queueMicrotask(() => {
            if (!focusedTileLabel) {
                setBoardLiveMessage('');
                return;
            }
            setBoardLiveMessage(`Focus: ${focusedTileLabel}`);
        });
    }, [focusedTileLabel]);

    useImperativeHandle(ref, () => ({
        getTileClientRectAtGrid: (row: number, col: number) => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            const tile = board.tiles[r * board.columns + c];
            if (!tile) {
                return null;
            }
            return sceneHandleRef.current?.getTileClientRectById(tile.id) ?? null;
        },
        getTileClientRectById: (tileId: string) =>
            sceneHandleRef.current?.getTileClientRectById(tileId) ?? null,
        runShuffleAnimation: (applyShuffle: () => void) => {
            const g = shuffleSfxGain;
            prestageRunIdRef.current += 1;
            setBoardPreStage('idle');
            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
                entranceClearTimeoutRef.current = null;
            }
            setBoardEntranceMotionDeadlineMs(0);
            setBoardEntranceMotionBudgetMs(0);
            setBoardEntranceStaggerTileCount(0);
            setBoardEntranceAnimating(false);

            if (reduceMotion) {
                if (shuffleClearTimeoutRef.current) {
                    clearTimeout(shuffleClearTimeoutRef.current);
                    shuffleClearTimeoutRef.current = null;
                }
                setShuffleMotionDeadlineMs(0);
                setShuffleMotionBudgetMs(0);
                setShuffleStaggerTileCount(0);
                void resumeAudioContext();
                playShuffleSfx(g, true);
                applyShuffle();
                return;
            }

            void resumeAudioContext();
            playShuffleSfx(g, false);

            const tileCountForBudget = board.tiles.filter((t) => t.state !== 'removed').length;
            const motionBudgetMs = computeShuffleMotionBudgetMs(tileCountForBudget);

            if (shuffleClearTimeoutRef.current) {
                clearTimeout(shuffleClearTimeoutRef.current);
                shuffleClearTimeoutRef.current = null;
            }

            const deadline = performance.now() + motionBudgetMs;
            setShuffleMotionDeadlineMs(deadline);
            shuffleClearTimeoutRef.current = setTimeout(() => {
                setShuffleMotionDeadlineMs(0);
                setShuffleMotionBudgetMs(0);
                setShuffleStaggerTileCount(0);
                setShuffleAnimating(false);
                shuffleClearTimeoutRef.current = null;
            }, motionBudgetMs + 100);

            setShuffleMotionBudgetMs(motionBudgetMs);
            setShuffleStaggerTileCount(tileCountForBudget);
            setShuffleAnimating(true);

            flushSync(() => {
                applyShuffle();
            });
        }
    }), [board.columns, board.rows, board.tiles, reduceMotion, shuffleSfxGain]);

    useEffect(
        () => () => {
            if (shuffleClearTimeoutRef.current) {
                clearTimeout(shuffleClearTimeoutRef.current);
            }
        },
        []
    );
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const activeTileCount = useMemo(
        () => board.tiles.filter((t) => t.state !== 'removed').length,
        [board.tiles]
    );
    const adaptive = resolveAdaptiveBoardRenderQuality({
        activeTileCount,
        boardBloomEnabled: boardBloomEnabled ?? true,
        boardHeavyMotion: boardMotionAnimating,
        boardScreenSpaceAA: boardScreenSpaceAA ?? 'auto',
        compact,
        reduceMotion,
        savedGraphicsQuality: graphicsQuality ?? 'medium'
    });
    /** Cap DPR for GPU cost (PERF-001 + internal adaptive motion tier). */
    const dpr = Math.min(deviceDpr, adaptive.dprCap);
    const bloomEffective = adaptive.bloomPostEnabled;
    const resolvedBoardAa = adaptive.resolvedAa;
    /** MSAA on the default framebuffer; off when using SMAA post-pass or AA off. */
    const glAntialias = resolvedBoardAa === 'msaa';
    const boardWorldWidth = useMemo(
        () => (board.columns - 1) * TILE_SPACING + 1 + 2 * BOARD_LAYOUT_VIEWPORT_PADDING,
        [board.columns]
    );
    const boardWorldHeight = useMemo(
        () => (board.rows - 1) * TILE_SPACING + 1 + 2 * BOARD_LAYOUT_VIEWPORT_PADDING,
        [board.rows]
    );
    const fitMargin = cameraViewportMode ? MOBILE_CAMERA_FIT_MARGIN : compact ? COMPACT_BOARD_FIT_MARGIN : ROOMY_BOARD_FIT_MARGIN;
    const fitZoom = useMemo(
        () =>
            getBoardFitZoom({
                boardHeight: boardWorldHeight,
                boardWidth: boardWorldWidth,
                margin: fitMargin,
                viewportHeight: stageWorldViewport.height,
                viewportWidth: stageWorldViewport.width
            }),
        [boardWorldHeight, boardWorldWidth, fitMargin, stageWorldViewport.height, stageWorldViewport.width]
    );
    const renderedViewportState = useMemo(() => {
        if (!cameraViewportMode && !desktopCameraMode) {
            return createFittedBoardViewport(fitZoom);
        }

        return clampBoardViewport({
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            panX: viewportState.panX,
            panY: viewportState.panY,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width,
            zoom: viewportState.zoom
        });
    }, [
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        cameraViewportMode,
        desktopCameraMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        viewportState.panX,
        viewportState.panY,
        viewportState.zoom
    ]);

    const syncGestureActive = useCallback((active: boolean): void => {
        gestureActiveRef.current = active;
        setGestureActive((current) => (current === active ? current : active));
    }, [setGestureActive]);

    const syncSelectionSuppressed = useCallback((suppressed: boolean): void => {
        selectionSuppressedRef.current = suppressed;
        setSelectionSuppressed((current) => (current === suppressed ? current : suppressed));
    }, [setSelectionSuppressed]);

    const clearTouchGestureState = useCallback(
        (clearSuppression: boolean): void => {
            activeTouchPointsRef.current.clear();
            gestureSnapshotRef.current = null;
            syncGestureActive(false);
            if (clearSuppression) {
                syncSelectionSuppressed(false);
            }
        },
        [syncGestureActive, syncSelectionSuppressed]
    );

    const handleTileSelect = useCallback(
        (tileId: string): void => {
            if (selectionSuppressedRef.current) {
                return;
            }

            onTileSelect(tileId);
        },
        [onTileSelect]
    );

    const handleBoardApplicationFocus = useCallback((): void => {
        setBoardApplicationFocused(true);
        setFocusedTileId((cur) => {
            const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            if (pickable.length === 0) {
                return null;
            }
            if (cur && pickable.includes(cur)) {
                return cur;
            }
            return pickable[0];
        });
    }, [board, interactive, allowGambitThirdFlip, setBoardApplicationFocused, setFocusedTileId]);

    const handleBoardApplicationBlur = useCallback((event: FocusEvent<HTMLDivElement>): void => {
        const related = event.relatedTarget;
        if (related instanceof Node && boardAppRef.current?.contains(related)) {
            return;
        }
        setBoardApplicationFocused(false);
        setFocusedTileId(null);
    }, [setBoardApplicationFocused, setFocusedTileId]);

    const handleBoardApplicationKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>): void => {
            if (!boardGraphicsOk || !interactive) {
                return;
            }
            const rawPickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            const guidedPickable =
                guidedTargetTileIds.length > 0
                    ? rawPickable.filter((tileId) => guidedTargetTileIds.includes(tileId))
                    : rawPickable;
            const pickable = guidedPickable.length > 0 ? guidedPickable : rawPickable;
            if (pickable.length === 0) {
                return;
            }
            let dir: 'up' | 'down' | 'left' | 'right' | null = null;
            if (event.key === 'ArrowUp') dir = 'up';
            else if (event.key === 'ArrowDown') dir = 'down';
            else if (event.key === 'ArrowLeft') dir = 'left';
            else if (event.key === 'ArrowRight') dir = 'right';
            else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (focusedTileId) {
                    handleTileSelect(focusedTileId);
                }
                return;
            }
            if (dir) {
                event.preventDefault();
                const next = moveFocusInGrid(board, focusedTileId, dir, interactive, allowGambitThirdFlip);
                if (next && next !== focusedTileId) {
                    setFocusedTileId(next);
                }
            }
        },
        [
            allowGambitThirdFlip,
            board,
            boardGraphicsOk,
            focusedTileId,
            guidedTargetTileIds,
            handleTileSelect,
            interactive,
            setFocusedTileId
        ]
    );

    /**
     * DEV-only: absolute 1-based grid picks for Playwright. Keyboard nav skips non-pickable cells, so row/col offsets
     * from “first pickable” do not match memorize coordinates after the first match — see `e2e/tileBoardGameFlow.ts`.
     */
    useEffect(() => {
        if (!import.meta.env.DEV) {
            return undefined;
        }
        const w = window as Window & {
            __e2eGetTileClientRectAtGrid1?: (
                row: number,
                col: number
            ) => { bottom: number; height: number; left: number; right: number; top: number; width: number } | null;
            __e2eGetTileIdAtGrid1?: (row: number, col: number) => string | null;
            __e2ePanBoardBy?: (panX: number, panY: number) => void;
            __e2ePickTileAtGrid1?: (row: number, col: number) => void;
        };
        w.__e2eGetTileIdAtGrid1 = (row: number, col: number): string | null => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            return board.tiles[r * board.columns + c]?.id ?? null;
        };
        w.__e2eGetTileClientRectAtGrid1 = (row: number, col: number) => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            const tile = board.tiles[r * board.columns + c];
            if (!tile) {
                return null;
            }
            return sceneHandleRef.current?.getTileClientRectById(tile.id) ?? null;
        };
        w.__e2ePickTileAtGrid1 = (row: number, col: number): void => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return;
            }
            const tile = board.tiles[r * board.columns + c];
            if (tile) {
                handleTileSelect(tile.id);
            }
        };
        w.__e2ePanBoardBy = (panX: number, panY: number): void => {
            setViewportState((current) => {
                const nextViewport = clampBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    fitZoom,
                    panX: current.panX + panX,
                    panY: current.panY + panY,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                    zoom: current.zoom
                });

                viewportStateRef.current = nextViewport;
                return nextViewport;
            });
        };
        return () => {
            delete w.__e2eGetTileClientRectAtGrid1;
            delete w.__e2eGetTileIdAtGrid1;
            delete w.__e2ePanBoardBy;
            delete w.__e2ePickTileAtGrid1;
        };
    }, [
        board.columns,
        board.rows,
        board.tiles,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        handleTileSelect,
        stageWorldViewport.height,
        stageWorldViewport.width
    ]);

    const handleStageViewportChange = useCallback((nextViewport: StageWorldViewport): void => {
        setStageWorldViewport((current) =>
            Math.abs(current.width - nextViewport.width) < 0.0001 && Math.abs(current.height - nextViewport.height) < 0.0001
                ? current
                : nextViewport
        );
    }, [setStageWorldViewport]);

    useEffect(() => {
        viewportStateRef.current = renderedViewportState;
        viewportMetricsRef.current = {
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width
        };
    }, [
        renderedViewportState,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        stageWorldViewport.height,
        stageWorldViewport.width
    ]);

    useEffect(() => {
        hoverTiltRef.current = { tileId: null, x: 0, y: 0 };
    }, [board.level, board.tiles.length, reduceMotion, selectionSuppressed]);

    /* eslint-disable react-hooks/set-state-in-effect -- viewport React state must track fitted board geometry when the stage or board changes */
    useEffect(() => {
        const resetRequested = viewportResetToken !== viewportResetTokenRef.current;
        const previousViewport = viewportStateRef.current;
        const previousMetrics = viewportMetricsRef.current;
        const nextMetrics: TileBoardViewportMetrics = {
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width
        };

        viewportResetTokenRef.current = viewportResetToken;

        if (
            (!cameraViewportMode && !desktopCameraMode) ||
            stageWorldViewport.width <= 0 ||
            stageWorldViewport.height <= 0
        ) {
            const nextViewport = createFittedBoardViewport(fitZoom);
            viewportStateRef.current = nextViewport;
            viewportMetricsRef.current = nextMetrics;
            setViewportState(nextViewport);
            clearTouchGestureState(true);
            return;
        }

        const nextViewport =
            resetRequested || !previousMetrics
                ? createFittedBoardViewport(fitZoom)
                : carryBoardViewportForward({
                      nextMetrics,
                      previousMetrics,
                      previousViewport
                  });

        viewportStateRef.current = nextViewport;
        viewportMetricsRef.current = nextMetrics;
        setViewportState(nextViewport);
        clearTouchGestureState(true);
    }, [
        board.columns,
        board.level,
        board.rows,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        cameraViewportMode,
        desktopCameraMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        viewportResetToken,
        clearTouchGestureState
    ]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!touchGestureMode) {
            clearTouchGestureState(true); // eslint-disable-line react-hooks/set-state-in-effect -- reset gesture UI when leaving two-finger mode
            return;
        }

        const stageNode = stageRef.current;

        if (!stageNode) {
            return;
        }

        const stopGestureEvent = (event: globalThis.PointerEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };
        const stopTouchGestureEvent = (event: globalThis.TouchEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };

        const getTrackedGestureTouches = (): [TouchPoint, TouchPoint] | null => {
            const snapshot = gestureSnapshotRef.current;

            if (snapshot) {
                const first = activeTouchPointsRef.current.get(snapshot.pointerIds[0]);
                const second = activeTouchPointsRef.current.get(snapshot.pointerIds[1]);

                if (first && second) {
                    return [first, second];
                }
            }

            const touches = Array.from(activeTouchPointsRef.current.values()).slice(0, 2);

            return touches.length === 2 ? [touches[0], touches[1]] : null;
        };

        const beginGestureSession = (): void => {
            const touches = Array.from(activeTouchPointsRef.current.entries()).slice(0, 2);

            if (touches.length < 2 || stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            const [[firstPointerId, firstTouch], [secondPointerId, secondTouch]] = touches;
            const stageRect = stageNode.getBoundingClientRect();
            const centroid = getTouchCentroid(firstTouch, secondTouch);
            const centroidWorld = screenPointToWorld(centroid, stageRect, stageWorldViewport.width, stageWorldViewport.height);
            const activeViewport = viewportStateRef.current;
            const activeScale = Math.max(activeViewport.fitZoom * activeViewport.zoom, 0.0001);

            gestureSnapshotRef.current = {
                anchorBoardX: (centroidWorld.panX - activeViewport.panX) / activeScale,
                anchorBoardY: (centroidWorld.panY - activeViewport.panY) / activeScale,
                pointerIds: [firstPointerId, secondPointerId],
                startDistance: getTouchDistance(firstTouch, secondTouch),
                startZoom: activeViewport.zoom
            };

            syncGestureActive(true);
            syncSelectionSuppressed(true);
        };

        const updateGestureViewport = (): void => {
            const snapshot = gestureSnapshotRef.current;
            const trackedTouches = getTrackedGestureTouches();

            if (!snapshot || !trackedTouches) {
                return;
            }

            const [firstTouch, secondTouch] = trackedTouches;
            const stageRect = stageNode.getBoundingClientRect();
            const centroid = getTouchCentroid(firstTouch, secondTouch);
            const centroidWorld = screenPointToWorld(centroid, stageRect, stageWorldViewport.width, stageWorldViewport.height);
            const nextZoom = snapshot.startZoom * (getTouchDistance(firstTouch, secondTouch) / snapshot.startDistance);
            const nextPanX = centroidWorld.panX - snapshot.anchorBoardX * fitZoom * nextZoom;
            const nextPanY = centroidWorld.panY - snapshot.anchorBoardY * fitZoom * nextZoom;

            setViewportState((current) => {
                const nextViewport = clampBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    fitZoom,
                    panX: nextPanX,
                    panY: nextPanY,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                    zoom: nextZoom
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });
        };

        const handlePointerDown = (event: globalThis.PointerEvent): void => {
            if (event.pointerType !== 'touch') {
                return;
            }

            activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

            if (activeTouchPointsRef.current.size >= 2) {
                beginGestureSession();
                stopGestureEvent(event);
            }
        };

        const handlePointerMove = (event: globalThis.PointerEvent): void => {
            if (!activeTouchPointsRef.current.has(event.pointerId)) {
                return;
            }

            activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

            if (activeTouchPointsRef.current.size >= 2 && gestureSnapshotRef.current) {
                updateGestureViewport();
                stopGestureEvent(event);
                return;
            }

            if (selectionSuppressedRef.current) {
                stopGestureEvent(event);
            }
        };

        const handlePointerEnd = (event: globalThis.PointerEvent): void => {
            const wasTracked = activeTouchPointsRef.current.delete(event.pointerId);

            if (!wasTracked && !selectionSuppressedRef.current) {
                return;
            }

            if (selectionSuppressedRef.current) {
                stopGestureEvent(event);
            }

            if (activeTouchPointsRef.current.size >= 2) {
                beginGestureSession();
                return;
            }

            gestureSnapshotRef.current = null;
            syncGestureActive(false);

            if (activeTouchPointsRef.current.size === 0) {
                syncSelectionSuppressed(false);
            }
        };

        const syncTouchList = (touches: TouchList): void => {
            activeTouchPointsRef.current.clear();
            for (const touch of Array.from(touches).slice(0, 2)) {
                activeTouchPointsRef.current.set(touch.identifier, {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        };

        const handleTouchStart = (event: globalThis.TouchEvent): void => {
            if (event.touches.length < 2) {
                return;
            }

            syncTouchList(event.touches);
            beginGestureSession();
            stopTouchGestureEvent(event);
        };

        const handleTouchMove = (event: globalThis.TouchEvent): void => {
            if (event.touches.length < 2) {
                return;
            }

            syncTouchList(event.touches);
            if (!gestureSnapshotRef.current) {
                beginGestureSession();
            }
            updateGestureViewport();
            stopTouchGestureEvent(event);
        };

        const handleTouchEnd = (event: globalThis.TouchEvent): void => {
            if (!gestureSnapshotRef.current && !selectionSuppressedRef.current) {
                return;
            }

            if (event.touches.length >= 2) {
                syncTouchList(event.touches);
                beginGestureSession();
                stopTouchGestureEvent(event);
                return;
            }

            activeTouchPointsRef.current.clear();
            gestureSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
            stopTouchGestureEvent(event);
        };

        stageNode.addEventListener('pointerdown', handlePointerDown, true);
        stageNode.addEventListener('pointermove', handlePointerMove, true);
        stageNode.addEventListener('pointerup', handlePointerEnd, true);
        stageNode.addEventListener('pointercancel', handlePointerEnd, true);
        stageNode.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        stageNode.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        stageNode.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        stageNode.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: false });

        return () => {
            stageNode.removeEventListener('pointerdown', handlePointerDown, true);
            stageNode.removeEventListener('pointermove', handlePointerMove, true);
            stageNode.removeEventListener('pointerup', handlePointerEnd, true);
            stageNode.removeEventListener('pointercancel', handlePointerEnd, true);
            stageNode.removeEventListener('touchstart', handleTouchStart, true);
            stageNode.removeEventListener('touchmove', handleTouchMove, true);
            stageNode.removeEventListener('touchend', handleTouchEnd, true);
            stageNode.removeEventListener('touchcancel', handleTouchEnd, true);
            clearTouchGestureState(true);
        };
    }, [
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        touchGestureMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        clearTouchGestureState,
        syncGestureActive,
        syncSelectionSuppressed
    ]);

    useEffect(() => {
        if (!desktopCameraMode) {
            mouseDragSnapshotRef.current = null;
            return;
        }

        const stageNode = stageRef.current;

        if (!stageNode) {
            return;
        }

        const stopMouseEvent = (event: globalThis.MouseEvent | globalThis.WheelEvent | globalThis.PointerEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };

        const handleWheel = (event: WheelEvent): void => {
            if (stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            stopMouseEvent(event);

            const stageRect = stageNode.getBoundingClientRect();
            const pointerWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );
            const currentViewport = viewportStateRef.current;
            const currentScale = Math.max(currentViewport.fitZoom * currentViewport.zoom, 0.0001);
            const nextZoom = clampBoardZoom(currentViewport.zoom * Math.exp(-event.deltaY * 0.0016));
            const anchorBoardX = (pointerWorld.panX - currentViewport.panX) / currentScale;
            const anchorBoardY = (pointerWorld.panY - currentViewport.panY) / currentScale;
            const nextPanX = pointerWorld.panX - anchorBoardX * currentViewport.fitZoom * nextZoom;
            const nextPanY = pointerWorld.panY - anchorBoardY * currentViewport.fitZoom * nextZoom;

            setViewportState((current) => {
                const nextViewport = clampBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    fitZoom,
                    panX: nextPanX,
                    panY: nextPanY,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                    zoom: nextZoom
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });
        };

        const handlePointerDown = (event: globalThis.PointerEvent): void => {
            const dragButton = event.button === 0 || event.button === 1 || event.button === 2;

            if (event.pointerType !== 'mouse' || !dragButton || stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            const stageRect = stageNode.getBoundingClientRect();
            const startWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );
            const currentViewport = viewportStateRef.current;

            mouseDragSnapshotRef.current = {
                dragActive: event.button !== 0,
                pickOnRelease: event.button === 0,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startPanX: currentViewport.panX,
                startPanY: currentViewport.panY,
                startWorldX: startWorld.panX,
                startWorldY: startWorld.panY
            };

            stageNode.setPointerCapture(event.pointerId);

            if (event.button !== 0) {
                syncGestureActive(true);
                syncSelectionSuppressed(true);
            }

            stopMouseEvent(event);
        };

        const handlePointerMove = (event: globalThis.PointerEvent): void => {
            const snapshot = mouseDragSnapshotRef.current;

            if (!snapshot || event.pointerId !== snapshot.pointerId) {
                return;
            }

            if (!snapshot.dragActive) {
                const dragDistance = Math.hypot(event.clientX - snapshot.startClientX, event.clientY - snapshot.startClientY);

                if (dragDistance < MOUSE_PAN_DRAG_THRESHOLD_PX) {
                    return;
                }

                snapshot.dragActive = true;
                syncGestureActive(true);
                syncSelectionSuppressed(true);
            }

            const stageRect = stageNode.getBoundingClientRect();
            const currentWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );
            const nextPanX = snapshot.startPanX + (currentWorld.panX - snapshot.startWorldX);
            const nextPanY = snapshot.startPanY + (currentWorld.panY - snapshot.startWorldY);

            setViewportState((current) => {
                const nextViewport = clampBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    fitZoom,
                    panX: nextPanX,
                    panY: nextPanY,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                    zoom: current.zoom
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });

            stopMouseEvent(event);
        };

        const handlePointerEnd = (event: globalThis.PointerEvent): void => {
            const snapshot = mouseDragSnapshotRef.current;

            if (!snapshot || event.pointerId !== snapshot.pointerId) {
                return;
            }

            const shouldPick = event.type === 'pointerup' && snapshot.pickOnRelease && !snapshot.dragActive;
            mouseDragSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
            if (stageNode.hasPointerCapture(event.pointerId)) {
                stageNode.releasePointerCapture(event.pointerId);
            }
            stopMouseEvent(event);

            if (shouldPick) {
                sceneHandleRef.current?.pickTileAtClientPoint(event.clientX, event.clientY);
            }
        };

        const handleContextMenu = (event: globalThis.MouseEvent): void => {
            stopMouseEvent(event);
        };

        stageNode.addEventListener('wheel', handleWheel, { passive: false });
        stageNode.addEventListener('pointerdown', handlePointerDown, true);
        stageNode.addEventListener('pointermove', handlePointerMove, true);
        stageNode.addEventListener('pointerup', handlePointerEnd, true);
        stageNode.addEventListener('pointercancel', handlePointerEnd, true);
        stageNode.addEventListener('contextmenu', handleContextMenu);

        return () => {
            stageNode.removeEventListener('wheel', handleWheel);
            stageNode.removeEventListener('pointerdown', handlePointerDown, true);
            stageNode.removeEventListener('pointermove', handlePointerMove, true);
            stageNode.removeEventListener('pointerup', handlePointerEnd, true);
            stageNode.removeEventListener('pointercancel', handlePointerEnd, true);
            stageNode.removeEventListener('contextmenu', handleContextMenu);
            mouseDragSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
        };
    }, [
        boardWorldHeight,
        boardWorldWidth,
        desktopCameraMode,
        fitZoom,
        stageWorldViewport.height,
        stageWorldViewport.width,
        syncGestureActive,
        syncSelectionSuppressed
    ]);

    const showMotionChip = shouldOfferDeviceMotionPermission({
        motionParallaxSuppressed,
        permission,
        touchPrimary
    });
    const motionChipLabels = getMotionPermissionButtonLabels(permission, 'board');

    const sceneErrorFallback = (
        <div className={styles.webglSceneError} data-testid="tile-board-scene-error" role="alert">
            Board graphics encountered an error. Try reloading the page.
        </div>
    );

    const gambitPickWindowOpen =
        allowGambitThirdFlip && runStatus === 'resolving' && board.flippedTileIds.length === 2;

    return (
        <div
            aria-busy={boardPreStage === 'loading'}
            className={`${styles.frame} ${cameraViewportMode ? styles.frameMobileCamera : ''} ${
                boardMotionAnimating ? styles.frameShuffleAnimating : ''
            } ${gambitPickWindowOpen && !reduceMotion ? styles.frameGambitWindow : ''}`}
            data-board-gambit-window={gambitPickWindowOpen ? 'true' : 'false'}
            data-board-prestage={boardPreStage}
            data-board-columns={board.columns}
            data-board-rows={board.rows}
            data-board-run-status={runStatus}
            data-dungeon-stage-layer-policy={DUNGEON_BOARD_STAGE_LAYER_POLICY.version}
            data-dungeon-stage-perf-budget={DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.version}
            data-dungeon-comfort-focus-order={DNG065_DUNGEON_COMFORT_FOCUS_ORDER.join('>')}
            data-dungeon-mobile-board-primary={DNG065_MOBILE_BOARD_PRIORITY.boardPrimary ? 'true' : 'false'}
            data-dungeon-touch-target-min={DNG065_MOBILE_BOARD_PRIORITY.minTouchTargetPx}
            data-card-feedback-states={cardFeedbackStatesAttr}
            data-card-feedback-last-resolution={lastResolutionFeedback}
            data-card-feedback-reduced-motion={reduceMotion ? 'static-state-cues' : 'animated-state-cues'}
            data-dungeon-resolved-trap-count={resolvedTrapTileCount}
            data-dungeon-resolved-trap-slots={resolvedTrapSlotsAttr}
            data-dungeon-trap-resolution-message={trapResolutionMessage}
            data-selected-tile-count={board.flippedTileIds.length}
            {...(hiddenTrapSlotsAttr != null ? { 'data-e2e-hidden-trap-slots': hiddenTrapSlotsAttr } : {})}
            {...(pickableHiddenSlotsAttr != null ? { 'data-e2e-pickable-hidden-slots': pickableHiddenSlotsAttr } : {})}
            data-hidden-tile-count={hiddenTileCount}
            data-hidden-slots={hiddenSlotsAttr}
            {...(devE2ePairPositionsJson ? { 'data-e2e-pair-positions': devE2ePairPositionsJson } : {})}
            data-shuffle-animating={boardMotionAnimating ? 'true' : 'false'}
            data-board-pan-x={renderedViewportState.panX.toFixed(4)}
            data-board-pan-y={renderedViewportState.panY.toFixed(4)}
            data-board-zoom={renderedViewportState.zoom.toFixed(4)}
            data-gesture-active={gestureActive ? 'true' : 'false'}
            {...{ [REG105_DATA_DAIS]: 'v1' }}
            data-mobile-camera-mode={cameraViewportMode ? 'true' : 'false'}
            data-selection-suppressed={selectionSuppressed ? 'true' : 'false'}
            data-testid="tile-board-frame"
            ref={frameRef}
            style={mergedFrameStyle}
        >
            <div className={styles.srBoardLive} aria-live="polite">
                {boardLiveMessage}
            </div>
            {trapResolutionMessage ? (
                <div
                    className={styles.trapResolutionToast}
                    data-testid="trap-resolution-feedback"
                    role="status"
                    aria-live="polite"
                >
                    <span className={styles.trapResolutionSigil} aria-hidden="true">
                        !
                    </span>
                    <span>{trapResolutionMessage}</span>
                </div>
            ) : null}
            {!baselineWebGl ? (
                <div className={styles.webglRequired} data-testid="tile-board-webgl-required">
                    This game requires WebGL. Enable hardware acceleration or update your browser, then reload.
                </div>
            ) : gpuSurfaceLost ? (
                <div className={styles.webglSceneError} data-testid="tile-board-gpu-lost" role="alert">
                    WebGL context was lost — the board will try to rebuild when the GPU restores it. If you still see
                    this, reload the page or update GPU drivers.
                </div>
            ) : (
                <div
                    aria-label={DNG065_BOARD_APPLICATION_LABEL}
                    className={styles.boardCanvasApplication}
                    data-testid="tile-board-application"
                    onBlur={handleBoardApplicationBlur}
                    onFocus={handleBoardApplicationFocus}
                    onKeyDown={handleBoardApplicationKeyDown}
                    ref={boardAppRef}
                    role="application"
                    tabIndex={0}
                >
                    <div
                        className={styles.stage}
                        data-testid="tile-board-stage-shell"
                        {...{ [REG105_DATA_STAGEVIEW]: 'v1' }}
                        ref={stageRef}
                        style={{ touchAction: REG103_BOARD_TOUCH_ACTION }}
                    >
                        {boardPreStage === 'loading' && baselineWebGl && !gpuSurfaceLost ? (
                            <div
                                aria-hidden
                                className={styles.prestageOverlay}
                                data-testid="tile-board-prestage-overlay"
                            >
                                <div
                                    className={styles.prestageDeck}
                                    style={{ '--prestage-cards': PRESTAGE_CARD_COUNT } as CSSProperties}
                                >
                                    <div className={styles.prestageStack}>
                                        {Array.from({ length: PRESTAGE_CARD_COUNT }, (_, deckI) => (
                                            <span
                                                className={styles.prestageCard}
                                                key={deckI}
                                                style={{ '--deck-i': deckI } as CSSProperties}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        <TileBoardErrorBoundary fallback={sceneErrorFallback}>
                            <div className={styles.scene} data-testid="tile-board-stage">
                                <Canvas
                                    aria-hidden
                                    className={styles.canvas}
                                    dpr={dpr}
                                    key={`tile-board-${webglCanvasRemountKey}-${resolvedBoardAa}`}
                                    gl={{
                                        alpha: true,
                                        antialias: glAntialias,
                                        powerPreference: 'high-performance',
                                        premultipliedAlpha: false
                                    }}
                                    onCreated={({ gl }) => {
                                        webglContextListenersCleanupRef.current?.();
                                        const canvas = gl.domElement as HTMLCanvasElement;
                                        const onLost = (event: Event): void => {
                                            event.preventDefault();
                                            setGpuSurfaceLost(true);
                                        };
                                        const onRestored = (): void => {
                                            setGpuSurfaceLost(false);
                                            setWebglCanvasRemountKey((key) => key + 1);
                                            setBoardLiveMessage('Graphics context restored. Board rebuilt.');
                                            window.setTimeout(() => setBoardLiveMessage(''), 3200);
                                        };
                                        canvas.addEventListener('webglcontextlost', onLost);
                                        canvas.addEventListener('webglcontextrestored', onRestored);
                                        webglContextListenersCleanupRef.current = (): void => {
                                            canvas.removeEventListener('webglcontextlost', onLost);
                                            canvas.removeEventListener('webglcontextrestored', onRestored);
                                        };
                                    }}
                                    shadows={false}
                                    camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 10.5] }}
                                >
                                    <TileBoardScene
                                        allowGambitThirdFlip={allowGambitThirdFlip}
                                        board={board}
                                        boardViewport={renderedViewportState}
                                        compact={compact}
                                        cursedPairKey={cursedPairKey}
                                        dimmedTileIds={dimmedTileIds}
                                        stickyBlockedTileId={stickyBlockedTileId}
                                        focusedTileId={boardApplicationFocused ? focusedTileId : null}
                                        graphicsQuality={graphicsQuality}
                                        wardPairKey={wardPairKey}
                                        bountyPairKey={bountyPairKey}
                                        debugPeekActive={debugPeekActive}
                                        fieldTiltRef={fieldTiltRef}
                                        hoverTiltRef={hoverTiltRef}
                                        interactionSuppressed={selectionSuppressed}
                                        interactive={interactive}
                                        nBackAnchorPairKey={nBackAnchorPairKey}
                                        nBackMutatorActive={nBackMutatorActive}
                                        onTilePick={handleTileSelect}
                                        onViewportMetricsChange={handleStageViewportChange}
                                        pairProximityHintsEnabled={pairProximityHintsEnabled}
                                        peekRevealedTileIds={peekRevealedTileIds}
                                        pinnedTileIds={pinnedTileIds}
                                        previewActive={previewActive}
                                        ref={sceneHandleRef}
                                        reduceMotion={reduceMotion}
                                        motionParallaxSuppressed={motionParallaxSuppressed}
                                        runStatus={runStatus}
                                        boardEntranceMotionBudgetMs={boardEntranceMotionBudgetMs}
                                        boardEntranceMotionDeadlineMs={boardEntranceMotionDeadlineMs}
                                        boardEntranceStaggerTileCount={boardEntranceStaggerTileCount}
                                        shuffleMotionBudgetMs={shuffleMotionBudgetMs}
                                        shuffleMotionDeadlineMs={shuffleMotionDeadlineMs}
                                        shuffleStaggerTileCount={shuffleStaggerTileCount}
                                        showTutorialPairMarkers={showTutorialPairMarkers}
                                        silhouetteDuringPlay={silhouetteDuringPlay}
                                        wideRecallInPlay={wideRecallInPlay}
                                        shiftingSpotlightActive={shiftingSpotlightActive}
                                        destroyPowerVisualActive={destroyPowerVisualActive}
                                        destroyEligibleTileIds={destroyEligibleTileIds}
                                        peekPowerVisualActive={peekPowerVisualActive}
                                        peekEligibleTileIds={peekEligibleTileIds}
                                        strayPowerVisualActive={strayPowerVisualActive}
                                        strayEligibleTileIds={strayEligibleTileIds}
                                        pinModeBoardHintActive={pinModeBoardHintActive}
                                    />
                                    <TileBoardPostFx
                                        bloomEnabled={bloomEffective}
                                        graphicsQuality={graphicsQuality}
                                        smaaEnabled={resolvedBoardAa === 'smaa'}
                                    />
                                </Canvas>
                            </div>
                        </TileBoardErrorBoundary>
                        {showMotionChip ? (
                            <button
                                aria-label={motionChipLabels.ariaLabel}
                                className={styles.motionChip}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void requestMotionPermission();
                                }}
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                }}
                                type="button"
                            >
                                {motionChipLabels.buttonText}
                            </button>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
});

TileBoard.displayName = 'TileBoard';

export default TileBoard;
