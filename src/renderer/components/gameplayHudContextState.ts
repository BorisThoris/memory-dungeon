import { getBossEncounterIdentityForFloor, getFloorIdentityContract } from '../../shared/boss-encounters';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import { type MutatorId, type RunState } from '../../shared/contracts';
import { getActiveDungeonBossPressureRule } from '../../shared/dungeon-boss-rules';
import {
    getFloorArchetypeDefinition,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { getRunEconomyEntry } from '../../shared/run-economy';
import { SHOP_ITEM_CATALOG } from '../../shared/shop-rules';
import {
    buildGameplayHudContextChips,
    type GameplayHudContextChipMeta
} from './gameplayHudMutatorChipMeta';

const buildHudModeLabel = ({
    gauntletRemainingMs,
    run
}: {
    gauntletRemainingMs: number | null;
    run: RunState;
}): string => {
    const board = run.board;
    const puzzleModeTitle = run.puzzleId ? (BUILTIN_PUZZLES[run.puzzleId]?.title ?? run.puzzleId) : null;
    const dungeonShowcaseActive =
        run.practiceMode &&
        run.gameMode === 'endless' &&
        board?.level >= 5 &&
        run.activeMutators.includes('wide_recall') &&
        !run.wildMenuRun &&
        run.activeContract == null;

    if (run.gameMode === 'daily' && run.dailyDateKeyUtc) {
        return 'Daily challenge';
    }
    if (gauntletRemainingMs !== null) {
        return 'Gauntlet';
    }
    if (dungeonShowcaseActive) {
        return 'Dungeon Showcase';
    }
    if (run.gameMode === 'puzzle') {
        return puzzleModeTitle ? `Puzzle: ${puzzleModeTitle}` : 'Puzzle';
    }
    if (run.activeContract?.noShuffle) {
        return 'Scholar Contract';
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        return 'Pin vow';
    }
    if (run.gameMode === 'meditation') {
        return 'Meditation Run';
    }
    if (run.wildMenuRun) {
        return 'Wild Run';
    }
    if (run.practiceMode) {
        return 'Practice';
    }
    if (run.gameMode === 'endless') {
        return 'Classic Dungeon';
    }
    return 'Arcade Run';
};

export const temporaryCurrencyPurpose = (run: RunState, currencyId: string): string | undefined =>
    getRunEconomyEntry(run, currencyId)?.purpose;

export interface GameplayHudContextState {
    archetype: ReturnType<typeof getFloorArchetypeDefinition>;
    bossCounterplayTitle: string;
    bossReminderText: string;
    bossReminderTitle: string;
    contextChips: GameplayHudContextChipMeta[];
    encounterIdentity: ReturnType<typeof getBossEncounterIdentityForFloor>;
    endlessChapterActive: boolean;
    floorIdentity: ReturnType<typeof getFloorIdentityContract>;
    hudModeLabel: string;
    mutatorsForChips: MutatorId[];
    nBackLabel: string | null;
    parasiteFloorProgress: number;
    resourceSegmentTitle: string;
    scoreParasiteActive: boolean;
    showMutatorChipRow: boolean;
    showNoMutatorsCopy: boolean;
}

export const buildGameplayHudContextState = ({
    featuredObjectiveLabel,
    gauntletRemainingMs,
    run
}: {
    featuredObjectiveLabel: string | null;
    gauntletRemainingMs: number | null;
    run: RunState;
}): GameplayHudContextState => {
    const board = run.board;
    if (!board) {
        throw new Error('Gameplay HUD context requires an active board.');
    }

    const resourceSegmentTitle = [
        temporaryCurrencyPurpose(run, 'combo_shards'),
        'Guard tokens absorb mismatch damage before lives are lost.'
    ]
        .filter(Boolean)
        .join(' ');
    const nBackMutatorActive = run.activeMutators.includes('n_back_anchor');
    const nBackLabel =
        run.nBackAnchorPairKey && nBackMutatorActive ? `Anchor ${run.nBackAnchorPairKey.slice(0, 6)}` : null;
    const scoreParasiteActive = run.activeMutators.includes('score_parasite');
    const parasiteFloorProgress = Math.min(1, run.parasiteFloors / 4);
    const mutatorsForChips = run.activeMutators.filter((id) => !(scoreParasiteActive && id === 'score_parasite'));
    const contextChips = buildGameplayHudContextChips(run);
    const endlessChapterActive =
        run.gameMode === 'endless' &&
        usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
        board.floorArchetypeId != null;
    const archetype = getFloorArchetypeDefinition(board.floorArchetypeId);
    const floorIdentity = getFloorIdentityContract({
        floorTag: board.floorTag ?? 'normal',
        floorArchetypeId: board.floorArchetypeId,
        featuredObjectiveLabel,
        mutators: run.activeMutators
    });
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

    return {
        archetype,
        bossCounterplayTitle,
        bossReminderText,
        bossReminderTitle,
        contextChips,
        encounterIdentity,
        endlessChapterActive,
        floorIdentity,
        hudModeLabel: buildHudModeLabel({ gauntletRemainingMs, run }),
        mutatorsForChips,
        nBackLabel,
        parasiteFloorProgress,
        resourceSegmentTitle,
        scoreParasiteActive,
        showMutatorChipRow: contextChips.length > 0 || mutatorsForChips.length > 0,
        showNoMutatorsCopy: run.activeMutators.length === 0 && contextChips.length === 0
    };
};
