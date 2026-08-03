import { ACHIEVEMENTS } from '../../shared/achievements';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    MAX_PINNED_TILES,
    RECALL_FOCUS_MAX,
    type AchievementId,
    type RunState,
    type Settings
} from '../../shared/contracts';
import { computeFocusDimmedTileIds } from '../../shared/focusDimmedTileIds';
import { getPrimaryRewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { getFloorClearCausalityRows } from '../../shared/level-result-presentation';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { formatLevelResultObjectiveLine } from '../../shared/secondary-objectives';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import {
    canOfferEndlessRiskWager
} from '../../shared/objective-rules';
import { getRouteChoiceAvailability, routeChoicesForResult } from '../../shared/route-rules';
import {
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard
} from '../../shared/board-powers';
import {
    getDungeonBoardPresentation,
    getDungeonExitStatus
} from '../../shared/dungeon-rules';
import { getMemoryRecallFeedback } from '../../shared/memory-recall-feedback';
import { getDungeonMapPresentation, getDungeonRouteDecisionPresentation, getRepairedSelectedDungeonNode } from '../../shared/run-map';
import { useNotificationStore } from '@cross-repo-libs/notifications';
import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { runPersistenceInBackground } from '../store/backgroundPersistence';
import { UI_ART } from '../assets/ui';
import { isNarrowShortLandscapeForMenuStack } from '../breakpoints';
import { deriveCameraViewportMode, latchPhoneWidthForMobileCamera } from '../../shared/cameraViewportMode';
import {
    getFeaturedObjectiveLabel,
    getFloorArchetypeDefinition,
    getFloorChapterIdentity,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { useDistractionChannelTick } from '../hooks/useDistractionChannelTick';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { useLatestRef } from '../hooks/useLatestRef';
import {
    formatHudActionFeedbackText,
    useHudPoliteLiveAnnouncement
} from '../hooks/useHudPoliteLiveAnnouncement';
import { useViewportSize } from '../hooks/useViewportSize';
import {
    buildRelicDraftBonusFootnoteLines,
    getRelicOfferSubtitle,
    getRelicOfferTitle,
    relicDraftProgressLine,
    relicEffectLabels
} from '../copy/relicDraftOffer';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { GAMEPLAY_SHORTCUT_ROWS } from '../keyboard/gameplayShortcuts';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import { StatTile } from '../ui';
import { useAppStore } from '../store/useAppStore';
import {
    getLatestBoardTurnResolvedEvent,
    getLatestGameplayFeedbackBatch
} from '../store/gameplayFeedbackAdapter';
import GameLeftToolbar from './GameLeftToolbar';
import { GameScreenActionFeedbackRail } from './GameScreenActionFeedbackRail';
import { GameScreenDungeonRunStrip } from './GameScreenDungeonRunStrip';
import { GameScreenDungeonStatusPanel } from './GameScreenDungeonStatusPanel';
import { GameScreenEndlessChapterBanner } from './GameScreenEndlessChapterBanner';
import GameplayHudBar from './GameplayHudBar';
import MainMenuBackground from './MainMenuBackground';
import OverlayModal from './OverlayModal';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';
import { useGameScreenBoardVisualSettings } from './gameScreenStoreSelectors';
import { getInventoryPayoffEngineSignal } from './inventoryScreenModel';
import TileBoard, { type TileBoardHandle } from './TileBoard';

const MemoTileBoard = memo(TileBoard);
const MemoGameplayHudBar = memo(GameplayHudBar);
import {
    playCountdownPressureSfx,
    playMismatchRecoveryCrescendoSfx,
    playRelicOfferOpenSfx,
    resumeAudioContext,
    sfxGainFromSettings
} from '../audio/gameSfx';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import { REG104_DATA_SHELL } from '../gameplay/regPhase4PlayContract';
import styles from './GameScreen.module.css';
import {
    getDungeonCombatLogRows,
    getVisualHudAnnouncementFollowup,
    getVisualHudAnnouncementImpact,
    getVisualHudAnnouncementSignal
} from './gameScreenFeedback';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';
import { getStickyBlockedTileId } from '../gameplay/stickyFingersBlockedTileId';
import { useGameScreenPowerTileHints } from './useGameScreenPowerTileHints';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';
import type { MatchScorePop, MatchScorePopPayoffLaneMapEntry, MismatchScorePop } from '../store/matchScorePop';

import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import {
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy,
} from '../copy/chainMomentum';
import { matchScoreFloaterChainCue, matchScoreFloaterLiveRegionText } from '../copy/matchScoreFloater';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryBurst,
    mismatchFloaterRecoveryChips,
    mismatchFloaterRecoveryCrescendo,
    mismatchFloaterRecoveryCrescendoLabel,
    mismatchFloaterRecoveryHint,
    mismatchFloaterRecoveryLaneMap,
    mismatchFloaterRecoverySequence,
    mismatchFloaterRecoveryStack,
    mismatchFloaterSignal,
    mismatchFloaterVisualLabel,
    type MismatchFloaterRecoveryChip
} from '../copy/mismatchFloater';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr,
    type TraitInteractionLaneMapEntry
} from '../copy/traitInteractionLaneMap';
import {
    getBoardMatchPayoffStackAction,
    getBoardMatchPayoffStackAudioCue,
    getBoardMatchPayoffStackBeatCount,
    getBoardMatchPayoffStackScreenCue,
    getMismatchRecoveryLaneAudioCue,
    getMismatchRecoveryLaneBeatCount,
    getMismatchRecoveryLaneScreenCue,
    getPrimaryMismatchRecoveryLane,
    matchChainRewardForecastCues,
    matchPayoffChips,
    matchPayoffLadderLanes,
    matchPayoffLaneAction,
    matchPayoffLaneActionMapAttr,
    matchPayoffLaneMap,
    matchPayoffLaneMapAttr,
    matchPayoffLaneMapLabel,
    matchTraitInteractionTexts,
    mismatchRecoveryLaneAction,
    mismatchRecoveryLaneActionMapAttr,
    mismatchRecoveryLaneMapAttr,
    mismatchRecoveryLaneMapLabel
} from './gameScreenBoardFeedbackModel';
import {
    FLOOR_CLEAR_LIFE_CARRYOVER_NOTE,
    GAMBIT_SIGNAL_ROWS_LABEL,
    RiskWagerPrimaryCueView,
    RiskWagerSignalRowsView,
    TUTORIAL_PAIR_MARKER_MAX_LEVEL,
    dungeonExitPromptLockLine,
    dungeonExitPromptTitle,
    formatGameplayDetailRowsLabel,
    formatGameplaySignalRowsLabel,
    getClearLifeBonusLabel,
    getFirstRouteChoiceTeachingLabel,
    getGambitSignalAudioCue,
    getGambitSignalBeatCount,
    getGambitSignalScreenCue,
    getOnboardingPromptSignalAudioCue,
    getOnboardingPromptSignalBeatCount,
    getOnboardingPromptSignalScreenCue,
    getOnboardingPromptSignals,
    getRiskWagerPrimaryCue,
    getRiskWagerSignalRows,
    getRouteChoiceActionCue,
    getRouteChoiceBeatCue,
    getRouteChoiceDecisionStack,
    getRouteChoiceImpactCue,
    getRouteChoicePayoffAudioCue,
    getRouteChoicePayoffRows,
    getRouteChoicePayoffScreenCue,
    getRouteChoiceSignalAudioCue,
    getRouteChoiceSignalLabels,
    getRouteChoiceSignalScreenCue,
    getRouteChoiceToneBeatCount,
    getRouteSpecialSignalAudioCue,
    getRouteSpecialSignalBeatCount,
    getRouteSpecialSignalScreenCue,
    routeCardKindForRouteType,
    routeSpecialDisplayLabel,
    routeSpecialDisplayRewardLine,
    routeSpecialSignalRows,
    routeTypeLabel,
    getSelectedRouteActionCue,
    getSelectedRouteImpactCue,
    trimTerminalPunctuation
} from './gameScreenDecisionSignals';
import {
    type FloorClearObjectiveSignalRow,
    type NextFloorSignalRow,
    getFloorClearActionSequenceCue,
    getFloorClearCarryForwardCue,
    getFloorClearCashoutRows,
    getFloorClearObjectiveSignalAudioCue,
    getFloorClearObjectiveSignalBeatCount,
    getFloorClearObjectiveSignalScreenCue,
    getFloorClearPayoffStackAction,
    getFloorClearPayoffStackAudioCue,
    getFloorClearPayoffStackBeatCount,
    getFloorClearPayoffStackScreenCue,
    getFloorClearPayoffStackSignal,
    getNextFloorSignalAudioCue,
    getNextFloorSignalBeatCount,
    getNextFloorSignalScreenCue,
    getPickupStackToastText
} from './gameScreenFloorClearFeedbackModel';

/** OVR-007 / HUD-020: decoy readout for `distraction_channel` — not gameplay state; hidden when reduce motion or assist toggle is off. */
const DISTRACTION_CHANNEL_LABEL = 'Chaff';

const DESKTOP_FULL_BLEED_TILE_BOARD_FRAME_STYLE: CSSProperties = {
    height: '100%',
    inset: 0,
    position: 'absolute',
    width: '100%'
};

interface GameScreenProps {
    achievements: AchievementId[];
    run: RunState;
    suppressStatusOverlays?: boolean;
}

const BONUS_TAG_LABELS: Record<string, string> = {
    scholar_style: 'Scholar style',
    glass_witness: 'Glass witness',
    cursed_last: 'Cursed last',
    flip_par: 'Flip par',
    objective_streak: 'Objective streak',
    boss_floor: 'Boss floor',
    boss_defeated: 'Boss defeated',
    boss_trophy_cache: 'Boss trophy cache',
    boss_trophy_forfeited: 'Boss trophy forfeited',
    traps_disarmed: 'Traps disarmed',
    treasure_claimed: 'Treasure claimed',
    route_claimed: 'Route claimed',
    perfect_scout: 'Perfect scout'
};

const formatBonusTagsLine = (tags: string[] | undefined): string | null => {
    if (!tags || tags.length === 0) {
        return null;
    }
    return tags.map((t) => BONUS_TAG_LABELS[t] ?? t).join(' · ');
};

const featuredObjectiveFailReason = (run: RunState): string | null => {
    const id = run.lastLevelResult?.featuredObjectiveId;
    if (!id || run.lastLevelResult?.featuredObjectiveCompleted) {
        return null;
    }
    if (id === 'scholar_style') {
        return 'Failed: shuffle or destroy was used this floor.';
    }
    if (id === 'glass_witness') {
        return 'Failed: the glass decoy entered a mismatch.';
    }
    if (id === 'cursed_last') {
        return 'Failed: the cursed pair was cleared before the last real pair.';
    }
    if (id === 'flip_par') {
        return 'Failed: match resolutions exceeded the floor par.';
    }
    return null;
};

const countFavorBonusPicksBanked = (favorProgressAfter: number, favorGain: number): number => {
    if (favorGain <= 0) {
        return 0;
    }
    const previousProgress = favorProgressAfter - favorGain;
    return previousProgress < 0 ? 1 : 0;
};

const actualMatchPayoffLaneCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>,
    payoffChips: readonly NonNullable<MatchScorePop['payoffChips']>[number][] = []
): number => {
    const summaryLaneCount = /^(\d+)\s+(?:payoffs|lanes)\b/.exec(payoffSummary.value)?.[1];
    if (summaryLaneCount) {
        return Number(summaryLaneCount);
    }
    const cashoutChipCount = payoffChips.filter((chip) =>
        chip.id === 'route' || chip.id === 'pickup' || chip.id === 'trait' || chip.id === 'chainReward'
    ).length;
    return Math.max(cashoutChipCount, payoffSummary.tier === 'score' ? 0 : 1);
};

type MatchFloaterHeat = 'cashout' | 'prime' | 'score' | 'stack' | 'surge';
type MismatchFloaterHeat = 'break' | 'lost-reward' | 'recover' | 'risk' | 'trait-surge';
type MatchPayoffChip = NonNullable<MatchScorePop['payoffChips']>[number];
type MatchFloaterJackpotCue = {
    action: string;
    beatCount: 3 | 4 | 5;
    label: string;
    tier: 'cashout' | 'stack' | 'super';
    value: string;
};

const getMatchFloaterHeat = (payload: MatchScorePop): MatchFloaterHeat => {
    const impactLabel = payload.impactCue.label.toLowerCase();
    const payoffSummaryLabel = payload.payoffSummary?.label.toLowerCase() ?? '';
    const payoffChipCues = matchPayoffChips(payload.payoffChips).map((chip) => chip.arcadeCue?.toLowerCase() ?? '');

    if (payoffSummaryLabel === 'super stack' || impactLabel === 'super stack') {
        return 'stack';
    }
    if (payoffSummaryLabel === 'stack cashout' || impactLabel === 'stack cashout') {
        return 'stack';
    }
    if (
        payload.impactCue.tone === 'combo' ||
        impactLabel.includes('surge') ||
        payoffChipCues.some((cue) => cue.includes('surge'))
    ) {
        return 'surge';
    }
    if (impactLabel.includes('cashout') || payoffSummaryLabel.includes('cashout')) {
        return 'cashout';
    }
    if (impactLabel.includes('prime') || payoffChipCues.some((cue) => cue.includes('prime'))) {
        return 'prime';
    }
    if (payoffChipCues.some((cue) => cue.includes('cashout'))) {
        return 'cashout';
    }
    return 'score';
};

const getBoardFloaterImpactCueBeatCount = (payload: MatchScorePop): 2 | 3 | 4 | 5 => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    const baseBeatCount =
        cueLabel === 'super stack'
            ? 5
            : cueLabel === 'stack cashout' || cueLabel.includes('cashout')
              ? 4
              : payload.impactCue.tone === 'reward' ||
                  payload.impactCue.tone === 'pickup' ||
                  payload.impactCue.tone === 'route' ||
                  payload.impactCue.tone === 'trait'
                ? 4
                : payload.impactCue.tone === 'combo' || payload.impactCue.tone === 'chain'
                  ? 3
                  : 2;
    return Math.max(baseBeatCount, payload.crescendo?.beatCount ?? 0) as 2 | 3 | 4 | 5;
};

const getBoardFloaterImpactCueScreenCue = (payload: MatchScorePop): 'burst' | 'pulse' | 'route' | 'surge' => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    if (cueLabel === 'super stack' || cueLabel.includes('stack') || cueLabel.includes('cashout')) {
        return 'burst';
    }
    if (payload.impactCue.tone === 'trait' || payload.impactCue.tone === 'combo' || cueLabel.includes('surge')) {
        return 'surge';
    }
    if (payload.impactCue.tone === 'route') {
        return 'route';
    }
    return 'pulse';
};

const getBoardFloaterRewardBurstBeatCount = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 3 | 4 | 5 => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 5;
    }
    if (rewardBurst.tier === 'stack') {
        return 4;
    }
    return 3;
};

const getBoardFloaterRewardBurstAudioCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'reward-burst-hit' | 'reward-burst-stack' | 'reward-burst-super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'reward-burst-super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'reward-burst-stack';
    }
    return 'reward-burst-hit';
};

const getBoardFloaterRewardBurstScreenCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'pulse' | 'burst' | 'super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'burst';
    }
    return 'pulse';
};

const getBoardFloaterCascadeBeatCount = (
    cascadeCue: NonNullable<MatchScorePop['cascadeCue']>
): 3 | 4 | 5 => {
    if (cascadeCue.tier === 'combo') {
        return 5;
    }
    if (cascadeCue.tier === 'reward') {
        return 4;
    }
    return 3;
};

const getBoardFloaterPayoffSummaryBeatCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 2 | 3 | 4 | 5 => {
    if (payoffSummary.label === 'Super stack') {
        return 5;
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 4;
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 3;
    }
    return 2;
};

const getBoardFloaterPayoffSummaryAudioCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'payoff-summary-score' | 'payoff-summary-chain' | 'payoff-summary-cashout' | 'payoff-summary-stack' | 'payoff-summary-super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'payoff-summary-super';
    }
    if (payoffSummary.label === 'Stack cashout') {
        return 'payoff-summary-stack';
    }
    if (payoffSummary.tier === 'reward' || payoffSummary.label.includes('cashout')) {
        return 'payoff-summary-cashout';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'payoff-summary-chain';
    }
    return 'payoff-summary-score';
};

const getBoardFloaterPayoffSummaryScreenCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'tick' | 'pulse' | 'burst' | 'super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'super';
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 'burst';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'pulse';
    }
    return 'tick';
};

const getMatchFloaterJackpotCue = (payload: MatchScorePop): MatchFloaterJackpotCue | null => {
    const summary = payload.payoffSummary;
    const rewardBurst = payload.rewardBurst;
    const payoffChips = matchPayoffChips(payload.payoffChips);
    const laneCount = Math.max(matchPayoffLaneMap(payload.payoffLaneMap).length, summary ? actualMatchPayoffLaneCount(summary, payoffChips) : 0);
    const impactLabel = payload.impactCue.label;
    const impactLabelLower = impactLabel.toLowerCase();
    const crescendo = payload.crescendo;

    if (summary?.label === 'Super stack' || rewardBurst?.label === 'Super stack' || crescendo?.tier === 'super') {
        return {
            action: rewardBurst?.action ?? 'Cash super stack',
            beatCount: 5,
            label: 'Super stack',
            tier: 'super',
            value: summary?.value ?? rewardBurst?.value ?? `${Math.max(laneCount, 4)} payoff lanes`
        };
    }
    if (summary?.label === 'Stack cashout' || rewardBurst?.tier === 'stack' || crescendo?.tier === 'stack' || laneCount >= 3) {
        return {
            action: rewardBurst?.action ?? 'Cash stack',
            beatCount: Math.max(4, crescendo?.beatCount ?? 0) as 4 | 5,
            label: 'Stack cashout',
            tier: 'stack',
            value: summary?.value ?? rewardBurst?.value ?? `${laneCount} payoff lanes`
        };
    }
    if (
        summary?.label === 'Route cashout' ||
        summary?.label === 'Pickup cashout' ||
        summary?.label === 'Trait cashout' ||
        summary?.label === 'Chain cashout' ||
        impactLabelLower.includes('cashout') ||
        crescendo?.tier === 'cashout'
    ) {
        return {
            action: rewardBurst?.action ?? 'Cash now',
            beatCount: Math.max(3, crescendo?.beatCount ?? 0) as 3 | 4 | 5,
            label: summary?.label ?? 'Cashout',
            tier: 'cashout',
            value: summary?.value ?? rewardBurst?.value ?? payload.routeRewardText ?? `+${runNonNegativeInteger(payload.amount).toLocaleString()}`
        };
    }
    return null;
};

const getBoardFloaterJackpotAudioCue = (
    cue: MatchFloaterJackpotCue
): 'match-jackpot-cashout' | 'match-jackpot-stack' | 'match-jackpot-super' => {
    if (cue.tier === 'super') {
        return 'match-jackpot-super';
    }
    if (cue.tier === 'stack') {
        return 'match-jackpot-stack';
    }
    return 'match-jackpot-cashout';
};

const getBoardFloaterJackpotScreenCue = (
    cue: MatchFloaterJackpotCue
): 'burst' | 'cashout' | 'super' => {
    if (cue.tier === 'super') {
        return 'super';
    }
    if (cue.tier === 'stack') {
        return 'burst';
    }
    return 'cashout';
};

const getBoardFloaterPayoffLaneBeatCount = (
    lane: MatchScorePopPayoffLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.tone === 'reward' || lane.tone === 'pickup' || lane.tone === 'route') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.tone === 'trait' || lane.tone === 'chain') {
        return 3;
    }
    return 2;
};

const getBoardFloaterPayoffLaneAudioCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'match-payoff-route' | 'match-payoff-pickup' | 'match-payoff-trait' | 'match-payoff-chain' | 'match-payoff-reward' | 'match-payoff-prime' => {
    if (lane.tone === 'route') {
        return 'match-payoff-route';
    }
    if (lane.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (lane.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (lane.tone === 'chain') {
        return 'match-payoff-chain';
    }
    if (lane.tone === 'reward') {
        return 'match-payoff-reward';
    }
    return 'match-payoff-prime';
};

const getBoardFloaterPayoffLaneScreenCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'burst' | 'route' | 'trait' | 'chain' | 'pulse' => {
    if (lane.tone === 'route' || lane.tone === 'pickup' || lane.tone === 'reward' || lane.count > 1) {
        return 'burst';
    }
    if (lane.tone === 'trait') {
        return 'trait';
    }
    if (lane.tone === 'chain') {
        return 'chain';
    }
    return 'pulse';
};

const getBoardFloaterPayoffLaneFocus = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'cashout' | 'route' | 'pickup' | 'trait' | 'chain' | 'reward' => {
    const action = matchPayoffLaneAction(lane).toLowerCase();
    const cue = lane.cue.toLowerCase();

    if (action.includes('cash') || cue.includes('cashout')) {
        return 'cashout';
    }

    return lane.tone;
};

const getBoardFloaterTraitLaneAudioCue = (
    lane: TraitInteractionLaneMapEntry
): 'match-trait-shard' | 'match-trait-guard' | 'match-trait-risk' | 'match-trait-score' | 'match-trait-tool' | 'match-trait-block' | 'match-trait-recall' => {
    if (lane.id === 'shard') {
        return 'match-trait-shard';
    }
    if (lane.id === 'guard') {
        return 'match-trait-guard';
    }
    if (lane.id === 'risk') {
        return 'match-trait-risk';
    }
    if (lane.id === 'score') {
        return 'match-trait-score';
    }
    if (lane.id === 'tool') {
        return 'match-trait-tool';
    }
    if (lane.id === 'block') {
        return 'match-trait-block';
    }
    return 'match-trait-recall';
};

const getBoardFloaterTraitLaneScreenCue = (
    lane: TraitInteractionLaneMapEntry
): 'burst' | 'guard' | 'risk' | 'control' | 'pulse' => {
    if (lane.count > 1 || lane.id === 'shard' || lane.id === 'score') {
        return 'burst';
    }
    if (lane.id === 'guard') {
        return 'guard';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'tool' || lane.id === 'block') {
        return 'control';
    }
    return 'pulse';
};

const getBoardFloaterPayoffLadderBeatCount = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 3 | 4 | 5 => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 5;
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 4;
    }
    return 3;
};

const getBoardFloaterPayoffLadderAudioCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'payoff-ladder-chain' | 'payoff-ladder-reward' | 'payoff-ladder-super' => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'payoff-ladder-super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'payoff-ladder-reward';
    }
    return 'payoff-ladder-chain';
};

const getBoardFloaterPayoffLadderScreenCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'burst' | 'pulse' | 'super' => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'burst';
    }
    return 'pulse';
};

const getBoardFloaterTraitLaneBeatCount = (
    lane: TraitInteractionLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.id === 'shard' || lane.id === 'guard') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.id === 'risk' || lane.id === 'block') {
        return 3;
    }
    return 2;
};

const getBoardFloaterChainMilestoneBeatCount = (
    milestone: NonNullable<MatchScorePop['chainMilestone']>
): 3 | 4 | 5 => {
    if (milestone.beatCount) {
        return milestone.beatCount;
    }
    if (milestone.tone === 'combo') {
        return 5;
    }
    if (milestone.tone === 'surge') {
        return 4;
    }
    return 3;
};

const getMismatchFloaterHeat = (payload: MismatchScorePop): MismatchFloaterHeat => {
    const traitRiskCount = matchTraitInteractionTexts(payload.traitInteractionTexts).length;
    if (payload.brokenChainRewardCue) {
        return 'lost-reward';
    }
    if ((payload.brokenChainDepth ?? 0) >= 3) {
        return 'break';
    }
    if (traitRiskCount >= 2) {
        return 'trait-surge';
    }
    if (traitRiskCount > 0) {
        return 'risk';
    }
    return 'recover';
};

const getMatchPayoffChipBeatCount = (chip: MatchPayoffChip): 1 | 2 | 3 | 4 => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'chainReward' || chip.id === 'next') {
        return 4;
    }
    if (chip.id === 'pickup' || chip.id === 'route' || chip.id === 'trait' || chip.id === 'tier') {
        return 3;
    }
    if (chip.id === 'streak' || chip.id === 'cascade') {
        return 2;
    }
    return 1;
};

const getMatchPayoffChipAudioCue = (
    chip: MatchPayoffChip
):
    | 'match-payoff-chain'
    | 'match-payoff-guard'
    | 'match-payoff-heal'
    | 'match-payoff-pickup'
    | 'match-payoff-reward'
    | 'match-payoff-route'
    | 'match-payoff-score'
    | 'match-payoff-trait' => {
    if (chip.tone === 'guard') {
        return 'match-payoff-guard';
    }
    if (chip.tone === 'heal') {
        return 'match-payoff-heal';
    }
    if (chip.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (chip.tone === 'route') {
        return 'match-payoff-route';
    }
    if (chip.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (chip.tone === 'reward' || chip.id === 'next' || chip.id === 'chainReward') {
        return 'match-payoff-reward';
    }
    if (chip.tone === 'chain' || chip.id === 'streak' || chip.id === 'cascade' || chip.id === 'tier') {
        return 'match-payoff-chain';
    }
    return 'match-payoff-score';
};

const getMatchPayoffChipScreenCue = (
    chip: MatchPayoffChip
): 'burst' | 'chain' | 'guard' | 'heal' | 'pulse' | 'tick' | 'trait' => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'next' || chip.id === 'chainReward') {
        return 'burst';
    }
    if (chip.tone === 'guard') {
        return 'guard';
    }
    if (chip.tone === 'heal') {
        return 'heal';
    }
    if (chip.tone === 'trait') {
        return 'trait';
    }
    if (chip.tone === 'pickup' || chip.tone === 'route' || chip.tone === 'reward') {
        return 'burst';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    return chip.id === 'score' ? 'tick' : 'pulse';
};

const getBoardFloaterRewardForecastBeatCount = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 2 | 3 | 4 => {
    if (cue.urgency === 'next' || cue.distance <= 1 || (cue.stackSize ?? 1) >= 2) {
        return 4;
    }
    if (cue.urgency === 'soon' || cue.distance <= 2) {
        return 3;
    }
    return 2;
};

const getBoardFloaterRewardForecastAudioCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'chain-reward-guard' | 'chain-reward-heal' | 'chain-reward-prime' | 'chain-reward-shard' | 'chain-reward-stack' => {
    if ((cue.stackSize ?? 1) >= 2) {
        return 'chain-reward-stack';
    }
    if (cue.tone === 'guard') {
        return 'chain-reward-guard';
    }
    if (cue.tone === 'heal') {
        return 'chain-reward-heal';
    }
    if (cue.urgency === 'later') {
        return 'chain-reward-prime';
    }
    return 'chain-reward-shard';
};

const getBoardFloaterRewardForecastScreenCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'burst' | 'pulse' | 'tick' => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

const getMismatchRecoveryChipBeatCount = (chip: MismatchFloaterRecoveryChip): 1 | 2 | 3 | 4 => {
    if (chip.arcadeCue === 'Lost cashout' || chip.urgency === 'one-away') {
        return 4;
    }
    if (chip.tone === 'risk' || chip.tone === 'chain') {
        return 3;
    }
    if (chip.tone === 'tool' || chip.tone === 'tempo') {
        return 2;
    }
    return 1;
};

const getMismatchRecoveryChipAudioCue = (
    chip: MismatchFloaterRecoveryChip
):
    | 'mismatch-chip-chain'
    | 'mismatch-chip-lost'
    | 'mismatch-chip-recover'
    | 'mismatch-chip-risk'
    | 'mismatch-chip-tempo'
    | 'mismatch-chip-tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'mismatch-chip-lost';
    }
    if (chip.tone === 'chain') {
        return 'mismatch-chip-chain';
    }
    if (chip.tone === 'risk') {
        return 'mismatch-chip-risk';
    }
    if (chip.tone === 'tool') {
        return 'mismatch-chip-tool';
    }
    if (chip.tone === 'tempo') {
        return 'mismatch-chip-tempo';
    }
    return 'mismatch-chip-recover';
};

const getMismatchRecoveryChipScreenCue = (
    chip: MismatchFloaterRecoveryChip
): 'chain' | 'lost' | 'recover' | 'risk' | 'tempo' | 'tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'lost';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    if (chip.tone === 'risk') {
        return 'risk';
    }
    if (chip.tone === 'tool') {
        return 'tool';
    }
    if (chip.tone === 'tempo') {
        return 'tempo';
    }
    return 'recover';
};

const GameScreen = ({ achievements, run, suppressStatusOverlays = false }: GameScreenProps) => {
    const shellRef = useRef<HTMLElement | null>(null);
    const boardStageRef = useRef<HTMLDivElement | null>(null);
    const boardFloaterRef = useRef<HTMLDivElement | null>(null);
    const mismatchRecoveryCrescendoSfxSignatureRef = useRef<string | null>(null);
    const tileBoardRef = useRef<TileBoardHandle>(null);
    const { height, width } = useViewportSize();
    const [phoneViewportLatched, setPhoneViewportLatched] = useState(() =>
        latchPhoneWidthForMobileCamera(width, false)
    );
    useEffect(() => {
        queueMicrotask(() => {
            setPhoneViewportLatched((prev) => latchPhoneWidthForMobileCamera(width, prev));
        });
    }, [width]);
    const isPhoneViewport = phoneViewportLatched;
    const compactTouchChrome = isPhoneViewport || isNarrowShortLandscapeForMenuStack(width, height);
    const [viewportResetToken, setViewportResetToken] = useState(0);
    const [gauntletNowMs, setGauntletNowMs] = useState(() => Date.now());
    const [rulesHintsExpanded, setRulesHintsExpanded] = useState(false);
    const [abandonRunConfirmOpen, setAbandonRunConfirmOpen] = useState(false);
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    useEffect(() => {
        if (run.gauntletDeadlineMs === null) {
            return;
        }
        const tick = (): void => {
            setGauntletNowMs(Date.now());
        };
        tick();
        const id = window.setInterval(tick, 300);
        return () => window.clearInterval(id);
    }, [run.gauntletDeadlineMs]);
    useEffect(() => {
        if (!compactTouchChrome) {
            return;
        }
        const id = window.setTimeout(() => {
            setRulesHintsExpanded(false);
        }, 0);
        return () => window.clearTimeout(id);
    }, [compactTouchChrome]);
    const gameScreenActions = useAppStore(
        useShallow((state) => ({
            applyFlashPairPower: state.applyFlashPairPower,
            acceptEndlessRiskWager: state.acceptEndlessRiskWager,
            activateDungeonExitFromPrompt: state.activateDungeonExitFromPrompt,
            chooseRouteAndContinue: state.chooseRouteAndContinue,
            closeDungeonExitPrompt: state.closeDungeonExitPrompt,
            continueToNextLevel: state.continueToNextLevel,
            dismissPowersFtue: state.dismissPowersFtue,
            goToMenu: state.goToMenu,
            applyRelicOfferService: state.applyRelicOfferService,
            openCodexFromPlaying: state.openCodexFromPlaying,
            openInventoryFromPlaying: state.openInventoryFromPlaying,
            openShopFromLevelComplete: state.openShopFromLevelComplete,
            openSettings: state.openSettings,
            notifyMemorizeBoardReady: state.notifyMemorizeBoardReady,
            pause: state.pause,
            pickRelic: state.pickRelic,
            resume: state.resume,
            shuffleBoard: state.shuffleBoard,
            shuffleRegionRow: state.shuffleRegionRow,
            toggleBoardPinMode: state.toggleBoardPinMode,
            toggleDestroyPairArmed: state.toggleDestroyPairArmed,
            togglePeekMode: state.togglePeekMode,
            toggleTileSwapArmed: state.toggleTileSwapArmed,
            toggleStrayArm: state.toggleStrayArm,
            triggerDebugReveal: state.triggerDebugReveal,
            undoResolvingFlip: state.undoResolvingFlip
        }))
    );
    const dungeonExitPromptOpen = useAppStore((state) => state.dungeonExitPromptOpen);
    const saveData = useAppStore((state) => state.saveData);
    const {
        boardBloomEnabled: settingsBoardBloomEnabled,
        boardPresentation: settingsBoardPresentation,
        boardScreenSpaceAA: settingsBoardScreenSpaceAA,
        cameraViewportModePreference: settingsCameraViewportModePreference,
        distractionChannelEnabled: settingsDistractionChannelEnabled,
        graphicsQuality: settingsGraphicsQuality,
        pairProximityHintsEnabled: settingsPairProximityHintsEnabled,
        tileFocusAssist: settingsTileFocusAssist,
        debugAllowBoardReveal: debugAllowBoardReveal,
        debugDisableAchievementsOnDebug: debugDisableAchievementsOnDebug,
        debugShowDebugTools: debugShowDebugTools
    } = useGameScreenBoardVisualSettings();
    const showTutorialPairMarkers = useMemo(
        () =>
            Boolean(
                run.board &&
                    !saveData.powersFtueSeen &&
                    run.board.level <= TUTORIAL_PAIR_MARKER_MAX_LEVEL
            ),
        [run.board, saveData.powersFtueSeen]
    );
    const onboardingStep = getPlayableOnboardingStep(run, saveData);
    const onboardingBoardTargetIds = useMemo(() => onboardingStep?.targetTileIds ?? [], [onboardingStep]);
    const onboardingPromptSignals = onboardingStep ? getOnboardingPromptSignals(onboardingStep.id) : [];
    const firstRunRoomGoalSignals = getOnboardingPromptSignals('room_goal');
    const onboardingPromptSignalsLabel = formatGameplaySignalRowsLabel(
        'Onboarding action and reward signals',
        onboardingPromptSignals
    );
    const firstRunRoomGoalSignalsLabel = formatGameplaySignalRowsLabel(
        'Room goal reward signals',
        firstRunRoomGoalSignals
    );
    const firstRunRoomGoalPrompt =
        !saveData.onboardingDismissed &&
        !onboardingStep &&
        run.status === 'playing' &&
        run.board &&
        run.board.level === 1 &&
        run.board.matchedPairs >= 2 &&
        run.board.matchedPairs < run.board.pairCount
            ? {
                  title: 'Room goal',
                  prompt: 'Clear the remaining pairs',
                  detail: 'Each clean pair moves the room toward its exit. Clearing the floor opens the first route choice.'
              }
            : null;
    const rulesHintNudge =
        onboardingStep?.prompt ??
        (showTutorialPairMarkers
            ? 'First run: match identical symbols. Pair markers fade after floor 2.'
            : run.activeMutators.length > 0 && run.board?.matchedPairs === 0
              ? `New pressure: ${run.activeMutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id).join(', ')}.`
              : null);
    const { boardPinMode, destroyPairArmed, peekModeArmed, strayRemoveArmed, tileSwapArmed, tileSwapFirstTileId } = useAppStore(
        useShallow((state) => ({
            boardPinMode: state.boardPinMode,
            destroyPairArmed: state.destroyPairArmed,
            peekModeArmed: state.peekModeArmed,
            strayRemoveArmed: state.strayRemoveArmed,
            tileSwapArmed: state.tileSwapArmed,
            tileSwapFirstTileId: state.tileSwapFirstTileId
        }))
    );
    const { persistenceWriteNotice, clearPersistenceWriteNotice } = useAppStore(
        useShallow((state) => ({
            persistenceWriteNotice: state.persistenceWriteNotice,
            clearPersistenceWriteNotice: state.clearPersistenceWriteNotice
        }))
    );
    const settingsReduceMotion = useAppStore((state) => state.settings.reduceMotion);
    const reduceMotion = useEffectiveReducedMotion(settingsReduceMotion);

    const { matchScorePop, mismatchScorePop, dismissMatchScorePop, dismissMismatchScorePop } = useAppStore(
        useShallow((state) => ({
            matchScorePop: state.matchScorePop,
            mismatchScorePop: state.mismatchScorePop,
            dismissMatchScorePop: state.dismissMatchScorePop,
            dismissMismatchScorePop: state.dismissMismatchScorePop
        }))
    );

    const boardFloaterPayload = useMemo(
        () =>
            matchScorePop
                ? ({ kind: 'match' as const, ...matchScorePop })
                : mismatchScorePop
                  ? ({ kind: 'miss' as const, ...mismatchScorePop })
                  : null,
        [matchScorePop, mismatchScorePop]
    );
    const boardFloaterDurationMs = matchScoreFloatDurationMs(reduceMotion, boardFloaterPayload);
    const boardFloaterMatchPayoffChips = useMemo(
        () => (boardFloaterPayload?.kind === 'match' ? matchPayoffChips(boardFloaterPayload.payoffChips) : []),
        [boardFloaterPayload]
    );
    const boardFloaterMatchPayoffLaneMap = useMemo(
        () => (boardFloaterPayload?.kind === 'match' ? matchPayoffLaneMap(boardFloaterPayload.payoffLaneMap) : []),
        [boardFloaterPayload]
    );
    const boardFloaterMatchChainRewardForecastCues = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? matchChainRewardForecastCues(boardFloaterPayload.chainRewardForecastCues)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterMatchPayoffLadder = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match' && boardFloaterPayload.payoffLadder
                ? {
                      ...boardFloaterPayload.payoffLadder,
                      lanes: matchPayoffLadderLanes(boardFloaterPayload.payoffLadder.lanes)
                  }
                : null,
        [boardFloaterPayload]
    );
    const boardFloaterMatchTraitInteractionTexts = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? matchTraitInteractionTexts(boardFloaterPayload.traitInteractionTexts)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterMismatchTraitInteractionTexts = useMemo(
        () =>
            boardFloaterPayload?.kind === 'miss'
                ? matchTraitInteractionTexts(boardFloaterPayload.traitInteractionTexts)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterDetailLines = useMemo(() => {
        if (!boardFloaterPayload) {
            return [];
        }
        if (boardFloaterPayload.kind === 'match') {
            return [
                boardFloaterPayload.pickupRewardText,
                boardFloaterPayload.chainRewardText,
                ...boardFloaterMatchTraitInteractionTexts
            ].filter((line): line is string => Boolean(line));
        }
        return boardFloaterMismatchTraitInteractionTexts;
    }, [boardFloaterMatchTraitInteractionTexts, boardFloaterMismatchTraitInteractionTexts, boardFloaterPayload]);
    const boardFloaterTraitLaneMap = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? buildTraitInteractionLaneMap(boardFloaterMatchTraitInteractionTexts)
                : [],
        [boardFloaterMatchTraitInteractionTexts, boardFloaterPayload]
    );
    const boardFloaterTraitLaneMapAttr = traitInteractionLaneMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterTraitLaneActionMapAttr = traitInteractionLaneActionMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterPrimaryTraitLane = boardFloaterTraitLaneMap[0] ?? null;
    const boardFloaterTraitLaneMapSummaryFill = Math.min(100, (boardFloaterTraitLaneMap.length / 5) * 100);
    const boardFloaterPrimaryTraitLaneFill = boardFloaterPrimaryTraitLane
        ? Math.min(100, (getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane) / 4) * 100)
        : 0;
    const boardFloaterChainCue =
        boardFloaterPayload?.kind === 'match' ? matchScoreFloaterChainCue(boardFloaterPayload.chainDepth) : '';
    const boardFloaterMismatchSignal =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterSignal(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecovery =
        boardFloaterPayload?.kind === 'miss' ? mismatchFloaterRecoveryHint(boardFloaterDetailLines) : null;
    const boardFloaterMismatchRecoveryCrescendo =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryCrescendo(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryCrescendoLabel = boardFloaterMismatchRecoveryCrescendo
        ? mismatchFloaterRecoveryCrescendoLabel('Mismatch recovery crescendo', boardFloaterMismatchRecoveryCrescendo)
        : '';
    const boardFloaterLiveText = useMemo(() => {
        if (!boardFloaterPayload) {
            return '';
        }
        if (boardFloaterPayload.kind === 'match') {
            return matchScoreFloaterLiveRegionText(
                boardFloaterPayload.amount,
                boardFloaterDetailLines,
                boardFloaterPayload.feedbackHeadline,
                boardFloaterPayload.chainDepth,
                boardFloaterMatchChainRewardForecastCues.map(
                    (cue) =>
                        `${getChainRewardLaneAction(cue.urgency)}: ${getChainRewardUrgencyCopy(cue)}: ${cue.distanceLabel} to ${cue.label}`
                ),
                boardFloaterPayload.rewardBurst
                    ? `${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`
                    : undefined,
                boardFloaterPayload.cascadeCue
                    ? `${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`
                    : undefined,
                boardFloaterPayload.payoffSummary
                    ? `${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`
                    : undefined,
                boardFloaterMatchPayoffLadder
                    ? `${boardFloaterPayload.impactCue.label}. First: ${boardFloaterMatchPayoffLadder.first}. Then: ${boardFloaterMatchPayoffLadder.then}. Keep: ${boardFloaterMatchPayoffLadder.keep}${
                          boardFloaterMatchPayoffLadder.lanes.length > 0
                              ? `. Lanes: ${boardFloaterMatchPayoffLadder.lanes.join(' to ')}`
                              : ''
                      }`
                    : boardFloaterPayload.impactCue.label,
                matchPayoffLaneMapLabel(boardFloaterMatchPayoffLaneMap),
                boardFloaterTraitLaneMap.length > 0
                    ? formatTraitInteractionLaneMapLabel('Match trait interaction lanes', boardFloaterTraitLaneMap)
                    : undefined,
                boardFloaterPayload.crescendo
                    ? `${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}`
                    : undefined,
                boardFloaterPayload.chainMilestone
                    ? `${boardFloaterPayload.chainMilestone.action}: ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}: ${boardFloaterPayload.chainMilestone.value}. ${boardFloaterPayload.chainMilestone.beatCount} beats.`
                    : undefined
            );
        }
        const mismatchContext = {
            brokenChainDepth: boardFloaterPayload.brokenChainDepth,
            brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
        };
        return mismatchFloaterLiveRegionText(
            boardFloaterDetailLines,
            boardFloaterMismatchRecovery,
            mismatchContext,
            mismatchRecoveryLaneMapLabel(
                mismatchFloaterRecoveryLaneMap(mismatchFloaterRecoveryChips(boardFloaterDetailLines, mismatchContext))
            ),
            boardFloaterMismatchRecoveryCrescendo
                ? `${boardFloaterMismatchRecoveryCrescendo.label}: ${boardFloaterMismatchRecoveryCrescendo.detail}`
                : undefined
        );
    }, [
        boardFloaterDetailLines,
        boardFloaterMatchChainRewardForecastCues,
        boardFloaterMatchPayoffLadder,
        boardFloaterMatchPayoffLaneMap,
        boardFloaterMismatchRecovery,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterPayload,
        boardFloaterTraitLaneMap
    ]);
    const boardFloaterMismatchRecoveryBurst =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryBurst(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryBurstFill = boardFloaterMismatchRecoveryCrescendo
        ? Math.min(100, (boardFloaterMismatchRecoveryCrescendo.beatCount / 5) * 100)
        : boardFloaterMismatchRecoveryBurst?.tier === 'break'
          ? 100
          : boardFloaterMismatchRecoveryBurst?.tier === 'risk'
            ? 75
            : boardFloaterMismatchRecoveryBurst?.tier === 'lost-reward'
              ? 90
              : 0;
    const boardFloaterMismatchNextAction =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterNextAction(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryChips =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryChips(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : [];
    const boardFloaterMismatchRecoveryLaneMap =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryLaneMap(boardFloaterMismatchRecoveryChips)
            : null;
    const boardFloaterPrimaryMismatchRecoveryLane = getPrimaryMismatchRecoveryLane(boardFloaterMismatchRecoveryLaneMap);
    const boardFloaterMismatchRecoveryLaneMapFill = Math.min(
        100,
        ((boardFloaterMismatchRecoveryLaneMap?.length ?? 0) / 4) * 100
    );
    const boardFloaterPrimaryMismatchRecoveryLaneFill = boardFloaterPrimaryMismatchRecoveryLane
        ? Math.min(100, (getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane) / 4) * 100)
        : 0;
    const boardFloaterMismatchRecoveryStack =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryStack(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoverySequence =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoverySequence(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardRecoveryContext =
        boardFloaterPayload?.kind === 'miss' && boardFloaterMismatchNextAction
            ? {
                  action:
                      boardFloaterMismatchNextAction.tone === 'lost-reward'
                          ? 'Save'
                          : boardFloaterMismatchNextAction.tone === 'risk'
                            ? 'Stabilize'
                            : 'Recover',
                  detail:
                      boardFloaterMismatchRecoveryStack?.detail ??
                      boardFloaterMismatchRecovery ??
                      boardFloaterMismatchNextAction.value,
                  impactCue: boardFloaterMismatchNextAction.arcadeCue,
                  tone: boardFloaterMismatchNextAction.tone,
                  value: boardFloaterMismatchNextAction.value
              }
            : null;
    const boardMatchPayoffStackCue =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.payoffSummary
            ? {
                  label: boardFloaterPayload.payoffSummary.label,
                  value: boardFloaterPayload.payoffSummary.value,
                  tone: boardFloaterPayload.payoffSummary.tier,
                  laneCount: actualMatchPayoffLaneCount(
                      boardFloaterPayload.payoffSummary,
                      boardFloaterMatchPayoffChips
                  ),
                  firstCue: boardFloaterMatchPayoffChips[0]?.arcadeCue ?? boardFloaterPayload.impactCue.label,
                  sequenceFirstCue:
                      boardFloaterMatchPayoffChips.find((chip) => chip.id !== 'score')?.arcadeCue ??
                      boardFloaterPayload.impactCue.label,
                  nextCue:
                      boardFloaterMatchPayoffChips.find((chip) => chip.id === 'next')?.arcadeCue ??
                      boardFloaterPayload.rewardBurst?.value ??
                      null,
                  sequenceKeepCue:
                      boardFloaterMatchChainRewardForecastCues[0]?.chaseLabel ??
                      boardFloaterMatchPayoffChips.find((chip) => chip.id === 'next')?.value ??
                      'Chase next safe match'
              }
            : null;
    const boardMatchPayoffStackFill = boardMatchPayoffStackCue
        ? Math.round(Math.min(100, (getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) / 5) * 100))
        : 0;
    const boardFloaterJackpotCue =
        boardFloaterPayload?.kind === 'match' ? getMatchFloaterJackpotCue(boardFloaterPayload) : null;
    const boardFloaterPrimaryPayoffLane =
        boardFloaterPayload?.kind === 'match' ? boardFloaterMatchPayoffLaneMap[0] ?? null : null;
    const boardFloaterChainMilestoneFill =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.chainMilestone
            ? Math.round(
                  Math.min(
                      100,
                      (getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone) / 5) * 100
                  )
              )
            : 0;
    const boardFloaterRewardBurstFill =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.rewardBurst
            ? Math.round(Math.min(100, (getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst) / 5) * 100))
            : 0;

    const [boardFloaterPos, setBoardFloaterPos] = useState<{ x: number; y: number } | null>(null);

    useLayoutEffect(() => {
        if (!boardFloaterPayload) {
            /* Floater teardown must track payload removal synchronously before paint (tests + hit-testing). */
            // eslint-disable-next-line react-hooks/set-state-in-effect -- layout sync in useLayoutEffect
            setBoardFloaterPos(null);
            return;
        }

        const stageEl = boardStageRef.current;

        if (!stageEl) {
            return;
        }

        const stageRect = stageEl.getBoundingClientRect();
        const handle = tileBoardRef.current;
        const ra = handle?.getTileClientRectById?.(boardFloaterPayload.tileIdA) ?? null;
        const rb = handle?.getTileClientRectById?.(boardFloaterPayload.tileIdB) ?? null;
        const rc =
            boardFloaterPayload.kind === 'miss' && boardFloaterPayload.tileIdC
                ? handle?.getTileClientRectById?.(boardFloaterPayload.tileIdC) ?? null
                : null;

        let cx = stageRect.width / 2;
        let cy = stageRect.height / 2;

        if (ra && rb && rc) {
            const ax = ra.left + ra.width / 2 - stageRect.left;
            const ay = ra.top + ra.height / 2 - stageRect.top;
            const bx = rb.left + rb.width / 2 - stageRect.left;
            const by = rb.top + rb.height / 2 - stageRect.top;
            const cx3 = rc.left + rc.width / 2 - stageRect.left;
            const cy3 = rc.top + rc.height / 2 - stageRect.top;
            cx = (ax + bx + cx3) / 3;
            cy = (ay + by + cy3) / 3;
        } else if (ra && rb) {
            const ax = ra.left + ra.width / 2 - stageRect.left;
            const ay = ra.top + ra.height / 2 - stageRect.top;
            const bx = rb.left + rb.width / 2 - stageRect.left;
            const by = rb.top + rb.height / 2 - stageRect.top;
            cx = (ax + bx) / 2;
            cy = (ay + by) / 2;
        }

        setBoardFloaterPos({ x: cx, y: cy });
    }, [boardFloaterPayload]);

    useEffect(() => {
        if (!boardFloaterPayload || !boardFloaterPos) {
            return;
        }

        const el = boardFloaterRef.current;

        if (!el) {
            return;
        }

        let settled = false;

        const dismiss =
            boardFloaterPayload.kind === 'match' ? dismissMatchScorePop : dismissMismatchScorePop;

        const finish = (): void => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(fallbackId);
            dismiss();
        };

        el.addEventListener('animationend', finish, { once: true });
        /** DOM `setTimeout` id (number); avoids Node `Timeout` typing clashes in `tsc`. */
        const fallbackId = window.setTimeout(finish, boardFloaterDurationMs + MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS);

        return () => {
            el.removeEventListener('animationend', finish);
            window.clearTimeout(fallbackId);
        };
    }, [
        boardFloaterPayload,
        boardFloaterPos,
        boardFloaterDurationMs,
        dismissMatchScorePop,
        dismissMismatchScorePop
    ]);
    const settingsMasterVolume = useAppStore((state) => state.settings.masterVolume);
    const settingsSfxVolume = useAppStore((state) => state.settings.sfxVolume);
    const shuffleSfxGain = useMemo(
        () => sfxGainFromSettings(settingsMasterVolume, settingsSfxVolume),
        [settingsMasterVolume, settingsSfxVolume]
    );
    const uiGain = useMemo(
        () => uiSfxGainFromSettings(settingsMasterVolume, settingsSfxVolume),
        [settingsMasterVolume, settingsSfxVolume]
    );
    useEffect(() => {
        if (boardFloaterPayload?.kind !== 'miss' || !boardFloaterMismatchRecoveryCrescendo) {
            mismatchRecoveryCrescendoSfxSignatureRef.current = null;
            return;
        }
        const signature = [
            boardFloaterPayload.key,
            boardFloaterMismatchRecoveryCrescendo.tier,
            boardFloaterMismatchRecoveryCrescendo.beatCount
        ].join(':');
        if (mismatchRecoveryCrescendoSfxSignatureRef.current === signature) {
            return;
        }
        mismatchRecoveryCrescendoSfxSignatureRef.current = signature;
        void resumeAudioContext();
        playMismatchRecoveryCrescendoSfx(
            shuffleSfxGain,
            boardFloaterMismatchRecoveryCrescendo.tier,
            boardFloaterMismatchRecoveryCrescendo.beatCount
        );
    }, [boardFloaterMismatchRecoveryCrescendo, boardFloaterPayload, shuffleSfxGain]);
    const seenAchievementToastIdsRef = useRef<Set<string>>(new Set());
    const pickupToastEventRef = useRef<{
        runSeed: number;
        eventId: string | null;
    } | null>(null);
    /** OVR-014: queue unlock toasts while the floor-cleared dialog is up; `continueToNextLevel` clears `newlyUnlockedAchievements` before the next paint. */
    const pendingAchievementToastIdsRef = useRef<AchievementId[]>([]);
    /** FX-015: WebGL bloom is medium+ when the toggle is on; add a light CSS rim only on High to avoid doubling cost on phones at Medium. */
    const boardStageCssBloomClass =
        settingsBoardBloomEnabled && settingsGraphicsQuality === 'high' ? styles.boardStageCssBloom : '';
    const toolbarDebugFlags = useMemo(
        (): Settings['debugFlags'] => ({
            allowBoardReveal: debugAllowBoardReveal,
            disableAchievementsOnDebug: debugDisableAchievementsOnDebug,
            showDebugTools: debugShowDebugTools
        }),
        [debugAllowBoardReveal, debugDisableAchievementsOnDebug, debugShowDebugTools]
    );
    const {
        applyFlashPairPower,
        acceptEndlessRiskWager,
        activateDungeonExitFromPrompt,
        chooseRouteAndContinue,
        closeDungeonExitPrompt,
        continueToNextLevel,
        dismissPowersFtue,
        goToMenu,
        openCodexFromPlaying,
        openInventoryFromPlaying,
        openShopFromLevelComplete,
        openSettings,
        pause,
        applyRelicOfferService,
        pickRelic,
        resume,
        shuffleBoard,
        shuffleRegionRow,
        toggleBoardPinMode,
        toggleDestroyPairArmed,
        togglePeekMode,
        toggleTileSwapArmed,
        toggleStrayArm,
        triggerDebugReveal,
        undoResolvingFlip
    } = gameScreenActions;

    const relicDraftProgressText = run.relicOffer ? relicDraftProgressLine(run.relicOffer) : null;
    const relicBonusFootnoteLines = run.relicOffer ? buildRelicDraftBonusFootnoteLines(run) : [];
    const relicDraftPayoffEngineSignal = run.relicOffer ? getInventoryPayoffEngineSignal(run) : null;
    const gameplayEventJournal = run.gameplayEventJournal;
    const typedGameplayFeedbackBatch = useMemo(
        () => getLatestGameplayFeedbackBatch({ gameplayEventJournal }),
        [gameplayEventJournal]
    );
    const typedBoardTurnEvent = useMemo(
        () => getLatestBoardTurnResolvedEvent({ gameplayEventJournal }),
        [gameplayEventJournal]
    );
    const previousRelicOfferOpenEventIdRef = useRef<string | null>(null);
    const previousCountdownPressureSecondRef = useRef<number | null>(null);
    const announcedTraitRouteSetupKeyRef = useRef<string | null>(null);
    const playMenuOpen = useCallback((): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    }, [uiGain]);
    const playUiBack = useCallback((): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    }, [uiGain]);
    const playUiClick = useCallback((): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    }, [uiGain]);

    const handleToolbarViewportReset = useCallback((): void => {
        setViewportResetToken((current) => current + 1);
    }, []);

    const openSettingsPlayingMode = useCallback((): void => {
        openSettings('playing');
    }, [openSettings]);

    const canRegionShuffleRowForRun = useCallback(
        (row: number): boolean => canRegionShuffleRow(run, row),
        [run]
    );

    const handleRequestAbandonRun = useCallback((): void => {
        playMenuOpen();
        setAbandonRunConfirmOpen(true);
    }, [playMenuOpen]);
    const pauseShortcutStateRef = useLatestRef({
        abandonRunConfirmOpen,
        lastLevelResult: run.lastLevelResult,
        pause,
        relicOffer: run.relicOffer,
        resume,
        runStatus: run.status,
        shortcutsHelpOpen
    });
    const shortcutsHelpStateRef = useLatestRef({
        playMenuOpen,
        playUiBack,
        shortcutsHelpOpen
    });

    useEffect(() => {
        const relicOfferOpenFeedback = typedGameplayFeedbackBatch.find(
            (feedback) => feedback.audioCategory === 'relic-offer'
        );
        if (
            !run.relicOffer ||
            !relicOfferOpenFeedback ||
            relicOfferOpenFeedback.eventId === previousRelicOfferOpenEventIdRef.current
        ) {
            return;
        }
        previousRelicOfferOpenEventIdRef.current = relicOfferOpenFeedback.eventId;
        void resumeAudioContext();
        playRelicOfferOpenSfx(shuffleSfxGain);
    }, [run.relicOffer, shuffleSfxGain, typedGameplayFeedbackBatch]);

    /** Pause / resume: toolbar control removed — **P** toggles pause when gameplay is active (not when meta overlays suppress status). */
    useEffect(() => {
        if (suppressStatusOverlays) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.repeat) {
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            if (event.code !== 'KeyP') {
                return;
            }
            const target = event.target;
            if (target instanceof HTMLElement) {
                if (target.closest('input, textarea, select') || target.isContentEditable) {
                    return;
                }
            }
            const state = pauseShortcutStateRef.current;
            if (state.shortcutsHelpOpen) {
                return;
            }
            if (state.abandonRunConfirmOpen) {
                return;
            }
            if (state.relicOffer) {
                return;
            }
            if (state.runStatus === 'levelComplete' && state.lastLevelResult && !state.relicOffer) {
                return;
            }
            if (state.runStatus === 'paused') {
                event.preventDefault();
                state.resume();
                return;
            }
            if (state.runStatus === 'playing' || state.runStatus === 'memorize' || state.runStatus === 'resolving') {
                event.preventDefault();
                state.pause();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [pauseShortcutStateRef, suppressStatusOverlays]);

    /** ? / F1: shortcuts overlay; Escape closes (REF-096). */
    useEffect(() => {
        if (suppressStatusOverlays) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.repeat) {
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const target = event.target;
            if (target instanceof HTMLElement) {
                if (target.closest('input, textarea, select') || target.isContentEditable) {
                    return;
                }
            }
            const state = shortcutsHelpStateRef.current;
            if (event.key === 'Escape' && state.shortcutsHelpOpen) {
                event.preventDefault();
                state.playUiBack();
                setShortcutsHelpOpen(false);
                return;
            }
            if (state.shortcutsHelpOpen) {
                return;
            }
            if (event.code === 'F1' || event.key === '?') {
                event.preventDefault();
                state.playMenuOpen();
                setShortcutsHelpOpen(true);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [shortcutsHelpStateRef, suppressStatusOverlays]);

    useEffect(() => {
        const floorClearedModalBlocksToasts =
            !suppressStatusOverlays &&
            !abandonRunConfirmOpen &&
            run.status === 'levelComplete' &&
            Boolean(run.lastLevelResult) &&
            !run.relicOffer;

        const enqueuePending = (ids: AchievementId[]): void => {
            for (const achievementId of ids) {
                if (!pendingAchievementToastIdsRef.current.includes(achievementId)) {
                    pendingAchievementToastIdsRef.current.push(achievementId);
                }
            }
        };

        const emitAchievementToasts = (ids: AchievementId[]): void => {
            if (ids.length === 0) {
                return;
            }
            const infoDuration = reduceMotion ? 3500 : 5500;
            const { showAchievement } = useNotificationStore.getState();
            for (const achievementId of ids) {
                if (seenAchievementToastIdsRef.current.has(achievementId)) {
                    continue;
                }
                seenAchievementToastIdsRef.current.add(achievementId);
                const def = ACHIEVEMENTS.find((item) => item.id === achievementId);
                if (def) {
                    showAchievement(`${def.title} — ${def.description}`, infoDuration, {
                        stackKey: `achievement:${achievementId}`
                    });
                }
            }
        };

        if (floorClearedModalBlocksToasts) {
            if (achievements.length > 0) {
                enqueuePending(achievements);
            }
            return;
        }

        const combined: AchievementId[] = [...pendingAchievementToastIdsRef.current];
        pendingAchievementToastIdsRef.current = [];
        for (const achievementId of achievements) {
            if (!combined.includes(achievementId)) {
                combined.push(achievementId);
            }
        }
        emitAchievementToasts(combined);
    }, [
        abandonRunConfirmOpen,
        achievements,
        run.lastLevelResult,
        run.relicOffer,
        run.status,
        reduceMotion,
        suppressStatusOverlays
    ]);

    useEffect(() => {
        const previousEvent = pickupToastEventRef.current;
        if (!previousEvent || previousEvent.runSeed !== run.runSeed) {
            pickupToastEventRef.current = {
                runSeed: run.runSeed,
                eventId: typedBoardTurnEvent?.eventId ?? null
            };
            return;
        }
        if (!typedBoardTurnEvent || typedBoardTurnEvent.eventId === previousEvent.eventId) {
            return;
        }

        pickupToastEventRef.current = {
            runSeed: run.runSeed,
            eventId: typedBoardTurnEvent.eventId
        };
        if (
            !run.board ||
            typedBoardTurnEvent.boardLevel !== run.board.level ||
            typedBoardTurnEvent.matchedFindableKind == null
        ) {
            return;
        }

        const pickupToastText = getPickupStackToastText(typedBoardTurnEvent);
        if (pickupToastText == null) {
            return;
        }

        const { showInfo } = useNotificationStore.getState();
        const infoDuration = reduceMotion ? 2200 : 3200;
        showInfo(
            pickupToastText,
            infoDuration,
            { stackKey: `pickup:${typedBoardTurnEvent.eventId}` }
        );
    }, [
        run.board,
        run.runSeed,
        reduceMotion,
        typedBoardTurnEvent
    ]);

    /** Persist `powersFtueSeen` once the player leaves tutorial floors (pair markers no longer needed). */
    useEffect(() => {
        const level = run.board?.level;
        if (level !== undefined && level > TUTORIAL_PAIR_MARKER_MAX_LEVEL && !saveData.powersFtueSeen) {
            runPersistenceInBackground(dismissPowersFtue);
        }
    }, [dismissPowersFtue, run.board?.level, saveData.powersFtueSeen]);

    const distractionHudOn =
        run.activeMutators.includes('distraction_channel') &&
        settingsDistractionChannelEnabled &&
        !reduceMotion &&
        run.status === 'playing';
    const distractionTick = useDistractionChannelTick(distractionHudOn);
    const { tiltRef: gameFieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: shellRef,
        strength: 1
    });
    const focusDimmedTileIds = useMemo(() => {
        const dimmed = computeFocusDimmedTileIds(run.board, run.status, settingsTileFocusAssist) ?? new Set<string>();
        if (
            onboardingBoardTargetIds.length === 0 ||
            !run.board ||
            (run.status !== 'playing' && run.status !== 'memorize')
        ) {
            return dimmed;
        }
        const targetSet = new Set(onboardingBoardTargetIds);
        const guidedDimmed = run.board.tiles.map((tile) => tile.id).filter((tileId) => !targetSet.has(tileId));
        return new Set([...dimmed, ...guidedDimmed]);
    }, [onboardingBoardTargetIds, run.board, run.status, settingsTileFocusAssist]);
    const stickyBlockedTileId = useMemo((): string | null => {
        const board = run.board;
        if (!board || run.status !== 'playing') {
            return null;
        }
        return getStickyBlockedTileId({
            activeMutators: run.activeMutators,
            flippedTileIds: board.flippedTileIds,
            stickyBlockIndex: run.stickyBlockIndex,
            tiles: board.tiles
        });
    }, [run.activeMutators, run.board, run.status, run.stickyBlockIndex]);
    const mergedPeekTileIds = useMemo(() => {
        const merged = new Set<string>([...run.peekRevealedTileIds, ...run.flashPairRevealedTileIds]);
        return [...merged];
    }, [run.peekRevealedTileIds, run.flashPairRevealedTileIds]);
    const allowGambitThirdFlip = run.gambitAvailableThisFloor && !run.gambitThirdFlipUsed;
    const gambitThirdPickActive =
        run.status === 'resolving' &&
        allowGambitThirdFlip &&
        (run.board?.flippedTileIds.length ?? 0) === 2;
    const wideRecallInPlay = run.activeMutators.includes('wide_recall');
    const silhouetteDuringPlay = run.activeMutators.includes('silhouette_twist');
    const nBackMutatorActive = run.activeMutators.includes('n_back_anchor');
    const viewportWantsMobileCamera = compactTouchChrome;
    const cameraViewportMode = deriveCameraViewportMode(settingsCameraViewportModePreference, viewportWantsMobileCamera);
    const clearLifeBonusLabel = run.lastLevelResult ? getClearLifeBonusLabel(run.lastLevelResult) : null;
    const objectiveBonusLine =
        run.lastLevelResult && runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore) > 0
            ? `Objective bonuses: +${runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore).toLocaleString()}`
            : null;
    const bonusTagsLine = run.lastLevelResult ? formatBonusTagsLine(run.lastLevelResult.bonusTags) : null;
    const traitRouteObjectiveLine =
        run.lastLevelResult?.traitRouteObjectiveRequired != null
            ? run.lastLevelResult.traitRouteObjectiveCompleted
                ? `Trait routes: Complete (${run.lastLevelResult.traitRouteObjectiveReward ?? 'trait route cashout'})`
                : `Trait routes: ${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveProgress)}/${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveRequired)}`
            : null;
    const endlessChapterActive =
        run.gameMode === 'endless' && usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion);
    const currentArchetype = getFloorArchetypeDefinition(run.board?.floorArchetypeId ?? null);
    const currentFeaturedObjectiveLabel = getFeaturedObjectiveLabel(run.board?.featuredObjectiveId ?? null);
    const currentFloorIdentity = run.board
        ? getFloorIdentityContract({
              floorTag: run.board.floorTag ?? 'normal',
              floorArchetypeId: run.board.floorArchetypeId,
              mutators: run.activeMutators,
              featuredObjectiveLabel: currentFeaturedObjectiveLabel
          })
        : null;
    const floorClearCausalityRows = run.lastLevelResult
        ? getFloorClearCausalityRows(run.lastLevelResult, run.powersUsedThisRun, currentFloorIdentity)
        : [];
    const favorGained = runNonNegativeInteger(run.lastLevelResult?.relicFavorGained);
    const favorBankedPickCount = countFavorBonusPicksBanked(run.relicFavorProgress, favorGained);
    const floorClearMomentumRows = run.lastLevelResult
        ? [
              {
                  id: 'score',
                  label: 'Score pop',
                  value: `+${runNonNegativeInteger(run.lastLevelResult.scoreGained).toLocaleString()}`
              },
              {
                  id: 'rating',
                  label: 'Rating',
                  value: run.lastLevelResult.rating
              },
              runNonNegativeInteger(run.stats.bestStreak) > 0
                  ? {
                        id: 'streak',
                        label: 'Best chain',
                        value: `x${runNonNegativeInteger(run.stats.bestStreak)}`
                    }
                  : null,
              runNonNegativeInteger(run.findablesTotalThisFloor) > 0
                  ? {
                        id: 'pickups',
                        label: 'Pickups',
                        value: `${runNonNegativeInteger(run.findablesClaimedThisFloor)}/${runNonNegativeInteger(run.findablesTotalThisFloor)}`
                    }
                  : null,
              runNonNegativeInteger(run.stats.comboShards) > 0
                  ? {
                        id: 'shards',
                        label: 'Shards',
                        value: `${runNonNegativeInteger(run.stats.comboShards)}`
                    }
                  : null,
              favorGained > 0
                  ? {
                        id: 'favor',
                        label: 'Favor',
                        value:
                            favorBankedPickCount > 0
                                ? `+${favorGained} pick banked`
                                : `+${favorGained} -> ${run.relicFavorProgress}/3`
                    }
                  : null
          ].filter((row): row is { id: string; label: string; value: string } => row != null)
        : [];
    const floorClearMomentumRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear momentum signals',
        floorClearMomentumRows
    );
    const floorClearCashoutRows = getFloorClearCashoutRows(run);
    const floorClearCashoutRowsLabel = formatGameplayDetailRowsLabel(
        'Floor clear cashout read',
        floorClearCashoutRows
    );
    const floorClearCarryForwardCue = getFloorClearCarryForwardCue(run, favorBankedPickCount);
    const floorClearObjectiveSignalRows = run.lastLevelResult
        ? [
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'featured-objective',
                        label: run.lastLevelResult.featuredObjectiveCompleted ? 'Objective paid' : 'Objective missed',
                        value: run.lastLevelResult.featuredObjectiveCompleted
                            ? `+${runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore).toLocaleString()} score`
                            : 'Payout lost',
                        tone: run.lastLevelResult.featuredObjectiveCompleted ? 'reward' : 'risk'
                    }
                  : null,
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'objective-streak',
                        label: 'Objective streak',
                        value: `x${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak)}${
                            runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus) > 0
                                ? ` +${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus).toLocaleString()}`
                                : ''
                        }`,
                        tone: runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak) > 1 ? 'momentum' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.traitRouteObjectiveRequired != null
                  ? {
                        id: 'trait-route-objective',
                        label: run.lastLevelResult.traitRouteObjectiveCompleted ? 'Trait route paid' : 'Trait route',
                        value: run.lastLevelResult.traitRouteObjectiveCompleted
                            ? run.lastLevelResult.traitRouteObjectiveReward ?? 'Trait route cashout'
                            : `${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveProgress)}/${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveRequired)}`,
                        tone: run.lastLevelResult.traitRouteObjectiveCompleted ? 'trait' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.endlessRiskWagerOutcome
                  ? {
                        id: 'risk-wager',
                        label:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? 'Wager paid'
                                : 'Wager lost',
                        value:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? `+${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerFavorGained)} Favor`
                                : `-${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerStreakLost)} streak`,
                        tone: run.lastLevelResult.endlessRiskWagerOutcome === 'won' ? 'reward' : 'risk'
                    }
                  : null
          ].filter((row): row is FloorClearObjectiveSignalRow => row != null)
        : [];
    const floorClearObjectiveSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear objective signals',
        floorClearObjectiveSignalRows
    );
    const floorClearPayoffStackSignal = getFloorClearPayoffStackSignal(
        run,
        floorClearCashoutRows,
        floorClearObjectiveSignalRows,
        favorBankedPickCount
    );
    const featuredObjectiveResultLine = run.lastLevelResult ? formatLevelResultObjectiveLine(run.lastLevelResult) : null;
    const featuredObjectiveFailureLine = featuredObjectiveFailReason(run);
    const favorGainLine =
        run.lastLevelResult?.featuredObjectiveId != null ? `Favor gained: +${favorGained}` : null;
    const wagerSuretyActive = run.relicIds.includes('wager_surety');
    const offeredRiskWagerFavor = ENDLESS_RISK_WAGER_BONUS_FAVOR + (wagerSuretyActive ? 1 : 0);
    const endlessRiskWagerOutcomeLine =
        run.lastLevelResult?.endlessRiskWagerOutcome === 'won'
            ? `Risk wager won: +${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerFavorGained)} Favor`
            : run.lastLevelResult?.endlessRiskWagerOutcome === 'lost'
              ? `Risk wager lost: -${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerStreakLost)} streak`
              : null;
    const featuredObjectiveStreakLine =
        run.lastLevelResult?.featuredObjectiveId != null
            ? `Objective streak: x${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak)}${
                  runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus) > 0
                      ? ` (+${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus).toLocaleString()})`
                      : ''
              }`
            : null;
    const favorBankedLine =
        favorBankedPickCount > 0
            ? `Extra relic ${favorBankedPickCount === 1 ? 'pick' : 'picks'} banked for the next shrine`
            : null;
    const firstClearOnboardingLine =
        run.lastLevelResult?.level === 1 && saveData.onboardingDismissed
            ? 'First-run guide complete. Continue when you are ready; deeper help stays available from Codex.'
            : null;
    const endlessRiskWagerOfferAvailable = canOfferEndlessRiskWager(run);
    const acceptedEndlessRiskWager =
        run.lastLevelResult && run.endlessRiskWager?.acceptedOnLevel === run.lastLevelResult.level
            ? run.endlessRiskWager
            : null;
    const visibleRiskWagerSignalRows =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerSignalRows({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : [];
    const riskWagerPrimaryCue =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerPrimaryCue({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : null;
    const riskWagerArmAriaLabel =
        visibleRiskWagerSignalRows.length > 0
            ? `Arm wager. ${visibleRiskWagerSignalRows
                  .map((row) => `${row.label}: ${row.value}`)
                  .join('. ')}. Complete the next featured objective for bonus Favor; miss it and the streak ${
                  wagerSuretyActive ? 'falls to x1' : 'breaks'
              }.`
            : 'Arm wager';
    const riskWagerSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Risk wager decision signals',
        visibleRiskWagerSignalRows
    );
    const routeChoices = useMemo(() => routeChoicesForResult(run.lastLevelResult), [run.lastLevelResult]);
    const routeChoiceRequired = routeChoices.length > 0 && !run.pendingRouteCardPlan;
    const floorClearActionSequenceCue = getFloorClearActionSequenceCue({
        carryForwardCue: floorClearCarryForwardCue,
        cashoutRows: floorClearCashoutRows,
        payoffStackSignal: floorClearPayoffStackSignal,
        routeChoiceRequired,
        run
    });
    const firstRouteChoiceRequired = routeChoiceRequired && run.lastLevelResult?.level === 1;
    const routeChoiceRequiredCopy =
        firstRouteChoiceRequired
            ? 'Choose the next room type. Safe protects the run, Greed trades danger for reward, and Mystery changes the next board.'
            : 'Pick one room to continue. Route choice is the active decision; other floor-clear actions resume after the route is locked.';
    const currentDungeonNode = run.dungeonRun?.nodes.find((node) => node.id === run.dungeonRun.currentNodeId) ?? null;
    const dungeonMapPresentation = getDungeonMapPresentation(run.dungeonRun);
    const dungeonRouteDecisionPresentation =
        routeChoiceRequired
            ? getDungeonRouteDecisionPresentation(run.dungeonRun, routeChoices)
            : null;
    const memoryRecallFeedback = useMemo(() => getMemoryRecallFeedback(run), [run]);
    const routeChoiceMemoryById = useMemo(
        () => new Map(memoryRecallFeedback.choices.map((choice) => [choice.id, choice])),
        [memoryRecallFeedback.choices]
    );
    const routeChoiceRecommendation = useMemo(() => {
        if (!routeChoiceRequired || !dungeonRouteDecisionPresentation) {
            return null;
        }

        const readinessScore = {
            ready: 30,
            risky: 12,
            unsafe: -20
        } as const;

        return dungeonRouteDecisionPresentation.rows
            .map((row, index) => {
                const choice = routeChoices.find((option) => option.id === row.id);
                const availability = choice ? getRouteChoiceAvailability(run, choice) : { available: true as const };
                if (!availability.available) {
                    return null;
                }

                const memoryChoice = routeChoiceMemoryById.get(row.id);
                const signalLabels = getRouteChoiceSignalLabels(row.routeType);
                const payoffRows = getRouteChoicePayoffRows({ memoryChoice, routeType: row.routeType });
                const decisionStack = getRouteChoiceDecisionStack({
                    memoryChoice,
                    payoffRows,
                    routeType: row.routeType,
                    signalLabels
                });
                const actionCue = getRouteChoiceActionCue({
                    decisionStack,
                    memoryChoice,
                    routeType: row.routeType
                });
                const beatCue = getRouteChoiceBeatCue(row.routeType);
                const primaryPayoff = payoffRows[0] ?? null;
                const score =
                    (memoryChoice ? readinessScore[memoryChoice.readiness] : 0) +
                    (firstRouteChoiceRequired && row.routeType === 'safe' ? 4 : 0) -
                    index;

                return {
                    actionCue,
                    beatCue,
                    decisionStack,
                    index,
                    memoryChoice,
                    primaryPayoff,
                    row,
                    score
                };
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
            .sort((a, b) => b.score - a.score || a.index - b.index)[0] ?? null;
    }, [
        dungeonRouteDecisionPresentation,
        firstRouteChoiceRequired,
        routeChoiceMemoryById,
        routeChoiceRequired,
        routeChoices,
        run
    ]);
    const memoryRecallPanelRows = useMemo(
        () =>
            [
                ...memoryRecallFeedback.path,
                ...memoryRecallFeedback.clues,
                ...memoryRecallFeedback.enemies,
                ...memoryRecallFeedback.symbols,
                ...memoryRecallFeedback.penalties,
                ...memoryRecallFeedback.recallPlan,
                ...memoryRecallFeedback.upgrades
            ].slice(0, 6),
        [
            memoryRecallFeedback.path,
            memoryRecallFeedback.clues,
            memoryRecallFeedback.enemies,
            memoryRecallFeedback.symbols,
            memoryRecallFeedback.recallPlan,
            memoryRecallFeedback.penalties,
            memoryRecallFeedback.upgrades
        ]
    );
    const currentDungeonRoom = dungeonMapPresentation.current;
    const visibleDungeonMapNodes = dungeonMapPresentation.nodes.filter(
        (node) => node.status === 'current' || node.status === 'cleared' || node.status === 'revealed' || node.status === 'skipped'
    );
    const pendingRouteCardKind = run.pendingRouteCardPlan
        ? routeCardKindForRouteType(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteLine =
        run.pendingRouteCardPlan && pendingRouteCardKind
            ? `${routeTypeLabel(run.pendingRouteCardPlan.routeType)} selected: ${
                  run.pendingRouteCardPlan.routeType === 'safe'
                      ? 'next floor adds defensive ward support.'
                      : run.pendingRouteCardPlan.routeType === 'greed'
                        ? 'next floor adds richer caches and extra reward-risk pressure.'
                        : 'next floor adds deterministic mystery veils.'
              }`
            : null;
    const pendingRouteSignalLabels = run.pendingRouteCardPlan
        ? getRouteChoiceSignalLabels(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteImpactCue = run.pendingRouteCardPlan
        ? getSelectedRouteImpactCue(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteActionCue = run.pendingRouteCardPlan
        ? getSelectedRouteActionCue(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingDungeonNode = run.pendingRouteCardPlan ? getRepairedSelectedDungeonNode(run.dungeonRun) : null;
    const dungeonExitStatus = getDungeonExitStatus(run);
    const dungeonExitRouteLine = dungeonExitStatus.routeType
        ? `${routeTypeLabel(dungeonExitStatus.routeType)} beyond this door.`
        : 'This stair leaves the current floor.';
    const dungeonExitLockLine = dungeonExitPromptLockLine(dungeonExitStatus, run);
    const activeRouteTiles = run.board?.tiles ?? [];
    const activeRouteSpecialKinds = activeRouteTiles
        .filter(
            (tile) => (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched' && tile.state !== 'removed'
        )
        .map((tile) => tile.routeSpecialKind ?? tile.routeCardKind!);
    const activeRouteSpecialKind = activeRouteSpecialKinds[0] ?? null;
    const activeRoutePairCount = new Set(
        activeRouteTiles
            .filter(
                (tile) =>
                    (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched' && tile.state !== 'removed'
            )
            .map((tile) => tile.pairKey)
    ).size;
    const activeRouteBannerLine =
        activeRouteSpecialKind && activeRoutePairCount > 0 && run.status !== 'levelComplete'
            ? `${routeSpecialDisplayLabel(activeRouteSpecialKind)} in play: ${routeSpecialDisplayRewardLine(activeRouteSpecialKind)}`
            : null;
    const activeRouteSignalRows = activeRouteSpecialKind ? routeSpecialSignalRows(activeRouteSpecialKind) : [];
    const activeRouteSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Route card payoff signals',
        activeRouteSignalRows
    );
    const dungeonPresentation = getDungeonBoardPresentation(run);
    const activeDungeonPanel = run.status !== 'levelComplete' && dungeonPresentation.visible ? dungeonPresentation : null;
    const armedRewardPerkCue = getPrimaryRewardPerkReadinessRow(run);
    const dungeonCombatLogRows = activeDungeonPanel ? getDungeonCombatLogRows(run) : [];
    const nextFloorPreview =
        endlessChapterActive && run.lastLevelResult
            ? pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, run.lastLevelResult.level + 1, run.gameMode)
            : null;
    const nextFloorObjectiveLabel = getFeaturedObjectiveLabel(nextFloorPreview?.featuredObjectiveId ?? null);
    const nextFloorIdentity = nextFloorPreview
        ? getFloorIdentityContract({
              floorTag: nextFloorPreview.floorTag,
              floorArchetypeId: nextFloorPreview.floorArchetypeId,
              mutators: nextFloorPreview.mutators,
              featuredObjectiveLabel: nextFloorObjectiveLabel
          })
        : null;
    const nextFloorChapterIdentity = nextFloorPreview ? getFloorChapterIdentity(nextFloorPreview) : null;
    const nextFloorMutatorNames =
        nextFloorPreview && nextFloorPreview.mutators.length > 0
            ? nextFloorPreview.mutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id).join(', ')
            : 'No mutators';
    const nextFloorMutatorLabels =
        nextFloorChapterIdentity?.actTitle && nextFloorChapterIdentity.biomeTitle
            ? `${nextFloorChapterIdentity.actTitle} - ${nextFloorChapterIdentity.biomeTitle} - ${nextFloorMutatorNames}.${
                  nextFloorChapterIdentity.routePreview ? ` ${nextFloorChapterIdentity.routePreview}` : ''
              }`
            : nextFloorMutatorNames;
    const nextFloorSignalRows: NextFloorSignalRow[] = [];
    if (nextFloorPreview) {
        nextFloorSignalRows.push({
            id: 'next-floor',
            label: 'Floor',
            value: nextFloorPreview.title ?? 'Next floor',
            detail:
                nextFloorChapterIdentity?.actTitle && nextFloorChapterIdentity.biomeTitle
                    ? `${nextFloorChapterIdentity.actTitle} - ${nextFloorChapterIdentity.biomeTitle}`
                    : null,
            tone: 'route'
        });
        if (nextFloorObjectiveLabel) {
            nextFloorSignalRows.push({
                id: 'next-objective',
                label: 'Objective',
                value: nextFloorObjectiveLabel,
                detail: 'Featured payout target',
                tone: 'reward'
            });
        }
        nextFloorSignalRows.push({
            id: 'next-pressure',
            label: 'Pressure',
            value: nextFloorMutatorNames,
            detail: nextFloorChapterIdentity?.routePreview ?? nextFloorMutatorLabels,
            tone: nextFloorPreview.mutators.length > 0 ? 'pressure' : 'neutral'
        });
        if (nextFloorIdentity) {
            nextFloorSignalRows.push({
                id: 'next-counterplay',
                label: 'Counterplay',
                value: nextFloorIdentity.label,
                detail: nextFloorIdentity.counterplaySentence,
                tone: 'counterplay'
            });
        }
    }
    const nextFloorSignalRowsLabel = formatGameplayDetailRowsLabel(
        'Next floor preview signals',
        nextFloorSignalRows
    );
    const floorClearCausalityRowsLabel = formatGameplayDetailRowsLabel(
        'Floor clear cause signals',
        floorClearCausalityRows
    );

    const gauntletRemainingMs =
        run.gauntletDeadlineMs !== null ? Math.max(0, run.gauntletDeadlineMs - gauntletNowMs) : null;
    const gauntletActive = run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null;
    useEffect(() => {
        if (!gauntletActive || run.status !== 'playing' || gauntletRemainingMs === null) {
            previousCountdownPressureSecondRef.current = null;
            return;
        }
        const remainingSec = Math.ceil(gauntletRemainingMs / 1000);
        if (remainingSec <= 0 || remainingSec > 10 || remainingSec === previousCountdownPressureSecondRef.current) {
            return;
        }
        previousCountdownPressureSecondRef.current = remainingSec;
        void resumeAudioContext();
        playCountdownPressureSfx(shuffleSfxGain);
    }, [gauntletActive, gauntletRemainingMs, run.status, shuffleSfxGain]);
    const {
        message: politeHudAnnouncement,
        priority: politeHudAnnouncementPriority,
        queuePoliteAnnouncement
    } = useHudPoliteLiveAnnouncement({
        boardTurnEvent: typedBoardTurnEvent,
        gameplayFeedbackBatch: typedGameplayFeedbackBatch,
        boardLevel: run.board?.level ?? null,
        gauntletActive,
        gauntletRemainingMs,
        gambitThirdPickActive,
        gambitOpportunityFlippedIds:
            gambitThirdPickActive && run.board ? run.board.flippedTileIds : null,
        reduceMotion
    });
    const actionFeedbackAnnouncement = boardFloaterLiveText || politeHudAnnouncement;
    const actionFeedbackPriority =
        boardFloaterPayload?.kind === 'miss' ? 'error' : politeHudAnnouncementPriority;
    const visualHudAnnouncement = actionFeedbackAnnouncement
        ? formatHudActionFeedbackText(actionFeedbackAnnouncement)
        : '';
    const visualHudAnnouncementLabel = actionFeedbackPriority === 'error' ? 'Critical' : 'Action result';
    const visualHudAnnouncementSignal = getVisualHudAnnouncementSignal(
        actionFeedbackAnnouncement,
        actionFeedbackPriority
    );
    const visualHudAnnouncementImpact = getVisualHudAnnouncementImpact(
        actionFeedbackAnnouncement,
        actionFeedbackPriority
    );
    const remainingPairCount = Math.max(0, (run.board?.pairCount ?? 0) - (run.board?.matchedPairs ?? 0));
    const visualHudAnnouncementFollowup = getVisualHudAnnouncementFollowup({
        announcement: actionFeedbackAnnouncement,
        priority: actionFeedbackPriority,
        runStatus: run.status,
        remainingPairCount,
        lives: run.lives
    });

    const { hint: traitSwapRouteHint, tileIds: traitRouteTargetTileIds } = useGameScreenTraitRouteTargets(run);
    const handleTileSelect = useCallback((tileId: string): void => {
        useAppStore.getState().pressTile(tileId);
    }, []);

    const showForgivenessHint = Boolean(
        run.board &&
            run.board.level <= 3 &&
            (run.status === 'memorize' || run.status === 'playing') &&
            run.board.matchedPairs === 0 &&
            run.stats.tries === 0
    );
    useEffect(() => {
        let active = true;
        if (showTutorialPairMarkers && showForgivenessHint && !compactTouchChrome) {
            queueMicrotask(() => {
                if (active) {
                    setRulesHintsExpanded(true);
                }
            });
        }
        return () => {
            active = false;
        };
    }, [compactTouchChrome, showForgivenessHint, showTutorialPairMarkers]);

    const hiddenTileCount = run.board?.tiles.filter((tile) => tile.state === 'hidden').length ?? 0;
    const tileSwapDisabled = Boolean(
        run.activeContract?.noShuffle ||
            !run.board ||
            run.board.flippedTileIds.length > 0 ||
            hiddenTileCount < 2 ||
            (run.regionShuffleCharges < 1 &&
                !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first')))
    );
    const traitSwapHint = !tileSwapDisabled ? traitSwapRouteHint : null;
    const boardLevelForTraitSwapHint = run.board?.level ?? null;
    useEffect(() => {
        if (run.status !== 'playing' || boardLevelForTraitSwapHint === null || !traitSwapHint) {
            return;
        }
        const routeSetupKey = `${boardLevelForTraitSwapHint}:${traitSwapHint.firstTileId}:${traitSwapHint.secondTileId}`;
        if (announcedTraitRouteSetupKeyRef.current === routeSetupKey) {
            return;
        }
        announcedTraitRouteSetupKeyRef.current = routeSetupKey;
        queuePoliteAnnouncement(`Trait route prime found. Use swap: ${traitSwapHint.text}.`, {
            dedupeKey: `trait-route-setup:${routeSetupKey}`,
            priority: 'info'
        });
    }, [
        boardLevelForTraitSwapHint,
        queuePoliteAnnouncement,
        run.status,
        traitSwapHint
    ]);
    const tileSwapPowerVisualActive = run.status === 'playing' && tileSwapArmed && !tileSwapDisabled;
    const {
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        peekEligibleTileIds,
        peekPowerVisualActive,
        pinModeBoardHintActive,
        shiftingSpotlightActive,
        strayEligibleTileIds,
        strayPowerVisualActive,
        tileSwapEligibleTileIds
    } = useGameScreenPowerTileHints({
        boardPinMode,
        destroyPairArmed,
        mergedPeekTileIds,
        peekModeArmed,
        run,
        strayRemoveArmed,
        tileSwapPowerVisualActive
    });

    if (!run.board) {
        return null;
    }

    const showEndlessChapterBanner =
        endlessChapterActive &&
        currentArchetype &&
        currentFeaturedObjectiveLabel &&
        (run.status === 'memorize' || (run.status === 'playing' && run.board.matchedPairs === 0));
    const showBoardPowerBar = run.status === 'playing';
    const shuffleDisabled = !canShuffleBoard(run);
    const regionShuffleDisabled = !canRegionShuffle(run);
    const regionShuffleTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: row shuffle disabled'
        : regionShuffleDisabled
          ? run.regionShuffleCharges < 1 &&
              !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
            ? 'No row/swap charges'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Need at least one hidden pair on the board'
          : 'Shuffle hidden tiles within one row (uses 1 row/swap charge)';
    const tileSwapTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: tile swap disabled'
        : run.board.flippedTileIds.length > 0
          ? 'Finish the current flip first'
          : hiddenTileCount < 2
            ? 'Need two hidden tiles to swap'
              : run.regionShuffleCharges < 1 &&
                  !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
                ? 'No row/swap charges'
              : tileSwapArmed
                ? tileSwapFirstTileId
                    ? 'Tap a second hidden tile to swap positions'
                    : 'Tap the first hidden tile to move'
                : traitSwapHint
                  ? `Swap two hidden tiles (uses 1 row/swap charge). ${traitSwapHint.text}`
                  : 'Swap two hidden tiles (uses 1 row/swap charge)';
    const showFlashPairPower = (run.practiceMode || run.wildMenuRun) && run.status === 'playing';
    const flashPairDisabled =
        !showFlashPairPower ||
        run.flashPairCharges < 1 ||
        run.board.flippedTileIds.length > 0;
    const flashPairTitle =
        run.flashPairCharges < 1
            ? 'No flash charges this floor'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Briefly reveal a random hidden pair (practice / wild)';
    const shuffleTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: shuffle disabled'
        : shuffleDisabled
          ? run.shuffleCharges < 1 &&
              !(run.freeShuffleThisFloor && run.relicIds.includes('first_shuffle_free_per_floor'))
            ? 'No shuffle charges'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Need at least two hidden pairs to shuffle'
          : 'Shuffle hidden tiles (1 charge this run)';
    const boardPresentationClass =
        settingsBoardPresentation === 'spaghetti'
            ? styles.boardStageSpaghetti
            : settingsBoardPresentation === 'breathing' && !reduceMotion
              ? styles.boardStageBreathing
              : '';
    const destroyDisabled = run.destroyPairCharges < 1 && !destroyPairArmed;
    /*
     * A11Y-006 — backdrop inert behind OverlayModal surfaces (pause, relic, floor clear, abandon):
     * - Native `inert` is supported in Chromium (Electron) and current Safari/Firefox; very old browsers
     *   ignore it, so `aria-hidden` is set in tandem to reduce stray tab stops where the attribute is honored.
     * - Do not wrap modal markup in this subtree: nesting focused dialogs inside `aria-hidden` breaks SR semantics.
     * - `inert` alone should block pointer events on descendants; keep modal siblings outside this wrapper.
     */
    const gameplayShellInert =
        !suppressStatusOverlays &&
        (abandonRunConfirmOpen ||
            dungeonExitPromptOpen ||
            run.status === 'paused' ||
            Boolean(run.relicOffer) ||
            (run.status === 'levelComplete' && Boolean(run.lastLevelResult) && !run.relicOffer));
    const reg104GameplayShellVariant =
        run.status === 'paused' ? 'paused' : run.status === 'levelComplete' ? 'floor_clear' : 'playing';
    return (
        <section
            className={`${styles.shell} ${cameraViewportMode ? styles.mobileCameraShell : ''}`}
            data-mobile-camera-mode={cameraViewportMode ? 'true' : 'false'}
            {...{ [REG104_DATA_SHELL]: reg104GameplayShellVariant }}
            data-testid="game-shell"
            ref={shellRef}
            style={GAMEPLAY_VISUAL_CSS_VARS}
        >
            <MainMenuBackground
                fieldTiltRef={gameFieldTiltRef}
                graphicsQuality={settingsGraphicsQuality}
                height={height}
                reduceMotion={reduceMotion}
                width={width}
            />
            <div
                aria-hidden="true"
                className={styles.stageBackdrop}
                style={{ backgroundImage: `url(${UI_ART.gameplayWorkshopScene})` }}
            />
            <div className={`${styles.gameForeground} ${cameraViewportMode ? styles.mobileCameraForeground : ''}`}>
                <div
                    aria-hidden={gameplayShellInert ? true : undefined}
                    className={styles.gameplayInertScope}
                    data-a11y-gameplay-inert={gameplayShellInert ? 'true' : 'false'}
                    inert={gameplayShellInert ? true : undefined}
                >
                    <h1 className={styles.srOnly}>Level {run.board.level}</h1>
                    {persistenceWriteNotice ? (
                        <div className={styles.persistWriteBanner} role="alert">
                            <span>{persistenceWriteNotice}</span>
                            <button
                                type="button"
                                className={styles.persistWriteBannerDismiss}
                                onClick={clearPersistenceWriteNotice}
                            >
                                Dismiss
                            </button>
                        </div>
                    ) : null}
                    <div
                        className={`${styles.gamePlayLayout} ${cameraViewportMode ? styles.mobileCameraGamePlayLayout : ''}`.trim()}
                    >
                    <div
                        className={`${styles.mainGameColumn} ${cameraViewportMode ? styles.mobileCameraMainColumn : ''}`.trim()}
                        data-html-ui-layer="gameplay-chrome-v2"
                    >
                        <MemoGameplayHudBar
                            cameraViewportMode={cameraViewportMode}
                            gauntletRemainingMs={gauntletRemainingMs}
                            politeHudAnnouncement={politeHudAnnouncement}
                            politeHudAnnouncementPriority={politeHudAnnouncementPriority}
                            reduceMotion={reduceMotion}
                            run={run}
                        />

                        {gambitThirdPickActive ? (
                            <div
                                aria-live="polite"
                                className={styles.gambitOpportunityHint}
                                data-testid="gambit-opportunity-hint"
                                role="status"
                            >
                                <span>{GAMBIT_OPPORTUNITY_HINT_LINE}</span>
                                <span
                                    className={styles.gambitOpportunitySignals}
                                    data-testid="gambit-opportunity-signals"
                                    aria-label={GAMBIT_SIGNAL_ROWS_LABEL}
                                >
                                    <span
                                        data-gambit-signal="window"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Window')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Window')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Window')}
                                    >
                                        <small>Window</small>
                                        <b>Third flip</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Window') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-gambit-signal="payoff"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Payoff')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Payoff')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Payoff')}
                                    >
                                        <small>Payoff</small>
                                        <b>Recover pair</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Payoff') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-gambit-signal="cost"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Cost')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Cost')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Cost')}
                                    >
                                        <small>Cost</small>
                                        <b>No perfect</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Cost') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                </span>
                            </div>
                        ) : null}

                        {showEndlessChapterBanner ? (
                            <GameScreenEndlessChapterBanner
                                archetype={currentArchetype}
                                featuredObjectiveLabel={currentFeaturedObjectiveLabel}
                                floorIdentity={currentFloorIdentity}
                            />
                        ) : null}

                        {currentDungeonRoom ? (
                            <GameScreenDungeonRunStrip
                                bossDistance={dungeonMapPresentation.bossDistance}
                                currentRoom={currentDungeonRoom}
                                visibleNodes={visibleDungeonMapNodes}
                            />
                        ) : null}

                        <div
                            ref={boardStageRef}
                            data-testid="board-stage"
                            className={`${styles.boardStage} ${cameraViewportMode ? styles.boardStageCamera : ''} ${boardPresentationClass} ${boardStageCssBloomClass}`.trim()}
                            data-match-crescendo-beats={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.beatCount ?? 0
                                    : 0
                            }
                            data-match-crescendo-cue={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                    : 'none'
                            }
                            data-match-crescendo-screen-cue={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                    : 'none'
                            }
                            data-match-crescendo-tier={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.tier ?? 'none'
                                    : 'none'
                            }
                            data-match-payoff-stack={boardMatchPayoffStackCue?.tone ?? 'none'}
                            data-match-payoff-stack-action={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackAction(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-beats={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) : 0
                            }
                            data-match-payoff-stack-audio={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackAudioCue(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-first-cue={boardMatchPayoffStackCue?.firstCue ?? 'none'}
                            data-match-payoff-stack-lanes={boardMatchPayoffStackCue?.laneCount ?? 0}
                            data-match-payoff-stack-screen-cue={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackScreenCue(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-sequence-first={
                                boardMatchPayoffStackCue?.sequenceFirstCue ?? 'none'
                            }
                            data-match-payoff-stack-sequence-keep={boardMatchPayoffStackCue?.sequenceKeepCue ?? 'none'}
                            data-match-payoff-stack-sequence-then={boardMatchPayoffStackCue?.nextCue ?? 'none'}
                            data-match-payoff-stack-summary={boardMatchPayoffStackCue?.value ?? 'none'}
                            style={{ '--gameplay-workshop-table-image': `url(${UI_ART.gameplayWorkshopTable})` } as CSSProperties}
                        >
                            <div className={styles.boardGlow} aria-hidden="true" />
                            {activeRouteBannerLine ? (
                                <div className={styles.routeCardBanner} data-testid="route-card-board-banner">
                                    <strong>{routeSpecialDisplayLabel(activeRouteSpecialKind!)}</strong>
                                    <span>{routeSpecialDisplayRewardLine(activeRouteSpecialKind!)}</span>
                                    <div
                                        className={styles.routeCardBannerSignals}
                                        data-testid="route-card-board-banner-signals"
                                        aria-label={activeRouteSignalRowsLabel}
                                    >
                                        {activeRouteSignalRows.map((row) => {
                                            const beatCount = getRouteSpecialSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-route-card-signal-audio={getRouteSpecialSignalAudioCue(row)}
                                                    data-route-card-signal-beats={beatCount}
                                                    data-route-card-signal-screen-cue={getRouteSpecialSignalScreenCue(row)}
                                                    data-route-card-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.routeCardBannerBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-route-card-signal-beat={index + 1}
                                                                data-route-card-signal-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                            {activeDungeonPanel ? (
                                <GameScreenDungeonStatusPanel
                                    combatLogRows={dungeonCombatLogRows}
                                    panel={activeDungeonPanel}
                                />
                            ) : null}
                            {visualHudAnnouncement ? (
                                <GameScreenActionFeedbackRail
                                    burstTier={visualHudAnnouncementImpact.burstTier}
                                    crescendo={
                                        boardFloaterPayload?.kind === 'match'
                                            ? boardFloaterPayload.crescendo ?? null
                                            : null
                                    }
                                    details={visualHudAnnouncementImpact.details}
                                    followup={visualHudAnnouncementFollowup}
                                    intensity={visualHudAnnouncementImpact.level}
                                    label={visualHudAnnouncementLabel}
                                    message={visualHudAnnouncement}
                                    signal={visualHudAnnouncementSignal}
                                    tone={actionFeedbackPriority}
                                />
                            ) : null}
                            {boardMatchPayoffStackCue ? (
                                <div
                                    aria-label={`Last match payoff stack. ${boardMatchPayoffStackCue.label}: ${boardMatchPayoffStackCue.value}. ${getBoardMatchPayoffStackAction(
                                        boardMatchPayoffStackCue
                                    )}. ${getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue)} beats. ${boardMatchPayoffStackCue.firstCue}.${
                                        boardMatchPayoffStackCue.nextCue ? ` ${boardMatchPayoffStackCue.nextCue}.` : ''
                                    } Sequence: first ${boardMatchPayoffStackCue.sequenceFirstCue}; then ${
                                        boardMatchPayoffStackCue.nextCue ?? 'lock payoff route'
                                    }; keep ${boardMatchPayoffStackCue.sequenceKeepCue}.`}
                                    className={styles.boardMatchPayoffStackCue}
                                    data-match-payoff-stack-action={getBoardMatchPayoffStackAction(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-audio={getBoardMatchPayoffStackAudioCue(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-beats={getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-fill={boardMatchPayoffStackFill}
                                    data-match-payoff-stack-keep={boardMatchPayoffStackCue.sequenceKeepCue}
                                    data-match-payoff-stack-screen-cue={getBoardMatchPayoffStackScreenCue(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-sequence-first={boardMatchPayoffStackCue.sequenceFirstCue}
                                    data-match-payoff-stack-sequence-then={
                                        boardMatchPayoffStackCue.nextCue ?? 'Lock payoff route'
                                    }
                                    data-match-payoff-stack-tone={boardMatchPayoffStackCue.tone}
                                    style={
                                        {
                                            '--match-payoff-stack-fill': `${boardMatchPayoffStackFill}%`
                                        } as CSSProperties
                                    }
                                    data-testid="board-match-payoff-stack-cue"
                                    role="status"
                                >
                                    <small>{boardMatchPayoffStackCue.label}</small>
                                    <strong>{boardMatchPayoffStackCue.value}</strong>
                                    <b>{getBoardMatchPayoffStackAction(boardMatchPayoffStackCue)}</b>
                                    <span aria-hidden="true" className={styles.boardMatchPayoffStackMeter} />
                                    <span aria-hidden="true" className={styles.boardMatchPayoffStackBeatPips}>
                                        {Array.from({ length: getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) }, (_, index) => (
                                            <i
                                                data-match-payoff-stack-beat={index + 1}
                                                data-match-payoff-stack-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        ))}
                                    </span>
                                    <span>{boardMatchPayoffStackCue.firstCue}</span>
                                    {boardMatchPayoffStackCue.nextCue ? <em>{boardMatchPayoffStackCue.nextCue}</em> : null}
                                    <div
                                        className={styles.boardMatchPayoffStackSequence}
                                        data-testid="board-match-payoff-stack-sequence"
                                    >
                                        <span data-match-payoff-stack-step="first">
                                            <small>First</small>
                                            <b>{boardMatchPayoffStackCue.sequenceFirstCue}</b>
                                        </span>
                                        <span data-match-payoff-stack-step="then">
                                            <small>Then</small>
                                            <b>{boardMatchPayoffStackCue.nextCue ?? 'Lock payoff route'}</b>
                                        </span>
                                        <span data-match-payoff-stack-step="keep">
                                            <small>Keep</small>
                                            <b>{boardMatchPayoffStackCue.sequenceKeepCue}</b>
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            <MemoTileBoard
                                ref={tileBoardRef}
                                allowGambitThirdFlip={allowGambitThirdFlip}
                                board={run.board}
                                cursedPairKey={run.board.cursedPairKey ?? null}
                                wardPairKey={run.board.wardPairKey ?? null}
                                bountyPairKey={run.board.bountyPairKey ?? null}
                                debugPeekActive={run.debugPeekActive}
                                dimmedTileIds={focusDimmedTileIds}
                                guidedTargetTileIds={onboardingBoardTargetIds}
                                chainContext={{
                                    armedPerkId: armedRewardPerkCue?.id ?? null,
                                    armedPerkDetail: armedRewardPerkCue?.readinessDetail ?? null,
                                    armedPerkLabel: armedRewardPerkCue?.readinessLabel ?? null,
                                    armedPerkPayoff: armedRewardPerkCue?.payoff ?? null,
                                    comboShards: run.stats.comboShards,
                                    currentStreak: run.stats.currentStreak,
                                    lives: run.lives
                                }}
                                recoveryContext={boardRecoveryContext}
                                traitRouteHintText={traitSwapRouteHint?.text ?? null}
                                traitRouteTargetTileIds={traitRouteTargetTileIds}
                                interactive={run.status === 'playing' || gambitThirdPickActive}
                                mobileCameraMode={cameraViewportMode}
                                nBackAnchorPairKey={run.nBackAnchorPairKey}
                                nBackMutatorActive={nBackMutatorActive}
                                peekRevealedTileIds={mergedPeekTileIds}
                                pinnedTileIds={run.pinnedTileIds}
                                onTileSelect={handleTileSelect}
                                onMemorizeBoardReady={gameScreenActions.notifyMemorizeBoardReady}
                                pairProximityHintsEnabled={settingsPairProximityHintsEnabled}
                                previewActive={run.status === 'memorize'}
                                boardBloomEnabled={settingsBoardBloomEnabled}
                                boardScreenSpaceAA={settingsBoardScreenSpaceAA}
                                frameStyle={
                                    cameraViewportMode ? undefined : DESKTOP_FULL_BLEED_TILE_BOARD_FRAME_STYLE
                                }
                                graphicsQuality={settingsGraphicsQuality}
                                reduceMotion={reduceMotion}
                                runStatus={run.status}
                                showTutorialPairMarkers={showTutorialPairMarkers}
                                silhouetteDuringPlay={silhouetteDuringPlay}
                                viewportResetToken={viewportResetToken}
                                wideRecallInPlay={wideRecallInPlay}
                                shiftingSpotlightActive={shiftingSpotlightActive}
                                destroyPowerVisualActive={destroyPowerVisualActive}
                                destroyEligibleTileIds={destroyEligibleTileIds}
                                peekPowerVisualActive={peekPowerVisualActive}
                                peekEligibleTileIds={peekEligibleTileIds}
                                strayPowerVisualActive={strayPowerVisualActive}
                                strayEligibleTileIds={strayEligibleTileIds}
                                tileSwapPowerVisualActive={tileSwapPowerVisualActive}
                                tileSwapEligibleTileIds={tileSwapEligibleTileIds}
                                tileSwapFirstTileId={tileSwapFirstTileId}
                                pinModeBoardHintActive={pinModeBoardHintActive}
                                shuffleSfxGain={shuffleSfxGain}
                                stickyBlockedTileId={stickyBlockedTileId}
                            />
                            {boardFloaterPayload ? (
                                <span
                                    key={`live-${boardFloaterPayload.key}`}
                                    aria-atomic="true"
                                    aria-live="polite"
                                    className={styles.srOnly}
                                >
                                    {boardFloaterLiveText}
                                </span>
                            ) : null}
                            {boardFloaterPos && boardFloaterPayload ? (
                                <div
                                    ref={boardFloaterRef}
                                    key={boardFloaterPayload.key}
                                    aria-hidden
                                    className={`${
                                        boardFloaterPayload.kind === 'match'
                                            ? styles.matchScoreFloater
                                            : styles.mismatchScoreFloater
                                    } ${reduceMotion ? styles.matchScoreFloaterReduced : ''}`}
                                    data-testid={
                                        boardFloaterPayload.kind === 'match'
                                            ? 'match-score-floater'
                                            : 'mismatch-score-floater'
                                    }
                                    data-feedback-intensity={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.feedbackIntensity
                                            : boardFloaterDetailLines.length > 0
                                              ? 'penalty'
                                              : (boardFloaterPayload.brokenChainDepth ?? 0) >= 3
                                                ? 'break'
                                              : 'miss'
                                    }
                                    data-match-floater-heat={
                                        boardFloaterPayload.kind === 'match'
                                            ? getMatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    data-match-crescendo-audio={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.audioCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-beats={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.beatCount ?? 0
                                            : 0
                                    }
                                    data-match-crescendo-cue={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-screen-cue={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-tier={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.tier ?? 'none'
                                            : 'none'
                                    }
                                    data-match-jackpot-beats={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.beatCount ?? 0 : 0
                                    }
                                    data-match-jackpot-audio={
                                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                                            ? getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)
                                            : 'none'
                                    }
                                    data-match-jackpot-screen-cue={
                                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                                            ? getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)
                                            : 'none'
                                    }
                                    data-match-jackpot-tier={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.tier ?? 'none' : 'none'
                                    }
                                    data-match-trait-lane-count={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterTraitLaneMap.length : 0
                                    }
                                    data-match-trait-lane-map={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterTraitLaneMapAttr || 'none'
                                            : 'none'
                                    }
                                    data-mismatch-floater-heat={
                                        boardFloaterPayload.kind === 'miss'
                                            ? getMismatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-beats={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.beatCount ?? 0
                                            : 0
                                    }
                                    data-mismatch-recovery-crescendo-cue={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-screen-cue={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-tier={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.tier ?? 'none'
                                            : 'none'
                                    }
                                    style={
                                        {
                                            left: boardFloaterPos.x,
                                            top: boardFloaterPos.y,
                                            '--match-score-float-ms': `${boardFloaterDurationMs}ms`
                                        } as CSSProperties
                                    }
                                >
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span
                                            className={styles.boardFloaterSignal}
                                            data-floater-signal={boardFloaterPayload.feedbackSignal.tone}
                                        >
                                            {boardFloaterPayload.feedbackSignal.label}
                                        </span>
                                    ) : (
                                        <span
                                            className={styles.boardFloaterSignal}
                                            data-floater-signal={boardFloaterMismatchSignal?.tone}
                                        >
                                            {boardFloaterMismatchSignal?.label}
                                        </span>
                                    )}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue ? (
                                        <span
                                            aria-label={`${boardFloaterJackpotCue.label}: ${boardFloaterJackpotCue.action}: ${boardFloaterJackpotCue.value}. ${boardFloaterJackpotCue.beatCount} beats.`}
                                            className={styles.boardFloaterJackpotCue}
                                            data-match-jackpot-action={boardFloaterJackpotCue.action}
                                            data-match-jackpot-audio={getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)}
                                            data-match-jackpot-beats={boardFloaterJackpotCue.beatCount}
                                            data-match-jackpot-screen-cue={getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)}
                                            data-match-jackpot-tier={boardFloaterJackpotCue.tier}
                                            data-testid="match-score-floater-jackpot"
                                        >
                                            <small>{boardFloaterJackpotCue.label}</small>
                                            <b>{boardFloaterJackpotCue.action}</b>
                                            <em>{boardFloaterJackpotCue.value}</em>
                                            <span aria-hidden="true" className={styles.boardFloaterJackpotBeats}>
                                                {Array.from({ length: boardFloaterJackpotCue.beatCount }, (_, index) => (
                                                    <i
                                                        data-match-jackpot-beat={index + 1}
                                                        data-match-jackpot-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`match-jackpot-beat-${index + 1}`}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span
                                            aria-label={`Match impact cue: ${boardFloaterPayload.impactCue.label}`}
                                            className={styles.boardFloaterImpactCue}
                                            data-match-impact-cue-beats={getBoardFloaterImpactCueBeatCount(boardFloaterPayload)}
                                            data-match-impact-cue-screen-cue={getBoardFloaterImpactCueScreenCue(boardFloaterPayload)}
                                            data-match-impact-cue-tone={boardFloaterPayload.impactCue.tone}
                                            data-testid="match-score-floater-impact-cue"
                                        >
                                            {boardFloaterPayload.impactCue.label}
                                            <span aria-hidden="true" className={styles.boardFloaterImpactBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterImpactCueBeatCount(boardFloaterPayload) },
                                                    (_, index) => (
                                                        <i
                                                            data-match-impact-cue-beat={index + 1}
                                                            data-match-impact-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`match-impact-cue-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.crescendo ? (
                                        <span
                                            aria-label={`Match crescendo ${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}. ${boardFloaterPayload.crescendo.beatCount} beats.`}
                                            className={styles.boardFloaterCrescendo}
                                            data-match-crescendo-cue={boardFloaterPayload.crescendo.screenCue}
                                            data-match-crescendo-screen-cue={boardFloaterPayload.crescendo.screenCue}
                                            data-match-crescendo-tier={boardFloaterPayload.crescendo.tier}
                                            data-testid="match-score-floater-crescendo"
                                        >
                                            <small>{boardFloaterPayload.crescendo.label}</small>
                                            <span className={styles.boardFloaterCrescendoBeats}>
                                                {Array.from({ length: boardFloaterPayload.crescendo.beatCount }, (_, index) => (
                                                    <i
                                                        aria-hidden
                                                        data-match-crescendo-beat={index + 1}
                                                        data-match-crescendo-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`crescendo-beat-${index + 1}`}
                                                    />
                                                ))}
                                            </span>
                                            <b>{boardFloaterPayload.crescendo.detail}</b>
                                        </span>
                                    ) : null}
                                    <span className={styles.boardFloaterMain}>
                                        {boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.feedbackHeadline
                                            : mismatchFloaterVisualLabel(boardFloaterDetailLines, {
                                                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                                                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
                                              })}
                                    </span>
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.cascadeCue ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`}
                                            className={styles.boardFloaterCascadeCue}
                                            data-cascade-beats={getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue)}
                                            data-cascade-tier={boardFloaterPayload.cascadeCue.tier}
                                            data-testid="match-score-floater-cascade"
                                        >
                                            <small>{boardFloaterPayload.cascadeCue.label}</small>
                                            <b>{boardFloaterPayload.cascadeCue.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterCascadeBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue) },
                                                    (_, index) => (
                                                        <i
                                                            data-cascade-beat={index + 1}
                                                            data-cascade-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`cascade-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainMilestone ? (
                                        <span
                                            aria-label={`Chain milestone ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}. Action: ${boardFloaterPayload.chainMilestone.action}. ${boardFloaterPayload.chainMilestone.value}. ${getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)} beats.`}
                                            className={styles.boardFloaterChainMilestone}
                                            data-chain-milestone-action={boardFloaterPayload.chainMilestone.action}
                                            data-chain-milestone-audio={boardFloaterPayload.chainMilestone.audioCue}
                                            data-chain-milestone-beats={getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)}
                                            data-chain-milestone-fill={boardFloaterChainMilestoneFill}
                                            data-chain-milestone-cue={boardFloaterPayload.chainMilestone.screenCue}
                                            data-chain-milestone-screen-cue={boardFloaterPayload.chainMilestone.screenCue}
                                            data-chain-milestone-target={boardFloaterPayload.chainMilestone.target}
                                            data-chain-milestone-tone={boardFloaterPayload.chainMilestone.tone}
                                            style={
                                                {
                                                    '--chain-milestone-fill': `${boardFloaterChainMilestoneFill}%`
                                                } as CSSProperties
                                            }
                                            data-testid="match-score-floater-chain-milestone"
                                        >
                                            <small>{boardFloaterPayload.chainMilestone.label}</small>
                                            <b>{boardFloaterPayload.chainMilestone.target}</b>
                                            <strong>{boardFloaterPayload.chainMilestone.action}</strong>
                                            <em>{boardFloaterPayload.chainMilestone.value}</em>
                                            <span aria-hidden="true" className={styles.boardFloaterChainMilestoneMeter} />
                                            <span aria-hidden="true" className={styles.boardFloaterChainMilestoneBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-milestone-beat={index + 1}
                                                            data-chain-milestone-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`chain-milestone-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.rewardBurst ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`}
                                            className={styles.boardFloaterRewardBurst}
                                            data-reward-burst-action={boardFloaterPayload.rewardBurst.action}
                                            data-reward-burst-audio={getBoardFloaterRewardBurstAudioCue(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-beats={getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-fill={boardFloaterRewardBurstFill}
                                            data-reward-burst-label={boardFloaterPayload.rewardBurst.label}
                                            data-reward-burst-screen-cue={getBoardFloaterRewardBurstScreenCue(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-tier={boardFloaterPayload.rewardBurst.tier}
                                            style={
                                                {
                                                    '--reward-burst-fill': `${boardFloaterRewardBurstFill}%`
                                                } as CSSProperties
                                            }
                                            data-testid="match-score-floater-reward-burst"
                                        >
                                            <small>{boardFloaterPayload.rewardBurst.label}</small>
                                            <u>{boardFloaterPayload.rewardBurst.action}</u>
                                            <b>{boardFloaterPayload.rewardBurst.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterRewardBurstMeter} />
                                            <span aria-hidden="true" className={styles.boardFloaterRewardBurstBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst) },
                                                    (_, index) => (
                                                        <i
                                                            data-reward-burst-beat={index + 1}
                                                            data-reward-burst-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`reward-burst-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.payoffSummary ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`}
                                            className={styles.boardFloaterPayoffSummary}
                                            data-payoff-summary-audio={getBoardFloaterPayoffSummaryAudioCue(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-beats={getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-label={boardFloaterPayload.payoffSummary.label}
                                            data-payoff-summary-focus={
                                                boardFloaterPayload.payoffSummary.label === 'Super stack' ||
                                                boardFloaterPayload.payoffSummary.label === 'Stack cashout'
                                                    ? 'cashout'
                                                    : boardFloaterPayload.payoffSummary.tier
                                            }
                                            data-payoff-summary-screen-cue={getBoardFloaterPayoffSummaryScreenCue(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-tier={boardFloaterPayload.payoffSummary.tier}
                                            data-testid="match-score-floater-payoff-summary"
                                        >
                                            <small>{boardFloaterPayload.payoffSummary.label}</small>
                                            <b>{boardFloaterPayload.payoffSummary.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterPayoffSummaryBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary) },
                                                    (_, index) => (
                                                        <i
                                                            data-payoff-summary-beat={index + 1}
                                                            data-payoff-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`payoff-summary-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterMatchPayoffLaneMap.length > 0 ? (
                                        <span
                                            aria-label={matchPayoffLaneMapLabel(boardFloaterMatchPayoffLaneMap)}
                                            className={styles.boardFloaterPayoffLaneMap}
                                            data-match-payoff-lane-primary={boardFloaterPrimaryPayoffLane?.id ?? 'none'}
                                            data-match-payoff-lane-primary-action={
                                                boardFloaterPrimaryPayoffLane
                                                    ? matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-primary-audio={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneAudioCue(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-primary-focus={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneFocus(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-actions={matchPayoffLaneActionMapAttr(
                                                boardFloaterMatchPayoffLaneMap
                                            )}
                                            data-match-payoff-lane-map={matchPayoffLaneMapAttr(boardFloaterMatchPayoffLaneMap)}
                                            data-match-payoff-lane-primary-screen-cue={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneScreenCue(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-testid="match-score-floater-payoff-lane-map"
                                        >
                                            <span
                                                className={styles.boardFloaterPayoffLaneMapSummary}
                                                data-match-payoff-lane-count={boardFloaterMatchPayoffLaneMap.length}
                                                data-testid="match-score-floater-payoff-lane-map-summary"
                                            >
                                                <small>Lanes</small>
                                                <b>
                                                    {boardFloaterMatchPayoffLaneMap.length}{' '}
                                                    {boardFloaterMatchPayoffLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterPayoffLaneMapSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterMatchPayoffLaneMap.length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-payoff-lane-map-summary-beat={index + 1}
                                                                data-match-payoff-lane-map-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`payoff-lane-map-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            {boardFloaterPrimaryPayoffLane ? (
                                                <span
                                                    aria-label={`Primary paid lane. ${matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}: ${boardFloaterPrimaryPayoffLane.label}. ${boardFloaterPrimaryPayoffLane.cue}. ${getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane)} beats.`}
                                                    data-match-payoff-primary-lane={boardFloaterPrimaryPayoffLane.id}
                                                    data-match-payoff-primary-lane-action={matchPayoffLaneAction(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-audio={getBoardFloaterPayoffLaneAudioCue(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-beats={getBoardFloaterPayoffLaneBeatCount(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-focus={getBoardFloaterPayoffLaneFocus(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-tone={boardFloaterPrimaryPayoffLane.tone}
                                                    data-testid="match-score-floater-primary-payoff-lane"
                                                >
                                                    <small>Paid lane</small>
                                                    <strong>{matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}</strong>
                                                    <em>{boardFloaterPrimaryPayoffLane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterPrimaryPayoffLaneBeatPips}>
                                                        {Array.from(
                                                            { length: getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane) },
                                                            (_, index) => (
                                                                <i
                                                                    data-match-payoff-primary-lane-beat={index + 1}
                                                                    data-match-payoff-primary-lane-beat-focus={
                                                                        index === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`${boardFloaterPrimaryPayoffLane.id}-primary-payoff-lane-beat-${index + 1}`}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterMatchPayoffLaneMap.map((lane) => (
                                                <span
                                                    data-match-payoff-lane={lane.id}
                                                    data-match-payoff-lane-action={matchPayoffLaneAction(lane)}
                                                    data-match-payoff-lane-audio={getBoardFloaterPayoffLaneAudioCue(lane)}
                                                    data-match-payoff-lane-beats={getBoardFloaterPayoffLaneBeatCount(lane)}
                                                    data-match-payoff-lane-count={lane.count}
                                                    data-match-payoff-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(lane)}
                                                    data-match-payoff-lane-tone={lane.tone}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    {lane.count > 1 ? <b>x{lane.count}</b> : null}
                                                    <em>{lane.cue}</em>
                                                    <strong>{matchPayoffLaneAction(lane)}</strong>
                                                    <span aria-hidden="true" className={styles.boardFloaterPayoffLaneBeatPips}>
                                                        {Array.from({ length: getBoardFloaterPayoffLaneBeatCount(lane) }, (_, index) => (
                                                            <i
                                                                data-match-payoff-lane-beat={index + 1}
                                                                data-match-payoff-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`${lane.id}-payoff-lane-beat-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterMatchPayoffLadder ? (
                                        <span
                                            aria-label={`Match payoff ladder. First: ${boardFloaterMatchPayoffLadder.first}. Then: ${boardFloaterMatchPayoffLadder.then}. Keep: ${boardFloaterMatchPayoffLadder.keep}.${
                                                boardFloaterMatchPayoffLadder.lanes.length > 0
                                                    ? ` Lanes: ${boardFloaterMatchPayoffLadder.lanes.join(' to ')}.`
                                                    : ''
                                            }`}
                                            className={styles.boardFloaterPayoffLadder}
                                            data-match-payoff-ladder-audio={getBoardFloaterPayoffLadderAudioCue(
                                                boardFloaterMatchPayoffLadder
                                            )}
                                            data-match-payoff-ladder-beats={getBoardFloaterPayoffLadderBeatCount(
                                                boardFloaterMatchPayoffLadder
                                            )}
                                            data-match-payoff-ladder-lanes={
                                                boardFloaterMatchPayoffLadder.lanes.length > 0
                                                    ? boardFloaterMatchPayoffLadder.lanes.join('|')
                                                    : undefined
                                            }
                                            data-match-payoff-ladder-screen-cue={getBoardFloaterPayoffLadderScreenCue(
                                                boardFloaterMatchPayoffLadder
                                            )}
                                            data-match-payoff-ladder-tone={boardFloaterMatchPayoffLadder.tone}
                                            data-testid="match-score-floater-payoff-ladder"
                                        >
                                            <span
                                                className={styles.boardFloaterPayoffLadderSummary}
                                                data-match-payoff-ladder-count={boardFloaterMatchPayoffLadder.lanes.length}
                                                data-testid="match-score-floater-payoff-ladder-summary"
                                            >
                                                <small>Ladder</small>
                                                <b>
                                                    {boardFloaterMatchPayoffLadder.lanes.length > 0
                                                        ? `${boardFloaterMatchPayoffLadder.lanes.length} lanes`
                                                        : 'No lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterPayoffLadderSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterMatchPayoffLadder.lanes.length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-payoff-ladder-summary-beat={index + 1}
                                                                data-match-payoff-ladder-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`payoff-ladder-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            <small>First</small>
                                            <b data-match-payoff-ladder-step="first">{boardFloaterMatchPayoffLadder.first}</b>
                                            <small>Then</small>
                                            <b data-match-payoff-ladder-step="then">{boardFloaterMatchPayoffLadder.then}</b>
                                            <small>Keep</small>
                                            <b data-match-payoff-ladder-step="keep">{boardFloaterMatchPayoffLadder.keep}</b>
                                            {boardFloaterMatchPayoffLadder.lanes.length > 0 ? (
                                                <span className={styles.boardFloaterPayoffLaneStrip}>
                                                    {boardFloaterMatchPayoffLadder.lanes.map((lane, index) => (
                                                        <i data-match-payoff-lane-index={index + 1} key={`${lane}-${index}`}>
                                                            <span aria-hidden="true" className={styles.boardFloaterPayoffLaneIndexPips}>
                                                                {Array.from(
                                                                    { length: Math.min(3, index + 1) },
                                                                    (_, pipIndex) => (
                                                                        <em
                                                                            data-match-payoff-lane-pip={pipIndex + 1}
                                                                            data-match-payoff-lane-pip-focus={
                                                                                pipIndex === 0 ? 'primary' : 'support'
                                                                            }
                                                                            key={`${lane}-${index}-pip-${pipIndex + 1}`}
                                                                        />
                                                                    )
                                                                )}
                                                            </span>
                                                            {lane}
                                                        </i>
                                                    ))}
                                                </span>
                                            ) : null}
                                            <span aria-hidden="true" className={styles.boardFloaterPayoffLadderBeatPips}>
                                                {Array.from(
                                                    {
                                                        length: getBoardFloaterPayoffLadderBeatCount(
                                                            boardFloaterMatchPayoffLadder
                                                        )
                                                    },
                                                    (_, index) => (
                                                        <i
                                                            data-match-payoff-ladder-beat={index + 1}
                                                            data-match-payoff-ladder-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`payoff-ladder-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span className={styles.boardFloaterScore}>
                                            {boardFloaterPayload.routeRewardText ??
                                                `+${runNonNegativeInteger(boardFloaterPayload.amount).toLocaleString()}`}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainDepth >= 3 ? (
                                        <span
                                            className={styles.boardFloaterStreak}
                                            data-chain-streak-depth={boardFloaterPayload.chainDepth}
                                        >
                                            <span className={styles.boardFloaterStreakPips} aria-hidden="true">
                                                {Array.from(
                                                    { length: Math.min(5, boardFloaterPayload.chainDepth) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-streak-beat={index + 1}
                                                            data-chain-streak-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`board-streak-beat-${index + 1}`}
                                                        />
                                                )
                                            )}
                                        </span>
                                            <span className={styles.boardFloaterStreakText}>x{boardFloaterPayload.chainDepth} streak</span>
                                            {boardFloaterChainCue ? (
                                                <span className={styles.boardFloaterStreakCue}>
                                                    <span aria-hidden="true" className={styles.boardFloaterStreakCuePips}>
                                                        {Array.from(
                                                            { length: Math.min(5, Math.max(2, boardFloaterPayload.chainDepth)) },
                                                            (_, index) => (
                                                                <i
                                                                    data-chain-streak-cue-beat={index + 1}
                                                                    data-chain-streak-cue-beat-focus={
                                                                        index === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`board-streak-cue-beat-${index + 1}`}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                    {boardFloaterChainCue}
                                                </span>
                                            ) : null}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' &&
                                    boardFloaterMatchChainRewardForecastCues.length > 0 ? (
                                        <span
                                            aria-label={`Match score floater reward forecast. ${boardFloaterMatchChainRewardForecastCues
                                                .slice(0, 3)
                                                .map((cue) => {
                                                    const stackLabel = getChainRewardStackLabel(cue);
                                                    const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);

                                                    return `${cue.chaseLabel}: ${cue.actionLabel}: ${getChainRewardLaneAction(cue.urgency)}: ${cue.label}: ${cue.distanceLabel}: ${getChainRewardUrgencyCopy(cue)}${
                                                        progress ? `: ${progress.label}: ${progress.remainingLabel}` : ''
                                                    }${stackLabel ? `: ${stackLabel}` : ''}`;
                                                })
                                                .join('. ')}.`}
                                            className={styles.boardFloaterRewardForecast}
                                            data-testid="match-score-floater-reward-forecast"
                                        >
                                            <span
                                                className={styles.boardFloaterRewardForecastSummary}
                                                data-chain-reward-forecast-count={boardFloaterMatchChainRewardForecastCues.slice(0, 3).length}
                                                data-testid="match-score-floater-reward-forecast-summary"
                                            >
                                                <small>Forecast</small>
                                                <b>
                                                    {boardFloaterMatchChainRewardForecastCues.slice(0, 3).length}{' '}
                                                    {boardFloaterMatchChainRewardForecastCues.slice(0, 3).length === 1 ? 'reward' : 'rewards'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterRewardForecastSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterMatchChainRewardForecastCues.slice(0, 3).length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-chain-reward-forecast-summary-beat={index + 1}
                                                                data-chain-reward-forecast-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`reward-forecast-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            {boardFloaterMatchChainRewardForecastCues.slice(0, 3).map((cue) => {
                                                const stackLabel = getChainRewardStackLabel(cue);
                                                const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);
                                                const beatCount = getBoardFloaterRewardForecastBeatCount(cue);
                                                const progressFill = progress
                                                    ? `${Math.max(0, Math.min(100, (progress.filled / progress.total) * 100))}%`
                                                    : '0%';

                                                return (
                                                    <span
                                                        data-chain-reward-arcade-cue={getChainRewardUrgencyCopy(cue)}
                                                        data-chain-reward-audio={getBoardFloaterRewardForecastAudioCue(cue)}
                                                        data-chain-reward-beats={beatCount}
                                                        data-chain-reward-distance={cue.distance}
                                                        data-chain-reward-progress-filled={progress?.filled ?? 0}
                                                        data-chain-reward-progress-total={progress?.total ?? 0}
                                                        data-chain-reward-lane-action={getChainRewardLaneAction(cue.urgency)}
                                                        data-chain-reward-progress={progress?.label ?? 'none'}
                                                        data-chain-reward-screen-cue={getBoardFloaterRewardForecastScreenCue(cue)}
                                                        data-chain-reward-stack-size={cue.stackSize ?? 1}
                                                        data-chain-reward-tone={cue.tone}
                                                        data-chain-reward-urgency={cue.urgency}
                                                        style={
                                                            progress
                                                                ? ({
                                                                      '--chain-reward-progress-fill': progressFill
                                                                  } as CSSProperties)
                                                                : undefined
                                                        }
                                                        key={cue.id}
                                                    >
                                                        <strong>{cue.chaseLabel}</strong>
                                                        <small>{cue.actionLabel}</small>
                                                        <u>{getChainRewardLaneAction(cue.urgency)}</u>
                                                        <b>{cue.label}</b>
                                                        <em>{cue.distanceLabel}</em>
                                                        <i>{getChainRewardUrgencyCopy(cue)}</i>
                                                        {progress ? (
                                                            <span className={styles.boardFloaterRewardProgress}>
                                                                {progress.label}
                                                            </span>
                                                        ) : null}
                                                        {stackLabel ? (
                                                            <>
                                                                <mark className={styles.boardFloaterRewardStackLabel}>{stackLabel}</mark>
                                                                <span aria-hidden="true" className={styles.boardFloaterRewardStackPips}>
                                                                    {Array.from({ length: cue.stackSize ?? 1 }, (_, index) => (
                                                                        <i
                                                                            data-chain-reward-stack-beat={index + 1}
                                                                            data-chain-reward-stack-beat-focus={
                                                                                index === 0 ? 'primary' : 'support'
                                                                            }
                                                                            key={`${cue.id}-board-reward-stack-${index + 1}`}
                                                                        />
                                                                    ))}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                        <span aria-hidden="true" className={styles.boardFloaterRewardBeatPips}>
                                                            {Array.from({ length: beatCount }, (_, index) => (
                                                                <i
                                                                    data-chain-reward-beat={index + 1}
                                                                    data-chain-reward-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                    key={`${cue.id}-board-reward-beat-${index + 1}`}
                                                                />
                                                            ))}
                                                        </span>
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' &&
                                    boardFloaterMatchPayoffChips.length > 0 ? (
                                        <span
                                            aria-label={`Match score payoff chips. ${boardFloaterMatchPayoffChips
                                                .map((chip) => `${chip.arcadeCue ? `${chip.arcadeCue}: ` : ''}${chip.label}: ${chip.value}`)
                                                .join('. ')}.`}
                                            className={styles.boardFloaterPayoffChips}
                                            data-testid="match-score-floater-payoff-chips"
                                        >
                                            {boardFloaterMatchPayoffChips.map((chip) => (
                                                <span
                                                    data-match-payoff-arcade-cue={chip.arcadeCue ?? 'none'}
                                                    data-match-payoff-arcade-screen-cue={getMatchPayoffChipScreenCue(chip)}
                                                    data-match-payoff-audio={getMatchPayoffChipAudioCue(chip)}
                                                    data-match-payoff-beats={getMatchPayoffChipBeatCount(chip)}
                                                    data-match-payoff-id={chip.id}
                                                    data-match-payoff-screen-cue={getMatchPayoffChipScreenCue(chip)}
                                                    data-match-payoff-tone={chip.tone}
                                                    key={chip.id}
                                                >
                                                    {chip.arcadeCue ? <em>{chip.arcadeCue}</em> : null}
                                                    <small>{chip.label}</small>
                                                    <b>{chip.value}</b>
                                                    <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                                        {Array.from({ length: getMatchPayoffChipBeatCount(chip) }, (_, index) => (
                                                            <i
                                                                data-match-payoff-chip-beat={index + 1}
                                                                data-match-payoff-chip-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`match-payoff-chip-beat-${chip.id}-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterTraitLaneMap.length > 1 ? (
                                        <span
                                            aria-label={formatTraitInteractionLaneMapLabel(
                                                'Match trait interaction lanes',
                                                boardFloaterTraitLaneMap
                                            )}
                                            className={styles.boardFloaterTraitLaneMap}
                                            data-match-trait-lane-actions={boardFloaterTraitLaneActionMapAttr}
                                            data-match-trait-lane-map={boardFloaterTraitLaneMapAttr}
                                            data-match-trait-primary-lane={boardFloaterPrimaryTraitLane?.id ?? 'none'}
                                            data-match-trait-primary-lane-action={
                                                boardFloaterPrimaryTraitLane
                                                    ? getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)
                                                    : 'none'
                                            }
                                            data-match-trait-primary-lane-audio={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneAudioCue(boardFloaterPrimaryTraitLane)
                                                    : 'none'
                                            }
                                            data-match-trait-primary-lane-beats={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)
                                                    : 0
                                            }
                                            data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane?.cue ?? 'none'}
                                            data-match-trait-primary-lane-screen-cue={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneScreenCue(boardFloaterPrimaryTraitLane)
                                                    : 'none'
                                            }
                                            data-testid="match-score-floater-trait-lane-map"
                                        >
                                            <span
                                                className={styles.boardFloaterTraitLaneMapSummary}
                                                data-match-trait-lane-count={boardFloaterTraitLaneMap.length}
                                                data-match-trait-lane-summary-fill={boardFloaterTraitLaneMapSummaryFill}
                                                data-match-trait-lane-summary-total={Math.max(1, Math.min(5, boardFloaterTraitLaneMap.length))}
                                                style={
                                                    {
                                                        '--trait-lane-summary-fill': `${boardFloaterTraitLaneMapSummaryFill}%`
                                                    } as CSSProperties
                                                }
                                                data-testid="match-score-floater-trait-lane-map-summary"
                                            >
                                                <small>Traits</small>
                                                <b>
                                                    {boardFloaterTraitLaneMap.length}{' '}
                                                    {boardFloaterTraitLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterTraitLaneMapSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterTraitLaneMap.length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-trait-lane-map-summary-beat={index + 1}
                                                                data-match-trait-lane-map-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`trait-lane-map-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                )}
                                                </span>
                                                <span aria-hidden="true" className={styles.boardFloaterTraitLaneMapSummaryMeter} />
                                            </span>
                                            {boardFloaterPrimaryTraitLane ? (
                                                <span
                                                    aria-label={`Primary trait payoff lane. ${boardFloaterPrimaryTraitLane.label}: ${getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}. ${boardFloaterPrimaryTraitLane.cue}. ${getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)} beats.`}
                                                    className={styles.boardFloaterPrimaryTraitLane}
                                                    data-match-trait-primary-lane={boardFloaterPrimaryTraitLane.id}
                                                    data-match-trait-primary-lane-action={getTraitInteractionLaneAction(
                                                        boardFloaterPrimaryTraitLane.id
                                                    )}
                                                    data-match-trait-primary-lane-audio={getBoardFloaterTraitLaneAudioCue(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-match-trait-primary-lane-beats={getBoardFloaterTraitLaneBeatCount(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane.cue}
                                                    data-match-trait-primary-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-match-trait-primary-lane-fill={boardFloaterPrimaryTraitLaneFill}
                                                    style={
                                                        {
                                                            '--trait-lane-primary-fill': `${boardFloaterPrimaryTraitLaneFill}%`
                                                        } as CSSProperties
                                                    }
                                                    data-testid="match-score-floater-primary-trait-lane"
                                                >
                                                    <small>Trait focus</small>
                                                    <b>{boardFloaterPrimaryTraitLane.label}</b>
                                                    <strong>{getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}</strong>
                                                    <em>{boardFloaterPrimaryTraitLane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterPrimaryTraitLaneBeatPips}>
                                                        {Array.from(
                                                            { length: getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-match-trait-primary-lane-beat={beatIndex + 1}
                                                                    data-match-trait-primary-lane-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterTraitLaneMap.map((lane) => (
                                                <span
                                                    data-match-trait-lane={lane.id}
                                                    data-match-trait-lane-action={getTraitInteractionLaneAction(lane.id)}
                                                    data-match-trait-lane-audio={getBoardFloaterTraitLaneAudioCue(lane)}
                                                    data-match-trait-lane-beats={getBoardFloaterTraitLaneBeatCount(lane)}
                                                    data-match-trait-lane-count={lane.count}
                                                    data-match-trait-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(lane)}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    {lane.count > 1 ? <b>x{lane.count}</b> : null}
                                                    <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                                                    <em>{lane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterTraitLaneBeatPips}>
                                                        {Array.from({ length: getBoardFloaterTraitLaneBeatCount(lane) }, (_, index) => (
                                                            <i
                                                                data-match-trait-lane-beat={index + 1}
                                                                data-match-trait-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`${lane.id}-trait-lane-beat-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterDetailLines.slice(0, 2).map((line) => (
                                        <span className={styles.boardFloaterTraitLine} key={line}>
                                            {line}
                                        </span>
                                    ))}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecovery ? (
                                        <span
                                            className={styles.boardFloaterRecoveryHint}
                                            data-testid="mismatch-score-floater-recovery"
                                        >
                                            {boardFloaterMismatchRecovery}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchNextAction ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchNextAction.arcadeCue}: ${boardFloaterMismatchNextAction.label}: ${boardFloaterMismatchNextAction.value}`}
                                            className={styles.boardFloaterNextAction}
                                            data-mismatch-next-action-cue={boardFloaterMismatchNextAction.arcadeCue}
                                            data-mismatch-next-action={boardFloaterMismatchNextAction.tone}
                                            data-testid="mismatch-score-floater-next-action"
                                        >
                                            <em>{boardFloaterMismatchNextAction.arcadeCue}</em>
                                            <small>{boardFloaterMismatchNextAction.label}</small>
                                            <b>{boardFloaterMismatchNextAction.value}</b>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryBurst ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoveryBurst.label}: ${boardFloaterMismatchRecoveryBurst.value}`}
                                            className={styles.boardFloaterRecoveryBurst}
                                            data-recovery-burst-tier={boardFloaterMismatchRecoveryBurst.tier}
                                            data-recovery-burst-fill={boardFloaterMismatchRecoveryBurstFill}
                                            style={
                                                {
                                                    '--recovery-burst-fill': `${boardFloaterMismatchRecoveryBurstFill}%`
                                                } as CSSProperties
                                            }
                                            data-testid="mismatch-score-floater-recovery-burst"
                                        >
                                            <small>{boardFloaterMismatchRecoveryBurst.label}</small>
                                            <b>{boardFloaterMismatchRecoveryBurst.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterRecoveryBurstMeter} />
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryCrescendo ? (
                                        <span
                                            aria-label={boardFloaterMismatchRecoveryCrescendoLabel}
                                            className={styles.boardFloaterRecoveryCrescendo}
                                            data-mismatch-recovery-crescendo-screen-cue={
                                                boardFloaterMismatchRecoveryCrescendo.screenCue
                                            }
                                            data-mismatch-recovery-crescendo-tier={
                                                boardFloaterMismatchRecoveryCrescendo.tier
                                            }
                                            data-testid="mismatch-score-floater-recovery-crescendo"
                                        >
                                            <small>{boardFloaterMismatchRecoveryCrescendo.label}</small>
                                            <strong>
                                                {Array.from({ length: boardFloaterMismatchRecoveryCrescendo.beatCount }).map(
                                                    (_, index) => (
                                                        <i aria-hidden="true" key={`mismatch-recovery-beat-${index}`} />
                                                    )
                                                )}
                                            </strong>
                                            <em>{boardFloaterMismatchRecoveryCrescendo.detail}</em>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryStack ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoveryStack.label}: ${boardFloaterMismatchRecoveryStack.value}. ${boardFloaterMismatchRecoveryStack.detail}`}
                                            className={styles.boardFloaterRecoveryStack}
                                            data-mismatch-recovery-stack={boardFloaterMismatchRecoveryStack.tone}
                                            data-testid="mismatch-score-floater-recovery-stack"
                                        >
                                            <small>{boardFloaterMismatchRecoveryStack.label}</small>
                                            <b>{boardFloaterMismatchRecoveryStack.value}</b>
                                            <em>{boardFloaterMismatchRecoveryStack.detail}</em>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoverySequence ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoverySequence.label}. First: ${boardFloaterMismatchRecoverySequence.first}. Then: ${boardFloaterMismatchRecoverySequence.then}. Keep: ${boardFloaterMismatchRecoverySequence.keep}.`}
                                            className={styles.boardFloaterRecoverySequence}
                                            data-mismatch-recovery-sequence={boardFloaterMismatchRecoverySequence.tone}
                                            data-mismatch-sequence-first={boardFloaterMismatchRecoverySequence.first}
                                            data-mismatch-sequence-keep={boardFloaterMismatchRecoverySequence.keep}
                                            data-mismatch-sequence-then={boardFloaterMismatchRecoverySequence.then}
                                            data-testid="mismatch-score-floater-recovery-sequence"
                                        >
                                            <small>First</small>
                                            <b>{boardFloaterMismatchRecoverySequence.first}</b>
                                            <small>Then</small>
                                            <b>{boardFloaterMismatchRecoverySequence.then}</b>
                                            <small>Keep</small>
                                            <b>{boardFloaterMismatchRecoverySequence.keep}</b>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryLaneMap ? (
                                        <span
                                            aria-label={mismatchRecoveryLaneMapLabel(boardFloaterMismatchRecoveryLaneMap)}
                                            className={styles.boardFloaterRecoveryLaneMap}
                                            data-mismatch-recovery-lane-actions={mismatchRecoveryLaneActionMapAttr(
                                                boardFloaterMismatchRecoveryLaneMap
                                            )}
                                            data-mismatch-recovery-lane-map-fill={boardFloaterMismatchRecoveryLaneMapFill}
                                            data-mismatch-recovery-lane-map={mismatchRecoveryLaneMapAttr(boardFloaterMismatchRecoveryLaneMap)}
                                            data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane?.id ?? 'none'}
                                            data-mismatch-recovery-primary-lane-action={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            data-mismatch-recovery-primary-lane-audio={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneAudioCue(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            data-mismatch-recovery-primary-lane-beats={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 0
                                            }
                                            data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane?.cue ?? 'none'}
                                            data-mismatch-recovery-primary-lane-screen-cue={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneScreenCue(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            style={
                                                {
                                                    '--mismatch-recovery-lane-map-fill': `${boardFloaterMismatchRecoveryLaneMapFill}%`
                                                } as CSSProperties
                                            }
                                            data-testid="mismatch-score-floater-recovery-lane-map"
                                        >
                                            <span aria-hidden="true" className={styles.boardFloaterRecoveryLaneMapMeter} />
                                            {boardFloaterPrimaryMismatchRecoveryLane ? (
                                                <span
                                                    aria-label={`Primary recovery lane. ${boardFloaterPrimaryMismatchRecoveryLane.label}: ${mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}. ${boardFloaterPrimaryMismatchRecoveryLane.cue}. ${getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)} beats.`}
                                                    className={styles.boardFloaterRecoveryPrimaryLane}
                                                    data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane.id}
                                                    data-mismatch-recovery-primary-lane-action={mismatchRecoveryLaneAction(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-audio={getMismatchRecoveryLaneAudioCue(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-beats={getMismatchRecoveryLaneBeatCount(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane.cue}
                                                    data-mismatch-recovery-primary-lane-screen-cue={getMismatchRecoveryLaneScreenCue(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-fill={boardFloaterPrimaryMismatchRecoveryLaneFill}
                                                    style={
                                                        {
                                                            '--mismatch-recovery-primary-lane-fill': `${boardFloaterPrimaryMismatchRecoveryLaneFill}%`
                                                        } as CSSProperties
                                                    }
                                                    data-testid="mismatch-score-floater-primary-recovery-lane"
                                                >
                                                    <small>Recovery focus</small>
                                                    <b>{boardFloaterPrimaryMismatchRecoveryLane.label}</b>
                                                    <strong>
                                                        {mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}
                                                    </strong>
                                                    <em>{boardFloaterPrimaryMismatchRecoveryLane.cue}</em>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.boardFloaterRecoveryPrimaryLaneBeatPips}
                                                    >
                                                        {Array.from(
                                                            {
                                                                length: getMismatchRecoveryLaneBeatCount(
                                                                    boardFloaterPrimaryMismatchRecoveryLane
                                                                )
                                                            },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-mismatch-recovery-primary-lane-beat={beatIndex + 1}
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterMismatchRecoveryLaneMap.map((lane) => (
                                                <span
                                                    data-mismatch-recovery-lane={lane.id}
                                                    data-mismatch-recovery-lane-action={mismatchRecoveryLaneAction(lane)}
                                                    data-mismatch-recovery-lane-audio={getMismatchRecoveryLaneAudioCue(lane)}
                                                    data-mismatch-recovery-lane-beats={getMismatchRecoveryLaneBeatCount(lane)}
                                                    data-mismatch-recovery-lane-count={lane.count}
                                                    data-mismatch-recovery-lane-screen-cue={getMismatchRecoveryLaneScreenCue(lane)}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    <b>{lane.count}</b>
                                                    <strong>{mismatchRecoveryLaneAction(lane)}</strong>
                                                    <em>{lane.cue}</em>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.boardFloaterRecoveryLaneBeatPips}
                                                    >
                                                        {Array.from(
                                                            { length: getMismatchRecoveryLaneBeatCount(lane) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-mismatch-recovery-lane-beat={beatIndex + 1}
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryChips.length > 0 ? (
                                        <span
                                            className={styles.boardFloaterRecoveryChips}
                                            data-testid="mismatch-score-floater-recovery-chips"
                                        >
                                            {boardFloaterMismatchRecoveryChips.map((chip) => {
                                                const chipBeatCount = getMismatchRecoveryChipBeatCount(chip);
                                                const chipFill = Math.min(100, (chipBeatCount / 4) * 100);

                                                return (
                                                    <span
                                                        aria-label={`${chip.arcadeCue}: ${chip.label}: ${chip.value}`}
                                                        data-mismatch-recovery-chip={chip.tone}
                                                        data-mismatch-recovery-chip-audio={getMismatchRecoveryChipAudioCue(chip)}
                                                        data-mismatch-recovery-chip-beats={chipBeatCount}
                                                        data-mismatch-recovery-chip-fill={chipFill}
                                                        data-mismatch-recovery-chip-cue={chip.arcadeCue}
                                                        data-mismatch-recovery-chip-screen-cue={getMismatchRecoveryChipScreenCue(chip)}
                                                        data-mismatch-recovery-urgency={chip.urgency ?? 'none'}
                                                        key={chip.id}
                                                        style={
                                                            {
                                                                '--mismatch-recovery-chip-fill': `${chipFill}%`
                                                            } as CSSProperties
                                                        }
                                                    >
                                                        <em>{chip.arcadeCue}</em>
                                                        <small>{chip.label}</small>
                                                        <b>{chip.value}</b>
                                                        <span
                                                            aria-hidden="true"
                                                            className={styles.boardFloaterRecoveryChipMeter}
                                                        />
                                                        <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                                            {Array.from({ length: chipBeatCount }, (_, index) => (
                                                                <i
                                                                    data-mismatch-recovery-chip-beat={index + 1}
                                                                    key={`mismatch-recovery-chip-beat-${chip.id}-${index + 1}`}
                                                                />
                                                            ))}
                                                        </span>
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                            {distractionHudOn ? (
                                <div
                                    aria-hidden="true"
                                    className={styles.distractionHud}
                                    data-testid="distraction-channel-hud"
                                >
                                    <div className={styles.distractionHudPlate}>
                                        <span className={styles.distractionHudLabel}>{DISTRACTION_CHANNEL_LABEL}</span>
                                        <span className={styles.distractionHudValue}>
                                            {(distractionTick % 7) + 3}
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            {onboardingStep && run.status === 'playing' ? (
                                <aside className={styles.playableOnboardingPrompt} data-testid="playable-onboarding-prompt">
                                    <span className={styles.playableOnboardingStep}>{onboardingStep.title}</span>
                                    <strong>{onboardingStep.prompt}</strong>
                                    <p>{onboardingStep.detail}</p>
                                    <div
                                        className={styles.onboardingPromptSignals}
                                        data-testid="playable-onboarding-signals"
                                        aria-label={onboardingPromptSignalsLabel}
                                    >
                                        {onboardingPromptSignals.map((row) => {
                                            const beatCount = getOnboardingPromptSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-onboarding-signal-audio={getOnboardingPromptSignalAudioCue(row)}
                                                    data-onboarding-signal-beats={beatCount}
                                                    data-onboarding-signal-screen-cue={getOnboardingPromptSignalScreenCue(row)}
                                                    data-onboarding-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.onboardingPromptBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-onboarding-signal-beat={index + 1}
                                                                data-onboarding-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </aside>
                            ) : null}
                            {firstRunRoomGoalPrompt ? (
                                <aside className={styles.playableOnboardingPrompt} data-testid="first-run-room-goal-prompt">
                                    <span className={styles.playableOnboardingStep}>{firstRunRoomGoalPrompt.title}</span>
                                    <strong>{firstRunRoomGoalPrompt.prompt}</strong>
                                    <p>{firstRunRoomGoalPrompt.detail}</p>
                                    <div
                                        className={styles.onboardingPromptSignals}
                                        data-testid="first-run-room-goal-signals"
                                        aria-label={firstRunRoomGoalSignalsLabel}
                                    >
                                        {firstRunRoomGoalSignals.map((row) => {
                                            const beatCount = getOnboardingPromptSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-onboarding-signal-audio={getOnboardingPromptSignalAudioCue(row)}
                                                    data-onboarding-signal-beats={beatCount}
                                                    data-onboarding-signal-screen-cue={getOnboardingPromptSignalScreenCue(row)}
                                                    data-onboarding-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.onboardingPromptBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-onboarding-signal-beat={index + 1}
                                                                data-onboarding-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </aside>
                            ) : null}
                        </div>
                        <GameLeftToolbar
                            applyFlashPairPower={applyFlashPairPower}
                            boardPinMode={boardPinMode}
                            cameraViewportMode={cameraViewportMode}
                            canRegionShuffleRow={canRegionShuffleRowForRun}
                            destroyDisabled={destroyDisabled}
                            destroyPairArmed={destroyPairArmed}
                            flashPairDisabled={flashPairDisabled}
                            flashPairTitle={flashPairTitle}
                            maxPinnedTiles={MAX_PINNED_TILES}
                            onRequestAbandonRun={handleRequestAbandonRun}
                            onViewportReset={handleToolbarViewportReset}
                            openCodexFromPlaying={openCodexFromPlaying}
                            openInventoryFromPlaying={openInventoryFromPlaying}
                            openSettingsPlaying={openSettingsPlayingMode}
                            peekModeArmed={peekModeArmed}
                            regionShuffleDisabled={regionShuffleDisabled}
                            regionShuffleTitle={regionShuffleTitle}
                            rulesHintNudge={rulesHintNudge}
                            rulesHintsExpanded={rulesHintsExpanded}
                            run={run}
                            setRulesHintsExpanded={setRulesHintsExpanded}
                            debugFlags={toolbarDebugFlags}
                            showBoardPowerBar={showBoardPowerBar}
                            showFlashPairPower={showFlashPairPower}
                            showForgivenessHint={showForgivenessHint}
                            shuffleBoard={shuffleBoard}
                            shuffleDisabled={shuffleDisabled}
                            shuffleRegionRow={shuffleRegionRow}
                            shuffleTitle={shuffleTitle}
                            strayRemoveArmed={strayRemoveArmed}
                            tileBoardRef={tileBoardRef}
                            tileSwapArmed={tileSwapArmed}
                            tileSwapDisabled={tileSwapDisabled}
                            tileSwapFirstTileId={tileSwapFirstTileId}
                            tileSwapTitle={tileSwapTitle}
                            toggleBoardPinMode={toggleBoardPinMode}
                            toggleDestroyPairArmed={toggleDestroyPairArmed}
                            togglePeekMode={togglePeekMode}
                            toggleTileSwapArmed={toggleTileSwapArmed}
                            toggleStrayArm={toggleStrayArm}
                            triggerDebugReveal={triggerDebugReveal}
                            undoResolvingFlip={undoResolvingFlip}
                        />
                    </div>
                </div>
                </div>

                {!suppressStatusOverlays && dungeonExitPromptOpen && dungeonExitStatus.exitTile ? (
                    <OverlayModal
                        actions={[
                            ...(dungeonExitStatus.canActivateWithoutSpend ||
                            (dungeonExitStatus.lockKind === 'lever' && dungeonExitStatus.canActivate)
                                ? [
                                      {
                                          label: 'Proceed',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('none');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            ...(dungeonExitStatus.canActivateWithKey
                                ? [
                                      {
                                          label: 'Use key',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('key');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            ...(dungeonExitStatus.canActivateWithMasterKey
                                ? [
                                      {
                                          label: 'Use master key',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('master_key');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            {
                                label: 'Stay',
                                onClick: () => {
                                    playUiBack();
                                    closeDungeonExitPrompt();
                                },
                                variant: 'secondary'
                            }
                        ]}
                        headerPlateTone="success"
                        onEscape={() => {
                            playUiBack();
                            closeDungeonExitPrompt();
                        }}
                        ornamentalHeaderPlate
                        subtitle={`${dungeonExitRouteLine} ${dungeonExitLockLine}`}
                        testId="dungeon-exit-overlay"
                        title={dungeonExitPromptTitle(dungeonExitStatus)}
                    >
                        {dungeonExitStatus.lockedReason ? (
                            <p className={styles.modalNote}>{dungeonExitStatus.lockedReason}</p>
                        ) : (
                            <p className={styles.modalNote}>Proceeding seals the remaining cards on this floor.</p>
                        )}
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays && !abandonRunConfirmOpen && run.status === 'paused' && (
                    <OverlayModal
                        actions={[
                            { label: 'Resume', onClick: resume, variant: 'primary' },
                            {
                                label: 'Retreat',
                                onClick: () => {
                                    playMenuOpen();
                                    setAbandonRunConfirmOpen(true);
                                },
                                variant: 'danger'
                            }
                        ]}
                        headerPlateTone="pause"
                        onEscape={resume}
                        ornamentalHeaderPlate
                        subtitle="Game is paused. The board, memorize phase, and debug timers stay frozen until you resume or retreat. Press P to resume."
                        testId="game-pause-overlay"
                        title="Run paused"
                    />
                )}

                {!suppressStatusOverlays && run.relicOffer ? (
                    <OverlayModal
                        actions={[]}
                        headerPlateTone="relic"
                        ornamentalHeaderPlate
                        subtitle={getRelicOfferSubtitle(
                            run.lastLevelResult?.level ?? 0,
                            run.relicOffer.picksRemaining
                        )}
                        testId="game-relic-offer-overlay"
                        title={getRelicOfferTitle(run.relicOffer.tier)}
                    >
                        {relicDraftProgressText ? (
                            <p className={styles.relicDraftProgress}>{relicDraftProgressText}</p>
                        ) : null}
                        {relicBonusFootnoteLines.length > 0 ? (
                            <ul className={styles.relicDraftBonusList}>
                                {relicBonusFootnoteLines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                        <RelicDraftOfferPanel
                            currentRelicIds={run.relicIds}
                            descriptionById={relicEffectLabels}
                            onUseService={applyRelicOfferService}
                            onPick={pickRelic}
                            optionIds={run.relicOffer.options}
                            payoffEngineSignal={relicDraftPayoffEngineSignal}
                            pickRound={run.relicOffer.pickRound}
                            reasonById={run.relicOffer.contextualOptionReasons}
                            serviceActions={run.relicOffer.services}
                            sfxGain={shuffleSfxGain}
                        />
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays &&
                    !abandonRunConfirmOpen &&
                    run.status === 'levelComplete' &&
                    run.lastLevelResult &&
                    !run.relicOffer && (
                    <OverlayModal
                        actions={[
                            ...(routeChoiceRequired
                                ? []
                                : [
                                      {
                                          label: run.pendingRouteCardPlan
                                              ? `Continue to ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
                                              : 'Continue',
                                          onClick: continueToNextLevel,
                                          variant: 'primary' as const
                                      }
                                  ]),
                            ...(run.shopOffers.length > 0 && !routeChoiceRequired
                                ? [
                                      {
                                          label: 'Visit Shop',
                                          onClick: () => {
                                              playUiClick();
                                              openShopFromLevelComplete();
                                          },
                                          variant: 'secondary' as const
                                      }
                                  ]
                                : []),
                            {
                                label: 'Main Menu',
                                onClick: () => {
                                    playMenuOpen();
                                    setAbandonRunConfirmOpen(true);
                                },
                                variant: 'secondary'
                            }
                        ]}
                        headerPlateTone="success"
                        ornamentalHeaderPlate
                        quietHeaderPlate
                        subtitle={`Level ${runNonNegativeInteger(run.lastLevelResult.level)} cleared. Score +${runNonNegativeInteger(run.lastLevelResult.scoreGained)}. Try Daily or Scholar contract from the menu for different goals.`}
                        title="Floor cleared"
                    >
                        <div
                            className={styles.floorClearResultStack}
                            data-route-choice-required={routeChoiceRequired ? 'true' : 'false'}
                            data-testid="floor-clear-result-stack"
                        >
                            {floorClearMomentumRows.length > 0 ? (
                                <div
                                    aria-label={floorClearMomentumRowsLabel}
                                    className={styles.floorClearMomentumStrip}
                                    data-testid="floor-clear-momentum-strip"
                                >
                                    {floorClearMomentumRows.map((row) => (
                                        <span className={styles.floorClearMomentumChip} data-momentum-kind={row.id} key={row.id}>
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {floorClearPayoffStackSignal ? (
                                <div
                                    aria-label={`${floorClearPayoffStackSignal.label}: ${floorClearPayoffStackSignal.value}. ${getFloorClearPayoffStackAction(
                                        floorClearPayoffStackSignal
                                    )}. ${getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal)} beats. ${
                                        floorClearPayoffStackSignal.detail
                                    }`}
                                    className={styles.floorClearPayoffStackSignal}
                                    data-floor-payoff-stack-action={getFloorClearPayoffStackAction(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-audio={getFloorClearPayoffStackAudioCue(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-beats={getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-screen-cue={getFloorClearPayoffStackScreenCue(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-tone={floorClearPayoffStackSignal.tone}
                                    data-testid="floor-clear-payoff-stack"
                                >
                                    <small>{floorClearPayoffStackSignal.label}</small>
                                    <strong>{floorClearPayoffStackSignal.value}</strong>
                                    <span aria-hidden="true" className={styles.floorClearPayoffStackBeatPips}>
                                        {Array.from(
                                            { length: getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal) },
                                            (_, index) => (
                                                <i
                                                    data-floor-payoff-stack-beat={index + 1}
                                                    data-floor-payoff-stack-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            )
                                        )}
                                    </span>
                                    <b>{getFloorClearPayoffStackAction(floorClearPayoffStackSignal)}</b>
                                    <em>{floorClearPayoffStackSignal.detail}</em>
                                </div>
                            ) : null}
                            {floorClearCashoutRows.length > 0 ? (
                                <div
                                    aria-label={floorClearCashoutRowsLabel}
                                    className={styles.floorClearCashoutStrip}
                                    data-testid="floor-clear-cashout-strip"
                                >
                                    {floorClearCashoutRows.map((row) => (
                                        <span data-cashout-tone={row.tone} key={row.id}>
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                            <em>{row.detail}</em>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {floorClearCarryForwardCue ? (
                                <div
                                    aria-label={`${floorClearCarryForwardCue.label}: ${floorClearCarryForwardCue.value}. ${floorClearCarryForwardCue.detail}`}
                                    className={styles.floorClearCarryForwardCue}
                                    data-carry-forward-tone={floorClearCarryForwardCue.tone}
                                    data-testid="floor-clear-carry-forward"
                                >
                                    <small>{floorClearCarryForwardCue.label}</small>
                                    <strong>{floorClearCarryForwardCue.value}</strong>
                                    <em>{floorClearCarryForwardCue.detail}</em>
                                </div>
                            ) : null}
                            {floorClearActionSequenceCue ? (
                                <div
                                    aria-label={`${floorClearActionSequenceCue.label}. First: ${floorClearActionSequenceCue.first}. Then: ${floorClearActionSequenceCue.then}. Keep: ${floorClearActionSequenceCue.keep}.`}
                                    className={styles.floorClearActionSequenceCue}
                                    data-floor-clear-sequence-first={floorClearActionSequenceCue.first}
                                    data-floor-clear-sequence-keep={floorClearActionSequenceCue.keep}
                                    data-floor-clear-sequence-then={floorClearActionSequenceCue.then}
                                    data-floor-clear-sequence-tone={floorClearActionSequenceCue.tone}
                                    data-testid="floor-clear-action-sequence"
                                >
                                    <small>{floorClearActionSequenceCue.label}</small>
                                    <span>
                                        <b>First</b>
                                        <strong>{floorClearActionSequenceCue.first}</strong>
                                    </span>
                                    <span>
                                        <b>Then</b>
                                        <strong>{floorClearActionSequenceCue.then}</strong>
                                    </span>
                                    <span>
                                        <b>Keep</b>
                                        <strong>{floorClearActionSequenceCue.keep}</strong>
                                    </span>
                                </div>
                            ) : null}
                            {floorClearObjectiveSignalRows.length > 0 ? (
                                <div
                                    aria-label={floorClearObjectiveSignalRowsLabel}
                                    className={styles.floorClearObjectiveStrip}
                                    data-testid="floor-clear-objective-strip"
                                >
                                    {floorClearObjectiveSignalRows.map((row) => {
                                        const beatCount = getFloorClearObjectiveSignalBeatCount(row);
                                        return (
                                            <span
                                                data-objective-audio={getFloorClearObjectiveSignalAudioCue(row)}
                                                data-objective-beats={beatCount}
                                                data-objective-screen-cue={getFloorClearObjectiveSignalScreenCue(row)}
                                                data-objective-tone={row.tone}
                                                key={row.id}
                                            >
                                                <small>{row.label}</small>
                                                <strong>{row.value}</strong>
                                                <span
                                                    aria-hidden="true"
                                                    className={styles.floorClearObjectiveBeatPips}
                                                >
                                                    {Array.from({ length: beatCount }, (_, index) => (
                                                        <i
                                                            data-objective-beat={index + 1}
                                                            data-objective-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {floorClearCausalityRows.length > 0 ? (
                                <div
                                    aria-label={floorClearCausalityRowsLabel}
                                    className={styles.floorClearCausalityGrid}
                                    data-testid="floor-clear-causality-grid"
                                >
                                    {floorClearCausalityRows.map((row) => (
                                        <p
                                            className={styles.modalNote}
                                            data-causality-group={row.group}
                                            data-mechanic-tokens={row.tokens.join(' ')}
                                            key={row.id}
                                        >
                                            <strong>{row.label}:</strong> {row.detail}
                                        </p>
                                    ))}
                                </div>
                            ) : null}
                            {clearLifeBonusLabel ? <p className={styles.modalNote}>{clearLifeBonusLabel}</p> : null}
                            <p className={styles.modalNote}>{FLOOR_CLEAR_LIFE_CARRYOVER_NOTE}</p>
                            {featuredObjectiveResultLine ? <p className={styles.modalNote}>{featuredObjectiveResultLine}</p> : null}
                            {featuredObjectiveFailureLine ? <p className={styles.modalNote}>{featuredObjectiveFailureLine}</p> : null}
                            {featuredObjectiveStreakLine ? <p className={styles.modalNote}>{featuredObjectiveStreakLine}</p> : null}
                            {endlessRiskWagerOutcomeLine ? <p className={styles.modalNote}>{endlessRiskWagerOutcomeLine}</p> : null}
                            {favorGainLine ? <p className={styles.modalNote}>{favorGainLine}</p> : null}
                            {favorBankedLine ? <p className={styles.modalNote}>{favorBankedLine}</p> : null}
                            {firstClearOnboardingLine ? <p className={styles.modalNote}>{firstClearOnboardingLine}</p> : null}
                            {objectiveBonusLine ? <p className={styles.modalNote}>{objectiveBonusLine}</p> : null}
                            {traitRouteObjectiveLine ? <p className={styles.modalNote}>{traitRouteObjectiveLine}</p> : null}
                            {bonusTagsLine ? <p className={styles.modalNote}>{bonusTagsLine}</p> : null}
                            {nextFloorSignalRows.length > 0 ? (
                                <div
                                    aria-label={nextFloorSignalRowsLabel}
                                    className={styles.floorClearNextSignalStrip}
                                    data-testid="floor-clear-next-signal-strip"
                                >
                                    {nextFloorSignalRows.map((row) => {
                                        const beatCount = getNextFloorSignalBeatCount(row);
                                        return (
                                            <span
                                                data-next-audio={getNextFloorSignalAudioCue(row)}
                                                data-next-beats={beatCount}
                                                data-next-screen-cue={getNextFloorSignalScreenCue(row)}
                                                data-next-tone={row.tone}
                                                key={row.id}
                                            >
                                                <small>{row.label}</small>
                                                <strong>{row.value}</strong>
                                                <span aria-hidden="true" className={styles.floorClearNextBeatPips}>
                                                    {Array.from({ length: beatCount }, (_, index) => (
                                                        <i
                                                            data-next-beat={index + 1}
                                                            data-next-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                {row.detail ? <em>{row.detail}</em> : null}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {currentDungeonNode ? (
                                <p className={styles.modalNote}>
                                    Cleared node: {currentDungeonNode.label}. Choose a connected room to shape the next board.
                                </p>
                            ) : null}
                        </div>
                        {pendingRouteLine && pendingRouteSignalLabels && pendingRouteImpactCue && pendingRouteActionCue && run.pendingRouteCardPlan ? (
                            <div
                                className={styles.routeSelectedNote}
                                data-route-action-cue={pendingRouteActionCue.label}
                                data-route-action-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteActionCue.tone)}
                                data-route-action-cue-beats={getRouteChoiceToneBeatCount(pendingRouteActionCue.tone)}
                                data-route-action-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteActionCue.tone)}
                                data-route-action-cue-tone={pendingRouteActionCue.tone}
                                data-route-impact-cue={pendingRouteImpactCue.label}
                                data-route-impact-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-beats={getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-tone={pendingRouteImpactCue.tone}
                                data-route-type={run.pendingRouteCardPlan.routeType}
                                data-testid="route-selected-note"
                            >
                                <span className={styles.routeSelectedCopy}>{pendingRouteLine}</span>
                                <span
                                    aria-label={`Selected route impact cue: ${pendingRouteImpactCue.label}: ${pendingRouteImpactCue.value}.`}
                                    className={styles.routeSelectedImpactCue}
                                    data-route-impact-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-beats={getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-tone={pendingRouteImpactCue.tone}
                                    data-testid="route-selected-impact-cue"
                                >
                                    <small>{pendingRouteImpactCue.label}</small>
                                    <strong>{pendingRouteImpactCue.value}</strong>
                                        <span aria-hidden="true" className={styles.routeSelectedBeatPips}>
                                            {Array.from(
                                                { length: getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone) },
                                                (_, index) => (
                                                <i
                                                    data-route-impact-cue-beat={index + 1}
                                                    data-route-impact-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                                )
                                            )}
                                        </span>
                                </span>
                                <span
                                    aria-label={`Selected route action cue: ${pendingRouteActionCue.label}: ${pendingRouteActionCue.value}. ${pendingRouteActionCue.detail}`}
                                    className={styles.routeSelectedActionCue}
                                    data-route-action-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteActionCue.tone)}
                                    data-route-action-cue-beats={getRouteChoiceToneBeatCount(pendingRouteActionCue.tone)}
                                    data-route-action-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteActionCue.tone)}
                                    data-route-action-cue-tone={pendingRouteActionCue.tone}
                                    data-testid="route-selected-action-cue"
                                >
                                    <small>{pendingRouteActionCue.label}</small>
                                    <strong>{pendingRouteActionCue.value}</strong>
                                        <span aria-hidden="true" className={styles.routeSelectedBeatPips}>
                                            {Array.from(
                                                { length: getRouteChoiceToneBeatCount(pendingRouteActionCue.tone) },
                                                (_, index) => (
                                                <i
                                                    data-route-action-cue-beat={index + 1}
                                                    data-route-action-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                                )
                                            )}
                                        </span>
                                    <em>{pendingRouteActionCue.detail}</em>
                                </span>
                                <span className={styles.routeSelectedSignals}>
                                    <span
                                        data-route-signal="reward"
                                        data-route-signal-audio={getRouteChoiceSignalAudioCue('reward')}
                                        data-route-signal-beats={4}
                                        data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('reward')}
                                    >
                                        {pendingRouteSignalLabels.reward}
                                        <span aria-hidden="true" className={styles.routeSelectedSignalBeatPips}>
                                            {Array.from({ length: 4 }, (_, index) => (
                                                <i
                                                    data-route-signal-beat={index + 1}
                                                    data-route-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-route-signal="risk"
                                        data-route-signal-audio={getRouteChoiceSignalAudioCue('risk')}
                                        data-route-signal-beats={3}
                                        data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('risk')}
                                    >
                                        {pendingRouteSignalLabels.risk}
                                        <span aria-hidden="true" className={styles.routeSelectedSignalBeatPips}>
                                            {Array.from({ length: 3 }, (_, index) => (
                                                <i
                                                    data-route-signal-beat={index + 1}
                                                    data-route-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                </span>
                            </div>
                        ) : null}
                        {pendingDungeonNode ? (
                            <p className={styles.routeSelectedNote}>
                                Dungeon node armed: {pendingDungeonNode.label}. {pendingDungeonNode.detail}
                            </p>
                        ) : null}
                        {run.shopOffers.length > 0 ? (
                            <p className={styles.modalNote}>
                                Vendor alcove available: {run.shopOffers.length} services, {run.shopGold} shop gold.
                            </p>
                        ) : null}
                        {routeChoiceRequired ? (
                            <section
                                aria-labelledby="dungeon-route-choice-title"
                                className={styles.dungeonMapChoicePanel}
                                data-decision-state="required"
                                data-testid="route-choice-panel"
                            >
                                <div className={styles.dungeonMapChoiceHeader}>
                                    <span>Dungeon map</span>
                                    <strong id="dungeon-route-choice-title">Choose the next room</strong>
                                    <small>
                                        Act {dungeonMapPresentation.act} / boss at depth {dungeonMapPresentation.bossFloor}
                                    </small>
                                </div>
                                <p className={styles.dungeonMapChoiceInstruction} data-testid="route-choice-required-copy">
                                    {routeChoiceRequiredCopy}
                                </p>
                                <span className={styles.dungeonMapChoiceSummary}>
                                    {dungeonRouteDecisionPresentation?.summary ?? routeChoices
                                        .map((option) => `${option.label}: ${option.detail}`)
                                        .join(' · ')}
                                </span>
                                {routeChoiceRecommendation ? (
                                    <span
                                        aria-label={`Recommended route. ${routeChoiceRecommendation.row.choiceLabel}. ${
                                            routeChoiceRecommendation.actionCue.action
                                        }. ${trimTerminalPunctuation(
                                            routeChoiceRecommendation.memoryChoice?.readinessLabel ??
                                                routeChoiceRecommendation.decisionStack.nextCue
                                        )}. ${routeChoiceRecommendation.beatCue.beatCount} beats. Primary payoff: ${
                                            routeChoiceRecommendation.primaryPayoff?.value ?? 'none'
                                        }.`}
                                        className={styles.dungeonMapChoiceRecommendation}
                                        data-route-recommendation-action={routeChoiceRecommendation.actionCue.action}
                                        data-route-recommendation-audio={routeChoiceRecommendation.beatCue.audioCue}
                                        data-route-recommendation-beats={routeChoiceRecommendation.beatCue.beatCount}
                                        data-route-recommendation-payoff={routeChoiceRecommendation.primaryPayoff?.value ?? 'none'}
                                        data-route-recommendation-route={routeChoiceRecommendation.row.routeType}
                                        data-route-recommendation-screen-cue={routeChoiceRecommendation.beatCue.screenCue}
                                        data-route-recommendation-tone={routeChoiceRecommendation.decisionStack.tone}
                                        data-testid="route-choice-recommendation"
                                    >
                                        <small>Recommended route</small>
                                        <strong>{routeChoiceRecommendation.row.choiceLabel}</strong>
                                        <em>{routeChoiceRecommendation.actionCue.action}</em>
                                        <span aria-hidden="true" className={styles.dungeonMapChoiceRecommendationBeatPips}>
                                            {Array.from({ length: routeChoiceRecommendation.beatCue.beatCount }, (_, index) => (
                                                <i
                                                    data-route-recommendation-beat={index + 1}
                                                    data-route-recommendation-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                        {routeChoiceRecommendation.primaryPayoff ? <b>{routeChoiceRecommendation.primaryPayoff.value}</b> : null}
                                    </span>
                                ) : null}
                                <section
                                    aria-labelledby="route-memory-read-title"
                                    className={styles.routeMemoryReadPanel}
                                    data-pressure={memoryRecallFeedback.pressure}
                                    data-testid="route-memory-read-panel"
                                >
                                    <div className={styles.routeMemoryReadHeader}>
                                        <span>Memory read</span>
                                        <strong id="route-memory-read-title">
                                            Focus {memoryRecallFeedback.focus}/{RECALL_FOCUS_MAX} - {memoryRecallFeedback.focusLabel}
                                        </strong>
                                        <small>{memoryRecallFeedback.atmosphericSummary}</small>
                                    </div>
                                    <div className={styles.routeMemoryReadStats} aria-label="Recall state">
                                        <span>
                                            Bonus <strong>+{memoryRecallFeedback.nextCleanMatchBonus}</strong>
                                        </span>
                                        <span>
                                            Clues <strong>{memoryRecallFeedback.rememberedClueTileCount}</strong>
                                        </span>
                                        <span>
                                            Forgotten <strong>{memoryRecallFeedback.forgottenTileCount}</strong>
                                        </span>
                                        <span
                                            data-tone={memoryRecallFeedback.burden.tone}
                                            title={memoryRecallFeedback.burden.detail}
                                        >
                                            Burden <strong>{memoryRecallFeedback.burden.label}</strong>
                                        </span>
                                    </div>
                                    <p className={styles.routeMemoryReadPressure}>{memoryRecallFeedback.pressureDetail}</p>
                                    <p
                                        className={styles.routeMemoryReadNextMove}
                                        data-tone={memoryRecallFeedback.nextMemoryMove.tone}
                                    >
                                        <strong>{memoryRecallFeedback.nextMemoryMove.label}</strong>
                                        <span>{memoryRecallFeedback.nextMemoryMove.detail}</span>
                                    </p>
                                    {memoryRecallPanelRows.length > 0 ? (
                                        <div className={styles.routeMemoryReadRows}>
                                            {memoryRecallPanelRows.map((line) => (
                                                <span
                                                    className={styles.routeMemoryReadRow}
                                                    data-tone={line.tone}
                                                    key={line.id}
                                                >
                                                    <strong>{line.label}</strong>
                                                    <small>{line.detail}</small>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </section>
                                <div className={styles.dungeonMapTimeline} aria-label="Dungeon map route">
                                    {visibleDungeonMapNodes.map((node) => (
                                        <span
                                            className={styles.dungeonMapTimelineNode}
                                            data-status={node.status}
                                            data-tone={node.tone}
                                            key={node.id}
                                            title={`${node.label}: ${node.risk}`}
                                        >
                                            <span>{node.glyph}</span>
                                            <small>{node.floor}</small>
                                        </span>
                                    ))}
                                </div>
                                <div className={styles.dungeonMapChoiceActions}>
                                    {dungeonRouteDecisionPresentation?.rows.map((row) => {
                                        const choice = routeChoices.find((option) => option.id === row.id);
                                        const availability = choice
                                            ? getRouteChoiceAvailability(run, choice)
                                            : { available: true as const };
                                        const memoryChoice = routeChoiceMemoryById.get(row.id);
                                        const firstRouteTeachingLabel = firstRouteChoiceRequired
                                            ? getFirstRouteChoiceTeachingLabel(row.routeType)
                                            : null;
                                        const routeChoiceSignalLabels = getRouteChoiceSignalLabels(row.routeType);
                                        const routeChoicePayoffRows = getRouteChoicePayoffRows({
                                            memoryChoice,
                                            routeType: row.routeType
                                        });
                                        const primaryRouteChoicePayoff = routeChoicePayoffRows[0] ?? null;
                                        const routeChoiceDecisionStack = getRouteChoiceDecisionStack({
                                            memoryChoice,
                                            payoffRows: routeChoicePayoffRows,
                                            routeType: row.routeType,
                                            signalLabels: routeChoiceSignalLabels
                                        });
                                        const routeChoiceActionCue = getRouteChoiceActionCue({
                                            decisionStack: routeChoiceDecisionStack,
                                            memoryChoice,
                                            routeType: row.routeType
                                        });
                                        const routeChoiceBeatCue = getRouteChoiceBeatCue(row.routeType);
                                        const routeChoiceImpactCue = getRouteChoiceImpactCue({
                                            decisionStack: routeChoiceDecisionStack,
                                            routeType: row.routeType
                                        });
                                        const routeChoiceSignalsLabel = `Route choice ${row.routeType} signals. Reward: ${routeChoiceSignalLabels.reward}. Risk: ${routeChoiceSignalLabels.risk}.`;
                                        const routeChoicePayoffsLabel = formatGameplaySignalRowsLabel(
                                            `Route choice ${row.routeType} payoffs`,
                                            routeChoicePayoffRows
                                        );
                                        const routeChoiceDecisionStackLabel = `${routeChoiceDecisionStack.label}: ${routeChoiceDecisionStack.value}. ${routeChoiceDecisionStack.nextCue}.`;
                                        const routeChoiceActionCueLabel = `${routeChoiceActionCue.label}: ${routeChoiceActionCue.action}. ${trimTerminalPunctuation(routeChoiceActionCue.detail)}.`;
                                        const routeChoiceBeatCueLabel = `Route beat ${row.routeType}: ${routeChoiceBeatCue.label}. ${routeChoiceBeatCue.beatCount} beats. ${routeChoiceBeatCue.action}: ${routeChoiceBeatCue.detail}`;
                                        const routeChoiceRecipeSteps = [
                                            { id: 'first', label: 'First', value: routeChoiceActionCue.action },
                                            {
                                                id: 'payoff',
                                                label: 'Payoff',
                                                value:
                                                    routeChoicePayoffRows.find((payoff) => payoff.id === 'reward')?.value ??
                                                    routeChoiceSignalLabels.reward
                                            },
                                            {
                                                id: 'risk',
                                                label: memoryChoice ? 'Recall' : 'Risk',
                                                value:
                                                    memoryChoice?.readinessLabel ??
                                                    routeChoicePayoffRows.find((payoff) => payoff.id === 'risk')?.value ??
                                                    routeChoiceSignalLabels.risk
                                            },
                                            { id: 'keep', label: 'Keep', value: routeChoiceDecisionStack.nextCue.replace(/^First:\s*/i, '') }
                                        ];
                                        const routeChoiceRecipeValue = routeChoiceRecipeSteps.map((step) => step.value).join(' -> ');
                                        const routeChoiceRecipeLabel = `Route recipe ${row.routeType}. ${routeChoiceRecipeSteps
                                            .map((step) => `${step.label}: ${trimTerminalPunctuation(step.value)}`)
                                            .join('. ')}.`;
                                        const routeChoiceAriaLabel = [
                                            row.choiceLabel,
                                            `Impact cue: ${routeChoiceImpactCue.label}: ${routeChoiceImpactCue.value}`,
                                            `Route action: ${routeChoiceActionCue.action}: ${routeChoiceActionCue.detail}`,
                                            `Reward signal: ${routeChoiceSignalLabels.reward}`,
                                            `Risk signal: ${routeChoiceSignalLabels.risk}`,
                                            routeChoiceBeatCueLabel,
                                            routeChoiceRecipeLabel,
                                            routeChoiceDecisionStackLabel,
                                            ...routeChoicePayoffRows.map((payoff) => `${payoff.label}: ${payoff.value}`),
                                            row.approachLabel ? `Approach: ${row.approachLabel}` : null,
                                            `${row.nodeLabel}: ${row.mechanic}`,
                                            `Reward: ${row.reward}`,
                                            firstRouteTeachingLabel,
                                            memoryChoice ? `Memory: ${memoryChoice.memoryPrompt}` : null,
                                            memoryChoice ? `Recall: ${memoryChoice.readinessLabel}` : null,
                                            memoryChoice ? `Atmosphere: ${memoryChoice.atmosphericCue}` : null,
                                            availability.available ? `Risk: ${row.risk}` : availability.label
                                        ]
                                            .filter((part): part is string => Boolean(part))
                                            .join('. ');
                                        return (
                                            <button
                                                aria-label={routeChoiceAriaLabel}
                                                className={styles.dungeonMapRoomButton}
                                                disabled={!availability.available}
                                                data-route-beat-action={routeChoiceBeatCue.action}
                                                data-route-beat-audio={routeChoiceBeatCue.audioCue}
                                                data-route-beat-count={routeChoiceBeatCue.beatCount}
                                                data-route-beat-cue={routeChoiceBeatCue.label}
                                                data-route-beat-screen-cue={routeChoiceBeatCue.screenCue}
                                                data-route-beat-tier={routeChoiceBeatCue.tier}
                                                data-route-impact-cue={routeChoiceImpactCue.label}
                                                data-route-impact-cue-tone={routeChoiceImpactCue.tone}
                                                data-route-next-action={routeChoiceActionCue.action}
                                                data-route-next-action-tone={routeChoiceActionCue.tone}
                                                data-route-primary-payoff={primaryRouteChoicePayoff?.value ?? 'none'}
                                                data-route-primary-payoff-audio={
                                                    primaryRouteChoicePayoff
                                                        ? getRouteChoicePayoffAudioCue(primaryRouteChoicePayoff.tone)
                                                        : 'none'
                                                }
                                                data-route-primary-payoff-beats={
                                                    primaryRouteChoicePayoff ? getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone) : 0
                                                }
                                                data-route-primary-payoff-id={primaryRouteChoicePayoff?.id ?? 'none'}
                                                data-route-primary-payoff-screen-cue={
                                                    primaryRouteChoicePayoff
                                                        ? getRouteChoicePayoffScreenCue(primaryRouteChoicePayoff.tone)
                                                        : 'none'
                                                }
                                                data-route-primary-payoff-tone={primaryRouteChoicePayoff?.tone ?? 'none'}
                                                data-route-recipe={routeChoiceRecipeValue}
                                                data-route-type={row.routeType}
                                                data-testid={`route-choice-${row.routeType}`}
                                                data-tone={row.tone}
                                                key={row.id}
                                                onClick={() => {
                                                    if (!availability.available) {
                                                        return;
                                                    }
                                                    playUiClick();
                                                    chooseRouteAndContinue(row.id);
                                                }}
                                                type="button"
                                            >
                                                <span className={styles.dungeonMapRoomGlyph}>{row.glyph}</span>
                                                <span className={styles.dungeonMapRoomCopy}>
                                                    <strong>{row.choiceLabel}</strong>
                                                    <span
                                                        aria-label={`Route impact cue: ${routeChoiceImpactCue.label}: ${routeChoiceImpactCue.value}.`}
                                                        className={styles.dungeonMapRoomImpactCue}
                                                        data-route-impact-cue-tone={routeChoiceImpactCue.tone}
                                                        data-testid={`route-choice-${row.routeType}-impact-cue`}
                                                    >
                                                        <small>{routeChoiceImpactCue.label}</small>
                                                        <strong>{routeChoiceImpactCue.value}</strong>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceActionCueLabel}
                                                        className={styles.dungeonMapRoomActionCue}
                                                        data-route-action-tone={routeChoiceActionCue.tone}
                                                        data-testid={`route-choice-${row.routeType}-action-cue`}
                                                    >
                                                        <small>{routeChoiceActionCue.label}</small>
                                                        <strong>{routeChoiceActionCue.action}</strong>
                                                        <em>{routeChoiceActionCue.detail}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceSignalsLabel}
                                                        className={styles.dungeonMapRoomSignalRow}
                                                        data-testid={`route-choice-${row.routeType}-signals`}
                                                    >
                                                        <span
                                                            data-route-signal="reward"
                                                            data-route-signal-audio={getRouteChoiceSignalAudioCue('reward')}
                                                            data-route-signal-beats={4}
                                                            data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('reward')}
                                                        >
                                                            {routeChoiceSignalLabels.reward}
                                                            <span aria-hidden="true" className={styles.dungeonMapRoomSignalBeatPips}>
                                                                {Array.from({ length: 4 }, (_, index) => (
                                                                    <i
                                                                        data-route-choice-signal-beat={index + 1}
                                                                        data-route-choice-signal-beat-focus={
                                                                            index === 0 ? 'primary' : 'support'
                                                                        }
                                                                        key={index}
                                                                    />
                                                                ))}
                                                            </span>
                                                        </span>
                                                        <span
                                                            data-route-signal="risk"
                                                            data-route-signal-audio={getRouteChoiceSignalAudioCue('risk')}
                                                            data-route-signal-beats={3}
                                                            data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('risk')}
                                                        >
                                                            {routeChoiceSignalLabels.risk}
                                                            <span aria-hidden="true" className={styles.dungeonMapRoomSignalBeatPips}>
                                                                {Array.from({ length: 3 }, (_, index) => (
                                                                    <i
                                                                        data-route-choice-signal-beat={index + 1}
                                                                        data-route-choice-signal-beat-focus={
                                                                            index === 0 ? 'primary' : 'support'
                                                                        }
                                                                        key={index}
                                                                    />
                                                                ))}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceBeatCueLabel}
                                                        className={styles.dungeonMapRoomBeatCue}
                                                        data-route-beat-action={routeChoiceBeatCue.action}
                                                        data-route-beat-audio={routeChoiceBeatCue.audioCue}
                                                        data-route-beat-screen-cue={routeChoiceBeatCue.screenCue}
                                                        data-route-beat-tier={routeChoiceBeatCue.tier}
                                                        data-testid={`route-choice-${row.routeType}-beat-cue`}
                                                    >
                                                        <small>{routeChoiceBeatCue.label}</small>
                                                        <span
                                                            aria-hidden="true"
                                                            className={styles.dungeonMapRoomBeatPips}
                                                        >
                                                            {Array.from({ length: routeChoiceBeatCue.beatCount }).map((_, beatIndex) => (
                                                                <i
                                                                    data-route-beat-pip={beatIndex + 1}
                                                                    data-route-beat-pip-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                                    key={beatIndex}
                                                                />
                                                            ))}
                                                        </span>
                                                        <strong>{routeChoiceBeatCue.action}</strong>
                                                        <em>{routeChoiceBeatCue.detail}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoicePayoffsLabel}
                                                        className={styles.dungeonMapRoomPayoffRows}
                                                        data-route-primary-payoff={primaryRouteChoicePayoff?.value ?? 'none'}
                                                        data-route-primary-payoff-audio={
                                                            primaryRouteChoicePayoff
                                                                ? getRouteChoicePayoffAudioCue(primaryRouteChoicePayoff.tone)
                                                                : 'none'
                                                        }
                                                        data-route-primary-payoff-id={primaryRouteChoicePayoff?.id ?? 'none'}
                                                        data-route-primary-payoff-screen-cue={
                                                            primaryRouteChoicePayoff
                                                                ? getRouteChoicePayoffScreenCue(primaryRouteChoicePayoff.tone)
                                                                : 'none'
                                                        }
                                                        data-route-primary-payoff-tone={primaryRouteChoicePayoff?.tone ?? 'none'}
                                                        data-testid={`route-choice-${row.routeType}-payoffs`}
                                                    >
                                                        {primaryRouteChoicePayoff ? (
                                                            <span
                                                                aria-label={`Primary route payoff. ${primaryRouteChoicePayoff.label}: ${primaryRouteChoicePayoff.value}. ${getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone)} beats.`}
                                                                data-route-primary-payoff-beats={getRouteChoiceToneBeatCount(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-audio={getRouteChoicePayoffAudioCue(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-id={primaryRouteChoicePayoff.id}
                                                                data-route-primary-payoff-screen-cue={getRouteChoicePayoffScreenCue(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-tone={primaryRouteChoicePayoff.tone}
                                                                data-testid={`route-choice-${row.routeType}-primary-payoff`}
                                                            >
                                                                <small>Primary payoff</small>
                                                                <strong>{primaryRouteChoicePayoff.value}</strong>
                                                                <em>{primaryRouteChoicePayoff.label}</em>
                                                                <span aria-hidden="true" className={styles.dungeonMapRoomPrimaryPayoffBeatPips}>
                                                                    {Array.from(
                                                                        { length: getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone) },
                                                                        (_, index) => (
                                                                            <i
                                                                                data-route-primary-payoff-beat={index + 1}
                                                                                data-route-primary-payoff-beat-focus={
                                                                                    index === 0 ? 'primary' : 'support'
                                                                                }
                                                                                key={index}
                                                                            />
                                                                        )
                                                                    )}
                                                                </span>
                                                            </span>
                                                        ) : null}
                                                        {routeChoicePayoffRows.map((payoff) => {
                                                            const beatCount = getRouteChoiceToneBeatCount(payoff.tone);
                                                            return (
                                                                <span
                                                                    data-route-payoff-audio={getRouteChoicePayoffAudioCue(payoff.tone)}
                                                                    data-route-payoff-beats={beatCount}
                                                                    data-route-payoff-id={payoff.id}
                                                                    data-route-payoff-screen-cue={getRouteChoicePayoffScreenCue(payoff.tone)}
                                                                    data-route-payoff-tone={payoff.tone}
                                                                    key={payoff.id}
                                                                >
                                                                    <small>{payoff.label}</small>
                                                                    <strong>{payoff.value}</strong>
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className={styles.dungeonMapRoomPayoffBeatPips}
                                                                    >
                                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                                            <i
                                                                                data-route-payoff-beat={index + 1}
                                                                                data-route-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                                key={index}
                                                                            />
                                                                        ))}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })}
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceDecisionStackLabel}
                                                        className={styles.dungeonMapRoomDecisionStack}
                                                        data-route-decision-stack-tone={routeChoiceDecisionStack.tone}
                                                        data-testid={`route-choice-${row.routeType}-decision-stack`}
                                                    >
                                                        <small>{routeChoiceDecisionStack.label}</small>
                                                        <strong>{routeChoiceDecisionStack.value}</strong>
                                                        <em>{routeChoiceDecisionStack.nextCue}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceRecipeLabel}
                                                        className={styles.dungeonMapRoomRecipe}
                                                        data-route-recipe-tone={routeChoiceDecisionStack.tone}
                                                        data-testid={`route-choice-${row.routeType}-recipe`}
                                                    >
                                                        {routeChoiceRecipeSteps.map((step) => (
                                                            <span data-route-recipe-step={step.id} key={step.id}>
                                                                <small>{step.label}</small>
                                                                <strong>{step.value}</strong>
                                                            </span>
                                                        ))}
                                                    </span>
                                                    {row.approachLabel ? (
                                                        <small className={styles.dungeonMapRoomApproach}>
                                                            Approach: {row.approachLabel}
                                                        </small>
                                                    ) : null}
                                                    <small>{row.nodeLabel}: {row.mechanic}</small>
                                                    <em>Reward: {row.reward}</em>
                                                    {firstRouteTeachingLabel ? (
                                                        <small className={styles.dungeonMapRoomTeaching}>
                                                            {firstRouteTeachingLabel}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Memory: {memoryChoice.memoryPrompt}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Recall: {memoryChoice.readinessLabel}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Atmosphere: {memoryChoice.atmosphericCue}
                                                        </small>
                                                    ) : null}
                                                </span>
                                                <span className={styles.dungeonMapRoomRisk}>
                                                    {availability.available ? `Risk: ${row.risk}` : availability.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ) : null}
                        {acceptedEndlessRiskWager || (!routeChoiceRequired && endlessRiskWagerOfferAvailable) ? (
                            <div className={styles.endlessRiskWagerPanel} data-testid="endless-risk-wager-panel">
                                {acceptedEndlessRiskWager ? (
                                    <>
                                        <strong>Risk wager armed</strong>
                                        <span>
                                            Next featured objective: +{offeredRiskWagerFavor}{' '}
                                            Favor if completed. Miss it and the x{acceptedEndlessRiskWager.streakAtRisk}{' '}
                                            streak {wagerSuretyActive ? 'falls to x1' : 'breaks'}.
                                        </span>
                                        {riskWagerPrimaryCue ? <RiskWagerPrimaryCueView cue={riskWagerPrimaryCue} /> : null}
                                        <RiskWagerSignalRowsView
                                            label={riskWagerSignalRowsLabel}
                                            rows={visibleRiskWagerSignalRows}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <strong>Risk wager available</strong>
                                        <span>
                                            Stake your x{run.featuredObjectiveStreak} objective streak on the next floor for
                                            +{offeredRiskWagerFavor} bonus Favor.
                                        </span>
                                        {riskWagerPrimaryCue ? <RiskWagerPrimaryCueView cue={riskWagerPrimaryCue} /> : null}
                                        <RiskWagerSignalRowsView
                                            label={riskWagerSignalRowsLabel}
                                            rows={visibleRiskWagerSignalRows}
                                        />
                                        <button
                                            aria-label={riskWagerArmAriaLabel}
                                            className={styles.endlessRiskWagerButton}
                                            onClick={() => {
                                                playUiClick();
                                                acceptEndlessRiskWager();
                                            }}
                                            type="button"
                                        >
                                            Arm wager
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : null}
                        <div className={styles.modalStats}>
                            <StatTile
                                density="minimal"
                                label="Rating"
                                value={run.lastLevelResult.rating}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Mistakes"
                                value={runNonNegativeInteger(run.lastLevelResult.mistakes)}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Lives"
                                value={runNonNegativeInteger(run.lastLevelResult.livesRemaining)}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Total"
                                value={runNonNegativeInteger(run.stats.totalScore).toLocaleString()}
                                valueFirst
                            />
                        </div>
                    </OverlayModal>
                )}

                {!suppressStatusOverlays && shortcutsHelpOpen ? (
                    <OverlayModal
                        actions={[
                            {
                                label: 'Close',
                                onClick: () => {
                                    playUiBack();
                                    setShortcutsHelpOpen(false);
                                },
                                variant: 'secondary'
                            }
                        ]}
                        subtitle="These shortcuts work while a run is active and when focus is not in a text field."
                        testId="game-shortcuts-help-overlay"
                        title="Keyboard shortcuts"
                    >
                        <ul aria-label="Gameplay keyboard shortcuts" className={styles.shortcutsHelpList}>
                            {GAMEPLAY_SHORTCUT_ROWS.map((row) => (
                                <li key={row.id}>
                                    <span className={styles.shortcutsHelpKeys}>{row.keys}</span>
                                    {' — '}
                                    {row.description}
                                </li>
                            ))}
                        </ul>
                        <p className={styles.shortcutsHelpTip}>{GAMBIT_KEYBOARD_HELP_TIP}</p>
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays && abandonRunConfirmOpen ? (
                    <OverlayModal
                        actions={[
                            {
                                label: 'Cancel',
                                onClick: () => {
                                    playUiBack();
                                    setAbandonRunConfirmOpen(false);
                                },
                                variant: 'secondary'
                            },
                            {
                                label: 'Abandon run',
                                onClick: () => {
                                    playUiBack();
                                    setAbandonRunConfirmOpen(false);
                                    goToMenu();
                                },
                                variant: 'danger'
                            }
                        ]}
                        headerPlateTone="danger"
                        onEscape={() => {
                            playUiBack();
                            setAbandonRunConfirmOpen(false);
                        }}
                        ornamentalHeaderPlate
                        subtitle="You will lose this run and return to the main menu. This cannot be undone."
                        title="Abandon run?"
                    />
                ) : null}
            </div>
        </section>
    );
};

export default GameScreen;
