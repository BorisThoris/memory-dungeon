import type { RunState, Settings } from '../../shared/contracts';
import { getPowerVerbTeachingRows } from '../../shared/power-verbs';
import {
    memo,
    useEffect,
    useLayoutEffect,
    useRef,
    type Dispatch,
    type RefObject,
    type SetStateAction
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    handleHorizontalToolbarKeyDown,
    syncToolbarTabIndices
} from '../a11y/toolbarRoving';
import { GAMEPLAY_TOOLBAR_ICONS } from '../assets/ui/icons';
import { UiButton } from '../ui';
import {
    playMenuOpenSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import { REG107_POWER_TEACHING_ANCHOR } from '../gameplay/regPhase4PlayContract';
import type { TileBoardHandle } from './TileBoard';
import styles from './GameScreen.module.css';

interface GameLeftToolbarProps {
    cameraViewportMode: boolean;
    run: RunState;
    debugFlags: Settings['debugFlags'];
    showForgivenessHint: boolean;
    rulesHintNudge: string | null;
    rulesHintsExpanded: boolean;
    setRulesHintsExpanded: Dispatch<SetStateAction<boolean>>;
    showBoardPowerBar: boolean;
    shuffleDisabled: boolean;
    shuffleTitle: string;
    regionShuffleDisabled: boolean;
    regionShuffleTitle: string;
    tileSwapDisabled: boolean;
    tileSwapTitle: string;
    canRegionShuffleRow: (rowIndex: number) => boolean;
    shuffleRegionRow: (rowIndex: number) => void;
    showFlashPairPower: boolean;
    flashPairDisabled: boolean;
    flashPairTitle: string;
    applyFlashPairPower: () => void;
    maxPinnedTiles: number;
    destroyDisabled: boolean;
    tileBoardRef: RefObject<TileBoardHandle | null>;
    onViewportReset: () => void;
    onRequestAbandonRun: () => void;
    openSettingsPlaying: () => void;
    openInventoryFromPlaying: () => void;
    openCodexFromPlaying: () => void;
    shuffleBoard: () => void;
    toggleBoardPinMode: () => void;
    boardPinMode: boolean;
    toggleDestroyPairArmed: () => void;
    destroyPairArmed: boolean;
    togglePeekMode: () => void;
    peekModeArmed: boolean;
    toggleTileSwapArmed: () => void;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    toggleStrayArm: () => void;
    undoResolvingFlip: () => void;
    triggerDebugReveal: () => void;
}

const GameLeftToolbar = memo(function GameLeftToolbar({
    cameraViewportMode,
    run,
    debugFlags,
    showForgivenessHint,
    rulesHintNudge,
    rulesHintsExpanded,
    setRulesHintsExpanded,
    showBoardPowerBar,
    shuffleDisabled,
    shuffleTitle,
    regionShuffleDisabled,
    regionShuffleTitle,
    tileSwapDisabled,
    tileSwapTitle,
    canRegionShuffleRow,
    shuffleRegionRow,
    showFlashPairPower,
    flashPairDisabled,
    flashPairTitle,
    applyFlashPairPower,
    maxPinnedTiles,
    destroyDisabled,
    tileBoardRef,
    onViewportReset,
    onRequestAbandonRun,
    openSettingsPlaying,
    openInventoryFromPlaying,
    openCodexFromPlaying,
    toggleBoardPinMode,
    boardPinMode,
    toggleDestroyPairArmed,
    destroyPairArmed,
    togglePeekMode,
    peekModeArmed,
    toggleTileSwapArmed,
    tileSwapArmed,
    tileSwapFirstTileId,
    toggleStrayArm,
    undoResolvingFlip,
    triggerDebugReveal,
    shuffleBoard
}: GameLeftToolbarProps) {
    const { masterVolume, sfxVolume } = useAppStore(
        useShallow((state) => ({
            masterVolume: state.settings.masterVolume,
            sfxVolume: state.settings.sfxVolume
        }))
    );
    const asideRef = useRef<HTMLElement | null>(null);
    const controlsToolbarRef = useRef<HTMLDivElement | null>(null);
    const powersToolbarRef = useRef<HTMLDivElement | null>(null);
    const resolveToolbarRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        syncToolbarTabIndices(controlsToolbarRef.current);
    }, [
        cameraViewportMode,
        run.status,
        debugFlags.allowBoardReveal,
        debugFlags.showDebugTools
    ]);

    useLayoutEffect(() => {
        syncToolbarTabIndices(powersToolbarRef.current);
    }, [
        boardPinMode,
        destroyDisabled,
        destroyPairArmed,
        flashPairDisabled,
        peekModeArmed,
        tileSwapArmed,
        tileSwapDisabled,
        tileSwapFirstTileId,
        regionShuffleDisabled,
        run.board?.rows,
        run.destroyPairCharges,
        run.flashPairCharges,
        run.peekCharges,
        run.regionShuffleCharges,
        run.shuffleCharges,
        run.strayRemoveArmed,
        run.strayRemoveCharges,
        shuffleDisabled,
        showBoardPowerBar,
        showFlashPairPower
    ]);

    useLayoutEffect(() => {
        syncToolbarTabIndices(resolveToolbarRef.current);
    }, [run.status, run.undoUsesThisFloor]);

    useEffect(() => {
        const aside = asideRef.current;
        if (!aside) {
            return;
        }
        const onFocusIn = (event: FocusEvent): void => {
            const target = event.target;
            if (!(target instanceof HTMLButtonElement)) {
                return;
            }
            const toolbar = target.closest('[role="toolbar"]');
            if (!(toolbar instanceof HTMLElement) || !aside.contains(toolbar)) {
                return;
            }
            syncToolbarTabIndices(toolbar, target);
        };
        aside.addEventListener('focusin', onFocusIn);
        return () => aside.removeEventListener('focusin', onFocusIn);
    }, []);

    const pinVowCap = run.activeContract?.maxPinsTotalRun;
    const pinTitle =
        pinVowCap != null
            ? `Pin hidden tiles (max ${maxPinnedTiles} on board). Pin vow: ${run.pinsPlacedCountThisRun} of ${pinVowCap} placements used.`
            : `Pin up to ${maxPinnedTiles} hidden tiles for planning`;
    const uiGain = uiSfxGainFromSettings(masterVolume, sfxVolume);
    const playUiClick = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    };
    const playMenuOpen = (): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    };
    const powerTeachingRows = getPowerVerbTeachingRows(run);
    const powerRow = (id: (typeof powerTeachingRows)[number]['id']) => powerTeachingRows.find((row) => row.id === id)!;
    const powerTitle = (id: (typeof powerTeachingRows)[number]['id'], fallback: string): string => {
        const row = powerRow(id);
        return `${fallback}. ${row.cost} ${row.consequence} ${row.perfectMemoryCopy}`;
    };

    return (
        <aside
            aria-label="Game actions"
            className={`${styles.actionDock} ${cameraViewportMode ? styles.mobileActionDock : ''}`.trim()}
            data-dock-density={cameraViewportMode ? 'compact' : 'desktop'}
            data-dock-model="bottom-icon-dock"
            data-html-ui-layer="gameplay-actions-v2"
            data-testid="game-action-dock"
            ref={asideRef}
        >
            <div
                aria-label="Game controls"
                aria-orientation="horizontal"
                className={styles.actionDockGroup}
                onKeyDown={handleHorizontalToolbarKeyDown}
                ref={controlsToolbarRef}
                role="toolbar"
            >
                <button
                    aria-label="Fit board"
                    className={styles.iconAction}
                    data-testid="game-toolbar-fit"
                    onClick={() => {
                        playUiClick();
                        onViewportReset();
                    }}
                    title="Fit board"
                    type="button"
                >
                    <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.fitBoard} />
                    <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Fit board</span>
                </button>
                <button
                    aria-label="Run settings (toolbar)"
                    className={styles.iconAction}
                    data-testid="game-toolbar-settings"
                    onClick={() => {
                        playMenuOpen();
                        openSettingsPlaying();
                    }}
                    title="Settings"
                    type="button"
                >
                    <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.settings} />
                    <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Settings</span>
                </button>
                <button
                    aria-label="Open codex"
                    className={styles.iconAction}
                    data-testid="game-toolbar-codex"
                    onClick={() => {
                        playMenuOpen();
                        openCodexFromPlaying();
                    }}
                    title="Codex"
                    type="button"
                >
                    <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.codexBook} />
                    <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Codex</span>
                </button>
                <button
                    aria-label="Open inventory"
                    className={styles.iconAction}
                    data-testid="game-toolbar-inventory"
                    onClick={() => {
                        playMenuOpen();
                        openInventoryFromPlaying();
                    }}
                    title="Inventory"
                    type="button"
                >
                    <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.inventoryBag} />
                    <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Inventory</span>
                </button>
                <button
                    aria-label="Return to main menu"
                    className={styles.iconAction}
                    data-testid="game-toolbar-main-menu"
                    onClick={() => {
                        playMenuOpen();
                        onRequestAbandonRun();
                    }}
                    title="Main menu"
                    type="button"
                >
                    <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.mainMenu} />
                    <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Main menu</span>
                </button>
                {import.meta.env.DEV && debugFlags.showDebugTools && debugFlags.allowBoardReveal ? (
                    <UiButton className={styles.toolbarDebugBtn} size="sm" variant="debug" onClick={triggerDebugReveal}>
                        Reveal
                    </UiButton>
                ) : null}
            </div>
            {showForgivenessHint ? (
                <div className={styles.actionDockRules}>
                    <button
                        aria-expanded={rulesHintsExpanded}
                        aria-label={rulesHintsExpanded ? 'Hide rule tips' : 'Show rule tips'}
                        className={styles.rulesToggle}
                        onClick={() => {
                            playUiClick();
                            setRulesHintsExpanded((v) => !v);
                        }}
                        type="button"
                    >
                        {rulesHintsExpanded ? 'Hide' : 'Rules'}
                    </button>
                    {rulesHintsExpanded && rulesHintNudge ? (
                        <p className={styles.ruleDisclosureNudge} data-testid="gameplay-rules-nudge">
                            {rulesHintNudge}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {showBoardPowerBar ? (
                <div
                    aria-label="Board powers"
                    aria-orientation="horizontal"
                    className={styles.actionDockGroup}
                    onKeyDown={handleHorizontalToolbarKeyDown}
                    ref={powersToolbarRef}
                    role="toolbar"
                >
                    <button
                        aria-label={`Shuffle hidden tiles. Charges: ${run.shuffleCharges}`}
                        aria-pressed={false}
                        className={`${styles.iconAction} ${styles.iconActionWithBadge}`}
                        disabled={shuffleDisabled}
                        onClick={() => {
                            if (shuffleDisabled) {
                                return;
                            }
                            const handle = tileBoardRef.current;
                            if (handle) {
                                handle.runShuffleAnimation(() => shuffleBoard());
                            } else {
                                shuffleBoard();
                            }
                        }}
                        title={powerTitle('shuffle', shuffleTitle)}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.shuffle} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Shuffle
                        </span>
                        <span
                            className={`${styles.powerBadge} ${
                                run.shuffleCharges > 0 ? styles.powerBadgeCharged : styles.powerBadgeDepleted
                            }`}
                        >
                            {run.shuffleCharges}
                        </span>
                    </button>
                    <details
                        className={styles.regionShuffleCluster}
                        aria-label={`Row shuffle. Charges ${run.regionShuffleCharges}.${
                            run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first')
                                ? ' First row shuffle or tile swap this floor is free.'
                                : ''
                        }`}
                    >
                        <summary className={styles.regionShuffleSummary} title={powerTitle('region_shuffle', regionShuffleTitle)}>
                            <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.shuffle} />
                            <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                                Shuffle row
                            </span>
                            <span
                                className={`${styles.powerBadge} ${styles.powerBadgeInline} ${
                                    run.regionShuffleCharges > 0 ||
                                    (run.regionShuffleFreeThisFloor &&
                                        run.relicIds.includes('region_shuffle_free_first'))
                                        ? styles.powerBadgeCharged
                                        : styles.powerBadgeDepleted
                                }`}
                            >
                                {run.regionShuffleCharges}
                            </span>
                        </summary>
                        <div className={styles.regionShuffleRows}>
                            {run.board
                                ? Array.from({ length: run.board.rows }, (_, row) => (
                                      <button
                                          key={row}
                                          aria-label={`Shuffle row ${row + 1}`}
                                          className={styles.regionRowBtn}
                                          data-toolbar-popover="true"
                                          disabled={regionShuffleDisabled || !canRegionShuffleRow(row)}
                                          onClick={() => {
                                              if (regionShuffleDisabled || !canRegionShuffleRow(row)) {
                                                  return;
                                              }
                                              const handle = tileBoardRef.current;
                                              if (handle) {
                                                  handle.runShuffleAnimation(() => shuffleRegionRow(row));
                                              } else {
                                                  shuffleRegionRow(row);
                                              }
                                          }}
                                          title={powerTitle('region_shuffle', regionShuffleTitle)}
                                          type="button"
                                      >
                                          {row + 1}
                                      </button>
                                  ))
                                : null}
                        </div>
                    </details>
                    <button
                        aria-label={`Swap two hidden tiles. Row/swap charges: ${run.regionShuffleCharges}. ${
                            tileSwapArmed
                                ? tileSwapFirstTileId
                                    ? 'Tap the destination tile'
                                    : 'Tap the first tile'
                                : 'Arm swap, then tap two hidden tiles'
                        }.`}
                        aria-pressed={tileSwapArmed}
                        className={`${styles.iconAction} ${styles.iconActionWithBadge} ${tileSwapArmed ? styles.iconActionActive : ''}`}
                        disabled={tileSwapDisabled}
                        onClick={() => toggleTileSwapArmed()}
                        title={powerTitle('tile_swap', tileSwapTitle)}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.shuffle} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Swap
                        </span>
                        <span
                            className={`${styles.powerBadge} ${
                                run.regionShuffleCharges > 0 ||
                                (run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
                                    ? styles.powerBadgeCharged
                                    : styles.powerBadgeDepleted
                            }`}
                        >
                            {run.regionShuffleCharges}
                        </span>
                    </button>
                    <button
                        aria-label={boardPinMode ? 'Exit pin mode' : 'Pin mode - tap tiles to mark'}
                        aria-pressed={boardPinMode}
                        className={`${styles.iconAction} ${boardPinMode ? styles.iconActionActive : ''}`}
                        onClick={() => toggleBoardPinMode()}
                        title={powerTitle('pin', pinTitle)}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.pin} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Pin
                        </span>
                    </button>
                    <button
                        aria-label={`Destroy a hidden pair. Charges: ${run.destroyPairCharges}. ${destroyPairArmed ? 'Tap a tile' : 'Arm then tap a tile'}. ${powerRow('destroy_pair').perfectMemoryCopy}`}
                        aria-pressed={destroyPairArmed}
                        className={`${styles.iconAction} ${styles.iconActionWithBadge} ${destroyPairArmed ? styles.iconActionActive : ''}`}
                        disabled={destroyDisabled}
                        onClick={() => toggleDestroyPairArmed()}
                        title={powerTitle(
                            'destroy_pair',
                            run.destroyPairCharges < 1
                                ? 'No destroy charges'
                                : destroyPairArmed
                                  ? 'Tap a hidden tile to destroy its pair'
                                  : 'Arm destroy, then tap a hidden tile'
                        )}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.destroy} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Destroy
                        </span>
                        <span
                            className={`${styles.powerBadge} ${
                                run.destroyPairCharges > 0 ? styles.powerBadgeCharged : styles.powerBadgeDepleted
                            }`}
                        >
                            {run.destroyPairCharges}
                        </span>
                    </button>
                    <button
                        aria-label={`Peek one hidden tile. Charges: ${run.peekCharges}. ${peekModeArmed ? 'Tap a tile' : 'Arm peek then tap'}. ${powerRow('peek').perfectMemoryCopy}`}
                        aria-pressed={peekModeArmed}
                        className={`${styles.iconAction} ${styles.iconActionWithBadge} ${peekModeArmed ? styles.iconActionActive : ''}`}
                        disabled={run.peekCharges < 1}
                        onClick={() => togglePeekMode()}
                        title={powerTitle(
                            'peek',
                            run.peekCharges < 1
                                ? 'No peek charges this floor'
                                : peekModeArmed
                                  ? 'Tap a hidden tile to peek'
                                  : 'Arm peek, then tap a hidden tile'
                        )}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.peek} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Peek
                        </span>
                        <span
                            className={`${styles.powerBadge} ${
                                run.peekCharges > 0 ? styles.powerBadgeCharged : styles.powerBadgeDepleted
                            }`}
                        >
                            {run.peekCharges}
                        </span>
                    </button>
                    {showFlashPairPower ? (
                        <button
                            aria-label={`Flash reveal pair. Charges: ${run.flashPairCharges}`}
                            className={`${styles.iconAction} ${styles.iconActionWithBadge}`}
                            disabled={flashPairDisabled}
                            onClick={() => {
                                if (flashPairDisabled) {
                                    return;
                                }
                                applyFlashPairPower();
                            }}
                            title={powerTitle('flash_pair', flashPairTitle)}
                            type="button"
                        >
                            <span className={styles.toolbarFlashGlyph} aria-hidden="true">
                                F
                            </span>
                            <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                                Flash
                            </span>
                            <span
                                className={`${styles.powerBadge} ${
                                    run.flashPairCharges > 0 ? styles.powerBadgeCharged : styles.powerBadgeDepleted
                                }`}
                            >
                                {run.flashPairCharges}
                            </span>
                        </button>
                    ) : null}
                    <button
                        aria-label={`Remove one safe stray singleton. Charges: ${run.strayRemoveCharges}. ${run.strayRemoveArmed ? 'Tap a valid singleton' : 'Arm then tap a valid singleton'}. ${powerRow('stray_remove').perfectMemoryCopy}`}
                        aria-pressed={run.strayRemoveArmed}
                        className={`${styles.iconAction} ${styles.iconActionWithBadge} ${run.strayRemoveArmed ? styles.iconActionActive : ''}`}
                        disabled={run.strayRemoveCharges < 1}
                        onClick={() => toggleStrayArm()}
                        title={powerTitle(
                            'stray_remove',
                            run.strayRemoveCharges < 1
                                ? 'No stray-remove charges'
                                : run.strayRemoveArmed
                                  ? 'Tap a valid singleton tile to remove it from play'
                                  : 'Arm stray remove, then tap a valid singleton tile'
                        )}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.stray} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>
                            Stray
                        </span>
                        <span
                            className={`${styles.powerBadge} ${
                                run.strayRemoveCharges > 0 ? styles.powerBadgeCharged : styles.powerBadgeDepleted
                            }`}
                        >
                            {run.strayRemoveCharges}
                        </span>
                    </button>
                    <details className={styles.powerTeachingDetails}>
                        <summary aria-label="Power roles" title="Power roles">
                            <span aria-hidden="true">?</span>
                        </summary>
                        <div
                            className={styles.powerTeachingPanel}
                            data-testid="power-teaching-panel"
                            id={REG107_POWER_TEACHING_ANCHOR}
                        >
                            {powerTeachingRows.map((row) => (
                                <div className={styles.powerTeachingRow} key={row.id}>
                                    <strong>{row.label}</strong>
                                    <span>{row.job}</span>
                                    <small>
                                        {row.disabledReason ?? row.cost} {row.consequence} {row.perfectMemoryCopy}
                                    </small>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            ) : null}
            {run.status === 'resolving' && run.undoUsesThisFloor > 0 ? (
                <div
                    aria-label="Resolve options"
                    aria-orientation="horizontal"
                    className={styles.actionDockGroup}
                    onKeyDown={handleHorizontalToolbarKeyDown}
                    ref={resolveToolbarRef}
                    role="toolbar"
                >
                    <button
                        aria-label="Undo last flip (uses your one undo this floor)"
                        className={styles.iconAction}
                        onClick={() => undoResolvingFlip()}
                        title={powerTitle('undo_resolve', 'Undo the current flip before it resolves')}
                        type="button"
                    >
                        <img alt="" className={styles.toolbarGlyphImg} src={GAMEPLAY_TOOLBAR_ICONS.undo} />
                        <span aria-hidden="true" className={styles.toolbarFlyoutLabel}>Undo</span>
                    </button>
                </div>
            ) : null}
        </aside>
    );
});

GameLeftToolbar.displayName = 'GameLeftToolbar';

export default GameLeftToolbar;
