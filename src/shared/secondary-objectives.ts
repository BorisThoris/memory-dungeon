import type { FeaturedObjectiveId, LevelResult, RunState } from './contracts';
import { getFeaturedObjectiveLabel } from './floor-mutator-schedule';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { getFeaturedObjectiveRewardCopy } from './secondary-objective-rules';
import { parTurnsForFloor, turnsTakenThisFloor } from './floor-par';

export type SecondaryObjectiveState = 'active' | 'completed' | 'failed';
export type LevelResultTagId =
    | FeaturedObjectiveId
    | 'objective_streak'
    | 'boss_floor'
    | 'perfect_scout';

export interface LevelResultTagDefinition {
    id: LevelResultTagId;
    label: string;
    shortCopy: string;
    journalCopy: string;
    priority: number;
    rewardBearing: boolean;
}

export interface SecondaryObjectiveProgress {
    id: FeaturedObjectiveId;
    label: string;
    status: SecondaryObjectiveState;
    state: SecondaryObjectiveState;
    condition: string;
    detail: string;
    failureReason: string | null;
    reward: string;
}

export const LEVEL_RESULT_TAG_DEFINITIONS: Record<LevelResultTagId, LevelResultTagDefinition> = {
    scholar_style: {
        id: 'scholar_style',
        label: 'Scholar style',
        shortCopy: 'No shuffle, swap, or destroy.',
        journalCopy: 'Cleared without spending shuffle, swap, or destroy tools.',
        priority: 60,
        rewardBearing: true
    },
    cursed_last: {
        id: 'cursed_last',
        label: 'Cursed last',
        shortCopy: 'Cursed pair last.',
        journalCopy: 'Matched the cursed pair last among real pairs.',
        priority: 55,
        rewardBearing: true
    },
    flip_par: {
        id: 'flip_par',
        label: 'Flip par',
        shortCopy: 'Cleared within par.',
        journalCopy: 'Cleared the floor within its par of turns.',
        priority: 55,
        rewardBearing: true
    },
    objective_streak: {
        id: 'objective_streak',
        label: 'Objective streak',
        shortCopy: 'Streak bonus.',
        journalCopy: 'Featured-objective streak paid an additional score bonus.',
        priority: 70,
        rewardBearing: true
    },
    boss_floor: {
        id: 'boss_floor',
        label: 'Boss floor',
        shortCopy: 'Boss multiplier.',
        journalCopy: 'Boss floor score multiplier applied after bonuses.',
        priority: 80,
        rewardBearing: true
    },
    perfect_scout: {
        id: 'perfect_scout',
        label: 'Perfect scout',
        shortCopy: 'Perfect scout.',
        journalCopy: 'Cleared with no mistakes, no peek reveal, and no shuffle/swap/destroy tools.',
        priority: 65,
        rewardBearing: false
    }
};

const uniqueTags = <Tag extends string>(tags: readonly Tag[]): Tag[] => [...new Set(tags)];

const isLevelResultTagId = (value: string): value is LevelResultTagId =>
    Object.prototype.hasOwnProperty.call(LEVEL_RESULT_TAG_DEFINITIONS, value);

export const getFloorClearLevelResultTags = (run: RunState, perfect: boolean): LevelResultTagId[] =>
    perfect &&
    runArrayCount(run.peekRevealedTileIds) === 0 &&
    !run.shuffleUsedThisFloor
        ? ['perfect_scout']
        : [];

export const getLevelResultTagDefinitions = (tags: readonly string[] = []): LevelResultTagDefinition[] =>
    uniqueTags(tags)
        .filter(isLevelResultTagId)
        .map((id) => LEVEL_RESULT_TAG_DEFINITIONS[id])
        .sort((a, b) => b.priority - a.priority);

export const getVisibleLevelResultTags = (
    tags: readonly string[] | undefined,
    maxVisible: number = 3
): LevelResultTagDefinition[] => getLevelResultTagDefinitions(tags).slice(0, maxVisible);

export const formatLevelResultTagLabel = (tag: string): string =>
    isLevelResultTagId(tag) ? LEVEL_RESULT_TAG_DEFINITIONS[tag].label : tag;

export const getSecondaryObjectiveProgress = (run: RunState): SecondaryObjectiveProgress | null => {
    const board = run.board;
    const id = board?.featuredObjectiveId;
    if (!board || !id) {
        return null;
    }
    const label = getFeaturedObjectiveLabel(id) ?? id;
    let state: SecondaryObjectiveState = 'active';
    let detail = '';
    let condition = '';
    let failureReason: string | null = null;

    if (run.lastLevelResult?.featuredObjectiveId === id) {
        state = run.lastLevelResult.featuredObjectiveCompleted ? 'completed' : 'failed';
        const reward = getFeaturedObjectiveRewardCopy(id);
        return {
            id,
            label,
            status: state,
            state,
            condition: state === 'completed' ? 'Objective completed on floor clear.' : 'Objective missed on floor clear.',
            detail: state === 'completed' ? `${label} completed.` : `${label} missed.`,
            failureReason: state === 'failed' ? 'Objective missed before floor clear.' : null,
            reward
        };
    }

    switch (id) {
        case 'scholar_style':
            state = run.shuffleUsedThisFloor ? 'failed' : 'active';
            condition = 'Clear without shuffle, swap, or destroy.';
            failureReason = state === 'failed' ? 'Shuffle, swap, or destroy was used this floor.' : null;
            detail = state === 'failed' ? `Failed: ${failureReason}` : 'Do not use shuffle, swap, or destroy this floor.';
            break;
        case 'cursed_last':
            state = run.cursedMatchedEarlyThisFloor ? 'failed' : 'active';
            condition = 'Clear the cursed pair last among real pairs.';
            failureReason = state === 'failed' ? 'The cursed pair was matched early.' : null;
            detail = state === 'failed' ? `Failed: ${failureReason}` : 'Clear the cursed pair last among real pairs.';
            break;
        case 'flip_par': {
            const par = parTurnsForFloor(board.pairCount);
            const turns = turnsTakenThisFloor(run);
            state = turns > par ? 'failed' : 'active';
            condition = `Clear within par (${turns}/${par} turns).`;
            failureReason = state === 'failed' ? `Par exceeded (${turns}/${par} turns).` : null;
            detail =
                state === 'failed'
                    ? `Failed: ${failureReason}`
                    : `Clear the floor within ${turns}/${par} turns.`;
            break;
        }
        default:
            condition = 'Complete the featured objective before clearing the floor.';
            detail = 'Complete the featured objective before clearing the floor.';
            break;
    }

    return {
        id,
        label,
        status: state,
        state,
        condition,
        detail,
        failureReason,
        reward: getFeaturedObjectiveRewardCopy(id)
    };
};

export const getSecondaryObjectiveStatusRows = (run: RunState): SecondaryObjectiveProgress[] => {
    const progress = getSecondaryObjectiveProgress(run);
    return progress ? [progress] : [];
};

export const formatLevelResultObjectiveLine = (result: LevelResult): string | null => {
    if (!result.featuredObjectiveId) {
        return null;
    }
    const label = getFeaturedObjectiveLabel(result.featuredObjectiveId) ?? result.featuredObjectiveId;
    if (result.featuredObjectiveCompleted) {
        const objectiveBonusScore = runNonNegativeInteger(result.objectiveBonusScore);
        const bonus = objectiveBonusScore > 0 ? ` (+${objectiveBonusScore} score)` : '';
        return `${label}: Complete${bonus}`;
    }
    return `${label}: Missed — no objective bonus.`;
};
