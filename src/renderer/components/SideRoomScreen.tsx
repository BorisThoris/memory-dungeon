import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { RouteNodeType, RouteSideRoomState, TileTraitKind } from '../../shared/contracts';
import { runArray, runFilteredStringArray } from '../../shared/run-array-guards';
import { getTraitBuildRewardRows } from '../../shared/trait-build-rewards';
import {
    playUiBackSfx,
    playUiConfirmSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { useAppStore } from '../store/useAppStore';
import { OverlayActionDock } from '../ui';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import { getInventoryPayoffEngineSignal } from './inventoryScreenModel';
import styles from './SideRoomScreen.module.css';

const routeLabel = (routeType: RouteNodeType): string =>
    routeType === 'safe' ? 'Safe route' : routeType === 'greed' ? 'Greedy route' : 'Mystery route';

type SideRoomChoice = NonNullable<RouteSideRoomState['choices']>[number];

const sideRoomChoices = (value: RouteSideRoomState['choices'] | unknown): SideRoomChoice[] => runArray(value);

const sideRoomTraitBuildLabels = (value: SideRoomChoice['traitBuildLabels'] | unknown): string[] => runFilteredStringArray(value);

const sideRoomNodeKindStamp = (sideRoom: RouteSideRoomState): string => {
    if (sideRoom.nodeKind) {
        return sideRoom.nodeKind;
    }
    if (sideRoom.kind === 'run_event') {
        return 'event';
    }
    if (sideRoom.kind === 'rest_shrine') {
        return 'rest';
    }
    return sideRoom.routeType === 'greed' ? 'treasure' : sideRoom.routeType;
};

const rewardFeedbackSegments = (sideRoom: RouteSideRoomState): { label: string; kind: 'gain' | 'capped' | 'neutral' }[] => {
    if (sideRoom.kind !== 'bonus_reward') {
        return [];
    }
    return sideRoom.primaryDetail
        .split(';')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((label) => ({
            label,
            kind: label.startsWith('+')
                ? 'gain'
                : /already full|unavailable|exhausted/i.test(label)
                  ? 'capped'
                  : 'neutral'
        }));
};

const rewardFeedbackSummary = (
    segments: readonly { label: string; kind: 'gain' | 'capped' | 'neutral' }[]
): { label: string; value: string; tone: 'gain' | 'capped' | 'neutral' }[] => {
    const gained = segments.filter((segment) => segment.kind === 'gain').length;
    const capped = segments.filter((segment) => segment.kind === 'capped').length;
    const neutral = segments.filter((segment) => segment.kind === 'neutral').length;
    return [
        gained > 0
            ? {
                  label: 'Reward burst',
                  value: `${gained} gain${gained === 1 ? '' : 's'}`,
                  tone: 'gain' as const
              }
            : null,
        capped > 0
            ? {
                  label: 'Overflow',
                  value: `${capped} capped`,
                  tone: 'capped' as const
              }
            : null,
        neutral > 0 && gained === 0 && capped === 0
            ? {
                  label: 'Outcome',
                  value: `${neutral} note${neutral === 1 ? '' : 's'}`,
                  tone: 'neutral' as const
              }
            : null
    ].filter((row): row is { label: string; value: string; tone: 'gain' | 'capped' | 'neutral' } => row != null);
};

const rewardBurstBeatCount = (row: { tone: 'gain' | 'capped' | 'neutral'; value: string }): 1 | 2 | 3 | 4 => {
    const count = Number(row.value.match(/\d+/)?.[0] ?? 1);
    if (row.tone === 'gain') {
        return Math.min(4, Math.max(2, count + 1)) as 1 | 2 | 3 | 4;
    }
    if (row.tone === 'capped') {
        return Math.min(3, Math.max(2, count)) as 1 | 2 | 3 | 4;
    }
    return 1;
};

const rewardBurstAction = (row: { tone: 'gain' | 'capped' | 'neutral' }): 'Claim reward' | 'Convert overflow' | 'Read outcome' => {
    if (row.tone === 'gain') {
        return 'Claim reward';
    }
    if (row.tone === 'capped') {
        return 'Convert overflow';
    }
    return 'Read outcome';
};

const rewardBurstAudioCue = (
    row: { tone: 'gain' | 'capped' | 'neutral' }
): 'side-room-reward-gain' | 'side-room-reward-capped' | 'side-room-reward-neutral' => {
    if (row.tone === 'gain') {
        return 'side-room-reward-gain';
    }
    if (row.tone === 'capped') {
        return 'side-room-reward-capped';
    }
    return 'side-room-reward-neutral';
};

const rewardBurstScreenCue = (row: { tone: 'gain' | 'capped' | 'neutral' }): 'burst' | 'snap' | 'pulse' => {
    if (row.tone === 'gain') {
        return 'burst';
    }
    if (row.tone === 'capped') {
        return 'snap';
    }
    return 'pulse';
};

const payoffEngineBeatCount = (signal: ReturnType<typeof getInventoryPayoffEngineSignal>): 2 | 3 | 4 => {
    if (signal.tone === 'super') {
        return 4;
    }
    if (signal.tone === 'burst') {
        return 3;
    }
    return 2;
};

const payoffEngineAction = (
    signal: ReturnType<typeof getInventoryPayoffEngineSignal>
): 'Push reward stack' | 'Prime payoff route' | 'Choose payoff' => {
    if (signal.tone === 'super') {
        return 'Push reward stack';
    }
    if (signal.tone === 'burst') {
        return 'Prime payoff route';
    }
    return 'Choose payoff';
};

const payoffEngineAudioCue = (
    signal: ReturnType<typeof getInventoryPayoffEngineSignal>
): 'side-room-payoff-super' | 'side-room-payoff-burst' | 'side-room-payoff-setup' => {
    if (signal.tone === 'super') {
        return 'side-room-payoff-super';
    }
    if (signal.tone === 'burst') {
        return 'side-room-payoff-burst';
    }
    return 'side-room-payoff-setup';
};

const payoffEngineScreenCue = (signal: ReturnType<typeof getInventoryPayoffEngineSignal>): 'super' | 'burst' | 'pulse' => {
    if (signal.tone === 'super') {
        return 'super';
    }
    if (signal.tone === 'burst') {
        return 'burst';
    }
    return 'pulse';
};

const sideRoomBoardMoment = (
    sideRoom: RouteSideRoomState,
    rewardSegments: readonly { label: string; kind: 'gain' | 'capped' | 'neutral' }[]
): { label: 'Board moment'; value: string; tone: 'build' | 'route' | 'safety' | 'reward' | 'neutral' } => {
    const detail = sideRoom.primaryDetail.toLowerCase();
    const choices = sideRoomChoices(sideRoom.choices);
    const hasChoices = choices.length > 0;
    if (hasChoices && choices.some((choice) => choice.traitBuildReason || sideRoomTraitBuildLabels(choice.traitBuildLabels).length > 0)) {
        return { label: 'Board moment', value: 'Pick a build lane', tone: 'build' };
    }
    if (hasChoices) {
        return { label: 'Board moment', value: 'Choose next-floor leverage', tone: 'reward' };
    }
    if (/row|swap|shuffle|trait|conduit|echo|stasis|sealed|drift|mirror/i.test(sideRoom.primaryDetail)) {
        return { label: 'Board moment', value: 'Set up trait routes', tone: 'build' };
    }
    if (/\bkey|lock|locked|entrance\b/i.test(sideRoom.primaryDetail)) {
        return { label: 'Board moment', value: 'Open a locked route', tone: 'route' };
    }
    if (/\bguard|life|heal|ward|banish|destroy\b/i.test(sideRoom.primaryDetail)) {
        return { label: 'Board moment', value: 'Protect the next chain', tone: 'safety' };
    }
    if (/\bpeek|reveal|scout|recall\b/i.test(sideRoom.primaryDetail)) {
        return { label: 'Board moment', value: 'Scout a safe opener', tone: 'build' };
    }
    if (rewardSegments.some((segment) => segment.kind === 'capped')) {
        return { label: 'Board moment', value: 'Convert capped pickups', tone: 'reward' };
    }
    if (detail.includes('+') || /\bgold|score|favor|shard|charge\b/i.test(sideRoom.primaryDetail)) {
        return { label: 'Board moment', value: 'Bank next-floor resources', tone: 'reward' };
    }
    return {
        label: 'Board moment',
        value: sideRoom.routeType === 'safe' ? 'Stabilize the next floor' : sideRoom.routeType === 'greed' ? 'Push reward pressure' : 'Resolve route pressure',
        tone: 'neutral'
    };
};

const primaryActionSignals = (
    sideRoom: RouteSideRoomState,
    rewardSegments: readonly { label: string; kind: 'gain' | 'capped' | 'neutral' }[]
): { id: string; label: string; value: string; tone: 'action' | 'gain' | 'cost' | 'route' | 'neutral' }[] => {
    const hasChoices = sideRoomChoices(sideRoom.choices).length > 0;
    const hasGain = rewardSegments.some((segment) => segment.kind === 'gain') || sideRoom.primaryDetail.includes('+');
    const hasCost = /\b(lose|spend|cost|pay|damage|risk|forfeit|sacrifice|curse|cursed)\b/i.test(sideRoom.primaryDetail);
    const action =
        sideRoom.kind === 'rest_shrine'
            ? 'Rest'
            : hasChoices
              ? 'Choose'
              : hasGain
                ? 'Claim'
                : 'Continue';
    const payoff =
        rewardSegments.find((segment) => segment.kind === 'gain')?.label ??
        sideRoom.primaryDetail
            .split(';')
            .map((segment) => segment.trim())
            .find((segment) => segment.startsWith('+') || /\b(key|peek|guard|gold|score|shard|charge|favor|heal|life)\b/i.test(segment)) ??
        (hasChoices ? 'Pick one outcome' : sideRoom.primaryLabel);
    const pressure =
        hasCost
            ? sideRoom.primaryDetail
                  .split(';')
                  .map((segment) => segment.trim())
                  .find((segment) => /\b(lose|spend|cost|pay|damage|risk|forfeit|sacrifice|curse|cursed)\b/i.test(segment)) ?? 'Has cost'
            : sideRoom.routeType === 'safe'
              ? 'Low risk'
              : sideRoom.routeType === 'greed'
                ? 'Reward risk'
                : 'Unknown route';

    return [
        { id: 'action', label: 'Action', value: action, tone: 'action' },
        { id: 'payoff', label: hasGain ? 'Payoff' : hasChoices ? 'Decision' : 'Outcome', value: payoff, tone: hasGain ? 'gain' : 'neutral' },
        { id: 'route', label: hasCost ? 'Cost' : 'Route', value: pressure, tone: hasCost ? 'cost' : 'route' }
    ];
};

const primaryActionSignalBeatCount = (signal: ReturnType<typeof primaryActionSignals>[number]): 2 | 3 | 4 => {
    if (signal.tone === 'gain') {
        return 4;
    }
    if (signal.tone === 'cost' || signal.tone === 'route') {
        return 3;
    }
    return 2;
};

const primaryActionSignalAudioCue = (
    signal: ReturnType<typeof primaryActionSignals>[number]
): 'side-room-action' | 'side-room-gain' | 'side-room-cost' | 'side-room-route' | 'side-room-neutral' => {
    switch (signal.tone) {
        case 'action':
            return 'side-room-action';
        case 'gain':
            return 'side-room-gain';
        case 'cost':
            return 'side-room-cost';
        case 'route':
            return 'side-room-route';
        default:
            return 'side-room-neutral';
    }
};

const primaryActionSignalScreenCue = (
    signal: ReturnType<typeof primaryActionSignals>[number]
): 'pulse' | 'burst' | 'risk' | 'route' => {
    if (signal.tone === 'gain') {
        return 'burst';
    }
    if (signal.tone === 'cost') {
        return 'risk';
    }
    if (signal.tone === 'route') {
        return 'route';
    }
    return 'pulse';
};

const choiceSignalChips = (choice: SideRoomChoice): { label: string; tone: 'gain' | 'cost' | 'build' | 'neutral' }[] => {
    const detail = choice.detail.toLowerCase();
    const chips: { label: string; tone: 'gain' | 'cost' | 'build' | 'neutral' }[] = [];
    const traitLabels = sideRoomTraitBuildLabels(choice.traitBuildLabels);

    if (choice.traitBuildReason) {
        chips.push({ label: 'Best fit', tone: 'build' });
    }
    if (choice.detail.includes('+')) {
        chips.push({ label: 'Gain', tone: 'gain' });
    }
    if (/\b(lose|spend|cost|pay|damage|risk|forfeit|sacrifice|curse|cursed)\b/i.test(choice.detail)) {
        chips.push({ label: 'Cost', tone: 'cost' });
    }
    if (traitLabels.length > 0) {
        chips.push({ label: 'Route prime', tone: 'build' });
    }
    if (choice.nextCue ?? choice.rewardPerkNextCue) {
        chips.push({ label: 'Next unlock', tone: 'build' });
    }
    if (chips.length === 0 && /\b(key|peek|guard|gold|score|shard|charge|favor)\b/.test(detail)) {
        chips.push({ label: 'Resource', tone: 'neutral' });
    }

    return chips;
};

const choiceSignalBeatCount = (chip: ReturnType<typeof choiceSignalChips>[number]): 2 | 3 | 4 => {
    if (chip.tone === 'gain' || chip.tone === 'build') {
        return 4;
    }
    if (chip.tone === 'cost') {
        return 3;
    }
    return 2;
};

const choiceSignalAction = (
    chip: ReturnType<typeof choiceSignalChips>[number]
): 'Claim reward' | 'Check cost' | 'Prime route' | 'Read choice' => {
    if (chip.tone === 'gain') {
        return 'Claim reward';
    }
    if (chip.tone === 'cost') {
        return 'Check cost';
    }
    if (chip.tone === 'build') {
        return 'Prime route';
    }
    return 'Read choice';
};

const choiceSignalAudioCue = (
    chip: ReturnType<typeof choiceSignalChips>[number]
): 'side-room-signal-gain' | 'side-room-signal-cost' | 'side-room-signal-build' | 'side-room-signal-neutral' => {
    if (chip.tone === 'gain') {
        return 'side-room-signal-gain';
    }
    if (chip.tone === 'cost') {
        return 'side-room-signal-cost';
    }
    if (chip.tone === 'build') {
        return 'side-room-signal-build';
    }
    return 'side-room-signal-neutral';
};

const choiceSignalScreenCue = (chip: ReturnType<typeof choiceSignalChips>[number]): 'burst' | 'risk' | 'route' | 'pulse' => {
    if (chip.tone === 'gain') {
        return 'burst';
    }
    if (chip.tone === 'cost') {
        return 'risk';
    }
    if (chip.tone === 'build') {
        return 'route';
    }
    return 'pulse';
};

const choicePayoffRows = (choice: SideRoomChoice): { id: string; label: string; value: string; tone: 'gain' | 'cost' | 'build' | 'neutral' }[] => {
    const segments = choice.detail
        .split(';')
        .map((segment) => segment.trim())
        .filter(Boolean);
    const rows: { id: string; label: string; value: string; tone: 'gain' | 'cost' | 'build' | 'neutral' }[] = [];
    const rewardSegment =
        segments.find((segment) => segment.startsWith('+')) ??
        segments.find((segment) => /\b(key|peek|guard|gold|score|shard|charge|favor|heal|life)\b/i.test(segment));
    const costSegment = segments.find((segment) =>
        /\b(lose|spend|cost|pay|damage|risk|forfeit|sacrifice|curse|cursed|already full|unavailable|exhausted)\b/i.test(segment)
    );

    if (rewardSegment) {
        rows.push({ id: 'reward', label: 'Reward', value: rewardSegment, tone: 'gain' });
    }
    if (costSegment && costSegment !== rewardSegment) {
        rows.push({ id: 'cost', label: 'Cost', value: costSegment, tone: 'cost' });
    }
    const traitLabels = sideRoomTraitBuildLabels(choice.traitBuildLabels);
    if (choice.traitBuildReason) {
        rows.push({ id: 'build', label: 'Prime', value: choice.traitBuildReason, tone: 'build' });
    } else if (traitLabels.length > 0) {
        rows.push({ id: 'build', label: 'Prime', value: traitLabels.slice(0, 2).join(' / '), tone: 'build' });
    }
    const nextCue = choice.nextCue ?? choice.rewardPerkNextCue;
    if (nextCue) {
        rows.push({ id: 'next', label: 'Next', value: nextCue, tone: 'build' });
    }
    if (rows.length === 0 && choice.detail.length > 0) {
        rows.push({ id: 'outcome', label: 'Outcome', value: choice.detail, tone: 'neutral' });
    }

    return rows.slice(0, 3);
};

const choicePayoffBeatCount = (row: ReturnType<typeof choicePayoffRows>[number]): 2 | 3 | 4 => {
    if (row.tone === 'gain' || row.tone === 'build') {
        return 4;
    }
    if (row.tone === 'cost') {
        return 3;
    }
    return 2;
};

const choicePayoffAction = (
    row: ReturnType<typeof choicePayoffRows>[number]
): 'Claim reward' | 'Check cost' | 'Prime route' | 'Read outcome' => {
    if (row.tone === 'gain') {
        return 'Claim reward';
    }
    if (row.tone === 'cost') {
        return 'Check cost';
    }
    if (row.tone === 'build') {
        return 'Prime route';
    }
    return 'Read outcome';
};

const choicePayoffAudioCue = (
    row: ReturnType<typeof choicePayoffRows>[number]
): 'choice-payoff-gain' | 'choice-payoff-cost' | 'choice-payoff-build' | 'choice-payoff-neutral' => {
    if (row.tone === 'gain') {
        return 'choice-payoff-gain';
    }
    if (row.tone === 'cost') {
        return 'choice-payoff-cost';
    }
    if (row.tone === 'build') {
        return 'choice-payoff-build';
    }
    return 'choice-payoff-neutral';
};

const choicePayoffScreenCue = (row: ReturnType<typeof choicePayoffRows>[number]): 'burst' | 'guard' | 'snap' | 'pulse' => {
    if (row.tone === 'gain') {
        return 'burst';
    }
    if (row.tone === 'cost') {
        return 'guard';
    }
    if (row.tone === 'build') {
        return 'snap';
    }
    return 'pulse';
};

type SideRoomChoiceBuildRoute = {
    beatCount: number;
    id: string;
    label: string;
    payoff: string;
    tone: 'build' | 'control' | 'guard' | 'risk' | 'route' | 'scout';
    traitKinds: TileTraitKind[];
};

const sideRoomTraitKindLabel = (traitKind: TileTraitKind): string =>
    traitKind
        .split('_')
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' ');

const sideRoomChoiceBuildRouteTone = (traitKinds: readonly TileTraitKind[]): SideRoomChoiceBuildRoute['tone'] => {
    if (traitKinds.includes('cursed')) {
        return 'risk';
    }
    if (traitKinds.includes('stasis') || traitKinds.includes('sealed')) {
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
    return 'build';
};

const sideRoomChoiceBuildRoutes = (choice: SideRoomChoice): SideRoomChoiceBuildRoute[] => {
    const traitLabels = sideRoomTraitBuildLabels(choice.traitBuildLabels);
    if (traitLabels.length === 0) {
        return [];
    }
    const labelSet = new Set(traitLabels);
    return getTraitBuildRewardRows()
        .filter((row) => labelSet.has(row.label))
        .map((row) => ({
            beatCount: Math.max(2, row.traitKinds.length + 1),
            id: row.id,
            label: row.label,
            payoff: row.payoff,
            tone: sideRoomChoiceBuildRouteTone(row.traitKinds),
            traitKinds: [...row.traitKinds]
        }));
};

const sideRoomChoiceBuildRouteAttr = (routes: readonly SideRoomChoiceBuildRoute[]): string =>
    routes.length > 0 ? routes.map((route) => `${route.id}:${route.traitKinds.join('+')}:${route.tone}`).join('>') : 'none';

const sideRoomChoiceBuildRouteLabel = (routes: readonly SideRoomChoiceBuildRoute[]): string =>
    routes.length > 0
        ? `Choice build routes. ${routes
              .map(
                  (route) =>
                      `${route.label}. Traits: ${route.traitKinds.map(sideRoomTraitKindLabel).join(' into ')}. Payoff: ${route.payoff}.`
              )
              .join(' ')}`
        : 'Choice build routes';

const choiceImpactBurst = (
    choice: SideRoomChoice,
    payoffRows: ReturnType<typeof choicePayoffRows>
): { label: string; value: string; tone: 'build' | 'gain' | 'neutral' } => {
    if (choice.traitBuildReason) {
        return {
            label: 'Best fit',
            value: sideRoomTraitBuildLabels(choice.traitBuildLabels)[0] ?? 'Current board',
            tone: 'build'
        };
    }
    if (choice.rewardImpactCue && choice.rewardImpactKind) {
        return {
            label: choice.rewardImpactCue,
            value: choice.rewardImpactKind === 'resource' ? choice.rewardImpactDetail ?? choice.detail : choice.rewardImpactDetail ?? choice.rewardImpactCue,
            tone:
                choice.rewardImpactKind === 'build' || choice.rewardImpactKind === 'unlock'
                    ? 'build'
                    : choice.rewardImpactKind === 'resource'
                      ? 'gain'
                      : 'neutral'
        };
    }
    const nextCue = choice.nextCue ?? choice.rewardPerkNextCue;
    if (nextCue) {
        return {
            label: 'Unlock',
            value: nextCue,
            tone: 'build'
        };
    }
    const gainCount = payoffRows.filter((row) => row.tone === 'gain').length;
    if (gainCount > 0) {
        return {
            label: 'Reward burst',
            value: `${gainCount} gain${gainCount === 1 ? '' : 's'}`,
            tone: 'gain'
        };
    }
    return {
        label: 'Pick',
        value: choice.primary ? 'Take now' : 'Hold',
        tone: 'neutral'
    };
};

const choiceHeatCue = (
    choice: NonNullable<RouteSideRoomState['choices']>[number],
    payoffRows: ReturnType<typeof choicePayoffRows>,
    payoffStack: ReturnType<typeof choicePayoffStack>
): {
    detail: string;
    label: 'Choice heat';
    tier: 'hot' | 'live' | 'gain' | 'risk' | 'setup';
    value: 'Hot route' | 'Live payoff' | 'Reward burst' | 'Risk trade' | 'Route prime';
} => {
    if (choice.traitBuildReason) {
        return {
            detail: choice.traitBuildReason,
            label: 'Choice heat',
            tier: 'hot',
            value: 'Hot route'
        };
    }
    if (payoffStack && payoffStack.tone === 'risk') {
        return {
            detail: payoffStack.nextCue,
            label: 'Choice heat',
            tier: 'risk',
            value: 'Risk trade'
        };
    }
    if (payoffStack) {
        return {
            detail: payoffStack.detail,
            label: 'Choice heat',
            tier: 'live',
            value: 'Live payoff'
        };
    }
    if (choice.rewardImpactKind === 'unlock' || choice.rewardImpactKind === 'build') {
        return {
            detail: choice.rewardImpactDetail ?? choice.nextCue ?? choice.rewardPerkNextCue ?? choice.detail,
            label: 'Choice heat',
            tier: 'setup',
            value: 'Route prime'
        };
    }
    if (choice.rewardImpactKind === 'resource') {
        return {
            detail: choice.rewardImpactDetail ?? choice.detail,
            label: 'Choice heat',
            tier: 'gain',
            value: 'Reward burst'
        };
    }
    if (choice.rewardImpactKind === 'risk') {
        return {
            detail: choice.rewardImpactDetail ?? choice.detail,
            label: 'Choice heat',
            tier: 'risk',
            value: 'Risk trade'
        };
    }
    const rewardRow = payoffRows.find((row) => row.id === 'reward');
    if (rewardRow) {
        return {
            detail: rewardRow.value,
            label: 'Choice heat',
            tier: 'gain',
            value: 'Reward burst'
        };
    }
    return {
        detail: choice.nextCue ?? choice.rewardPerkNextCue ?? choice.detail,
        label: 'Choice heat',
        tier: 'setup',
        value: 'Route prime'
    };
};

const choiceBeatCue = (
    heatCue: ReturnType<typeof choiceHeatCue>,
    payoffStack: ReturnType<typeof choicePayoffStack>
): {
    action: string;
    beatCount: 2 | 3 | 4;
    detail: string;
    label: 'Cashout beat' | 'Prime beat' | 'Risk beat' | 'Stack beat';
    tier: 'cashout' | 'prime' | 'risk' | 'stack';
} => {
    if (heatCue.tier === 'hot' || payoffStack?.tone === 'super') {
        return {
            action: 'Stack choice',
            beatCount: 4,
            detail: heatCue.detail,
            label: 'Stack beat',
            tier: 'stack'
        };
    }
    if (heatCue.tier === 'live') {
        return {
            action: 'Cash payoff',
            beatCount: 3,
            detail: payoffStack?.nextCue ?? heatCue.detail,
            label: 'Cashout beat',
            tier: 'cashout'
        };
    }
    if (heatCue.tier === 'risk') {
        return {
            action: 'Check cost',
            beatCount: 3,
            detail: payoffStack?.nextCue ?? heatCue.detail,
            label: 'Risk beat',
            tier: 'risk'
        };
    }
    return {
        action: heatCue.tier === 'gain' ? 'Claim reward' : 'Prime route',
        beatCount: 2,
        detail: heatCue.detail,
        label: 'Prime beat',
        tier: 'prime'
    };
};

const choiceBeatScreenCue = (beatCue: ReturnType<typeof choiceBeatCue>): 'burst' | 'pulse' | 'risk' => {
    if (beatCue.tier === 'stack' || beatCue.tier === 'cashout') {
        return 'burst';
    }
    if (beatCue.tier === 'risk') {
        return 'risk';
    }
    return 'pulse';
};

const choiceImpactScreenCue = (impactBurst: ReturnType<typeof choiceImpactBurst>): 'burst' | 'pulse' | 'risk' => {
    if (impactBurst.tone === 'gain') {
        return 'burst';
    }
    if (/risk|cost|curse|damage/i.test(`${impactBurst.label} ${impactBurst.value}`)) {
        return 'risk';
    }
    return 'pulse';
};

const choicePayoffStack = (
    payoffRows: ReturnType<typeof choicePayoffRows>
): {
    label: 'Payoff stack' | 'Super stack';
    value: string;
    detail: string;
    nextCue: string;
    sequence: { first: string; keep: string; then: string };
    tone: 'build' | 'gain' | 'risk' | 'super';
} | null => {
    type ChoicePayoffStackLane = 'Reward' | 'Route' | 'Next' | 'Cost';
    const laneLabels = payoffRows
        .map((row): ChoicePayoffStackLane | null =>
            row.id === 'reward'
                ? 'Reward'
                : row.id === 'build'
                  ? 'Route'
                  : row.id === 'next'
                    ? 'Next'
                    : row.id === 'cost'
                      ? 'Cost'
                      : null
        )
        .filter((lane): lane is ChoicePayoffStackLane => lane != null);
    const uniqueLanes = [...new Set(laneLabels)];
    if (uniqueLanes.length < 2) {
        return null;
    }
    const hasCost = uniqueLanes.includes('Cost');
    const hasBuild = uniqueLanes.includes('Route') || uniqueLanes.includes('Next');
    const nextRow = payoffRows.find((row) => row.id === 'next');
    const buildRow = payoffRows.find((row) => row.id === 'build');
    const rewardRow = payoffRows.find((row) => row.id === 'reward');
    const costRow = payoffRows.find((row) => row.id === 'cost');
    const isSuperStack = uniqueLanes.length >= 3 && !hasCost;
    const nextCue =
        nextRow?.value ??
        (hasCost && costRow ? `Check cost: ${costRow.value}` : null) ??
        buildRow?.value ??
        rewardRow?.value ??
        uniqueLanes[0]!;
    const first = rewardRow?.value ?? buildRow?.value ?? costRow?.value ?? uniqueLanes[0]!;
    const then = buildRow?.value ?? nextRow?.value ?? rewardRow?.value ?? costRow?.value ?? uniqueLanes[0]!;
    const keep = nextRow?.value ?? (hasCost && costRow ? `Respect ${costRow.value}` : null) ?? buildRow?.value ?? rewardRow?.value ?? uniqueLanes[0]!;
    return {
        detail: uniqueLanes.join(' + '),
        label: isSuperStack ? 'Super stack' : 'Payoff stack',
        nextCue,
        sequence: { first, keep, then },
        tone: hasCost ? 'risk' : isSuperStack ? 'super' : hasBuild ? 'build' : 'gain',
        value: `${uniqueLanes.length} payoffs`
    };
};

type SideRoomChoiceLaneId = 'build' | 'reward' | 'unlock' | 'risk' | 'route';

interface SideRoomChoiceLaneMapEntry {
    id: SideRoomChoiceLaneId;
    label: string;
    count: number;
    cue: string;
}

const SIDE_ROOM_CHOICE_LANE_ORDER: readonly SideRoomChoiceLaneId[] = ['build', 'reward', 'unlock', 'risk', 'route'];

const SIDE_ROOM_CHOICE_LANE_LABEL: Record<SideRoomChoiceLaneId, string> = {
    build: 'Build',
    reward: 'Reward',
    unlock: 'Unlock',
    risk: 'Risk',
    route: 'Route'
};

const sideRoomChoiceLaneForRows = (payoffRows: ReturnType<typeof choicePayoffRows>): SideRoomChoiceLaneId => {
    if (payoffRows.some((row) => row.id === 'build')) {
        return 'build';
    }
    if (payoffRows.some((row) => row.id === 'cost')) {
        return 'risk';
    }
    if (payoffRows.some((row) => row.id === 'next')) {
        return 'unlock';
    }
    if (payoffRows.some((row) => row.id === 'reward')) {
        return 'reward';
    }
    return 'route';
};

const buildSideRoomChoiceLaneMap = (choices: readonly SideRoomChoice[]): SideRoomChoiceLaneMapEntry[] => {
    const lanes = new Map<SideRoomChoiceLaneId, { count: number; cue: string }>();
    for (const choice of choices) {
        const payoffRows = choicePayoffRows(choice);
        const lane = sideRoomChoiceLaneForRows(payoffRows);
        const impact = choiceImpactBurst(choice, payoffRows);
        const existing = lanes.get(lane);
        lanes.set(lane, {
            count: (existing?.count ?? 0) + 1,
            cue: existing?.cue ?? impact.value
        });
    }
    return SIDE_ROOM_CHOICE_LANE_ORDER.flatMap((id) => {
        const lane = lanes.get(id);
        return lane ? [{ id, label: SIDE_ROOM_CHOICE_LANE_LABEL[id], count: lane.count, cue: lane.cue }] : [];
    });
};

const sideRoomChoiceLaneMapAttr = (laneMap: readonly SideRoomChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${entry.count}`).join('>');

const sideRoomChoiceLaneAction = (lane: SideRoomChoiceLaneMapEntry): string => {
    switch (lane.id) {
        case 'build':
            return 'Pick build';
        case 'reward':
            return 'Claim reward';
        case 'unlock':
            return 'Bank unlock';
        case 'risk':
            return 'Read risk';
        case 'route':
            return 'Choose route';
        default:
            return 'Choose';
    }
};

const sideRoomChoiceLaneActionMapAttr = (laneMap: readonly SideRoomChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${sideRoomChoiceLaneAction(entry)}:${entry.count}`).join('>');

const sideRoomChoiceLaneMapLabel = (laneMap: readonly SideRoomChoiceLaneMapEntry[]): string =>
    formatSideRoomSignalLabel(
        'Side room choice lanes',
        laneMap.map((entry) => ({
            label: entry.label,
            value: `${entry.count}. ${sideRoomChoiceLaneAction(entry)}. ${entry.cue.trim().replace(/[.!?]+$/, '')}`
        }))
    );

const sideRoomChoiceLaneBeatCount = (lane: Pick<SideRoomChoiceLaneMapEntry, 'count' | 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'reward' || lane.id === 'build' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'risk' || lane.id === 'unlock') {
        return 3;
    }
    return 2;
};

const sideRoomChoiceLaneAudioCue = (
    lane: Pick<SideRoomChoiceLaneMapEntry, 'id'>
): 'side-room-lane-build' | 'side-room-lane-reward' | 'side-room-lane-unlock' | 'side-room-lane-risk' | 'side-room-lane-route' => {
    switch (lane.id) {
        case 'build':
            return 'side-room-lane-build';
        case 'reward':
            return 'side-room-lane-reward';
        case 'unlock':
            return 'side-room-lane-unlock';
        case 'risk':
            return 'side-room-lane-risk';
        default:
            return 'side-room-lane-route';
    }
};

const sideRoomChoiceLaneScreenCue = (
    lane: Pick<SideRoomChoiceLaneMapEntry, 'count' | 'id'>
): 'burst' | 'reward' | 'unlock' | 'risk' | 'pulse' => {
    if (lane.id === 'build' || lane.count > 1) {
        return 'burst';
    }
    if (lane.id === 'reward') {
        return 'reward';
    }
    if (lane.id === 'unlock') {
        return 'unlock';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    return 'pulse';
};

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/, '');

const choiceActionAriaLabel = (choice: SideRoomChoice): string => {
    const payoffRows = choicePayoffRows(choice);
    const impactBurst = choiceImpactBurst(choice, payoffRows);
    const payoffStack = choicePayoffStack(payoffRows);
    const heatCue = choiceHeatCue(choice, payoffRows, payoffStack);
    const payoff = payoffRows
        .map((row) => `${row.label}: ${row.value}`)
        .join('. ');
    const traitLabels = sideRoomTraitBuildLabels(choice.traitBuildLabels);
    const buildLabels = traitLabels.length > 0 ? `Route primes: ${traitLabels.slice(0, 2).join(' / ')}.` : '';
    const nextCueValue = choice.nextCue ?? choice.rewardPerkNextCue;
    const nextCue = nextCueValue ? `Next cue: ${nextCueValue}.` : '';
    const recommendation = choice.traitBuildReason ? `Recommended: ${choice.traitBuildReason}.` : '';
    const stack = payoffStack
        ? `${payoffStack.label}: ${payoffStack.value}. ${payoffStack.detail}. First: ${trimTerminalPunctuation(payoffStack.sequence.first)}. Then: ${trimTerminalPunctuation(payoffStack.sequence.then)}. Keep: ${trimTerminalPunctuation(payoffStack.sequence.keep)}. Next: ${trimTerminalPunctuation(payoffStack.nextCue)}.`
        : '';
    const detailSuffix = payoffRows.some((row) => row.value === choice.detail) ? '' : choice.detail;
    return `${choice.label}. ${heatCue.label}: ${heatCue.value}. ${heatCue.detail}. ${impactBurst.label}: ${impactBurst.value}. ${stack}${recommendation}${payoff}${payoff ? '. ' : ''}${buildLabels}${nextCue}${detailSuffix}`.trim();
};

const choiceActionDescription = (choice: SideRoomChoice): string => {
    const payoffRows = choicePayoffRows(choice);
    const payoffStack = choicePayoffStack(payoffRows);
    const impactBurst = choiceImpactBurst(choice, payoffRows);
    if (payoffStack) {
        return `${impactBurst.label}: ${payoffStack.sequence.first} -> ${payoffStack.sequence.keep}`;
    }
    return `${impactBurst.label}: ${impactBurst.value}`;
};

const formatSideRoomSignalLabel = (
    label: string,
    rows: readonly { label: string; value?: string }[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}${row.value ? `: ${row.value}` : ''}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const SideRoomScreen = () => {
    const rootRef = useRef<HTMLElement | null>(null);
    const { claimSideRoomChoice, claimSideRoomPrimary, run, settings, skipSideRoom } = useAppStore(
        useShallow((state) => ({
            claimSideRoomChoice: state.claimSideRoomChoice,
            claimSideRoomPrimary: state.claimSideRoomPrimary,
            run: state.run,
            settings: state.settings,
            skipSideRoom: state.skipSideRoom
        }))
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);

    useModalFocusTrap({
        containerRef: rootRef,
        onDocumentKeyDown: (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                skipSideRoom();
                return true;
            }
            return false;
        }
    });

    if (!run || run.status !== 'levelComplete' || !run.sideRoom) {
        return null;
    }

    const sideRoom = run.sideRoom;
    const choices = sideRoomChoices(sideRoom.choices);
    const nodeKindStamp = sideRoomNodeKindStamp(sideRoom);
    const rewardSegments = rewardFeedbackSegments(sideRoom);
    const rewardSummary = rewardFeedbackSummary(rewardSegments);
    const boardMoment = sideRoomBoardMoment(sideRoom, rewardSegments);
    const actionSignals = primaryActionSignals(sideRoom, rewardSegments);
    const actionSignalsLabel = formatSideRoomSignalLabel('Side room primary action signals', actionSignals);
    const rewardSummaryLabel = formatSideRoomSignalLabel('Side room reward burst signals', rewardSummary);
    const payoffEngineSignal = getInventoryPayoffEngineSignal(run);
    const payoffEngineBeats = payoffEngineBeatCount(payoffEngineSignal);
    const payoffEngineActionCue = payoffEngineAction(payoffEngineSignal);
    const payoffEngineAudioCueValue = payoffEngineAudioCue(payoffEngineSignal);
    const payoffEngineScreenCueValue = payoffEngineScreenCue(payoffEngineSignal);
    const payoffEngineSignalLabel = formatSideRoomSignalLabel('Side room payoff engine', [
        {
            label: payoffEngineSignal.label,
            value: `${payoffEngineActionCue}. ${payoffEngineSignal.value}. ${payoffEngineSignal.detail}. ${payoffEngineSignal.nextCue}`
        }
    ]);
    const rewardBreakdownLabel = formatSideRoomSignalLabel(
        'Reward feedback breakdown',
        rewardSegments.map((segment) => ({ label: segment.kind, value: segment.label }))
    );
    const choiceLaneMap = buildSideRoomChoiceLaneMap(choices);
    const primaryChoiceLane = choiceLaneMap[0] ?? null;
    const choiceLaneMapAttr = sideRoomChoiceLaneMapAttr(choiceLaneMap);
    const choiceLaneMapAccessibleLabel = sideRoomChoiceLaneMapLabel(choiceLaneMap);

    return (
        <section
            aria-label="Route side room"
            aria-modal="true"
            className={styles.overlay}
            data-node-kind={nodeKindStamp}
            data-route-type={sideRoom.routeType}
            data-side-room-kind={sideRoom.kind}
            data-testid="side-room-screen"
            ref={rootRef}
            role="dialog"
            style={GAMEPLAY_VISUAL_CSS_VARS}
            tabIndex={-1}
        >
            <div className={styles.shell}>
                <header className={styles.header}>
                    <span className={styles.eyebrow}>
                        {routeLabel(sideRoom.routeType)} / Floor {sideRoom.floor}
                    </span>
                    <h2>{sideRoom.title}</h2>
                    <p>{sideRoom.body}</p>
                </header>

                <div
                    aria-label={payoffEngineSignalLabel}
                    className={styles.payoffEngineStrip}
                    data-side-room-payoff-engine-action={payoffEngineActionCue}
                    data-side-room-payoff-engine-audio={payoffEngineAudioCueValue}
                    data-side-room-payoff-engine-beats={payoffEngineBeats}
                    data-side-room-payoff-engine-screen-cue={payoffEngineScreenCueValue}
                    data-side-room-payoff-engine-tone={payoffEngineSignal.tone}
                    data-testid="side-room-payoff-engine"
                >
                    <span>
                        <small>{payoffEngineSignal.label}</small>
                        <strong>{payoffEngineSignal.value}</strong>
                        <span aria-hidden="true" className={styles.payoffEngineBeatPips}>
                            {Array.from({ length: payoffEngineBeats }, (_, index) => (
                                <i data-side-room-payoff-engine-beat key={index} />
                            ))}
                        </span>
                    </span>
                    <span>
                        <small>Live payoffs</small>
                        <strong>{payoffEngineSignal.detail}</strong>
                    </span>
                    <span>
                        <small>Next reward should help</small>
                        <strong>{payoffEngineSignal.nextCue}</strong>
                    </span>
                </div>

                <div className={styles.rewardPanel} data-testid="side-room-reward-panel">
                    <strong>{sideRoom.primaryLabel}</strong>
                    <p className={styles.rewardText}>{sideRoom.primaryDetail}</p>
                    <span
                        aria-label={`${boardMoment.label}: ${boardMoment.value}.`}
                        className={styles.boardMomentCue}
                        data-board-moment-tone={boardMoment.tone}
                        data-testid="side-room-board-moment"
                    >
                        <small>{boardMoment.label}</small>
                        <strong>{boardMoment.value}</strong>
                    </span>
                    <div
                        aria-label={actionSignalsLabel}
                        className={styles.primaryActionSignals}
                        data-testid="side-room-primary-action-signals"
                    >
                        {actionSignals.map((signal) => {
                            const beatCount = primaryActionSignalBeatCount(signal);
                            return (
                                <span
                                    data-primary-action-audio={primaryActionSignalAudioCue(signal)}
                                    data-primary-action-beats={beatCount}
                                    data-primary-action-screen-cue={primaryActionSignalScreenCue(signal)}
                                    data-primary-action-tone={signal.tone}
                                    key={signal.id}
                                >
                                    <small>{signal.label}</small>
                                    <strong>{signal.value}</strong>
                                    <span aria-hidden="true" className={styles.primaryActionBeatPips}>
                                        {Array.from({ length: beatCount }, (_, beatIndex) => (
                                            <i data-primary-action-beat={beatIndex + 1} key={beatIndex} />
                                        ))}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                    {rewardSummary.length > 0 ? (
                        <div
                            aria-label={rewardSummaryLabel}
                            className={styles.rewardBurstStrip}
                            data-testid="side-room-reward-burst-strip"
                        >
                            {rewardSummary.map((row) => (
                                <span
                                    data-reward-burst-action={rewardBurstAction(row)}
                                    data-reward-burst-audio={rewardBurstAudioCue(row)}
                                    data-reward-burst-beats={rewardBurstBeatCount(row)}
                                    data-reward-burst-screen-cue={rewardBurstScreenCue(row)}
                                    data-reward-burst-tone={row.tone}
                                    key={row.label}
                                >
                                    <small>{row.label}</small>
                                    <strong>{row.value}</strong>
                                    <b>{rewardBurstAction(row)}</b>
                                    <span aria-hidden="true" className={styles.rewardBurstBeatPips}>
                                        {Array.from({ length: rewardBurstBeatCount(row) }, (_, index) => (
                                            <i data-reward-burst-beat key={index} />
                                        ))}
                                    </span>
                                </span>
                            ))}
                        </div>
                    ) : null}
                    {rewardSegments.length > 1 ? (
                        <ul
                            aria-label={rewardBreakdownLabel}
                            className={styles.rewardFeedbackList}
                            data-testid="side-room-reward-feedback"
                        >
                            {rewardSegments.map((segment, index) => (
                                <li data-reward-feedback-kind={segment.kind} key={`${segment.kind}:${index}:${segment.label}`}>
                                    {segment.label}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {choices.length > 0 ? (
                        <div className={styles.choiceList}>
                            {choiceLaneMap.length > 1 ? (
                                <div
                                    aria-label={choiceLaneMapAccessibleLabel}
                                    className={styles.choiceLaneMap}
                                    data-choice-lane-actions={sideRoomChoiceLaneActionMapAttr(choiceLaneMap)}
                                    data-choice-lane-map={choiceLaneMapAttr}
                                    data-choice-primary-lane={primaryChoiceLane?.id ?? 'none'}
                                    data-choice-primary-lane-action={
                                        primaryChoiceLane ? sideRoomChoiceLaneAction(primaryChoiceLane) : 'none'
                                    }
                                    data-choice-primary-lane-audio={
                                        primaryChoiceLane ? sideRoomChoiceLaneAudioCue(primaryChoiceLane) : 'none'
                                    }
                                    data-choice-primary-lane-beats={
                                        primaryChoiceLane ? sideRoomChoiceLaneBeatCount(primaryChoiceLane) : 0
                                    }
                                    data-choice-primary-lane-cue={primaryChoiceLane?.cue ?? 'none'}
                                    data-choice-primary-lane-screen-cue={
                                        primaryChoiceLane ? sideRoomChoiceLaneScreenCue(primaryChoiceLane) : 'none'
                                    }
                                    data-testid="side-room-choice-lane-map"
                                >
                                    <span
                                        className={styles.choiceLaneMapSummary}
                                        data-choice-lane-count={choiceLaneMap.length}
                                        data-testid="side-room-choice-lane-map-summary"
                                    >
                                        <small>Lanes</small>
                                        <strong>
                                            {choiceLaneMap.length} {choiceLaneMap.length === 1 ? 'lane' : 'lanes'}
                                        </strong>
                                        <b>{primaryChoiceLane ? `${primaryChoiceLane.label} leads` : 'No lead lane'}</b>
                                        <span aria-hidden="true" className={styles.choiceLaneMapSummaryBeatPips}>
                                            {Array.from({ length: Math.max(2, Math.min(5, choiceLaneMap.length + 1)) }, (_, beatIndex) => (
                                                <i
                                                    data-choice-lane-map-summary-beat={beatIndex + 1}
                                                    data-choice-lane-map-summary-beat-focus={
                                                        beatIndex === 0 ? primaryChoiceLane?.id ?? 'none' : 'support'
                                                    }
                                                    key={beatIndex}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    {primaryChoiceLane ? (
                                        <span
                                            aria-label={`Primary side room lane. ${primaryChoiceLane.label}: ${sideRoomChoiceLaneAction(primaryChoiceLane)}. ${primaryChoiceLane.cue}. ${sideRoomChoiceLaneBeatCount(primaryChoiceLane)} beats.`}
                                            className={styles.choiceLanePrimaryCue}
                                            data-choice-primary-lane={primaryChoiceLane.id}
                                            data-choice-primary-lane-action={sideRoomChoiceLaneAction(primaryChoiceLane)}
                                            data-choice-primary-lane-audio={sideRoomChoiceLaneAudioCue(primaryChoiceLane)}
                                            data-choice-primary-lane-beats={sideRoomChoiceLaneBeatCount(primaryChoiceLane)}
                                            data-choice-primary-lane-cue={primaryChoiceLane.cue}
                                            data-choice-primary-lane-screen-cue={sideRoomChoiceLaneScreenCue(primaryChoiceLane)}
                                            data-testid="side-room-choice-primary-lane"
                                        >
                                            <small>Best lane</small>
                                            <strong>{primaryChoiceLane.label}</strong>
                                            <b>{sideRoomChoiceLaneAction(primaryChoiceLane)}</b>
                                            <em>{primaryChoiceLane.cue}</em>
                                            <span aria-hidden="true" className={styles.choiceLanePrimaryBeatPips}>
                                                {Array.from({ length: sideRoomChoiceLaneBeatCount(primaryChoiceLane) }, (_, beatIndex) => (
                                                    <i data-choice-primary-lane-beat={beatIndex + 1} key={beatIndex} />
                                                ))}
                                            </span>
                                        </span>
                                    ) : null}
                                    {choiceLaneMap.map((lane) => (
                                        <span
                                            data-choice-lane={lane.id}
                                            data-choice-lane-action={sideRoomChoiceLaneAction(lane)}
                                            data-choice-lane-audio={sideRoomChoiceLaneAudioCue(lane)}
                                            data-choice-lane-beats={sideRoomChoiceLaneBeatCount(lane)}
                                            data-choice-lane-screen-cue={sideRoomChoiceLaneScreenCue(lane)}
                                            key={lane.id}
                                        >
                                            <small>{lane.label}</small>
                                            <strong>{lane.count}</strong>
                                            <b>{sideRoomChoiceLaneAction(lane)}</b>
                                            <em>{lane.cue}</em>
                                            <span aria-hidden="true" className={styles.choiceLaneBeatPips}>
                                                {Array.from({ length: sideRoomChoiceLaneBeatCount(lane) }, (_, beatIndex) => (
                                                    <i data-choice-lane-beat={beatIndex + 1} key={beatIndex} />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {choices.map((choice) => {
                                const traitLabels = sideRoomTraitBuildLabels(choice.traitBuildLabels);
                                const signalChips = choiceSignalChips(choice);
                                const payoffRows = choicePayoffRows(choice);
                                const impactBurst = choiceImpactBurst(choice, payoffRows);
                                const payoffStack = choicePayoffStack(payoffRows);
                                const heatCue = choiceHeatCue(choice, payoffRows, payoffStack);
                                const beatCue = choiceBeatCue(heatCue, payoffStack);
                                const beatScreenCue = choiceBeatScreenCue(beatCue);
                                const impactScreenCue = choiceImpactScreenCue(impactBurst);
                                const buildRoutes = sideRoomChoiceBuildRoutes(choice);
                                const buildRouteLabel = sideRoomChoiceBuildRouteLabel(buildRoutes);
                                const beatCueLabel = `Side room choice beat: ${beatCue.label}. ${beatCue.beatCount} beats. ${beatCue.action}: ${beatCue.detail}.`;
                                const choiceSignalsLabel = formatSideRoomSignalLabel(
                                    `${choice.label} signals`,
                                    signalChips.map((chip) => ({ label: chip.label }))
                                );
                                const choicePayoffsLabel = formatSideRoomSignalLabel(
                                    `${choice.label} payoff`,
                                    payoffRows
                                );
                                return (
                                    <div
                                        className={styles.choiceRow}
                                        data-choice-id={choice.id}
                                        data-choice-primary={choice.primary ? 'true' : 'false'}
                                        data-choice-heat={heatCue.tier}
                                        data-choice-heat-value={heatCue.value}
                                        data-choice-reward-impact-beats={choice.rewardImpactBeats ?? 0}
                                        data-choice-reward-impact-cue={choice.rewardImpactCue ?? 'none'}
                                        data-choice-reward-impact-detail={choice.rewardImpactDetail ?? 'none'}
                                        data-choice-reward-impact-kind={choice.rewardImpactKind ?? 'none'}
                                        data-choice-reward-impact-screen-cue={impactScreenCue}
                                        data-choice-beat-count={beatCue.beatCount}
                                        data-choice-beat-cue={beatCue.label}
                                        data-choice-beat-screen-cue={beatScreenCue}
                                        data-choice-beat-tier={beatCue.tier}
                                        data-choice-build-routes={sideRoomChoiceBuildRouteAttr(buildRoutes)}
                                        data-choice-recommendation={choice.traitBuildReason ? 'best-fit' : 'standard'}
                                        data-testid={`side-room-choice-${choice.id}`}
                                        key={choice.id}
                                    >
                                        <strong>{choice.label}</strong>
                                        <span
                                            aria-label={`${heatCue.label}: ${heatCue.value}. ${heatCue.detail}.`}
                                            className={styles.choiceHeatCue}
                                            data-choice-heat-tier={heatCue.tier}
                                            data-testid={`side-room-choice-${choice.id}-heat`}
                                        >
                                            <small>{heatCue.label}</small>
                                            <strong>{heatCue.value}</strong>
                                            <em>{heatCue.detail}</em>
                                        </span>
                                        <span
                                            aria-label={beatCueLabel}
                                            className={styles.choiceBeatCue}
                                            data-choice-beat-screen-cue={beatScreenCue}
                                            data-choice-beat-tier={beatCue.tier}
                                            data-testid={`side-room-choice-${choice.id}-beat`}
                                        >
                                            <small>{beatCue.label}</small>
                                            <span aria-hidden="true" className={styles.choiceBeatPips}>
                                                {Array.from({ length: beatCue.beatCount }, (_, beatIndex) => (
                                                    <i key={beatIndex} />
                                                ))}
                                            </span>
                                            <strong>{beatCue.action}</strong>
                                            <em>{beatCue.detail}</em>
                                        </span>
                                        <span
                                            aria-label={`${impactBurst.label}: ${impactBurst.value}.`}
                                            className={styles.choiceImpactBurst}
                                            data-choice-impact-screen-cue={impactScreenCue}
                                            data-choice-impact-tone={impactBurst.tone}
                                            data-testid={`side-room-choice-${choice.id}-impact`}
                                        >
                                            <small>{impactBurst.label}</small>
                                            <strong>{impactBurst.value}</strong>
                                        </span>
                                        {payoffStack ? (
                                            <span
                                                aria-label={`${payoffStack.label}: ${payoffStack.value}. ${payoffStack.detail}. First: ${trimTerminalPunctuation(payoffStack.sequence.first)}. Then: ${trimTerminalPunctuation(payoffStack.sequence.then)}. Keep: ${trimTerminalPunctuation(payoffStack.sequence.keep)}. Next: ${trimTerminalPunctuation(payoffStack.nextCue)}.`}
                                                className={styles.choicePayoffStack}
                                                data-choice-payoff-stack-first={payoffStack.sequence.first}
                                                data-choice-payoff-stack-keep={payoffStack.sequence.keep}
                                                data-choice-payoff-stack-tone={payoffStack.tone}
                                                data-choice-payoff-stack-then={payoffStack.sequence.then}
                                                data-testid={`side-room-choice-${choice.id}-payoff-stack`}
                                            >
                                                <small>{payoffStack.label}</small>
                                                <strong>{payoffStack.value}</strong>
                                                <em>{payoffStack.detail}</em>
                                                <b>{payoffStack.nextCue}</b>
                                                <span className={styles.choicePayoffSequence}>
                                                    <i>First</i>
                                                    <strong>{payoffStack.sequence.first}</strong>
                                                    <i>Then</i>
                                                    <strong>{payoffStack.sequence.then}</strong>
                                                    <i>Keep</i>
                                                    <strong>{payoffStack.sequence.keep}</strong>
                                                </span>
                                            </span>
                                        ) : null}
                                        {signalChips.length > 0 ? (
                                            <div
                                                aria-label={choiceSignalsLabel}
                                                className={styles.choiceSignalChips}
                                                data-testid={`side-room-choice-${choice.id}-signals`}
                                            >
                                                {signalChips.map((chip) => {
                                                    const beatCount = choiceSignalBeatCount(chip);
                                                    return (
                                                        <span
                                                            data-choice-signal-action={choiceSignalAction(chip)}
                                                            data-choice-signal-audio={choiceSignalAudioCue(chip)}
                                                            data-choice-signal-beats={beatCount}
                                                            data-choice-signal-screen-cue={choiceSignalScreenCue(chip)}
                                                            data-choice-signal-tone={chip.tone}
                                                            key={`${choice.id}:${chip.label}`}
                                                        >
                                                            {chip.label}
                                                            <b>{choiceSignalAction(chip)}</b>
                                                            <span aria-hidden="true" className={styles.choiceSignalBeatPips}>
                                                                {Array.from({ length: beatCount }, (_, beatIndex) => (
                                                                    <i data-choice-signal-beat={beatIndex + 1} key={beatIndex} />
                                                                ))}
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                        {traitLabels.length > 0 ? (
                                            <div className={styles.traitBuildTags} aria-label="Trait build archetypes">
                                                {traitLabels.map((label) => (
                                                    <span key={label}>{label}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {buildRoutes.length > 0 ? (
                                            <div
                                                aria-label={buildRouteLabel}
                                                className={styles.choiceBuildRoutes}
                                                data-choice-build-route-count={buildRoutes.length}
                                                data-testid={`side-room-choice-${choice.id}-build-routes`}
                                            >
                                                {buildRoutes.map((route) => (
                                                    <span
                                                        data-choice-build-route-beats={route.beatCount}
                                                        data-choice-build-route-id={route.id}
                                                        data-choice-build-route-tone={route.tone}
                                                        data-choice-build-trait-count={route.traitKinds.length}
                                                        key={route.id}
                                                    >
                                                        <small>{route.label}</small>
                                                        <strong>
                                                            {route.traitKinds.map((traitKind, index) => (
                                                                <b data-choice-build-route-trait={traitKind} key={traitKind}>
                                                                    {sideRoomTraitKindLabel(traitKind)}
                                                                    {index < route.traitKinds.length - 1 ? <i aria-hidden="true">+</i> : null}
                                                                </b>
                                                            ))}
                                                        </strong>
                                                        <em>{route.payoff}</em>
                                                        <span aria-hidden="true" className={styles.choiceBuildRouteBeatPips}>
                                                            {Array.from({ length: route.beatCount }, (_, beatIndex) => (
                                                                <i data-choice-build-route-beat={beatIndex + 1} key={beatIndex} />
                                                            ))}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {choice.traitBuildReason ? (
                                            <p className={styles.traitBuildReason}>{choice.traitBuildReason}</p>
                                        ) : null}
                                        {payoffRows.length > 0 ? (
                                            <div
                                                aria-label={choicePayoffsLabel}
                                                className={styles.choicePayoffRows}
                                                data-testid={`side-room-choice-${choice.id}-payoffs`}
                                            >
                                                {payoffRows.map((row) => {
                                                    const beatCount = choicePayoffBeatCount(row);
                                                    return (
                                                        <span
                                                            data-choice-payoff-action={choicePayoffAction(row)}
                                                            data-choice-payoff-audio={choicePayoffAudioCue(row)}
                                                            data-choice-payoff-beats={beatCount}
                                                            data-choice-payoff-id={row.id}
                                                            data-choice-payoff-screen-cue={choicePayoffScreenCue(row)}
                                                            data-choice-payoff-tone={row.tone}
                                                            key={row.id}
                                                        >
                                                            <small>{row.label}</small>
                                                            <strong>{row.value}</strong>
                                                            <b>{choicePayoffAction(row)}</b>
                                                            <span aria-hidden="true" className={styles.choicePayoffBeatPips}>
                                                                {Array.from({ length: beatCount }, (_, beatIndex) => (
                                                                    <i data-choice-payoff-beat={beatIndex + 1} key={beatIndex} />
                                                                ))}
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                        <p>{choice.detail}</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                <footer className={styles.actions}>
                    <OverlayActionDock
                        actions={[
                            ...(choices.length > 0 || sideRoom.skipLabel !== sideRoom.primaryLabel
                                ? [
                                      {
                                          label: sideRoom.skipLabel,
                                          onClick: () => {
                                              resumeUiSfxContext();
                                              playUiBackSfx(uiGain);
                                              skipSideRoom();
                                          },
                                          variant: 'secondary' as const
                                      }
                                  ]
                                : []),
                            ...(choices.length > 0
                                ? choices.map((choice) => ({
                                      label: choice.label,
                                      description: choiceActionDescription(choice),
                                      ariaLabel: choiceActionAriaLabel(choice),
                                      onClick: () => {
                                          resumeUiSfxContext();
                                          playUiConfirmSfx(uiGain);
                                          claimSideRoomChoice(choice.id);
                                      },
                                      variant: choice.primary ? ('primary' as const) : ('secondary' as const)
                                  }))
                                : [
                                  {
                                      label: sideRoom.primaryLabel,
                                      description: boardMoment.value,
                                      ariaLabel: sideRoom.primaryLabel,
                                      onClick: () => {
                                              resumeUiSfxContext();
                                              playUiConfirmSfx(uiGain);
                                              claimSideRoomPrimary();
                                          },
                                          variant: 'primary' as const
                                      }
                                  ])
                        ]}
                        placement="dock"
                        testId="side-room-action-dock"
                    />
                </footer>
            </div>
        </section>
    );
};

export default SideRoomScreen;
