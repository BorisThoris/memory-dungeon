import type { RunState } from '../../shared/contracts';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import {
    getFeaturedObjectiveLabel,
    getFloorChapterIdentity,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import { formatGameplayDetailRowsLabel } from './gameScreenDecisionSignals';
import {
    type NextFloorSignalRow,
    getNextFloorSignalAudioCue,
    getNextFloorSignalBeatCount,
    getNextFloorSignalScreenCue
} from './gameScreenFloorClearFeedbackModel';

export type GameScreenNextFloorSignalProjection = NextFloorSignalRow & {
    audioCue: ReturnType<typeof getNextFloorSignalAudioCue>;
    beatCount: ReturnType<typeof getNextFloorSignalBeatCount>;
    screenCue: ReturnType<typeof getNextFloorSignalScreenCue>;
};

export interface GameScreenNextFloorProjection {
    clearedNodeCopy: string | null;
    signals: GameScreenNextFloorSignalProjection[];
    signalsLabel: string;
}

export const getGameScreenNextFloorProjection = (
    run: RunState
): GameScreenNextFloorProjection | null => {
    if (run.status !== 'levelComplete' || !run.lastLevelResult) return null;

    const nextFloorPreview =
        run.gameMode === 'endless' && usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion)
            ? pickFloorScheduleEntry(
                  run.runSeed,
                  run.runRulesVersion,
                  run.lastLevelResult.level + 1,
                  run.gameMode
              )
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
    const rows: NextFloorSignalRow[] = [];
    if (nextFloorPreview) {
        rows.push({
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
            rows.push({
                id: 'next-objective',
                label: 'Objective',
                value: nextFloorObjectiveLabel,
                detail: 'Featured payout target',
                tone: 'reward'
            });
        }
        rows.push({
            id: 'next-pressure',
            label: 'Pressure',
            value: nextFloorMutatorNames,
            detail: nextFloorChapterIdentity?.routePreview ?? nextFloorMutatorLabels,
            tone: nextFloorPreview.mutators.length > 0 ? 'pressure' : 'neutral'
        });
        if (nextFloorIdentity) {
            rows.push({
                id: 'next-counterplay',
                label: 'Counterplay',
                value: nextFloorIdentity.label,
                detail: nextFloorIdentity.counterplaySentence,
                tone: 'counterplay'
            });
        }
    }

    const currentDungeonNode =
        run.dungeonRun?.nodes.find((node) => node.id === run.dungeonRun.currentNodeId) ?? null;
    return {
        clearedNodeCopy: currentDungeonNode
            ? `Cleared node: ${currentDungeonNode.label}. Choose a connected room to shape the next board.`
            : null,
        signals: rows.map((row): GameScreenNextFloorSignalProjection => ({
            ...row,
            audioCue: getNextFloorSignalAudioCue(row),
            beatCount: getNextFloorSignalBeatCount(row),
            screenCue: getNextFloorSignalScreenCue(row)
        })),
        signalsLabel: formatGameplayDetailRowsLabel('Next floor preview signals', rows)
    };
};
