import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import type { RunState } from '../../shared/contracts';
import GameLeftToolbar from './GameLeftToolbar';
import type { TileBoardHandle } from './TileBoard';

const noop = vi.fn();

type ToolbarOverrideProps = Partial<Parameters<typeof GameLeftToolbar>[0]>;

const renderToolbar = (run: RunState, overrides: ToolbarOverrideProps = {}) =>
    render(
        <GameLeftToolbar
            applyFlashPairPower={noop}
            boardPinMode={false}
            cameraViewportMode={false}
            canRegionShuffleRow={() => true}
            debugFlags={createDefaultSaveData().settings.debugFlags}
            destroyDisabled={false}
            destroyPairArmed={false}
            flashPairDisabled={false}
            flashPairTitle="Flash pair"
            maxPinnedTiles={3}
            onRequestAbandonRun={noop}
            onViewportReset={noop}
            openCodexFromPlaying={noop}
            openInventoryFromPlaying={noop}
            openSettingsPlaying={noop}
            peekModeArmed={false}
            regionShuffleDisabled={false}
            regionShuffleTitle="Shuffle hidden tiles within one row"
            rulesHintNudge={null}
            rulesHintsExpanded={false}
            run={run}
            setRulesHintsExpanded={noop}
            showBoardPowerBar
            showFlashPairPower={false}
            showForgivenessHint={false}
            shuffleBoard={noop}
            shuffleDisabled={false}
            shuffleRegionRow={noop}
            shuffleTitle="Shuffle hidden tiles"
            strayRemoveArmed={run.strayRemoveArmed}
            tileBoardRef={createRef<TileBoardHandle | null>()}
            tileSwapArmed={false}
            tileSwapDisabled={false}
            tileSwapFirstTileId={null}
            tileSwapTitle="Swap two hidden tiles"
            toggleBoardPinMode={noop}
            toggleDestroyPairArmed={noop}
            togglePeekMode={noop}
            toggleStrayArm={noop}
            toggleTileSwapArmed={noop}
            triggerDebugReveal={noop}
            undoResolvingFlip={noop}
            {...overrides}
        />
    );

describe('GameLeftToolbar', () => {
    it('marks row shuffle and tile swap as combo setup tools when row/swap charges are available', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            destroyPairCharges: 1,
            peekCharges: 1,
            regionShuffleCharges: 2
        } as RunState;

        renderToolbar(run);

        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Tool stack');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('3 tools live');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Route + Recall + Control');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-meter-fill', '75');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('First');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Set route before matching');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Then');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Match new adjacency');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Keep');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Keep trait route live');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-stack-tone', 'combo');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-first', 'Set route before matching');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-then', 'Match new adjacency');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-keep', 'Keep trait route live');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-action', 'Cash route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-audio', 'tool-crescendo-cashout');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-tier', 'cashout');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-beats', '3');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-cue', 'snap');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-screen-cue', 'snap');
        expect(screen.getByTestId('tool-crescendo')).toHaveAttribute('data-tool-crescendo-action', 'Cash route');
        expect(screen.getByTestId('tool-crescendo')).toHaveAttribute('data-tool-crescendo-audio', 'tool-crescendo-cashout');
        expect(screen.getByTestId('tool-crescendo')).toHaveAttribute('data-tool-crescendo-screen-cue', 'snap');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('3 beat');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('Cash route');
        expect(screen.getByTestId('tool-crescendo').querySelectorAll('[data-tool-crescendo-beat]')).toHaveLength(3);
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAccessibleName(
            'Tool stack: 3 tools live. Route + Recall + Control. First: Set route before matching. Then: Match new adjacency. Keep: Keep trait route live. Tool crescendo: Cash route. Cashout beat. 3 beats.'
        );
        expect(screen.getByLabelText(/Board powers/i)).toHaveAccessibleName(/Tool stack: 3 tools live/i);
        expect(screen.getByTestId('row-swap-setup-badge')).toHaveTextContent('Prime');
        expect(screen.getByTestId('tile-swap-setup-badge')).toHaveTextContent('Prime');
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveTextContent('Route link');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('Route link');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Combo prime');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Combo prime');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Set route');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Set route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('shuffle-payoff-chip')).toHaveTextContent('Combo reroll');
        expect(screen.getByTestId('shuffle-payoff-chip')).toHaveTextContent('Pair search');
        expect(screen.getByTestId('shuffle-payoff-chip')).toHaveAttribute('data-power-cue', 'Pair search');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Set route');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Set route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route prime');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route prime');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-payoff', 'combo');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-payoff', 'combo');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-action', 'Prime route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-audio', 'power-payoff-combo');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-screen-cue', 'snap');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-payoff-beats', '3');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('row-swap-payoff-chip').querySelectorAll('[data-power-payoff-beat]')).toHaveLength(3);
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveAttribute('data-power-intent', 'combo');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveAttribute('data-power-intent', 'combo');
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/Power payoff: Combo prime/i);
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/Impact cue: Route prime/i);
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/Route link prime available/i);
        expect(screen.getByLabelText(/Shuffle hidden tiles/i)).toHaveAccessibleName(/Impact cue: Pair search/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Row\/swap charges: 2/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Power payoff: Combo prime/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Impact cue: Route prime/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Route link prime available/i);
        expect(screen.getByLabelText(/Shuffle hidden tiles/i).querySelector('[data-power-role="search"]')).toHaveTextContent('Search');
        expect(screen.getByLabelText(/Swap two hidden tiles/i).querySelector('[data-power-role="search"]')).toHaveTextContent('Prime');
        expect(screen.getByLabelText(/Peek one hidden tile/i).querySelector('[data-power-role="recall"]')).toHaveTextContent('Recall');
        expect(screen.getByLabelText(/Destroy a hidden pair/i).querySelector('[data-power-role="control"]')).toHaveTextContent('Damage control');
        expect(screen.getByTestId('destroy-pair-intent-chip')).toHaveTextContent('Cut risk');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveTextContent('Risk clear');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveTextContent('Arm tool');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveTextContent('Board control');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-payoff', 'control');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-cue', 'Board control');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-action', 'Control board');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-audio', 'power-payoff-control');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-screen-cue', 'guard');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-payoff-beats', '2');
        expect(screen.getByTestId('destroy-pair-payoff-chip').querySelectorAll('[data-power-payoff-beat]')).toHaveLength(2);
        expect(screen.getByTestId('destroy-pair-intent-chip')).toHaveAttribute('data-power-intent', 'control');
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/Cut risk action available/i);
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/Power payoff: Risk clear/i);
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/Impact cue: Board control/i);
        expect(screen.getByTestId('peek-intent-chip')).toHaveTextContent('Recall setup');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveTextContent('Safe reveal');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveTextContent('Arm peek');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveTextContent('Recall route');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-payoff', 'recall');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-cue', 'Recall route');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-action', 'Reveal pair');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-audio', 'power-payoff-recall');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-screen-cue', 'pulse');
        expect(screen.getByTestId('peek-intent-chip')).toHaveAttribute('data-power-intent', 'recall');
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/Recall setup action available/i);
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/Power payoff: Safe reveal/i);
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/Impact cue: Recall route/i);
    });

    it('updates power role chips with immediate armed-state prompts', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            destroyPairCharges: 1,
            peekCharges: 1,
            regionShuffleCharges: 1,
            strayRemoveArmed: true,
            strayRemoveCharges: 1
        } as RunState;

        renderToolbar(run, {
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'tile-a'
        });

        expect(screen.getByLabelText(/Pin mode/i).querySelector('[data-power-role="recall"]')).toHaveTextContent('Pinning');
        expect(screen.getByLabelText(/Destroy a hidden pair/i).querySelector('[data-power-role="control"]')).toHaveTextContent('Tap');
        expect(screen.getByLabelText(/Peek one hidden tile/i).querySelector('[data-power-role="recall"]')).toHaveTextContent('Tap');
        expect(screen.getByLabelText(/Swap two hidden tiles/i).querySelector('[data-power-role="search"]')).toHaveTextContent('Place');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('Place link');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Place payoff');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Place target');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Commit stack');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Place target');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Commit stack');
        expect(screen.getByTestId('destroy-pair-intent-chip')).toHaveTextContent('Remove pair');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveAttribute('data-power-cue', 'Risk clear');
        expect(screen.getByTestId('peek-intent-chip')).toHaveTextContent('Reveal tile');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveAttribute('data-power-cue', 'Pair reveal');
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/Remove pair action armed/i);
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/Reveal tile action armed/i);
        expect(screen.getByLabelText(/Remove one safe stray singleton/i).querySelector('[data-power-role="control"]')).toHaveTextContent('Tap');
        expect(screen.getByTestId('stray-remove-intent-chip')).toHaveTextContent('Remove stray');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveTextContent('Space clear');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveTextContent('Tap stray');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveTextContent('Space clear');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveAttribute('data-power-payoff', 'control');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveAttribute('data-power-cue', 'Space clear');
        expect(screen.getByLabelText(/Remove one safe stray singleton/i)).toHaveAccessibleName(/Remove stray action armed/i);
        expect(screen.getByLabelText(/Remove one safe stray singleton/i)).toHaveAccessibleName(/Power payoff: Space clear/i);
    });

    it('recommends tile swap as the best tool when it creates a trait route', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            regionShuffleCharges: 1,
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: [
                    { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' as const },
                    { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                    { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                    { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' as const }
                ]
            }
        } as RunState;

        renderToolbar(run);

        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Use swap to cash route');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Match created route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-first', 'Use swap to cash route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-then', 'Match created route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-stack-tone', 'combo');
        expect(screen.getByTestId('row-swap-setup-badge')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('row-swap-setup-badge')).toHaveAttribute('data-power-recommendation', 'route-setup');
        expect(screen.getByTestId('tile-swap-setup-badge')).toHaveTextContent('Best tool');
        expect(screen.getByTestId('tile-swap-setup-badge')).toHaveAttribute('data-power-recommendation', 'best-tool');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Use swap');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Create route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Use swap');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Create route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route cashout');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route cashout');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('Best tool');
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(
            /Best route prime: Swap Sealed with Filler: Sealed \+ Heavy: score surge/i
        );
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Power payoff: Route cashout/i);
    });

    it('promotes swap route tools to stack cashout when the next match also pays a chain reward', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            regionShuffleCharges: 1,
            stats: {
                ...baseRun.stats,
                comboShards: 1,
                currentStreak: 3
            },
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: [
                    { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' as const },
                    { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                    { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                    { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' as const }
                ]
            }
        } as RunState;

        renderToolbar(run);

        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Tool stack');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('3 tools live');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Route + Chain + Recall');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-meter-fill', '100');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Use swap to stack cashout');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Cash stacked route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-first', 'Use swap to stack cashout');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-then', 'Cash stacked route');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-stack-tone', 'combo');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-tier', 'stack');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-action', 'Stack cashout');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-audio', 'tool-crescendo-stack');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-beats', '4');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-cue', 'burst');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-screen-cue', 'burst');
        expect(screen.getByTestId('tool-crescendo')).toHaveAttribute('data-tool-crescendo-screen-cue', 'burst');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('4 beat');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('Stack burst');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('tool-crescendo').querySelectorAll('[data-tool-crescendo-beat]')).toHaveLength(4);
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAccessibleName(
            'Tool stack: 3 tools live. Route + Chain + Recall. First: Use swap to stack cashout. Then: Cash stacked route. Keep: Keep trait route live. Tool crescendo: Stack cashout. Stack burst. 4 beats.'
        );
        expect(screen.getByLabelText(/Board powers/i)).toHaveAccessibleName(/Tool stack: 3 tools live\. Route \+ Chain \+ Recall/i);
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Stack route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Stack cashout');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Stack route');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-action', 'Cash now');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-audio', 'power-payoff-cashout');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-screen-cue', 'burst');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Create stack');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Stack cashout');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-next', 'Create stack');
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Power payoff: Stack cashout/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Impact cue: Stack cashout/i);
    });

    it('shows empty setup intent when row and swap charges are unavailable', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            destroyPairCharges: 0,
            peekCharges: 0,
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: false,
            strayRemoveCharges: 0
        } as RunState;

        renderToolbar(run);

        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Tools empty');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('0 tools live');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('No tools charged');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-meter-fill', '0');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Recharge tools');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Find recharge reward');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Keep matching clean');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-first', 'Recharge tools');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-then', 'Find recharge reward');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-keep', 'Keep matching clean');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-stack-tone', 'empty');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-tier', 'none');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-beats', '0');
        expect(screen.queryByTestId('tool-crescendo')).toBeNull();
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveTextContent('No charge');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('No charge');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Needs charge');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Needs charge');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Recharge');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Recharge');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Recharge tools');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Recharge tools');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-payoff', 'empty');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Recharge tools');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-payoff-beats', '0');
        expect(screen.getByTestId('row-swap-payoff-chip').querySelectorAll('[data-power-payoff-beat]')).toHaveLength(0);
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveAttribute('data-power-intent', 'empty');
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/No row or swap charge available/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/No row or swap charge available/i);
        expect(screen.getByTestId('peek-intent-chip')).toHaveTextContent('No charge');
        expect(screen.getByTestId('destroy-pair-intent-chip')).toHaveTextContent('No charge');
        expect(screen.getByTestId('stray-remove-intent-chip')).toHaveTextContent('No charge');
        expect(screen.getByTestId('peek-payoff-chip')).toHaveTextContent('Recharge tool');
        expect(screen.getByTestId('destroy-pair-payoff-chip')).toHaveTextContent('Recharge tool');
        expect(screen.getByTestId('stray-remove-payoff-chip')).toHaveTextContent('Recharge tool');
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/Power payoff: Recharge tool/i);
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/Power payoff: Recharge tool/i);
        expect(screen.getByLabelText(/Remove one safe stray singleton/i)).toHaveAccessibleName(/Power payoff: Recharge tool/i);
        expect(screen.getByLabelText(/Destroy a hidden pair/i)).toHaveAccessibleName(/No destroy charge available/i);
        expect(screen.getByLabelText(/Peek one hidden tile/i)).toHaveAccessibleName(/No peek charge available/i);
        expect(screen.getByLabelText(/Remove one safe stray singleton/i)).toHaveAccessibleName(/No stray remove charge available/i);
    });

    it('marks row and swap setup as locked when the contract disables shuffle tools', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            activeContract: { maxMismatches: null, noDestroy: false, noShuffle: true },
            regionShuffleCharges: 2,
            regionShuffleFreeThisFloor: true,
            relicIds: ['region_shuffle_free_first']
        } as RunState;

        renderToolbar(run, {
            regionShuffleDisabled: true,
            regionShuffleTitle: 'Scholar contract: row shuffle disabled',
            tileSwapDisabled: true,
            tileSwapTitle: 'Scholar contract: tile swap disabled'
        });

        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Tool setup');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveTextContent('Recall');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-meter-fill', '50');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Arm peek');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Use unlocked tool');
        expect(screen.getByTestId('tool-payoff-sequence')).toHaveTextContent('Keep memory chain');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-first', 'Arm peek');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-then', 'Use unlocked tool');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-keep', 'Keep memory chain');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-payoff-stack-tone', 'recall');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-tier', 'prime');
        expect(screen.getByTestId('tool-payoff-stack')).toHaveAttribute('data-tool-crescendo-beats', '2');
        expect(screen.getByTestId('tool-crescendo')).toHaveTextContent('Prime beat');
        expect(screen.queryByTestId('row-swap-setup-badge')).toBeNull();
        expect(screen.queryByTestId('tile-swap-setup-badge')).toBeNull();
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveTextContent('Locked');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('Locked');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Locked');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveTextContent('Locked');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveTextContent('Tools locked');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-payoff', 'locked');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Tools locked');
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveAttribute('data-power-intent', 'locked');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveAttribute('data-power-intent', 'locked');
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/Route prime locked by contract/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Route prime locked by contract/i);
    });

    it('calls out the free first row or swap setup when charges are empty but the relic is live', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            relicIds: ['region_shuffle_free_first']
        } as RunState;

        renderToolbar(run);

        expect(screen.getByTestId('row-swap-setup-badge')).toHaveTextContent('Free');
        expect(screen.getByTestId('tile-swap-setup-badge')).toHaveTextContent('Free');
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveTextContent('Free link');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveTextContent('Free link');
        expect(screen.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Free prime');
        expect(screen.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Free prime');
        expect(screen.getByTestId('row-swap-intent-chip')).toHaveAttribute('data-power-intent', 'combo');
        expect(screen.getByTestId('tile-swap-intent-chip')).toHaveAttribute('data-power-intent', 'combo');
        expect(screen.getByLabelText(/Row shuffle/i)).toHaveAccessibleName(/Free route link available/i);
        expect(screen.getByLabelText(/Swap two hidden tiles/i)).toHaveAccessibleName(/Free route link available/i);
    });

    it('marks flash pair as an immediate pair-reveal power when available', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            flashPairCharges: 1
        } as RunState;

        renderToolbar(run, {
            showFlashPairPower: true
        });

        expect(screen.getByTestId('flash-pair-intent-chip')).toHaveTextContent('Pair reveal');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveTextContent('Pair spark');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveTextContent('Pair spark');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveAttribute('data-power-payoff', 'recall');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveAttribute('data-power-next', 'Cash now');
        expect(screen.getByTestId('flash-pair-payoff-chip')).toHaveAttribute('data-power-cue', 'Pair spark');
        expect(screen.getByTestId('flash-pair-intent-chip')).toHaveAttribute('data-power-intent', 'recall');
        expect(screen.getByLabelText(/Flash reveal pair/i)).toHaveAccessibleName(/Pair reveal action available/i);
        expect(screen.getByLabelText(/Flash reveal pair/i)).toHaveAccessibleName(/Power payoff: Pair spark/i);
    });
});
