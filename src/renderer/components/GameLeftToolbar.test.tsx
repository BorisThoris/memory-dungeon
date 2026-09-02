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
            strayRemoveArmed={false}
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
    /*
     * What is left after the July bombardment was reverted. The suite that used to live
     * here asserted the payoff, role, intent and setup chips the dock accumulated between
     * 2026-07-04 and 2026-08; those are gone, so their specs went with them. What the dock
     * is actually for is reaching the five shell destinations and the board powers.
     */
    const playingRun = (): RunState =>
        finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

    it('renders the five shell actions the player navigates with', () => {
        renderToolbar(playingRun());

        for (const testId of [
            'game-toolbar-fit',
            'game-toolbar-settings',
            'game-toolbar-codex',
            'game-toolbar-inventory',
            'game-toolbar-main-menu'
        ]) {
            expect(screen.getByTestId(testId)).toBeInTheDocument();
        }
    });

    it('keeps the board power buttons reachable alongside them', () => {
        renderToolbar(playingRun());

        expect(screen.getByTestId('game-action-dock')).toBeInTheDocument();
        expect(screen.getAllByRole('toolbar').length).toBeGreaterThan(0);
    });
});
