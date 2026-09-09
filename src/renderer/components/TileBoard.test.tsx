import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RunStatus } from '../../shared/contracts';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import {
    DNG065_BOARD_APPLICATION_LABEL,
    DNG065_DUNGEON_COMFORT_FOCUS_ORDER,
    DNG065_MOBILE_BOARD_PRIORITY
} from '../gameplay/regPhase4PlayContract';
import TileBoard, { type TileBoardHandle } from './TileBoard';
import {
    DUNGEON_BOARD_STAGE_LAYER_POLICY,
    DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET,
    estimateDungeonBoardStagePerformanceCost
} from './tileBoardStageLayers';

/** jsdom has no GPU; stub a minimal WebGL context so the board mounts the canvas path. */
const mockWebGL2Context = (): object => ({
    canvas: document.createElement('canvas'),
    getExtension: () => null,
    loseContext: () => ({ loseContext: (): void => undefined })
});
const installWebGLMock = (): void => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        ((contextId: string): RenderingContext | null => {
            if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') {
                return mockWebGL2Context() as unknown as WebGLRenderingContext;
            }
            return null;
        }) as typeof HTMLCanvasElement.prototype.getContext
    );
};

const renderBoard = (props: {
    board: BoardState;
    debugPeekActive: boolean;
    interactive: boolean;
    mobileCameraMode?: boolean;
    onMemorizeBoardReady?: (boardKey: string) => void;
    onTileSelect: (id: string) => void;
    previewActive: boolean;
    reduceMotion: boolean;
    runStatus?: RunStatus;
    viewportResetToken?: number;
    guidedTargetTileIds?: string[];
    destroyPowerVisualActive?: boolean;
    peekPowerVisualActive?: boolean;
    pinModeBoardHintActive?: boolean;
    strayPowerVisualActive?: boolean;
    tileSwapPowerVisualActive?: boolean;
    tileSwapEligibleTileIds?: ReadonlySet<string>;
    tileSwapFirstTileId?: string | null;
    traitRouteHintText?: string | null;
    traitRouteTargetTileIds?: readonly string[];
    chainContext?: {
        comboShards: number;
        currentStreak: number;
        lives: number;
    };
    recoveryContext?: {
        action: string;
        detail: string;
        impactCue: string;
        value: string;
        tone: 'recover' | 'risk' | 'lost-reward';
    } | null;
}): ReturnType<typeof render> =>
    {
        const {
            mobileCameraMode = false,
            viewportResetToken = 0,
            ...tileBoardProps
        } = props;

        return render(
        <PlatformTiltProvider>
            <TileBoard
                mobileCameraMode={mobileCameraMode}
                viewportResetToken={viewportResetToken}
                {...tileBoardProps}
            />
        </PlatformTiltProvider>
        );
    };

const board: BoardState = {
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    matchedPairs: 0,
    flippedTileIds: [],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

describe('TileBoard touch and click controls', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        installWebGLMock();
    });

    it('mounts the canvas application when WebGL is available', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-application')).toHaveAttribute('role', 'application');
        const frame = screen.getByTestId('tile-board-frame');
        expect(frame).toHaveAttribute('data-hidden-tile-count', '4');
        expect(frame).toHaveAttribute('data-board-run-status', 'playing');
    });

    it('exposes stable card feedback states for hidden, trait, findable, and non-pickable cards', () => {
        const feedbackBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', tileTraitKind: 'echo' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden', findableKind: 'shard_spark' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'matched' }
            ]
        };

        renderBoard({
            board: feedbackBoard,
            debugPeekActive: false,
            interactive: false,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true
        });

        const frame = screen.getByTestId('tile-board-frame');
        expect(frame).toHaveAttribute('data-card-feedback-reduced-motion', 'static-state-cues');
        expect(frame).toHaveAttribute('data-card-feedback-last-resolution', '');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('findable:1');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('hidden:3');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('matched:1');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('non-pickable:3');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('trait:1');
    });

    it('exposes reduced-motion match and mismatch feedback states without relying on animation', () => {
        const resolvingBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1', 'b1'],
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'flipped' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'flipped' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        const rendered = renderBoard({
            board: resolvingBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true,
            runStatus: 'resolving'
        });

        let frame = screen.getByTestId('tile-board-frame');
        expect(frame).toHaveAttribute('data-card-feedback-reduced-motion', 'static-state-cues');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('mismatch:2');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('flipped:2');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('non-pickable:2');
        expect(frame.getAttribute('data-card-feedback-last-resolution')).toContain('mismatch:2');

        rendered.rerender(
            <PlatformTiltProvider>
                <TileBoard
                    board={{ ...resolvingBoard, flippedTileIds: ['a1', 'a2'], tiles: resolvingBoard.tiles.map((tile) => tile.pairKey === 'A' ? { ...tile, state: 'flipped' } : tile) }}
                    debugPeekActive={false}
                    interactive
                    mobileCameraMode={false}
                    onTileSelect={vi.fn()}
                    previewActive={false}
                    reduceMotion
                    runStatus="resolving"
                    viewportResetToken={0}
                />
            </PlatformTiltProvider>
        );

        frame = screen.getByTestId('tile-board-frame');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('match:2');
        expect(frame.getAttribute('data-card-feedback-last-resolution')).toContain('match:2');
    });

    it('arms deal-in motion on mount when motion is enabled', async () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        await waitFor(
            () => {
                expect(screen.getByTestId('tile-board-frame').getAttribute('data-shuffle-animating')).toBe('true');
            },
            { timeout: 5000 }
        );
    });

    it('cancels active deal-in motion when reduced motion is enabled', async () => {
        vi.useFakeTimers();
        const rendered = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-shuffle-animating', 'true');

        rendered.rerender(
            <PlatformTiltProvider>
                <TileBoard
                    board={board}
                    debugPeekActive={false}
                    interactive
                    mobileCameraMode={false}
                    onTileSelect={vi.fn()}
                    previewActive={false}
                    reduceMotion
                    viewportResetToken={0}
                />
            </PlatformTiltProvider>
        );
        await act(async () => {
            await Promise.resolve();
        });

        const frame = screen.getByTestId('tile-board-frame');
        expect(frame).toHaveAttribute('data-board-prestage', 'idle');
        expect(frame).toHaveAttribute('data-shuffle-animating', 'false');
    });

    it('keeps a replacement board loading when the previous deal-in timeout expires', async () => {
        vi.useFakeTimers();
        const onMemorizeBoardReady = vi.fn();
        const rendered = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onMemorizeBoardReady,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(800);
        });
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-shuffle-animating', 'true');

        const replacementBoard: BoardState = {
            ...board,
            level: 2,
            tiles: board.tiles.map((tile) => ({ ...tile, id: `replacement-${tile.id}` }))
        };
        rendered.rerender(
            <PlatformTiltProvider>
                <TileBoard
                    board={replacementBoard}
                    debugPeekActive={false}
                    interactive
                    mobileCameraMode={false}
                    onMemorizeBoardReady={onMemorizeBoardReady}
                    onTileSelect={vi.fn()}
                    previewActive={false}
                    reduceMotion={false}
                    viewportResetToken={0}
                />
            </PlatformTiltProvider>
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-board-prestage', 'loading');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-board-prestage', 'loading');
        expect(onMemorizeBoardReady).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(900);
        });
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-board-prestage', 'idle');
        expect(onMemorizeBoardReady).toHaveBeenCalledTimes(1);
        expect(onMemorizeBoardReady).toHaveBeenCalledWith(expect.stringMatching(/^2\|2x2\|replacement-/));
    });

    it('skips pre-board loading overlay when reduced motion is enabled', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true
        });

        const frame = screen.getByTestId('tile-board-frame');
        expect(frame.getAttribute('data-board-prestage')).toBe('idle');
        expect(screen.queryByTestId('tile-board-prestage-overlay')).toBeNull();
    });

    it('does not arm deal-in motion when reduced motion is enabled', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true
        });

        expect(screen.getByTestId('tile-board-frame').getAttribute('data-shuffle-animating')).toBe('false');
    });

    it('shows WebGL required copy when the browser cannot create a GL context', () => {
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);

        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-webgl-required')).toBeInTheDocument();
        expect(screen.queryByTestId('tile-board-application')).toBeNull();
    });

    it('announces keyboard focus in the live region', async () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Focus: Hidden tile, row 1, column 1/i)).toBeInTheDocument();
        });
    });

    it('drops queued keyboard focus text after the board application blurs first', async () => {
        const pendingMicrotasks: VoidFunction[] = [];
        const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
            pendingMicrotasks.push(callback);
        });
        const rendered = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        try {
            pendingMicrotasks.length = 0;
            const app = screen.getByTestId('tile-board-application');
            fireEvent.focus(app);
            const staleCallbacks = pendingMicrotasks.splice(0);

            fireEvent.blur(app);

            await act(async () => {
                for (const callback of staleCallbacks) {
                    callback();
                    await Promise.resolve();
                }
            });

            expect(screen.getByTestId('tile-board-live-region')).toBeEmptyDOMElement();
        } finally {
            rendered.unmount();
            queueMicrotaskSpy.mockRestore();
        }
    });

    it('keeps keyboard focus when stale non-interactive reconciliation runs late', async () => {
        const pendingMicrotasks: VoidFunction[] = [];
        const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
            pendingMicrotasks.push(callback);
        });
        const rendered = renderBoard({
            board,
            debugPeekActive: false,
            interactive: false,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        try {
            const staleCallbacks = pendingMicrotasks.splice(0);
            rendered.rerender(
                <PlatformTiltProvider>
                    <TileBoard
                        board={board}
                        debugPeekActive={false}
                        interactive
                        mobileCameraMode={false}
                        onTileSelect={vi.fn()}
                        previewActive={false}
                        reduceMotion={false}
                        runStatus="playing"
                        viewportResetToken={0}
                    />
                </PlatformTiltProvider>
            );
            fireEvent.focus(screen.getByTestId('tile-board-application'));

            await act(async () => {
                for (const callback of staleCallbacks) {
                    callback();
                    await Promise.resolve();
                }
            });
            await act(async () => {
                for (const callback of pendingMicrotasks.splice(0)) {
                    callback();
                    await Promise.resolve();
                }
            });

            expect(screen.getByTestId('tile-board-live-region')).toHaveTextContent(
                /Focus: Hidden tile, row 1, column 1/i
            );
        } finally {
            rendered.unmount();
            queueMicrotaskSpy.mockRestore();
        }
    });

    it('plays a procedural chain opportunity beat when a prime route appears', async () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        renderBoard({
            board: {
                ...board,
                tiles: [
                    { id: 's1', pairKey: 'conduit', symbol: 'C', label: 'Conduit', state: 'hidden', tileTraitKind: 'conduit' },
                    { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                    { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                    { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' }
                ]
            },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false,
            traitRouteHintText: 'Swap Conduit with Filler: Conduit: adjacent trait charge',
            traitRouteTargetTileIds: ['s1', 'f1']
        });

        await waitFor(() => expect(createOscillator).toHaveBeenCalledTimes(1));
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            1192,
            expect.any(Number)
        );
    });

    it('announces decoy trap language for face-up decoy tiles', async () => {
        const decoyBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'd1', pairKey: '__decoy__', symbol: 'X', label: 'Decoy', state: 'hidden' },
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: decoyBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Focus: Decoy trap tile, row 1, column 1/i)).toBeInTheDocument();
        });
    });

    it('exposes board grid dimensions on the frame for tests and assistive tech', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        const frame = screen.getByTestId('tile-board-frame');
        expect(frame.getAttribute('data-board-columns')).toBe('2');
        expect(frame.getAttribute('data-board-rows')).toBe('2');
    });

    it('exposes the dungeon stage layer policy version on the frame', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-stage-layer-policy',
            DUNGEON_BOARD_STAGE_LAYER_POLICY.version
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-stage-perf-budget',
            DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.version
        );
    });

    it('exposes dungeon comfort focus order and mobile board-primary policy', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            mobileCameraMode: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        const frame = screen.getByTestId('tile-board-frame');
        expect(frame).toHaveAttribute('data-dungeon-comfort-focus-order', DNG065_DUNGEON_COMFORT_FOCUS_ORDER.join('>'));
        expect(frame).toHaveAttribute('data-dungeon-mobile-board-primary', 'true');
        expect(frame).toHaveAttribute('data-dungeon-touch-target-min', String(DNG065_MOBILE_BOARD_PRIORITY.minTouchTargetPx));
        expect(screen.getByTestId('tile-board-application')).toHaveAttribute('aria-label', DNG065_BOARD_APPLICATION_LABEL);
    });

    it('keeps static readability markers inside the documented draw-call budget', () => {
        const readabilityMarkerTiles = [
            { tileTraitKind: 'echo' as const },
            { tileTraitKind: undefined },
            { tileTraitKind: 'conduit' as const }
        ];

        const cost = estimateDungeonBoardStagePerformanceCost({ readabilityMarkerTiles });

        expect(cost.estimatedStaticReadabilityDrawCalls).toBe(4);
        expect(cost.estimatedStaticReadabilityDrawCalls).toBeLessThanOrEqual(
            DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxStaticReadabilityMarkerDrawCalls
        );
        expect(cost.traitRailExtraDrawCalls).toBe(DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.traitRailExtraDrawCalls);
        expect(cost.contextLossRecovery).toBe('remount_canvas_on_restore');
        expect(cost.withinBudget).toBe(true);
    });

    it('sets shuffle animating on the frame while the WebGL stagger window is active', async () => {
        const tileBoardRef = createRef<TileBoardHandle>();

        const ShuffleHarness = (): ReactElement => {
            const [tiles, setTiles] = useState(board.tiles);

            return (
                <PlatformTiltProvider>
                    <TileBoard
                        ref={tileBoardRef}
                        board={{ ...board, tiles }}
                        debugPeekActive={false}
                        interactive
                        mobileCameraMode={false}
                        onTileSelect={vi.fn()}
                        previewActive={false}
                        reduceMotion={false}
                        viewportResetToken={0}
                    />
                    <button
                        data-testid="trigger-shuffle-flip"
                        onClick={() => {
                            tileBoardRef.current?.runShuffleAnimation(() => {
                                setTiles((current) => [...current].reverse());
                            });
                        }}
                        type="button"
                    >
                        Shuffle
                    </button>
                </PlatformTiltProvider>
            );
        };

        const { container } = render(<ShuffleHarness />);
        const frame = container.querySelector('[data-testid="tile-board-frame"]');

        expect(frame).not.toBeNull();
        fireEvent.click(screen.getByTestId('trigger-shuffle-flip'));

        await waitFor(() => {
            expect(frame?.getAttribute('data-shuffle-animating')).toBe('true');
        });
    });

    it('does not set field tilt CSS on the frame when reduced motion is enabled', async () => {
        const { container } = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true
        });

        const frame = container.firstElementChild as HTMLElement;

        fireEvent.pointerMove(window, {
            clientX: Math.round(window.innerWidth * 0.84),
            clientY: Math.round(window.innerHeight * 0.22),
            pointerType: 'mouse'
        });

        await new Promise((r) => {
            setTimeout(r, 30);
        });

        expect(frame.style.getPropertyValue('--tilt-x')).toBe('');
    });

    it('writes nonzero field tilt CSS on the frame after viewport pointer move when motion is on', async () => {
        const { container } = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        const frame = container.firstElementChild as HTMLElement;

        fireEvent.pointerMove(window, {
            clientX: Math.round(window.innerWidth * 0.84),
            clientY: Math.round(window.innerHeight * 0.22),
            pointerType: 'mouse'
        });

        await waitFor(() => {
            const tx = frame.style.getPropertyValue('--tilt-x').trim();

            expect(tx).not.toBe('');
            expect(Math.abs(Number.parseFloat(tx))).toBeGreaterThan(0.01);
        });
    });
});
