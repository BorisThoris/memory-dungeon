import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RewardPerkId, RunStatus } from '../../shared/contracts';
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
        armedPerkId?: RewardPerkId | null;
        armedPerkDetail?: string | null;
        armedPerkLabel?: string | null;
        armedPerkPayoff?: string | null;
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
                'Trap resolved: Mimic Bounty. Trap effect paid; Chase next pair.'
            )
        );
        expect(screen.getByTestId('trap-resolution-signals')).toHaveTextContent('1 trap');
        expect(screen.getByTestId('trap-resolution-signals')).toHaveTextContent('Trap effect paid');
        expect(screen.getByTestId('trap-resolution-signals')).toHaveTextContent('Next');
        expect(screen.getByTestId('trap-resolution-signals')).toHaveTextContent('Chase next pair');
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="resolved"]')).toHaveAttribute(
            'data-trap-resolution-beats',
            '3'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="resolved"]')).toHaveAttribute(
            'data-trap-resolution-action',
            'Confirm trap'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="resolved"]')).toHaveAttribute(
            'data-trap-resolution-audio',
            'trap-resolved'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="resolved"]')).toHaveAttribute(
            'data-trap-resolution-screen-cue',
            'snap'
        );
        expect(
            screen
                .getByTestId('trap-resolution-signals')
                .querySelector('[data-trap-resolution-signal="resolved"]')
                ?.querySelector('[data-trap-resolution-beat="1"]')
        ).toHaveAttribute('data-trap-resolution-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('trap-resolution-signals')
                .querySelector('[data-trap-resolution-signal="resolved"]')
                ?.querySelector('[data-trap-resolution-beat="2"]')
        ).toHaveAttribute('data-trap-resolution-beat-focus', 'support');
        expect(
            screen
                .getByTestId('trap-resolution-signals')
                .querySelector('[data-trap-resolution-signal="effect"]')
                ?.querySelectorAll('[data-trap-resolution-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="effect"]')).toHaveAttribute(
            'data-trap-resolution-action',
            'Resolve effect'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="effect"]')).toHaveAttribute(
            'data-trap-resolution-screen-cue',
            'burst'
        );
        expect(
            screen
                .getByTestId('trap-resolution-signals')
                .querySelector('[data-trap-resolution-signal="effect"]')
                ?.querySelector('[data-trap-resolution-beat="1"]')
        ).toHaveAttribute('data-trap-resolution-beat-focus', 'primary');
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="continue"]')).toHaveAttribute(
            'data-trap-resolution-beats',
            '2'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="continue"]')).toHaveAttribute(
            'data-trap-resolution-action',
            'Chase next pair'
        );
        expect(screen.getByTestId('trap-resolution-signals').querySelector('[data-trap-resolution-signal="continue"]')).toHaveAttribute(
            'data-trap-resolution-audio',
            'trap-continue'
        );
        expect(screen.getByTestId('trap-resolution-signals')).toHaveAccessibleName(
            /Trap resolution signals: 1 trap resolved\. Effect: Trap effect paid\. Next: Chase next pair/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-trap-resolution-message',
            'Trap resolved: Mimic Bounty. Trap effect paid; Chase next pair.'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-trap-resolution-effect',
            'Trap effect paid'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-dungeon-trap-resolution-next',
            'Chase next pair'
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
            chainContext: { comboShards: 1, currentStreak: 4, lives: 4 },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Chain routes');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveAttribute('data-chain-opportunity-tone', 'ready');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Best play');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Cash out');
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAttribute('data-chain-meter-fill', '80');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Cash out');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action', 'Cash out');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action-id', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-audio', 'cashout-beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-screen-cue', 'super');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-tier', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-meter-fill', '100');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAccessibleName(
            'Cashout beat: Cash out. 5 beats. Match lit route for reward.'
        );
        expect(screen.getByTestId('chain-opportunity-beat').querySelectorAll('[data-chain-opportunity-beat-pip]')).toHaveLength(5);
        expect(screen.getByTestId('chain-opportunity-beat').querySelector('[data-chain-opportunity-beat-pip="1"]')).toHaveAttribute(
            'data-chain-opportunity-beat-pip-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-beat').querySelector('[data-chain-opportunity-beat-pip="1"]')).toHaveAttribute(
            'data-chain-opportunity-beat-pip-action',
            'cashout'
        );
        expect(
            screen.getByTestId('chain-opportunity-beat').querySelector('[data-chain-opportunity-beat-pip="2"]')
        ).toHaveAttribute('data-chain-opportunity-beat-pip-focus', 'support');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action', 'cashout');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'data-chain-next-action-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-next-action').querySelector('small')).toHaveTextContent('Now');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-callout', 'Cashout shot');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-callout-value',
            'Match lit route for reward'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-callout-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveAttribute(
            'data-chain-callout-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveTextContent('Cashout shot');
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-arcade-callout').querySelectorAll('[data-chain-callout-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-arcade-callout').querySelector('[data-chain-callout-beat="1"]')
        ).toHaveAttribute('data-chain-callout-beat-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-arcade-callout').querySelector('[data-chain-callout-beat="1"]')
        ).toHaveAttribute('data-chain-callout-beat-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-eyebrow-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-eyebrow-beat="1"]')
        ).toHaveAttribute('data-chain-eyebrow-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-cue-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-beat="1"]')
        ).toHaveAttribute('data-chain-cue-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-priority-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-priority-beat="1"]')
        ).toHaveAttribute('data-chain-priority-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Route');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Payoff');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-marker-key-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-marker-key-beats', '4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-marker-key-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-marker-key-tier', 'stack');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-key-action', 'cashout');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-key-beats', '4');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-key-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-key-tier', 'stack');
        const markerKeySummary = screen.getByTestId('chain-opportunity-marker-key-summary');
        expect(markerKeySummary).toHaveTextContent('Markers');
        expect(markerKeySummary).toHaveTextContent('3 shapes');
        expect(markerKeySummary).toHaveAttribute('data-chain-marker-key-action', 'cashout');
        expect(markerKeySummary).toHaveAttribute('data-chain-marker-key-beats', '4');
        expect(markerKeySummary).toHaveAttribute('data-chain-marker-key-meter-fill', '83');
        expect(markerKeySummary).toHaveAttribute('data-chain-marker-key-screen-cue', 'burst');
        expect(markerKeySummary).toHaveAttribute('data-chain-marker-key-tier', 'stack');
        expect(markerKeySummary.querySelectorAll('[data-chain-marker-key-summary-beat]')).toHaveLength(4);
        expect(
            markerKeySummary.querySelector('[data-chain-marker-key-summary-beat="1"]')
        ).toHaveAttribute('data-chain-marker-key-summary-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-intensity', 'stack');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-focused-shape', 'payoff-stack');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="linked-route"]')).toHaveTextContent('oo');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="linked-route"]')).toHaveTextContent('Match route');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="payoff-bar"]')).toHaveTextContent('=+');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="payoff-bar"]')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="payoff-stack"]')).toHaveTextContent('**');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="payoff-stack"]')).toHaveTextContent('Cash stack');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="payoff-stack"]')).toHaveAttribute(
            'data-chain-marker-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('2');
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Stack');
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Cash stack');
        expect(
            screen.getByTestId('chain-marker-intensity').querySelectorAll('[data-chain-marker-intensity-pip]')
        ).toHaveLength(3);
        expect(
            screen.getByTestId('chain-marker-intensity').querySelector('[data-chain-marker-intensity-pip="1"]')
        ).toHaveAttribute('data-chain-marker-intensity-pip-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAccessibleName(
            'Chain marker key. Route: oo. Action: Match route. Payoff: =+. Action: Cash now. Stack: **. Action: Cash stack. Intensity: Stack 2. Action: Cash stack'
        );
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAttribute('data-chain-meter-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAccessibleName(
            'Chain board: Ready x2, Payoff x2, Hot x2. Next: Next reward x6 +1 shard in 1 match. One-away cashout. Push x6 reward. Sequence: First match lit route. Then Next reward x6 +1 shard in 1 match. Keep chain target live.'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveTextContent('Lit');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveAttribute(
            'data-chain-meter-lane-action',
            'match-route'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveAttribute(
            'data-chain-meter-lane-tone',
            'ready'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveTextContent('2');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="hot"]')).toHaveTextContent('Hot');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="hot"]')).toHaveAttribute(
            'data-chain-meter-lane-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="hot"]')).toHaveAttribute(
            'data-chain-meter-lane-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="hot"]')).toHaveTextContent('2');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="surge"]')).toBeNull();
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="cashout"]')).toHaveTextContent(
            'Next'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="cashout"]')).toHaveTextContent(
            'Echo + Sealed: combo shard'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[class*="chainOpportunityLines"]')).toHaveTextContent(
            '1 route ready / 2 cards lit / Reward hot'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-lines-meter-fill]')).toHaveAttribute(
            'data-chain-lines-meter-fill',
            '100'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-chip')
                .querySelector('[class*="chainOpportunityLines"]')
                ?.querySelectorAll('[data-chain-lines-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('chain-opportunity-chip')
                .querySelector('[class*="chainOpportunityLines"]')
                ?.querySelector('[data-chain-lines-beat="1"]')
        ).toHaveAttribute('data-chain-lines-beat-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-reward-ladder',
            'reward:0/2>guard:0/4>heal:4/8'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-reward-ladder-actions',
            'reward:Prime cashout:0/2>guard:Hold streak:0/4>heal:Hold streak:4/8'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-reward-ladder-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-reward-ladder-summary-action', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-reward-ladder-summary-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-reward-ladder-summary-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-reward-ladder-summary-tier', 'soon');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder',
            'reward:0/2>guard:0/4>heal:4/8'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-actions',
            'reward:Prime cashout:0/2>guard:Hold streak:0/4>heal:Hold streak:4/8'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-hot-band',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-focus',
            'soon'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-action',
            'prime'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-beats',
            '5'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-tier',
            'soon'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead').querySelector('small')).toHaveTextContent('Now');
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveTextContent('x6 +1 shard');
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveAttribute(
            'data-board-chain-reward-lead-tone',
            'reward'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveAttribute(
            'data-board-chain-reward-lead-action',
            'Prime cashout'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveAttribute(
            'data-board-chain-reward-lead-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveAttribute(
            'data-board-chain-reward-lead-tier',
            'next'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead')).toHaveAttribute(
            'data-board-chain-reward-lead-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-reward-lead').querySelector('small')).toHaveTextContent('Now');
        expect(
            screen.getByTestId('chain-opportunity-reward-lead').querySelectorAll('[data-board-chain-reward-lead-beat]')
        ).toHaveLength(3);
        expect(
            screen.getByTestId('chain-opportunity-reward-lead').querySelector('[data-board-chain-reward-lead-beat="1"]')
        ).toHaveAttribute('data-board-chain-reward-lead-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveTextContent('Rewards');
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveTextContent('3 rewards');
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-action',
            'prime'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-beats',
            '5'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-summary')).toHaveAttribute(
            'data-board-chain-reward-ladder-summary-tier',
            'soon'
        );
        expect(
            screen.getByTestId('chain-opportunity-reward-ladder-summary').querySelectorAll('[data-board-chain-reward-summary-beat]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('chain-opportunity-reward-ladder-summary')
                .querySelector('[data-board-chain-reward-summary-beat="1"]')
        ).toHaveAttribute('data-board-chain-reward-summary-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAccessibleName(
            'Board reward ladder. Prime: Prime cashout: x6 +1 shard. 0/2. 2 matches left. Hold streak: x8 +1 guard. 0/4. 4 matches left. Hold streak: x8 +1 life. 4/8. 4 matches left.'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('x6 +1 shard');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('0/2');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('x8 +1 guard');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('0/4');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('x8 +1 life');
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveTextContent('4/8');
        const healRewardTarget = screen
            .getByTestId('chain-opportunity-reward-ladder')
            .querySelector('[data-board-chain-reward-tone="heal"]');
        expect(
            screen.getByTestId('chain-opportunity-reward-ladder').querySelector('[data-board-chain-reward-tone="reward"]')
        ).toHaveAttribute('data-board-chain-reward-action', 'Prime cashout');
        expect(
            screen.getByTestId('chain-opportunity-reward-ladder').querySelector('[data-board-chain-reward-tone="reward"]')
        ).toHaveAttribute('data-board-chain-reward-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-reward-ladder')
                .querySelector('[data-board-chain-reward-tone="reward"]')
                ?.querySelector('[data-board-chain-reward-beat="1"]')
        ).toHaveAttribute('data-board-chain-reward-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-reward-ladder')
                .querySelector('[data-board-chain-reward-tone="reward"]')
                ?.querySelector('[data-board-chain-reward-beat="2"]')
        ).toHaveAttribute('data-board-chain-reward-beat-focus', 'support');
        expect(healRewardTarget).toHaveAttribute('data-board-chain-reward-action', 'Hold streak');
        expect(healRewardTarget).toHaveAttribute('data-board-chain-reward-focus', 'support');
        expect(healRewardTarget).toHaveAttribute('data-board-chain-reward-beats', '3');
        expect(healRewardTarget?.querySelectorAll('[data-board-chain-reward-beat]')).toHaveLength(3);
        expect(healRewardTarget?.querySelector('[data-board-chain-reward-beat="1"]')).toHaveAttribute(
            'data-board-chain-reward-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Push x6 reward');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('First');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Then');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Cash x6 +1 shard in 1 match');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Keep');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Push x6 reward');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAttribute('data-chain-sequence-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-sequence-cue').querySelectorAll('[data-chain-sequence-step]')).toHaveLength(3);
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="first"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="then"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="keep"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAccessibleName(
            'Chain sequence. First: Match lit route for reward. Then: Cash x6 +1 shard in 1 match. Keep: Push x6 reward.'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-priority="best"]')).toHaveTextContent(
            'Best play'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('1 route ready');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('2 cards lit');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Reward hot');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Payoff');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('x4 streak');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('1 match to reward');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveTextContent(
            'x4 streak'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveAttribute(
            'data-chain-momentum-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveAttribute(
            'data-chain-momentum-tier',
            'hot'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveAttribute(
            'data-chain-momentum-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveTextContent(
            '1 match to reward'
        );
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')
                ?.querySelectorAll('[data-chain-momentum-beat]')
        ).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')
                ?.querySelector('[data-chain-momentum-beat="1"]')
        ).toHaveAttribute('data-chain-momentum-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-action', 'cashout');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-beats', '5');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-tier', 'hot');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Hot lane');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Reward hot');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute(
            'data-chain-hot-band-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAccessibleName(
            /Chain hot band.*Reward hot.*Next reward x6 \+1 shard in 1 match.*One-away cashout/i
        );
        expect(screen.getByTestId('chain-opportunity-hot-band').querySelectorAll('[data-chain-hot-band-beat]')).toHaveLength(5);
        expect(screen.getByTestId('chain-opportunity-hot-band').querySelector('[data-chain-hot-band-beat="1"]')).toHaveAttribute(
            'data-chain-hot-band-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-hot-band').querySelector('[data-chain-hot-band-beat="2"]')).toHaveAttribute(
            'data-chain-hot-band-beat-focus',
            'support'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="true"]')).toHaveTextContent(
            'Next reward x6 +1 shard in 1 match'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="true"]')).toHaveAttribute(
            'data-chain-reward-beats',
            '5'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="true"]')).toHaveAttribute(
            'data-chain-reward-screen-cue',
            'super'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="true"]')).toHaveAttribute(
            'data-chain-reward-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="true"]')).toHaveAttribute(
            'data-chain-reward-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-recipes')).toHaveAttribute('data-chain-recipe-meter-fill', '33');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-meter-fill]')).toHaveAttribute(
            'data-chain-cue-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-meter-state]')).toHaveAttribute(
            'data-chain-cue-meter-state',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="5"]')).toHaveAttribute(
            'data-chain-momentum-meter-fill',
            '100'
        );
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-reward-beat]')
        ).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-beat="1"]')
        ).toHaveAttribute('data-chain-reward-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency="next"]')).toHaveTextContent(
            'One-away cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency="next"]')).toHaveAttribute(
            'data-chain-reward-urgency-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency="next"]')).toHaveAttribute(
            'data-chain-reward-urgency-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency="next"]')).toHaveAttribute(
            'data-chain-reward-urgency-tier',
            'next'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency="next"]')).toHaveAttribute(
            'data-chain-reward-urgency-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-examples-tone]')).toHaveAttribute(
            'data-chain-examples-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-examples-tone]')).toHaveTextContent(
            'Examples'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-examples-meter-fill]')).toHaveAttribute(
            'data-chain-examples-meter-fill',
            '25'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveAccessibleName(
            /Board chain opportunity.*Best play.*Cash out.*Match lit route for reward.*Push x6 reward.*x4 streak.*1 match to reward.*One-away cashout.*1 route ready.*2 cards lit.*Reward hot.*Next reward x6 \+1 shard in 1 match.*Echo \+ Sealed: combo shard/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-ready-count', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-ready-tile-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-priority', 'Best play');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action-label', 'Do next: cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-next-action-detail',
            'Match lit route for reward'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-momentum', 'x4 streak');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target-plan', 'Push x6 reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-count', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action', 'Cash out');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action-id', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-audio', 'cashout-beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-cue', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-screen-cue', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-screen-cue', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-label', 'Cashout beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-urgency-tier', 'next');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-tiers', 'cashout:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-counts', '5:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-chase', '1 match to reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-urgency', 'One-away cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-urgency-tier', 'next');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-hot', 'true');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-reward-urgency-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-urgency-beat="1"]')
        ).toHaveAttribute('data-chain-reward-urgency-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-examples-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-examples-beat="1"]')
        ).toHaveAttribute('data-chain-examples-beat-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-first', 'Match lit route for reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-then', 'Cash x6 +1 shard in 1 match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-keep', 'Push x6 reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-cue', 'Cash out');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target', 'Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-tier',
            'now'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target-plan]')).toHaveAttribute(
            'data-chain-target-plan-tone',
            'cashout'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-ready-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-surge-count', '0');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-reward-hot-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-setup-count', '0');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-accessibility-primary-line',
            'Echo + Sealed: combo shard'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-secondary-line', 'none');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-value', 'Stack live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-detail', 'One-away cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tier', 'cashout');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Trait mode');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Stack live');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Next reward');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-action', 'cashout');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-beats', '5');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-screen-cue', 'burst');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tier', 'cashout');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tone', 'cashout');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAccessibleName(
            /Trait mode.*Stack live.*Next reward.*One-away cashout/i
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-contract')).toContain('chain-reward-hot');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-action-priority-contract',
            'cash-now perk-cash follow-up build-lane route-setup bank-lane'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-priority', 'cash-now:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action', 'cash-now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-role', 'Cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-role-id', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-action-priority-summary-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-action-priority-summary-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-action-priority-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-action-priority-summary-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-primary-card-cue',
            'cash-now:cashout:5:cashout:payoff-stack'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-route-glyphs', 'payoff-stack:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-route-glyph-contract',
            'payoff-stack cashout-crown surge-burst next-tap linked-route prime-cross'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-primary',
            'cash-now'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-role', 'Cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-priority-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-priority-summary-beats',
            '3'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-priority-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-priority-summary-tier',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('Priority');
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveTextContent('Actions');
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveAttribute(
            'data-card-action-priority-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveAttribute(
            'data-card-action-priority-summary-beats',
            '3'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveAttribute(
            'data-card-action-priority-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveAttribute(
            'data-card-action-priority-summary-tier',
            'cashout'
        );
        expect(
            screen.getByTestId('chain-opportunity-action-priority-summary').querySelectorAll('[data-card-action-priority-summary-pip]')
        ).toHaveLength(3);
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('2');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveTextContent('Cash now');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-count', '2');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-role', 'Cashout');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-role-id', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-screen-cue', 'burst');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-tone', 'cashout');
        expect(
            screen
                .getByTestId('chain-opportunity-action-priority')
                .querySelector('[data-card-action-priority="cash-now"]')
                ?.querySelectorAll('[data-card-action-priority-pip]')
        ).toHaveLength(2);
        expect(
            screen
                .getByTestId('chain-opportunity-action-priority')
                .querySelector('[data-card-action-priority="cash-now"]')
                ?.querySelector('[data-card-action-priority-pip="1"]')
        ).toHaveAttribute('data-card-action-priority-pip-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAccessibleName(
            'Card action priority. Cash now: 2'
        );
        expect(screen.getByTestId('chain-opportunity-next-action').querySelector('small')).toHaveTextContent('Now');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('chain-opportunity-next-action').querySelectorAll('[data-chain-next-action-pip]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-next-action').querySelector('[data-chain-next-action-pip="1"]')
        ).toHaveAttribute('data-chain-next-action-pip-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveTextContent(
            'Lit'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveTextContent(
            '2'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="ready"]')
                ?.querySelectorAll('[data-chain-meter-pip]')
        ).toHaveLength(2);
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="ready"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="ready"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-action', 'match-route');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="ready"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-tone', 'ready');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="hot"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-action', 'cashout');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="hot"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="cashout"]')
        ).toHaveTextContent('Next');
        expect(
            screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="cashout"]')
        ).toHaveTextContent('Echo + Sealed: combo shard');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-route-tone="cashout"]')
                ?.querySelectorAll('[data-chain-next-route-pip]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-route-tone="cashout"]')
                ?.querySelector('[data-chain-next-route-pip="1"]')
        ).toHaveAttribute('data-chain-next-route-pip-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-route-tone="cashout"]')
                ?.querySelector('[data-chain-next-route-pip="1"]')
        ).toHaveAttribute('data-chain-next-route-pip-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-count', '2');
        expect(
            screen
                .getByTestId('chain-opportunity-shot-map')
                .querySelector('[data-chain-shot-map-lane="cash-now"]')
                ?.querySelectorAll('[data-chain-shot-map-pip]')
        ).toHaveLength(2);
        expect(
            screen
                .getByTestId('chain-opportunity-shot-map')
                .querySelector('[data-chain-shot-map-lane="cash-now"]')
                ?.querySelector('[data-chain-shot-map-pip="1"]')
        ).toHaveAttribute('data-chain-shot-map-pip-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-contract')).toContain('trait-payoff-stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-marker-shape-contract',
            'linked-route combo-surge payoff-bar payoff-stack swap-target-crossbar perk-armed-bar followup-target'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Cash out');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action-id', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-label', 'Combo route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-value', '1 route ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-tone', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Route cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue-id', 'route-cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-audio', 'opportunity-cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-heat', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-beats', '5');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-detail')).toContain(
            'One-away cashout'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack', 'none');
        expect(screen.queryByTestId('board-opportunity-payoff-stack')).toBeNull();
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Combo route');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Trait stack');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Best');
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('Best');
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('2 plays');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-summary-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-summary-action-label', 'Cash out');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-summary-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-summary-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-summary-tier', 'cashout');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-best-tone', 'chain');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-summary-action', 'cashout');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-summary-action-label', 'Cash out');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-summary-beats', '3');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-summary-tier', 'cashout');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-best-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-action-label',
            'Cash out'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-beats',
            '3'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-tier',
            'cashout'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-tone',
            'chain'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('board-opportunity-compass-meter')).toHaveAttribute('data-opportunity-compass-meter-fill', '70');
        expect(screen.getByTestId('board-opportunity-compass-summary').querySelectorAll('[data-opportunity-compass-summary-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('board-opportunity-compass-summary').querySelector('[data-opportunity-compass-summary-beat="1"]')
        ).toHaveAttribute('data-opportunity-compass-summary-beat-focus', 'primary');
        expect(
            screen.getByTestId('board-opportunity-compass-summary').querySelector('[data-opportunity-compass-summary-beat="1"]')
        ).toHaveAttribute('data-opportunity-compass-summary-beat-action', 'cashout');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-priority', 'best');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('1 route ready');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-row-meter-fill', '100');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-action-id', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Route cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue-id', 'route-cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-audio', 'opportunity-cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-screen-cue', 'burst');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-beats', '5');
        expect(screen.getByTestId('board-opportunity-chain').querySelectorAll('[data-opportunity-beat]')).toHaveLength(5);
        expect(screen.getByTestId('board-opportunity-chain').querySelector('[data-opportunity-beat="1"]')).toHaveAttribute(
            'data-opportunity-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('board-opportunity-chain').querySelector('[data-opportunity-beat="2"]')).toHaveAttribute(
            'data-opportunity-beat-focus',
            'support'
        );
        expect(screen.getByTestId('board-opportunity-trait')).toHaveTextContent('Trait stack');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveTextContent('2 combo cards lit');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-impact-cue', 'Trait stack surge');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-action-id', 'study');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-audio', 'opportunity-prime');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-screen-cue', 'pulse');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-heat', 'surge');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-row-meter-fill', '80');
        expect(screen.getByTestId('board-opportunity-trait')).toHaveAttribute('data-opportunity-beats', '4');
        expect(screen.getByTestId('board-opportunity-trait').querySelectorAll('[data-opportunity-beat]')).toHaveLength(4);
        expect(screen.getByTestId('board-opportunity-trait').querySelector('[data-opportunity-beat="1"]')).toHaveAttribute(
            'data-opportunity-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Cash out');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Match lit route for reward');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Push x6 reward');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('x4 streak');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('1 match to reward');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-tone', 'chain');
        expect(screen.getByTestId('board-opportunity-compass').getAttribute('aria-label')).toContain(
            'Trait stack surge. Trait stack: 2 combo cards lit. Study: A (echo) / A (sealed) / Echo + Sealed: combo shard / Next reward x6 +1 shard in 1 match'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute(
            'aria-label',
            'Best play. Route cashout. Combo route: 1 route ready. Cash out: Match lit route for reward / Echo + Sealed: combo shard / Push x6 reward / x4 streak / 1 match to reward / One-away cashout / Next reward x6 +1 shard in 1 match'
        );

        fireEvent.focus(screen.getByTestId('tile-board-application'));

        await waitFor(() => expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Trait combo'));
        expect(screen.getByText(/Chain board: Ready x2, Payoff x2, Hot x2/i)).toBeInTheDocument();
        expect(screen.getByText(/Next: Next reward x6 \+1 shard in 1 match/i)).toBeInTheDocument();
        expect(screen.getByText(/Sequence: First match lit route/i)).toBeInTheDocument();
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Stack');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('2 combo cards lit');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Cashout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-action', 'Cashout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-tone', 'cashout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-beats', '5');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-density', '2');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-density-tone', 'cashout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-signal-fill', '100');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-meter-fill', '50');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-meter-fill="50"]')).toHaveStyle({
            '--trait-preview-meter-fill': '50%'
        });
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-signal-fill="100"]')).toHaveStyle({
            '--trait-preview-signal-fill': '100%'
        });
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-kind]')).toHaveAttribute(
            'data-preview-action-kind',
            'trait'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-tone]')).toHaveAttribute(
            'data-preview-action-tone',
            'cashout'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelectorAll('[data-preview-beat]')).toHaveLength(5);
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-beat="1"]')).toHaveAttribute(
            'data-preview-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-beat="2"]')).toHaveAttribute(
            'data-preview-beat-focus',
            'support'
        );
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Cashout /');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-cashout-kind]')).toHaveAttribute(
            'data-preview-cashout-kind',
            'trait'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-cashout-tone]')).toHaveAttribute(
            'data-preview-cashout-tone',
            'cashout'
        );
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Push x6 reward');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[class*="traitPreviewSignalMeter"]')).toBeTruthy();
        expect(
            screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')
        ).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-kind',
            'trait'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-tone',
            'cashout'
        );
        expect(screen.getByTestId('trait-preview-chip')).toHaveAccessibleName(
            /Trait combo stack preview.*Cashout.*Cashout.*Next reward x6 \+1 shard in 1 match.*One-away cashout.*Push x6 reward.*Echo \+ Sealed: combo shard/i
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('chain-ready:2');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('chain-reward-hot:2');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('trait-combo:2');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('trait-payoff-stack:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-trait-combo-surge', 'false');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-trait-payoff-stack', 'true');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-cues', 'cash-now:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-action-cue-contract',
            'bank-lane build-lane cash-now follow-up perk-cash route-setup'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-beat-tier-contract',
            'cashout surge follow-up route setup'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-cadence-contract',
            'cashout surge follow-up route prime'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-tiers', 'cashout:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-counts', '5:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-cadences',
            'cashout:Cash now:2'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-shot-map', 'cash-now:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot', 'cash-now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-audio', 'card-shot-cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-label', 'Cash');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-focus', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-shot-map-summary-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-shot-map-summary-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-shot-map-summary-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-shot-map-summary-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-primary-shot-detail',
            'Cashout lane'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-beat', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-beat-action', 'hit now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-beat-count', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-beat-map-summary-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-beat-map-summary-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-beat-map-summary-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-beat-map-summary-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-cadence', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-cadence-action', 'Cash now');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot', 'cash-now');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-audio', 'card-shot-cashout');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-beat', 'cashout');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-beats', '5');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute(
            'data-card-primary-shot-cadence',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-focus', 'cashout');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAccessibleName(
            'Primary combo shot. Cash: Cashout lane. 5-beat hit now. Pulse: Cash now.'
        );
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Best shot');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Cash');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Cashout lane');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Cash now');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelectorAll('[data-card-primary-shot-beat-pip]')
        ).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="1"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="1"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-shot-focus', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="1"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-screen-cue', 'burst');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="2"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-focus', 'support');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute(
            'data-chain-shot-map-primary',
            'cash-now'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role', 'Cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role-id', 'cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-summary-action', 'cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-summary-beats', '3');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-summary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-summary-tier', 'cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveTextContent('Shots');
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveAttribute(
            'data-chain-shot-map-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveAttribute(
            'data-chain-shot-map-summary-beats',
            '3'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveAttribute(
            'data-chain-shot-map-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveAttribute(
            'data-chain-shot-map-summary-tier',
            'cashout'
        );
        expect(
            screen.getByTestId('chain-opportunity-shot-map-summary').querySelectorAll('[data-chain-shot-map-summary-pip]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('chain-opportunity-shot-map-summary')
                .querySelector('[data-chain-shot-map-summary-pip="1"]')
        ).toHaveAttribute('data-chain-shot-map-summary-pip-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAccessibleName(
            'Combo shot map. Cash: 2. Cashout lane.'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveTextContent('Shot map');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveTextContent('Cash');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveTextContent('Cashout lane');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-role', 'Cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-role-id', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-screen-cue', 'burst');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-actions', 'cashout:hit now:2');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveTextContent('Beats');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-map-summary-action', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-map-summary-beats', '5');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute(
            'data-card-beat-map-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-map-summary-tier', 'cashout');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-beats',
            '5'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-meter-fill',
            '20'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-tier',
            'cashout'
        );
        expect(
            screen.getByTestId('chain-opportunity-beat-map-summary').querySelectorAll('[data-card-beat-map-summary-pip]')
        ).toHaveLength(5);
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAccessibleName(
            'Card beat map. Cashout: 2. 5-beat hit now.'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('Beat map');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('Cashout');
        expect(
            screen.getByTestId('chain-opportunity-beat-map').querySelectorAll('[data-card-beat-tier="cashout"] [data-card-beat-pip]')
        ).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"] [data-card-beat-pip="1"]')
        ).toHaveAttribute('data-card-beat-pip-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"] [data-card-beat-pip="2"]')
        ).toHaveAttribute('data-card-beat-pip-focus', 'support');
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"]')).toHaveAttribute(
            'data-card-beat-action',
            'hit now'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"]')).toHaveAttribute(
            'data-card-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"]')).toHaveAttribute(
            'data-card-beat-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="cashout"]')).toHaveAttribute(
            'data-card-beat-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('hit now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-cadence-map-summary-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-cadence-map-summary-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-cadence-map-summary-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-cadence-map-summary-tier', 'cashout');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary', 'cashout');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute(
            'data-card-cadence-map-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-map-summary-beats', '5');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute(
            'data-card-cadence-map-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute(
            'data-card-cadence-map-summary-tier',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAccessibleName(
            'Card pulse map. Cashout: 2. Cash now. 5-beat pulse.'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Pulse map');
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveTextContent('Pulses');
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveAttribute(
            'data-card-cadence-map-summary-action',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveAttribute(
            'data-card-cadence-map-summary-beats',
            '5'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveAttribute(
            'data-card-cadence-map-summary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveAttribute(
            'data-card-cadence-map-summary-tier',
            'cashout'
        );
        expect(
            screen.getByTestId('chain-opportunity-cadence-map-summary').querySelectorAll('[data-card-cadence-map-summary-pip]')
        ).toHaveLength(5);
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Cashout');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="cashout"]')).toHaveAttribute(
            'data-card-cadence-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="cashout"]')).toHaveAttribute(
            'data-card-cadence-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="cashout"]')).toHaveAttribute(
            'data-card-cadence-tone',
            'cashout'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-cadence-map')
                .querySelectorAll('[data-card-cadence="cashout"] [data-card-cadence-pip]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('chain-opportunity-cadence-map')
                .querySelector('[data-card-cadence="cashout"] [data-card-cadence-pip="1"]')
        ).toHaveAttribute('data-card-cadence-pip-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-cadence-map')
                .querySelector('[data-card-cadence="cashout"] [data-card-cadence-pip="2"]')
        ).toHaveAttribute('data-card-cadence-pip-focus', 'support');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-tiers',
            'payoff-stack:2'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-intensities',
            'stack:2'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-shapes')).toContain(
            'linked-route:2'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-shapes')).toContain(
            'payoff-stack:2'
        );
    });

    it('summarizes board trait interactions into visible payoff lanes', () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                    { ...board.tiles[3]!, pairKey: 'stasis', tileTraitKind: 'stasis' }
                ]
            },
            debugPeekActive: false,
            interactive: true,
            chainContext: { comboShards: 1, currentStreak: 4, lives: 4 },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        const frame = screen.getByTestId('tile-board-frame');
        const laneMap = screen.getByTestId('chain-opportunity-trait-lane-map');
        const laneBeatMap = screen.getByTestId('chain-opportunity-trait-lane-beat-map');
        const primaryTraitLane = screen.getByTestId('chain-opportunity-primary-trait-lane');
        expect(frame).toHaveAttribute('data-trait-interaction-lane-map', 'shard:1>guard:1>block:1>recall:1');
        expect(frame).toHaveAttribute(
            'data-trait-interaction-lane-roles',
            'shard:Cashout:1>guard:Protect:1>block:Block:1>recall:Recall:1'
        );
        expect(frame).toHaveAttribute('data-trait-interaction-lane-count', '4');
        expect(frame).toHaveAttribute(
            'data-card-feedback-trait-lane-actions',
            'shard:Cash shard:1>guard:Protect run:1>recall:Set memory:1'
        );
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-beats', 'shard:4>guard:3>recall:3');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lanes', 'shard:1>guard:1>recall:1');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-primary-audio', 'trait-lane-shard');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-primary-action', 'shard:Cash shard:1');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-primary-role', 'Cashout');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-primary-role-id', 'cashout');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-primary-screen-cue', 'burst');
        expect(frame).toHaveAttribute('data-card-trait-lane-beat-map-summary-action', 'cashout');
        expect(frame).toHaveAttribute('data-card-trait-lane-beat-map-summary-beats', '5');
        expect(frame).toHaveAttribute('data-card-trait-lane-beat-map-summary-screen-cue', 'burst');
        expect(frame).toHaveAttribute('data-card-trait-lane-beat-map-summary-tier', 'cashout');
        expect(frame).toHaveAttribute('data-card-feedback-trait-lane-contract', 'shard guard tool risk block recall score');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary', 'shard');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-action', 'Cash shard');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-audio', 'trait-lane-shard');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-beats', '4');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-role', 'Cashout');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-role-id', 'cashout');
        expect(primaryTraitLane).toHaveAttribute('data-card-trait-lane-primary-screen-cue', 'burst');
        expect(primaryTraitLane).toHaveAccessibleName('Primary trait lane action. Shard: 1. 4-beat Cash shard.');
        expect(primaryTraitLane).toHaveTextContent('Next lane');
        expect(primaryTraitLane).toHaveTextContent('Cash shard');
        expect(primaryTraitLane.querySelectorAll('[data-card-trait-lane-primary-pip]')).toHaveLength(4);
        expect(screen.getByTestId('chain-opportunity-trait-lane-map-summary')).toHaveAttribute(
            'data-trait-interaction-lane-map-meter-fill',
            '80'
        );
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-primary', 'shard');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-primary-role', 'Cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-primary-role-id', 'cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-map-summary-action', 'cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-map-summary-beats', '5');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-map-summary-screen-cue', 'burst');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-beat-map-summary-tier', 'cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-primary-action', 'Cash shard');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-primary-audio', 'trait-lane-shard');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-primary-role', 'Cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-primary-role-id', 'cashout');
        expect(laneBeatMap).toHaveAttribute('data-card-trait-lane-primary-screen-cue', 'burst');
        const laneBeatMapSummary = screen.getByTestId('chain-opportunity-trait-lane-beat-map-summary');
        expect(laneBeatMapSummary).toHaveTextContent('Beats');
        expect(laneBeatMapSummary).toHaveTextContent('3 lanes');
        expect(laneBeatMapSummary).toHaveAttribute('data-card-trait-lane-beat-map-summary-action', 'cashout');
        expect(laneBeatMapSummary).toHaveAttribute('data-card-trait-lane-beat-map-summary-beats', '5');
        expect(laneBeatMapSummary).toHaveAttribute('data-card-trait-lane-beat-map-summary-screen-cue', 'burst');
        expect(laneBeatMapSummary).toHaveAttribute('data-card-trait-lane-beat-map-summary-tier', 'cashout');
        expect(laneBeatMapSummary).toHaveAttribute('data-card-trait-lane-beat-map-meter-fill', '60');
        expect(laneBeatMapSummary.querySelectorAll('[data-card-trait-lane-beat-map-summary-pip]')).toHaveLength(5);
        expect(
            laneBeatMapSummary.querySelector('[data-card-trait-lane-beat-map-summary-pip="1"]')
        ).toHaveAttribute('data-card-trait-lane-beat-map-summary-pip-focus', 'primary');
        expect(
            laneBeatMapSummary.querySelector('[data-card-trait-lane-beat-map-summary-pip="1"]')
        ).toHaveAttribute('data-card-trait-lane-beat-map-summary-pip-action', 'cashout');
        expect(laneBeatMap).toHaveTextContent('Shard');
        expect(laneBeatMap).toHaveTextContent('4-beat Cash shard');
        const shardLaneBeat = laneBeatMap.querySelector('[data-card-trait-lane-beat="shard"]');
        const guardLaneBeat = laneBeatMap.querySelector('[data-card-trait-lane-beat="guard"]');
        expect(shardLaneBeat).toHaveTextContent('1');
        expect(shardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-audio', 'trait-lane-shard');
        expect(shardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-focus', 'primary');
        expect(shardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-role', 'Cashout');
        expect(shardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-role-id', 'cashout');
        expect(shardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-screen-cue', 'burst');
        expect(guardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-audio', 'trait-lane-guard');
        expect(guardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-focus', 'support');
        expect(guardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-role', 'Protect');
        expect(guardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-role-id', 'protect');
        expect(guardLaneBeat).toHaveAttribute('data-card-trait-lane-beat-screen-cue', 'guard');
        expect(
            shardLaneBeat?.querySelectorAll('[data-card-trait-lane-beat-pip]')
        ).toHaveLength(4);
        expect(shardLaneBeat?.querySelector('[data-card-trait-lane-beat-pip="1"]')).toHaveAttribute(
            'data-card-trait-lane-beat-pip-focus',
            'primary'
        );
        expect(shardLaneBeat?.querySelector('[data-card-trait-lane-beat-pip="2"]')).toHaveAttribute(
            'data-card-trait-lane-beat-pip-focus',
            'support'
        );
        expect(
            guardLaneBeat?.querySelectorAll('[data-card-trait-lane-beat-pip]')
        ).toHaveLength(3);
        expect(guardLaneBeat?.querySelector('[data-card-trait-lane-beat-pip="1"]')).toHaveAttribute(
            'data-card-trait-lane-beat-pip-focus',
            'primary'
        );
        expect(laneBeatMap).toHaveAccessibleName(
            'Trait lane beat map. Shard: 1. 4-beat Cash shard. Guard: 1. 3-beat Protect run. Recall: 1. 3-beat Set memory.'
        );
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-map', 'shard:1>guard:1>block:1>recall:1');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary', 'shard');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary-action', 'Cash shard');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary-audio', 'trait-lane-shard');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary-role', 'Cashout');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary-role-id', 'cashout');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-primary-screen-cue', 'burst');
        expect(laneMap).toHaveAttribute(
            'data-trait-interaction-lane-actions',
            'shard:Cash shard:1>guard:Protect run:1>block:Deny match:1>recall:Set memory:1'
        );
        expect(laneMap).toHaveAttribute(
            'data-trait-interaction-lane-roles',
            'shard:Cashout:1>guard:Protect:1>block:Block:1>recall:Recall:1'
        );
        expect(screen.getByTestId('chain-opportunity-trait-lane-map-summary')).toHaveTextContent('Traits');
        expect(screen.getByTestId('chain-opportunity-trait-lane-map-summary')).toHaveTextContent('4 lanes');
        expect(
            screen.getByTestId('chain-opportunity-trait-lane-map-summary').querySelectorAll('[data-trait-interaction-lane-summary-beat]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('chain-opportunity-trait-lane-map-summary')
                .querySelector('[data-trait-interaction-lane-summary-beat="1"]')
        ).toHaveAttribute('data-trait-interaction-lane-summary-beat-focus', 'primary');
        expect(laneMap).toHaveTextContent('Shard');
        expect(laneMap).toHaveTextContent('Cash shard');
        expect(laneMap).toHaveTextContent('Echo + Sealed: combo shard');
        expect(laneMap).toHaveTextContent('Guard');
        expect(laneMap).toHaveTextContent('Protect run');
        expect(laneMap).toHaveTextContent('Mirror + Stasis: guard ward');
        expect(laneMap).toHaveTextContent('Block');
        expect(laneMap).toHaveTextContent('Deny match');
        expect(laneMap).toHaveTextContent('Stasis buffered Sealed');
        expect(laneMap).toHaveTextContent('Recall');
        expect(laneMap).toHaveTextContent('Set memory');
        expect(laneMap).toHaveTextContent('Echo + Mirror: recall focus');
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-action',
            'Cash shard'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-audio',
            'trait-lane-shard'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-focus',
            'primary'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-beats',
            '2'
        );
        expect(
            laneMap.querySelector('[data-trait-interaction-lane="shard"]')?.querySelectorAll('[data-trait-interaction-lane-beat]')
        ).toHaveLength(2);
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-role',
            'Cashout'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'cashout'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-screen-cue',
            'burst'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="guard"]')).toHaveAttribute(
            'data-trait-interaction-lane-audio',
            'trait-lane-guard'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="guard"]')).toHaveAttribute(
            'data-trait-interaction-lane-focus',
            'support'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="guard"]')).toHaveAttribute(
            'data-trait-interaction-lane-screen-cue',
            'guard'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="guard"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'protect'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="block"]')).toHaveAttribute(
            'data-trait-interaction-lane-audio',
            'trait-lane-block'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="block"]')).toHaveAttribute(
            'data-trait-interaction-lane-screen-cue',
            'risk'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="block"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'block'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="recall"]')).toHaveAttribute(
            'data-trait-interaction-lane-audio',
            'trait-lane-recall'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="recall"]')).toHaveAttribute(
            'data-trait-interaction-lane-screen-cue',
            'pulse'
        );
        expect(laneMap.querySelector('[data-trait-interaction-lane="recall"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'recall'
        );
        expect(laneMap).toHaveAccessibleName(
            'Trait interaction lanes. Shard Cashout x1. Cash shard. Echo + Sealed: combo shard. Guard Protect x1. Protect run. Mirror + Stasis: guard ward. Block Block x1. Deny match. Stasis buffered Sealed. Recall Recall x1. Set memory. Echo + Mirror: recall focus.'
        );
    });

    it('keeps the board trait lane map visible when only one trait lane is live', () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', label: 'Echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', label: 'Sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, state: 'matched' },
                    { ...board.tiles[3]!, state: 'matched' }
                ]
            },
            debugPeekActive: false,
            interactive: true,
            chainContext: { comboShards: 0, currentStreak: 2, lives: 4 },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        const laneMap = screen.getByTestId('chain-opportunity-trait-lane-map');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-map', 'shard:1');
        expect(laneMap).toHaveAttribute('data-trait-interaction-lane-roles', 'shard:Cashout:1');
        expect(screen.getByTestId('chain-opportunity-trait-lane-map-summary')).toHaveTextContent('Traits');
        expect(screen.getByTestId('chain-opportunity-trait-lane-map-summary')).toHaveTextContent('1 lane');
        expect(laneMap).toHaveTextContent('Shard');
        expect(laneMap).toHaveTextContent('Cash shard');
        expect(laneMap).toHaveTextContent('Echo + Sealed: combo shard');
        expect(laneMap).toHaveAccessibleName('Trait interaction lanes. Shard Cashout x1. Cash shard. Echo + Sealed: combo shard.');
    });

    it('surfaces selected trait follow-up markers after the first comboable trait card is flipped', () => {
        renderBoard({
            board: {
                ...board,
                flippedTileIds: ['echo-a'],
                tiles: [
                    { ...board.tiles[0]!, id: 'echo-a', pairKey: 'echo', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, id: 'sealed-a', pairKey: 'sealed', label: 'Sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, id: 'echo-b', pairKey: 'echo', label: 'Echo', tileTraitKind: 'echo' },
                    board.tiles[3]!
                ]
            },
            debugPeekActive: false,
            interactive: true,
            chainContext: { comboShards: 0, currentStreak: 1, lives: 4 },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain(
            'selected-followup:1'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-shapes')).toContain(
            'followup-target:1'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-action-cues')).toContain(
            'follow-up:1'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-action-priority')).toContain(
            'follow-up:1'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action', 'follow-up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-recipes', 'Echo + Sealed');
        expect(screen.getByTestId('chain-opportunity-recipes')).toHaveTextContent('Echo + Sealed');
        expect(screen.getByTestId('chain-opportunity-recipes').querySelectorAll('[data-chain-recipe-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('chain-opportunity-recipes').querySelector('[data-chain-recipe="Echo + Sealed"]')
        ).toHaveAttribute('data-chain-recipe', 'Echo + Sealed');
        expect(
            screen.getByTestId('chain-opportunity-recipes').querySelector('[data-chain-recipe="Echo + Sealed"]')
        ).toHaveAttribute('data-chain-recipe-lane', 'shard');
        expect(
            screen.getByTestId('chain-opportunity-recipes').querySelector('[data-chain-recipe="Echo + Sealed"]')
        ).toHaveAttribute('data-chain-recipe-role-id', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-recipes').querySelector('[data-chain-recipe="Echo + Sealed"]')
        ).toHaveAttribute('data-chain-recipe-source', 'Echo + Sealed: combo shard');
        expect(
            screen
                .getByTestId('chain-opportunity-recipes')
                .querySelector('[data-chain-recipe="Echo + Sealed"]')
                ?.querySelector('[data-chain-recipe-beat="1"]')
        ).toHaveAttribute('data-chain-recipe-beat-lane', 'shard');
        expect(
            screen
                .getByTestId('chain-opportunity-recipes')
                .querySelector('[data-chain-recipe="Echo + Sealed"]')
                ?.querySelector('[data-chain-recipe-beat="1"]')
        ).toHaveAttribute('data-chain-recipe-beat-role-id', 'cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute(
            'data-card-action-primary',
            'follow-up'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-role', 'Follow-up');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-screen-cue', 'pulse');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-role-id', 'followup');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-tone', 'followup');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('Follow-up');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveTextContent('Follow-up');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveAttribute('data-card-action-priority-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveAttribute('data-card-action-priority-role', 'Follow-up');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveAttribute('data-card-action-priority-role-id', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveAttribute('data-card-action-priority-screen-cue', 'pulse');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="follow-up"]')
        ).toHaveAttribute('data-card-action-priority-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="build-lane"]')
        ).toHaveAttribute('data-card-action-priority-role', 'Setup');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="build-lane"]')
        ).toHaveAttribute('data-card-action-priority-role-id', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="build-lane"]')
        ).toHaveAttribute('data-card-action-priority-screen-cue', 'tick');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="build-lane"]')
        ).toHaveAttribute('data-card-action-priority-tone', 'setup');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-source', 'selected');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-kind', 'trait');
        expect(screen.getByTestId('trait-preview-summary')).toHaveAttribute('data-preview-summary-kind', 'trait');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Trait combo');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Preview');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAccessibleName(
            'Card action priority. Follow-up: 1. Route prime: 1'
        );
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-count', '1');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
                ?.querySelectorAll('[data-chain-shot-map-pip]')
        ).toHaveLength(2);
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
                ?.querySelector('[data-chain-shot-map-pip="1"]')
        ).toHaveAttribute('data-chain-shot-map-pip-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-shot-map',
            'follow-up:1>build-lane:1'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAccessibleName(
            'Combo shot map. Tap: 1. Next tap. Build: 1. Route lane.'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveTextContent('Shots');
        expect(screen.getByTestId('chain-opportunity-shot-map-summary')).toHaveTextContent('2 lanes');
        expect(
            screen.getByTestId('chain-opportunity-shot-map-summary').querySelectorAll('[data-chain-shot-map-summary-pip]')
        ).toHaveLength(3);
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute(
            'data-chain-shot-map-primary',
            'follow-up'
        );
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role', 'Follow-up');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role-id', 'followup');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-screen-cue', 'pulse');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveTextContent('Tap');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-role', 'Follow-up');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-role-id', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-screen-cue', 'pulse');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="follow-up"]')
        ).toHaveAttribute('data-chain-shot-map-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveTextContent('Route lane');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveAttribute('data-chain-shot-map-focus', 'support');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveAttribute('data-chain-shot-map-role', 'Setup');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveAttribute('data-chain-shot-map-role-id', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveAttribute('data-chain-shot-map-screen-cue', 'tick');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="build-lane"]')
        ).toHaveAttribute('data-chain-shot-map-tone', 'setup');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-trait-route-tiers')).toContain(
            'selected-followup:1'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-trait-route-intensities')).toContain(
            'ready:2'
        );
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="followup-target"]')).toHaveTextContent('|=');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="followup-target"]')).toHaveTextContent('Next tap');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-intensity', 'ready');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-focused-shape', 'followup-target');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="followup-target"]')).toHaveAttribute(
            'data-chain-marker-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Ready');
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Match route');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAccessibleName(
            'Chain marker key. Route: oo. Action: Match route. Follow-up: |=. Action: Next tap. Intensity: Ready 2. Action: Match route'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-selected-followups', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-selected-followup-label',
            '1 follow-up marked'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-priority', 'Follow-up ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action', 'follow-up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action-tone', 'ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action', 'Tap follow-up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action-id', 'followup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-audio', 'follow-up-beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-screen-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-screen-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-tier', 'follow-up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-counts', '3:2');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action', 'follow-up');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tone', 'ready');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'data-chain-next-action-meter-fill',
            '75'
        );
        expect(screen.getByTestId('chain-opportunity-next-action').querySelector('small')).toHaveTextContent('Tap');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveTextContent('1 follow-up marked');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Follow-up beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('1 follow-up marked');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action-id', 'followup');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-meter-fill', '60');
        expect(screen.getByTestId('chain-opportunity-beat').querySelectorAll('[data-chain-opportunity-beat-pip]')).toHaveLength(3);
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-cue', 'Follow up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target', 'Tap marked follow-up');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-action',
            'follow-up'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-tier',
            'tap'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-first', 'Tap marked follow-up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-sequence-then',
            'Match the marked follow-up to resolve the trait route.'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-keep', 'Start x3 loop');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-tone', 'followup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-accessibility-followup-count', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-accessibility-primary-line',
            '1 selected follow-up'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="followup"]')).toHaveTextContent(
            'Follow'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="followup"]')).toHaveTextContent(
            '1'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Follow-up ready');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Follow up');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Tap marked follow-up');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAttribute('data-chain-sequence-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="first"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="then"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'followup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="keep"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'followup');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('First');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Tap marked follow-up');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Then');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Match the marked follow-up to resolve the trait route.');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Keep');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Start x3 loop');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAccessibleName(
            'Chain sequence. First: Tap marked follow-up. Then: Match the marked follow-up to resolve the trait route. Keep: Start x3 loop.'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('1 follow-up marked');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-priority="followup"]')).toHaveTextContent(
            'Follow-up ready'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-followup-ready="true"]')).toHaveTextContent(
            'Next tap'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-followup-ready="true"]')).toHaveTextContent(
            '1 follow-up marked'
        );
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAttribute(
            'data-chain-followup-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveStyle({
            '--chain-followup-meter-fill': '100%'
        });
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAccessibleName(
            'Next tap follow-up. 1 follow-up marked. 3 beats.'
        );
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAttribute('data-chain-followup-action', 'Tap follow-up');
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAttribute('data-chain-followup-beats', '3');
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAttribute('data-chain-followup-screen-cue', 'pulse');
        expect(screen.getByTestId('chain-opportunity-followup-cue')).toHaveAttribute('data-chain-followup-tone', 'route');
        expect(screen.getByTestId('chain-opportunity-followup-cue').querySelectorAll('[data-chain-followup-beat]')).toHaveLength(3);
        expect(
            screen
                .getByTestId('chain-opportunity-followup-cue')
                .querySelector('[data-chain-followup-beat="1"]')
        ).toHaveAttribute('data-chain-followup-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('chain-opportunity-followup-cue')
                .querySelector('[data-chain-followup-beat="2"]')
        ).toHaveAttribute('data-chain-followup-beat-focus', 'support');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Follow-up route');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Follow-up route');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Follow up');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('1 follow-up marked');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Follow up');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action-id', 'followup');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-action-id', 'followup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Follow-up route');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-detail')).toContain(
            '1 follow-up marked'
        );
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Follow-up live');
    });

    it('classifies selected follow-up plus pickup boards as follow-up stacks', () => {
        renderBoard({
            board: {
                ...board,
                columns: 3,
                rows: 2,
                flippedTileIds: ['echo-a'],
                tiles: [
                    { ...board.tiles[0]!, id: 'echo-a', pairKey: 'echo', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, id: 'sealed-a', pairKey: 'sealed', label: 'Sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, id: 'echo-b', pairKey: 'echo', label: 'Echo', tileTraitKind: 'echo' },
                    { id: 'spark-a', pairKey: 'spark', symbol: 'P', label: 'Spark', state: 'hidden', findableKind: 'shard_spark' },
                    { id: 'spark-b', pairKey: 'spark', symbol: 'P', label: 'Spark', state: 'hidden', findableKind: 'shard_spark' },
                    { id: 'filler', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' }
                ]
            },
            debugPeekActive: false,
            interactive: true,
            chainContext: { comboShards: 0, currentStreak: 1, lives: 4 },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack', '2 payoffs live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue', 'Follow-up stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue-id', 'followup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-action', 'Next tap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-tone', 'followup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-beats', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-tier', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-tone', 'followup');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-cue-id', 'followup');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-beats', '2');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-cue', 'pulse');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-tier', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-fill', '40');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Follow-up stack');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Next tap');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack route + Rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Two-beat payoff route is primed');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Keep: Keep route moving');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute(
            'data-payoff-stack-sequence-first',
            'Follow up stack route'
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute(
            'data-payoff-stack-sequence-then',
            'Claim rewards'
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute(
            'data-payoff-stack-sequence-keep',
            'Keep route moving'
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAccessibleName(
            'Board payoff stack. Follow-up stack. Next tap. 2 payoffs live. Stack route + Rewards. Crescendo: Prime beat. Two-beat payoff route is primed. 2 beats. First: Follow up stack route. Then: Claim rewards. Keep: Keep route moving.'
        );
    });

    it('marks the top opportunity compass row as the best play when multiple cues compete', async () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, pairKey: 'spark', findableKind: 'shard_spark' },
                    { ...board.tiles[3]!, pairKey: 'spark', findableKind: 'shard_spark' }
                ]
            },
            chainContext: { comboShards: 0, currentStreak: 1, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action-id', 'match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-label', 'Combo route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-value', '1 route ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-tone', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Prime cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue-id', 'prime-cashout');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-detail')).toContain(
            'Prime cashout'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map', 'build:1>trait:1>pickup:1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map-action', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map-tier', 'build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-label', 'Build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-lane-role-ids',
            'build:prime:1>trait:study:1>pickup:claim:1'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane', 'build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-action', 'Prime build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-role-id', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-audio', 'board-opportunity-build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-cue', 'Prime cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-primary-lane-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack', '2 payoffs live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-action', 'Prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue', 'Stack prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue-id', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-tone', 'build');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-first-cue',
            'First: Match stack route'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-sequence-cue',
            'Then: Claim rewards'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-sequence-first',
            'Match stack route'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-sequence-then',
            'Claim rewards'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-sequence-keep',
            'Keep reward stack primed'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-beats', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-tier', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-tone', 'build');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-cue-id', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-heat', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-beats', '2');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-cue', 'pulse');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-tier', 'prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-fill', '40');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Prime payoff');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('2 payoffs live');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack route + Rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Two-beat payoff route is primed');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('First: Match stack route');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Then: Claim rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Keep: Keep reward stack primed');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAccessibleName(
            'Board payoff stack. Stack prime. Prime. 2 payoffs live. Stack route + Rewards. Crescendo: Prime beat. Two-beat payoff route is primed. 2 beats. First: Match stack route. Then: Claim rewards. Keep: Keep reward stack primed.'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-map',
            'build:1>trait:1>pickup:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-lane-map-action', 'prime');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-lane-map-beats', '5');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-map-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-lane-map-tier', 'build');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-actions',
            'build:Prime build:1>trait:Study traits:1>pickup:Claim pickup:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-action-ids',
            'build:prime:1>trait:study:1>pickup:claim:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-roles',
            'build:Prime:1>trait:Study:1>pickup:Claim:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-role-ids',
            'build:prime:1>trait:study:1>pickup:claim:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-primary-lane', 'build');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-action',
            'Prime build'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-action-id',
            'prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-focus',
            'build'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-role',
            'Prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-role-id',
            'prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-audio',
            'board-opportunity-build'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-primary-lane-beats', '3');
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-meter-fill',
            '60'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-cue',
            'Prime cashout'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveTextContent('Lanes');
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveTextContent('3 lanes');
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveAttribute(
            'data-opportunity-lane-map-action',
            'prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveAttribute(
            'data-opportunity-lane-map-beats',
            '5'
        );
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveAttribute(
            'data-opportunity-lane-map-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveAttribute(
            'data-opportunity-lane-map-tier',
            'build'
        );
        expect(
            screen.getByTestId('board-opportunity-lane-map-summary').querySelectorAll('[data-opportunity-lane-map-summary-beat]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('board-opportunity-lane-map-summary')
                .querySelector('[data-opportunity-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-opportunity-lane-map-summary-beat-focus', 'primary');
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAccessibleName(
            'Primary opportunity lane. Build Prime. Prime build. Prime cashout. 3 beats.'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute('data-opportunity-primary-lane', 'build');
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-action',
            'Prime build'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-action-id',
            'prime'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-audio',
            'board-opportunity-build'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveTextContent('Board focus');
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveTextContent('Prime');
        expect(screen.getByTestId('board-opportunity-primary-lane').querySelectorAll('[data-opportunity-primary-lane-beat]')).toHaveLength(3);
        expect(screen.getByTestId('board-opportunity-primary-lane').querySelector('[data-opportunity-primary-lane-beat="1"]')).toHaveAttribute(
            'data-opportunity-primary-lane-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane').querySelector('[data-opportunity-primary-lane-beat="2"]')).toHaveAttribute(
            'data-opportunity-primary-lane-beat-focus',
            'support'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Build');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Pickup');
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="build"]')).toHaveAttribute(
            'data-opportunity-lane-beats',
            '3'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="build"]')).toHaveAttribute(
            'data-opportunity-lane-meter-fill',
            '60'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="build"]')).toHaveAttribute(
            'data-opportunity-lane-role',
            'Prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="build"]')).toHaveAttribute(
            'data-opportunity-lane-role-id',
            'prime'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="trait"]')).toHaveAttribute(
            'data-opportunity-lane-role-id',
            'study'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="pickup"]')).toHaveAttribute(
            'data-opportunity-lane-role-id',
            'claim'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-focus',
            'build'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-role-id',
            'prime'
        );
        expect(
            screen
                .getByTestId('board-opportunity-lane-map')
                .querySelector('[data-opportunity-lane="build"]')
                ?.querySelectorAll('[data-opportunity-lane-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('board-opportunity-lane-map')
                .querySelector('[data-opportunity-lane="build"]')
                ?.querySelector('[data-opportunity-lane-beat="1"]')
        ).toHaveAttribute('data-opportunity-lane-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('board-opportunity-lane-map')
                .querySelector('[data-opportunity-lane="build"]')
                ?.querySelector('[data-opportunity-lane-beat="2"]')
        ).toHaveAttribute('data-opportunity-lane-beat-focus', 'support');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAccessibleName(
            'Opportunity lane map. Build Prime x1. Prime build. Prime cashout. Trait Study x1. Study traits. Trait combo surge. Pickup Claim x1. Claim pickup. Pickup cashout.'
        );
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveAttribute(
            'data-opportunity-lane-map-meter-fill',
            '75'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-priority', 'Chain play');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-cues', 'build-lane:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-hot', 'false');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-cue', 'Match now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target', 'Prime cashout');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-action',
            'match-route'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-tier',
            'route'
        );
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action', 'match-route');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tier', 'route');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tone', 'ready');
        expect(screen.getByTestId('chain-opportunity-next-action').querySelector('small')).toHaveTextContent('Match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-recipes', 'Echo + Sealed');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action', 'Match route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action-id', 'route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-audio', 'route-beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-screen-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-screen-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-tier', 'route');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Route beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('1 route ready');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action-id', 'route');
        expect(screen.getByTestId('chain-opportunity-beat').querySelectorAll('[data-chain-opportunity-beat-pip]')).toHaveLength(3);
        expect(screen.getByTestId('chain-opportunity-recipes')).toHaveTextContent('Echo + Sealed');
        expect(screen.getByTestId('chain-opportunity-recipes')).toHaveAccessibleName('Combo recipes. Echo + Sealed');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-priority', 'best');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Prime cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue-id', 'prime-cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Best');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAccessibleName(
            /Best play\. Prime cashout\. Combo route: 1 route ready\. Match: Prime cashout \/ Echo \+ Sealed: combo shard/i
        );
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute('data-opportunity-priority', 'normal');

        fireEvent.focus(screen.getByTestId('tile-board-application'));
        await waitFor(() => {
            expect(screen.getByText(/Focus: Hidden tile, row 1, column 1/i)).toHaveTextContent(
                'Best play: Prime cashout. Combo route: 1 route ready. Match: Prime cashout'
            );
            expect(screen.getByText(/Focus: Hidden tile, row 1, column 1/i)).toHaveTextContent(
                'Decision lanes: Build Prime 1, Prime build, Trait Study 1, Study traits, Pickup Claim 1, Claim pickup.'
            );
            expect(screen.getByText(/Focus: Hidden tile, row 1, column 1/i)).toHaveTextContent(
            'Board stack: Stack prime. Prime. 2 payoffs live. Stack route + Rewards. Prime beat. Two-beat payoff route is primed. First: Match stack route. Then: Claim rewards. Keep: Keep reward stack primed.'
            );
        });
    });

    it('promotes hot chain plus pickup reward boards as a stack cashout before committing', () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, pairKey: 'spark', findableKind: 'shard_spark' },
                    { ...board.tiles[3]!, pairKey: 'spark', findableKind: 'shard_spark' }
                ]
            },
            chainContext: { comboShards: 1, currentStreak: 4, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Cash out');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue-id', 'stack-cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-cues', 'cash-now:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-map', 'cash:1>trait:1>pickup:1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-lane-actions',
            'cash:Cash now:1>trait:Study traits:1>pickup:Claim pickup:1'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-count', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack', '2 payoffs live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-action', 'Cash now');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue', 'Stack cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue-id', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-audio', 'cashout-pop');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-cue', 'snap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-tier', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue-id', 'stack-cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Next reward x6 +1 shard in 1 match');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAccessibleName(
            /Best play\. Stack cashout\. Combo route: 1 route ready\. Cash out: Match lit route for reward.*One-away cashout.*Next reward x6 \+1 shard in 1 match/i
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toBeVisible();
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toBeVisible();
        expect(screen.getByTestId('chain-opportunity-reward-ladder')).toHaveAttribute(
            'data-board-chain-reward-ladder-focus',
            'soon'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-focus')).toBeVisible();
        expect(screen.getByTestId('chain-opportunity-reward-ladder-focus')).toHaveAttribute(
            'data-board-chain-reward-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-reward-ladder-focus')).toHaveTextContent('Prime');
        expect(screen.getByTestId('chain-opportunity-reward-ladder-focus')).toHaveTextContent('x6 +1 shard');
        expect(screen.getByTestId('chain-opportunity-reward-ladder-focus')).toHaveTextContent('2 matches left');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-tone', 'cashout');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-cue-id', 'cashout');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-audio', 'cashout-pop');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-beats', '3');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-cue', 'snap');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-tier', 'cashout');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-fill', '60');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-crescendo-label]')
        ).toHaveAttribute('data-payoff-stack-crescendo-fill', '60');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-crescendo-beat="1"]')
        ).toHaveAttribute('data-payoff-stack-crescendo-beat-focus', 'primary');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-crescendo-beat="2"]')
        ).toHaveAttribute('data-payoff-stack-crescendo-beat-focus', 'support');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack route + Rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Three-beat cashout route is live');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('First: Cash out stack route');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Then: Claim rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Keep: Keep chain target live');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="first"]')
        ).toHaveTextContent('First: Cash out stack route');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="then"]')
        ).toHaveTextContent('Then: Claim rewards');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="keep"]')
        ).toHaveTextContent('Keep: Keep chain target live');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-map',
            'cash:1>trait:1>pickup:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-actions',
            'cash:Cash now:1>trait:Study traits:1>pickup:Claim pickup:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAccessibleName(
            'Opportunity lane map. Cash Cashout x1. Cash now. Stack cashout. Trait Study x1. Study traits. Trait stack surge. Pickup Claim x1. Claim pickup. Stack prime.'
        );
    });

    it('promotes hot chain plus pickup plus armed perk boards as a super stack before committing', () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, pairKey: 'spark', findableKind: 'shard_spark' },
                    { ...board.tiles[3]!, pairKey: 'spark', findableKind: 'shard_spark' }
                ]
            },
            chainContext: {
                armedPerkId: 'trait_streak_toolkit',
                armedPerkDetail: 'The next clean trait match creates a flash-pair charge.',
                armedPerkLabel: 'Trait cashout armed',
                armedPerkPayoff: 'x3 trait flash',
                comboShards: 1,
                currentStreak: 4,
                lives: 4
            },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Super stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue-id', 'super-stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack', '3 payoffs live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-payoff-stack-action',
            'Cash super stack'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue', 'Super stack');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-cue-id', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-stack-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-audio', 'super-burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-cue', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-payoff-crescendo-tier', 'super');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-cues', 'cash-now:2;perk-cash:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-action-priority', 'cash-now:2>perk-cash:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-role', 'Cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-role-id', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-action-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveTextContent('Perk cash');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-role', 'Cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAttribute('data-card-action-primary-tone', 'cashout');
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveTextContent('Actions');
        expect(screen.getByTestId('chain-opportunity-action-priority-summary')).toHaveTextContent('2 lanes');
        expect(
            screen.getByTestId('chain-opportunity-action-priority-summary').querySelectorAll('[data-card-action-priority-summary-pip]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-focus', 'primary');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="perk-cash"]')
        ).toHaveAttribute('data-card-action-priority-focus', 'support');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-role', 'Cashout');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-role-id', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="cash-now"]')
        ).toHaveAttribute('data-card-action-priority-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="perk-cash"]')
        ).toHaveAttribute('data-card-action-priority-role', 'Perk');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="perk-cash"]')
        ).toHaveAttribute('data-card-action-priority-role-id', 'perk');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="perk-cash"]')
        ).toHaveAttribute('data-card-action-priority-screen-cue', 'burst');
        expect(
            screen.getByTestId('chain-opportunity-action-priority').querySelector('[data-card-action-priority="perk-cash"]')
        ).toHaveAttribute('data-card-action-priority-tone', 'perk');
        expect(screen.getByTestId('chain-opportunity-action-priority')).toHaveAccessibleName(
            'Card action priority. Cash now: 2. Perk cash: 2'
        );
        expect(screen.getByTestId('chain-opportunity-action-priority').querySelectorAll('[data-card-action-priority]')).toHaveLength(2);
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary', 'cash-now');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role', 'Cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-role-id', 'cashout');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-shot-map')).toHaveAttribute('data-chain-shot-map-primary-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-role', 'Cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="cash-now"]')
        ).toHaveAttribute('data-chain-shot-map-tone', 'cashout');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="perk-cash"]')
        ).toHaveAttribute('data-chain-shot-map-role', 'Perk');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="perk-cash"]')
        ).toHaveAttribute('data-chain-shot-map-role-id', 'perk');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="perk-cash"]')
        ).toHaveAttribute('data-chain-shot-map-screen-cue', 'burst');
        expect(
            screen.getByTestId('chain-opportunity-shot-map').querySelector('[data-chain-shot-map-lane="perk-cash"]')
        ).toHaveAttribute('data-chain-shot-map-tone', 'perk');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Perk');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="perk-armed-bar"]')).toHaveTextContent('+!');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="perk-armed-bar"]')).toHaveTextContent('Cash perk');
        expect(screen.getByTestId('chain-opportunity-marker-key-summary')).toHaveTextContent('Markers');
        expect(screen.getByTestId('chain-opportunity-marker-key-summary')).toHaveTextContent('4 shapes');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-intensity', 'stack');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAccessibleName(
            'Chain marker key. Route: oo. Action: Match route. Payoff: =+. Action: Cash now. Stack: **. Action: Cash stack. Perk: +!. Action: Cash perk. Intensity: Stack 2. Action: Cash stack'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Super stack');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue-id', 'super-stack');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-beats', '5');
        expect(screen.getByTestId('board-opportunity-chain').querySelectorAll('[data-opportunity-beat]')).toHaveLength(5);
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-beats', '4');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-best-tone',
            screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-tone')
        );
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-heat',
            screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-heat')
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('Best');
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('4 plays');
        expect(screen.getByTestId('board-opportunity-compass-summary').querySelectorAll('[data-opportunity-compass-summary-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('board-opportunity-compass-summary').querySelector('[data-opportunity-compass-summary-beat="1"]')
        ).toHaveAttribute('data-opportunity-compass-summary-beat-focus', 'primary');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-priority',
            'best'
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Cash super stack');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-cue-id', 'super');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-audio', 'super-burst');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-beats', '5');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-cue', 'super');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-tier', 'super');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-fill', '100');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent(
            'Stack route + Perk payoff + Rewards'
        );
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Super burst');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Five-beat super cashout window');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute(
            'data-payoff-stack-sequence-keep',
            'Claim rewards'
        );
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="first"]')
        ).toHaveTextContent('First: Cash out stack route');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="then"]')
        ).toHaveTextContent('Then: Cash perk payoff');
        expect(
            screen.getByTestId('board-opportunity-payoff-stack').querySelector('[data-payoff-stack-sequence-step="keep"]')
        ).toHaveTextContent('Keep: Claim rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Keep: Claim rewards');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAccessibleName(
            'Board payoff stack. Super stack. Cash super stack. 3 payoffs live. Stack route + Perk payoff + Rewards. Crescendo: Super burst. Five-beat super cashout window. 5 beats. First: Cash out stack route. Then: Cash perk payoff. Keep: Claim rewards.'
        );
        expect(screen.getByTestId('chain-opportunity-arcade-callout').querySelectorAll('[data-chain-callout-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-arcade-callout').querySelector('[data-chain-callout-beat="1"]')
        ).toHaveAttribute('data-chain-callout-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-priority-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-priority-beat="1"]')
        ).toHaveAttribute('data-chain-priority-beat-focus', 'primary');
    });

    it('surfaces plain streak rewards as cashout opportunities even without trait routes', () => {
        renderBoard({
            board,
            chainContext: { comboShards: 1, currentStreak: 4, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-streak-cashout-ready', 'true');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-priority', 'Cashout ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-cue', 'Any match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target', 'Any clean match pays');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-hot-band', 'ready');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-reward-hot', 'false');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-opportunity-target]')).toHaveAttribute(
            'data-chain-target-tone',
            'cashout'
        );
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-label', 'Streak reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Chain cashout');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Streak reward');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Any match');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Cashout ready');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-meter-fill]')).toHaveAttribute(
            'data-chain-cue-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-tone', 'ready');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-action', 'hold');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-beats', '3');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-screen-cue', 'guard');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute('data-chain-hot-band-tier', 'ready');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Streak lane');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Cashout ready');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveTextContent('Any clean match pays');
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAttribute(
            'data-chain-hot-band-meter-fill',
            '70'
        );
        expect(screen.getByTestId('chain-opportunity-hot-band')).toHaveAccessibleName(
            /Chain hot band.*Cashout ready.*Any clean match pays.*One-away cashout/i
        );
        expect(screen.getByTestId('chain-opportunity-hot-band').querySelectorAll('[data-chain-hot-band-beat]')).toHaveLength(3);
        expect(screen.getByTestId('chain-opportunity-hot-band').querySelector('[data-chain-hot-band-beat="1"]')).toHaveAttribute(
            'data-chain-hot-band-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="2"]')).toHaveAttribute(
            'data-chain-momentum-meter-fill',
            '40'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="2"]')).toHaveAttribute(
            'data-chain-momentum-tone',
            'ready'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="2"]')).toHaveAttribute(
            'data-chain-momentum-tier',
            'ready'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-momentum-beats="2"]')).toHaveAttribute(
            'data-chain-momentum-screen-cue',
            'guard'
        );
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-hot', 'ready');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-priority', 'single');
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('Only');
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveTextContent('1 play');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Chain cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Streak reward');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('x6 +1 shard in 1 match');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAccessibleName(
            /Chain cashout\. Streak reward: x6 \+1 shard in 1 match\. Match: Any clean match pays.*One-away cashout.*Any clean pair keeps the streak paying/i
        );
    });

    it('renders forecast rewards and payoff stacks with beat pips before the cashout gets hot', () => {
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
            chainContext: { comboShards: 1, currentStreak: 1, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            peekPowerVisualActive: true,
            previewActive: false,
            reduceMotion: false
        });

        const forecastReward = screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-reward-hot="false"]');
        expect(forecastReward).not.toBeNull();
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Chain routes');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Next reward');
        expect(forecastReward).toHaveAttribute('data-chain-reward-hot', 'false');
        expect(forecastReward).toHaveAttribute('data-chain-reward-tone', 'forecast');
        expect(forecastReward).toHaveAttribute('data-chain-reward-target', 'cashout-build');
        expect(forecastReward).toHaveAttribute('data-chain-reward-beats', '3');
        expect(forecastReward).toHaveAttribute('data-chain-reward-meter-fill', '60');
        expect(forecastReward?.querySelector('small')).toHaveTextContent('Forecast');
        expect(forecastReward).toHaveTextContent('Build toward cashout');
        expect(forecastReward).toHaveTextContent('Next reward');
        expect(
            screen
                .getByTestId('chain-opportunity-chip')
                .querySelector('[data-chain-reward-hot="false"]')
                ?.querySelectorAll('[data-chain-reward-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('chain-opportunity-chip')
                .querySelector('[data-chain-reward-hot="false"]')
                ?.querySelector('[data-chain-reward-beat="1"]')
        ).toHaveAttribute('data-chain-reward-beat-focus', 'primary');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack prime');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAttribute('data-payoff-stack-crescendo-beats', '2');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Keep:');
        expect(screen.getByTestId('board-opportunity-payoff-stack').querySelectorAll('[data-opportunity-payoff-beat]')).toHaveLength(2);
        expect(
            screen
                .getByTestId('board-opportunity-payoff-stack')
                .querySelector('[data-opportunity-payoff-beat="1"]')
        ).toHaveAttribute('data-opportunity-payoff-beat-focus', 'primary');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveAccessibleName(/Board payoff stack\./i);
    });

    it('keeps post-miss recovery visible as a board opportunity row', () => {
        renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            recoveryContext: {
                action: 'Recover',
                detail: 'Recover - safe match',
                impactCue: 'Safe pair',
                tone: 'recover',
                value: 'Safe match'
            },
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'recovery');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action', 'Recover');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-action-id', 'recover');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-label', 'Recovery');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-value', 'Safe match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-tone', 'recover');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Safe pair');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveAttribute('data-opportunity-tone', 'recover');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveAttribute('data-opportunity-action-id', 'recover');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveTextContent('Safe pair');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveTextContent('Recovery');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveTextContent('Recover');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveTextContent('Safe match');
        expect(screen.getByTestId('board-opportunity-recovery')).toHaveAccessibleName(
            'Best play. Safe pair. Recovery: Safe match. Recover: Recover - safe match'
        );
    });

    it('adds armed durable perk payoff cues to the board opportunity stack', () => {
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
            chainContext: {
                armedPerkId: 'trait_streak_toolkit',
                armedPerkDetail: 'The next clean trait match creates a flash-pair charge.',
                armedPerkLabel: 'Trait cashout armed',
                armedPerkPayoff: 'x3 trait flash',
                comboShards: 1,
                currentStreak: 4,
                lives: 4
            },
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-armed-perk',
            'Trait cashout armed'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-armed-perk-payoff',
            'x3 trait flash'
        );
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-perk-armed="true"]')?.querySelector('small')
        ).toHaveTextContent('Payoff');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Trait cashout armed');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('x3 trait flash');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-perk-armed="true"]')).toHaveAttribute(
            'data-chain-armed-perk-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-perk-armed="true"]')).toHaveAttribute(
            'data-chain-armed-perk-tone',
            'payoff'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-perk-armed="true"]')?.querySelector('small')).toHaveTextContent(
            'Payoff'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-armed-perk-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-armed-perk-beat="1"]')
        ).toHaveAttribute('data-chain-armed-perk-beat-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-id', 'chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAccessibleName(
            /Best play\. Stack cashout\. Combo route: 1 route ready\. Cash out: Match lit route for reward.*One-away cashout/i
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-contract')).toContain('perk-armed');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('perk-armed:2');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-shapes')).toContain(
            'perk-armed-bar:2'
        );
        expect(screen.getByTestId('board-opportunity-perk')).toHaveAttribute('data-opportunity-tone', 'perk');
        expect(screen.getByTestId('board-opportunity-perk')).toHaveAttribute(
            'data-opportunity-impact-cue',
            'Perk armed'
        );
        expect(screen.getByTestId('board-opportunity-perk')).toHaveTextContent('Cash');
        expect(screen.getByTestId('board-opportunity-perk')).toHaveTextContent('Perk payoff');
        expect(screen.getByTestId('board-opportunity-perk')).toHaveTextContent('Trait cashout armed');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Stack route + Perk payoff');
        expect(screen.getByTestId('board-opportunity-payoff-stack')).toHaveTextContent('Then: Cash perk payoff');
    });

    it('surfaces combo surge markers when several trait routes are live on the board', () => {
        renderBoard({
            board: {
                ...board,
                tiles: [
                    { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...board.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                    { ...board.tiles[3]!, pairKey: 'conduit', tileTraitKind: 'conduit' }
                ]
            },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Combo surge');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute(
            'data-chain-surge-band-tone',
            'surge'
        );
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute('data-chain-surge-band-action', 'surge');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute('data-chain-surge-band-beats', '4');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute('data-chain-surge-band-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute('data-chain-surge-band-tier', 'combo');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveTextContent('Combo surge');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveTextContent('4 cards lit');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveTextContent('5 routes ready');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveTextContent('Match now');
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAttribute(
            'data-chain-surge-band-meter-fill',
            '100'
        );
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveStyle({
            '--chain-surge-band-meter-fill': '100%'
        });
        expect(screen.getByTestId('chain-opportunity-surge-band')).toHaveAccessibleName(
            /Chain surge band\. Combo surge\. 4 cards lit\. 5 routes ready\. Match now\./
        );
        expect(screen.getByTestId('chain-opportunity-surge-band').querySelectorAll('[data-chain-surge-band-beat]')).toHaveLength(4);
        expect(screen.getByTestId('chain-opportunity-surge-band').querySelector('[data-chain-surge-band-beat="1"]')).toHaveAttribute(
            'data-chain-surge-band-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-surge-band').querySelector('[data-chain-surge-band-beat="2"]')).toHaveAttribute(
            'data-chain-surge-band-beat-focus',
            'support'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-eyebrow-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-eyebrow-beat="1"]')
        ).toHaveAttribute('data-chain-eyebrow-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip').querySelectorAll('[data-chain-cue-beat]')).toHaveLength(4);
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-meter-state]')).toHaveAttribute(
            'data-chain-cue-meter-state',
            'surge'
        );
        expect(
            screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-cue-beat="1"]')
        ).toHaveAttribute('data-chain-cue-beat-focus', 'primary');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveAccessibleName(
            /Board chain opportunity.*Surge chain: 4 cards lit.*Combo surge/i
        );
        expect(screen.getByTestId('chain-opportunity-surge')).toHaveAttribute('data-chain-opportunity-surge', 'true');
        expect(screen.getByTestId('chain-opportunity-surge')).toHaveAttribute('data-chain-opportunity-surge-beats', '4');
        expect(screen.getByTestId('chain-opportunity-surge')).toHaveAttribute(
            'data-chain-opportunity-surge-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('chain-opportunity-surge')).toHaveAttribute('data-chain-opportunity-surge-tone', 'surge');
        expect(screen.getByTestId('chain-opportunity-surge').querySelectorAll('[data-chain-opportunity-surge-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('chain-opportunity-surge').querySelector('[data-chain-opportunity-surge-beat="1"]')
        ).toHaveAttribute('data-chain-opportunity-surge-beat-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-callout', 'Surge chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-combo-surge', 'true');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-hot', 'none');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute('data-opportunity-compass-surge', 'true');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-best-tone',
            screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-tone')
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-screen-cue',
            screen.getByTestId('tile-board-frame').getAttribute('data-opportunity-best-screen-cue')
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-callout-value',
            '4 cards lit'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-callout-tone', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-count', '4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action', 'Chain routes');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action-id', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-audio', 'surge-beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-tier', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-tiers', 'surge:4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-counts', '4:4');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Surge beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('5 routes ready');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action-id', 'surge');
        expect(screen.getByTestId('chain-opportunity-beat').querySelectorAll('[data-chain-opportunity-beat-pip]')).toHaveLength(4);
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveAttribute(
            'data-chain-callout-tone',
            'surge'
        );
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveTextContent('Surge chain');
        expect(screen.getByTestId('chain-opportunity-arcade-callout')).toHaveTextContent('4 cards lit');
        expect(
            screen.getByTestId('chain-opportunity-arcade-callout').querySelector('[data-chain-callout-beat="1"]')
        ).toHaveAttribute('data-chain-callout-beat-tone', 'surge');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Surge');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="combo-surge"]')).toHaveTextContent('++');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="combo-surge"]')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-intensity', 'surge');
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Surge');
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Chain routes');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAccessibleName(
            'Chain marker key. Route: oo. Action: Match route. Surge: ++. Action: Route prime. Intensity: Surge 4. Action: Chain routes'
        );
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAttribute('data-chain-meter-tone', 'surge');
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAccessibleName(
            'Chain board: Ready x4, Surge x4. Next: Combo surge ready: Echo + Sealed: combo shard.'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="ready"]')).toHaveTextContent('4');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="surge"]')).toHaveTextContent('Surge');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="surge"]')).toHaveAttribute(
            'data-chain-meter-lane-action',
            'combo-surge'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="surge"]')).toHaveAttribute(
            'data-chain-meter-lane-tone',
            'surge'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="surge"]')).toHaveTextContent('4');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="surge"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-action', 'combo-surge');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="surge"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-tone', 'surge');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="hot"]')).toBeNull();
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="surge"]')).toHaveTextContent(
            'Echo + Sealed: combo shard'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="surge"]')).toHaveTextContent(
            'Echo + Mirror: recall focus'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-route-tone="surge"]')
                ?.querySelector('[data-chain-next-route-pip="1"]')
        ).toHaveAttribute('data-chain-next-route-pip-tone', 'surge');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Combo surge');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-accessibility-primary-line',
            'Echo + Sealed: combo shard'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-accessibility-secondary-line',
            'Echo + Mirror: recall focus'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('chain-surge:4');
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain('trait-combo-surge:4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-marker-shapes',
            'combo-surge:4;linked-route:4'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-trait-combo-surge', 'true');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-trait-payoff-stack', 'false');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-tiers',
            'surge:4'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-intensities',
            'surge:4'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tone', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-value', 'Surge live');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-action', 'surge');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tier', 'surge');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Surge live');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('5 routes ready');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-action', 'surge');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-beats', '5');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-screen-cue', 'burst');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tier', 'surge');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tone', 'surge');
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
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Combo');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Creates trait route');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Sealed + Heavy: score surge');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAccessibleName(
            /Swap preview combo preview.*Creates trait route.*Sealed \+ Heavy: score surge/i
        );
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Swap armed');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Place target');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('First: Pick target');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Then: Preview route payoff');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-action', 'swap');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-tier', 'route');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-action', 'swap');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-screen-cue', 'pulse');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tier', 'route');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tone', 'setup');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-beats', '2');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-meter-fill', '50');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-first', 'Pick target');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-then', 'Preview route payoff');
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="first"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'setup'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="then"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'setup'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-focus', 'primary');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-action', 'swap');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-screen-cue', 'pulse');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tier', 'route');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tone', 'setup');
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-step-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step-beat="1"]')
        ).toHaveAttribute('data-active-power-step-beat-focus', 'primary');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="then"] [data-active-power-step-beat="1"]')
        ).toHaveAttribute('data-active-power-step-beat-phase', 'then');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAccessibleName(
            /Active board power.*Swap armed.*Place target.*First Pick target.*Then Preview route payoff/i
        );
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Tool');
        expect(screen.getByTestId('board-opportunity-tool')).toHaveTextContent('Swap armed');
        expect(screen.getByTestId('board-opportunity-tool')).toHaveTextContent('Place target');
        expect(screen.getByTestId('board-opportunity-tool')).toHaveTextContent('Use');
        expect(screen.getByTestId('board-opportunity-tool')).toHaveAttribute('data-opportunity-tone', 'setup');
        expect(screen.getByTestId('board-opportunity-tool')).toHaveAttribute('data-opportunity-action-id', 'tool');
    });

    it('shows active board command chips for armed recall and control powers', () => {
        const { rerender } = renderBoard({
            board,
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            peekPowerVisualActive: true,
            previewActive: false,
            reduceMotion: false
        });

        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Peek armed');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Tap hidden tile');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('First: Reveal one');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Then: Lock memory route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-action', 'recall');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-tier', 'memory');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-action', 'recall');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-screen-cue', 'pulse');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tier', 'memory');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tone', 'recall');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-beats', '3');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-meter-fill', '75');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-first', 'Reveal one');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-then', 'Lock memory route');
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="first"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'recall'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="then"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'recall'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-action', 'recall');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tier', 'memory');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tone', 'recall');
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-step-beat]')).toHaveLength(4);
        expect(screen.getByTestId('active-power-board-chip')).toHaveAccessibleName(
            /Active board power.*Peek armed.*Tap hidden tile.*First Reveal one.*Then Lock memory route/i
        );

        rerender(
            <PlatformTiltProvider>
                <TileBoard
                    board={board}
                    debugPeekActive={false}
                    destroyPowerVisualActive
                    interactive
                    mobileCameraMode={false}
                    onTileSelect={vi.fn()}
                    previewActive={false}
                    reduceMotion={false}
                    viewportResetToken={0}
                />
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Destroy armed');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Tap hidden pair');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('First: Mark pair');
        expect(screen.getByTestId('active-power-board-chip')).toHaveTextContent('Then: Clear blocker');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-action', 'clear');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-active-power-tier', 'control');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-action', 'clear');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-screen-cue', 'burst');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tier', 'control');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-tone', 'control');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-beats', '3');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-meter-fill', '75');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-first', 'Mark pair');
        expect(screen.getByTestId('active-power-board-chip')).toHaveAttribute('data-active-power-then', 'Clear blocker');
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="first"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'control'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-step="then"]')).toHaveAttribute(
            'data-active-power-step-tone',
            'control'
        );
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-action', 'clear');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-screen-cue', 'burst');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tier', 'control');
        expect(
            screen.getByTestId('active-power-board-chip').querySelector('[data-active-power-beat="1"]')
        ).toHaveAttribute('data-active-power-beat-tone', 'control');
        expect(screen.getByTestId('active-power-board-chip').querySelectorAll('[data-active-power-step-beat]')).toHaveLength(4);
        expect(screen.getByTestId('active-power-board-chip')).toHaveAccessibleName(
            /Active board power.*Destroy armed.*Tap hidden pair.*First Mark pair.*Then Clear blocker/i
        );
    });

    it('marks HUD swap-hint route targets on the board feedback contract', () => {
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
            traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
            traitRouteTargetTileIds: ['s1', 'f1']
        });

        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-contract')).toContain(
            'chain-setup'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-contract')).toContain(
            'trait-route-target'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain(
            'chain-setup:2'
        );
        expect(screen.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')).toContain(
            'trait-route-target:2'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('2 primed');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Use swap');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveTextContent('Prime');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="swap-target-crossbar"]')).toHaveTextContent('x|');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="swap-target-crossbar"]')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-intensity', 'setup');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAttribute('data-chain-marker-focused-shape', 'swap-target-crossbar');
        expect(screen.getByTestId('chain-opportunity-marker-key').querySelector('[data-chain-marker-shape="swap-target-crossbar"]')).toHaveAttribute(
            'data-chain-marker-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-marker-intensity')).toHaveTextContent('Prime payoff');
        expect(screen.getByTestId('chain-opportunity-marker-key')).toHaveAccessibleName(
            'Chain marker key. Prime: x|. Action: Route prime. Intensity: Prime 2. Action: Prime payoff'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Prime move');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Use swap to connect route');
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-examples-tone]')).toHaveAttribute(
            'data-chain-examples-tone',
            'setup'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-lines-action]')).toHaveAttribute(
            'data-chain-lines-action',
            'prime-route'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-lines-tier]')).toHaveAttribute(
            'data-chain-lines-tier',
            'prime'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-lines-tone]')).toHaveAttribute(
            'data-chain-lines-tone',
            'setup'
        );
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveTextContent('Use swap');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-meter-fill', '40');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action', 'Prime route');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-action-id', 'setup');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-audio', 'setup-beat');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-screen-cue', 'pulse');
        expect(screen.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-tier', 'setup');
        expect(screen.getByTestId('chain-opportunity-beat').querySelectorAll('[data-chain-opportunity-beat-pip]')).toHaveLength(2);
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAttribute('data-chain-sequence-tone', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="first"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="then"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-sequence-cue').querySelector('[data-chain-sequence-step="keep"]')
        ).toHaveAttribute('data-chain-sequence-step-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('First');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Then');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Match lit route');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Keep');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveTextContent('Keep reward stack primed');
        expect(screen.getByTestId('chain-opportunity-sequence-cue')).toHaveAccessibleName(
            'Chain sequence. First: Swap Sealed with Filler: Sealed + Heavy: score surge. Then: Match lit route. Keep: Keep reward stack primed.'
        );
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action', 'prime-route');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute('data-chain-next-action-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'data-chain-next-action-meter-fill',
            '50'
        );
        expect(screen.getByTestId('chain-opportunity-next-action').querySelector('small')).toHaveTextContent('Prime');
        expect(screen.getByTestId('chain-opportunity-next-action')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('chain-opportunity-chip').querySelector('[data-chain-priority="setup"]')).toHaveTextContent(
            'Prime route'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveAttribute('data-chain-opportunity-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-meter')).toHaveAttribute('data-chain-meter-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="setup"]')).toHaveAttribute(
            'data-chain-meter-lane-action',
            'prime-route'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-lane="setup"]')).toHaveAttribute(
            'data-chain-meter-lane-tone',
            'setup'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="setup"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-action', 'prime-route');
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-lane="setup"]')
                ?.querySelector('[data-chain-meter-pip="1"]')
        ).toHaveAttribute('data-chain-meter-pip-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="setup"]')).toHaveTextContent(
            'Prime'
        );
        expect(screen.getByTestId('chain-opportunity-meter').querySelector('[data-chain-meter-route-tone="setup"]')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-meter')
                .querySelector('[data-chain-meter-route-tone="setup"]')
                ?.querySelector('[data-chain-next-route-pip="1"]')
        ).toHaveAttribute('data-chain-next-route-pip-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveAccessibleName(
            /Board chain opportunity.*Prime route.*Prime move.*Use swap to connect route.*2 primed.*Swap Sealed with Filler: Sealed \+ Heavy: score surge/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-setup-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action', 'prime-route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action-label', 'Do next: prime route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-next-action-tone', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action', 'Prime route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-action-id', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-audio', 'setup-beat');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-screen-cue', 'pulse');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-beat-tier', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-tiers', 'setup:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-beat-counts', '2:2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot', 'route-setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-label', 'Set');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-shot-focus', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-beat', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-beat-action', 'set route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-cadence', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-primary-cadence-action', 'Prime payoff');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot', 'route-setup');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-beat', 'setup');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-cadence', 'prime');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAttribute('data-card-primary-shot-focus', 'setup');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveAccessibleName(
            'Primary combo shot. Set: Setup lane. 2-beat set route. Pulse: Prime payoff.'
        );
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Best shot');
        expect(screen.getByTestId('chain-opportunity-primary-shot')).toHaveTextContent('Set');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelectorAll('[data-card-primary-shot-beat-pip]')
        ).toHaveLength(2);
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="1"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-shot-focus', 'setup');
        expect(
            screen.getByTestId('chain-opportunity-primary-shot').querySelector('[data-card-primary-shot-beat-pip="1"]')
        ).toHaveAttribute('data-card-primary-shot-beat-pip-screen-cue', 'pulse');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary', 'setup');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary-screen-cue', 'tick');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-actions', 'setup:set route:2');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveTextContent('Beats');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-beat-map-summary')).toHaveAttribute(
            'data-card-beat-map-summary-meter-fill',
            '20'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveAccessibleName(
            'Card beat map. Prime: 2. 2-beat set route.'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('Beat map');
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('Prime');
        expect(
            screen.getByTestId('chain-opportunity-beat-map').querySelectorAll('[data-card-beat-tier="setup"] [data-card-beat-pip]')
        ).toHaveLength(2);
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="setup"]')).toHaveAttribute(
            'data-card-beat-action',
            'set route'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="setup"]')).toHaveAttribute(
            'data-card-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="setup"]')).toHaveAttribute(
            'data-card-beat-screen-cue',
            'tick'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map').querySelector('[data-card-beat-tier="setup"]')).toHaveAttribute(
            'data-card-beat-tone',
            'setup'
        );
        expect(screen.getByTestId('chain-opportunity-beat-map')).toHaveTextContent('set route');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary', 'prime');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary-screen-cue', 'tick');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAttribute('data-card-cadence-primary-tone', 'setup');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveAccessibleName(
            'Card pulse map. Prime: 2. Prime payoff. 2-beat pulse.'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Pulse map');
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveTextContent('Pulses');
        expect(screen.getByTestId('chain-opportunity-cadence-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Prime');
        expect(screen.getByTestId('chain-opportunity-cadence-map')).toHaveTextContent('Prime payoff');
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="prime"]')).toHaveAttribute(
            'data-card-cadence-focus',
            'primary'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="prime"]')).toHaveAttribute(
            'data-card-cadence-screen-cue',
            'tick'
        );
        expect(screen.getByTestId('chain-opportunity-cadence-map').querySelector('[data-card-cadence="prime"]')).toHaveAttribute(
            'data-card-cadence-tone',
            'setup'
        );
        expect(
            screen
                .getByTestId('chain-opportunity-cadence-map')
                .querySelectorAll('[data-card-cadence="prime"] [data-card-cadence-pip]')
        ).toHaveLength(2);
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-sequence-first',
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-then', 'Match lit route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-keep', 'Keep reward stack primed');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-sequence-tone', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-accessibility-primary-line',
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Route prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tone', 'setup');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-value', 'Prime route');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-action', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-beats', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-screen-cue', 'tick');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-trait-mode-tier', 'prime');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('trait-mode-cue')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-action', 'prime');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-beats', '2');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-screen-cue', 'tick');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tier', 'prime');
        expect(screen.getByTestId('trait-mode-cue')).toHaveAttribute('data-trait-mode-tone', 'setup');
        expect(screen.getByTestId('trait-mode-cue').querySelectorAll('[data-trait-mode-beat]')).toHaveLength(2);
        expect(screen.getByTestId('trait-mode-cue').querySelector('[data-trait-mode-beat="1"]')).toHaveAttribute(
            'data-trait-mode-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Route prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-beats', '3');
        expect(screen.getByTestId('board-opportunity-chain').querySelectorAll('[data-opportunity-beat]')).toHaveLength(3);
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-chain-opportunity-target',
            'Use swap to connect route'
        );
        expect(screen.getByTestId('tile-board-frame').querySelectorAll('[data-chain-target-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('tile-board-frame').querySelector('[data-chain-target-beat="1"]')
        ).toHaveAttribute('data-chain-target-beat-focus', 'primary');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-target-plan', 'none');
        expect(screen.getByTestId('tile-board-frame').querySelectorAll('[data-chain-target-plan-beat]')).toHaveLength(0);
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-tiers',
            'route-target:2'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-trait-route-intensities',
            'setup:2'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-marker-shapes',
            'swap-target-crossbar:2'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-card-feedback-marker-shape-contract',
            'linked-route combo-surge payoff-bar payoff-stack swap-target-crossbar perk-armed-bar followup-target'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('2 primed');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Use swap');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Use swap to connect route');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-tone', 'setup');
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
            traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
            traitRouteTargetTileIds: ['s1', 'f1']
        });

        await waitFor(() => expect(createOscillator).toHaveBeenCalledTimes(1));
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            1192,
            expect.any(Number)
        );
    });

    it('promotes swap route setup as stack setup when it leads into a near chain cashout', () => {
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
            chainContext: { comboShards: 1, currentStreak: 2, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: false,
            reduceMotion: false,
            traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
            traitRouteTargetTileIds: ['s1', 'f1']
        });

        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-impact-cue', 'Stack prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-heat', 'prime');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-beats', '3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-milestone-action', 'Start chain');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-milestone-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-milestone-target', '1 match to x3');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-milestone-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-chain-opportunity-milestone-tone', 'building');
        expect(screen.getByTestId('chain-opportunity-chip')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveTextContent('Start chain');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveTextContent('1 match to x3');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveAttribute('data-chain-milestone-meter-fill', '67');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveAttribute('data-chain-milestone-screen-cue', 'burst');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveAttribute('data-chain-milestone-tier', 'cashout');
        expect(screen.getByTestId('chain-opportunity-milestone')).toHaveAttribute('data-chain-milestone-tone', 'building');
        expect(screen.getByTestId('chain-opportunity-milestone-meter')).toBeInTheDocument();
        expect(screen.getByTestId('chain-opportunity-milestone').querySelectorAll('[data-chain-milestone-beat]')).toHaveLength(1);
        expect(
            screen.getByTestId('chain-opportunity-milestone').querySelector('[data-chain-milestone-beat="1"]')
        ).toHaveAttribute('data-chain-milestone-beat-focus', 'primary');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-impact-cue', 'Stack prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-heat', 'prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAttribute('data-opportunity-beats', '3');
        expect(screen.getByTestId('board-opportunity-chain').querySelectorAll('[data-opportunity-beat]')).toHaveLength(3);
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Stack prime');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Use swap to connect route');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveTextContent('x4 +1 shard in 1 match');
        expect(screen.getByTestId('board-opportunity-chain')).toHaveAccessibleName(
            /Stack prime\. Route prime: 2 primed\. Use swap: Use swap to connect route \/ Double cashout \/ x4 \+1 shard in 1 match \/ Swap Sealed with Filler: Sealed \+ Heavy: score surge/i
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
            expect(screen.getAllByText(/Shard spark pickup: \+1 combo shard/i).length).toBeGreaterThanOrEqual(2);
        });
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('Pickup rewards');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('1 reward');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('Claim before exit');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-action', 'bank');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-beats', '2');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-focus', 'reward');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-screen-cue', 'tick');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-tier', 'reward');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('First');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Claim before exit');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Then');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Bank pickup reward');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Keep');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveAttribute('data-pickup-sequence-tone', 'reward');
        expect(screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-phase="then"]')).toHaveAttribute(
            'data-pickup-sequence-phase-tone',
            'reward'
        );
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-value-phase="then"]')
        ).toHaveAttribute('data-pickup-sequence-value-tone', 'reward');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-value-phase="keep"]')
        ).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('pickup-opportunity-sequence').querySelectorAll('[data-pickup-sequence-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="1"]')
        ).toHaveAttribute('data-pickup-sequence-beat-focus', 'primary');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="1"]')
        ).toHaveAttribute('data-pickup-sequence-beat-phase', 'first');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="2"]')
        ).toHaveAttribute('data-pickup-sequence-beat-focus', 'support');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="2"]')
        ).toHaveAttribute('data-pickup-sequence-beat-phase', 'then');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveAccessibleName(
            'Pickup sequence. First: Claim before exit. Then: Bank pickup reward. Keep: Shard spark pickup: +1 combo shard.'
        );
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAccessibleName(
            /Board pickup opportunity.*1 reward.*Claim before exit.*Sequence: First Claim before exit.*Then Bank pickup reward.*Keep Shard spark pickup: \+1 combo shard.*Shard spark pickup: \+1 combo shard/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-count', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-action', 'bank');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-beats', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-focus', 'reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-screen-cue', 'tick');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-tier', 'reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-tile-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-first', 'Claim before exit');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-then', 'Bank pickup reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-keep', 'Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-tone', 'reward');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-actions', 'pickup:Claim pickup:1');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Rewards');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Pickup cashout');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('1 reward');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Claim');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute('data-opportunity-action-id', 'claim');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Claim before exit');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-meter-fill', '33');
        expect(screen.getByTestId('pickup-opportunity-chip').querySelectorAll('[data-pickup-chip-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-focus', 'primary');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-action', 'bank');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-screen-cue', 'tick');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-tier', 'reward');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAccessibleName(
            'Best play. Pickup cashout. Rewards: 1 reward. Claim: Claim before exit / Shard spark pickup: +1 combo shard'
        );
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute(
            'data-opportunity-impact-cue',
            'Pickup cashout'
        );
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute('data-opportunity-tone', 'pickup');
        await waitFor(() => expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Pickup'));
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Reward');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Claim');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-action', 'Claim');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-audio', 'preview-pickup');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-kind', 'pickup');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-screen-cue', 'snap');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-tone', 'pickup');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-beats', '4');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-kind]')).toHaveAttribute(
            'data-preview-action-kind',
            'pickup'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-tone]')).toHaveAttribute(
            'data-preview-action-tone',
            'pickup'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelectorAll('[data-preview-beat]')).toHaveLength(4);
        expect(screen.getByTestId('trait-preview-summary')).toHaveAttribute('data-preview-summary-kind', 'pickup');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('Preview');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('Reward');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('4 beats');
        expect(screen.getByTestId('trait-preview-summary').querySelectorAll('[data-preview-summary-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('trait-preview-summary').querySelector('[data-preview-summary-beat="1"]')
        ).toHaveAttribute('data-preview-summary-beat-focus', 'primary');
        expect(screen.getByTestId('trait-preview-chip').querySelectorAll('[data-preview-line-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-beat="1"]')
        ).toHaveAttribute('data-preview-line-beat-focus', 'primary');
        expect(screen.getByTestId('trait-preview-chip').querySelectorAll('[data-preview-action-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-beat="1"]')
        ).toHaveAttribute('data-preview-action-beat-focus', 'primary');
        expect(
            screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')
        ).toHaveTextContent('Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-kind',
            'pickup'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-tone',
            'pickup'
        );
        expect(screen.getByTestId('trait-preview-chip')).toHaveAccessibleName(
            /Pickup reward preview.*Claim.*Shard spark pickup: \+1 combo shard/i
        );
    });

    it('promotes pickup opportunities as stack setup when the next chain cashout is one match away', () => {
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
            chainContext: { comboShards: 1, currentStreak: 2, lives: 4 },
            debugPeekActive: false,
            interactive: true,
            onTileSelect: vi.fn(),
            previewActive: true,
            reduceMotion: false
        });

        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('Claim into cashout');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveTextContent('x4 +1 shard in 1 match');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-action', 'cashout');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-beats', '4');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-focus', 'cashout');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-screen-cue', 'burst');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-opportunity-tier', 'cashout');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveTextContent('Cash x4 +1 shard in 1 match');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveAttribute('data-pickup-sequence-tone', 'cashout');
        expect(screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-phase="then"]')).toHaveAttribute(
            'data-pickup-sequence-phase-tone',
            'cashout'
        );
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-value-phase="then"]')
        ).toHaveAttribute('data-pickup-sequence-value-tone', 'cashout');
        expect(screen.getByTestId('pickup-opportunity-sequence').querySelectorAll('[data-pickup-sequence-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="1"]')
        ).toHaveAttribute('data-pickup-sequence-beat-focus', 'primary');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="2"]')
        ).toHaveAttribute('data-pickup-sequence-beat-focus', 'support');
        expect(
            screen.getByTestId('pickup-opportunity-sequence').querySelector('[data-pickup-sequence-beat="3"]')
        ).toHaveAttribute('data-pickup-sequence-beat-phase', 'keep');
        expect(screen.getByTestId('pickup-opportunity-sequence')).toHaveAccessibleName(
            'Pickup sequence. First: Claim into cashout. Then: Cash x4 +1 shard in 1 match. Keep: Shard spark pickup: +1 combo shard.'
        );
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAccessibleName(
            /Board pickup opportunity.*1 reward.*Claim into cashout.*Sequence: First Claim into cashout.*Then Cash x4 \+1 shard in 1 match.*Keep Shard spark pickup: \+1 combo shard.*Double cashout.*x4 \+1 shard in 1 match.*Shard spark pickup: \+1 combo shard/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-first', 'Claim into cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-action', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-beats', '4');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-focus', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-screen-cue', 'burst');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-opportunity-tier', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-then', 'Cash x4 +1 shard in 1 match');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-keep', 'Shard spark pickup: +1 combo shard');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-pickup-sequence-tone', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-heat', 'cashout');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-best-beats', '5');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-lane-actions',
            'cash:Cash now:1>pickup:Claim pickup:1'
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute(
            'data-opportunity-lane-action-ids',
            'cash:cashout:1>pickup:claim:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-actions',
            'cash:Cash now:1>pickup:Claim pickup:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-lane-action-ids',
            'cash:cashout:1>pickup:claim:1'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane-focus',
            'cashout'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Claim pickup');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAccessibleName(
            'Opportunity lane map. Cash Cashout x1. Cash now. Stack cashout. Pickup Claim x1. Claim pickup. Stack prime.'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="cash"]')).toHaveAttribute(
            'data-opportunity-lane-action',
            'Cash now'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="cash"]')).toHaveAttribute(
            'data-opportunity-lane-action-id',
            'cashout'
        );
        expect(screen.getByTestId('board-opportunity-primary-lane')).toHaveAttribute(
            'data-opportunity-primary-lane-focus',
            'cashout'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="pickup"]')).toHaveAttribute(
            'data-opportunity-lane-action',
            'Claim pickup'
        );
        expect(screen.getByTestId('board-opportunity-lane-map').querySelector('[data-opportunity-lane="pickup"]')).toHaveAttribute(
            'data-opportunity-lane-action-id',
            'claim'
        );
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute(
            'data-opportunity-impact-cue',
            'Stack prime'
        );
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAttribute('data-opportunity-beats', '3');
        expect(screen.getByTestId('board-opportunity-pickup').querySelectorAll('[data-opportunity-beat]')).toHaveLength(3);
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Stack prime');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Claim into cashout');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveTextContent('x4 +1 shard in 1 match');
        expect(screen.getByTestId('pickup-opportunity-chip')).toHaveAttribute('data-pickup-meter-fill', '100');
        expect(screen.getByTestId('pickup-opportunity-chip').querySelectorAll('[data-pickup-chip-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-focus', 'primary');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-action', 'cashout');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-screen-cue', 'burst');
        expect(
            screen.getByTestId('pickup-opportunity-chip').querySelector('[data-pickup-chip-beat="1"]')
        ).toHaveAttribute('data-pickup-chip-beat-tier', 'cashout');
        expect(screen.getByTestId('board-opportunity-pickup')).toHaveAccessibleName(
            'Stack prime. Rewards: 1 reward. Claim: Claim into cashout / Double cashout / x4 +1 shard in 1 match / Shard spark pickup: +1 combo shard'
        );
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
            expect(screen.getAllByText(/Wrong pairs reshuffle safe hidden tiles/i).length).toBeGreaterThan(0);
        });
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Hazard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Risk');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Scout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Shuffle Snare');
        expect(screen.getByTestId('trait-preview-chip')).toHaveTextContent('Wrong pairs reshuffle safe hidden tiles.');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-action', 'Scout');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-audio', 'preview-hazard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-kind', 'hazard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-screen-cue', 'guard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-tone', 'hazard');
        expect(screen.getByTestId('trait-preview-chip')).toHaveAttribute('data-preview-beats', '3');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-kind]')).toHaveAttribute(
            'data-preview-action-kind',
            'hazard'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-action-tone]')).toHaveAttribute(
            'data-preview-action-tone',
            'hazard'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelectorAll('[data-preview-beat]')).toHaveLength(3);
        expect(screen.getByTestId('trait-preview-summary')).toHaveAttribute('data-preview-summary-kind', 'hazard');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('Preview');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('Risk');
        expect(screen.getByTestId('trait-preview-summary')).toHaveTextContent('3 beats');
        expect(screen.getByTestId('trait-preview-summary').querySelectorAll('[data-preview-summary-beat]')).toHaveLength(3);
        expect(
            screen.getByTestId('trait-preview-summary').querySelector('[data-preview-summary-beat="1"]')
        ).toHaveAttribute('data-preview-summary-beat-focus', 'primary');
        expect(
            screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')
        ).toHaveTextContent('Shuffle Snare');
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-kind',
            'hazard'
        );
        expect(screen.getByTestId('trait-preview-chip').querySelector('[data-preview-line-focus="primary"]')).toHaveAttribute(
            'data-preview-line-tone',
            'hazard'
        );
        expect(screen.getByTestId('trait-preview-chip')).toHaveAccessibleName(
            /Hazard risk preview.*Scout.*Shuffle Snare.*Wrong pairs reshuffle safe hidden tiles/i
        );
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-count', '2');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-action', 'avoid');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-family', 'penalty');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-screen-cue', 'guard');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-tier', 'danger');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-hazard-opportunity-trigger', 'mismatch');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-compass-count', '1');
        expect(screen.getByTestId('tile-board-frame')).toHaveAttribute('data-opportunity-lane-actions', 'risk:Reduce risk:1');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveTextContent('Risk');
        expect(screen.getByTestId('board-opportunity-compass')).toHaveAttribute(
            'data-opportunity-compass-best-tone',
            'hazard'
        );
        expect(screen.getByTestId('board-opportunity-compass-summary')).toHaveAttribute(
            'data-opportunity-compass-summary-tone',
            'hazard'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toBeVisible();
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute('data-opportunity-lane-map', 'risk:1');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveAttribute(
            'data-opportunity-primary-lane',
            'risk'
        );
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Risk');
        expect(screen.getByTestId('board-opportunity-lane-map')).toHaveTextContent('Reduce risk');
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveTextContent('Lanes');
        expect(screen.getByTestId('board-opportunity-lane-map-summary')).toHaveTextContent('1 lane');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveTextContent('Scout');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveTextContent('Avoid penalty');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveTextContent('2 hazards');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveTextContent('Warns that a wrong pair reshuffles safe hidden tiles');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-opportunity-tone', 'hazard');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-opportunity-action-id', 'risk');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-hazard-opportunity-action', 'avoid');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-hazard-opportunity-family', 'penalty');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-hazard-opportunity-screen-cue', 'guard');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-hazard-opportunity-tier', 'danger');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-hazard-opportunity-trigger', 'mismatch');
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute('data-opportunity-beats', '3');
        expect(screen.getByTestId('board-opportunity-hazard').querySelectorAll('[data-opportunity-beat]')).toHaveLength(3);
        expect(screen.getByTestId('board-opportunity-hazard')).toHaveAttribute(
            'data-opportunity-impact-cue',
            'Avoid penalty'
        );
        expect(screen.getByTestId('board-opportunity-compass').getAttribute('aria-label')).toContain(
            'Avoid penalty. Risk: 2 hazards. Scout: Warns that a wrong pair reshuffles safe hidden tiles'
        );
        expect(screen.getByTestId('board-opportunity-hazard').getAttribute('aria-label')).toContain(
            'Avoid penalty. Risk: 2 hazards. Scout: Warns that a wrong pair reshuffles safe hidden tiles'
        );
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
