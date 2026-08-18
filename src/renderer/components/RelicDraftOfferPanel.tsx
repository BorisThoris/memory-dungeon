import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent
} from 'react';
import type { RelicId, RelicOfferServiceState, TileTraitKind } from '../../shared/contracts';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import {
    getRelicArchetypeLabels,
    getRelicBuildArchetypeDefinition,
    getRelicBuildArchetypes,
    getRelicDecisionImpactLabels,
    getRelicDecisionImpactCopy,
    getRelicDraftRow,
    relicDraftRarityLabel,
    type RelicOfferServiceAction,
    type RelicDraftRarity
} from '../../shared/relics';
import { getTraitBuildDraftHintForRelic, getTraitBuildRewardRowsForRelic } from '../../shared/trait-build-rewards';
import {
    playRelicChoiceCrescendoSfx,
    resumeAudioContext,
    type RelicChoiceCrescendoSfxTier
} from '../audio/gameSfx';
import { relicDraftRoundAdvancedAnnouncement } from '../copy/relicDraftOffer';
import styles from './RelicDraftOffer.module.css';

/**
 * RDUI-006: Escape does not dismiss this overlay — GameScreen does not close the relic draft on Escape;
 * the player must choose a relic. (Pause via P is already blocked while `relicOffer` is active; see REF-010.)
 */
const rarityClass = (r: RelicDraftRarity): string => {
    switch (r) {
        case 'common':
            return styles.card_common;
        case 'uncommon':
            return styles.card_uncommon;
        case 'rare':
            return styles.card_rare;
        default:
            return styles.card_common;
    }
};

const impactChipToneByLabel: Record<string, string> = {
    Action: 'action',
    Risk: 'risk',
    Info: 'info',
    Guard: 'guard',
    Cashout: 'cashout',
    Momentum: 'momentum',
    Draft: 'draft'
};

const relicImpactChipBeatCount = (label: string): 1 | 2 | 3 | 4 => {
    const tone = impactChipToneByLabel[label] ?? 'neutral';
    if (tone === 'cashout' || tone === 'momentum') {
        return 4;
    }
    if (tone === 'guard' || tone === 'action' || tone === 'risk') {
        return 3;
    }
    if (tone === 'draft') {
        return 2;
    }
    return 1;
};

const formatRelicSignalLabel = (
    label: string,
    rows: readonly { detail?: string; label: string; value?: string }[]
): string => {
    const rowCopy = rows
        .map((row) => `${row.label}${row.value ? `: ${row.value}` : ''}${row.detail ? `. ${row.detail}` : ''}`)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const sentencePart = (value: string): string => value.replace(/[.]+$/g, '');

type RelicDraftPayoffBurst = {
    label: 'Stack burst' | 'Draft burst' | 'Relic burst';
    value: string;
    tier: 'stack' | 'rare' | 'new';
};

type RelicDraftNextFloorCue = {
    label: 'Next floor' | 'Build plan' | 'Draft plan';
    value: string;
    tone: 'stack' | 'route' | 'rare' | 'new';
};

type RelicDraftBoardMoment = {
    label: 'Board moment';
    value: string;
    tone: 'chain' | 'control' | 'guard' | 'scout' | 'cashout';
};
type RelicDraftPickPulse = {
    detail: string;
    label: 'Pick pulse';
    tone: 'stack' | 'chain' | 'cashout' | 'guard' | 'route' | 'rare' | 'new';
    value: string;
};
type RelicDraftPickAction = {
    detail: string;
    label: 'Pick action';
    tone: 'stack' | 'chain' | 'cashout' | 'guard' | 'route' | 'rare' | 'new';
    value: string;
};
type RelicDraftChoiceHeat = {
    detail: string;
    label: 'Choice heat';
    tier: 'hot' | 'live' | 'rare' | 'setup';
    value: 'Hot stack' | 'Live payoff' | 'Rare anchor' | 'Route prime' | 'New lane';
};
type RelicDraftChoiceCrescendo = {
    beatCount: 2 | 3 | 4 | 5;
    detail: string;
    label: 'Prime beat' | 'Cashout beat' | 'Stack burst' | 'Rare burst';
    screenCue: 'pulse' | 'snap' | 'burst' | 'super';
    tier: RelicChoiceCrescendoSfxTier;
};
type RelicDraftPickPlan = {
    first: string;
    keep: string;
    then: string;
    tone: RelicDraftPickAction['tone'];
};
type RelicEngineRecipeStep = {
    label: 'Pick' | 'Next' | 'Route' | 'Keep';
    value: string;
    tone: RelicDraftPickAction['tone'] | 'route' | 'keep';
};
type RelicDraftComboRouteTone = 'cashout' | 'chain' | 'control' | 'guard' | 'risk' | 'route' | 'scout';
type RelicDraftComboRoute = {
    action: string;
    beatCount: number;
    id: string;
    label: string;
    payoff: string;
    tone: RelicDraftComboRouteTone;
    traitKinds: TileTraitKind[];
};
type RelicServiceCue = {
    label: 'Service cue' | 'Blocked cue';
    value: string;
    tone: 'reroll' | 'ban' | 'upgrade' | 'blocked';
};
type RelicDraftLaneId = 'stack' | 'cashout' | 'guard' | 'chain' | 'route' | 'rare' | 'new';
type RelicDraftLaneMapEntry = {
    action: 'Stack now' | 'Cash out' | 'Protect run' | 'Keep chain' | 'Open route' | 'Anchor build' | 'Start lane';
    count: number;
    cue: string;
    id: RelicDraftLaneId;
    label: 'Stack' | 'Cash' | 'Guard' | 'Chain' | 'Route' | 'Rare' | 'New';
};

const RELIC_DRAFT_LANE_ORDER: RelicDraftLaneId[] = ['stack', 'cashout', 'guard', 'chain', 'route', 'rare', 'new'];

const RELIC_DRAFT_LANE_LABELS: Record<RelicDraftLaneId, RelicDraftLaneMapEntry['label']> = {
    cashout: 'Cash',
    chain: 'Chain',
    guard: 'Guard',
    new: 'New',
    rare: 'Rare',
    route: 'Route',
    stack: 'Stack'
};

const RELIC_DRAFT_LANE_ACTIONS: Record<RelicDraftLaneId, RelicDraftLaneMapEntry['action']> = {
    cashout: 'Cash out',
    chain: 'Keep chain',
    guard: 'Protect run',
    new: 'Start lane',
    rare: 'Anchor build',
    route: 'Open route',
    stack: 'Stack now'
};

const getRelicDraftBoardMoment = (
    impactLabels: readonly string[],
    nextFloorCue: RelicDraftNextFloorCue,
    traitBuildLabel?: string
): RelicDraftBoardMoment => {
    if (impactLabels.includes('Momentum')) {
        return { label: 'Board moment', value: 'Chain stays live', tone: 'chain' };
    }
    if (impactLabels.includes('Cashout')) {
        return { label: 'Board moment', value: 'Cashout route', tone: 'cashout' };
    }
    if (impactLabels.includes('Guard')) {
        return { label: 'Board moment', value: 'Mistake shield', tone: 'guard' };
    }
    if (impactLabels.includes('Info')) {
        return { label: 'Board moment', value: traitBuildLabel ? 'Read combo lane' : 'Scout hidden pair', tone: 'scout' };
    }
    return { label: 'Board moment', value: nextFloorCue.value, tone: 'control' };
};

const getRelicDraftPayoffBurst = ({
    primaryBuildCount,
    primaryBuildLabel,
    rarity,
    traitBuildLabel
}: {
    primaryBuildCount: number;
    primaryBuildLabel?: string;
    rarity: RelicDraftRarity;
    traitBuildLabel?: string;
}): RelicDraftPayoffBurst => {
    if (primaryBuildCount > 0 && primaryBuildLabel) {
        return {
            label: 'Stack burst',
            value: `x${primaryBuildCount + 1} ${primaryBuildLabel}`,
            tier: 'stack'
        };
    }
    if (rarity === 'rare') {
        return {
            label: 'Draft burst',
            value: 'Rare pick',
            tier: 'rare'
        };
    }
    return {
        label: traitBuildLabel ? 'Stack burst' : 'Relic burst',
        value: traitBuildLabel ?? 'New lane',
        tier: 'new'
    };
};

const getRelicDraftPickPulse = ({
    boardMoment,
    nextFloorCue,
    primaryBuildCount,
    primaryBuildLabel,
    rarity,
    traitBuildLabel
}: {
    boardMoment: RelicDraftBoardMoment;
    nextFloorCue: RelicDraftNextFloorCue;
    primaryBuildCount: number;
    primaryBuildLabel?: string;
    rarity: RelicDraftRarity;
    traitBuildLabel?: string;
}): RelicDraftPickPulse => {
    if (primaryBuildCount > 0 && primaryBuildLabel) {
        return {
            detail: `Current build becomes x${primaryBuildCount + 1}`,
            label: 'Pick pulse',
            tone: 'stack',
            value: `Stack ${primaryBuildLabel}`
        };
    }
    if (boardMoment.tone === 'chain') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick pulse',
            tone: 'chain',
            value: 'Keep chain alive'
        };
    }
    if (boardMoment.tone === 'cashout') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick pulse',
            tone: 'cashout',
            value: 'Cashout route'
        };
    }
    if (boardMoment.tone === 'guard') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick pulse',
            tone: 'guard',
            value: 'Mistake buffer'
        };
    }
    if (traitBuildLabel) {
        return {
            detail: nextFloorCue.value,
            label: 'Pick pulse',
            tone: 'route',
            value: `Open ${traitBuildLabel}`
        };
    }
    if (rarity === 'rare') {
        return {
            detail: 'High ceiling pick',
            label: 'Pick pulse',
            tone: 'rare',
            value: 'Anchor rare'
        };
    }
    return {
        detail: nextFloorCue.value,
        label: 'Pick pulse',
        tone: 'new',
        value: 'New lane'
    };
};

const getRelicDraftPickAction = ({
    boardMoment,
    nextFloorCue,
    primaryBuildCount,
    primaryBuildLabel,
    rarity,
    traitBuildLabel
}: {
    boardMoment: RelicDraftBoardMoment;
    nextFloorCue: RelicDraftNextFloorCue;
    primaryBuildCount: number;
    primaryBuildLabel?: string;
    rarity: RelicDraftRarity;
    traitBuildLabel?: string;
}): RelicDraftPickAction => {
    if (primaryBuildCount > 0 && primaryBuildLabel) {
        return {
            detail: `Feed ${primaryBuildLabel}`,
            label: 'Pick action',
            tone: 'stack',
            value: `Stack x${primaryBuildCount + 1}`
        };
    }
    if (boardMoment.tone === 'cashout') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick action',
            tone: 'cashout',
            value: 'Cashout'
        };
    }
    if (boardMoment.tone === 'chain') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick action',
            tone: 'chain',
            value: 'Keep chain'
        };
    }
    if (boardMoment.tone === 'guard') {
        return {
            detail: nextFloorCue.value,
            label: 'Pick action',
            tone: 'guard',
            value: 'Add guard'
        };
    }
    if (traitBuildLabel) {
        return {
            detail: `Opens ${traitBuildLabel}`,
            label: 'Pick action',
            tone: 'route',
            value: 'Open route'
        };
    }
    if (rarity === 'rare') {
        return {
            detail: 'High ceiling pick',
            label: 'Pick action',
            tone: 'rare',
            value: 'Anchor rare'
        };
    }
    return {
        detail: nextFloorCue.value,
        label: 'Pick action',
        tone: 'new',
        value: 'Try lane'
    };
};

const visibleRelicPickActionLabel = (pickAction: RelicDraftPickAction): 'Take' | 'Lock' => {
    if (pickAction.tone === 'stack' || pickAction.tone === 'cashout' || pickAction.tone === 'chain') {
        return 'Lock';
    }
    return 'Take';
};

const getRelicDraftChoiceHeat = ({
    boardMoment,
    primaryBuildCount,
    primaryBuildLabel,
    rarity,
    traitBuildLabel
}: {
    boardMoment: RelicDraftBoardMoment;
    primaryBuildCount: number;
    primaryBuildLabel?: string;
    rarity: RelicDraftRarity;
    traitBuildLabel?: string;
}): RelicDraftChoiceHeat => {
    if (primaryBuildCount > 0 && primaryBuildLabel) {
        return {
            detail: `Feeds your existing ${primaryBuildLabel} lane to x${primaryBuildCount + 1}`,
            label: 'Choice heat',
            tier: 'hot',
            value: 'Hot stack'
        };
    }
    if (boardMoment.tone === 'chain' || boardMoment.tone === 'cashout' || boardMoment.tone === 'guard') {
        return {
            detail: boardMoment.value,
            label: 'Choice heat',
            tier: 'live',
            value: 'Live payoff'
        };
    }
    if (rarity === 'rare') {
        return {
            detail: 'High ceiling pick with a rarer lane',
            label: 'Choice heat',
            tier: 'rare',
            value: 'Rare anchor'
        };
    }
    return {
        detail: traitBuildLabel ? `Opens ${traitBuildLabel}` : 'Adds a new draft lane',
        label: 'Choice heat',
        tier: 'setup',
        value: traitBuildLabel ? 'Route prime' : 'New lane'
    };
};

const getRelicDraftChoiceCrescendo = ({
    choiceHeat,
    pickPulse
}: {
    choiceHeat: RelicDraftChoiceHeat;
    pickPulse: RelicDraftPickPulse;
}): RelicDraftChoiceCrescendo => {
    if (choiceHeat.tier === 'hot') {
        return {
            beatCount: 4,
            detail: pickPulse.detail,
            label: 'Stack burst',
            screenCue: 'burst',
            tier: 'stack'
        };
    }
    if (choiceHeat.tier === 'live') {
        return {
            beatCount: 3,
            detail: pickPulse.detail,
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        };
    }
    if (choiceHeat.tier === 'rare') {
        return {
            beatCount: 5,
            detail: 'Rare anchor changes the next build route',
            label: 'Rare burst',
            screenCue: 'super',
            tier: 'rare'
        };
    }
    return {
        beatCount: 2,
        detail: pickPulse.detail,
        label: 'Prime beat',
        screenCue: 'pulse',
        tier: 'prime'
    };
};

const getRelicDraftNextFloorCue = ({
    decisionVerb,
    primaryBuildCount,
    rarity,
    traitDecision
}: {
    decisionVerb?: string;
    primaryBuildCount: number;
    rarity: RelicDraftRarity;
    traitDecision?: string;
}): RelicDraftNextFloorCue => {
    if (primaryBuildCount > 0 && decisionVerb) {
        return {
            label: 'Next floor',
            value: `${decisionVerb} x${primaryBuildCount + 1} lane`,
            tone: 'stack'
        };
    }
    if (traitDecision) {
        return {
            label: 'Build plan',
            value: traitDecision,
            tone: 'route'
        };
    }
    if (rarity === 'rare') {
        return {
            label: 'Draft plan',
            value: 'Anchor rare burst',
            tone: 'rare'
        };
    }
    return {
        label: 'Next floor',
        value: decisionVerb ? `${decisionVerb} new lane` : 'Try new lane',
        tone: 'new'
    };
};

const getRelicDraftPickPlan = ({
    boardMoment,
    nextFloorCue,
    pickAction,
    pickPulse
}: {
    boardMoment: RelicDraftBoardMoment;
    nextFloorCue: RelicDraftNextFloorCue;
    pickAction: RelicDraftPickAction;
    pickPulse: RelicDraftPickPulse;
}): RelicDraftPickPlan => {
    const keep =
        boardMoment.tone === 'chain'
            ? 'Keep: chain alive'
            : boardMoment.tone === 'cashout'
              ? 'Keep: cashout lane visible'
              : boardMoment.tone === 'guard'
                ? 'Keep: mistake buffer ready'
                : boardMoment.tone === 'scout'
                  ? 'Keep: readable pairs open'
                  : `Keep: ${boardMoment.value}`;

    return {
        first: `First: ${pickAction.value}`,
        keep,
        then: `Then: ${nextFloorCue.value || pickPulse.detail}`,
        tone: pickAction.tone
    };
};

const getRelicServiceCue = (service: RelicOfferServiceAction | RelicOfferServiceState): RelicServiceCue => {
    if (!service.available) {
        return {
            label: 'Blocked cue',
            value: service.unavailableReason ?? 'Service unavailable',
            tone: 'blocked'
        };
    }
    if (service.serviceId === 'reroll_offer') {
        return {
            label: 'Service cue',
            value: 'Use when no relic feeds your current payoffs',
            tone: 'reroll'
        };
    }
    if (service.serviceId === 'ban_option') {
        return {
            label: 'Service cue',
            value: 'Remove the weakest lane before choosing',
            tone: 'ban'
        };
    }
    return {
        label: 'Service cue',
        value: 'Raise the ceiling before locking a pick',
        tone: 'upgrade'
    };
};

const getRelicDraftLaneId = (
    relicId: RelicId,
    currentBuildCountByArchetype: ReadonlyMap<string, number>
): RelicDraftLaneId => {
    const primaryArchetype = getRelicBuildArchetypes(relicId)[0] ?? null;
    if (primaryArchetype && (currentBuildCountByArchetype.get(primaryArchetype) ?? 0) > 0) {
        return 'stack';
    }
    const impactLabels = getRelicDecisionImpactLabels(relicId);
    if (impactLabels.includes('Cashout')) {
        return 'cashout';
    }
    if (impactLabels.includes('Guard')) {
        return 'guard';
    }
    if (impactLabels.includes('Momentum')) {
        return 'chain';
    }
    if (getTraitBuildRewardRowsForRelic(relicId).length > 0) {
        return 'route';
    }
    return getRelicDraftRow(relicId).rarity === 'rare' ? 'rare' : 'new';
};

const getRelicDraftLaneCue = (laneId: RelicDraftLaneId, relicId: RelicId): string => {
    if (laneId === 'stack') {
        return 'Best fit';
    }
    if (laneId === 'route') {
        return getTraitBuildRewardRowsForRelic(relicId)[0]?.label ?? 'Trait route';
    }
    if (laneId === 'rare') {
        return 'Rare anchor';
    }
    if (laneId === 'new') {
        return 'New lane';
    }
    return RELIC_DRAFT_LANE_LABELS[laneId];
};

const buildRelicDraftLaneMap = (
    relicIds: readonly RelicId[],
    currentBuildCountByArchetype: ReadonlyMap<string, number>
): RelicDraftLaneMapEntry[] => {
    const laneState = new Map<RelicDraftLaneId, { count: number; cue: string }>();
    relicIds.forEach((relicId) => {
        const laneId = getRelicDraftLaneId(relicId, currentBuildCountByArchetype);
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: getRelicDraftLaneCue(laneId, relicId) });
    });

    return RELIC_DRAFT_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state
            ? [
                  {
                      action: RELIC_DRAFT_LANE_ACTIONS[id],
                      count: state.count,
                      cue: state.cue,
                      id,
                      label: RELIC_DRAFT_LANE_LABELS[id]
                  }
              ]
            : [];
    });
};

const relicDraftLaneMapAttr = (laneMap: readonly Pick<RelicDraftLaneMapEntry, 'count' | 'id'>[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

const relicDraftLaneActionMapAttr = (
    laneMap: readonly Pick<RelicDraftLaneMapEntry, 'action' | 'count' | 'id'>[]
): string => (laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none');

const relicDraftLaneRole = (
    lane: Pick<RelicDraftLaneMapEntry, 'id'>
): 'Cashout' | 'Guard' | 'New' | 'Rare' | 'Route' | 'Stack' => {
    switch (lane.id) {
        case 'cashout':
            return 'Cashout';
        case 'guard':
            return 'Guard';
        case 'route':
        case 'chain':
            return 'Route';
        case 'rare':
            return 'Rare';
        case 'new':
            return 'New';
        case 'stack':
        default:
            return 'Stack';
    }
};

const relicDraftLaneMapLabel = (
    laneMap: readonly Pick<RelicDraftLaneMapEntry, 'action' | 'count' | 'cue' | 'id' | 'label'>[]
): string =>
    laneMap.length > 0
        ? `Relic draft lane map. ${laneMap.map((lane) => `${lane.label} ${relicDraftLaneRole(lane)} x${lane.count}. ${lane.action}. ${lane.cue}.`).join(' ')}`
        : 'Relic draft lane map';

const getRelicDraftLaneBeatCount = (lane: Pick<RelicDraftLaneMapEntry, 'count' | 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'stack' || lane.id === 'cashout' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'chain' || lane.id === 'guard' || lane.id === 'rare' || lane.id === 'route') {
        return 3;
    }
    return 2;
};

const relicDraftLaneAudioCue = (
    lane: Pick<RelicDraftLaneMapEntry, 'id'>
):
    | 'relic-draft-lane-stack'
    | 'relic-draft-lane-cashout'
    | 'relic-draft-lane-guard'
    | 'relic-draft-lane-chain'
    | 'relic-draft-lane-route'
    | 'relic-draft-lane-rare'
    | 'relic-draft-lane-new' => {
    switch (lane.id) {
        case 'stack':
            return 'relic-draft-lane-stack';
        case 'cashout':
            return 'relic-draft-lane-cashout';
        case 'guard':
            return 'relic-draft-lane-guard';
        case 'chain':
            return 'relic-draft-lane-chain';
        case 'route':
            return 'relic-draft-lane-route';
        case 'rare':
            return 'relic-draft-lane-rare';
        default:
            return 'relic-draft-lane-new';
    }
};

const relicDraftLaneScreenCue = (
    lane: Pick<RelicDraftLaneMapEntry, 'count' | 'id'>
): 'burst' | 'cashout' | 'guard' | 'chain' | 'route' | 'rare' | 'pulse' => {
    if (lane.count > 1 || lane.id === 'stack') {
        return 'burst';
    }
    if (lane.id === 'cashout') {
        return 'cashout';
    }
    if (lane.id === 'guard') {
        return 'guard';
    }
    if (lane.id === 'chain') {
        return 'chain';
    }
    if (lane.id === 'route') {
        return 'route';
    }
    if (lane.id === 'rare') {
        return 'rare';
    }
    return 'pulse';
};

const getRelicEngineRecipeSteps = ({
    boardMoment,
    nextFloorCue,
    pickAction,
    primaryBuildLabel,
    traitBuildLabel
}: {
    boardMoment: RelicDraftBoardMoment;
    nextFloorCue: RelicDraftNextFloorCue;
    pickAction: RelicDraftPickAction;
    primaryBuildLabel?: string;
    traitBuildLabel?: string;
}): RelicEngineRecipeStep[] => [
    { label: 'Pick', value: pickAction.value, tone: pickAction.tone },
    { label: 'Next', value: nextFloorCue.value, tone: nextFloorCue.tone === 'route' ? 'route' : pickAction.tone },
    {
        label: 'Route',
        value: traitBuildLabel ?? primaryBuildLabel ?? boardMoment.value,
        tone: traitBuildLabel ? 'route' : pickAction.tone
    },
    { label: 'Keep', value: boardMoment.value, tone: 'keep' }
];

const tileTraitKindLabel = (traitKind: TileTraitKind): string =>
    traitKind
        .split('_')
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' ');

const relicDraftComboRouteTone = (traitKinds: readonly TileTraitKind[]): RelicDraftComboRouteTone => {
    if (traitKinds.includes('cursed')) {
        return 'risk';
    }
    if (traitKinds.includes('stasis')) {
        return 'control';
    }
    if (traitKinds.includes('mirror')) {
        return 'guard';
    }
    if (traitKinds.includes('conduit')) {
        return 'scout';
    }
    if (traitKinds.includes('drift')) {
        return 'route';
    }
    if (traitKinds.includes('echo') || traitKinds.includes('heavy')) {
        return 'chain';
    }
    return 'cashout';
};

const getRelicDraftComboRoutes = (
    traitBuildRows: readonly ReturnType<typeof getTraitBuildRewardRowsForRelic>[number][]
): RelicDraftComboRoute[] =>
    traitBuildRows.map((buildRow) => ({
        action: buildRow.decision,
        beatCount: Math.max(2, buildRow.traitKinds.length + 1),
        id: buildRow.id,
        label: buildRow.label,
        payoff: buildRow.payoff,
        tone: relicDraftComboRouteTone(buildRow.traitKinds),
        traitKinds: [...buildRow.traitKinds]
    }));

const relicDraftComboRouteAttr = (comboRoutes: readonly RelicDraftComboRoute[]): string =>
    comboRoutes.length > 0
        ? comboRoutes.map((route) => `${route.id}:${route.traitKinds.join('+')}:${route.tone}`).join('>')
        : 'none';

const relicDraftComboRouteLabel = (comboRoutes: readonly RelicDraftComboRoute[]): string =>
    comboRoutes.length > 0
        ? `Combo routes: ${comboRoutes
              .map(
                  (route) =>
                      `${route.label}. Traits: ${route.traitKinds.map(tileTraitKindLabel).join(' into ')}. Payoff: ${route.payoff}. Play: ${route.action}.`
              )
              .join(' ')}`
        : '';

const parseLiveLaneCount = (value: string): number => {
    const match = value.match(/\b(\d+)\s+(?:payoffs?|lanes?)\s+live\b/i);
    return match?.[1] ? Number.parseInt(match[1], 10) : 0;
};

interface RelicDraftOfferPanelProps {
    optionIds: RelicId[];
    currentRelicIds?: readonly RelicId[];
    descriptionById: Record<RelicId, string>;
    reasonById?: Partial<Record<RelicId, string>>;
    onPick: (id: RelicId) => void;
    serviceActions?: (RelicOfferServiceAction | RelicOfferServiceState)[];
    onUseService?: (serviceId: RelicOfferServiceAction['serviceId'], targetRelicId?: RelicId) => void;
    payoffEngineSignal?: {
        label: 'Payoff engine' | 'Prime payoff' | 'Super stack';
        value: string;
        detail: string;
        nextCue: string;
        tone: 'burst' | 'setup' | 'super';
    } | null;
    /** Advances when options reroll mid-visit (multi-pick). */
    pickRound: number;
    sfxGain?: number;
}

const getPayoffEnginePresentation = (
    signal: NonNullable<RelicDraftOfferPanelProps['payoffEngineSignal']>
): {
    label: 'Payoff engine' | 'Prime payoff' | 'Super stack';
    tone: 'burst' | 'setup' | 'super';
} => {
    if (parseLiveLaneCount(signal.value) >= 4) {
        return { label: 'Super stack', tone: 'super' };
    }
    return { label: signal.label, tone: signal.tone };
};

const relicDraftPayoffEngineBeatCount = (tone: ReturnType<typeof getPayoffEnginePresentation>['tone']): 2 | 4 | 5 => {
    if (tone === 'super') {
        return 5;
    }
    if (tone === 'burst') {
        return 4;
    }
    return 2;
};

const relicDraftPayoffEngineAction = (
    tone: ReturnType<typeof getPayoffEnginePresentation>['tone']
): 'Push relic stack' | 'Prime relic route' | 'Pick relic' => {
    if (tone === 'super') {
        return 'Push relic stack';
    }
    if (tone === 'burst') {
        return 'Prime relic route';
    }
    return 'Pick relic';
};

const relicDraftPayoffEngineAudioCue = (
    tone: ReturnType<typeof getPayoffEnginePresentation>['tone']
): 'relic-payoff-super' | 'relic-payoff-burst' | 'relic-payoff-setup' => {
    if (tone === 'super') {
        return 'relic-payoff-super';
    }
    if (tone === 'burst') {
        return 'relic-payoff-burst';
    }
    return 'relic-payoff-setup';
};

const relicDraftPayoffEngineScreenCue = (tone: ReturnType<typeof getPayoffEnginePresentation>['tone']): 'super' | 'burst' | 'pulse' => {
    if (tone === 'super') {
        return 'super';
    }
    if (tone === 'burst') {
        return 'burst';
    }
    return 'pulse';
};

const relicDraftChoiceCrescendoAction = (
    crescendo: RelicDraftChoiceCrescendo
): 'Prime route' | 'Cash payoff' | 'Stack build' | 'Anchor rare' => {
    if (crescendo.tier === 'stack') {
        return 'Stack build';
    }
    if (crescendo.tier === 'cashout') {
        return 'Cash payoff';
    }
    if (crescendo.tier === 'rare') {
        return 'Anchor rare';
    }
    return 'Prime route';
};

const relicDraftChoiceCrescendoAudioCue = (
    crescendo: RelicDraftChoiceCrescendo
): 'relic-crescendo-prime' | 'relic-crescendo-cashout' | 'relic-crescendo-stack' | 'relic-crescendo-rare' => {
    if (crescendo.tier === 'stack') {
        return 'relic-crescendo-stack';
    }
    if (crescendo.tier === 'cashout') {
        return 'relic-crescendo-cashout';
    }
    if (crescendo.tier === 'rare') {
        return 'relic-crescendo-rare';
    }
    return 'relic-crescendo-prime';
};

const relicBuildFitSignalBeatCount = (tone: 'stack' | 'new' | 'play' | 'route'): 2 | 3 | 4 => {
    if (tone === 'stack' || tone === 'route') {
        return 4;
    }
    if (tone === 'play') {
        return 3;
    }
    return 2;
};

const relicBuildFitSignalAction = (tone: 'stack' | 'new' | 'play' | 'route'): 'Stack build' | 'Start lane' | 'Play next' | 'Open route' => {
    if (tone === 'stack') {
        return 'Stack build';
    }
    if (tone === 'play') {
        return 'Play next';
    }
    if (tone === 'route') {
        return 'Open route';
    }
    return 'Start lane';
};

const relicBuildFitSignalAudioCue = (
    tone: 'stack' | 'new' | 'play' | 'route'
): 'relic-fit-stack' | 'relic-fit-new' | 'relic-fit-play' | 'relic-fit-route' => {
    if (tone === 'stack') {
        return 'relic-fit-stack';
    }
    if (tone === 'play') {
        return 'relic-fit-play';
    }
    if (tone === 'route') {
        return 'relic-fit-route';
    }
    return 'relic-fit-new';
};

const relicBuildFitSignalScreenCue = (tone: 'stack' | 'new' | 'play' | 'route'): 'burst' | 'pulse' | 'snap' => {
    if (tone === 'stack' || tone === 'route') {
        return 'burst';
    }
    if (tone === 'play') {
        return 'snap';
    }
    return 'pulse';
};

const RelicDraftOfferPanel = ({
    optionIds,
    currentRelicIds = [],
    descriptionById,
    reasonById,
    onPick,
    payoffEngineSignal = null,
    serviceActions: rawServiceActions = [],
    onUseService,
    pickRound,
    sfxGain = 0
}: RelicDraftOfferPanelProps) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const prevPickRoundRef = useRef<number | null>(null);
    const choiceCrescendoSfxSignatureRef = useRef<string | null>(null);
    const [politeMessage, setPoliteMessage] = useState('');
    const serviceActions = rawServiceActions.map((service) => ({
        ...service,
        effectPreview:
            service.serviceId === 'reroll_offer'
                ? 'Fresh choices'
                : service.serviceId === 'ban_option'
                  ? 'Remove one option'
                  : 'Favor rare picks'
    }));
    const currentBuildCountByArchetype = useMemo(() => {
        const counts = new Map<string, number>();
        for (const relicId of currentRelicIds) {
            for (const archetype of getRelicBuildArchetypes(relicId)) {
                counts.set(archetype, (counts.get(archetype) ?? 0) + 1);
            }
        }
        return counts;
    }, [currentRelicIds]);
    const draftLaneMap = buildRelicDraftLaneMap(optionIds, currentBuildCountByArchetype);
    const primaryDraftLane = draftLaneMap[0] ?? null;
    const draftLaneMapAttr = relicDraftLaneMapAttr(draftLaneMap);
    const draftLaneActionMapAttr = relicDraftLaneActionMapAttr(draftLaneMap);
    const draftLaneMapAccessibleLabel = relicDraftLaneMapLabel(draftLaneMap);

    useEffect(() => {
        const prev = prevPickRoundRef.current;
        if (prev === null) {
            prevPickRoundRef.current = pickRound;
            return undefined;
        }
        prevPickRoundRef.current = pickRound;
        if (pickRound <= prev) {
            return undefined;
        }
        const msg = relicDraftRoundAdvancedAnnouncement();
        queueMicrotask(() => {
            setPoliteMessage(msg);
        });
        const clearId = window.setTimeout(() => {
            setPoliteMessage('');
        }, 1500);
        return () => {
            window.clearTimeout(clearId);
        };
    }, [pickRound]);

    const optionIdsKey = optionIds.join(',');

    const playChoiceCrescendo = useCallback(
        (relicId: RelicId, crescendo: RelicDraftChoiceCrescendo): void => {
            const signature = `${pickRound}:${relicId}:${crescendo.tier}:${crescendo.beatCount}`;
            if (choiceCrescendoSfxSignatureRef.current === signature) {
                return;
            }
            choiceCrescendoSfxSignatureRef.current = signature;
            resumeAudioContext();
            playRelicChoiceCrescendoSfx(sfxGain, crescendo.tier, crescendo.beatCount);
        },
        [pickRound, sfxGain]
    );

    useEffect(() => {
        const id = window.requestAnimationFrame(() => {
            gridRef.current?.querySelector('button')?.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [optionIdsKey, pickRound]);

    const moveFocus = useCallback((delta: number): void => {
        const root = gridRef.current;
        if (!root) {
            return;
        }
        const buttons = [...root.querySelectorAll('button')] as HTMLButtonElement[];
        if (buttons.length === 0) {
            return;
        }
        const active = document.activeElement;
        let idx = buttons.indexOf(active as HTMLButtonElement);
        if (idx < 0) {
            idx = 0;
        } else {
            idx = (idx + delta + buttons.length) % buttons.length;
        }
        buttons[idx]?.focus();
    }, []);

    const onGridKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>): void => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const root = gridRef.current;
            const buttons = root ? ([...root.querySelectorAll('button')] as HTMLButtonElement[]) : [];

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                event.stopPropagation();
                moveFocus(1);
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                event.stopPropagation();
                moveFocus(-1);
                return;
            }
            if (event.key === 'Home' && buttons.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                buttons[0]?.focus();
                return;
            }
            if (event.key === 'End' && buttons.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                buttons[buttons.length - 1]?.focus();
            }
        },
        [moveFocus]
    );

    return (
        <div className={styles.panelRoot}>
            <div aria-live="polite" className={styles.liveRegion} role="status">
                {politeMessage}
            </div>
            {payoffEngineSignal
                ? (() => {
                      const payoffEnginePresentation = getPayoffEnginePresentation(payoffEngineSignal);
                      const payoffEngineBeatCount = relicDraftPayoffEngineBeatCount(payoffEnginePresentation.tone);
                      const payoffEngineAction = relicDraftPayoffEngineAction(payoffEnginePresentation.tone);
                      return (
                          <div
                              aria-label={`Relic draft payoff engine. ${payoffEnginePresentation.label}: ${payoffEngineAction}. ${payoffEngineSignal.value}. ${payoffEngineSignal.detail}. ${payoffEngineSignal.nextCue}.`}
                              className={styles.payoffEngineStrip}
                              data-relic-payoff-engine-action={payoffEngineAction}
                              data-relic-payoff-engine-audio={relicDraftPayoffEngineAudioCue(payoffEnginePresentation.tone)}
                              data-relic-payoff-engine-beats={payoffEngineBeatCount}
                              data-relic-payoff-engine-label={payoffEnginePresentation.label}
                              data-relic-payoff-engine-screen-cue={relicDraftPayoffEngineScreenCue(payoffEnginePresentation.tone)}
                              data-relic-payoff-engine-tone={payoffEnginePresentation.tone}
                              data-testid="relic-draft-payoff-engine"
                          >
                              <span>
                                  <small>{payoffEnginePresentation.label}</small>
                                  <strong>{payoffEngineSignal.value}</strong>
                              </span>
                              <span>
                                  <small>Live payoffs</small>
                                  <strong>{payoffEngineSignal.detail}</strong>
                              </span>
                              <span>
                                  <small>Pick should feed</small>
                                  <strong>{payoffEngineSignal.nextCue}</strong>
                              </span>
                              <div aria-hidden="true" className={styles.payoffEngineBeatPips}>
                                  {Array.from({ length: payoffEngineBeatCount }, (_, beatIndex) => (
                                      <i
                                          data-relic-payoff-engine-beat={beatIndex + 1}
                                          data-relic-payoff-engine-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                          key={beatIndex}
                                      />
                                  ))}
                              </div>
                          </div>
                      );
                  })()
                : null}
            {draftLaneMap.length > 1 ? (
                <div
                    aria-label={draftLaneMapAccessibleLabel}
                    className={styles.draftLaneMap}
                    data-relic-draft-lane-actions={draftLaneActionMapAttr}
                    data-relic-draft-lane-map={draftLaneMapAttr}
                    data-relic-draft-primary-lane={primaryDraftLane?.id ?? 'none'}
                    data-relic-draft-primary-lane-action={primaryDraftLane?.action ?? 'none'}
                    data-relic-draft-primary-lane-audio={
                        primaryDraftLane ? relicDraftLaneAudioCue(primaryDraftLane) : 'none'
                    }
                    data-relic-draft-primary-lane-beats={
                        primaryDraftLane ? getRelicDraftLaneBeatCount(primaryDraftLane) : 0
                    }
                    data-relic-draft-primary-lane-cue={primaryDraftLane?.cue ?? 'none'}
                    data-relic-draft-primary-lane-screen-cue={
                        primaryDraftLane ? relicDraftLaneScreenCue(primaryDraftLane) : 'none'
                    }
                    data-testid="relic-draft-lane-map"
                    role="group"
                >
                    {primaryDraftLane ? (
                        <span
                            aria-label={`Primary draft lane. ${primaryDraftLane.label}: ${primaryDraftLane.action}. ${primaryDraftLane.cue}. ${getRelicDraftLaneBeatCount(primaryDraftLane)} beats.`}
                            className={styles.draftLanePrimaryCue}
                            data-relic-draft-primary-lane={primaryDraftLane.id}
                            data-relic-draft-primary-lane-action={primaryDraftLane.action}
                            data-relic-draft-primary-lane-audio={relicDraftLaneAudioCue(primaryDraftLane)}
                            data-relic-draft-primary-lane-beats={getRelicDraftLaneBeatCount(primaryDraftLane)}
                            data-relic-draft-primary-lane-cue={primaryDraftLane.cue}
                            data-relic-draft-primary-lane-screen-cue={relicDraftLaneScreenCue(primaryDraftLane)}
                            data-testid="relic-draft-primary-lane"
                        >
                            <small>Best lane</small>
                            <strong>{primaryDraftLane.label}</strong>
                            <b>{primaryDraftLane.action}</b>
                            <em>{primaryDraftLane.cue}</em>
                            <span aria-hidden="true" className={styles.draftLanePrimaryBeatPips}>
                                {Array.from({ length: getRelicDraftLaneBeatCount(primaryDraftLane) }, (_, beatIndex) => (
                                    <i
                                        data-relic-draft-primary-lane-beat={beatIndex + 1}
                                        data-relic-draft-primary-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    {draftLaneMap.map((lane) => (
                        <span
                            data-relic-draft-lane={lane.id}
                            data-relic-draft-lane-action={lane.action}
                            data-relic-draft-lane-audio={relicDraftLaneAudioCue(lane)}
                            data-relic-draft-lane-beats={getRelicDraftLaneBeatCount(lane)}
                            data-relic-draft-lane-count={lane.count}
                            data-relic-draft-lane-screen-cue={relicDraftLaneScreenCue(lane)}
                            key={lane.id}
                        >
                            <small>{lane.label}</small>
                            <strong>{lane.count}</strong>
                            <b>{lane.action}</b>
                            <em>{lane.cue}</em>
                            <span aria-hidden="true" className={styles.draftLaneBeatPips}>
                                {Array.from({ length: getRelicDraftLaneBeatCount(lane) }, (_, beatIndex) => (
                                    <i
                                        data-relic-draft-lane-beat={beatIndex + 1}
                                        data-relic-draft-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </div>
            ) : null}
            <div
                className={styles.grid}
                onKeyDown={onGridKeyDown}
                ref={gridRef}
                role="group"
                aria-label="Relic choices"
            >
                {optionIds.map((id, index) => {
                    const row = getRelicDraftRow(id);
                    const relicTitle = RELIC_CATALOG[id]?.title ?? id;
                    const desc = descriptionById[id] ?? id;
                    const reason = reasonById?.[id];
                    const archetypes = getRelicArchetypeLabels(id);
                    const primaryArchetype = getRelicBuildArchetypes(id)[0] ?? null;
                    const primaryBuildDefinition = primaryArchetype
                        ? getRelicBuildArchetypeDefinition(primaryArchetype)
                        : null;
                    const primaryBuildCount =
                        primaryArchetype == null
                            ? 0
                            : currentBuildCountByArchetype.get(primaryArchetype) ?? 0;
                    const impactCopy = getRelicDecisionImpactCopy(id);
                    const impactLabels = getRelicDecisionImpactLabels(id);
                    const traitBuildRows = getTraitBuildRewardRowsForRelic(id).slice(0, 2);
                    const comboRoutes = getRelicDraftComboRoutes(traitBuildRows);
                    const comboRouteAria = relicDraftComboRouteLabel(comboRoutes);
                    const comboRouteAttr = relicDraftComboRouteAttr(comboRoutes);
                    const traitBuildHint = getTraitBuildDraftHintForRelic(id);
                    const buildFitSignals =
                        primaryBuildDefinition != null
                            ? [
                                  {
                                      id: 'fit',
                                      label: primaryBuildCount > 0 ? 'Stack' : 'Lane',
                                      value: primaryBuildCount > 0 ? `x${primaryBuildCount + 1}` : 'New',
                                      tone: primaryBuildCount > 0 ? 'stack' : 'new'
                                  },
                                  {
                                      id: 'play',
                                      label: 'Play',
                                      value: primaryBuildDefinition.decisionVerbs[0] ?? 'shape',
                                      tone: 'play'
                                  },
                                  traitBuildRows[0]
                                      ? {
                                            id: 'route',
                                            label: 'Route',
                                            value: traitBuildRows[0].label,
                                            tone: 'route'
                                        }
                                      : null
                              ].filter(
                                  (
                                      signal
                                  ): signal is {
                                      id: string;
                                      label: string;
                                      value: string;
                                      tone: 'stack' | 'new' | 'play' | 'route';
                                  } => signal != null
                              )
                            : [];
                    const ariaTier = relicDraftRarityLabel(row.rarity);
                    const buildFitAria = buildFitSignals.length > 0
                        ? `Build fit: ${buildFitSignals.map((signal) => `${signal.label} ${signal.value}`).join(', ')}.`
                        : '';
                    const buildPlanAria = traitBuildRows.length > 0
                        ? `Trait payoff: ${traitBuildRows
                              .map((buildRow) => `${buildRow.label}: ${buildRow.payoff}. ${buildRow.decision}`)
                              .join(' ')}.`
                        : '';
                    const recommendationCopy =
                        primaryBuildDefinition && primaryBuildCount > 0
                            ? `Best fit: stacks your ${primaryBuildDefinition.label} lane to x${primaryBuildCount + 1}.`
                            : '';
                    const payoffBurst = getRelicDraftPayoffBurst({
                        primaryBuildCount,
                        primaryBuildLabel: primaryBuildDefinition?.label,
                        rarity: row.rarity,
                        traitBuildLabel: traitBuildRows[0]?.label
                    });
                    const nextFloorCue = getRelicDraftNextFloorCue({
                        decisionVerb: primaryBuildDefinition?.decisionVerbs[0],
                        primaryBuildCount,
                        rarity: row.rarity,
                        traitDecision: traitBuildRows[0]?.decision
                    });
                    const boardMoment = getRelicDraftBoardMoment(impactLabels, nextFloorCue, traitBuildRows[0]?.label);
                    const pickPulse = getRelicDraftPickPulse({
                        boardMoment,
                        nextFloorCue,
                        primaryBuildCount,
                        primaryBuildLabel: primaryBuildDefinition?.label,
                        rarity: row.rarity,
                        traitBuildLabel: traitBuildRows[0]?.label
                    });
                    const pickAction = getRelicDraftPickAction({
                        boardMoment,
                        nextFloorCue,
                        primaryBuildCount,
                        primaryBuildLabel: primaryBuildDefinition?.label,
                        rarity: row.rarity,
                        traitBuildLabel: traitBuildRows[0]?.label
                    });
                    const visiblePickActionLabel = visibleRelicPickActionLabel(pickAction);
                    const choiceHeat = getRelicDraftChoiceHeat({
                        boardMoment,
                        primaryBuildCount,
                        primaryBuildLabel: primaryBuildDefinition?.label,
                        rarity: row.rarity,
                        traitBuildLabel: traitBuildRows[0]?.label
                    });
                    const payoffBurstAria = `${payoffBurst.label}: ${payoffBurst.value}.`;
                    const nextFloorCueAria = `${nextFloorCue.label}: ${nextFloorCue.value}.`;
                    const boardMomentAria = `${boardMoment.label}: ${boardMoment.value}.`;
                    const pickPulseAria = `${pickPulse.label}: ${pickPulse.value}. ${pickPulse.detail}.`;
                    const pickActionAria = `${pickAction.label}: ${pickAction.value}. ${pickAction.detail}.`;
                    const choiceHeatAria = `${choiceHeat.label}: ${choiceHeat.value}. ${choiceHeat.detail}.`;
                    const choiceCrescendo = getRelicDraftChoiceCrescendo({ choiceHeat, pickPulse });
                    const choiceCrescendoAction = relicDraftChoiceCrescendoAction(choiceCrescendo);
                    const choiceCrescendoAria = `Choice crescendo: ${choiceCrescendoAction}. ${choiceCrescendo.label}. ${sentencePart(choiceCrescendo.detail)}. ${choiceCrescendo.beatCount} beats.`;
                    const pickPlan = getRelicDraftPickPlan({
                        boardMoment,
                        nextFloorCue,
                        pickAction,
                        pickPulse
                    });
                    const pickPlanAria = `Pick plan: ${sentencePart(pickPlan.first)}. ${sentencePart(
                        pickPlan.then
                    )}. ${sentencePart(pickPlan.keep)}.`;
                    const engineRecipeSteps = getRelicEngineRecipeSteps({
                        boardMoment,
                        nextFloorCue,
                        pickAction,
                        primaryBuildLabel: primaryBuildDefinition?.label,
                        traitBuildLabel: traitBuildRows[0]?.label
                    });
                    const engineRecipeValue = engineRecipeSteps.map((step) => step.value).join(' -> ');
                    const engineRecipeAria = `Engine recipe: ${engineRecipeSteps
                        .map((step) => `${step.label}: ${step.value}`)
                        .join('. ')}.`;
                    const impactChipsLabel = formatRelicSignalLabel(
                        `${relicTitle} impact chips`,
                        impactLabels.map((label) => ({ label }))
                    );
                    const buildFitSignalsLabel = formatRelicSignalLabel(
                        `${relicTitle} build fit signals`,
                        buildFitSignals.map((signal) => ({ label: signal.label, value: signal.value }))
                    );
                    const buildPlanRowsLabel = formatRelicSignalLabel(
                        `${relicTitle} trait payoff rows`,
                        traitBuildRows.map((buildRow) => ({
                            detail: buildRow.decision,
                            label: buildRow.label,
                            value: buildRow.payoff
                        }))
                    );
                    const staggerStyle: CSSProperties = {
                        '--relic-card-stagger': index
                    } as CSSProperties;
                    return (
                        <button
                            aria-label={`${ariaTier} relic: ${desc}. ${impactCopy}${traitBuildHint ? `. ${traitBuildHint}` : ''} ${choiceHeatAria}${choiceCrescendoAria}${payoffBurstAria}${nextFloorCueAria}${boardMomentAria}${pickActionAria}${pickPulseAria}${pickPlanAria}${engineRecipeAria}${comboRouteAria ? ` ${comboRouteAria}` : ''}${recommendationCopy ? ` ${recommendationCopy}` : ''}${buildFitAria ? ` ${buildFitAria}` : ''}${buildPlanAria ? ` ${buildPlanAria}` : ''}${reason ? `. ${reason}` : ''}`}
                            className={`${styles.card} ${rarityClass(row.rarity)}`}
                            data-relic-combo-routes={comboRouteAttr}
                            data-relic-choice-crescendo-action={choiceCrescendoAction}
                            data-relic-choice-crescendo-audio={relicDraftChoiceCrescendoAudioCue(choiceCrescendo)}
                            data-relic-choice-crescendo-beats={choiceCrescendo.beatCount}
                            data-relic-choice-crescendo-cue={choiceCrescendo.screenCue}
                            data-relic-choice-crescendo-screen-cue={choiceCrescendo.screenCue}
                            data-relic-choice-crescendo-tier={choiceCrescendo.tier}
                            data-relic-engine-recipe={engineRecipeValue}
                            data-relic-choice-heat={choiceHeat.tier}
                            data-relic-choice-heat-value={choiceHeat.value}
                            data-relic-pick-plan-first={pickPlan.first}
                            data-relic-pick-plan-keep={pickPlan.keep}
                            data-relic-pick-plan-then={pickPlan.then}
                            data-relic-pick-action={pickAction.value}
                            data-relic-pick-action-tone={pickAction.tone}
                            data-relic-recommendation={recommendationCopy ? 'best-fit' : 'standard'}
                            data-testid="relic-offer-card"
                            key={`${id}-${pickRound}`}
                            onFocus={() => playChoiceCrescendo(id, choiceCrescendo)}
                            onClick={() => onPick(id)}
                            onPointerEnter={() => playChoiceCrescendo(id, choiceCrescendo)}
                            style={staggerStyle}
                            type="button"
                        >
                            <span aria-hidden className={styles.runeStrip} />
                            {reason ? <span className={styles.reason}>{reason}</span> : null}
                            <span className={styles.rewardHeader}>
                                <strong>{relicTitle}</strong>
                                <small>{visiblePickActionLabel}</small>
                            </span>
                            <span
                                aria-label={pickActionAria}
                                className={styles.pickAction}
                                data-pick-action-tone={pickAction.tone}
                                data-visible-pick-action-label={visiblePickActionLabel}
                                data-testid="relic-pick-action"
                            >
                                <small>{visiblePickActionLabel}</small>
                                <strong>{pickAction.value}</strong>
                                <em>{pickAction.detail}</em>
                            </span>
                            <span
                                aria-label={pickPlanAria}
                                className={styles.pickPlan}
                                data-pick-plan-tone={pickPlan.tone}
                                data-testid="relic-pick-plan"
                            >
                                <span>{pickPlan.first}</span>
                                <span>{pickPlan.then}</span>
                                <span>{pickPlan.keep}</span>
                            </span>
                            <span
                                aria-label={engineRecipeAria}
                                className={styles.engineRecipe}
                                data-engine-recipe-tone={pickAction.tone}
                                data-testid="relic-engine-recipe"
                            >
                                {engineRecipeSteps.map((step) => (
                                    <span data-engine-recipe-step={step.label.toLowerCase()} data-engine-recipe-tone={step.tone} key={step.label}>
                                        <small>{step.label}</small>
                                        <strong>{step.value}</strong>
                                    </span>
                                ))}
                            </span>
                            {recommendationCopy ? (
                                <span
                                    aria-label={recommendationCopy}
                                    className={styles.recommendation}
                                    data-testid="relic-recommendation"
                                >
                                    <small>Best fit</small>
                                    <strong>x{primaryBuildCount + 1}</strong>
                                </span>
                            ) : null}
                            <span
                                aria-label={choiceHeatAria}
                                className={styles.choiceHeat}
                                data-choice-heat-tier={choiceHeat.tier}
                                data-testid="relic-choice-heat"
                            >
                                <small>{choiceHeat.label}</small>
                                <strong>{choiceHeat.value}</strong>
                                <em>{choiceHeat.detail}</em>
                            </span>
                            <span
                                aria-label={choiceCrescendoAria}
                                className={styles.choiceCrescendo}
                                data-choice-crescendo-action={choiceCrescendoAction}
                                data-choice-crescendo-audio={relicDraftChoiceCrescendoAudioCue(choiceCrescendo)}
                                data-choice-crescendo-screen-cue={choiceCrescendo.screenCue}
                                data-choice-crescendo-tier={choiceCrescendo.tier}
                                data-testid="relic-choice-crescendo"
                            >
                                <small>{choiceCrescendo.label}</small>
                                <strong>
                                    {Array.from({ length: choiceCrescendo.beatCount }, (_, beatIndex) => (
                                        <i aria-hidden="true" key={beatIndex} />
                                    ))}
                                </strong>
                                <em>{choiceCrescendo.detail}</em>
                                <b>{choiceCrescendoAction}</b>
                            </span>
                            <span
                                aria-label={payoffBurstAria}
                                className={styles.payoffBurst}
                                data-relic-payoff-tier={payoffBurst.tier}
                                data-testid="relic-payoff-burst"
                            >
                                <small>{payoffBurst.label}</small>
                                <strong>{payoffBurst.value}</strong>
                            </span>
                            <span
                                aria-label={nextFloorCueAria}
                                className={styles.nextFloorCue}
                                data-relic-next-floor-tone={nextFloorCue.tone}
                                data-testid="relic-next-floor-cue"
                            >
                                <small>{nextFloorCue.label}</small>
                                <strong>{nextFloorCue.value}</strong>
                            </span>
                            <span
                                aria-label={boardMomentAria}
                                className={styles.boardMomentCue}
                                data-board-moment-tone={boardMoment.tone}
                                data-testid="relic-board-moment-cue"
                            >
                                <small>{boardMoment.label}</small>
                                <strong>{boardMoment.value}</strong>
                            </span>
                            <span className={styles.archetypes}>{archetypes.join(' · ')}</span>
                            <span
                                aria-label={pickPulseAria}
                                className={styles.pickPulse}
                                data-pick-pulse-tone={pickPulse.tone}
                                data-testid="relic-pick-pulse"
                            >
                                <small>{pickPulse.label}</small>
                                <strong>{pickPulse.value}</strong>
                                <em>{pickPulse.detail}</em>
                            </span>
                            {impactLabels.length > 0 ? (
                                <span
                                    aria-label={impactChipsLabel}
                                    className={styles.impactChips}
                                    data-testid="relic-impact-chips"
                                >
                                    {impactLabels.map((label) => (
                                        <span
                                            data-impact-beats={relicImpactChipBeatCount(label)}
                                            data-impact-tone={impactChipToneByLabel[label] ?? 'neutral'}
                                            key={label}
                                        >
                                            {label}
                                            <span aria-hidden="true" className={styles.impactChipBeatPips}>
                                                {Array.from({ length: relicImpactChipBeatCount(label) }, (_, beatIndex) => (
                                                    <i
                                                        data-impact-chip-beat={beatIndex + 1}
                                                        data-impact-chip-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </span>
                            ) : null}
                            {primaryBuildDefinition ? (
                                <span
                                    aria-label={`${relicTitle} build lane. +1 ${primaryBuildDefinition.label} lane. Now x${primaryBuildCount + 1}. ${primaryBuildDefinition.decisionVerbs.slice(0, 3).join(', ')}.`}
                                    className={styles.buildPulse}
                                    data-build-lane-count={primaryBuildCount + 1}
                                    data-testid="relic-build-pulse"
                                >
                                    <strong>+1 {primaryBuildDefinition.label} lane</strong>
                                    <small>
                                        Now x{primaryBuildCount + 1} -{' '}
                                        {primaryBuildDefinition.decisionVerbs.slice(0, 3).join(' / ')}
                                    </small>
                                </span>
                            ) : null}
                            {buildFitSignals.length > 0 ? (
                                <span
                                    aria-label={buildFitSignalsLabel}
                                    className={styles.buildFitSignals}
                                    data-testid="relic-build-fit-signals"
                                >
                                    {buildFitSignals.map((signal) => (
                                        <span
                                            data-build-fit-action={relicBuildFitSignalAction(signal.tone)}
                                            data-build-fit-audio={relicBuildFitSignalAudioCue(signal.tone)}
                                            data-build-fit-beats={relicBuildFitSignalBeatCount(signal.tone)}
                                            data-build-fit-screen-cue={relicBuildFitSignalScreenCue(signal.tone)}
                                            data-build-fit-tone={signal.tone}
                                            key={signal.id}
                                        >
                                            <small>{signal.label}</small>
                                            <strong>{signal.value}</strong>
                                            <b>{relicBuildFitSignalAction(signal.tone)}</b>
                                            <span aria-hidden="true" className={styles.buildFitSignalBeatPips}>
                                                {Array.from({ length: relicBuildFitSignalBeatCount(signal.tone) }, (_, beatIndex) => (
                                                    <i
                                                        data-build-fit-beat={beatIndex + 1}
                                                        data-build-fit-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </span>
                            ) : null}
                            {comboRoutes.length > 0 ? (
                                <span
                                    aria-label={comboRouteAria}
                                    className={styles.comboRoutes}
                                    data-relic-combo-route-count={comboRoutes.length}
                                    data-testid="relic-combo-routes"
                                >
                                    {comboRoutes.map((comboRoute) => (
                                        <span
                                            data-combo-route-beats={comboRoute.beatCount}
                                            data-combo-route-id={comboRoute.id}
                                            data-combo-route-tone={comboRoute.tone}
                                            data-combo-trait-count={comboRoute.traitKinds.length}
                                            key={comboRoute.id}
                                        >
                                            <small>{comboRoute.label}</small>
                                            <strong>
                                                {comboRoute.traitKinds.map((traitKind, traitIndex) => (
                                                    <b data-combo-route-trait={traitKind} key={traitKind}>
                                                        {tileTraitKindLabel(traitKind)}
                                                        {traitIndex < comboRoute.traitKinds.length - 1 ? <i aria-hidden="true">+</i> : null}
                                                    </b>
                                                ))}
                                            </strong>
                                            <em>{comboRoute.payoff}</em>
                                            <u>{comboRoute.action}</u>
                                            <span aria-hidden="true" className={styles.comboRouteBeatPips}>
                                                {Array.from({ length: comboRoute.beatCount }, (_, beatIndex) => (
                                                    <i
                                                        data-combo-route-beat={beatIndex + 1}
                                                        data-combo-route-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </span>
                            ) : null}
                            {traitBuildRows.length > 0 ? (
                                <span
                                    aria-label={buildPlanRowsLabel}
                                    className={styles.buildPlanRows}
                                    data-testid="relic-build-plan-rows"
                                >
                                    {traitBuildRows.map((buildRow) => (
                                        <span data-build-plan-id={buildRow.id} key={buildRow.id}>
                                            <small>{buildRow.label}</small>
                                            <strong>{buildRow.payoff}</strong>
                                            <em>{buildRow.decision}</em>
                                        </span>
                                    ))}
                                </span>
                            ) : null}
                            <span className={styles.impact}>{impactCopy}</span>
                            {traitBuildHint ? <span className={styles.impact}>{traitBuildHint}</span> : null}
                            <p className={styles.body}>{desc}</p>
                        </button>
                    );
                })}
            </div>
            {serviceActions.length > 0 ? (
                <div className={styles.serviceRow} data-testid="relic-offer-services">
                    {serviceActions.map((service) => {
                        const serviceCue = getRelicServiceCue(service);
                        return (
                            <button
                                aria-label={`${service.label}. Cost: ${service.cost} gold. ${
                                    service.available
                                        ? `Effect: ${service.effectPreview}.`
                                        : `Unavailable: ${service.unavailableReason}.`
                                } ${serviceCue.label}: ${serviceCue.value}. ${service.description}`}
                                className={styles.serviceButton}
                                disabled={!service.available}
                                key={service.serviceId}
                                onClick={() => onUseService?.(service.serviceId, optionIds[0])}
                                title={service.unavailableReason ?? service.description}
                                type="button"
                            >
                                <span className={styles.serviceLabel}>{service.label}</span>
                                <span className={styles.serviceSignalRow}>
                                    <span className={styles.serviceCost}>{service.cost}g</span>
                                    <span className={styles.serviceEffect} data-service-effect={service.serviceId}>
                                        {service.available ? service.effectPreview : service.unavailableReason}
                                    </span>
                                </span>
                                <span
                                    aria-label={`${serviceCue.label}: ${serviceCue.value}.`}
                                    className={styles.serviceCue}
                                    data-service-cue-tone={serviceCue.tone}
                                    data-testid={`relic-service-${service.serviceId}-cue`}
                                >
                                    <small>{serviceCue.label}</small>
                                    <strong>{serviceCue.value}</strong>
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};

export default RelicDraftOfferPanel;
