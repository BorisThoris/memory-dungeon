import type {
    RouteCardKind,
    RouteNodeType,
    RouteSpecialKind,
    RunState
} from '../../shared/contracts';
import { getRepairedSelectedDungeonNode } from '../../shared/run-map';
import {
    formatGameplaySignalRowsLabel,
    getRouteChoicePayoffAudioCue,
    getRouteChoicePayoffScreenCue,
    getRouteChoiceSignalAudioCue,
    getRouteChoiceSignalLabels,
    getRouteChoiceSignalScreenCue,
    getRouteChoiceToneBeatCount,
    getRouteSpecialSignalAudioCue,
    getRouteSpecialSignalBeatCount,
    getRouteSpecialSignalScreenCue,
    getSelectedRouteActionCue,
    getSelectedRouteImpactCue,
    routeCardKindForRouteType,
    routeSpecialDisplayLabel,
    routeSpecialDisplayRewardLine,
    routeSpecialSignalRows,
    routeTypeLabel
} from './gameScreenDecisionSignals';

type SelectedRouteActionCue = ReturnType<typeof getSelectedRouteActionCue>;
type SelectedRouteImpactCue = ReturnType<typeof getSelectedRouteImpactCue>;
type RouteSpecialSignalRow = ReturnType<typeof routeSpecialSignalRows>[number];

export interface GameScreenRouteConsequenceCueProjection {
    ariaLabel: string;
    audioCue: ReturnType<typeof getRouteChoicePayoffAudioCue>;
    beatCount: ReturnType<typeof getRouteChoiceToneBeatCount>;
    screenCue: ReturnType<typeof getRouteChoicePayoffScreenCue>;
}

export type GameScreenSelectedRouteActionProjection = SelectedRouteActionCue &
    GameScreenRouteConsequenceCueProjection;

export type GameScreenSelectedRouteImpactProjection = SelectedRouteImpactCue &
    GameScreenRouteConsequenceCueProjection;

export interface GameScreenSelectedRouteSignalProjection {
    audioCue: ReturnType<typeof getRouteChoiceSignalAudioCue>;
    beatCount: 3 | 4;
    id: 'reward' | 'risk';
    label: string;
    screenCue: ReturnType<typeof getRouteChoiceSignalScreenCue>;
}

export interface GameScreenSelectedRouteProjection {
    actionCue: GameScreenSelectedRouteActionProjection;
    armedNode: ReturnType<typeof getRepairedSelectedDungeonNode>;
    armedNodeCopy: string | null;
    copy: string;
    impactCue: GameScreenSelectedRouteImpactProjection;
    routeCardKind: RouteCardKind;
    routeType: RouteNodeType;
    signals: GameScreenSelectedRouteSignalProjection[];
}

export type GameScreenActiveRouteSignalProjection = RouteSpecialSignalRow & {
    audioCue: ReturnType<typeof getRouteSpecialSignalAudioCue>;
    beatCount: ReturnType<typeof getRouteSpecialSignalBeatCount>;
    screenCue: ReturnType<typeof getRouteSpecialSignalScreenCue>;
};

export interface GameScreenActiveRouteProjection {
    kind: RouteSpecialKind | RouteCardKind;
    label: string;
    pairCount: number;
    rewardLine: string;
    signals: GameScreenActiveRouteSignalProjection[];
    signalsLabel: string;
}

export interface GameScreenRouteConsequenceProjection {
    active: GameScreenActiveRouteProjection | null;
    selected: GameScreenSelectedRouteProjection | null;
}

const selectedRouteCopy = (routeType: RouteNodeType): string =>
    `${routeTypeLabel(routeType)} selected: ${
        routeType === 'safe'
            ? 'next floor adds defensive ward support.'
            : routeType === 'greed'
              ? 'next floor adds richer caches and extra reward-risk pressure.'
              : 'next floor adds deterministic mystery veils.'
    }`;

const projectSelectedRoute = (run: RunState): GameScreenSelectedRouteProjection | null => {
    const plan = run.pendingRouteCardPlan;
    if (!plan) return null;

    const action = getSelectedRouteActionCue(plan.routeType);
    const impact = getSelectedRouteImpactCue(plan.routeType);
    const actionCue: GameScreenSelectedRouteActionProjection = {
        ...action,
        ariaLabel: `Selected route action cue: ${action.label}: ${action.value}. ${action.detail}`,
        audioCue: getRouteChoicePayoffAudioCue(action.tone),
        beatCount: getRouteChoiceToneBeatCount(action.tone),
        screenCue: getRouteChoicePayoffScreenCue(action.tone)
    };
    const impactCue: GameScreenSelectedRouteImpactProjection = {
        ...impact,
        ariaLabel: `Selected route impact cue: ${impact.label}: ${impact.value}.`,
        audioCue: getRouteChoicePayoffAudioCue(impact.tone),
        beatCount: getRouteChoiceToneBeatCount(impact.tone),
        screenCue: getRouteChoicePayoffScreenCue(impact.tone)
    };
    const signalLabels = getRouteChoiceSignalLabels(plan.routeType);
    const signals: GameScreenSelectedRouteSignalProjection[] = [
        {
            audioCue: getRouteChoiceSignalAudioCue('reward'),
            beatCount: 4,
            id: 'reward',
            label: signalLabels.reward,
            screenCue: getRouteChoiceSignalScreenCue('reward')
        },
        {
            audioCue: getRouteChoiceSignalAudioCue('risk'),
            beatCount: 3,
            id: 'risk',
            label: signalLabels.risk,
            screenCue: getRouteChoiceSignalScreenCue('risk')
        }
    ];
    const armedNode = getRepairedSelectedDungeonNode(run.dungeonRun);

    return {
        actionCue,
        armedNode,
        armedNodeCopy: armedNode ? `Dungeon node armed: ${armedNode.label}. ${armedNode.detail}` : null,
        copy: selectedRouteCopy(plan.routeType),
        impactCue,
        routeCardKind: routeCardKindForRouteType(plan.routeType),
        routeType: plan.routeType,
        signals
    };
};

const projectActiveRoute = (run: RunState): GameScreenActiveRouteProjection | null => {
    if (run.status === 'levelComplete') return null;

    const activeRouteTiles = (run.board?.tiles ?? []).filter(
        (tile) =>
            (tile.routeSpecialKind || tile.routeCardKind) &&
            tile.state !== 'matched' &&
            tile.state !== 'removed'
    );
    const kind = activeRouteTiles[0]?.routeSpecialKind ?? activeRouteTiles[0]?.routeCardKind ?? null;
    const pairCount = new Set(activeRouteTiles.map((tile) => tile.pairKey)).size;
    if (!kind || pairCount === 0) return null;

    const signalRows = routeSpecialSignalRows(kind);
    const signals = signalRows.map((row): GameScreenActiveRouteSignalProjection => ({
        ...row,
        audioCue: getRouteSpecialSignalAudioCue(row),
        beatCount: getRouteSpecialSignalBeatCount(row),
        screenCue: getRouteSpecialSignalScreenCue(row)
    }));

    return {
        kind,
        label: routeSpecialDisplayLabel(kind),
        pairCount,
        rewardLine: routeSpecialDisplayRewardLine(kind),
        signals,
        signalsLabel: formatGameplaySignalRowsLabel('Route card payoff signals', signalRows)
    };
};

export const getGameScreenRouteConsequenceProjection = (
    run: RunState
): GameScreenRouteConsequenceProjection => ({
    active: projectActiveRoute(run),
    selected: projectSelectedRoute(run)
});
