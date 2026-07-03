import type { RunState, Settings } from '../../shared/contracts';
import { getPowerVerbTeachingRows } from '../../shared/power-verbs';
import { getTraitOpportunityHudModel } from '../../shared/trait-opportunities';
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
import { getChainRewardForecastCues } from '../copy/chainMomentum';
import { useAppStore } from '../store/useAppStore';
import { REG107_POWER_TEACHING_ANCHOR } from '../gameplay/regPhase4PlayContract';
import type { TileBoardHandle } from './TileBoard';
import styles from './GameScreen.module.css';

const POWER_ROLE_TONE_BY_JOB = {
    Recall: 'recall',
    Search: 'search',
    'Damage control': 'control',
    Risk: 'risk'
} as const;

type PowerPayoffTone = 'combo' | 'control' | 'recall' | 'locked' | 'empty';
type ToolPayoffStackTone = 'combo' | 'control' | 'recall' | 'locked' | 'empty';
const DEPLETED_POWER_PAYOFF_LABEL = 'Recharge tool';
const DEPLETED_ROUTE_PAYOFF_LABEL = 'Needs charge';
type ToolPayoffStack = {
    first: string;
    keep: string;
    label: 'Tool stack' | 'Tool setup' | 'Tools locked' | 'Tools empty';
    laneSummary: string;
    nextCue: string;
    then: string;
    tone: ToolPayoffStackTone;
    value: string;
};
type ToolCrescendo = {
    beats: 0 | 2 | 3 | 4;
    cue: 'none' | 'pulse' | 'snap' | 'burst';
    label: 'No beat' | 'Prime beat' | 'Cashout beat' | 'Stack burst';
    tier: 'none' | 'prime' | 'cashout' | 'stack';
};

const powerPayoffAction = (tone: PowerPayoffTone, impactCue: string, nextAction: string): string => {
    if (tone === 'empty') {
        return 'Recharge tools';
    }
    if (tone === 'locked') {
        return 'Preview lock';
    }
    if (impactCue === 'Stack cashout' || nextAction === 'Cash now') {
        return 'Cash now';
    }
    if (tone === 'combo') {
        return 'Prime route';
    }
    if (tone === 'recall') {
        return 'Reveal pair';
    }
    return 'Control board';
};

const powerPayoffAudioCue = (
    tone: PowerPayoffTone,
    impactCue: string,
    nextAction: string
): 'power-payoff-none' | 'power-payoff-locked' | 'power-payoff-cashout' | 'power-payoff-combo' | 'power-payoff-recall' | 'power-payoff-control' => {
    if (tone === 'empty') {
        return 'power-payoff-none';
    }
    if (tone === 'locked') {
        return 'power-payoff-locked';
    }
    if (impactCue === 'Stack cashout' || nextAction === 'Cash now') {
        return 'power-payoff-cashout';
    }
    if (tone === 'combo') {
        return 'power-payoff-combo';
    }
    if (tone === 'recall') {
        return 'power-payoff-recall';
    }
    return 'power-payoff-control';
};

const powerPayoffScreenCue = (tone: PowerPayoffTone, impactCue: string, nextAction: string): 'none' | 'locked' | 'burst' | 'snap' | 'pulse' | 'guard' => {
    if (tone === 'empty') {
        return 'none';
    }
    if (tone === 'locked') {
        return 'locked';
    }
    if (impactCue === 'Stack cashout' || nextAction === 'Cash now') {
        return 'burst';
    }
    if (tone === 'combo') {
        return 'snap';
    }
    if (tone === 'recall') {
        return 'pulse';
    }
    return 'guard';
};

const toolCrescendoAction = (crescendo: ToolCrescendo): 'Recharge tools' | 'Prime tool' | 'Cash route' | 'Stack cashout' => {
    if (crescendo.tier === 'stack') {
        return 'Stack cashout';
    }
    if (crescendo.tier === 'cashout') {
        return 'Cash route';
    }
    if (crescendo.tier === 'prime') {
        return 'Prime tool';
    }
    return 'Recharge tools';
};

const toolCrescendoAudioCue = (
    crescendo: ToolCrescendo
): 'tool-crescendo-none' | 'tool-crescendo-prime' | 'tool-crescendo-cashout' | 'tool-crescendo-stack' => {
    if (crescendo.tier === 'stack') {
        return 'tool-crescendo-stack';
    }
    if (crescendo.tier === 'cashout') {
        return 'tool-crescendo-cashout';
    }
    if (crescendo.tier === 'prime') {
        return 'tool-crescendo-prime';
    }
    return 'tool-crescendo-none';
};

const toolCrescendoScreenCue = (crescendo: ToolCrescendo): ToolCrescendo['cue'] => crescendo.cue;

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
    const powerRoleChip = (id: (typeof powerTeachingRows)[number]['id'], shortLabel?: string) => {
        const row = powerRow(id);
        return (
            <span
                aria-hidden="true"
                className={styles.powerRoleChip}
                data-power-role={POWER_ROLE_TONE_BY_JOB[row.job]}
            >
                {shortLabel ?? row.job}
            </span>
        );
    };
    const powerPayoffBeatCount = (tone: PowerPayoffTone, impactCue: string, nextAction: string): 0 | 1 | 2 | 3 | 4 => {
        if (tone === 'empty' || tone === 'locked') {
            return 0;
        }
        if (impactCue === 'Stack cashout' || nextAction === 'Cash now') {
            return 4;
        }
        if (tone === 'combo' || impactCue.includes('cashout') || impactCue === 'Pair spark') {
            return 3;
        }
        if (tone === 'recall' || tone === 'control') {
            return 2;
        }
        return 1;
    };
    const powerPayoffChip = (
        testId: string,
        label: string,
        tone: PowerPayoffTone,
        nextAction: string,
        impactCue: string
    ) => {
        const beatCount = powerPayoffBeatCount(tone, impactCue, nextAction);
        const action = powerPayoffAction(tone, impactCue, nextAction);
        return (
            <span
                aria-hidden="true"
                className={styles.powerPayoffChip}
                data-power-action={action}
                data-power-audio={powerPayoffAudioCue(tone, impactCue, nextAction)}
                data-power-cue={impactCue}
                data-power-next={nextAction}
                data-power-payoff={tone}
                data-power-payoff-beats={beatCount}
                data-power-screen-cue={powerPayoffScreenCue(tone, impactCue, nextAction)}
                data-testid={testId}
            >
                <strong>{label}</strong>
                <small>{nextAction}</small>
                <em>{impactCue}</em>
                <b>{action}</b>
                {beatCount > 0 ? (
                    <span className={styles.powerPayoffBeatPips}>
                        {Array.from({ length: beatCount }, (_, beatIndex) => (
                            <i data-power-payoff-beat={beatIndex + 1} key={beatIndex} />
                        ))}
                    </span>
                ) : null}
            </span>
        );
    };
    const rowSwapFreeAvailable =
        !run.activeContract?.noShuffle &&
        run.regionShuffleFreeThisFloor &&
        run.relicIds.includes('region_shuffle_free_first');
    const traitOpportunityHud = getTraitOpportunityHudModel(run.board, run);
    const swapRouteHint = traitOpportunityHud.swapHint;
    const swapRouteRecommended = rowSwapFreeAvailable || run.regionShuffleCharges > 0 ? swapRouteHint : null;
    const swapRouteStacksChainReward =
        swapRouteRecommended != null &&
        getChainRewardForecastCues(run.stats.currentStreak, run.stats.comboShards, run.lives).some(
            (cue) => cue.urgency === 'next'
        );
    const rowSwapSetupActive =
        !run.activeContract?.noShuffle &&
        (run.regionShuffleCharges > 0 || rowSwapFreeAvailable);
    const rowShuffleRecommendationLabel =
        rowSwapSetupActive && swapRouteRecommended ? 'Route prime' : null;
    const tileSwapRecommendationLabel =
        rowSwapSetupActive && swapRouteRecommended ? 'Best tool' : null;
    const rowSwapIntentLabel = run.activeContract?.noShuffle
        ? 'Locked'
        : tileSwapRecommendationLabel
          ? 'Best tool'
          : rowSwapSetupActive
          ? rowSwapFreeAvailable && run.regionShuffleCharges <= 0
              ? 'Free link'
              : 'Route link'
          : 'No charge';
    const rowSwapIntentTone = run.activeContract?.noShuffle ? 'locked' : rowSwapSetupActive ? 'combo' : 'empty';
    const rowSwapBadgeLabel = rowSwapFreeAvailable && run.regionShuffleCharges <= 0 ? 'Free' : run.regionShuffleCharges;
    const rowSwapIntentAria = run.activeContract?.noShuffle
        ? 'Route prime locked by contract.'
        : swapRouteRecommended
          ? `Best route prime: ${swapRouteRecommended.text}.`
        : rowSwapSetupActive
          ? rowSwapFreeAvailable && run.regionShuffleCharges <= 0
              ? 'Free route link available.'
              : 'Route link prime available.'
          : 'No row or swap charge available.';
    const rowSwapPayoffLabel = run.activeContract?.noShuffle
        ? 'Blocked'
        : swapRouteStacksChainReward
          ? 'Stack cashout'
        : swapRouteRecommended
          ? 'Route cashout'
          : rowSwapSetupActive
            ? 'Combo prime'
            : DEPLETED_ROUTE_PAYOFF_LABEL;
    const rowSwapPayoffTone: PowerPayoffTone = run.activeContract?.noShuffle
        ? 'locked'
        : rowSwapSetupActive
          ? 'combo'
          : 'empty';
    const rowSwapNextAction = run.activeContract?.noShuffle
        ? 'Locked'
        : swapRouteRecommended
          ? swapRouteStacksChainReward
              ? 'Stack route'
              : 'Use swap'
          : rowSwapSetupActive
            ? 'Set route'
            : 'Recharge';
    const rowSwapImpactCue = run.activeContract?.noShuffle
        ? 'Tools locked'
        : swapRouteStacksChainReward
          ? 'Stack cashout'
        : swapRouteRecommended
          ? 'Route cashout'
        : rowSwapSetupActive
            ? rowSwapFreeAvailable && run.regionShuffleCharges <= 0
                ? 'Free prime'
                : 'Route prime'
            : 'Recharge tools';
    const tileSwapPayoffLabel = tileSwapArmed
        ? tileSwapFirstTileId
            ? 'Place payoff'
            : 'Pick payoff'
        : rowSwapPayoffLabel;
    const tileSwapNextAction = run.activeContract?.noShuffle
        ? 'Locked'
        : tileSwapArmed
          ? tileSwapFirstTileId
              ? 'Place target'
              : 'Pick first'
          : swapRouteRecommended
            ? swapRouteStacksChainReward
                ? 'Create stack'
                : 'Create route'
            : rowSwapSetupActive
              ? 'Set route'
              : 'Recharge';
    const tileSwapImpactCue = tileSwapArmed ? (tileSwapFirstTileId ? 'Commit stack' : 'Pick stack') : rowSwapImpactCue;
    const shuffleImpactCue = run.shuffleCharges > 0 ? 'Pair search' : 'Recharge tools';
    const destroyImpactCue = run.destroyPairCharges > 0 ? (destroyPairArmed ? 'Risk clear' : 'Board control') : 'Recharge tools';
    const peekImpactCue = run.peekCharges > 0 ? (peekModeArmed ? 'Pair reveal' : 'Recall route') : 'Recharge tools';
    const flashImpactCue = run.flashPairCharges > 0 ? 'Pair spark' : 'Recharge tools';
    const strayImpactCue = run.strayRemoveCharges > 0 ? (run.strayRemoveArmed ? 'Space clear' : 'Board control') : 'Recharge tools';
    const destroyIntentAria =
        run.destroyPairCharges > 0 ? (destroyPairArmed ? 'Remove pair action armed.' : 'Cut risk action available.') : 'No destroy charge available.';
    const peekIntentAria =
        run.peekCharges > 0 ? (peekModeArmed ? 'Reveal tile action armed.' : 'Recall setup action available.') : 'No peek charge available.';
    const flashIntentAria =
        run.flashPairCharges > 0 ? 'Pair reveal action available.' : 'No flash pair charge available.';
    const strayIntentAria =
        run.strayRemoveCharges > 0 ? (run.strayRemoveArmed ? 'Remove stray action armed.' : 'Clear stray action available.') : 'No stray remove charge available.';
    const liveToolLanes = [
        rowSwapPayoffTone === 'combo' ? 'Route' : null,
        rowSwapPayoffTone === 'combo' && swapRouteStacksChainReward ? 'Chain' : null,
        run.peekCharges > 0 || run.flashPairCharges > 0 ? 'Recall' : null,
        run.destroyPairCharges > 0 || run.strayRemoveCharges > 0 ? 'Control' : null
    ].filter((lane): lane is string => lane != null);
    const primaryToolCue = run.activeContract?.noShuffle
        ? run.peekCharges > 0
            ? 'Arm peek'
            : run.destroyPairCharges > 0
              ? 'Cut risk'
              : 'Play from memory'
        : swapRouteRecommended
          ? swapRouteStacksChainReward
              ? 'Use swap to stack cashout'
              : 'Use swap to cash route'
          : rowSwapSetupActive
            ? 'Set route before matching'
            : run.peekCharges > 0
              ? 'Arm peek for recall'
              : run.destroyPairCharges > 0
                ? 'Cut one risky pair'
                : run.strayRemoveCharges > 0
                  ? 'Clean one stray'
                  : 'Recharge tools';
    const toolThenCue = run.activeContract?.noShuffle
        ? liveToolLanes.length > 0
            ? 'Use unlocked tool'
            : 'Play from memory'
        : swapRouteRecommended
          ? swapRouteStacksChainReward
              ? 'Cash stacked route'
              : 'Match created route'
          : rowSwapSetupActive
            ? 'Match new adjacency'
            : run.peekCharges > 0 || run.flashPairCharges > 0
              ? 'Confirm hidden pair'
              : run.destroyPairCharges > 0 || run.strayRemoveCharges > 0
                ? 'Open board space'
                : 'Find recharge reward';
    const toolKeepCue = liveToolLanes.includes('Route')
        ? 'Keep trait route live'
        : liveToolLanes.includes('Control')
          ? 'Keep softlock-safe'
          : liveToolLanes.includes('Recall')
            ? 'Keep memory chain'
            : 'Keep matching clean';
    const toolPayoffStack: ToolPayoffStack = run.activeContract?.noShuffle && liveToolLanes.length === 0
        ? {
              first: primaryToolCue,
              keep: toolKeepCue,
              label: 'Tools locked',
              laneSummary: 'Shuffle tools locked',
              nextCue: primaryToolCue,
              then: toolThenCue,
              tone: 'locked',
              value: '0 tools live'
          }
        : liveToolLanes.length > 0
          ? {
                first: primaryToolCue,
                keep: toolKeepCue,
                label: liveToolLanes.includes('Route') ? 'Tool stack' : 'Tool setup',
                laneSummary: liveToolLanes.join(' + '),
                nextCue: primaryToolCue,
                then: toolThenCue,
                tone: liveToolLanes.includes('Route') ? 'combo' : liveToolLanes.includes('Control') ? 'control' : 'recall',
                value: `${liveToolLanes.length} tool${liveToolLanes.length === 1 ? '' : 's'} live`
            }
          : {
                first: primaryToolCue,
              keep: toolKeepCue,
              label: 'Tools empty',
              laneSummary: 'No tools charged',
              nextCue: primaryToolCue,
              then: toolThenCue,
              tone: 'empty',
              value: '0 tools live'
            };
    const toolCrescendo: ToolCrescendo =
        toolPayoffStack.tone === 'combo' && liveToolLanes.includes('Chain')
            ? { beats: 4, cue: 'burst', label: 'Stack burst', tier: 'stack' }
            : toolPayoffStack.tone === 'combo'
              ? { beats: 3, cue: 'snap', label: 'Cashout beat', tier: 'cashout' }
              : toolPayoffStack.tone === 'recall' || toolPayoffStack.tone === 'control'
                ? { beats: 2, cue: 'pulse', label: 'Prime beat', tier: 'prime' }
                : { beats: 0, cue: 'none', label: 'No beat', tier: 'none' };
    const toolCrescendoActionCue = toolCrescendoAction(toolCrescendo);
    const toolCrescendoAudioCueValue = toolCrescendoAudioCue(toolCrescendo);
    const toolCrescendoScreenCueValue = toolCrescendoScreenCue(toolCrescendo);
    const toolPayoffStackLabel = `${toolPayoffStack.label}: ${toolPayoffStack.value}. ${toolPayoffStack.laneSummary}. First: ${toolPayoffStack.first}. Then: ${toolPayoffStack.then}. Keep: ${toolPayoffStack.keep}.`;
    const toolCrescendoLabel =
        toolCrescendo.tier === 'none'
            ? 'Tool crescendo: none.'
            : `Tool crescendo: ${toolCrescendoActionCue}. ${toolCrescendo.label}. ${toolCrescendo.beats} beats.`;

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
                    aria-label={`Board powers. ${toolPayoffStackLabel} ${toolCrescendoLabel}`}
                    aria-orientation="horizontal"
                    className={styles.actionDockGroup}
                    data-tool-crescendo-action={toolCrescendoActionCue}
                    data-tool-crescendo-audio={toolCrescendoAudioCueValue}
                    data-tool-crescendo-beats={toolCrescendo.beats}
                    data-tool-crescendo-cue={toolCrescendo.cue}
                    data-tool-crescendo-screen-cue={toolCrescendoScreenCueValue}
                    data-tool-crescendo-tier={toolCrescendo.tier}
                    data-tool-payoff-stack-tone={toolPayoffStack.tone}
                    onKeyDown={handleHorizontalToolbarKeyDown}
                    ref={powersToolbarRef}
                    role="toolbar"
                >
                    <span
                        aria-label={`${toolPayoffStackLabel} ${toolCrescendoLabel}`}
                        className={styles.toolPayoffStack}
                        data-tool-crescendo-action={toolCrescendoActionCue}
                        data-tool-crescendo-audio={toolCrescendoAudioCueValue}
                        data-tool-crescendo-beats={toolCrescendo.beats}
                        data-tool-crescendo-cue={toolCrescendo.cue}
                        data-tool-crescendo-screen-cue={toolCrescendoScreenCueValue}
                        data-tool-crescendo-tier={toolCrescendo.tier}
                        data-tool-payoff-first={toolPayoffStack.first}
                        data-tool-payoff-keep={toolPayoffStack.keep}
                        data-tool-payoff-then={toolPayoffStack.then}
                        data-tool-payoff-stack-tone={toolPayoffStack.tone}
                        data-testid="tool-payoff-stack"
                    >
                        <small>{toolPayoffStack.label}</small>
                        <strong>{toolPayoffStack.value}</strong>
                        <b>{toolPayoffStack.laneSummary}</b>
                        {toolCrescendo.tier !== 'none' ? (
                            <span
                                className={styles.toolCrescendo}
                                data-tool-crescendo-action={toolCrescendoActionCue}
                                data-tool-crescendo-audio={toolCrescendoAudioCueValue}
                                data-tool-crescendo-screen-cue={toolCrescendoScreenCueValue}
                                data-tool-crescendo-tier={toolCrescendo.tier}
                                data-testid="tool-crescendo"
                            >
                                <small>{toolCrescendo.beats} beat</small>
                                <span aria-hidden="true" className={styles.toolCrescendoPips}>
                                    {Array.from({ length: toolCrescendo.beats }, (_, beatIndex) => (
                                        <i data-tool-crescendo-beat={beatIndex + 1} key={beatIndex} />
                                    ))}
                                </span>
                                <em>{toolCrescendo.label}</em>
                                <b>{toolCrescendoActionCue}</b>
                            </span>
                        ) : null}
                        <span className={styles.toolPayoffSequence} data-testid="tool-payoff-sequence">
                            <small>First</small>
                            <em>{toolPayoffStack.first}</em>
                            <small>Then</small>
                            <em>{toolPayoffStack.then}</em>
                            <small>Keep</small>
                            <em>{toolPayoffStack.keep}</em>
                        </span>
                    </span>
                    <button
                        aria-label={`Shuffle hidden tiles. Power payoff: ${run.shuffleCharges > 0 ? 'Combo reroll' : DEPLETED_POWER_PAYOFF_LABEL}. Impact cue: ${shuffleImpactCue}. Charges: ${run.shuffleCharges}.`}
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
                        {powerPayoffChip('shuffle-payoff-chip', run.shuffleCharges > 0 ? 'Combo reroll' : DEPLETED_POWER_PAYOFF_LABEL, run.shuffleCharges > 0 ? 'combo' : 'empty', run.shuffleCharges > 0 ? 'Find payoff' : 'Recharge', shuffleImpactCue)}
                        {powerRoleChip('shuffle')}
                    </button>
                    <details
                        className={styles.regionShuffleCluster}
                        aria-label={`Row shuffle. Power payoff: ${rowSwapPayoffLabel}. Impact cue: ${rowSwapImpactCue}. ${rowSwapIntentAria} Charges ${run.regionShuffleCharges}.${
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
                                    rowSwapSetupActive
                                        ? styles.powerBadgeCharged
                                        : styles.powerBadgeDepleted
                                }`}
                            >
                                {rowSwapBadgeLabel}
                            </span>
                            {rowSwapSetupActive ? (
                                <span
                                    aria-hidden="true"
                                    className={styles.powerSetupBadge}
                                    data-power-recommendation={rowShuffleRecommendationLabel ? 'route-setup' : undefined}
                                    data-testid="row-swap-setup-badge"
                            >
                                {rowShuffleRecommendationLabel ?? (rowSwapFreeAvailable && run.regionShuffleCharges <= 0 ? 'Free' : 'Prime')}
                            </span>
                        ) : null}
                            {powerPayoffChip('row-swap-payoff-chip', rowSwapPayoffLabel, rowSwapPayoffTone, rowSwapNextAction, rowSwapImpactCue)}
                            <span
                                aria-hidden="true"
                                className={styles.powerIntentChip}
                                data-power-intent={rowSwapIntentTone}
                                data-testid="row-swap-intent-chip"
                            >
                                {rowSwapIntentLabel}
                            </span>
                            {powerRoleChip('region_shuffle', 'Prime')}
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
                        aria-label={`Swap two hidden tiles. Power payoff: ${rowSwapPayoffLabel}. Impact cue: ${tileSwapImpactCue}. ${rowSwapIntentAria} Row/swap charges: ${run.regionShuffleCharges}. ${
                            tileSwapArmed
                                ? tileSwapFirstTileId
                                    ? 'Tap the destination tile'
                                    : 'Tap the first tile'
                                : 'Arm swap, then tap two hidden tiles'
                        }. ${tileSwapTitle}.`}
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
                                rowSwapSetupActive
                                    ? styles.powerBadgeCharged
                                    : styles.powerBadgeDepleted
                            }`}
                        >
                            {rowSwapBadgeLabel}
                        </span>
                        {rowSwapSetupActive ? (
                            <span
                                aria-hidden="true"
                                className={styles.powerSetupBadge}
                                data-power-recommendation={tileSwapRecommendationLabel ? 'best-tool' : undefined}
                                data-testid="tile-swap-setup-badge"
                            >
                                {tileSwapRecommendationLabel ?? (rowSwapFreeAvailable && run.regionShuffleCharges <= 0 ? 'Free' : 'Prime')}
                            </span>
                        ) : null}
                        {powerPayoffChip('tile-swap-payoff-chip', tileSwapPayoffLabel, rowSwapPayoffTone, tileSwapNextAction, tileSwapImpactCue)}
                        <span
                            aria-hidden="true"
                            className={styles.powerIntentChip}
                            data-power-intent={rowSwapIntentTone}
                            data-testid="tile-swap-intent-chip"
                        >
                            {rowSwapSetupActive
                                ? tileSwapArmed
                                    ? tileSwapFirstTileId
                                        ? 'Place link'
                                        : 'Pick link'
                                    : rowSwapIntentLabel
                                : rowSwapIntentLabel}
                        </span>
                        {powerRoleChip('tile_swap', tileSwapArmed ? (tileSwapFirstTileId ? 'Place' : 'Pick') : 'Prime')}
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
                        {powerRoleChip('pin', boardPinMode ? 'Pinning' : undefined)}
                    </button>
                    <button
                        aria-label={`Destroy a hidden pair. Power payoff: ${run.destroyPairCharges > 0 ? 'Risk clear' : DEPLETED_POWER_PAYOFF_LABEL}. Impact cue: ${destroyImpactCue}. ${destroyIntentAria} Charges: ${run.destroyPairCharges}. ${destroyPairArmed ? 'Tap a tile' : 'Arm then tap a tile'}. ${powerRow('destroy_pair').perfectMemoryCopy}`}
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
                        {powerPayoffChip('destroy-pair-payoff-chip', run.destroyPairCharges > 0 ? 'Risk clear' : DEPLETED_POWER_PAYOFF_LABEL, run.destroyPairCharges > 0 ? 'control' : 'empty', run.destroyPairCharges > 0 ? (destroyPairArmed ? 'Tap pair' : 'Arm tool') : 'Recharge', destroyImpactCue)}
                        <span
                            aria-hidden="true"
                            className={styles.powerIntentChip}
                            data-power-intent={run.destroyPairCharges > 0 ? 'control' : 'empty'}
                            data-testid="destroy-pair-intent-chip"
                        >
                            {run.destroyPairCharges > 0 ? (destroyPairArmed ? 'Remove pair' : 'Cut risk') : 'No charge'}
                        </span>
                        {powerRoleChip('destroy_pair', destroyPairArmed ? 'Tap' : undefined)}
                    </button>
                    <button
                        aria-label={`Peek one hidden tile. Power payoff: ${run.peekCharges > 0 ? 'Safe reveal' : DEPLETED_POWER_PAYOFF_LABEL}. Impact cue: ${peekImpactCue}. ${peekIntentAria} Charges: ${run.peekCharges}. ${peekModeArmed ? 'Tap a tile' : 'Arm peek then tap'}. ${powerRow('peek').perfectMemoryCopy}`}
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
                        {powerPayoffChip('peek-payoff-chip', run.peekCharges > 0 ? 'Safe reveal' : DEPLETED_POWER_PAYOFF_LABEL, run.peekCharges > 0 ? 'recall' : 'empty', run.peekCharges > 0 ? (peekModeArmed ? 'Tap tile' : 'Arm peek') : 'Recharge', peekImpactCue)}
                        <span
                            aria-hidden="true"
                            className={styles.powerIntentChip}
                            data-power-intent={run.peekCharges > 0 ? 'recall' : 'empty'}
                            data-testid="peek-intent-chip"
                        >
                            {run.peekCharges > 0 ? (peekModeArmed ? 'Reveal tile' : 'Recall setup') : 'No charge'}
                        </span>
                        {powerRoleChip('peek', peekModeArmed ? 'Tap' : undefined)}
                    </button>
                    {showFlashPairPower ? (
                        <button
                            aria-label={`Flash reveal pair. Power payoff: ${run.flashPairCharges > 0 ? 'Pair spark' : DEPLETED_POWER_PAYOFF_LABEL}. Impact cue: ${flashImpactCue}. ${flashIntentAria} Charges: ${run.flashPairCharges}`}
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
                            {powerPayoffChip('flash-pair-payoff-chip', run.flashPairCharges > 0 ? 'Pair spark' : DEPLETED_POWER_PAYOFF_LABEL, run.flashPairCharges > 0 ? 'recall' : 'empty', run.flashPairCharges > 0 ? 'Cash now' : 'Recharge', flashImpactCue)}
                            <span
                                aria-hidden="true"
                                className={styles.powerIntentChip}
                                data-power-intent={run.flashPairCharges > 0 ? 'recall' : 'empty'}
                                data-testid="flash-pair-intent-chip"
                            >
                                {run.flashPairCharges > 0 ? 'Pair reveal' : 'No charge'}
                            </span>
                            {powerRoleChip('flash_pair')}
                        </button>
                    ) : null}
                    <button
                        aria-label={`Remove one safe stray singleton. Power payoff: ${run.strayRemoveCharges > 0 ? 'Space clear' : DEPLETED_POWER_PAYOFF_LABEL}. Impact cue: ${strayImpactCue}. ${strayIntentAria} Charges: ${run.strayRemoveCharges}. ${run.strayRemoveArmed ? 'Tap a valid singleton' : 'Arm then tap a valid singleton'}. ${powerRow('stray_remove').perfectMemoryCopy}`}
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
                        {powerPayoffChip('stray-remove-payoff-chip', run.strayRemoveCharges > 0 ? 'Space clear' : DEPLETED_POWER_PAYOFF_LABEL, run.strayRemoveCharges > 0 ? 'control' : 'empty', run.strayRemoveCharges > 0 ? (run.strayRemoveArmed ? 'Tap stray' : 'Arm tool') : 'Recharge', strayImpactCue)}
                        <span
                            aria-hidden="true"
                            className={styles.powerIntentChip}
                            data-power-intent={run.strayRemoveCharges > 0 ? 'control' : 'empty'}
                            data-testid="stray-remove-intent-chip"
                        >
                            {run.strayRemoveCharges > 0 ? (run.strayRemoveArmed ? 'Remove stray' : 'Clear stray') : 'No charge'}
                        </span>
                        {powerRoleChip('stray_remove', run.strayRemoveArmed ? 'Tap' : undefined)}
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
