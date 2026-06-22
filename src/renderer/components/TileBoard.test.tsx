import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    estimateDungeonBoardStagePerformanceCost,
    getDungeonBoardStageLod,
    getDungeonEnemyMarkerAnchor,
    getDungeonEnemyMarkerVisualProfile
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
    onTileSelect: (id: string) => void;
    previewActive: boolean;
    reduceMotion: boolean;
    runStatus?: RunStatus;
    viewportResetToken?: number;
    guidedTargetTileIds?: string[];
    tileSwapPowerVisualActive?: boolean;
    tileSwapEligibleTileIds?: ReadonlySet<string>;
    tileSwapFirstTileId?: string | null;
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

    it('exposes stable card feedback states for hidden, hazard, route, objective, and non-pickable cards', () => {
        const feedbackBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', routeCardKind: 'greed_cache' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', dungeonCardKind: 'lever', dungeonCardState: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden', tileHazardKind: 'shuffle_snare' },
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
        expect(frame.getAttribute('data-card-feedback-states')).toContain('hazard:1');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('hidden:3');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('matched:1');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('non-pickable:3');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('objective:1');
        expect(frame.getAttribute('data-card-feedback-states')).toContain('route:1');
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

    it('announces resolved trap cards with a generic trap status and specific card label', async () => {
        const resolvedTrapTiles: BoardState['tiles'] = [
            {
                id: 'trap-1',
                pairKey: 'trap',
                symbol: '!',
                label: 'Mimic Bounty',
                state: 'hidden',
                dungeonCardKind: 'trap',
                dungeonCardState: 'resolved'
            },
            {
                id: 'trap-2',
                pairKey: 'trap',
                symbol: '!',
                label: 'Mimic Bounty',
                state: 'hidden',
                dungeonCardKind: 'trap',
                dungeonCardState: 'resolved'
            },
            board.tiles[2]!,
            board.tiles[3]!
        ];
        const rendered = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: true
        });

        rendered.rerender(
            <PlatformTiltProvider>
                <TileBoard
                    board={{ ...board, tiles: resolvedTrapTiles }}
                    debugPeekActive={false}
                    interactive
                    mobileCameraMode={false}
                    onTileSelect={vi.fn()}
                    previewActive={false}
                    reduceMotion
                    runStatus="playing"
                    viewportResetToken={0}
                />
            </PlatformTiltProvider>
        );

        await waitFor(() =>
            expect(screen.getByTestId('trap-resolution-feedback')).toHaveTextContent(
                'Trap resolved: Mimic Bounty. Effect applied; next tile ready.'
            )
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-trap-resolution-message',
            'Trap resolved: Mimic Bounty. Effect applied; next tile ready.'
        );
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

    it('shows a visible trait combo preview when the focused tile has nearby trait interactions', async () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    board.tiles[2]!,
                    board.tiles[3]!
                ]
            },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));

        await waitFor(() => expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Trait combo'));
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('trait-combo:2');
    });

    it('shows a visible swap preview when the focused target would create a trait interaction', async () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
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
            tileSwapEligibleTileIds: new Set(['s1']),
            tileSwapFirstTileId: 'x1',
            tileSwapPowerVisualActive: true
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));

        await waitFor(() => expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Swap preview'));
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Creates trait route');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Sealed + Heavy: score surge');
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

    it('announces pickup reward details for visible pickup carriers', async () => {
        const pickupBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', findableKind: 'shard_spark' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', findableKind: 'shard_spark' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: pickupBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Shard spark pickup: \+1 combo shard/i)).toBeInTheDocument();
        });
    });

    it('announces route card details for route-stamped cards', async () => {
        const routeBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', routeCardKind: 'greed_cache' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', routeCardKind: 'greed_cache' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: routeBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Route card: Greed cache/i)).toBeInTheDocument();
        });
    });

    it('announces lantern-scouted route information distinctly from peek', async () => {
        const routeBoard: BoardState = {
            ...board,
            tiles: [
                {
                    id: 'a1',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'mystery_veil',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'lantern_ward'
                },
                {
                    id: 'a2',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'mystery_veil',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'lantern_ward'
                },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: routeBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Scouted by Lantern Ward/i)).toBeInTheDocument();
        });
    });

    it('announces omen-scouted route and hazard information distinctly from lantern', async () => {
        const omenBoard: BoardState = {
            ...board,
            tiles: [
                {
                    id: 'a1',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'omen_seal',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'omen_seal'
                },
                {
                    id: 'a2',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'omen_seal',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'omen_seal'
                },
                {
                    id: 'b1',
                    pairKey: 'B',
                    symbol: 'B',
                    label: 'B',
                    state: 'hidden',
                    tileHazardKind: 'shuffle_snare',
                    scoutRevealSource: 'omen_seal'
                },
                {
                    id: 'b2',
                    pairKey: 'B',
                    symbol: 'B',
                    label: 'B',
                    state: 'hidden',
                    tileHazardKind: 'shuffle_snare',
                    scoutRevealSource: 'omen_seal'
                }
            ]
        };

        renderBoard({
            board: omenBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getAllByText(/Scouted by Omen Seal/i).length).toBeGreaterThan(0);
        });
    });

    it('announces mimic cache route copy and reveal source', async () => {
        const mimicBoard: BoardState = {
            ...board,
            tiles: [
                {
                    id: 'a1',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'mimic_cache',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'peek'
                },
                {
                    id: 'a2',
                    pairKey: 'A',
                    symbol: 'A',
                    label: 'A',
                    state: 'hidden',
                    routeCardKind: 'mystery_veil',
                    routeSpecialKind: 'mimic_cache',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'peek'
                },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: mimicBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Mimic Cache/i)).toBeInTheDocument();
            expect(screen.getByText(/blind match bites/i)).toBeInTheDocument();
            expect(screen.getByText(/Revealed by peek/i)).toBeInTheDocument();
        });
    });

    it('announces hazard tile telegraphs for focused hidden hazards', async () => {
        const hazardBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', tileHazardKind: 'shuffle_snare' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', tileHazardKind: 'shuffle_snare' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        renderBoard({
            board: hazardBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Hazard tile: Shuffle Snare/i)).toBeInTheDocument();
            expect(screen.getByText(/Wrong pairs reshuffle safe hidden tiles/i)).toBeInTheDocument();
        });
    });

    it('announces moving enemy patrol occupancy and next-target telegraphs', async () => {
        const enemyBoard: BoardState = {
            ...board,
            enemyHazards: [
                {
                    id: 'hazard-1',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a2',
                    nextTileId: 'a1',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 2
                }
            ]
        };

        const rendered = renderBoard({
            board: enemyBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Next target of moving enemy patrol Patrol Sentry, 1\/2 HP, 1 damage/i)).toBeInTheDocument();
        });
        rendered.unmount();

        renderBoard({
            board: {
                ...enemyBoard,
                enemyHazards: enemyBoard.enemyHazards!.map((hazard) => ({
                    ...hazard,
                    currentTileId: 'a1',
                    nextTileId: 'a2'
                }))
            },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });
        fireEvent.focus(screen.getByTestId('tile-board-application'));

        await waitFor(() => {
            expect(screen.getByText(/Occupied by revealed moving enemy patrol Patrol Sentry, 1\/2 HP, 1 damage/i)).toBeInTheDocument();
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

    it('keeps dungeon encounter markers above objective chrome without covering card center text', () => {
        expect(DUNGEON_BOARD_STAGE_LAYER_POLICY.nextThreatTelegraph.renderOrder).toBeGreaterThan(
            DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder
        );
        expect(DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder).toBeGreaterThan(
            DUNGEON_BOARD_STAGE_LAYER_POLICY.resolvingMatch.renderOrder
        );
        expect(DUNGEON_BOARD_STAGE_LAYER_POLICY.keyboardFocus.renderOrder).toBeGreaterThan(
            DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder
        );

        const baseTransform = {
            baseX: 0,
            baseY: 0,
            imperfectionX: 0,
            imperfectionY: 0,
            layoutJitterX: 0,
            layoutJitterY: 0
        };
        const [currentX, currentY] = getDungeonEnemyMarkerAnchor(baseTransform, 'currentThreat');
        const [nextX, nextY] = getDungeonEnemyMarkerAnchor(baseTransform, 'nextThreatTelegraph');

        expect(currentX).toBeGreaterThan(0);
        expect(currentY).toBeGreaterThan(0);
        expect(nextX).toBeLessThan(0);
        expect(nextY).toBeLessThan(0);
    });

    it('keeps low-quality and reduced-motion dungeon threat indicators readable', () => {
        const low = getDungeonBoardStageLod('low', false);
        const reduced = getDungeonBoardStageLod('high', true);

        expect(low.strongEffectBudget).toBe('critical-only');
        expect(low.currentMarkerOpacity).toBeGreaterThanOrEqual(0.88);
        expect(low.nextTelegraphOpacity).toBeGreaterThan(0.3);
        expect(reduced.markerMotionEnabled).toBe(false);
        expect(reduced.nextTelegraphOpacity).toBeGreaterThan(0.3);
    });

    it('assigns non-color-only visual identities to each enemy kind and bosses', () => {
        const hazards = [
            { kind: 'sentinel' as const, bossId: undefined, expectedShape: 'sentinel-diamond' },
            { kind: 'stalker' as const, bossId: undefined, expectedShape: 'stalker-spear' },
            { kind: 'warden' as const, bossId: undefined, expectedShape: 'warden-shield' },
            { kind: 'observer' as const, bossId: undefined, expectedShape: 'observer-eye' },
            { kind: 'sentinel' as const, bossId: 'rush_sentinel' as const, expectedShape: 'boss-crown' }
        ];

        for (const hazard of hazards) {
            expect(getDungeonEnemyMarkerVisualProfile(hazard, 'medium', false).shape).toBe(hazard.expectedShape);
        }

        const boss = getDungeonEnemyMarkerVisualProfile({ kind: 'sentinel', bossId: 'rush_sentinel' }, 'high', false);
        const sentinel = getDungeonEnemyMarkerVisualProfile({ kind: 'sentinel', bossId: undefined }, 'high', false);
        expect(boss.mainScale[0]).toBeGreaterThan(sentinel.mainScale[0]);
        expect(boss.secondaryOpacity).toBeGreaterThan(0);
    });

    it('keeps enemy marker VFX within static reduced-motion and low-quality LOD bounds', () => {
        const low = getDungeonEnemyMarkerVisualProfile({ kind: 'stalker', bossId: undefined }, 'low', false);
        const reduced = getDungeonEnemyMarkerVisualProfile({ kind: 'stalker', bossId: undefined }, 'high', true);
        const high = getDungeonEnemyMarkerVisualProfile({ kind: 'stalker', bossId: undefined }, 'high', false);

        expect(low.haloOpacity).toBeLessThan(high.haloOpacity);
        expect(low.motionHz).toBeLessThan(high.motionHz);
        expect(reduced.motionHz).toBe(0);
        expect(reduced.secondaryOpacity).toBeGreaterThan(0.5);
    });

    it('keeps dungeon moving threat overlays inside the documented DNG-074 draw-call budget', () => {
        const hazards = [
            { kind: 'sentinel' as const, bossId: undefined, nextTileId: 'a2', state: 'revealed' as const },
            { kind: 'stalker' as const, bossId: undefined, nextTileId: 'b1', state: 'revealed' as const },
            { kind: 'warden' as const, bossId: undefined, nextTileId: 'b2', state: 'revealed' as const },
            { kind: 'observer' as const, bossId: undefined, nextTileId: 'a1', state: 'revealed' as const },
            { kind: 'sentinel' as const, bossId: 'rush_sentinel' as const, nextTileId: 'a2', state: 'revealed' as const },
            { kind: 'observer' as const, bossId: 'spire_observer' as const, nextTileId: 'b1', state: 'revealed' as const }
        ];

        const readabilityMarkerTiles = [
            { dungeonCardKind: 'exit' as const, dungeonExitLockKind: 'iron' as const, tileTraitKind: 'echo' as const },
            { dungeonCardKind: 'lock' as const, dungeonExitLockKind: undefined, tileTraitKind: undefined },
            { dungeonCardKind: 'lever' as const, dungeonExitLockKind: undefined, tileTraitKind: undefined },
            { dungeonCardKind: 'shop' as const, dungeonExitLockKind: undefined, tileTraitKind: 'conduit' as const }
        ];

        const high = estimateDungeonBoardStagePerformanceCost({
            hazards,
            graphicsQuality: 'high',
            readabilityMarkerTiles,
            reduceMotion: false
        });
        const reduced = estimateDungeonBoardStagePerformanceCost({
            hazards,
            graphicsQuality: 'high',
            readabilityMarkerTiles,
            reduceMotion: true
        });
        const low = estimateDungeonBoardStagePerformanceCost({
            hazards,
            graphicsQuality: 'low',
            readabilityMarkerTiles,
            reduceMotion: false
        });

        expect(high.activeHazardCount).toBe(DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxActiveEnemyHazards);
        expect(high.estimatedMovingThreatDrawCalls).toBeLessThanOrEqual(
            DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxMovingThreatDrawCalls
        );
        expect(high.estimatedMovingThreatMaterialSlots).toBe(high.estimatedMovingThreatDrawCalls);
        expect(high.estimatedStaticReadabilityDrawCalls).toBe(12);
        expect(high.estimatedStaticReadabilityDrawCalls).toBeLessThanOrEqual(
            DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxStaticReadabilityMarkerDrawCalls
        );
        expect(high.sharedEnemyMarkerGeometryCount).toBe(DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.sharedEnemyMarkerGeometryCount);
        expect(high.traitRailExtraDrawCalls).toBe(DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.traitRailExtraDrawCalls);
        expect(high.utilityCardExtraDrawCalls).toBe(DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.utilityCardExtraDrawCalls);
        expect(high.trapCardExtraDrawCallsPerPair).toBe(0);
        expect(high.contextLossRecovery).toBe('remount_canvas_on_restore');
        expect(high.withinBudget).toBe(true);
        expect(reduced.withinBudget).toBe(true);
        expect(reduced.lowOrReducedQualityReadable).toBe(true);
        expect(low.withinBudget).toBe(true);
        expect(low.lowOrReducedQualityReadable).toBe(true);
    });

    it('selects an occupied enemy patrol card from keyboard focus without pointer input', async () => {
        const onTileSelect = vi.fn();
        const enemyBoard: BoardState = {
            ...board,
            enemyHazards: [
                {
                    id: 'hazard-1',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a2',
                    nextTileId: 'a1',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 2
                }
            ]
        };

        renderBoard({
            board: enemyBoard,
            debugPeekActive: false,
            interactive: true,
            onTileSelect,
            previewActive: false,
            reduceMotion: false
        });

        const boardApplication = screen.getByTestId('tile-board-application');
        fireEvent.focus(boardApplication);
        fireEvent.keyDown(boardApplication, { key: 'ArrowRight' });

        await waitFor(() => {
            expect(screen.getByText(/Occupied by revealed moving enemy patrol Patrol Sentry/i)).toBeInTheDocument();
        });

        fireEvent.keyDown(boardApplication, { key: 'Enter' });
        expect(onTileSelect).toHaveBeenCalledWith('a2');
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
