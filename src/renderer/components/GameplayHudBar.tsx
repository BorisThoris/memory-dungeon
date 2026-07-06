import { useId, type CSSProperties, type ReactNode } from 'react';
import { getBossEncounterIdentityForFloor, getFloorIdentityContract } from '../../shared/boss-encounters';
import { getRewardPerkReadinessRows, type RewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { MAX_LIVES, type MutatorId, type RunState } from '../../shared/contracts';
import { getActiveDungeonBossPressureRule } from '../../shared/dungeon-boss-rules';
import {
    getFeaturedObjectiveHudTooltip,
    getFeaturedObjectiveLabel,
    getFloorArchetypeDefinition,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { getSecondaryObjectiveStatusRows } from '../../shared/secondary-objectives';
import { getDefaultDifficultyProfile } from '../../shared/difficulty-profile';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import { getFindableRows } from '../../shared/findables';
import { getHazardTileBoardSummary } from '../../shared/hazard-tiles';
import { getTraitOpportunityHudModel, getTraitOpportunitySummary } from '../../shared/trait-opportunities';
import { getTraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import {
    getInRunCauseRows,
    getPerfectMemoryAttribution,
    getTouchHudDetailRows,
    type FeedbackCauseRow
} from '../../shared/long-run-feedback';
import { getRunEconomyEntry } from '../../shared/run-economy';
import { getRunBuildProfile } from '../../shared/relics';
import { RELIC_FAVOR_PER_BONUS_PICK } from '../../shared/relic-favor-rules';
import { SHOP_ITEM_CATALOG } from '../../shared/shop-rules';
import codexBookUrl from '../assets/ui/icons/icon-codex-book-v1.svg?url';
import scoreParasiteCrystalUrl from '../assets/ui/icons/icon-score-parasite-crystal.svg?url';
import shuffleIconUrl from '../assets/ui/icons/icon-shuffle-v1.svg?url';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr
} from '../copy/traitInteractionLaneMap';
import { PERFECT_MEMORY_BASE_RULES, perfectMemoryHudKind } from '../copy/perfectMemory';
import { REG106_HUD_IA } from '../gameplay/regPhase4PlayContract';
import {
    getChainMilestonePreview,
    getChainMomentumLabel,
    getChainMomentumSubline,
    getChainMomentumTier,
    type ChainRewardForecastCue,
    getChainRewardProgress,
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy
} from '../copy/chainMomentum';
import { formatHudActionFeedbackText, getHudActionFeedbackProfile } from '../copy/hudActionFeedback';
import { MUTATOR_HUD_LABELS } from './gameplayHudMutatorLabels';
import { getStackCashoutLaneCount, getVisualHudAnnouncementImpact, type VisualHudAnnouncementDetail } from './gameScreenFeedback';
import styles from './GameScreen.module.css';

const getMutatorChipTitle = (id: MutatorId): string => {
    if (id === 'sticky_fingers') {
        return 'Sticky fingers — your next opening flip must use a different slot than the tile you matched last.';
    }
    if (id === 'glass_floor') {
        return 'Glass floor — adds one decoy trap tile that never pairs. Avoid dragging it into a mismatch for the glass-witness bonus.';
    }
    if (id === 'findables_floor') {
        return 'Dense pickups — this floor guarantees two pickup pairs instead of the normal baseline spawn.';
    }
    return MUTATOR_HUD_LABELS[id] ?? id;
};

const temporaryCurrencyPurpose = (run: RunState, currencyId: string): string | undefined =>
    getRunEconomyEntry(run, currencyId)?.purpose;

const formatRewardPreviewLabel = (
    label: string,
    rows: readonly { actionLabel?: string; chaseLabel?: string; distanceLabel?: string; label?: string; rewardText?: string }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            [
                row.chaseLabel,
                row.actionLabel,
                row.rewardText ?? row.label,
                row.distanceLabel
            ]
                .filter(Boolean)
                .join(': ')
        )
        .filter(Boolean)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const formatHudPerkRowsLabel = (
    label: string,
    rows: readonly {
        arcadeCue: string;
        lane: string;
        moment: string;
        payoff: string;
        nextCue: string;
        label: string;
        readinessLabel?: string;
        readinessDetail?: string;
    }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            `${row.arcadeCue}: ${row.lane}: ${row.payoff}. ${
                row.readinessLabel ? `State: ${row.readinessLabel}. ` : ''
            }Moment: ${row.moment}. Next: ${row.nextCue}. ${row.readinessDetail ?? row.label}`
        )
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const REWARD_PERK_FOCUS_PRIORITY: Record<RewardPerkReadinessRow['readiness'], number> = {
    armed: 4,
    soon: 3,
    passive: 2,
    spent: 1
};

const REWARD_PERK_FOCUS_ROW_PRIORITY: Record<RewardPerkReadinessRow['id'], number> = {
    trait_streak_toolkit: 5,
    cursed_opener_greed: 4,
    echo_conduit_double: 3,
    free_first_swap_per_floor: 2,
    hazard_banish_per_floor: 1
};

const getHudRewardPerkFocus = (
    rows: readonly RewardPerkReadinessRow[]
): {
    action: 'Cash perk' | 'Prime perk' | 'Watch perk' | 'Spent';
    row: RewardPerkReadinessRow;
    tone: RewardPerkReadinessRow['readiness'];
} | null => {
    const [row] = [...rows].sort((a, b) => {
        const readinessDelta = REWARD_PERK_FOCUS_PRIORITY[b.readiness] - REWARD_PERK_FOCUS_PRIORITY[a.readiness];
        if (readinessDelta !== 0) {
            return readinessDelta;
        }
        const meterDelta = b.meterPercent - a.meterPercent;
        if (meterDelta !== 0) {
            return meterDelta;
        }
        return REWARD_PERK_FOCUS_ROW_PRIORITY[b.id] - REWARD_PERK_FOCUS_ROW_PRIORITY[a.id];
    });
    if (!row) {
        return null;
    }
    const action =
        row.readiness === 'armed'
            ? 'Cash perk'
            : row.readiness === 'soon'
              ? 'Prime perk'
              : row.readiness === 'passive'
                ? 'Watch perk'
                : 'Spent';
    return { action, row, tone: row.readiness };
};

const getHudRewardPerkBeatCue = (
    focus: ReturnType<typeof getHudRewardPerkFocus>
): {
    action: string;
    beatCount: 2 | 3 | 4;
    label: 'Cashout beat' | 'Prime beat' | 'Ready beat';
    tier: 'cashout' | 'prime' | 'ready';
} | null => {
    if (!focus) {
        return null;
    }
    if (focus.tone === 'armed') {
        return { action: focus.action, beatCount: 4, label: 'Cashout beat', tier: 'cashout' };
    }
    if (focus.tone === 'soon') {
        return { action: focus.action, beatCount: 3, label: 'Prime beat', tier: 'prime' };
    }
    return { action: focus.action, beatCount: 2, label: 'Ready beat', tier: 'ready' };
};

const hudRewardPerkBeatAudioCue = (
    beatCue: ReturnType<typeof getHudRewardPerkBeatCue>
): 'perk-cashout' | 'perk-prime' | 'perk-ready' | 'perk-silent' => {
    if (!beatCue) {
        return 'perk-silent';
    }
    if (beatCue.tier === 'cashout') {
        return 'perk-cashout';
    }
    if (beatCue.tier === 'prime') {
        return 'perk-prime';
    }
    return 'perk-ready';
};

const hudRewardPerkBeatScreenCue = (
    beatCue: ReturnType<typeof getHudRewardPerkBeatCue>
): HudScreenCue | 'none' => {
    if (!beatCue) {
        return 'none';
    }
    if (beatCue.tier === 'cashout') {
        return 'burst';
    }
    if (beatCue.tier === 'prime') {
        return 'pulse';
    }
    return 'tick';
};

type HudRewardPerkLaneMapEntry = {
    action: 'Cash perk' | 'Prime perk' | 'Watch perk' | 'Re-prime perk';
    count: number;
    lane: string;
    nextCue: string;
    readiness: RewardPerkReadinessRow['readiness'];
};

const HUD_REWARD_PERK_ACTION_PRIORITY: Record<HudRewardPerkLaneMapEntry['action'], number> = {
    'Cash perk': 4,
    'Prime perk': 3,
    'Watch perk': 2,
    'Re-prime perk': 1
};

const getHudRewardPerkLaneAction = (readiness: RewardPerkReadinessRow['readiness']): HudRewardPerkLaneMapEntry['action'] => {
    if (readiness === 'armed') {
        return 'Cash perk';
    }
    if (readiness === 'soon') {
        return 'Prime perk';
    }
    if (readiness === 'spent') {
        return 'Re-prime perk';
    }
    return 'Watch perk';
};

const getHudRewardPerkLaneMap = (rows: readonly RewardPerkReadinessRow[]): HudRewardPerkLaneMapEntry[] => {
    const laneState = new Map<string, HudRewardPerkLaneMapEntry>();
    rows.forEach((row) => {
        const action = getHudRewardPerkLaneAction(row.readiness);
        const existing = laneState.get(row.lane);
        if (!existing) {
            laneState.set(row.lane, {
                action,
                count: 1,
                lane: row.lane,
                nextCue: row.nextCue,
                readiness: row.readiness
            });
            return;
        }
        existing.count += 1;
        if (HUD_REWARD_PERK_ACTION_PRIORITY[action] > HUD_REWARD_PERK_ACTION_PRIORITY[existing.action]) {
            existing.action = action;
            existing.nextCue = row.nextCue;
            existing.readiness = row.readiness;
        }
    });
    return [...laneState.values()];
};

const formatHudRewardPerkLaneMapAttr = (laneMap: readonly HudRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.lane}:${lane.count}`).join('>') : 'none';

const formatHudRewardPerkLaneActionMapAttr = (laneMap: readonly HudRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.lane}:${lane.action}:${lane.count}`).join('>') : 'none';

const formatHudRewardPerkLaneMapLabel = (laneMap: readonly HudRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0
        ? `Reward perk lane map. ${laneMap
              .map((lane) => `${lane.lane}: ${lane.count}. ${lane.action}. ${sentenceWithPeriod(lane.nextCue)}`)
              .join(' ')}`
        : 'Reward perk lane map';

const mutatorChipStyle = (id: MutatorId): string | undefined => {
    switch (id) {
        case 'short_memorize':
            return styles.mutatorChipShortMemorize;
        case 'n_back_anchor':
            return styles.mutatorChipNBack;
        case 'shifting_spotlight':
            return styles.mutatorChipShiftingSpotlight;
        default:
            return undefined;
    }
};

const MutatorChipGlyph = ({ mutator }: { mutator: MutatorId }) => {
    switch (mutator) {
        case 'short_memorize':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <circle cx="8" cy="8" fill="none" r="6.25" stroke="currentColor" strokeWidth="1.35" />
                        <path d="M8 4.35V8l2.6 1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
                    </svg>
                </span>
            );
        case 'n_back_anchor':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <path
                            d="M3.4 10.2c0-2.1 1.7-3.8 3.8-3.8h1.6c2.1 0 3.8 1.7 3.8 3.8v1.1H3.4z"
                            fill="none"
                            stroke="currentColor"
                            strokeLinejoin="round"
                            strokeWidth="1.25"
                        />
                        <path d="M8 2.7v3.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
                        <circle cx="8" cy="2.2" fill="currentColor" r="1.05" />
                    </svg>
                </span>
            );
        case 'shifting_spotlight':
            return (
                <span aria-hidden="true" className={styles.mutatorChipSpotlightPair}>
                    <span className={styles.mutatorChipSpotWard} />
                    <span className={styles.mutatorChipSpotBounty} />
                </span>
            );
        default:
            return null;
    }
};

export interface GameplayHudBarProps {
    run: RunState;
    cameraViewportMode: boolean;
    /** Precomputed from host clock (`gauntletDeadlineMs - now`), or null when gauntlet is off. */
    gauntletRemainingMs: number | null;
    /** HUD-015: low-frequency status line for screen readers (`aria-live="polite"`). */
    politeHudAnnouncement?: string;
    /** Mirrors the visible board feedback tone in compact HUD context. */
    politeHudAnnouncementPriority?: 'info' | 'error';
    /** Gates brief chain-pill emphasis animation */
    reduceMotion?: boolean;
}

const getFindableProgressState = (claimed: number, total: number): 'live' | 'complete' => {
    if (total > 0 && claimed >= total) {
        return 'complete';
    }
    return 'live';
};

const getFindableProgressSubline = (claimed: number, total: number): string => {
    if (total > 0 && claimed >= total) {
        return 'All claimed';
    }
    const remaining = Math.max(0, total - claimed);
    return `${remaining} reward${remaining === 1 ? '' : 's'} left`;
};

type HudObjectiveSignalTone = 'objective' | 'progress' | 'reward' | 'risk';
type HudObjectiveSignal = { id: string; label: string; tone: HudObjectiveSignalTone; value: string };
type HudScreenCue = 'burst' | 'guard' | 'pulse' | 'snap' | 'tick';

const hudObjectiveSignalBeatCount = (row: HudObjectiveSignal): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk') {
        const riskValue = Number(row.value.replace(/^x/i, ''));
        return riskValue >= 4 ? 3 : 2;
    }
    if (row.tone === 'progress') {
        const [current, total] = row.value.split('/').map((value) => Number(value));
        return total > 0 && current >= total ? 4 : 3;
    }
    return 3;
};

const hudObjectiveSignalAction = (row: HudObjectiveSignal): 'Build favor' | 'Cash wager' | 'Chase target' | 'Protect streak' => {
    if (row.tone === 'reward') {
        return 'Cash wager';
    }
    if (row.tone === 'risk') {
        return 'Protect streak';
    }
    if (row.tone === 'progress') {
        return 'Build favor';
    }
    return 'Chase target';
};

const hudObjectiveSignalAudioCue = (
    row: HudObjectiveSignal
): 'objective-favor' | 'objective-risk' | 'objective-target' | 'objective-wager' => {
    if (row.tone === 'reward') {
        return 'objective-wager';
    }
    if (row.tone === 'risk') {
        return 'objective-risk';
    }
    if (row.tone === 'progress') {
        return 'objective-favor';
    }
    return 'objective-target';
};

const hudObjectiveSignalScreenCue = (row: HudObjectiveSignal): HudScreenCue => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'guard';
    }
    if (row.tone === 'progress') {
        return row.value.startsWith('3/') ? 'snap' : 'pulse';
    }
    return 'tick';
};

const hudTraitRouteActionBeatCount = (
    urgency: NonNullable<ReturnType<typeof getTraitRouteObjectiveStatus>>['urgency']
): 2 | 3 | 4 => {
    if (urgency === 'next' || urgency === 'paid') {
        return 4;
    }
    if (urgency === 'building') {
        return 3;
    }
    return 2;
};

const hudTraitRouteActionAudioCue = (
    urgency: NonNullable<ReturnType<typeof getTraitRouteObjectiveStatus>>['urgency']
): 'trait-route-cashout' | 'trait-route-prime' | 'trait-route-watch' => {
    if (urgency === 'next' || urgency === 'paid') {
        return 'trait-route-cashout';
    }
    if (urgency === 'building') {
        return 'trait-route-prime';
    }
    return 'trait-route-watch';
};

const hudTraitRouteActionScreenCue = (
    urgency: NonNullable<ReturnType<typeof getTraitRouteObjectiveStatus>>['urgency']
): HudScreenCue => {
    if (urgency === 'next' || urgency === 'paid') {
        return 'burst';
    }
    if (urgency === 'building') {
        return 'pulse';
    }
    return 'tick';
};

const getHudObjectiveSignals = ({
    activeRiskWagerFavor,
    featuredObjectiveLabel,
    relicFavorProgress,
    riskWagerActive,
    streakAtRisk
}: {
    activeRiskWagerFavor: number;
    featuredObjectiveLabel: string | null;
    relicFavorProgress: number;
    riskWagerActive: boolean;
    streakAtRisk: number;
}): HudObjectiveSignal[] => {
    const rows: HudObjectiveSignal[] = [];
    if (featuredObjectiveLabel) {
        rows.push({ id: 'objective', label: 'Target', tone: 'objective', value: featuredObjectiveLabel });
    }
    rows.push({ id: 'favor', label: 'Favor', tone: 'progress', value: `${relicFavorProgress}/3` });
    if (riskWagerActive) {
        rows.push({ id: 'wager', label: 'Wager', tone: 'reward', value: `+${activeRiskWagerFavor} Favor` });
        rows.push({ id: 'risk', label: 'Risk', tone: 'risk', value: `x${streakAtRisk}` });
    }
    return rows.slice(0, 4);
};

const hudMeterStyle = (percent: number): CSSProperties =>
    ({
        '--hud-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

const formatHudSignalRowsLabel = (
    label: string,
    rows: readonly { label: string; value: string }[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}: ${row.value}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const sentenceWithPeriod = (text: string): string =>
    /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

const hudRecentActionStackLabel = (
    impact: ReturnType<typeof getVisualHudAnnouncementImpact> | null
): string | null => {
    if (!impact || impact.details.length < 2 || impact.burstTier === 'none') {
        return null;
    }
    if (impact.burstTier === 'combo') {
        return `${impact.details.length}x combo`;
    }
    if (impact.burstTier === 'reward') {
        return `${impact.details.length}x reward`;
    }
    if (impact.burstTier === 'trait') {
        return `${impact.details.length}x trait`;
    }
    if (impact.burstTier === 'chain') {
        return `${impact.details.length}x chain`;
    }
    return `${impact.details.length}x risk`;
};

const hudRecentActionStackSummary = (
    impact: ReturnType<typeof getVisualHudAnnouncementImpact> | null
): {
    action: string;
    firstCue: string;
    keepCue: string;
    label: string;
    nextCue: string;
    thenCue: string;
    tone: 'cashout' | 'build' | 'risk' | 'trait' | 'reward';
    value: string;
} | null => {
    if (!impact || impact.details.length < 2 || impact.burstTier === 'none') {
        return null;
    }
    const meaningfulDetails = impact.details.filter((detail) => detail.label !== 'Streak live');
    const uniqueLabels = [...new Set((meaningfulDetails.length >= 2 ? meaningfulDetails : impact.details).map((detail) => detail.label))].slice(0, 4);
    if (uniqueLabels.length < 2) {
        return null;
    }
    const hasSuperStack = uniqueLabels.includes('Super stack');
    const stackCashoutLaneCount = getStackCashoutLaneCount(uniqueLabels);
    const label =
        hasSuperStack
            ? 'Super stack'
            : stackCashoutLaneCount >= 2
            ? 'Stack cashout'
            : impact.burstTier === 'risk'
            ? 'Risk stack'
            : impact.burstTier === 'combo'
              ? 'Payoff stack'
              : impact.burstTier === 'reward'
                ? 'Reward stack'
                : impact.burstTier === 'trait'
                  ? 'Trait stack'
                  : 'Chain stack';
    const nextCue =
        hasSuperStack
            ? 'First: cash the super stack'
            : impact.burstTier === 'risk'
            ? 'First: recover control'
            : impact.burstTier === 'combo'
              ? 'First: cash out safest payoff'
              : impact.burstTier === 'reward'
                ? 'First: keep streak alive'
                : impact.burstTier === 'trait'
                  ? 'First: look for the next trait route'
                  : 'First: protect the chain';
    const thenCue =
        hasSuperStack
            ? 'Then: rebuild the next stack'
            : impact.burstTier === 'risk'
            ? 'Then: rebuild with a safe match'
            : impact.burstTier === 'combo'
              ? 'Then: route the chained payoff'
              : impact.burstTier === 'reward'
                ? 'Then: bank the next threshold'
                : impact.burstTier === 'trait'
                  ? 'Then: convert adjacent traits'
                  : 'Then: match a safe follow-up';
    const keepCue =
        hasSuperStack
            ? 'Keep: chain before spending'
            : impact.burstTier === 'risk'
            ? 'Keep: stop the chain break'
            : impact.burstTier === 'combo'
              ? 'Keep: stack before spending'
              : impact.burstTier === 'reward'
                ? 'Keep: streak stays hot'
                : impact.burstTier === 'trait'
                  ? 'Keep: route chain alive'
                  : 'Keep: protect momentum';
    const tone =
        hasSuperStack || stackCashoutLaneCount >= 2
            ? 'cashout'
            : impact.burstTier === 'risk'
              ? 'risk'
              : impact.burstTier === 'trait'
                ? 'trait'
                : impact.burstTier === 'reward'
                  ? 'reward'
                  : 'build';
    const action =
        hasSuperStack
            ? 'Cash super stack'
            : tone === 'cashout'
            ? 'Cash now'
            : tone === 'risk'
              ? 'Recover'
              : tone === 'trait'
                ? 'Route next'
                : tone === 'reward'
                  ? 'Keep streak'
                  : 'Prime';
    return { action, firstCue: nextCue, keepCue, label, nextCue, thenCue, tone, value: uniqueLabels.join(' + ') };
};

const hudRecentActionImpactCue = (
    impact: ReturnType<typeof getVisualHudAnnouncementImpact> | null
): string | null => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return null;
    }
    const labels = new Set(impact.details.map((detail) => detail.label));
    if (impact.burstTier === 'risk') {
        return labels.has('Lost reward') || labels.has('Chain break') ? 'Recovery lane' : 'Risk lane';
    }
    if (impact.burstTier === 'combo') {
        if (labels.has('Super stack')) {
            return 'Super stack';
        }
        if (labels.has('Stack cashout')) {
            return 'Stack cashout';
        }
        if (labels.has('Payoff stack')) {
            return 'Payoff stack';
        }
        if (labels.has('Cashout hit')) {
            return 'Cashout hit';
        }
        const structuralStackLaneCount = getStackCashoutLaneCount([...labels]);
        if (structuralStackLaneCount >= 2) {
            return 'Stack cashout';
        }
        if (
            labels.has('Combo prime') ||
            labels.has('Guard prime') ||
            labels.has('Heal prime') ||
            labels.has('Shard setup') ||
            labels.has('Combo setup') ||
            labels.has('Guard setup') ||
            labels.has('Heal setup')
        ) {
            return 'Prime cashout';
        }
        return labels.has('Cashout armed') || labels.has('One-away cashout') || labels.has('Shard cashout')
            ? 'Chain cashout'
            : 'Combo build';
    }
    if (impact.burstTier === 'reward') {
        if (labels.has('Payoff stack')) {
            return 'Payoff stack';
        }
        if (labels.has('Cashout hit')) {
            return 'Cashout hit';
        }
        if (labels.has('Reward cashout')) {
            return 'Reward cashout';
        }
        if (labels.has('Pickup cashout')) {
            return 'Pickup cashout';
        }
        if (labels.has('Cashout armed')) {
            return 'Cashout armed';
        }
        return labels.has('Pickup') ? 'Reward cashout' : 'Chain cashout';
    }
    if (impact.burstTier === 'trait') {
        return labels.has('Trait surge') ? 'Trait surge' : 'Trait cashout';
    }
    return 'Keep streak';
};

const hudRecentActionImpactBeatCount = (
    impact: ReturnType<typeof getVisualHudAnnouncementImpact> | null
): 2 | 3 | 4 => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return 2;
    }
    if (impact.level === 'high' || impact.burstTier === 'combo' || impact.burstTier === 'risk') {
        return 4;
    }
    if (impact.level === 'medium' || impact.burstTier === 'reward' || impact.burstTier === 'trait') {
        return 3;
    }
    return 2;
};

const hudRecentActionImpactScreenCue = (cue: string | null): 'burst' | 'guard' | 'pulse' | 'recover' | 'risk' => {
    if (!cue) {
        return 'pulse';
    }
    if (cue === 'Recovery lane') {
        return 'recover';
    }
    if (cue === 'Risk lane') {
        return 'risk';
    }
    if (cue === 'Trait surge' || cue === 'Super stack' || cue.includes('cashout') || cue.includes('Cashout') || cue.includes('stack')) {
        return 'burst';
    }
    if (cue.includes('Prime') || cue.includes('armed') || cue.includes('build')) {
        return 'pulse';
    }
    return 'guard';
};

type HudRecentActionLaneId = 'cash' | 'route' | 'chain' | 'utility' | 'recover';

const HUD_RECENT_ACTION_LANE_LABELS: Record<HudRecentActionLaneId, string> = {
    cash: 'Cash',
    chain: 'Chain',
    recover: 'Fix',
    route: 'Route',
    utility: 'Tool'
};

const HUD_RECENT_ACTION_LANE_ACTIONS: Record<HudRecentActionLaneId, string> = {
    cash: 'Collect',
    chain: 'Keep streak',
    recover: 'Recover',
    route: 'Route next',
    utility: 'Use tool'
};

const HUD_RECENT_ACTION_LANE_ORDER: readonly HudRecentActionLaneId[] = [
    'cash',
    'route',
    'chain',
    'utility',
    'recover'
];

const getHudRecentActionLaneId = (detail: VisualHudAnnouncementDetail): HudRecentActionLaneId => {
    const label = detail.label.toLowerCase();
    if (detail.tone === 'risk' || /\b(break|lost|risk|recover|save)\b/.test(label)) {
        return 'recover';
    }
    if (detail.tone === 'trait' || /\b(route|trait)\b/.test(label)) {
        return 'route';
    }
    if (detail.tone === 'chain' || /\b(chain|streak|combo)\b/.test(label)) {
        return 'chain';
    }
    if (detail.tone === 'guard' || detail.tone === 'objective' || /\b(guard|objective|ward|tool)\b/.test(label)) {
        return 'utility';
    }
    return 'cash';
};

const hudRecentActionLaneMap = (
    impact: ReturnType<typeof getVisualHudAnnouncementImpact> | null
): Array<{ action: string; count: number; id: HudRecentActionLaneId; label: string }> => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return [];
    }
    const counts = new Map<HudRecentActionLaneId, number>();
    for (const detail of impact.details) {
        const id = getHudRecentActionLaneId(detail);
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return HUD_RECENT_ACTION_LANE_ORDER
        .filter((id) => counts.has(id))
        .map((id) => ({
            action: HUD_RECENT_ACTION_LANE_ACTIONS[id],
            count: counts.get(id) ?? 0,
            id,
            label: HUD_RECENT_ACTION_LANE_LABELS[id]
        }));
};

const hudRecentActionLaneBeatCount = (lane: Pick<ReturnType<typeof hudRecentActionLaneMap>[number], 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'cash') {
        return 4;
    }
    if (lane.id === 'route' || lane.id === 'chain') {
        return 3;
    }
    return 2;
};

const hudRecentActionLaneAudioCue = (
    lane: Pick<ReturnType<typeof hudRecentActionLaneMap>[number], 'id'>
): 'hud-action-cash' | 'hud-action-chain' | 'hud-action-recover' | 'hud-action-route' | 'hud-action-utility' => {
    if (lane.id === 'route') {
        return 'hud-action-route';
    }
    if (lane.id === 'chain') {
        return 'hud-action-chain';
    }
    if (lane.id === 'utility') {
        return 'hud-action-utility';
    }
    if (lane.id === 'recover') {
        return 'hud-action-recover';
    }
    return 'hud-action-cash';
};

const hudRecentActionLaneScreenCue = (
    lane: Pick<ReturnType<typeof hudRecentActionLaneMap>[number], 'id'>
): 'burst' | 'guard' | 'pulse' | 'recover' => {
    if (lane.id === 'cash') {
        return 'burst';
    }
    if (lane.id === 'utility') {
        return 'guard';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    return 'pulse';
};

type HudChainLaneCueTone = 'setup' | 'cashout' | 'stack' | 'route' | 'combo';
type HudChainRewardLaneId = ChainRewardForecastCue['tone'];
type HudChainRewardLaneMapEntry = {
    action: ReturnType<typeof getChainRewardLaneAction>;
    count: number;
    cue: string;
    id: HudChainRewardLaneId;
    label: 'Shard' | 'Guard' | 'Heal';
};

const HUD_CHAIN_REWARD_LANE_ORDER: HudChainRewardLaneId[] = ['reward', 'guard', 'heal'];
const HUD_CHAIN_REWARD_LANE_LABELS: Record<HudChainRewardLaneId, HudChainRewardLaneMapEntry['label']> = {
    guard: 'Guard',
    heal: 'Heal',
    reward: 'Shard'
};

const hudChainRewardLaneMap = (
    cues: readonly ChainRewardForecastCue[]
): HudChainRewardLaneMapEntry[] => {
    const laneState = new Map<HudChainRewardLaneId, { action: ReturnType<typeof getChainRewardLaneAction>; count: number; cue: string }>();
    cues.forEach((cue) => {
        const state = laneState.get(cue.tone);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(cue.tone, { action: getChainRewardLaneAction(cue.urgency), count: 1, cue: getChainRewardUrgencyCopy(cue) });
    });

    return HUD_CHAIN_REWARD_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state
            ? [{ action: state.action, count: state.count, cue: state.cue, id, label: HUD_CHAIN_REWARD_LANE_LABELS[id] }]
            : [];
    });
};

const hudChainRewardLaneMapAttr = (laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'count' | 'id'>[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

const hudChainRewardLaneActionMapAttr = (
    laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'action' | 'count' | 'id'>[]
): string => (laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none');

const hudChainRewardLaneBeatCount = (lane: Pick<HudChainRewardLaneMapEntry, 'action' | 'id'>): 3 | 4 => {
    if (lane.action === 'Cash next' || lane.id === 'reward' || lane.id === 'guard') {
        return 4;
    }
    return 3;
};

const hudChainRewardLaneMapLabel = (
    laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'action' | 'count' | 'cue' | 'label'>[]
): string =>
    laneMap.length > 0
        ? `Chain reward lane map. ${laneMap.map((lane) => `${lane.label}: ${lane.count}. ${lane.action}. ${lane.cue}.`).join(' ')}`
        : 'Chain reward lane map';

type HudChainRewardLadderEntry = {
    action: ReturnType<typeof getChainRewardLaneAction>;
    cue: ChainRewardForecastCue;
    filled: number;
    progressLabel: string;
    remainingLabel: string;
    targetLabel: string;
    total: number;
};

const hudChainRewardLadder = (
    streak: number,
    cues: readonly ChainRewardForecastCue[]
): HudChainRewardLadderEntry[] =>
    cues
        .map((cue) => {
            const progress = getChainRewardProgress(streak, cue);
            return progress
                ? {
                      action: getChainRewardLaneAction(cue.urgency),
                      cue,
                      filled: progress.filled,
                      progressLabel: progress.label,
                      remainingLabel: progress.remainingLabel,
                      targetLabel: progress.targetLabel,
                      total: progress.total
                  }
                : null;
        })
        .filter((entry): entry is HudChainRewardLadderEntry => entry != null);

const hudChainRewardLadderAttr = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? entries.map((entry) => `${entry.cue.tone}:${entry.filled}/${entry.total}`).join('>')
        : 'none';

const hudChainRewardLadderActionAttr = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? entries.map((entry) => `${entry.cue.tone}:${entry.action}:${entry.filled}/${entry.total}`).join('>')
        : 'none';

const hudChainRewardLadderLabel = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? `Chain reward ladder. ${entries
              .map(
                  (entry) => {
                      const actionCopy = entry.action === entry.cue.chaseLabel ? '' : ` ${entry.action}:`;
                      return `${entry.cue.chaseLabel}:${actionCopy} ${entry.cue.label}. ${entry.progressLabel}. ${entry.remainingLabel}.`;
                  }
              )
              .join(' ')}`
        : 'Chain reward ladder';

const hudChainRewardBeatCount = (entry: HudChainRewardLadderEntry): 2 | 3 | 4 => {
    if (entry.cue.urgency === 'next' || entry.remainingLabel.startsWith('0 ')) {
        return 4;
    }
    if (entry.filled > 0 || entry.cue.urgency === 'soon') {
        return 3;
    }
    return 2;
};

const hudPrimaryRewardBeatCount = (cue: ChainRewardForecastCue): 2 | 3 | 4 => {
    if (cue.urgency === 'next' || (cue.stackSize ?? 1) >= 2 || cue.distance <= 1) {
        return 4;
    }
    if (cue.urgency === 'soon' || cue.distance <= 2) {
        return 3;
    }
    return 2;
};

const hudPrimaryRewardAudioCue = (
    cue: ChainRewardForecastCue
): 'reward-guard' | 'reward-heal' | 'reward-prime' | 'reward-shard' | 'reward-stack' => {
    if ((cue.stackSize ?? 1) >= 2) {
        return 'reward-stack';
    }
    if (cue.tone === 'guard') {
        return 'reward-guard';
    }
    if (cue.tone === 'heal') {
        return 'reward-heal';
    }
    if (cue.urgency === 'later') {
        return 'reward-prime';
    }
    return 'reward-shard';
};

const hudPrimaryRewardScreenCue = (cue: ChainRewardForecastCue): HudScreenCue => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

const hudEndlessRiskWagerBeatCount = (streakAtRisk: number): 3 | 4 => (streakAtRisk >= 3 ? 4 : 3);

const hudInRunCauseAction = (
    row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>
):
    | 'Bank reward'
    | 'Clear pressure'
    | 'Hold recall'
    | 'Protect run'
    | 'Push objective'
    | 'Push route'
    | 'Spend bank'
    | 'Stabilize hazard' => {
    if (row.kind === 'objective_progress') {
        return 'Push objective';
    }
    if (row.kind === 'match_reward') {
        return 'Bank reward';
    }
    if (row.kind === 'hazard_trigger') {
        return 'Stabilize hazard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure') {
        return 'Clear pressure';
    }
    if (row.kind === 'recall_feedback') {
        return 'Hold recall';
    }
    if (row.kind === 'route_reward') {
        return 'Push route';
    }
    if (row.kind === 'perfect_memory_locked') {
        return 'Protect run';
    }
    if (row.kind === 'economy_delta') {
        return 'Spend bank';
    }
    return row.tokens.includes('risk') || row.tokens.includes('cost') ? 'Protect run' : 'Push route';
};

const hudInRunCauseBeatCount = (row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>): 2 | 3 | 4 => {
    if (
        row.kind === 'hazard_trigger' ||
        row.kind === 'combat_feedback' ||
        row.kind === 'boss_pressure' ||
        row.kind === 'perfect_memory_locked' ||
        row.tokens.includes('risk') ||
        row.tokens.includes('forfeit')
    ) {
        return 4;
    }
    if (
        row.kind === 'objective_progress' ||
        row.kind === 'match_reward' ||
        row.kind === 'recall_feedback' ||
        row.tokens.includes('reward') ||
        row.tokens.includes('momentum') ||
        row.tokens.includes('resolved')
    ) {
        return 3;
    }
    return 2;
};

const hudInRunCauseAudioCue = (
    row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>
):
    | 'hud-cause-objective'
    | 'hud-cause-reward'
    | 'hud-cause-hazard'
    | 'hud-cause-pressure'
    | 'hud-cause-recall'
    | 'hud-cause-route'
    | 'hud-cause-guard'
    | 'hud-cause-bank' => {
    if (row.kind === 'objective_progress') {
        return 'hud-cause-objective';
    }
    if (row.kind === 'match_reward') {
        return 'hud-cause-reward';
    }
    if (row.kind === 'hazard_trigger') {
        return 'hud-cause-hazard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure') {
        return 'hud-cause-pressure';
    }
    if (row.kind === 'recall_feedback') {
        return 'hud-cause-recall';
    }
    if (row.kind === 'route_reward') {
        return 'hud-cause-route';
    }
    if (row.kind === 'perfect_memory_locked' || row.tokens.includes('risk') || row.tokens.includes('cost')) {
        return 'hud-cause-guard';
    }
    return 'hud-cause-bank';
};

const hudInRunCauseScreenCue = (
    row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>
): 'burst' | 'guard' | 'pressure' | 'route' | 'pulse' => {
    if (row.kind === 'hazard_trigger' || row.kind === 'perfect_memory_locked' || row.tokens.includes('risk')) {
        return 'guard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure' || row.tokens.includes('cost')) {
        return 'pressure';
    }
    if (row.kind === 'objective_progress' || row.kind === 'match_reward' || row.tokens.includes('reward')) {
        return 'burst';
    }
    if (row.kind === 'route_reward') {
        return 'route';
    }
    return 'pulse';
};

const hudChainRewardAudioCue = (
    cue: ChainRewardForecastCue
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

const hudChainRewardScreenCue = (cue: ChainRewardForecastCue): HudScreenCue => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

const hudChainLaneAction = (
    cue: ReturnType<typeof getHudChainLaneCue>
): 'Cash now' | 'Hold combo' | 'Prime chain' | 'Prime route' | 'Stack cashout' => {
    if (cue.tone === 'stack') {
        return 'Stack cashout';
    }
    if (cue.tone === 'cashout') {
        return 'Cash now';
    }
    if (cue.tone === 'route') {
        return 'Prime route';
    }
    if (cue.tone === 'combo') {
        return 'Hold combo';
    }
    return 'Prime chain';
};

const hudChainLaneAudioCue = (
    cue: ReturnType<typeof getHudChainLaneCue>
): 'chain-cashout' | 'chain-hold' | 'chain-prime' | 'chain-route' | 'chain-stack' => {
    if (cue.tone === 'stack') {
        return 'chain-stack';
    }
    if (cue.tone === 'cashout') {
        return 'chain-cashout';
    }
    if (cue.tone === 'route') {
        return 'chain-route';
    }
    if (cue.tone === 'combo') {
        return 'chain-hold';
    }
    return 'chain-prime';
};

const hudChainLaneScreenCue = (cue: ReturnType<typeof getHudChainLaneCue>): HudScreenCue => {
    if (cue.tone === 'stack' || cue.tone === 'cashout') {
        return 'burst';
    }
    if (cue.tone === 'route' || cue.tone === 'setup') {
        return 'pulse';
    }
    return 'tick';
};

const getHudChainLaneCue = ({
    primaryRewardHot,
    primaryRewardLabel,
    streak,
    stackedPayoffCount,
    traitRouteActive
}: {
    primaryRewardHot: boolean;
    primaryRewardLabel?: string | null;
    streak: number;
    stackedPayoffCount: number;
    traitRouteActive: boolean;
}): { label: string; tone: HudChainLaneCueTone; detail: string } => {
    if (stackedPayoffCount >= 2) {
        return { label: 'Stack cashout', tone: 'stack', detail: `${stackedPayoffCount} rewards on the next clean match` };
    }
    if (primaryRewardHot) {
        return {
            label: 'Cashout now',
            tone: 'cashout',
            detail: primaryRewardLabel
                ? `Next clean match pays ${primaryRewardLabel}`
                : 'Next clean match pays the nearest chain reward'
        };
    }
    if (traitRouteActive) {
        return { label: 'Route chain', tone: 'route', detail: 'Keep streak while converting trait adjacency' };
    }
    if (streak >= 10) {
        return { label: 'Combo hold', tone: 'combo', detail: 'Protect the capped combo lane' };
    }
    if (streak <= 0) {
        return { label: 'Prime chain', tone: 'setup', detail: 'First safe match starts the payoff lane' };
    }
    return { label: 'Prime cashout', tone: 'setup', detail: 'Keep matching toward the next reward threshold' };
};

const GameplayHudBar = ({
    run,
    cameraViewportMode,
    gauntletRemainingMs,
    politeHudAnnouncement = '',
    politeHudAnnouncementPriority = 'info',
    reduceMotion = false
}: GameplayHudBarProps) => {
    const floorHexUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const floorHexStrokeGradId = `hud-floor-hex-stroke-${floorHexUid}`;
    const floorHexFillGradId = `hud-floor-hex-fill-${floorHexUid}`;

    const board = run.board;
    if (!board) {
        return null;
    }

    const healthTone = run.lives <= 1 ? 'critical' : run.lives < MAX_LIVES ? 'wounded' : 'safe';
    const lifeTrackLabel =
        run.lives <= 1
            ? `${run.lives} of ${MAX_LIVES} lives remaining. Critical health; protect the last life.`
            : `${run.lives} of ${MAX_LIVES} lives remaining`;
    const lifeSegmentTitle =
        run.lives <= 1
            ? 'Critical health: one more unguarded hit can end the run.'
            : 'Lives carry across floors; clean clears, routes, shops, rests, and shrines can restore them.';
    const resourceSegmentTitle = [
        temporaryCurrencyPurpose(run, 'combo_shards'),
        'Guard tokens absorb mismatch damage before lives are lost.'
    ]
        .filter(Boolean)
        .join(' ');
    const matchedPairCount = Math.min(board.pairCount, board.matchedPairs);
    const remainingPairCount = Math.max(0, board.pairCount - matchedPairCount);
    const pairProgressTitle =
        remainingPairCount === 0
            ? 'All required pairs are clear. The exit or floor clear prompt is ready.'
            : `${remainingPairCount} ${remainingPairCount === 1 ? 'pair remains' : 'pairs remain'} before the floor is clear.`;
    const compactHudAnnouncement = politeHudAnnouncement
        ? formatHudActionFeedbackText(politeHudAnnouncement, { maxChars: 76, maxSentences: 1 })
        : '';
    const recentActionFeedback = compactHudAnnouncement
        ? getHudActionFeedbackProfile(politeHudAnnouncement, politeHudAnnouncementPriority)
        : null;
    const recentActionImpact = compactHudAnnouncement
        ? getVisualHudAnnouncementImpact(politeHudAnnouncement, politeHudAnnouncementPriority)
        : null;
    const recentActionStackLabel = hudRecentActionStackLabel(recentActionImpact);
    const recentActionStackSummary = hudRecentActionStackSummary(recentActionImpact);
    const recentActionImpactCue = hudRecentActionImpactCue(recentActionImpact);
    const recentActionImpactBeatCount = hudRecentActionImpactBeatCount(recentActionImpact);
    const recentActionImpactScreenCue = hudRecentActionImpactScreenCue(recentActionImpactCue);
    const recentActionLaneMap = hudRecentActionLaneMap(recentActionImpact);
    const primaryRecentActionLane = recentActionLaneMap[0] ?? null;
    const recentActionLaneMapAttr =
        recentActionLaneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') || 'none';
    const recentActionLaneActionMapAttr =
        recentActionLaneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') || 'none';
    const recentActionLaneMapLabel =
        recentActionLaneMap.length > 0
            ? `Lane map. ${recentActionLaneMap.map((lane) => `${lane.label}: ${lane.count}. ${lane.action}`).join('. ')}.`
            : null;
    const recentActionLabel = recentActionFeedback?.label ?? 'Action result';
    const recentActionDetailsLabel =
        recentActionImpact?.details && recentActionImpact.details.length > 0
            ? ` Impact cue: ${recentActionImpactCue ?? 'Payoff cue'}. Impact: ${recentActionImpact.details.slice(0, 3).map((detail) => detail.label).join(', ')}.${
                  recentActionStackLabel ? ` Stack: ${recentActionStackLabel}.` : ''
              }${
                  recentActionLaneMapLabel ? ` ${recentActionLaneMapLabel}` : ''
              }${
                  recentActionStackSummary
                      ? ` ${recentActionStackSummary.label}: ${recentActionStackSummary.action}. ${recentActionStackSummary.value}. ${recentActionStackSummary.firstCue}. ${recentActionStackSummary.thenCue}. ${recentActionStackSummary.keepCue}.`
                      : ''
              }`
            : '';
    const recentActionAriaLabel = compactHudAnnouncement
        ? `${recentActionLabel}: ${sentenceWithPeriod(compactHudAnnouncement)}${recentActionDetailsLabel}`
        : undefined;
    const dailyDateStripKey = run.gameMode === 'daily' && run.dailyDateKeyUtc ? run.dailyDateKeyUtc : null;
    const dungeonShowcaseActive =
        run.practiceMode &&
        run.gameMode === 'endless' &&
        board.level >= 5 &&
        run.activeMutators.includes('wide_recall') &&
        !run.wildMenuRun &&
        run.activeContract == null;
    const puzzleModeTitle = run.puzzleId ? (BUILTIN_PUZZLES[run.puzzleId]?.title ?? run.puzzleId) : null;
    const hudModeLabel =
        dailyDateStripKey != null
            ? 'Daily challenge'
            : gauntletRemainingMs !== null
              ? 'Gauntlet'
              : dungeonShowcaseActive
                ? 'Dungeon Showcase'
                : run.gameMode === 'puzzle'
                  ? puzzleModeTitle
                      ? `Puzzle: ${puzzleModeTitle}`
                      : 'Puzzle'
              : run.activeContract?.noShuffle
                ? 'Scholar Contract'
                : run.activeContract?.maxPinsTotalRun != null
                  ? 'Pin vow'
                : run.gameMode === 'meditation'
                  ? 'Meditation Run'
                  : run.wildMenuRun
                    ? 'Wild Run'
                    : run.practiceMode
                      ? 'Practice'
                    : run.gameMode === 'endless'
                      ? 'Classic Dungeon'
                      : 'Arcade Run';
    const nBackMutatorActive = run.activeMutators.includes('n_back_anchor');
    const nBackLabel =
        run.nBackAnchorPairKey && nBackMutatorActive ? `Anchor ${run.nBackAnchorPairKey.slice(0, 6)}` : null;
    const scoreParasiteActive = run.activeMutators.includes('score_parasite');
    const parasiteFloorProgress = Math.min(1, run.parasiteFloors / 4);
    const mutatorsForChips = run.activeMutators.filter((id) => !(scoreParasiteActive && id === 'score_parasite'));
    const endlessChapterActive =
        run.gameMode === 'endless' &&
        usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
        board.floorArchetypeId != null;
    const perfectMemoryHud = perfectMemoryHudKind(run.achievementsEnabled, run.powersUsedThisRun);
    const perfectMemoryAttribution = getPerfectMemoryAttribution(run);
    const activeRiskWagerFavor =
        run.endlessRiskWager != null
            ? run.endlessRiskWager.bonusFavorOnSuccess + (run.relicIds.includes('wager_surety') ? 1 : 0)
            : 0;
    const activeRiskWagerBeatCount = run.endlessRiskWager
        ? hudEndlessRiskWagerBeatCount(run.endlessRiskWager.streakAtRisk)
        : 0;
    const archetype = getFloorArchetypeDefinition(board.floorArchetypeId);
    const featuredObjectiveLabel = getFeaturedObjectiveLabel(board.featuredObjectiveId);
    const objectiveSignalRows = getHudObjectiveSignals({
        activeRiskWagerFavor,
        featuredObjectiveLabel,
        relicFavorProgress: run.relicFavorProgress,
        riskWagerActive: Boolean(run.endlessRiskWager?.targetLevel === board.level),
        streakAtRisk: run.endlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
    });
    const objectiveSignalsLabel = formatHudSignalRowsLabel('Objective reward signals', objectiveSignalRows);
    const floorIdentity = getFloorIdentityContract({
        floorTag: board.floorTag ?? 'normal',
        floorArchetypeId: board.floorArchetypeId,
        mutators: run.activeMutators,
        featuredObjectiveLabel
    });
    const difficultyProfile = getDefaultDifficultyProfile();
    const secondaryObjectiveRows = getSecondaryObjectiveStatusRows(run);
    const buildProfile = getRunBuildProfile(run);
    const rewardPerkRows = getRewardPerkReadinessRows(run).slice(0, 3);
    const rewardPerkFocus = getHudRewardPerkFocus(rewardPerkRows);
    const rewardPerkBeatCue = getHudRewardPerkBeatCue(rewardPerkFocus);
    const rewardPerkBeatAudioCue = hudRewardPerkBeatAudioCue(rewardPerkBeatCue);
    const rewardPerkBeatScreenCue = hudRewardPerkBeatScreenCue(rewardPerkBeatCue);
    const rewardPerkRowsLabel = formatHudPerkRowsLabel('Active perk payoff signals', rewardPerkRows);
    const rewardPerkLaneMap = getHudRewardPerkLaneMap(rewardPerkRows);
    const rewardPerkLaneMapAttr = formatHudRewardPerkLaneMapAttr(rewardPerkLaneMap);
    const rewardPerkLaneActionMapAttr = formatHudRewardPerkLaneActionMapAttr(rewardPerkLaneMap);
    const rewardPerkLaneMapLabel = formatHudRewardPerkLaneMapLabel(rewardPerkLaneMap);
    const hazardTileSummary = getHazardTileBoardSummary(board);
    const traitOpportunitySummary = getTraitOpportunitySummary(board);
    const traitOpportunityHud = getTraitOpportunityHudModel(board, run);
    const traitOpportunityCardLine = traitOpportunitySummary.tiles.length > 0
        ? traitOpportunitySummary.tiles
              .slice(0, 5)
              .map((tile) => `${tile.label} (${tile.traitKind})`)
              .join(', ')
        : null;
    const traitOpportunityKindLine = traitOpportunitySummary.tiles.length > 0
        ? traitOpportunitySummary.tiles.map((tile) => tile.traitKind).join(', ')
        : null;
    const traitOpportunityCardCountLabel =
        traitOpportunitySummary.tiles.length > 0
            ? `${traitOpportunitySummary.tiles.length} combo card${traitOpportunitySummary.tiles.length === 1 ? '' : 's'}`
            : null;
    const traitOpportunityCardTitle = traitOpportunitySummary.reason
        ? `Trait combo opportunities. ${traitOpportunityCardCountLabel ?? 'No combo cards'}. Types: ${traitOpportunityKindLine ?? 'none'}. ${traitOpportunitySummary.reason}.`
        : traitOpportunityCardLine
          ? `Trait combo opportunities. ${traitOpportunityCardCountLabel ?? 'Combo cards'}. ${traitOpportunityCardLine}.`
          : 'Trait combo opportunities';
    const traitOpportunityLaneLines =
        traitOpportunitySummary.interactionLines.length > 0
            ? traitOpportunitySummary.interactionLines
            : traitOpportunityHud.swapHint?.matchCreatedLines ?? [];
    const traitOpportunityLaneMap = buildTraitInteractionLaneMap(traitOpportunityLaneLines);
    const traitOpportunityLaneMapAttr = traitInteractionLaneMapAttr(traitOpportunityLaneMap);
    const traitOpportunityLaneActionMapAttr = traitInteractionLaneActionMapAttr(traitOpportunityLaneMap);
    const traitOpportunityLaneMapLabel = formatTraitInteractionLaneMapLabel(
        'Trait interaction lanes',
        traitOpportunityLaneMap
    );
    const primaryTraitOpportunityLane = traitOpportunityLaneMap[0] ?? null;
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const traitRouteActionBeatCount = traitRouteObjectiveStatus
        ? hudTraitRouteActionBeatCount(traitRouteObjectiveStatus.urgency)
        : 0;
    const traitRouteActionAudioCue = traitRouteObjectiveStatus
        ? hudTraitRouteActionAudioCue(traitRouteObjectiveStatus.urgency)
        : 'trait-route-watch';
    const traitRouteActionScreenCue = traitRouteObjectiveStatus
        ? hudTraitRouteActionScreenCue(traitRouteObjectiveStatus.urgency)
        : 'tick';
    const traitRouteProgressLabel = traitRouteObjectiveStatus
        ? `${traitRouteObjectiveStatus.progress}/${traitRouteObjectiveStatus.required}`
        : traitOpportunityHud.routeCountLabel;
    const traitRouteBestToolLabel = traitOpportunityHud.swapHint ? 'Best tool: Swap' : null;
    const traitRouteMeterPercent = traitRouteObjectiveStatus
        ? Math.min(100, Math.max(0, traitRouteObjectiveStatus.progress) / Math.max(1, traitRouteObjectiveStatus.required) * 100)
        : 0;
    const chainMomentumTier = getChainMomentumTier(run.stats.currentStreak);
    const chainMomentumLabel = getChainMomentumLabel(chainMomentumTier);
    const chainMomentumSubline = getChainMomentumSubline(run.stats.currentStreak, traitOpportunityHud.active);
    const chainMomentumMeterPercent = Math.min(100, Math.max(0, run.stats.currentStreak) / 10 * 100);
    const chainMilestonePreview = getChainMilestonePreview(run.stats.currentStreak);
    const nextChainTargetLabel =
        chainMilestonePreview.distance <= 0
            ? chainMilestonePreview.distanceLabel
            : `${chainMilestonePreview.distanceLabel} to ${chainMilestonePreview.target}`;
    const chainRewardForecastCues = getChainRewardForecastCues(
        run.stats.currentStreak,
        run.stats.comboShards,
        run.lives
    );
    const primaryResourceRewardCue = chainRewardForecastCues[0] ?? null;
    const primaryResourceRewardBeatCount = primaryResourceRewardCue
        ? hudPrimaryRewardBeatCount(primaryResourceRewardCue)
        : 0;
    const primaryResourceRewardAction = primaryResourceRewardCue
        ? getChainRewardLaneAction(primaryResourceRewardCue.urgency)
        : 'none';
    const primaryResourceRewardAudioCue = primaryResourceRewardCue
        ? hudPrimaryRewardAudioCue(primaryResourceRewardCue)
        : 'reward-prime';
    const primaryResourceRewardScreenCue = primaryResourceRewardCue
        ? hudPrimaryRewardScreenCue(primaryResourceRewardCue)
        : 'tick';
    const primaryRewardHot = primaryResourceRewardCue?.urgency === 'next';
    const nearestRewardDistance = primaryResourceRewardCue?.distance ?? null;
    const stackedChainRewardCues =
        nearestRewardDistance != null
            ? chainRewardForecastCues.filter((cue) => cue.distance === nearestRewardDistance)
            : [];
    const stackedChainRewardHot =
        primaryRewardHot && stackedChainRewardCues.length >= 2 ? stackedChainRewardCues : [];
    const stackedChainRewardLabel =
        stackedChainRewardHot.length > 0
            ? `${stackedChainRewardHot.length}x payoff next: ${stackedChainRewardHot
                  .map((cue) => cue.label)
                  .join(' + ')}`
            : '';
    const chainLaneCue = getHudChainLaneCue({
        primaryRewardHot,
        primaryRewardLabel: primaryResourceRewardCue?.label ?? null,
        stackedPayoffCount: stackedChainRewardHot.length,
        streak: run.stats.currentStreak,
        traitRouteActive: traitOpportunityHud.active
    });
    const chainLaneAction = hudChainLaneAction(chainLaneCue);
    const chainLaneAudioCue = hudChainLaneAudioCue(chainLaneCue);
    const chainLaneScreenCue = hudChainLaneScreenCue(chainLaneCue);
    const chainNextFirstCue =
        run.stats.currentStreak >= 10
            ? 'First: protect combo max'
            : run.stats.currentStreak <= 0
              ? 'First: match any safe match'
              : primaryRewardHot
                ? 'First: cash next match'
                : `First: ${nextChainTargetLabel}`;
    const chainNextThenCue =
        stackedChainRewardHot.length > 0
            ? 'Then: spend stacked payoff'
            : primaryResourceRewardCue
              ? `Then: chase ${primaryResourceRewardCue.label}`
              : traitOpportunityHud.active
                ? 'Then: convert route traits'
                : 'Then: keep streak alive';
    const chainNextKeepCue = `Keep: ${chainLaneCue.label.toLowerCase()}`;
    const primaryChainRewardProgress = getChainRewardProgress(run.stats.currentStreak, primaryResourceRewardCue);
    const primaryRewardHotBand =
        primaryRewardHot && primaryResourceRewardCue
            ? {
                  cue: primaryResourceRewardCue,
                  detail:
                      primaryChainRewardProgress?.remainingLabel ??
                      primaryResourceRewardCue.chaseLabel ??
                      'One match left',
                  label: 'Reward hot',
                  tone: 'cashout' as const,
                  value: primaryResourceRewardCue.label
              }
            : null;
    const primaryRewardHotBandLabel = primaryRewardHotBand
        ? `Chain reward hot band. ${primaryRewardHotBand.label}. ${primaryRewardHotBand.value}. ${primaryRewardHotBand.detail}.`
        : undefined;
    const chainComboSurgeBand =
        traitOpportunityHud.active && traitOpportunityHud.routeCountLabel !== '1 route' && traitOpportunityHud.routeCountLabel !== 'setup'
            ? {
                  cue: traitOpportunityHud.primaryLine,
                  detail: traitOpportunityHud.routeCountLabel,
                  label: 'Combo surge',
                  tone: 'surge' as const,
                  value: traitOpportunityHud.buildLabel
              }
            : null;
    const chainComboSurgeBandLabel = chainComboSurgeBand
        ? `Chain combo surge band. ${chainComboSurgeBand.label}. ${chainComboSurgeBand.value}. ${chainComboSurgeBand.detail}. ${chainComboSurgeBand.cue}.`
        : undefined;
    const findableProgressState = getFindableProgressState(
        run.findablesClaimedThisFloor,
        run.findablesTotalThisFloor
    );
    const findableProgressSubline = getFindableProgressSubline(
        run.findablesClaimedThisFloor,
        run.findablesTotalThisFloor
    );
    const unclaimedFindableCount = Math.max(0, run.findablesTotalThisFloor - run.findablesClaimedThisFloor);
    const pickupChainStackCue =
        unclaimedFindableCount > 0 && primaryRewardHot && primaryResourceRewardCue
            ? {
                  action: stackedChainRewardHot.length > 0 ? 'Cash pickup super stack' : 'Cash pickup stack',
                  label: stackedChainRewardHot.length > 0 ? 'Pickup super stack' : 'Pickup + Chain',
                  value: `${unclaimedFindableCount} pickup${unclaimedFindableCount === 1 ? '' : 's'} + ${primaryResourceRewardCue.label}`
              }
            : null;
    const traitChainStackCue =
        traitOpportunityHud.active && primaryRewardHot && primaryResourceRewardCue
            ? {
                  action: stackedChainRewardHot.length > 0 ? 'Cash trait super stack' : 'Cash trait stack',
                  label: stackedChainRewardHot.length > 0 ? 'Trait super stack' : 'Trait + Chain',
                  value: `${traitOpportunityHud.routeCountLabel} + ${primaryResourceRewardCue.label}`
              }
            : null;
    const findableProgressMeterPercent =
        run.findablesTotalThisFloor > 0
            ? Math.min(100, Math.max(0, run.findablesClaimedThisFloor) / run.findablesTotalThisFloor * 100)
            : 0;
    const pickupRewardPreviewRows = getFindableRows()
        .filter((row) => row.comboShards > 0 || row.score > 0 || row.safeHazardWards > 0)
        .slice(0, 3);
    const primaryResourceRewardCueLabel = primaryResourceRewardCue
        ? formatRewardPreviewLabel('Nearest chain reward', [
              {
                  ...primaryResourceRewardCue,
                  rewardText: `${getChainRewardLaneAction(primaryResourceRewardCue.urgency)}: ${getChainRewardUrgencyCopy(primaryResourceRewardCue)}: ${primaryResourceRewardCue.label}`
              }
          ])
        : undefined;
    const pickupRewardPreviewLabel = formatRewardPreviewLabel(
        `Pickup reward preview ${run.findablesClaimedThisFloor} of ${run.findablesTotalThisFloor}`,
        pickupRewardPreviewRows
    );
    const chainRewardForecastLabel = formatRewardPreviewLabel(
        'Chain reward forecast',
        chainRewardForecastCues.map((cue) => {
            const stackLabel = getChainRewardStackLabel(cue);

            return {
                ...cue,
                rewardText: `${getChainRewardLaneAction(cue.urgency)}: ${getChainRewardUrgencyCopy(cue)}: ${cue.label}${stackLabel ? `: ${stackLabel}` : ''}`
            };
        })
    );
    const chainRewardLaneMap = hudChainRewardLaneMap(chainRewardForecastCues);
    const primaryChainRewardLane = chainRewardLaneMap[0] ?? null;
    const primaryChainRewardLaneCue = primaryChainRewardLane
        ? chainRewardForecastCues.find((cue) => cue.tone === primaryChainRewardLane.id) ?? null
        : null;
    const chainRewardCueForLane = (lane: HudChainRewardLaneMapEntry): ChainRewardForecastCue | null =>
        chainRewardForecastCues.find((cue) => cue.tone === lane.id) ?? null;
    const chainRewardLaneMapAttr = hudChainRewardLaneMapAttr(chainRewardLaneMap);
    const chainRewardLaneActionMapAttr = hudChainRewardLaneActionMapAttr(chainRewardLaneMap);
    const chainRewardLaneMapAccessibleLabel = hudChainRewardLaneMapLabel(chainRewardLaneMap);
    const chainRewardLadder = hudChainRewardLadder(run.stats.currentStreak, chainRewardForecastCues);
    const chainRewardLadderAttr = hudChainRewardLadderAttr(chainRewardLadder);
    const chainRewardLadderActionAttr = hudChainRewardLadderActionAttr(chainRewardLadder);
    const chainRewardLadderAccessibleLabel = hudChainRewardLadderLabel(chainRewardLadder);
    const inRunCauseRows = getInRunCauseRows(run).slice(0, 3);
    const primaryInRunCauseRow =
        inRunCauseRows.reduce<FeedbackCauseRow | null>((primary, row) => {
            if (!primary || hudInRunCauseBeatCount(row) > hudInRunCauseBeatCount(primary)) {
                return row;
            }
            return primary;
        }, null);
    const touchHudDetailRows = getTouchHudDetailRows(run);
    const encounterIdentity = getBossEncounterIdentityForFloor(board.floorTag ?? 'normal', {
        floorArchetypeId: board.floorArchetypeId,
        mutators: run.activeMutators,
        riskProfile: archetype?.riskProfile ?? null
    });
    const bossPressureRule = board.floorTag === 'boss' ? getActiveDungeonBossPressureRule(board) : null;
    const bossCounterplayItem = bossPressureRule ? SHOP_ITEM_CATALOG[bossPressureRule.shopPriorityItemId] : null;
    const bossCounterplayLabel = bossCounterplayItem ? `Counter: ${bossCounterplayItem.label}` : null;
    const bossCounterplayTitle = [
        encounterIdentity?.payoffCopy ?? 'Keystone Warden scoring',
        bossPressureRule?.pressureCopy,
        bossCounterplayLabel
    ]
        .filter(Boolean)
        .join(' ');
    const bossReminderTitle = [
        'Study the first reveal, then finish the boss objective before leaving.',
        bossPressureRule?.pressureCopy,
        bossCounterplayLabel
    ]
        .filter(Boolean)
        .join(' ');
    const bossReminderText = bossCounterplayLabel ? `Boss trophy - ${bossCounterplayLabel}` : 'Boss trophy';
    const contextChips: { className: string; key: string; label: string; testId: string; title: string; glyph: ReactNode }[] = [];
    if (run.gameMode === 'gauntlet') {
        contextChips.push({
            className: styles.mutatorChipGauntlet,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <rect fill="none" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" width="9" x="3.5" y="3.5" />
                        <path d="M8 2.4V4.2M8 11.8v1.8M2.4 8H4.2M11.8 8H13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
                    </svg>
                </span>
            ),
            key: 'ctx-gauntlet',
            label: 'Gauntlet',
            testId: 'hud-chip-gauntlet',
            title: 'Timed gauntlet run — clear floors before the clock hits zero'
        });
    }
    if (run.activeContract?.noShuffle) {
        contextChips.push({
            className: styles.mutatorChipScholar,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                    <img alt="" className={styles.mutatorChipBookImg} height={14} src={codexBookUrl} width={14} />
                </span>
            ),
            key: 'ctx-scholar',
            label: 'Scholar',
            testId: 'hud-chip-scholar',
            title: 'Scholar contract: board shuffle is disabled'
        });
    }
    if (run.shuffleScoreTaxActive) {
        contextChips.push({
            className: styles.mutatorChipShuffleTax,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                    <img alt="" className={styles.mutatorChipShuffleImg} height={14} src={shuffleIconUrl} width={14} />
                </span>
            ),
            key: 'ctx-shuffle-tax',
            label: 'Shuffle tax',
            testId: 'hud-chip-shuffle-tax',
            title: 'Match score multiplier is reduced after shuffles this run'
        });
    }
    const showMutatorChipRow = contextChips.length > 0 || mutatorsForChips.length > 0;
    const showNoMutatorsCopy = run.activeMutators.length === 0 && contextChips.length === 0;

    /*
     * PLAY-003 (HUD IA): Primary row keeps the reference “slim strip” read — floor, lives, shards, hero score,
     * plus identity widgets (daily id, score-parasite) in the top-right grid cell. Mode label, mutator/context
     * chips, and the compact stat rail move to a second slim strip below on wide layouts so they do not set
     * the primary row’s height or compete optically with score. Narrow / mobile camera stacks the primary
     * grid first, then this context strip (toolbar flyout was considered and rejected here to avoid hiding
     * live mutator state behind an extra tap).
     */
    return (
        <header
            className={`${styles.hudRow} ${cameraViewportMode ? styles.mobileCameraHud : ''}`}
            data-reg-hud-ia="v1"
            data-reg-hud-primary-lanes={REG106_HUD_IA.primary.join(',')}
            data-testid="game-hud"
        >
            <div className={`${styles.floatingDeck} ${styles.statsDeck} ${styles.hudDeck}`} role="group" aria-label="Run stats">
                <div className={styles.hudDeckDualRow}>
                    <div className={styles.hudPrimaryStatsRow}>
                    <div className={styles.hudStripLeftModule} data-testid="hud-wing-left">
                        <div className={styles.floorBadgeHexFrame} data-testid="hud-floor-hex-frame">
                            <svg
                                aria-hidden="true"
                                className={styles.floorBadgeHexSvg}
                                preserveAspectRatio="xMidYMid meet"
                                viewBox="0 0 72 88"
                            >
                                <defs>
                                    <linearGradient
                                        id={floorHexStrokeGradId}
                                        gradientUnits="userSpaceOnUse"
                                        x1="8"
                                        x2="64"
                                        y1="10"
                                        y2="78"
                                    >
                                        <stop offset="0%" stopColor="#F2D39D" stopOpacity="0.95" />
                                        <stop offset="42%" stopColor="#C3954F" />
                                        <stop offset="100%" stopColor="#6B441B" stopOpacity="0.9" />
                                    </linearGradient>
                                    <linearGradient id={floorHexFillGradId} x1="36" x2="36" y1="12" y2="76" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#F2D39D" stopOpacity="0.14" />
                                        <stop offset="55%" stopColor="#8A6228" stopOpacity="0.06" />
                                        <stop offset="100%" stopColor="#0a0c12" stopOpacity="0.22" />
                                    </linearGradient>
                                </defs>
                                <polygon
                                    fill={`url(#${floorHexFillGradId})`}
                                    points="36,3 68,25 68,63 36,85 4,63 4,25"
                                    stroke={`url(#${floorHexStrokeGradId})`}
                                    strokeLinejoin="round"
                                    strokeWidth="2.35"
                                />
                                <polygon
                                    fill="none"
                                    points="36,9.5 62.5,28.5 62.5,59.5 36,78.5 9.5,59.5 9.5,28.5"
                                    stroke="#F2D39D"
                                    strokeLinejoin="round"
                                    strokeOpacity="0.38"
                                    strokeWidth="0.85"
                                />
                            </svg>
                            <div className={`${styles.hudSegment} ${styles.floorBadge}`} title={`${floorIdentity.teachingSentence} ${floorIdentity.counterplaySentence}`}>
                                <span className={styles.floorLabel}>Floor</span>
                                <span className={styles.floorValue}>{board.level}</span>
                                {board.floorTag === 'boss' ? (
                                    <span className={styles.floorTagPill} data-testid="hud-encounter-identity" title={bossCounterplayTitle}>
                                        {encounterIdentity?.label ? `Boss: ${encounterIdentity.label}` : 'Boss'}
                                    </span>
                                ) : board.floorTag === 'breather' ? (
                                    <span className={styles.floorTagPill} data-testid="hud-floor-identity" title={floorIdentity.activeReminder}>
                                        {floorIdentity.label}
                                    </span>
                                ) : floorIdentity.warningLevel !== 'baseline' ? (
                                    <span className={styles.floorTagPill} data-testid="hud-floor-identity" title={floorIdentity.activeReminder}>
                                        {floorIdentity.label}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className={styles.hudStripDivider} aria-hidden="true" />
                        {/*
                         * PLAY-004: Reference mock shows three hearts; live rules cap at MAX_LIVES (5).
                         * Product: honest contract — always render MAX_LIVES heart slots plus an explicit
                         * current/max readout so five empty/filled slots stay legible on narrow HUD widths.
                         */}
                        <div
                            className={`${styles.hudSegment} ${styles.hudLivesSegment}`}
                            data-health={healthTone}
                            data-testid="hud-lives"
                            title={lifeSegmentTitle}
                        >
                            <span className={styles.statKey}>Lives</span>
                            <div
                                className={styles.lifeTrack}
                                role="group"
                                aria-label={lifeTrackLabel}
                            >
                                {Array.from({ length: MAX_LIVES }).map((_, index) => (
                                    <span
                                        aria-hidden="true"
                                        className={index < run.lives ? styles.lifeHeartActive : styles.lifeHeartInactive}
                                        key={`life-${index}`}
                                    >
                                        ♥
                                    </span>
                                ))}
                            </div>
                            <span className={`${styles.statSubline} ${styles.lifeCapReadout}`}>
                                {run.lives <= 1 ? 'Critical ' : ''}{run.lives} / {MAX_LIVES}
                            </span>
                        </div>
                        <div className={styles.hudStripDivider} aria-hidden="true" />
                        <div
                            className={`${styles.hudSegment} ${styles.statPill} ${styles.hudShardsSegment}`}
                            data-primary-reward-hot={primaryRewardHot ? 'true' : 'false'}
                            data-hud-combo-surge={chainComboSurgeBand ? 'true' : 'false'}
                            data-testid="hud-combo-shards"
                            title={resourceSegmentTitle}
                        >
                            <span className={styles.statKey}>Shards</span>
                            <span className={`${styles.statVal} ${styles.hudShardsValue}`}>{run.stats.comboShards}</span>
                            <span className={styles.statSubline}>Guards {run.stats.guardTokens}</span>
                            <span className={styles.statSubline}>3 shards = +1 life</span>
                            {primaryResourceRewardCue ? (
                                <span
                                    aria-label={primaryResourceRewardCueLabel}
                                    className={styles.hudPrimaryRewardCue}
                                    data-primary-reward-action={primaryResourceRewardAction}
                                    data-primary-reward-audio={primaryResourceRewardAudioCue}
                                    data-primary-reward-beats={primaryResourceRewardBeatCount}
                                    data-primary-reward-distance={primaryResourceRewardCue.distance}
                                    data-primary-reward-progress={primaryChainRewardProgress?.label ?? 'none'}
                                    data-primary-reward-urgency={primaryResourceRewardCue.urgency}
                                    data-primary-reward-screen-cue={primaryResourceRewardScreenCue}
                                    data-primary-reward-tone={primaryResourceRewardCue.tone}
                                    data-testid="hud-primary-reward-cue"
                                >
                                    <span className={styles.hudPrimaryRewardAction}>
                                        {primaryResourceRewardAction}
                                    </span>
                                    <span className={styles.hudPrimaryRewardLabel}>
                                        {primaryResourceRewardCue.label}
                                    </span>
                                    {primaryChainRewardProgress ? (
                                        <span
                                            aria-hidden="true"
                                            className={styles.hudPrimaryRewardProgress}
                                            data-primary-reward-progress-filled={primaryChainRewardProgress.filled}
                                            data-primary-reward-progress-total={primaryChainRewardProgress.total}
                                        >
                                            <span
                                                className={styles.hudPrimaryRewardProgressFill}
                                                style={hudMeterStyle(
                                                    (primaryChainRewardProgress.filled /
                                                        Math.max(1, primaryChainRewardProgress.total)) *
                                                        100
                                                )}
                                            />
                                            <b>{primaryChainRewardProgress.remainingLabel}</b>
                                        </span>
                                    ) : null}
                                    <span aria-hidden="true" className={styles.hudPrimaryRewardBeatPips}>
                                        {Array.from({ length: primaryResourceRewardBeatCount }, (_, beatIndex) => (
                                            <i
                                                data-primary-reward-beat={beatIndex + 1}
                                                key={`${primaryResourceRewardCue.id}-primary-beat-${beatIndex + 1}`}
                                            />
                                        ))}
                                    </span>
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div
                        className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`}
                        aria-hidden="true"
                    />
                    <div className={styles.hudStripScoreModule} data-testid="hud-wing-center">
                        <div className={`${styles.hudSegment} ${styles.hudScoreSegment}`}>
                            <span className={styles.statKey}>Score</span>
                            <span className={`${styles.statVal} ${styles.statValScore}`}>
                                {run.stats.totalScore.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div
                        className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`}
                        aria-hidden="true"
                    />
                    <div className={styles.hudStripRightModule}>
                        {dailyDateStripKey ? (
                            <div
                                className={`${styles.hudSegment} ${styles.hudDailySegment} ${styles.hudContextAux}`}
                                title="UTC daily challenge id"
                            >
                                <span className={styles.statKey}>Daily</span>
                                <span className={styles.hudDailyDate}>{dailyDateStripKey}</span>
                            </div>
                        ) : null}
                        {dailyDateStripKey && scoreParasiteActive ? (
                            <div className={styles.hudStripDivider} aria-hidden="true" />
                        ) : null}
                        {scoreParasiteActive ? (
                            <div
                                aria-label={`Score parasite: ${run.parasiteFloors} of 4 floors toward life drain.${
                                    run.parasiteWardRemaining > 0
                                        ? ` ${run.parasiteWardRemaining} parasite ward charge${
                                              run.parasiteWardRemaining === 1 ? '' : 's'
                                          }.`
                                        : ''
                                }`}
                                className={styles.hudParasiteSegment}
                                title="Every four floor advances with this mutator can drain a life. A Parasite ward charge absorbs one drain instead (relic: Parasite ward)."
                            >
                                <div className={styles.hudParasiteRow}>
                                    <div className={styles.hudParasiteCrystalWrap} aria-hidden="true">
                                        <img
                                            alt=""
                                            className={styles.hudParasiteCrystal}
                                            height={30}
                                            src={scoreParasiteCrystalUrl}
                                            width={24}
                                        />
                                    </div>
                                    <div className={styles.hudParasiteBody}>
                                        <span className={styles.hudParasiteLabel}>
                                            {MUTATOR_HUD_LABELS.score_parasite}
                                        </span>
                                        <div className={styles.hudParasiteTrack}>
                                            <div
                                                className={styles.hudParasiteFill}
                                                style={{ width: `${parasiteFloorProgress * 100}%` }}
                                            />
                                        </div>
                                        <span className={styles.hudParasiteCaption}>
                                            {run.parasiteFloors} / 4 floors
                                        </span>
                                        {run.parasiteWardRemaining > 0 ? (
                                            <span
                                                className={styles.hudParasiteWard}
                                                data-testid="hud-parasite-ward"
                                            >
                                                Ward ×{run.parasiteWardRemaining}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    </div>
                    <details
                        className={`${styles.hudContextSecondaryStrip} ${styles.hudContextRegion}`}
                        data-testid="hud-wing-right"
                        aria-label="Run context"
                    >
                        <summary className={styles.hudContextSummary} title="Run context">
                            Info
                        </summary>
                        <div className={styles.hudStripRightInnerColumn}>
                            <div className={`${styles.hudSegment} ${styles.hudMetaSegment}`} data-testid="hud-mode-identity">
                                <span className={styles.statKey}>Mode</span>
                                <span className={styles.statVal}>{hudModeLabel}</span>
                                {endlessChapterActive && board.actTitle ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-chapter-act"
                                        title={board.biomeTone ?? 'Endless act and biome'}
                                    >
                                        {board.actTitle} · {board.biomeTitle} · {board.actFloorNumber}/
                                        {board.actFloorCount}
                                    </span>
                                ) : null}
                                {endlessChapterActive && archetype ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-endless-archetype"
                                        title={[
                                            board.actTitle,
                                            board.biomeTitle,
                                            board.actFloorNumber != null && board.actFloorCount != null
                                                ? `Act floor ${board.actFloorNumber}/${board.actFloorCount}`
                                                : null,
                                            archetype.hint
                                        ]
                                            .filter(Boolean)
                                            .join(' — ')}
                                    >
                                        {archetype.title}
                                        {board.actTitle ? ` · ${board.actTitle}` : ''}
                                    </span>
                                ) : null}
                                {floorIdentity.warningLevel !== 'baseline' ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-floor-identity-reminder"
                                        title={
                                            board.floorTag === 'boss'
                                                ? bossReminderTitle
                                                : floorIdentity.counterplaySentence
                                        }
                                    >
                                        {board.floorTag === 'boss' ? bossReminderText : floorIdentity.activeReminder}
                                    </span>
                                ) : null}
                                {nBackLabel ? <span className={styles.statSubline}>{nBackLabel}</span> : null}
                                {showMutatorChipRow ? (
                                    <div className={styles.mutatorRow}>
                                        {contextChips.map((chip) => (
                                            <div
                                                className={`${styles.mutatorChip} ${chip.className}`}
                                                data-testid={chip.testId}
                                                key={chip.key}
                                                title={chip.title}
                                            >
                                                {chip.glyph}
                                                <span className={styles.mutatorChipLabel}>{chip.label}</span>
                                            </div>
                                        ))}
                                        {mutatorsForChips.map((mutator) => (
                                            <div
                                                className={[styles.mutatorChip, mutatorChipStyle(mutator)]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                data-testid={`hud-mutator-chip-${mutator}`}
                                                key={mutator}
                                                title={getMutatorChipTitle(mutator)}
                                            >
                                                <MutatorChipGlyph mutator={mutator} />
                                                <span className={styles.mutatorChipLabel}>
                                                    {MUTATOR_HUD_LABELS[mutator] ?? mutator}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : showNoMutatorsCopy ? (
                                    <span className={styles.statSubline}>No active mutators</span>
                                ) : null}
                            </div>

                            <div className={styles.statRail} data-hud-priority="secondary">
                                <div
                                    className={styles.statPillCompact}
                                    data-testid="hud-pair-progress"
                                    title={pairProgressTitle}
                                >
                                    <span className={styles.statKey}>Pairs</span>
                                    <span className={styles.statVal}>{matchedPairCount}/{board.pairCount}</span>
                                    <span className={styles.statSubline}>
                                        {Math.max(0, board.pairCount - matchedPairCount)} pair
                                        {Math.max(0, board.pairCount - matchedPairCount) === 1 ? '' : 's'} remain
                                    </span>
                                </div>
                                {gauntletRemainingMs !== null ? (
                                    <div className={styles.statPillCompact} title="Gauntlet time left">
                                        <span className={styles.statKey}>Time</span>
                                        <span className={styles.statVal}>{Math.ceil(gauntletRemainingMs / 1000)}s</span>
                                    </div>
                                ) : null}
                                {endlessChapterActive && featuredObjectiveLabel ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-featured-objective"
                                        title={
                                            getFeaturedObjectiveHudTooltip(board.featuredObjectiveId ?? null) ??
                                            'Featured objective for this endless floor'
                                        }
                                    >
                                        <span className={styles.statKey}>Objective</span>
                                        <span className={styles.statVal}>{featuredObjectiveLabel}</span>
                                        <span
                                            className={styles.hudObjectiveSignals}
                                            data-testid="hud-objective-signals"
                                            aria-label={objectiveSignalsLabel}
                                        >
                                            {objectiveSignalRows.map((row) => (
                                                <span
                                                    data-objective-signal-action={hudObjectiveSignalAction(row)}
                                                    data-objective-signal-audio={hudObjectiveSignalAudioCue(row)}
                                                    data-objective-signal-beats={hudObjectiveSignalBeatCount(row)}
                                                    data-objective-signal-screen-cue={hudObjectiveSignalScreenCue(row)}
                                                    data-objective-signal-tone={row.tone}
                                                    key={row.id}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.hudObjectiveSignalBeatPips}>
                                                        {Array.from({ length: hudObjectiveSignalBeatCount(row) }, (_, index) => (
                                                            <i data-objective-signal-beat key={index} />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                ) : null}
                                {secondaryObjectiveRows.map((row) => (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid={`hud-secondary-objective-${row.id}`}
                                        key={row.id}
                                        title={row.detail}
                                    >
                                        <span className={styles.statKey}>{row.label}</span>
                                        <span className={styles.statVal}>{row.status}</span>
                                    </div>
                                ))}
                                {endlessChapterActive ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-favor-progress"
                                        title={temporaryCurrencyPurpose(run, 'relic_favor')}
                                    >
                                        <span className={styles.statKey}>Favor</span>
                                        <span className={styles.statVal}>{run.relicFavorProgress}/3</span>
                                        <span className={styles.statSubline}>
                                            {RELIC_FAVOR_PER_BONUS_PICK - run.relicFavorProgress} more for a relic pick
                                        </span>
                                    </div>
                                ) : null}
                                {endlessChapterActive && run.endlessRiskWager?.targetLevel === board.level ? (
                                    <div
                                        aria-label={`Active risk wager. Protect streak. +${activeRiskWagerFavor} Favor. x${run.endlessRiskWager.streakAtRisk} streak at risk. ${activeRiskWagerBeatCount} beats.`}
                                        className={`${styles.statPillCompact} ${styles.hudEndlessRiskWagerPill}`}
                                        data-hud-risk-wager-action="Protect streak"
                                        data-hud-risk-wager-audio="risk-wager-armed"
                                        data-hud-risk-wager-beats={activeRiskWagerBeatCount}
                                        data-hud-risk-wager-favor={activeRiskWagerFavor}
                                        data-hud-risk-wager-risk={`x${run.endlessRiskWager.streakAtRisk}`}
                                        data-hud-risk-wager-screen-cue={
                                            run.endlessRiskWager.streakAtRisk >= 3 ? 'risk' : 'guard'
                                        }
                                        data-testid="hud-endless-risk-wager"
                                        title={
                                            run.relicIds.includes('wager_surety')
                                                ? "Complete this floor's featured objective to win bonus Favor; miss it and the streak falls to x1"
                                                : "Complete this floor's featured objective to win bonus Favor; miss it and the streak resets"
                                        }
                                    >
                                        <span className={styles.statKey}>Wager</span>
                                        <span className={styles.statVal}>+{activeRiskWagerFavor} Favor</span>
                                        <span className={styles.statSubline}>Protect streak</span>
                                        <span aria-hidden="true" className={styles.hudEndlessRiskWagerBeatPips}>
                                            {Array.from({ length: activeRiskWagerBeatCount }, (_, beatIndex) => (
                                                <i data-hud-risk-wager-beat={beatIndex + 1} key={beatIndex} />
                                            ))}
                                        </span>
                                    </div>
                                ) : null}
                                {buildProfile.primary ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-build-profile"
                                        title={buildProfile.tooltip}
                                    >
                                        <span className={styles.statKey}>Build</span>
                                        <span className={styles.statVal}>
                                            {buildProfile.primary.label} · {buildProfile.primary.score}
                                        </span>
                                        <span className={styles.statSubline}>
                                            {buildProfile.primary.decisionVerbs.slice(0, 3).join(' / ')}
                                        </span>
                                    </div>
                                ) : null}
                                {rewardPerkRows.length > 0 ? (
                                    <div
                                        aria-label={rewardPerkRowsLabel}
                                        className={`${styles.statPillCompact} ${styles.hudRewardPerkStrip}`}
                                        data-reward-perk-beat-count={rewardPerkBeatCue?.beatCount ?? 'none'}
                                        data-reward-perk-beat-cue={rewardPerkBeatCue?.label ?? 'none'}
                                        data-reward-perk-beat-audio={rewardPerkBeatAudioCue}
                                        data-reward-perk-beat-screen-cue={rewardPerkBeatScreenCue}
                                        data-reward-perk-beat-tier={rewardPerkBeatCue?.tier ?? 'none'}
                                        data-reward-perk-focus-action={rewardPerkFocus?.action ?? 'none'}
                                        data-reward-perk-focus-id={rewardPerkFocus?.row.id ?? 'none'}
                                        data-reward-perk-focus-lane={rewardPerkFocus?.row.lane ?? 'none'}
                                        data-reward-perk-focus-payoff={rewardPerkFocus?.row.payoff ?? 'none'}
                                        data-reward-perk-focus-readiness={rewardPerkFocus?.tone ?? 'none'}
                                        data-reward-perk-lane-actions={rewardPerkLaneActionMapAttr}
                                        data-reward-perk-lane-map={rewardPerkLaneMapAttr}
                                        data-testid="hud-reward-perk-strip"
                                        title={rewardPerkRows.map((row) => `${row.label}: ${row.nextCue}`).join(' ')}
                                    >
                                        <span className={styles.statKey}>Perks</span>
                                        <span className={styles.statVal}>{rewardPerkRows.length}</span>
                                        <span className={styles.statSubline}>{rewardPerkRows[0]?.lane}</span>
                                        {rewardPerkFocus ? (
                                            <span
                                                aria-label={`Primary perk payoff. ${rewardPerkFocus.action}: ${rewardPerkFocus.row.lane}. ${rewardPerkFocus.row.payoff}. ${rewardPerkFocus.row.readinessLabel}. ${sentenceWithPeriod(rewardPerkFocus.row.nextCue)}`}
                                                className={styles.hudRewardPerkPrimaryCue}
                                                data-reward-perk-primary-action={rewardPerkFocus.action}
                                                data-reward-perk-primary-audio={rewardPerkBeatAudioCue}
                                                data-reward-perk-primary-beats={rewardPerkBeatCue?.beatCount ?? 0}
                                                data-reward-perk-primary-lane={rewardPerkFocus.row.lane}
                                                data-reward-perk-primary-payoff={rewardPerkFocus.row.payoff}
                                                data-reward-perk-primary-screen-cue={rewardPerkBeatScreenCue}
                                                data-reward-perk-primary-tone={rewardPerkFocus.tone}
                                                data-testid="hud-reward-perk-primary-cue"
                                            >
                                                <small>Next perk</small>
                                                <strong>{rewardPerkFocus.action}</strong>
                                                <em>{rewardPerkFocus.row.payoff}</em>
                                                <b>{rewardPerkFocus.row.lane}</b>
                                                {rewardPerkBeatCue ? (
                                                    <span aria-hidden="true" className={styles.hudRewardPerkPrimaryBeatPips}>
                                                        {Array.from({ length: rewardPerkBeatCue.beatCount }, (_, beatIndex) => (
                                                            <i data-reward-perk-primary-beat={beatIndex + 1} key={beatIndex} />
                                                        ))}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : null}
                                        {rewardPerkFocus ? (
                                            <span
                                                aria-label={`Focused perk payoff. ${rewardPerkFocus.action}: ${rewardPerkFocus.row.arcadeCue}. ${rewardPerkFocus.row.readinessLabel}. ${rewardPerkFocus.row.nextCue}`}
                                                className={styles.hudRewardPerkFocus}
                                                data-reward-perk-focus-action={rewardPerkFocus.action}
                                                data-reward-perk-focus-audio={rewardPerkBeatAudioCue}
                                                data-reward-perk-focus-screen-cue={rewardPerkBeatScreenCue}
                                                data-reward-perk-focus-tone={rewardPerkFocus.tone}
                                                data-testid="hud-reward-perk-focus"
                                            >
                                                <small>{rewardPerkFocus.action}</small>
                                                <strong>{rewardPerkFocus.row.arcadeCue}</strong>
                                                <em>{rewardPerkFocus.row.readinessLabel}</em>
                                                <b>{rewardPerkFocus.row.nextCue}</b>
                                                {rewardPerkBeatCue ? (
                                                    <span
                                                        aria-label={`Reward perk beat. ${rewardPerkBeatCue.label}. ${rewardPerkBeatCue.beatCount} beats. ${rewardPerkBeatCue.action}: ${rewardPerkFocus.row.readinessDetail}`}
                                                        className={styles.hudRewardPerkBeat}
                                                        data-reward-perk-beat-action={rewardPerkBeatCue.action}
                                                        data-reward-perk-beat-audio={rewardPerkBeatAudioCue}
                                                        data-reward-perk-beat-screen-cue={rewardPerkBeatScreenCue}
                                                        data-reward-perk-beat-tier={rewardPerkBeatCue.tier}
                                                        data-testid="hud-reward-perk-beat"
                                                    >
                                                        <small>{rewardPerkBeatCue.label}</small>
                                                        <span aria-hidden="true" className={styles.hudRewardPerkBeatPips}>
                                                            {Array.from({ length: rewardPerkBeatCue.beatCount }, (_, beatIndex) => (
                                                                <i key={beatIndex} />
                                                            ))}
                                                        </span>
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : null}
                                        {rewardPerkLaneMap.length > 1 ? (
                                            <span
                                                aria-label={rewardPerkLaneMapLabel}
                                                className={styles.hudRewardPerkLaneMap}
                                                data-reward-perk-lane-actions={rewardPerkLaneActionMapAttr}
                                                data-reward-perk-lane-map={rewardPerkLaneMapAttr}
                                                data-testid="hud-reward-perk-lane-map"
                                            >
                                                <span
                                                    className={styles.hudRewardPerkLaneMapSummary}
                                                    data-reward-perk-lane-count={rewardPerkLaneMap.length}
                                                    data-testid="hud-reward-perk-lane-map-summary"
                                                >
                                                    <small>Lanes</small>
                                                    <b>
                                                        {rewardPerkLaneMap.length}{' '}
                                                        {rewardPerkLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                    </b>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.hudRewardPerkLaneMapSummaryBeatPips}
                                                    >
                                                        {Array.from(
                                                            { length: Math.max(2, Math.min(5, rewardPerkLaneMap.length + 1)) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-reward-perk-lane-map-summary-beat={beatIndex + 1}
                                                                    data-reward-perk-lane-map-summary-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                                {rewardPerkLaneMap.map((lane) => (
                                                    <span
                                                        data-reward-perk-lane-action={lane.action}
                                                        data-reward-perk-lane-count={lane.count}
                                                        data-reward-perk-lane-kind={lane.lane}
                                                        data-reward-perk-lane-readiness={lane.readiness}
                                                        key={lane.lane}
                                                    >
                                                        <small>{lane.lane}</small>
                                                        <strong>{lane.count}</strong>
                                                        <b>{lane.action}</b>
                                                        <em>{lane.nextCue}</em>
                                                    </span>
                                                ))}
                                            </span>
                                        ) : null}
                                        <span className={styles.hudRewardPerkRows}>
                                            {rewardPerkRows.map((row) => (
                                                <span
                                                    data-reward-perk-lane={row.lane}
                                                    data-reward-perk-readiness={row.readiness}
                                                    key={row.id}
                                                    title={row.readinessDetail}
                                                >
                                                    <small>{row.arcadeCue}</small>
                                                    <small data-reward-perk-signal="readiness">{row.readinessLabel}</small>
                                                    <i>{row.lane}</i>
                                                    <strong>{row.payoff}</strong>
                                                    <em>{row.moment}</em>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.hudRewardPerkMeter}
                                                        data-reward-perk-meter={row.readiness}
                                                    >
                                                        <span style={hudMeterStyle(row.meterPercent)} />
                                                    </span>
                                                    <b>{row.nextCue}</b>
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                ) : null}
                                {run.findablesTotalThisFloor > 0 ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudFindableProgressPill}`}
                                        data-findable-state={findableProgressState}
                                        data-testid="hud-findables-claimed"
                                        title={`Pickup progress this floor. ${getFindableRows()
                                            .map((row) => `${row.label}: ${row.rewardText}`)
                                            .join('; ')}. Destroy forfeits pickups; shuffle preserves them.`}
                                    >
                                        <span className={styles.statKey}>Pickups</span>
                                        <span className={styles.statVal}>
                                            {run.findablesClaimedThisFloor}/{run.findablesTotalThisFloor}
                                        </span>
                                        <span className={styles.statSubline}>{findableProgressSubline}</span>
                                        <span
                                            aria-label={pickupRewardPreviewLabel}
                                            className={styles.hudPickupRewardPreview}
                                            data-testid="hud-pickup-reward-preview"
                                        >
                                            {pickupRewardPreviewRows.map((row) => (
                                                <span data-pickup-reward-kind={row.id} key={row.id}>
                                                    {row.rewardText}
                                                </span>
                                            ))}
                                        </span>
                                        {pickupChainStackCue ? (
                                            <span
                                                aria-label={`Pickup stack cue. ${pickupChainStackCue.label}: ${pickupChainStackCue.action}. ${pickupChainStackCue.value}.`}
                                                className={styles.hudPickupStackCue}
                                                data-pickup-stack-action={pickupChainStackCue.action}
                                                data-pickup-stack-label={pickupChainStackCue.label}
                                                data-testid="hud-pickup-stack-cue"
                                            >
                                                <small>{pickupChainStackCue.label}</small>
                                                <strong>{pickupChainStackCue.action}</strong>
                                                <em>{pickupChainStackCue.value}</em>
                                            </span>
                                        ) : null}
                                        <span
                                            aria-label={`Pickup reward meter ${run.findablesClaimedThisFloor} of ${run.findablesTotalThisFloor}`}
                                            className={styles.hudMomentumMeter}
                                            data-meter-kind="pickup"
                                            data-testid="hud-pickup-meter"
                                            style={hudMeterStyle(findableProgressMeterPercent)}
                                        />
                                    </div>
                                ) : null}
                                {hazardTileSummary.hasHazards ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-hazard-tiles"
                                        title={hazardTileSummary.hudDetail ?? 'Active hazard tiles on this floor'}
                                    >
                                        <span className={styles.statKey}>Hazards</span>
                                        <span className={styles.statVal}>{hazardTileSummary.totalHazardTiles}</span>
                                        <span className={styles.statSubline}>
                                            {hazardTileSummary.rows.length > 0
                                                ? `${hazardTileSummary.rows[0].label} x${hazardTileSummary.rows[0].count}${
                                                      hazardTileSummary.rows.length > 1
                                                          ? ` + ${hazardTileSummary.rows.length - 1} more`
                                                          : ''
                                                  }`
                                                : hazardTileSummary.hudLabel}
                                        </span>
                                    </div>
                                ) : null}
                                {traitOpportunitySummary.tiles.length > 0 ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudTraitOpportunityPill}`}
                                        data-testid="hud-trait-opportunity-cards"
                                        title={traitOpportunityCardTitle}
                                    >
                                        <span className={styles.statKey}>Traits</span>
                                        <span className={styles.statVal}>{traitOpportunitySummary.tiles.length}</span>
                                        <span className={styles.statSubline}>
                                            {traitOpportunityKindLine ?? traitOpportunityCardCountLabel ?? 'Combo cards'}
                                        </span>
                                        <span className={styles.hudTraitOpportunityRows}>
                                            <small>
                                                {traitOpportunityCardLine ?? traitOpportunitySummary.reason ?? 'No combo lines yet'}
                                            </small>
                                        </span>
                                    </div>
                                ) : null}
                                {traitOpportunityHud.active ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudTraitRoutePill}`}
                                        data-trait-chain-stack-cue={traitChainStackCue?.label ?? 'none'}
                                        data-trait-route-action-audio={traitRouteActionAudioCue}
                                        data-trait-route-action-screen-cue={traitRouteActionScreenCue}
                                        data-trait-route-urgency={traitRouteObjectiveStatus?.urgency ?? (traitOpportunityHud.swapHint ? 'setup' : 'ready')}
                                        data-testid="hud-trait-route-panel"
                                        title={traitOpportunityHud.title}
                                    >
                                        <span className={styles.statKey}>Trait routes</span>
                                        <span className={styles.statVal}>{traitRouteProgressLabel}</span>
                                        <span className={styles.statSubline}>{traitOpportunityHud.buildLabel}</span>
                                        <small className={styles.hudTraitRoutePrimary}>{traitOpportunityHud.primaryLine}</small>
                                        <span className={styles.hudTraitRouteLaneMapLabel}>Trait lanes</span>
                                        {traitOpportunityLaneMap.length > 0 ? (
                                            <div
                                                aria-label={traitOpportunityLaneMapLabel}
                                                className={styles.hudTraitRouteLaneMap}
                                                data-testid="hud-trait-route-lane-map"
                                                data-trait-interaction-lane-actions={traitOpportunityLaneActionMapAttr}
                                                data-trait-interaction-lane-map={traitOpportunityLaneMapAttr}
                                            >
                                                <span
                                                    className={styles.hudTraitRouteLaneMapSummary}
                                                    data-trait-interaction-lane-count={traitOpportunityLaneMap.length}
                                                    data-testid="hud-trait-route-lane-map-summary"
                                                >
                                                    <small>Trait lanes</small>
                                                    <b>
                                                        {traitOpportunityLaneMap.length}{' '}
                                                        {traitOpportunityLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                    </b>
                                                    <span className={styles.hudTraitRouteLaneMapSummaryLead}>
                                                        {primaryTraitOpportunityLane
                                                            ? `${primaryTraitOpportunityLane.label} leads`
                                                            : 'No lead lane'}
                                                    </span>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.hudTraitRouteLaneMapSummaryBeatPips}
                                                    >
                                                        {Array.from(
                                                            {
                                                                length: Math.max(
                                                                    2,
                                                                    Math.min(5, traitOpportunityLaneMap.length + 1)
                                                                )
                                                            },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-trait-interaction-lane-summary-beat={beatIndex + 1}
                                                                    data-trait-interaction-lane-summary-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                                {traitOpportunityLaneMap.map((lane) => (
                                                    <span data-trait-interaction-lane={lane.id} key={lane.id}>
                                                        <small>{lane.label}</small>
                                                        <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                                                        <em>
                                                            {lane.count} {lane.count === 1 ? 'line' : 'lines'} · {lane.cue}
                                                        </em>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {traitRouteObjectiveStatus ? (
                                            <small
                                                aria-label={`Trait route action cue. ${traitRouteObjectiveStatus.actionLabel}: ${traitRouteObjectiveStatus.stateLabel}. Reward: ${traitRouteObjectiveStatus.reward}.`}
                                                className={styles.hudTraitRouteActionCue}
                                                data-trait-route-action-audio={traitRouteActionAudioCue}
                                                data-trait-route-action-beats={traitRouteActionBeatCount}
                                                data-trait-route-action-screen-cue={traitRouteActionScreenCue}
                                                data-testid="hud-trait-route-action-cue"
                                                data-trait-route-action={traitRouteObjectiveStatus.actionLabel}
                                                data-trait-route-urgency={traitRouteObjectiveStatus.urgency}
                                            >
                                                <strong>{traitRouteObjectiveStatus.actionLabel}</strong>
                                                <span>{traitRouteObjectiveStatus.stateLabel}</span>
                                                <span aria-hidden="true" className={styles.hudTraitRouteBeatPips}>
                                                    {Array.from({ length: traitRouteActionBeatCount }, (_, beatIndex) => (
                                                        <i data-trait-route-action-beat={beatIndex + 1} key={beatIndex} />
                                                    ))}
                                                </span>
                                            </small>
                                        ) : null}
                                        {traitChainStackCue ? (
                                            <small
                                                aria-label={`Trait stack cue. ${traitChainStackCue.label}: ${traitChainStackCue.action}. ${traitChainStackCue.value}.`}
                                                className={styles.hudTraitRouteStackCue}
                                                data-trait-chain-stack-audio="trait-stack-cashout"
                                                data-trait-chain-stack-beats={4}
                                                data-trait-chain-stack-screen-cue="burst"
                                                data-testid="hud-trait-route-stack-cue"
                                                data-trait-chain-stack-action={traitChainStackCue.action}
                                            >
                                                <span>{traitChainStackCue.label}</span>
                                                <strong>{traitChainStackCue.action}</strong>
                                                <em>{traitChainStackCue.value}</em>
                                                <span aria-hidden="true" className={styles.hudTraitRouteBeatPips}>
                                                    {Array.from({ length: 4 }, (_, beatIndex) => (
                                                        <i data-trait-chain-stack-beat={beatIndex + 1} key={beatIndex} />
                                                    ))}
                                                </span>
                                            </small>
                                        ) : null}
                                        {traitRouteBestToolLabel ? (
                                            <small
                                                className={styles.hudTraitRouteToolCue}
                                                data-testid="hud-trait-route-best-tool"
                                            >
                                                {traitRouteBestToolLabel}
                                            </small>
                                        ) : null}
                                        {traitRouteObjectiveStatus ? (
                                            <span
                                                aria-label={`Trait route meter ${traitRouteObjectiveStatus.progress} of ${traitRouteObjectiveStatus.required}`}
                                                className={styles.hudMomentumMeter}
                                                data-meter-kind="trait"
                                                data-testid="hud-trait-route-meter"
                                                style={hudMeterStyle(traitRouteMeterPercent)}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                                {run.status === 'playing' ? (
                                    <div
                                        key={`hud-chain-${board.level}-${run.stats.currentStreak}`}
                                        className={`${styles.statPillCompact} ${reduceMotion ? '' : styles.hudChainPill}`}
                                        aria-label={`Chain lane: ${chainLaneCue.label}. ${chainLaneCue.detail}. Streak x${run.stats.currentStreak}. ${chainMomentumSubline}. ${chainNextFirstCue}. ${chainNextThenCue}. ${chainNextKeepCue}.`}
                                        data-chain-lane-action={chainLaneAction}
                                        data-chain-lane-audio={chainLaneAudioCue}
                                        data-chain-lane-cue={chainLaneCue.label}
                                        data-chain-lane-screen-cue={chainLaneScreenCue}
                                        data-chain-lane-tone={chainLaneCue.tone}
                                        data-chain-milestone-action={chainMilestonePreview.actionLabel}
                                        data-chain-milestone-audio={chainMilestonePreview.distance <= 1 ? 'milestone-cashout' : 'milestone-prime'}
                                        data-chain-milestone-screen-cue={chainMilestonePreview.distance <= 1 ? 'burst' : 'pulse'}
                                        data-chain-milestone-target={chainMilestonePreview.target}
                                        data-chain-milestone-tone={chainMilestonePreview.tone}
                                        data-chain-tier={chainMomentumTier}
                                        data-testid="hud-match-chain"
                                        title="Consecutive matches without a miss — each match adds bonus score on top of the base."
                                    >
                                        <span className={styles.statKey}>{chainMomentumLabel}</span>
                                        <span className={styles.statSubline}>{chainMomentumSubline}</span>
                                        <span className={styles.statVal}>×{run.stats.currentStreak}</span>
                                        <span
                                            className={styles.hudChainLaneCue}
                                            data-chain-lane-action={chainLaneAction}
                                            data-chain-lane-audio={chainLaneAudioCue}
                                            data-chain-lane-screen-cue={chainLaneScreenCue}
                                            data-chain-lane-tone={chainLaneCue.tone}
                                            data-testid="hud-chain-lane-cue"
                                            title={chainLaneCue.detail}
                                        >
                                            {chainLaneCue.label}
                                        </span>
                                        <span
                                            className={styles.hudChainNextTarget}
                                            data-chain-next-first={chainNextFirstCue}
                                            data-chain-next-keep={chainNextKeepCue}
                                            data-chain-next-milestone-action={chainMilestonePreview.actionLabel}
                                            data-chain-next-milestone-audio={chainMilestonePreview.distance <= 1 ? 'milestone-cashout' : 'milestone-prime'}
                                            data-chain-next-milestone-label={chainMilestonePreview.label}
                                            data-chain-next-milestone-screen-cue={chainMilestonePreview.distance <= 1 ? 'burst' : 'pulse'}
                                            data-chain-next-milestone-target={chainMilestonePreview.target}
                                            data-chain-next-milestone-tone={chainMilestonePreview.tone}
                                            data-chain-next-then={chainNextThenCue}
                                            data-testid="hud-chain-next-target"
                                        >
                                            <strong>{nextChainTargetLabel}</strong>
                                            <small>
                                                <span>{chainMilestonePreview.actionLabel}</span>
                                                <span>{chainNextFirstCue}</span>
                                                <span>{chainNextThenCue}</span>
                                                <span>{chainNextKeepCue}</span>
                                            </small>
                                        </span>
                                        {primaryChainRewardProgress ? (
                                            <span
                                                aria-label={`Chain reward progress ${primaryChainRewardProgress.label} toward ${primaryChainRewardProgress.targetLabel}. ${primaryChainRewardProgress.remainingLabel}.`}
                                                className={styles.hudChainRewardPips}
                                                data-chain-reward-progress={primaryChainRewardProgress.label}
                                                data-testid="hud-chain-reward-pips"
                                            >
                                                {Array.from({ length: primaryChainRewardProgress.total }, (_, index) => (
                                                    <span
                                                        aria-hidden="true"
                                                        data-pip-filled={index < primaryChainRewardProgress.filled ? 'true' : 'false'}
                                                        key={`${primaryChainRewardProgress.targetLabel}:${index}`}
                                                    />
                                                ))}
                                                <b>{primaryChainRewardProgress.remainingLabel}</b>
                                            </span>
                                        ) : null}
                                        {primaryRewardHot && primaryResourceRewardCue ? (
                                            <span
                                                aria-label={`Chain reward hot: ${primaryResourceRewardCue.label}. ${primaryResourceRewardCue.chaseLabel}.`}
                                                className={styles.hudChainRewardHotBadge}
                                                data-chain-reward-hot-beats={primaryResourceRewardBeatCount}
                                                data-chain-reward-hot-screen-cue="super"
                                                data-chain-reward-hot-tone="cashout"
                                                data-testid="hud-chain-reward-hot"
                                            >
                                                <small>Reward hot</small>
                                                <b>{primaryResourceRewardCue.label}</b>
                                            </span>
                                        ) : null}
                                        {chainComboSurgeBand ? (
                                            <span
                                                aria-label={chainComboSurgeBandLabel}
                                                className={styles.hudChainComboSurgeBand}
                                                data-chain-combo-surge-band-beats={4}
                                                data-chain-combo-surge-band-screen-cue="burst"
                                                data-chain-combo-surge-band-tone={chainComboSurgeBand.tone}
                                                data-testid="hud-chain-combo-surge-band"
                                            >
                                                <small>{chainComboSurgeBand.label}</small>
                                                <b>{chainComboSurgeBand.value}</b>
                                                <em>{chainComboSurgeBand.detail}</em>
                                                <i>{chainComboSurgeBand.cue}</i>
                                                <span aria-hidden="true" className={styles.hudChainComboSurgeBandBeatPips}>
                                                    {Array.from({ length: 4 }, (_, beatIndex) => (
                                                        <i
                                                            data-chain-combo-surge-band-beat={beatIndex + 1}
                                                            data-chain-combo-surge-band-beat-focus={
                                                                beatIndex === 0 ? 'primary' : 'support'
                                                            }
                                                            key={beatIndex}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {primaryRewardHotBand ? (
                                            <span
                                                aria-label={primaryRewardHotBandLabel}
                                                className={styles.hudChainRewardHotBand}
                                                data-chain-reward-hot-band-beats={primaryResourceRewardBeatCount}
                                                data-chain-reward-hot-band-screen-cue="super"
                                                data-chain-reward-hot-band-tone={primaryRewardHotBand.tone}
                                                data-testid="hud-chain-reward-hot-band"
                                            >
                                                <small>{primaryRewardHotBand.label}</small>
                                                <b>{primaryRewardHotBand.value}</b>
                                                <em>{primaryRewardHotBand.detail}</em>
                                                <i>{primaryResourceRewardCue?.chaseLabel ?? 'Hit now'}</i>
                                                <span aria-hidden="true" className={styles.hudChainRewardHotBandBeatPips}>
                                                    {Array.from({ length: primaryResourceRewardBeatCount }, (_, beatIndex) => (
                                                        <i
                                                            data-chain-reward-hot-band-beat={beatIndex + 1}
                                                            data-chain-reward-hot-band-beat-focus={
                                                                beatIndex === 0 ? 'primary' : 'support'
                                                            }
                                                            key={beatIndex}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {stackedChainRewardHot.length > 0 ? (
                                            <span
                                                aria-label={`Stacked chain payoff: Cash now. ${stackedChainRewardLabel}.`}
                                                className={styles.hudChainStackedPayoffBadge}
                                                data-chain-stack-action="Cash now"
                                                data-testid="hud-chain-stacked-payoff"
                                            >
                                                <small>{stackedChainRewardHot.length}x payoff</small>
                                                <em>Cash now</em>
                                                <b>Next match</b>
                                            </span>
                                        ) : null}
                                        {chainRewardForecastCues.length > 0 ? (
                                            <span
                                                aria-label={chainRewardForecastLabel}
                                                className={styles.hudChainRewardForecast}
                                                data-chain-reward-forecast-hot={primaryRewardHot ? 'true' : 'false'}
                                                data-chain-reward-lane-actions={chainRewardLaneActionMapAttr}
                                                data-chain-reward-lane-map={chainRewardLaneMapAttr}
                                                data-testid="hud-chain-reward-forecast"
                                            >
                                                <span
                                                    className={styles.hudChainRewardForecastSummary}
                                                    data-chain-reward-lane-count={chainRewardLaneMap.length}
                                                    data-chain-reward-ladder-count={chainRewardLadder.length}
                                                    data-testid="hud-chain-reward-forecast-summary"
                                                >
                                                    <small>Forecast</small>
                                                    <b>
                                                        {chainRewardLaneMap.length + chainRewardLadder.length}{' '}
                                                        {chainRewardLaneMap.length + chainRewardLadder.length === 1 ? 'cue' : 'cues'}
                                                    </b>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.hudChainRewardForecastSummaryBeatPips}
                                                    >
                                                        {Array.from(
                                                            { length: Math.max(2, Math.min(5, chainRewardLaneMap.length + chainRewardLadder.length)) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-chain-reward-forecast-summary-beat={beatIndex + 1}
                                                                    data-chain-reward-forecast-summary-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                                {chainRewardLaneMap.length > 1 ? (
                                                    <span
                                                        aria-label={chainRewardLaneMapAccessibleLabel}
                                                        data-chain-reward-lane-actions={chainRewardLaneActionMapAttr}
                                                        data-chain-reward-lane-map={chainRewardLaneMapAttr}
                                                        data-chain-reward-primary-lane={primaryChainRewardLane?.id ?? 'none'}
                                                        data-chain-reward-primary-lane-action={primaryChainRewardLane?.action ?? 'none'}
                                                        data-chain-reward-primary-lane-audio={
                                                            primaryChainRewardLaneCue ? hudChainRewardAudioCue(primaryChainRewardLaneCue) : 'none'
                                                        }
                                                        data-chain-reward-primary-lane-beats={
                                                            primaryChainRewardLane ? hudChainRewardLaneBeatCount(primaryChainRewardLane) : 0
                                                        }
                                                        data-chain-reward-primary-lane-cue={primaryChainRewardLane?.cue ?? 'none'}
                                                        data-chain-reward-primary-lane-screen-cue={
                                                            primaryChainRewardLaneCue ? hudChainRewardScreenCue(primaryChainRewardLaneCue) : 'none'
                                                        }
                                                        data-testid="hud-chain-reward-lane-map"
                                                    >
                                                        {primaryChainRewardLane ? (
                                                            <u
                                                                aria-label={`Primary chain reward lane. ${primaryChainRewardLane.label}: ${primaryChainRewardLane.action}. ${primaryChainRewardLane.cue}. ${hudChainRewardLaneBeatCount(primaryChainRewardLane)} beats.`}
                                                                className={styles.hudChainRewardPrimaryLaneCue}
                                                                data-chain-reward-primary-lane={primaryChainRewardLane.id}
                                                                data-chain-reward-primary-lane-action={primaryChainRewardLane.action}
                                                                data-chain-reward-primary-lane-audio={
                                                                    primaryChainRewardLaneCue
                                                                        ? hudChainRewardAudioCue(primaryChainRewardLaneCue)
                                                                        : 'none'
                                                                }
                                                                data-chain-reward-primary-lane-beats={hudChainRewardLaneBeatCount(primaryChainRewardLane)}
                                                                data-chain-reward-primary-lane-cue={primaryChainRewardLane.cue}
                                                                data-chain-reward-primary-lane-screen-cue={
                                                                    primaryChainRewardLaneCue
                                                                        ? hudChainRewardScreenCue(primaryChainRewardLaneCue)
                                                                        : 'none'
                                                                }
                                                                data-testid="hud-chain-reward-primary-lane"
                                                            >
                                                                <small>Cash lane</small>
                                                                <b>{primaryChainRewardLane.label}</b>
                                                                <strong>{primaryChainRewardLane.action}</strong>
                                                                <em>{primaryChainRewardLane.cue}</em>
                                                                <span aria-hidden="true" className={styles.hudChainRewardPrimaryLaneBeatPips}>
                                                                    {Array.from(
                                                                        { length: hudChainRewardLaneBeatCount(primaryChainRewardLane) },
                                                                        (_, beatIndex) => (
                                                                            <i data-chain-reward-primary-lane-beat={beatIndex + 1} key={beatIndex} />
                                                                        )
                                                                    )}
                                                                </span>
                                                            </u>
                                                        ) : null}
                                                        {chainRewardLaneMap.map((lane) => (
                                                            <u
                                                                data-chain-reward-lane={lane.id}
                                                                data-chain-reward-lane-action={lane.action}
                                                                data-chain-reward-lane-audio={
                                                                    chainRewardCueForLane(lane)
                                                                        ? hudChainRewardAudioCue(chainRewardCueForLane(lane)!)
                                                                        : 'none'
                                                                }
                                                                data-chain-reward-lane-beats={hudChainRewardLaneBeatCount(lane)}
                                                                data-chain-reward-lane-count={lane.count}
                                                                data-chain-reward-lane-screen-cue={
                                                                    chainRewardCueForLane(lane)
                                                                        ? hudChainRewardScreenCue(chainRewardCueForLane(lane)!)
                                                                        : 'none'
                                                                }
                                                                key={lane.id}
                                                            >
                                                                <small>{lane.label}</small>
                                                                <b>{lane.count}</b>
                                                                <strong>{lane.action}</strong>
                                                                <em>{lane.cue}</em>
                                                                <span aria-hidden="true" className={styles.hudChainRewardLaneBeatPips}>
                                                                    {Array.from({ length: hudChainRewardLaneBeatCount(lane) }, (_, beatIndex) => (
                                                                        <i data-chain-reward-lane-beat={beatIndex + 1} key={beatIndex} />
                                                                    ))}
                                                                </span>
                                                            </u>
                                                        ))}
                                                    </span>
                                                ) : null}
                                                {chainRewardLadder.length > 1 ? (
                                                    <span
                                                        aria-label={chainRewardLadderAccessibleLabel}
                                                        data-chain-reward-ladder-actions={chainRewardLadderActionAttr}
                                                        data-chain-reward-ladder={chainRewardLadderAttr}
                                                        data-testid="hud-chain-reward-ladder"
                                                    >
                                                       {chainRewardLadder.map((entry) => (
                                                            <u
                                                        data-chain-reward-ladder-action={entry.action}
                                                        data-chain-reward-ladder-audio={hudChainRewardAudioCue(entry.cue)}
                                                        data-chain-reward-ladder-beats={hudChainRewardBeatCount(entry)}
                                                        data-chain-reward-ladder-filled={entry.filled}
                                                        data-chain-reward-ladder-screen-cue={hudChainRewardScreenCue(entry.cue)}
                                                        data-chain-reward-ladder-total={entry.total}
                                                        data-chain-reward-ladder-tone={entry.cue.tone}
                                                        data-chain-reward-ladder-urgency={entry.cue.urgency}
                                                                key={entry.cue.id}
                                                                style={{ '--chain-reward-ladder-fill': `${Math.round((entry.filled / entry.total) * 100)}%` } as CSSProperties}
                                                            >
                                                                <small>{entry.cue.chaseLabel}</small>
                                                                {entry.action !== entry.cue.chaseLabel ? <strong>{entry.action}</strong> : null}
                                                                <b>{entry.cue.label}</b>
                                                                <em>{entry.progressLabel}</em>
                                                                <i>{entry.remainingLabel}</i>
                                                                <span aria-hidden="true" className={styles.hudChainRewardBeatPips}>
                                                                    {Array.from({ length: hudChainRewardBeatCount(entry) }, (_, beatIndex) => (
                                                                        <i
                                                                            data-chain-reward-ladder-beat={beatIndex + 1}
                                                                            key={`${entry.cue.id}-hud-reward-beat-${beatIndex + 1}`}
                                                                        />
                                                                    ))}
                                                                </span>
                                                            </u>
                                                        ))}
                                                    </span>
                                                ) : null}
                                                {chainRewardForecastCues.map((cue) => {
                                                    const stackLabel = getChainRewardStackLabel(cue);

                                                    return (
                                                        <span
                                                            data-chain-reward-arcade-cue={getChainRewardUrgencyCopy(cue)}
                                                            data-chain-reward-audio={hudChainRewardAudioCue(cue)}
                                                            data-chain-reward-distance={cue.distance}
                                                            data-chain-reward-lane-action={getChainRewardLaneAction(cue.urgency)}
                                                            data-chain-reward-screen-cue={hudChainRewardScreenCue(cue)}
                                                            data-chain-reward-stack-size={cue.stackSize ?? 1}
                                                            data-chain-reward-tone={cue.tone}
                                                            data-chain-reward-urgency={cue.urgency}
                                                            key={cue.id}
                                                        >
                                                            <strong>{cue.chaseLabel}</strong>
                                                            <small>{cue.actionLabel}</small>
                                                            <u>{getChainRewardLaneAction(cue.urgency)}</u>
                                                            <b>{cue.label}</b>
                                                            <em>{cue.distanceLabel}</em>
                                                            <i>{getChainRewardUrgencyCopy(cue)}</i>
                                                            {stackLabel ? <mark>{stackLabel}</mark> : null}
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        ) : null}
                                        <span
                                            aria-label={`Chain momentum meter ${Math.min(10, Math.max(0, run.stats.currentStreak))} of 10`}
                                            className={styles.hudMomentumMeter}
                                            data-meter-kind="chain"
                                            data-testid="hud-chain-meter"
                                            style={hudMeterStyle(chainMomentumMeterPercent)}
                                        />
                                    </div>
                                ) : null}
                                {compactHudAnnouncement ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudRecentActionPill}`}
                                        aria-label={recentActionAriaLabel}
                                        data-testid="hud-recent-action"
                                        data-tone={recentActionFeedback?.tone ?? politeHudAnnouncementPriority}
                                        title={politeHudAnnouncement}
                                    >
                                        <span className={styles.statKey}>{recentActionLabel}</span>
                                        <span className={styles.statVal}>{compactHudAnnouncement}</span>
                                        {recentActionImpact && recentActionImpact.details.length > 0 ? (
                                            <span
                                                className={styles.hudRecentActionImpact}
                                                data-burst-tier={recentActionImpact.burstTier}
                                                data-impact-beats={recentActionImpactBeatCount}
                                                data-impact-level={recentActionImpact.level}
                                                data-impact-cue={recentActionImpactCue ?? 'none'}
                                                data-impact-screen-cue={recentActionImpactScreenCue}
                                                data-lane-actions={recentActionLaneActionMapAttr}
                                                data-lane-map={recentActionLaneMapAttr}
                                                data-testid="hud-recent-action-impact"
                                            >
                                                {recentActionImpactCue ? (
                                                    <span
                                                        data-hud-action-impact-beats={recentActionImpactBeatCount}
                                                        data-hud-action-impact-cue={recentActionImpactCue}
                                                        data-hud-action-impact-screen-cue={recentActionImpactScreenCue}
                                                    >
                                                        {recentActionImpactCue}
                                                        <span aria-hidden="true" className={styles.hudRecentActionBeatPips}>
                                                            {Array.from({ length: recentActionImpactBeatCount }, (_, beatIndex) => (
                                                                <i
                                                                    data-hud-action-impact-beat={beatIndex + 1}
                                                                    data-hud-action-impact-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`${recentActionImpactCue}-beat-${beatIndex + 1}`}
                                                                />
                                                            ))}
                                                        </span>
                                                    </span>
                                                ) : null}
                                                {recentActionStackLabel ? (
                                                    <span
                                                        data-hud-action-stack={recentActionImpact.burstTier}
                                                        data-hud-action-stack-beats={recentActionImpactBeatCount}
                                                    >
                                                        {recentActionStackLabel}
                                                        <span aria-hidden="true" className={styles.hudRecentActionBeatPips}>
                                                            {Array.from({ length: recentActionImpactBeatCount }, (_, beatIndex) => (
                                                                <i
                                                                    data-hud-action-stack-beat={beatIndex + 1}
                                                                    data-hud-action-stack-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`${recentActionImpact.burstTier}-stack-beat-${beatIndex + 1}`}
                                                                />
                                                            ))}
                                                        </span>
                                                    </span>
                                                ) : null}
                                                {recentActionImpact.details.slice(0, 3).map((detail) => (
                                                    <span data-action-feedback-detail={detail.tone} key={`${detail.tone}:${detail.label}`}>
                                                        {detail.label}
                                                    </span>
                                                ))}
                                                {recentActionLaneMap.length > 0 ? (
                                                    <span
                                                        aria-label={recentActionLaneMapLabel ?? undefined}
                                                        data-hud-action-lane-actions={recentActionLaneActionMapAttr}
                                                        data-hud-action-lane-map={recentActionLaneMapAttr}
                                                        data-hud-action-primary-lane={primaryRecentActionLane?.id ?? 'none'}
                                                        data-hud-action-primary-lane-action={primaryRecentActionLane?.action ?? 'none'}
                                                        data-hud-action-primary-lane-audio={
                                                            primaryRecentActionLane ? hudRecentActionLaneAudioCue(primaryRecentActionLane) : 'none'
                                                        }
                                                        data-hud-action-primary-lane-beats={
                                                            primaryRecentActionLane ? hudRecentActionLaneBeatCount(primaryRecentActionLane) : 0
                                                        }
                                                        data-hud-action-primary-lane-screen-cue={
                                                            primaryRecentActionLane ? hudRecentActionLaneScreenCue(primaryRecentActionLane) : 'none'
                                                        }
                                                        data-testid="hud-recent-action-lane-map"
                                                    >
                                                        <span
                                                            className={styles.hudRecentActionLaneMapSummary}
                                                            data-hud-action-lane-count={recentActionLaneMap.length}
                                                            data-testid="hud-recent-action-lane-map-summary"
                                                        >
                                                            <small>Lanes</small>
                                                            <b>
                                                                {recentActionLaneMap.length}{' '}
                                                                {recentActionLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                            </b>
                                                            <span
                                                                aria-hidden="true"
                                                                className={styles.hudRecentActionLaneMapSummaryBeatPips}
                                                            >
                                                                {Array.from(
                                                                    { length: Math.max(2, Math.min(5, recentActionLaneMap.length + 1)) },
                                                                    (_, beatIndex) => (
                                                                        <u
                                                                            data-hud-action-lane-map-summary-beat={beatIndex + 1}
                                                                            data-hud-action-lane-map-summary-beat-focus={
                                                                                beatIndex === 0 ? 'primary' : 'support'
                                                                            }
                                                                            key={beatIndex}
                                                                        />
                                                                    )
                                                                )}
                                                            </span>
                                                        </span>
                                                        {primaryRecentActionLane ? (
                                                            <b
                                                                aria-label={`Primary recent action lane. ${primaryRecentActionLane.label}: ${primaryRecentActionLane.action}. ${hudRecentActionLaneBeatCount(primaryRecentActionLane)} beats.`}
                                                                className={styles.hudRecentActionPrimaryLaneCue}
                                                                data-hud-action-primary-lane={primaryRecentActionLane.id}
                                                                data-hud-action-primary-lane-action={primaryRecentActionLane.action}
                                                                data-hud-action-primary-lane-audio={hudRecentActionLaneAudioCue(primaryRecentActionLane)}
                                                                data-hud-action-primary-lane-beats={hudRecentActionLaneBeatCount(primaryRecentActionLane)}
                                                                data-hud-action-primary-lane-screen-cue={hudRecentActionLaneScreenCue(primaryRecentActionLane)}
                                                                data-testid="hud-recent-action-primary-lane"
                                                            >
                                                                <strong>Next lane</strong>
                                                                <em>{primaryRecentActionLane.label}</em>
                                                                <i>{primaryRecentActionLane.action}</i>
                                                                <span aria-hidden="true" className={styles.hudRecentActionPrimaryLaneBeatPips}>
                                                                    {Array.from(
                                                                        { length: hudRecentActionLaneBeatCount(primaryRecentActionLane) },
                                                                        (_, beatIndex) => (
                                                                            <u
                                                                                data-hud-action-primary-lane-beat={beatIndex + 1}
                                                                                data-hud-action-primary-lane-beat-focus={
                                                                                    beatIndex === 0 ? 'primary' : 'support'
                                                                                }
                                                                                key={beatIndex}
                                                                            />
                                                                        )
                                                                    )}
                                                                </span>
                                                            </b>
                                                        ) : null}
                                                        {recentActionLaneMap.map((lane) => (
                                                            <b
                                                                data-hud-action-lane={lane.id}
                                                                data-hud-action-lane-action={lane.action}
                                                                data-hud-action-lane-audio={hudRecentActionLaneAudioCue(lane)}
                                                                data-hud-action-lane-beats={hudRecentActionLaneBeatCount(lane)}
                                                                data-hud-action-lane-focus={
                                                                    lane.id === primaryRecentActionLane?.id ? 'primary' : 'support'
                                                                }
                                                                data-hud-action-lane-screen-cue={hudRecentActionLaneScreenCue(lane)}
                                                                key={lane.id}
                                                            >
                                                                <strong>{lane.label}</strong>
                                                                <em>{lane.count}</em>
                                                                <i>{lane.action}</i>
                                                                <span aria-hidden="true" className={styles.hudRecentActionLaneBeatPips}>
                                                                    {Array.from({ length: hudRecentActionLaneBeatCount(lane) }, (_, beatIndex) => (
                                                                        <u
                                                                            data-hud-action-lane-beat={beatIndex + 1}
                                                                            data-hud-action-lane-beat-focus={
                                                                                beatIndex === 0 ? 'primary' : 'support'
                                                                            }
                                                                            key={beatIndex}
                                                                        />
                                                                    ))}
                                                                </span>
                                                            </b>
                                                        ))}
                                                    </span>
                                                ) : null}
                                                {recentActionStackSummary ? (
                                                    <span
                                                        data-hud-action-stack-action={recentActionStackSummary.action}
                                                        data-hud-action-stack-first={recentActionStackSummary.firstCue}
                                                        data-hud-action-stack-keep={recentActionStackSummary.keepCue}
                                                        data-hud-action-stack-summary={recentActionImpact.burstTier}
                                                        data-hud-action-stack-then={recentActionStackSummary.thenCue}
                                                        data-hud-action-stack-tone={recentActionStackSummary.tone}
                                                        data-testid="hud-recent-action-stack-summary"
                                                    >
                                                        {recentActionStackSummary.label}: <b>{recentActionStackSummary.action}</b>{' '}
                                                        {recentActionStackSummary.value}
                                                        <em>
                                                            <span>{recentActionStackSummary.firstCue}</span>
                                                            <span>{recentActionStackSummary.thenCue}</span>
                                                            <span>{recentActionStackSummary.keepCue}</span>
                                                        </em>
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : null}
                                {inRunCauseRows.length > 0 ? (
                                    <div
                                        aria-label="Recent run feedback"
                                        className={styles.hudFeedbackStrip}
                                        data-hud-cause-primary={primaryInRunCauseRow?.id ?? 'none'}
                                        data-hud-cause-primary-action={
                                            primaryInRunCauseRow ? hudInRunCauseAction(primaryInRunCauseRow) : 'none'
                                        }
                                        data-hud-cause-primary-audio={
                                            primaryInRunCauseRow ? hudInRunCauseAudioCue(primaryInRunCauseRow) : 'none'
                                        }
                                        data-hud-cause-primary-beats={
                                            primaryInRunCauseRow ? hudInRunCauseBeatCount(primaryInRunCauseRow) : 0
                                        }
                                        data-hud-cause-primary-kind={primaryInRunCauseRow?.kind ?? 'none'}
                                        data-hud-cause-primary-screen-cue={
                                            primaryInRunCauseRow ? hudInRunCauseScreenCue(primaryInRunCauseRow) : 'none'
                                        }
                                        data-testid="hud-in-run-cause-strip"
                                    >
                                        {primaryInRunCauseRow ? (
                                            <span
                                                aria-label={`Primary run cause. ${primaryInRunCauseRow.label}: ${primaryInRunCauseRow.summary}. ${hudInRunCauseAction(
                                                    primaryInRunCauseRow
                                                )}. ${hudInRunCauseBeatCount(primaryInRunCauseRow)} beats.`}
                                                className={styles.hudFeedbackPrimaryCause}
                                                data-hud-cause-primary={primaryInRunCauseRow.id}
                                                data-hud-cause-primary-action={hudInRunCauseAction(primaryInRunCauseRow)}
                                                data-hud-cause-primary-audio={hudInRunCauseAudioCue(primaryInRunCauseRow)}
                                                data-hud-cause-primary-beats={hudInRunCauseBeatCount(primaryInRunCauseRow)}
                                                data-hud-cause-primary-kind={primaryInRunCauseRow.kind}
                                                data-hud-cause-primary-screen-cue={hudInRunCauseScreenCue(primaryInRunCauseRow)}
                                                data-testid="hud-primary-cause-cue"
                                            >
                                                <small>Primary cause</small>
                                                <b>{hudInRunCauseAction(primaryInRunCauseRow)}</b>
                                                <em>{primaryInRunCauseRow.label}</em>
                                                <strong>{primaryInRunCauseRow.summary}</strong>
                                                <span aria-hidden="true" className={styles.hudFeedbackPrimaryCauseBeatPips}>
                                                    {Array.from({ length: hudInRunCauseBeatCount(primaryInRunCauseRow) }, (_, beatIndex) => (
                                                        <i data-hud-cause-primary-beat={beatIndex + 1} key={beatIndex} />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {inRunCauseRows.map((row) => (
                                            <span
                                                className={styles.hudFeedbackChip}
                                                data-feedback-action={hudInRunCauseAction(row)}
                                                data-feedback-beats={hudInRunCauseBeatCount(row)}
                                                data-feedback-kind={row.kind}
                                                data-testid={`hud-cause-row-${row.id}`}
                                                key={row.id}
                                                title={row.detail}
                                            >
                                                <span className={styles.statKey}>{row.label}</span>
                                                <span className={styles.statVal}>{row.summary}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                {endlessChapterActive && run.featuredObjectiveStreak > 0 ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-hud-density="tertiary"
                                        data-testid="hud-featured-streak"
                                        title="Consecutive endless featured objectives completed"
                                    >
                                        <span className={styles.statKey}>Streak</span>
                                        <span className={styles.statVal}>x{run.featuredObjectiveStreak}</span>
                                        <span className={styles.statSubline}>Consecutive featured clears</span>
                                    </div>
                                ) : null}
                            </div>
                            <details className={styles.hudTertiaryDetails} data-testid="hud-secondary-stat-drawer">
                                <summary aria-label="More run context" title="More run context">More</summary>
                                <div className={styles.statRailTertiary} data-hud-priority="tertiary">
                                    {run.status === 'memorize' || run.status === 'playing' ? (
                                        <>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-shuffle-charges"
                                                title={
                                                    run.activeContract?.noShuffle
                                                        ? 'Scholar contract: full-board shuffle is locked.'
                                                        : `Search — Shuffle charges: ${run.shuffleCharges}. Uses a run charge; breaks Scholar-style and some perfect-memory rules when used.`
                                                }
                                            >
                                                <span className={styles.statKey}>Shuffle</span>
                                                <span className={styles.statVal}>
                                                    {run.activeContract?.noShuffle ? 'Off' : run.shuffleCharges}
                                                </span>
                                                <span className={styles.statSubline}>
                                                    {run.activeContract?.noShuffle
                                                        ? 'Locked in Scholar'
                                                        : 'Reshuffles hidden board order'}
                                                </span>
                                            </div>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-destroy-charges"
                                                title={
                                                    run.activeContract?.noDestroy
                                                        ? 'Scholar contract: destroy pair is locked.'
                                                        : `Damage control — Destroy charges: ${run.destroyPairCharges}. Spend to remove a fully hidden pair with no match score — forfeits pickups on that pair. Run rewards can add to the uncapped bank.`
                                                }
                                            >
                                                <span className={styles.statKey}>Destroy</span>
                                                <span className={styles.statVal}>
                                                    {run.activeContract?.noDestroy ? 'Off' : run.destroyPairCharges}
                                                </span>
                                                <span className={styles.statSubline}>
                                                    {run.activeContract?.noDestroy
                                                        ? 'Locked in Scholar'
                                                        : 'Forfeits pickups on that pair'}
                                                </span>
                                            </div>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-peek-charges"
                                                title={`Recall — Peek charges: ${run.peekCharges}. Arm peek in the toolbar, then tap a tile for a brief reveal.`}
                                            >
                                                <span className={styles.statKey}>Peek</span>
                                                <span className={styles.statVal}>{run.peekCharges}</span>
                                                <span className={styles.statSubline}>Brief reveal only</span>
                                            </div>
                                        </>
                                    ) : null}
                                    {run.activeContract?.noShuffle ? (
                                        <div className={styles.statPillCompact}>
                                            <span className={styles.statKey}>Contract</span>
                                            <span className={styles.statVal}>Scholar</span>
                                        </div>
                                    ) : null}
                                    {traitOpportunityHud.active ? (
                                        <div
                                            className={styles.hudTraitRouteDetails}
                                            data-testid="hud-trait-route-details"
                                        >
                                            <span className={styles.statKey}>Trait Route Panel</span>
                                            <strong>
                                                {traitOpportunitySummary.buildLabels.length > 0
                                                    ? traitOpportunitySummary.buildLabels.join(' / ')
                                                    : traitOpportunityHud.buildLabel}
                                            </strong>
                                            {traitOpportunityCardLine ? (
                                                <span>Cards: {traitOpportunityCardLine}</span>
                                            ) : null}
                                            {traitOpportunitySummary.interactionLines.slice(0, 3).map((line) => (
                                                <span key={line}>{line}</span>
                                            ))}
                                        {traitOpportunityHud.swapHint ? (
                                            <span>{traitOpportunityHud.swapHint.text}</span>
                                        ) : null}
                                        {traitOpportunityLaneMap.length > 0 ? (
                                            <>
                                                <span className={styles.hudTraitRouteLaneMapLabel}>Trait lanes</span>
                                            <div
                                                aria-label={traitOpportunityLaneMapLabel}
                                                className={styles.hudTraitRouteLaneMap}
                                                data-testid="hud-trait-route-lane-map-details"
                                                data-trait-interaction-lane-actions={traitOpportunityLaneActionMapAttr}
                                                data-trait-interaction-lane-map={traitOpportunityLaneMapAttr}
                                            >
                                                <span
                                                    className={styles.hudTraitRouteLaneMapSummary}
                                                    data-trait-interaction-lane-count={traitOpportunityLaneMap.length}
                                                    data-testid="hud-trait-route-lane-map-summary-details"
                                                >
                                                    <small>Trait lanes</small>
                                                    <b>
                                                        {traitOpportunityLaneMap.length}{' '}
                                                        {traitOpportunityLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                    </b>
                                                    <span className={styles.hudTraitRouteLaneMapSummaryLead}>
                                                        {primaryTraitOpportunityLane
                                                            ? `${primaryTraitOpportunityLane.label} leads`
                                                            : 'No lead lane'}
                                                    </span>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.hudTraitRouteLaneMapSummaryBeatPips}
                                                    >
                                                        {Array.from(
                                                            {
                                                                length: Math.max(
                                                                    2,
                                                                    Math.min(5, traitOpportunityLaneMap.length + 1)
                                                                )
                                                            },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-trait-interaction-lane-summary-beat={beatIndex + 1}
                                                                    data-trait-interaction-lane-summary-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                                {traitOpportunityLaneMap.map((lane) => (
                                                    <span
                                                        data-trait-interaction-lane={lane.id}
                                                        key={lane.id}
                                                    >
                                                        <small>{lane.label}</small>
                                                        <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                                                        <em>
                                                            {lane.count} {lane.count === 1 ? 'line' : 'lines'} · {lane.cue}
                                                        </em>
                                                    </span>
                                                ))}
                                            </div>
                                            </>
                                        ) : null}
                                        {traitRouteObjectiveStatus ? (
                                            <small
                                                data-testid="hud-trait-route-details-action"
                                                data-trait-route-urgency={traitRouteObjectiveStatus.urgency}
                                            >
                                                    Now: {traitRouteObjectiveStatus.actionLabel}. {traitRouteObjectiveStatus.stateLabel}. Reward: {traitRouteObjectiveStatus.reward}.
                                                </small>
                                            ) : null}
                                            {traitChainStackCue ? (
                                                <small data-testid="hud-trait-route-details-stack">
                                                    Stack: {traitChainStackCue.action}. {traitChainStackCue.value}.
                                                </small>
                                            ) : null}
                                            <small>
                                                {traitOpportunityHud.toolLine}
                                            </small>
                                        </div>
                                    ) : null}
                                    {run.activeContract?.maxPinsTotalRun != null ? (
                                        <div className={styles.statPillCompact} title="Pin vow contract">
                                            <span className={styles.statKey}>Pins</span>
                                            <span className={styles.statVal}>
                                                {run.pinsPlacedCountThisRun}/{run.activeContract.maxPinsTotalRun}
                                            </span>
                                        </div>
                                    ) : null}
                                    {run.gameMode === 'meditation' ? (
                                        <div className={styles.statPillCompact} title="Meditation run">
                                            <span className={styles.statKey}>Mode</span>
                                            <span className={styles.statVal}>Meditation</span>
                                        </div>
                                    ) : null}
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-difficulty-profile"
                                        title={`${difficultyProfile.label}: ${difficultyProfile.playerCopy}`}
                                    >
                                        <span className={styles.statKey}>Difficulty</span>
                                        <span className={styles.statVal}>{difficultyProfile.label}</span>
                                    </div>
                                    {run.wildMenuRun ? (
                                        <div className={styles.statPillCompact} title="Wild joker run">
                                            <span className={styles.statKey}>Wild</span>
                                            <span className={styles.statVal}>On</span>
                                        </div>
                                    ) : null}
                                    {perfectMemoryHud !== 'hidden' ? (
                                        <div
                                            className={`${styles.statPillCompact} ${
                                                perfectMemoryHud === 'locked' ? styles.statPillCompactPerfectMemoryLocked : ''
                                            }`}
                                            data-testid="hud-perfect-memory"
                                            title={`${perfectMemoryAttribution.summary} ${PERFECT_MEMORY_BASE_RULES}`}
                                        >
                                            <span className={styles.statKey}>Perfect Memory</span>
                                            <span className={styles.statVal}>
                                                {perfectMemoryHud === 'locked'
                                                    ? `Locked${perfectMemoryAttribution.firstAction ? `: ${perfectMemoryAttribution.firstAction}` : ''}`
                                                    : 'Eligible'}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className={styles.hudTouchDetailRows} data-testid="hud-touch-detail-rows">
                                        {touchHudDetailRows.map((row) => (
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid={`hud-touch-detail-${row.id}`}
                                                key={row.id}
                                                title={row.detail}
                                            >
                                                <span className={styles.statKey}>{row.label}</span>
                                                <span className={styles.statVal}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </div>
                    </details>
                </div>
            </div>
            <div
                aria-atomic="true"
                aria-live="polite"
                className={styles.srOnly}
                data-testid="hud-polite-live-region"
                role="status"
            >
                {politeHudAnnouncement}
            </div>
        </header>
    );
};

export default GameplayHudBar;
