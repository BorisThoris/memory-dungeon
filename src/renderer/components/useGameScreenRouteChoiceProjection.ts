import { useMemo } from 'react';
import type { RouteChoice, RunState } from '../../shared/contracts';
import {
    getMemoryRecallFeedback,
    type MemoryFeedbackLine,
    type MemoryRecallFeedback,
    type MemoryRouteChoiceFeedback
} from '../../shared/memory-recall-feedback';
import { getRouteChoiceAvailability, type RouteChoiceAvailability } from '../../shared/route-rules';
import {
    getDungeonMapPresentation,
    getDungeonRouteDecisionPresentation,
    type DungeonMapNodePresentation,
    type DungeonMapPresentation,
    type DungeonRouteDecisionRow
} from '../../shared/run-map';
import {
    formatGameplaySignalRowsLabel,
    getFirstRouteChoiceTeachingLabel
} from './gameScreenDecisionSignals';
import {
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
    trimTerminalPunctuation
} from './gameScreenRouteChoiceModel';

type RouteChoiceActionCue = ReturnType<typeof getRouteChoiceActionCue>;
type RouteChoiceBeatCue = ReturnType<typeof getRouteChoiceBeatCue>;
type RouteChoiceDecisionStack = ReturnType<typeof getRouteChoiceDecisionStack>;
type RouteChoiceImpactCue = ReturnType<typeof getRouteChoiceImpactCue>;
type RouteChoiceSignalLabels = ReturnType<typeof getRouteChoiceSignalLabels>;
type RouteChoicePayoffRow = ReturnType<typeof getRouteChoicePayoffRows>[number];

export interface GameScreenRouteChoiceSignalProjection {
    audioCue: ReturnType<typeof getRouteChoiceSignalAudioCue>;
    beatCount: 3 | 4;
    id: 'reward' | 'risk';
    label: string;
    screenCue: ReturnType<typeof getRouteChoiceSignalScreenCue>;
}

export interface GameScreenRouteChoicePayoffProjection extends RouteChoicePayoffRow {
    ariaLabel: string;
    audioCue: ReturnType<typeof getRouteChoicePayoffAudioCue>;
    beatCount: ReturnType<typeof getRouteChoiceToneBeatCount>;
    screenCue: ReturnType<typeof getRouteChoicePayoffScreenCue>;
}

export interface GameScreenRouteChoiceRecipeStep {
    id: 'first' | 'keep' | 'payoff' | 'risk';
    label: 'First' | 'Keep' | 'Payoff' | 'Recall' | 'Risk';
    value: string;
}

export interface GameScreenRouteChoiceCardProjection {
    actionCue: RouteChoiceActionCue;
    actionCueLabel: string;
    ariaLabel: string;
    availability: RouteChoiceAvailability;
    beatCue: RouteChoiceBeatCue;
    beatCueLabel: string;
    decisionStack: RouteChoiceDecisionStack;
    decisionStackLabel: string;
    firstRouteTeachingLabel: string | null;
    impactCue: RouteChoiceImpactCue;
    impactCueLabel: string;
    memoryChoice: MemoryRouteChoiceFeedback | undefined;
    payoffRows: GameScreenRouteChoicePayoffProjection[];
    payoffsLabel: string;
    primaryPayoff: GameScreenRouteChoicePayoffProjection | null;
    recipeLabel: string;
    recipeSteps: GameScreenRouteChoiceRecipeStep[];
    recipeValue: string;
    row: DungeonRouteDecisionRow;
    signalLabels: RouteChoiceSignalLabels;
    signalRows: GameScreenRouteChoiceSignalProjection[];
    signalsLabel: string;
}

export interface GameScreenRouteChoiceRecommendationProjection {
    ariaLabel: string;
    card: GameScreenRouteChoiceCardProjection;
}

export interface GameScreenRouteChoiceProjection {
    cards: GameScreenRouteChoiceCardProjection[];
    dungeonMapPresentation: DungeonMapPresentation;
    memoryRecallFeedback: MemoryRecallFeedback;
    memoryRecallPanelRows: MemoryFeedbackLine[];
    recommendation: GameScreenRouteChoiceRecommendationProjection | null;
    routeChoiceRequired: boolean;
    routeChoiceRequiredCopy: string;
    summary: string;
    visibleDungeonMapNodes: DungeonMapNodePresentation[];
}

const projectPayoffRow = (row: RouteChoicePayoffRow): GameScreenRouteChoicePayoffProjection => {
    const beatCount = getRouteChoiceToneBeatCount(row.tone);
    return {
        ...row,
        ariaLabel: `${row.label}: ${row.value}. ${beatCount} beats.`,
        audioCue: getRouteChoicePayoffAudioCue(row.tone),
        beatCount,
        screenCue: getRouteChoicePayoffScreenCue(row.tone)
    };
};

const projectRouteChoiceCard = ({
    firstRouteChoiceRequired,
    memoryChoice,
    row,
    run,
    routeChoices
}: {
    firstRouteChoiceRequired: boolean;
    memoryChoice: MemoryRouteChoiceFeedback | undefined;
    row: DungeonRouteDecisionRow;
    run: RunState;
    routeChoices: readonly RouteChoice[];
}): GameScreenRouteChoiceCardProjection => {
    const choice = routeChoices.find((option) => option.id === row.id);
    const availability = choice ? getRouteChoiceAvailability(run, choice) : { available: true as const };
    const firstRouteTeachingLabel = firstRouteChoiceRequired
        ? getFirstRouteChoiceTeachingLabel(row.routeType)
        : null;
    const signalLabels = getRouteChoiceSignalLabels(row.routeType);
    const payoffRows = getRouteChoicePayoffRows({ memoryChoice, routeType: row.routeType }).map(projectPayoffRow);
    const primaryPayoff = payoffRows[0] ?? null;
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
    const impactCue = getRouteChoiceImpactCue({ decisionStack, routeType: row.routeType });
    const signalRows: GameScreenRouteChoiceSignalProjection[] = [
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
    const recipeSteps: GameScreenRouteChoiceRecipeStep[] = [
        { id: 'first', label: 'First', value: actionCue.action },
        {
            id: 'payoff',
            label: 'Payoff',
            value: payoffRows.find((payoff) => payoff.id === 'reward')?.value ?? signalLabels.reward
        },
        {
            id: 'risk',
            label: memoryChoice ? 'Recall' : 'Risk',
            value:
                memoryChoice?.readinessLabel ??
                payoffRows.find((payoff) => payoff.id === 'risk')?.value ??
                signalLabels.risk
        },
        {
            id: 'keep',
            label: 'Keep',
            value: decisionStack.nextCue.replace(/^First:\s*/iu, '')
        }
    ];
    const signalsLabel = `Route choice ${row.routeType} signals. Reward: ${signalLabels.reward}. Risk: ${signalLabels.risk}.`;
    const payoffsLabel = formatGameplaySignalRowsLabel(`Route choice ${row.routeType} payoffs`, payoffRows);
    const decisionStackLabel = `${decisionStack.label}: ${decisionStack.value}. ${decisionStack.nextCue}.`;
    const actionCueLabel = `${actionCue.label}: ${actionCue.action}. ${trimTerminalPunctuation(actionCue.detail)}.`;
    const beatCueLabel = `Route beat ${row.routeType}: ${beatCue.label}. ${beatCue.beatCount} beats. ${beatCue.action}: ${beatCue.detail}`;
    const recipeValue = recipeSteps.map((step) => step.value).join(' -> ');
    const recipeLabel = `Route recipe ${row.routeType}. ${recipeSteps
        .map((step) => `${step.label}: ${trimTerminalPunctuation(step.value)}`)
        .join('. ')}.`;
    const impactCueLabel = `Route impact cue: ${impactCue.label}: ${impactCue.value}.`;
    const ariaLabel = [
        row.choiceLabel,
        `Impact cue: ${impactCue.label}: ${impactCue.value}`,
        `Route action: ${actionCue.action}: ${actionCue.detail}`,
        `Reward signal: ${signalLabels.reward}`,
        `Risk signal: ${signalLabels.risk}`,
        beatCueLabel,
        recipeLabel,
        decisionStackLabel,
        ...payoffRows.map((payoff) => `${payoff.label}: ${payoff.value}`),
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

    return {
        actionCue,
        actionCueLabel,
        ariaLabel,
        availability,
        beatCue,
        beatCueLabel,
        decisionStack,
        decisionStackLabel,
        firstRouteTeachingLabel,
        impactCue,
        impactCueLabel,
        memoryChoice,
        payoffRows,
        payoffsLabel,
        primaryPayoff,
        recipeLabel,
        recipeSteps,
        recipeValue,
        row,
        signalLabels,
        signalRows,
        signalsLabel
    };
};

export const useGameScreenRouteChoiceProjection = ({
    firstRouteChoiceRequired,
    routeChoiceRequired,
    routeChoiceRequiredCopy,
    routeChoices,
    run
}: {
    firstRouteChoiceRequired: boolean;
    routeChoiceRequired: boolean;
    routeChoiceRequiredCopy: string;
    routeChoices: readonly RouteChoice[];
    run: RunState;
}): GameScreenRouteChoiceProjection => {
    const dungeonMapPresentation = useMemo(() => getDungeonMapPresentation(run.dungeonRun), [run.dungeonRun]);
    const routeDecisionPresentation = useMemo(
        () => routeChoiceRequired ? getDungeonRouteDecisionPresentation(run.dungeonRun, routeChoices) : null,
        [routeChoiceRequired, routeChoices, run.dungeonRun]
    );
    const memoryRecallFeedback = useMemo(() => getMemoryRecallFeedback(run), [run]);
    const memoryChoiceById = useMemo(
        () => new Map(memoryRecallFeedback.choices.map((choice) => [choice.id, choice])),
        [memoryRecallFeedback.choices]
    );
    const cards = useMemo(
        () =>
            (routeDecisionPresentation?.rows ?? []).map((row) =>
                projectRouteChoiceCard({
                    firstRouteChoiceRequired,
                    memoryChoice: memoryChoiceById.get(row.id),
                    row,
                    routeChoices,
                    run
                })
            ),
        [firstRouteChoiceRequired, memoryChoiceById, routeChoices, routeDecisionPresentation?.rows, run]
    );
    const recommendation = useMemo((): GameScreenRouteChoiceRecommendationProjection | null => {
        const readinessScore = { ready: 30, risky: 12, unsafe: -20 } as const;
        const candidate = cards
            .map((card, index) => ({
                card,
                index,
                score:
                    (card.memoryChoice ? readinessScore[card.memoryChoice.readiness] : 0) +
                    (firstRouteChoiceRequired && card.row.routeType === 'safe' ? 4 : 0) -
                    index
            }))
            .filter(({ card }) => card.availability.available)
            .sort((left, right) => right.score - left.score || left.index - right.index)[0];
        if (!candidate) return null;
        const card = candidate.card;
        return {
            ariaLabel: `Recommended route. ${card.row.choiceLabel}. ${card.actionCue.action}. ${trimTerminalPunctuation(
                card.memoryChoice?.readinessLabel ?? card.decisionStack.nextCue
            )}. ${card.beatCue.beatCount} beats. Primary payoff: ${card.primaryPayoff?.value ?? 'none'}.`,
            card
        };
    }, [cards, firstRouteChoiceRequired]);
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
        [memoryRecallFeedback]
    );
    const visibleDungeonMapNodes = useMemo(
        () =>
            dungeonMapPresentation.nodes.filter(
                (node) =>
                    node.status === 'current' ||
                    node.status === 'cleared' ||
                    node.status === 'revealed' ||
                    node.status === 'skipped'
            ),
        [dungeonMapPresentation.nodes]
    );
    const summary =
        routeDecisionPresentation?.summary ??
        routeChoices.map((option) => `${option.label}: ${option.detail}`).join(' · ');

    return {
        cards,
        dungeonMapPresentation,
        memoryRecallFeedback,
        memoryRecallPanelRows,
        recommendation,
        routeChoiceRequired,
        routeChoiceRequiredCopy,
        summary,
        visibleDungeonMapNodes
    };
};
