import {
    getTraitInteractionLaneAction,
    getTraitInteractionLaneRole,
    TRAIT_INTERACTION_LANE_LABELS,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';
import { getTraitLaneFeedbackBeatCount } from './tileBoardDomTelemetry';
import { buildTileBoardDomSurfaceModel } from './tileBoardDomSurfaceModel';
import { getTraitRouteReadabilityBeatCount } from './tileBoardReadability';

const CARD_ACTION_PRIORITY_LABELS: Record<string, string> = {
    'bank-lane': 'Bank lane',
    'build-lane': 'Route prime',
    'cash-now': 'Cash now',
    'follow-up': 'Follow-up',
    'perk-cash': 'Perk cash',
    'route-setup': 'Route prime'
};

const CARD_ACTION_SHOT_LABELS: Record<string, string> = {
    'bank-lane': 'Bank',
    'build-lane': 'Build',
    'cash-now': 'Cash',
    'follow-up': 'Tap',
    'perk-cash': 'Perk',
    'route-setup': 'Set'
};

const CARD_ACTION_SHOT_DETAILS: Record<string, string> = {
    'bank-lane': 'Reward lane',
    'build-lane': 'Route lane',
    'cash-now': 'Cashout lane',
    'follow-up': 'Next tap',
    'perk-cash': 'Perk lane',
    'route-setup': 'Setup lane'
};

const CARD_FEEDBACK_BEAT_PRIORITY = ['cashout', 'surge', 'follow-up', 'route', 'setup'] as const;
const CARD_FEEDBACK_BEAT_LABELS: Record<(typeof CARD_FEEDBACK_BEAT_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    'follow-up': 'Follow-up',
    route: 'Route',
    setup: 'Prime',
    surge: 'Surge'
};

const CARD_FEEDBACK_BEAT_ACTIONS: Record<(typeof CARD_FEEDBACK_BEAT_PRIORITY)[number], string> = {
    cashout: 'hit now',
    'follow-up': 'tap next',
    route: 'build chain',
    setup: 'set route',
    surge: 'chain routes'
};

const CARD_FEEDBACK_CADENCE_PRIORITY = ['cashout', 'surge', 'follow-up', 'route', 'prime'] as const;
const CARD_FEEDBACK_CADENCE_LABELS: Record<(typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    'follow-up': 'Follow-up',
    prime: 'Prime',
    route: 'Route',
    surge: 'Surge'
};

const CARD_FEEDBACK_CADENCE_BEATS: Record<(typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number], 2 | 3 | 4 | 5> = {
    cashout: 5,
    surge: 4,
    'follow-up': 3,
    route: 3,
    prime: 2
};

const CARD_TRAIT_LANE_ORDER_SET = new Set<TraitInteractionLaneId>(['shard', 'guard', 'tool', 'risk', 'block', 'recall', 'score']);

type CardActionPriorityRole = 'Bank' | 'Cashout' | 'Follow-up' | 'Perk' | 'Setup';
type CardActionPriorityTone = 'bank' | 'cashout' | 'followup' | 'perk' | 'setup';
type CardActionPriorityScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';
type CardActionPrioritySummaryTier = CardActionPriorityTone;
type CardShotMapSummaryTier = CardActionPriorityTone;
type CardFeedbackPulseTone = 'cashout' | 'followup' | 'route' | 'setup' | 'surge';
type CardFeedbackPulseScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';
type CardFeedbackBeatId = (typeof CARD_FEEDBACK_BEAT_PRIORITY)[number];
type CardFeedbackCadenceId = (typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number];
type CardBeatMapSummaryAction = CardFeedbackPulseTone;
type CardBeatMapSummaryTier = CardFeedbackBeatId;
type CardCadenceMapSummaryAction = CardFeedbackPulseTone;
type CardCadenceMapSummaryTier = CardFeedbackCadenceId;
type CardTraitLaneRole = 'Block' | 'Cashout' | 'Protect' | 'Recall' | 'Risk' | 'Tool';
export type CardTraitLaneBeatMapSummaryAction = 'block' | 'cashout' | 'protect' | 'recall' | 'risk' | 'tool';
type CardTraitLaneBeatMapSummaryTier = CardTraitLaneBeatMapSummaryAction;

interface CardFeedbackActionPriorityRow {
    count: number;
    id: string;
    label: string;
    role: CardActionPriorityRole;
    screenCue: CardActionPriorityScreenCue;
    tone: CardActionPriorityTone;
}

interface CardFeedbackShotMapRow extends CardFeedbackActionPriorityRow {
    detail: string;
    shotLabel: string;
}

interface CardFeedbackBeatRow {
    action: string;
    beatCount: 2 | 3 | 4 | 5;
    count: number;
    id: string;
    label: string;
    screenCue: CardFeedbackPulseScreenCue;
    tone: CardFeedbackPulseTone;
}

interface CardFeedbackCadenceRow {
    action: string;
    beatCount: 2 | 3 | 4 | 5;
    count: number;
    id: string;
    label: string;
    screenCue: CardFeedbackPulseScreenCue;
    tone: CardFeedbackPulseTone;
}

interface CardFeedbackTraitLaneBeatRow {
    action: string;
    beatCount: number;
    count: number;
    id: string;
    label: string;
    role: CardTraitLaneRole;
}

export interface CardFeedbackMapsState {
    cardActionPrioritySummaryAction: CardActionPriorityTone | null;
    cardActionPrioritySummaryBeatCount: 2 | 3 | 4 | 5;
    cardActionPrioritySummaryScreenCue: CardActionPriorityScreenCue | null;
    cardActionPrioritySummaryTier: CardActionPrioritySummaryTier | null;
    cardBeatMapSummaryAction: CardBeatMapSummaryAction | null;
    cardBeatMapSummaryBeatCount: 2 | 3 | 4 | 5;
    cardBeatMapSummaryMeterFill: number;
    cardBeatMapSummaryScreenCue: CardFeedbackPulseScreenCue | null;
    cardBeatMapSummaryTier: CardBeatMapSummaryTier | null;
    cardCadenceMapSummaryAction: CardCadenceMapSummaryAction | null;
    cardCadenceMapSummaryBeatCount: 2 | 3 | 4 | 5;
    cardCadenceMapSummaryScreenCue: CardFeedbackPulseScreenCue | null;
    cardCadenceMapSummaryTier: CardCadenceMapSummaryTier | null;
    cardFeedbackActionPriorityRows: CardFeedbackActionPriorityRow[];
    cardFeedbackBeatActionMapAttr: string;
    cardFeedbackBeatMapLabel: string;
    cardFeedbackBeatRows: CardFeedbackBeatRow[];
    cardFeedbackCadenceMapLabel: string;
    cardFeedbackCadenceRows: CardFeedbackCadenceRow[];
    cardFeedbackShotMapAttr: string;
    cardFeedbackShotMapLabel: string;
    cardFeedbackShotMapRows: CardFeedbackShotMapRow[];
    cardShotMapSummaryAction: CardActionPriorityTone | null;
    cardShotMapSummaryBeatCount: 2 | 3 | 4 | 5;
    cardShotMapSummaryScreenCue: CardActionPriorityScreenCue | null;
    cardShotMapSummaryTier: CardShotMapSummaryTier | null;
    cardFeedbackTraitLaneBeatMapLabel: string;
    cardFeedbackTraitLaneBeatMapMeterFill: number;
    cardFeedbackTraitLaneBeatRows: CardFeedbackTraitLaneBeatRow[];
    primaryCardActionPriorityRow: CardFeedbackActionPriorityRow | null;
    primaryCardFeedbackBeatRow: CardFeedbackBeatRow | null;
    primaryCardFeedbackCadenceRow: CardFeedbackCadenceRow | null;
    primaryCardFeedbackShotAudioCue: 'card-shot-cashout' | 'card-shot-follow-up' | 'card-shot-prime' | 'card-shot-route' | 'card-shot-surge' | 'none';
    primaryCardFeedbackShotFocus: 'cashout' | 'follow-up' | 'none' | 'route' | 'setup' | 'surge';
    primaryCardFeedbackShotRow: CardFeedbackShotMapRow | null;
    primaryCardFeedbackShotScreenCue: 'burst' | 'guard' | 'none' | 'pulse';
    primaryTraitLaneAudioCue: 'none' | 'trait-lane-block' | 'trait-lane-guard' | 'trait-lane-recall' | 'trait-lane-risk' | 'trait-lane-shard' | 'trait-lane-tool';
    primaryTraitLaneBeatRow: CardFeedbackTraitLaneBeatRow | null;
    primaryTraitLaneScreenCue: 'burst' | 'guard' | 'none' | 'pulse' | 'risk';
    traitLaneBeatMapSummaryAction: CardTraitLaneBeatMapSummaryAction | null;
    traitLaneBeatMapSummaryBeatCount: 2 | 3 | 4 | 5;
    traitLaneBeatMapSummaryScreenCue: 'burst' | 'guard' | 'pulse' | 'risk' | null;
    traitLaneBeatMapSummaryTier: CardTraitLaneBeatMapSummaryTier | null;
}

type TileBoardDomSurfaceState = ReturnType<typeof buildTileBoardDomSurfaceModel>;

const cardActionPriorityRole = (id: string): CardActionPriorityRole => {
    if (id === 'bank-lane') {
        return 'Bank';
    }
    if (id === 'follow-up') {
        return 'Follow-up';
    }
    if (id === 'perk-cash') {
        return 'Perk';
    }
    if (id === 'cash-now') {
        return 'Cashout';
    }
    return 'Setup';
};

const cardActionPriorityTone = (id: string): CardActionPriorityTone => {
    if (id === 'bank-lane') {
        return 'bank';
    }
    if (id === 'follow-up') {
        return 'followup';
    }
    if (id === 'perk-cash') {
        return 'perk';
    }
    if (id === 'cash-now') {
        return 'cashout';
    }
    return 'setup';
};

const cardActionPriorityScreenCue = (id: string): CardActionPriorityScreenCue => {
    if (id === 'bank-lane') {
        return 'guard';
    }
    if (id === 'follow-up') {
        return 'pulse';
    }
    if (id === 'cash-now' || id === 'perk-cash') {
        return 'burst';
    }
    return 'tick';
};

const getCardActionPrioritySummaryBeatCount = (
    rows: readonly { count: number }[],
    primaryRow: { count: number } | null
): 2 | 3 | 4 | 5 => {
    if (!primaryRow) {
        return 2;
    }
    return Math.max(2, Math.min(5, rows.length + Math.min(4, primaryRow.count))) as 2 | 3 | 4 | 5;
};

const getCardShotMapSummaryBeatCount = (
    rows: readonly { count: number }[],
    primaryRow: { count: number } | null
): 2 | 3 | 4 | 5 => {
    if (!primaryRow) {
        return 2;
    }
    return Math.max(2, Math.min(5, rows.length + Math.min(4, primaryRow.count))) as 2 | 3 | 4 | 5;
};

const getCardBeatMapSummaryBeatCount = (
    rows: readonly unknown[],
    primaryRow: { beatCount: number } | null
): 2 | 3 | 4 | 5 => {
    if (!primaryRow) {
        return 2;
    }
    return Math.max(2, Math.min(5, rows.length + primaryRow.beatCount - 1)) as 2 | 3 | 4 | 5;
};

const getCardCadenceMapSummaryBeatCount = (
    rows: readonly unknown[],
    primaryRow: { beatCount: number } | null
): 2 | 3 | 4 | 5 => {
    if (!primaryRow) {
        return 2;
    }
    return Math.max(2, Math.min(5, rows.length + primaryRow.beatCount - 1)) as 2 | 3 | 4 | 5;
};

const getCardTraitLaneBeatMapSummaryBeatCount = (
    rows: readonly unknown[],
    primaryRow: { beatCount: number } | null
): 2 | 3 | 4 | 5 => {
    if (!primaryRow) {
        return 2;
    }
    return Math.max(2, Math.min(5, rows.length + primaryRow.beatCount - 1)) as 2 | 3 | 4 | 5;
};

const cardFeedbackPulseTone = (id: string): CardFeedbackPulseTone => {
    if (id === 'cashout') {
        return 'cashout';
    }
    if (id === 'follow-up') {
        return 'followup';
    }
    if (id === 'route') {
        return 'route';
    }
    if (id === 'surge') {
        return 'surge';
    }
    return 'setup';
};

const cardFeedbackPulseScreenCue = (id: string): CardFeedbackPulseScreenCue => {
    if (id === 'cashout' || id === 'surge') {
        return 'burst';
    }
    if (id === 'follow-up') {
        return 'pulse';
    }
    if (id === 'route') {
        return 'guard';
    }
    return 'tick';
};

const cardPrimaryShotAudioCue = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
): 'card-shot-cashout' | 'card-shot-follow-up' | 'card-shot-prime' | 'card-shot-route' | 'card-shot-surge' => {
    if (beatId === 'cashout' || cadenceId === 'cashout') {
        return 'card-shot-cashout';
    }
    if (beatId === 'surge' || cadenceId === 'surge') {
        return 'card-shot-surge';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'card-shot-route';
    }
    if (beatId === 'follow-up' || cadenceId === 'follow-up') {
        return 'card-shot-follow-up';
    }
    return 'card-shot-prime';
};

const cardPrimaryShotScreenCue = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
): 'burst' | 'guard' | 'pulse' => {
    if (beatId === 'cashout' || beatId === 'surge' || cadenceId === 'cashout' || cadenceId === 'surge') {
        return 'burst';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'guard';
    }
    return 'pulse';
};

const cardPrimaryShotFocus = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
): 'cashout' | 'follow-up' | 'route' | 'setup' | 'surge' => {
    if (beatId === 'cashout' || cadenceId === 'cashout') {
        return 'cashout';
    }
    if (beatId === 'surge' || cadenceId === 'surge') {
        return 'surge';
    }
    if (beatId === 'follow-up' || cadenceId === 'follow-up') {
        return 'follow-up';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'route';
    }
    return 'setup';
};

export const cardTraitLaneAudioCue = (
    laneId: TraitInteractionLaneId | string
): 'trait-lane-block' | 'trait-lane-guard' | 'trait-lane-recall' | 'trait-lane-risk' | 'trait-lane-shard' | 'trait-lane-tool' => {
    if (laneId === 'guard') {
        return 'trait-lane-guard';
    }
    if (laneId === 'tool') {
        return 'trait-lane-tool';
    }
    if (laneId === 'risk') {
        return 'trait-lane-risk';
    }
    if (laneId === 'block') {
        return 'trait-lane-block';
    }
    if (laneId === 'recall') {
        return 'trait-lane-recall';
    }
    return 'trait-lane-shard';
};

export const cardTraitLaneScreenCue = (laneId: TraitInteractionLaneId | string): 'burst' | 'guard' | 'pulse' | 'risk' => {
    if (laneId === 'risk' || laneId === 'block') {
        return 'risk';
    }
    if (laneId === 'guard' || laneId === 'tool') {
        return 'guard';
    }
    if (laneId === 'recall') {
        return 'pulse';
    }
    return 'burst';
};

const cardTraitLaneRole = (laneId: TraitInteractionLaneId | string): CardTraitLaneRole =>
    CARD_TRAIT_LANE_ORDER_SET.has(laneId as TraitInteractionLaneId)
        ? getTraitInteractionLaneRole({ id: laneId as TraitInteractionLaneId })
        : 'Cashout';

export const cardTraitLaneBeatMapSummaryAction = (
    role: CardTraitLaneRole | null
): CardTraitLaneBeatMapSummaryAction | null => {
    if (!role) {
        return null;
    }
    return role.toLowerCase() as CardTraitLaneBeatMapSummaryAction;
};

export const parseCountAttribute = (value: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const entry of value.split(/[;>]/u)) {
        if (!entry) {
            continue;
        }
        const [key, countText] = entry.split(':');
        const count = Number(countText);
        if (!key || !Number.isFinite(count)) {
            continue;
        }
        counts.set(key, count);
    }
    return counts;
};

export const buildCardFeedbackMapsState = ({
    cardFeedbackActionPriorityAttr,
    cardFeedbackBeatTiersAttr,
    cardFeedbackCadencesAttr,
    cardFeedbackPrimaryActionAttr,
    cardFeedbackTraitLaneActionsAttr,
    cardFeedbackTraitLaneBeatsAttr,
    cardFeedbackTraitLaneCuesAttr
}: {
    cardFeedbackActionPriorityAttr: string;
    cardFeedbackBeatTiersAttr: string;
    cardFeedbackCadencesAttr: string;
    cardFeedbackPrimaryActionAttr: string;
    cardFeedbackTraitLaneActionsAttr: string;
    cardFeedbackTraitLaneBeatsAttr: string;
    cardFeedbackTraitLaneCuesAttr: string;
}): CardFeedbackMapsState => {
    const cardFeedbackActionPriorityRows = cardFeedbackActionPriorityAttr
        .split('>')
        .map((entry) => {
            const [id, countText] = entry.split(':');
            const count = Number(countText);
            if (!id || !Number.isFinite(count)) {
                return null;
            }
            return {
                count,
                id,
                label: CARD_ACTION_PRIORITY_LABELS[id] ?? id,
                role: cardActionPriorityRole(id),
                screenCue: cardActionPriorityScreenCue(id),
                tone: cardActionPriorityTone(id)
            };
        })
        .filter((row): row is CardFeedbackActionPriorityRow => row != null);

    const primaryCardActionPriorityRow =
        cardFeedbackActionPriorityRows.find((row) => row.id === cardFeedbackPrimaryActionAttr) ??
        cardFeedbackActionPriorityRows[0] ??
        null;
    const cardActionPrioritySummaryAction = primaryCardActionPriorityRow?.tone ?? null;
    const cardActionPrioritySummaryTier: CardActionPrioritySummaryTier | null = primaryCardActionPriorityRow?.tone ?? null;
    const cardActionPrioritySummaryScreenCue = primaryCardActionPriorityRow?.screenCue ?? null;
    const cardActionPrioritySummaryBeatCount = getCardActionPrioritySummaryBeatCount(
        cardFeedbackActionPriorityRows,
        primaryCardActionPriorityRow
    );

    const cardFeedbackShotMapRows = cardFeedbackActionPriorityRows.map((row) => ({
        ...row,
        detail: CARD_ACTION_SHOT_DETAILS[row.id] ?? 'Action lane',
        shotLabel: CARD_ACTION_SHOT_LABELS[row.id] ?? row.label
    }));
    const cardFeedbackShotMapAttr = cardFeedbackShotMapRows.map((row) => `${row.id}:${row.count}`).join('>') || 'none';
    const cardFeedbackShotMapLabel =
        cardFeedbackShotMapRows.length > 0
            ? `Combo shot map. ${cardFeedbackShotMapRows.map((row) => `${row.shotLabel}: ${row.count}. ${row.detail}`).join('. ')}.`
            : 'Combo shot map';
    const primaryCardFeedbackShotRow = cardFeedbackShotMapRows[0] ?? null;
    const cardShotMapSummaryAction = primaryCardFeedbackShotRow?.tone ?? null;
    const cardShotMapSummaryTier: CardShotMapSummaryTier | null = primaryCardFeedbackShotRow?.tone ?? null;
    const cardShotMapSummaryScreenCue = primaryCardFeedbackShotRow?.screenCue ?? null;
    const cardShotMapSummaryBeatCount = getCardShotMapSummaryBeatCount(cardFeedbackShotMapRows, primaryCardFeedbackShotRow);

    const beatCounts = parseCountAttribute(cardFeedbackBeatTiersAttr);
    const cardFeedbackBeatRows = CARD_FEEDBACK_BEAT_PRIORITY.filter((id) => beatCounts.has(id)).map((id) => ({
        action: CARD_FEEDBACK_BEAT_ACTIONS[id],
        beatCount: getTraitRouteReadabilityBeatCount(id),
        count: beatCounts.get(id) ?? 0,
        id,
        label: CARD_FEEDBACK_BEAT_LABELS[id],
        screenCue: cardFeedbackPulseScreenCue(id),
        tone: cardFeedbackPulseTone(id)
    }));
    const cardFeedbackBeatMapLabel =
        cardFeedbackBeatRows.length > 0
            ? `Card beat map. ${cardFeedbackBeatRows.map((row) => `${row.label}: ${row.count}. ${row.beatCount}-beat ${row.action}`).join('. ')}.`
            : 'Card beat map';
    const cardFeedbackBeatActionMapAttr = cardFeedbackBeatRows.map((row) => `${row.id}:${row.action}:${row.count}`).join('>') || 'none';
    const primaryCardFeedbackBeatRow = cardFeedbackBeatRows[0] ?? null;
    const cardBeatMapSummaryAction: CardBeatMapSummaryAction | null = primaryCardFeedbackBeatRow?.tone ?? null;
    const cardBeatMapSummaryTier: CardBeatMapSummaryTier | null = (primaryCardFeedbackBeatRow?.id as CardBeatMapSummaryTier | undefined) ?? null;
    const cardBeatMapSummaryScreenCue = primaryCardFeedbackBeatRow?.screenCue ?? null;
    const cardBeatMapSummaryBeatCount = getCardBeatMapSummaryBeatCount(cardFeedbackBeatRows, primaryCardFeedbackBeatRow);
    const cardBeatMapSummaryMeterFill = Math.round(Math.min(100, (cardFeedbackBeatRows.length / 5) * 100));

    const rowsById = new Map(
        cardFeedbackCadencesAttr
            .split('>')
            .map((entry) => {
                const [id, action, countText] = entry.split(':');
                const count = Number(countText);
                if (!id || !action || !Number.isFinite(count)) {
                    return null;
                }
                return [id, { action, count, id }] as const;
            })
            .filter((entry): entry is readonly [string, { action: string; count: number; id: string }] => entry != null)
    );
    const cardFeedbackCadenceRows = CARD_FEEDBACK_CADENCE_PRIORITY.filter((id) => rowsById.has(id)).map((id) => {
        const row = rowsById.get(id)!;
        return {
            ...row,
            beatCount: CARD_FEEDBACK_CADENCE_BEATS[id],
            label: CARD_FEEDBACK_CADENCE_LABELS[id],
            screenCue: cardFeedbackPulseScreenCue(id),
            tone: cardFeedbackPulseTone(id)
        };
    });
    const cardFeedbackCadenceMapLabel =
        cardFeedbackCadenceRows.length > 0
            ? `Card pulse map. ${cardFeedbackCadenceRows.map((row) => `${row.label}: ${row.count}. ${row.action}. ${row.beatCount}-beat pulse`).join('. ')}.`
            : 'Card pulse map';
    const primaryCardFeedbackCadenceRow = cardFeedbackCadenceRows[0] ?? null;
    const cardCadenceMapSummaryAction: CardCadenceMapSummaryAction | null = primaryCardFeedbackCadenceRow?.tone ?? null;
    const cardCadenceMapSummaryTier: CardCadenceMapSummaryTier | null =
        (primaryCardFeedbackCadenceRow?.id as CardCadenceMapSummaryTier | undefined) ?? null;
    const cardCadenceMapSummaryScreenCue = primaryCardFeedbackCadenceRow?.screenCue ?? null;
    const cardCadenceMapSummaryBeatCount = getCardCadenceMapSummaryBeatCount(
        cardFeedbackCadenceRows,
        primaryCardFeedbackCadenceRow
    );

    const primaryCardFeedbackShotAudioCue = primaryCardFeedbackShotRow
        ? cardPrimaryShotAudioCue(primaryCardFeedbackBeatRow?.id ?? 'none', primaryCardFeedbackCadenceRow?.id ?? 'none')
        : 'none';
    const primaryCardFeedbackShotScreenCue = primaryCardFeedbackShotRow
        ? cardPrimaryShotScreenCue(primaryCardFeedbackBeatRow?.id ?? 'none', primaryCardFeedbackCadenceRow?.id ?? 'none')
        : 'none';
    const primaryCardFeedbackShotFocus = primaryCardFeedbackShotRow
        ? cardPrimaryShotFocus(primaryCardFeedbackBeatRow?.id ?? 'none', primaryCardFeedbackCadenceRow?.id ?? 'none')
        : 'none';

    const laneCounts = parseCountAttribute(cardFeedbackTraitLaneCuesAttr);
    const laneBeatCounts = parseCountAttribute(cardFeedbackTraitLaneBeatsAttr);
    const actionByLane = new Map(
        cardFeedbackTraitLaneActionsAttr
            .split('>')
            .map((entry) => {
                const [id, action] = entry.split(':') as [TraitInteractionLaneId | undefined, string | undefined];
                return id && action ? ([id, action] as const) : null;
            })
            .filter((entry): entry is readonly [TraitInteractionLaneId, string] => entry != null)
    );
    const cardFeedbackTraitLaneBeatRows = [...laneCounts.entries()].map(([id, count]) => ({
        action:
            actionByLane.get(id as TraitInteractionLaneId) ??
            (CARD_TRAIT_LANE_ORDER_SET.has(id as TraitInteractionLaneId) ? getTraitInteractionLaneAction(id as TraitInteractionLaneId) : 'trait route'),
        beatCount: laneBeatCounts.get(id) ?? getTraitLaneFeedbackBeatCount(id as Parameters<typeof getTraitLaneFeedbackBeatCount>[0]),
        count,
        id,
        label: CARD_TRAIT_LANE_ORDER_SET.has(id as TraitInteractionLaneId) ? TRAIT_INTERACTION_LANE_LABELS[id as TraitInteractionLaneId] : id,
        role: cardTraitLaneRole(id)
    }));
    const cardFeedbackTraitLaneBeatMapLabel =
        cardFeedbackTraitLaneBeatRows.length > 0
            ? `Trait lane beat map. ${cardFeedbackTraitLaneBeatRows.map((row) => `${row.label}: ${row.count}. ${row.beatCount}-beat ${row.action}`).join('. ')}.`
            : 'Trait lane beat map';
    const cardFeedbackTraitLaneBeatMapMeterFill = Math.round(Math.min(100, (cardFeedbackTraitLaneBeatRows.length / 5) * 100));
    const primaryTraitLaneBeatRow = cardFeedbackTraitLaneBeatRows[0] ?? null;
    const primaryTraitLaneAudioCue = primaryTraitLaneBeatRow ? cardTraitLaneAudioCue(primaryTraitLaneBeatRow.id) : 'none';
    const primaryTraitLaneScreenCue = primaryTraitLaneBeatRow ? cardTraitLaneScreenCue(primaryTraitLaneBeatRow.id) : 'none';
    const traitLaneBeatSummaryAction = cardTraitLaneBeatMapSummaryAction(primaryTraitLaneBeatRow?.role ?? null);
    const traitLaneBeatMapSummaryTier: CardTraitLaneBeatMapSummaryTier | null = traitLaneBeatSummaryAction;
    const traitLaneBeatMapSummaryScreenCue = primaryTraitLaneBeatRow ? cardTraitLaneScreenCue(primaryTraitLaneBeatRow.id) : null;
    const traitLaneBeatMapSummaryBeatCount = getCardTraitLaneBeatMapSummaryBeatCount(
        cardFeedbackTraitLaneBeatRows,
        primaryTraitLaneBeatRow
    );

    return {
        cardActionPrioritySummaryAction,
        cardActionPrioritySummaryBeatCount,
        cardActionPrioritySummaryScreenCue,
        cardActionPrioritySummaryTier,
        cardBeatMapSummaryAction,
        cardBeatMapSummaryBeatCount,
        cardBeatMapSummaryMeterFill,
        cardBeatMapSummaryScreenCue,
        cardBeatMapSummaryTier,
        cardCadenceMapSummaryAction,
        cardCadenceMapSummaryBeatCount,
        cardCadenceMapSummaryScreenCue,
        cardCadenceMapSummaryTier,
        cardFeedbackActionPriorityRows,
        cardFeedbackBeatActionMapAttr,
        cardFeedbackBeatMapLabel,
        cardFeedbackBeatRows,
        cardFeedbackCadenceMapLabel,
        cardFeedbackCadenceRows,
        cardFeedbackShotMapAttr,
        cardFeedbackShotMapLabel,
        cardFeedbackShotMapRows,
        cardShotMapSummaryAction,
        cardShotMapSummaryBeatCount,
        cardShotMapSummaryScreenCue,
        cardShotMapSummaryTier,
        cardFeedbackTraitLaneBeatMapLabel,
        cardFeedbackTraitLaneBeatMapMeterFill,
        cardFeedbackTraitLaneBeatRows,
        primaryCardActionPriorityRow,
        primaryCardFeedbackBeatRow,
        primaryCardFeedbackCadenceRow,
        primaryCardFeedbackShotAudioCue,
        primaryCardFeedbackShotFocus,
        primaryCardFeedbackShotRow,
        primaryCardFeedbackShotScreenCue,
        primaryTraitLaneAudioCue,
        primaryTraitLaneBeatRow,
        primaryTraitLaneScreenCue,
        traitLaneBeatMapSummaryAction: traitLaneBeatSummaryAction,
        traitLaneBeatMapSummaryBeatCount,
        traitLaneBeatMapSummaryScreenCue,
        traitLaneBeatMapSummaryTier
    };
};

export const buildTileBoardCardFeedbackState = ({
    domSurface
}: {
    domSurface: Parameters<typeof buildTileBoardDomSurfaceModel>[0];
}): TileBoardDomSurfaceState &
    CardFeedbackMapsState & {
        cardFeedbackStatesValue: string;
        cardFeedbackTraitComboSurgeActive: boolean;
        cardFeedbackTraitPayoffStackActive: boolean;
    } => {
    const domSurfaceState = buildTileBoardDomSurfaceModel(domSurface);
    const cardFeedbackStatesValue = domSurfaceState.cardFeedbackStatesAttr ?? '';

    return {
        ...domSurfaceState,
        ...buildCardFeedbackMapsState({
            cardFeedbackActionPriorityAttr: domSurfaceState.cardFeedbackActionPriorityAttr,
            cardFeedbackBeatTiersAttr: domSurfaceState.cardFeedbackBeatTiersAttr,
            cardFeedbackCadencesAttr: domSurfaceState.cardFeedbackCadencesAttr,
            cardFeedbackPrimaryActionAttr: domSurfaceState.cardFeedbackPrimaryActionAttr,
            cardFeedbackTraitLaneActionsAttr: domSurfaceState.cardFeedbackTraitLaneActionsAttr,
            cardFeedbackTraitLaneBeatsAttr: domSurfaceState.cardFeedbackTraitLaneBeatsAttr,
            cardFeedbackTraitLaneCuesAttr: domSurfaceState.cardFeedbackTraitLaneCuesAttr
        }),
        cardFeedbackStatesValue,
        cardFeedbackTraitComboSurgeActive: /\btrait-combo-surge:\d+/.test(cardFeedbackStatesValue),
        cardFeedbackTraitPayoffStackActive: /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesValue)
    };
};
