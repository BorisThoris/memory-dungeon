import type { BoardState, FeaturedObjectiveId, LevelResult, RunState } from './contracts';
import { getFeaturedObjectiveLabel } from './floor-mutator-schedule';

export type SecondaryObjectiveState = 'active' | 'completed' | 'failed';
export type LevelResultTagId =
    | FeaturedObjectiveId
    | 'objective_streak'
    | 'boss_floor'
    | 'boss_defeated'
    | 'traps_disarmed'
    | 'treasure_claimed'
    | 'route_claimed'
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

const flipParLimit = (pairCount: number): number => Math.ceil(pairCount * 1.25) + 2;

export const LEVEL_RESULT_TAG_DEFINITIONS: Record<LevelResultTagId, LevelResultTagDefinition> = {
    scholar_style: {
        id: 'scholar_style',
        label: 'Scholar style',
        shortCopy: 'No shuffle or destroy.',
        journalCopy: 'Cleared without spending shuffle or destroy tools.',
        priority: 60,
        rewardBearing: true
    },
    glass_witness: {
        id: 'glass_witness',
        label: 'Glass witness',
        shortCopy: 'Glass decoy avoided.',
        journalCopy: 'Kept the glass decoy out of every mismatch.',
        priority: 55,
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
        journalCopy: 'Stayed within the match-resolution par for the floor.',
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
    boss_defeated: {
        id: 'boss_defeated',
        label: 'Boss defeated',
        shortCopy: 'Boss defeated.',
        journalCopy: 'Defeated the boss card or patrol required by the dungeon objective.',
        priority: 100,
        rewardBearing: false
    },
    traps_disarmed: {
        id: 'traps_disarmed',
        label: 'Traps disarmed',
        shortCopy: 'Trap objective cleared.',
        journalCopy: 'Resolved dungeon trap pressure before leaving the floor.',
        priority: 90,
        rewardBearing: false
    },
    treasure_claimed: {
        id: 'treasure_claimed',
        label: 'Treasure claimed',
        shortCopy: 'Treasure looted.',
        journalCopy: 'Claimed a treasure, cache, or locked reward on the floor.',
        priority: 85,
        rewardBearing: false
    },
    route_claimed: {
        id: 'route_claimed',
        label: 'Route claimed',
        shortCopy: 'Route locked.',
        journalCopy: 'Claimed a route gateway or route exit for the next floor.',
        priority: 75,
        rewardBearing: false
    },
    perfect_scout: {
        id: 'perfect_scout',
        label: 'Perfect scout',
        shortCopy: 'Perfect scout.',
        journalCopy: 'Cleared with no mistakes, no peek reveal, and no shuffle/destroy tools.',
        priority: 65,
        rewardBearing: false
    }
};

const uniqueTags = (tags: readonly string[]): string[] => [...new Set(tags)];

export const getDungeonLevelResultTags = (run: RunState, board: BoardState, perfect: boolean): LevelResultTagId[] => {
    const tags: LevelResultTagId[] = [];
    if (board.floorTag === 'boss' && (run.dungeonEnemiesDefeatedThisFloor ?? 0) > 0) {
        tags.push('boss_defeated');
    }
    if ((run.dungeonTrapsResolvedThisFloor ?? 0) > 0) {
        tags.push('traps_disarmed');
    }
    if ((run.dungeonTreasuresOpenedThisFloor ?? 0) > 0) {
        tags.push('treasure_claimed');
    }
    if ((run.dungeonGatewaysUsedThisFloor ?? 0) > 0 || board.selectedGatewayRouteType != null) {
        tags.push('route_claimed');
    }
    if (
        perfect &&
        run.peekRevealedTileIds.length === 0 &&
        !run.shuffleUsedThisFloor &&
        !run.destroyUsedThisFloor
    ) {
        tags.push('perfect_scout');
    }
    return uniqueTags(tags) as LevelResultTagId[];
};

export const getLevelResultTagDefinitions = (tags: readonly string[] = []): LevelResultTagDefinition[] =>
    uniqueTags(tags)
        .map((id) => LEVEL_RESULT_TAG_DEFINITIONS[id as LevelResultTagId])
        .filter((definition): definition is LevelResultTagDefinition => definition != null)
        .sort((a, b) => b.priority - a.priority);

export const getVisibleLevelResultTags = (
    tags: readonly string[] | undefined,
    maxVisible: number = 3
): LevelResultTagDefinition[] => getLevelResultTagDefinitions(tags).slice(0, maxVisible);

export const formatLevelResultTagLabel = (tag: string): string =>
    LEVEL_RESULT_TAG_DEFINITIONS[tag as LevelResultTagId]?.label ?? tag;

const objectiveReward = (id: FeaturedObjectiveId): string => {
    switch (id) {
        case 'scholar_style':
            return '+40 score and featured-objective Favor when scheduled.';
        case 'glass_witness':
            return '+35 score and featured-objective Favor when scheduled.';
        case 'cursed_last':
            return '+50 score and featured-objective Favor when scheduled.';
        case 'flip_par':
            return '+30 score and featured-objective Favor when scheduled.';
        default:
            return 'Bonus score and Favor when scheduled.';
    }
};

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
        const reward = objectiveReward(id);
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
            state = run.shuffleUsedThisFloor || run.destroyUsedThisFloor ? 'failed' : 'active';
            condition = 'Clear without shuffle or destroy.';
            failureReason = state === 'failed' ? 'Shuffle or destroy was used this floor.' : null;
            detail = state === 'failed' ? `Failed: ${failureReason}` : 'Do not use shuffle or destroy this floor.';
            break;
        case 'glass_witness':
            state = run.decoyFlippedThisFloor ? 'failed' : 'active';
            condition = 'Keep the glass decoy out of every mismatch.';
            failureReason = state === 'failed' ? 'The glass decoy entered a mismatch.' : null;
            detail = state === 'failed' ? `Failed: ${failureReason}` : 'Keep the glass decoy out of every mismatch.';
            break;
        case 'cursed_last':
            state = run.cursedMatchedEarlyThisFloor ? 'failed' : 'active';
            condition = 'Clear the cursed pair last among real pairs.';
            failureReason = state === 'failed' ? 'The cursed pair was matched early.' : null;
            detail = state === 'failed' ? `Failed: ${failureReason}` : 'Clear the cursed pair last among real pairs.';
            break;
        case 'flip_par': {
            const limit = flipParLimit(board.pairCount);
            state = run.matchResolutionsThisFloor > limit ? 'failed' : 'active';
            condition = `Stay within match-resolution par (${run.matchResolutionsThisFloor}/${limit}).`;
            failureReason = state === 'failed' ? `Match-resolution par exceeded (${run.matchResolutionsThisFloor}/${limit}).` : null;
            detail =
                state === 'failed'
                    ? `Failed: ${failureReason}`
                    : `Stay within ${run.matchResolutionsThisFloor}/${limit} match resolutions.`;
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
        reward: objectiveReward(id)
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
        const bonus = result.objectiveBonusScore ? ` (+${result.objectiveBonusScore} score)` : '';
        return `${label}: Complete${bonus}`;
    }
    return `${label}: Missed — no objective bonus.`;
};
