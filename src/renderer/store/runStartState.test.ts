import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import {
    createDailyRun,
    createDungeonShowcaseRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createRunSummary,
    createWildRun
} from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    createRestartRunSelection,
    createRunStartPlan,
    createRunStartStatePatch,
    createRunStartTelemetryPayload,
    isDungeonShowcaseRestartRun
} from './runStartState';

const OBSERVED_AT_MS = Date.UTC(2026, 7, 4, 12);
const PROPOSED_RUN_SEED = 91_001;

const createPlan = (
    input: Omit<Parameters<typeof createRunStartPlan>[0], 'observedAtMs' | 'proposedRunSeed'>
) => createRunStartPlan({
    ...input,
    observedAtMs: OBSERVED_AT_MS,
    proposedRunSeed: PROPOSED_RUN_SEED
});

const createRestartedRun = (previousRun: Parameters<typeof createRestartRunSelection>[0], saveData: ReturnType<typeof createDefaultSaveData>) => {
    const selection = createRestartRunSelection(previousRun);
    return createPlan({
        activeContractOverride: selection.activeContractOverride,
        request: selection.request,
        saveData,
        settings: saveData.settings,
        reason: 'restart',
        startingLoadoutId: selection.startingLoadoutId
    })!.run;
};

describe('runStartState', () => {
    it('creates the standard playing-state patch for a new run', () => {
        const saveData = createDefaultSaveData();
        const run = createNewRun(saveData.bestScore);

        expect(createRunStartStatePatch(run, saveData)).toMatchObject({
            boardPinMode: false,
            destroyPairArmed: false,
            dungeonExitPromptOpen: false,
            matchScorePop: null,
            mismatchScorePop: null,
            newlyUnlockedAchievements: [],
            peekModeArmed: false,
            run,
            runStartSaveData: saveData,
            shopReturnMode: null,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            view: 'playing'
        });
    });

    it('builds common run-start telemetry payloads with mode-specific extras', () => {
        const run = createNewRun(0, { practiceMode: true });

        expect(createRunStartTelemetryPayload(run, [], { scholar: true })).toEqual({
            mode: 'endless',
            practice: true,
            scholar: true
        });
    });

    it('creates patched start plans for standard run modes', () => {
        const saveData = createDefaultSaveData();
        const settings = { ...saveData.settings, resolveDelayMultiplier: 1.5 };

        expect(createPlan({ request: { kind: 'endless' }, saveData, settings })).toMatchObject({
            patch: { view: 'playing' },
            run: { gameMode: 'endless', resolveDelayMultiplier: 1.5 },
            telemetry: { mode: 'endless', practice: false }
        });
        expect(createPlan({ request: { kind: 'daily' }, saveData, settings })?.run.gameMode).toBe('daily');
        expect(
            createPlan({ request: { durationMs: 123_000, kind: 'gauntlet' }, saveData, settings })?.run
        ).toMatchObject({
            gameMode: 'gauntlet',
            gauntletSessionDurationMs: 123_000
        });
        expect(createPlan({ request: { kind: 'wild' }, saveData, settings })).toMatchObject({
            run: { wildMenuRun: true },
            telemetry: { wild: true }
        });
    });

    it('creates start plans with mode-specific telemetry extras', () => {
        const saveData = createDefaultSaveData();
        const settings = saveData.settings;
        const puzzle = BUILTIN_PUZZLES.starter_pairs;

        expect(createPlan({ request: { kind: 'dungeonShowcase' }, saveData, settings })).toMatchObject({
            run: { dungeonShowcaseRun: true },
            telemetry: { showcase: 'dungeon' }
        });
        expect(createPlan({ request: { kind: 'puzzle', puzzleId: puzzle.id }, saveData, settings })).toMatchObject({
            run: { gameMode: 'puzzle', puzzleId: puzzle.id },
            telemetry: { puzzleId: puzzle.id }
        });
        expect(
            createPlan({
                request: { kind: 'meditationWithMutators', mutators: ['wide_recall', 'n_back_anchor'] },
                saveData,
                settings
            })
        ).toMatchObject({
            run: { activeMutators: ['wide_recall', 'n_back_anchor'], gameMode: 'meditation' },
            telemetry: { meditation_focus: 'wide_recall,n_back_anchor', meditation_focus_count: 2 }
        });
    });

    it('returns null for unknown puzzle starts without creating a run patch', () => {
        const saveData = createDefaultSaveData();

        expect(
            createPlan({
                request: { kind: 'puzzle', puzzleId: 'missing' },
                saveData,
                settings: saveData.settings
            })
        ).toBeNull();
    });

    it('recognizes live and summarized dungeon showcase runs for restart', () => {
        const run = createDungeonShowcaseRun(0);
        const summary = createRunSummary({ ...run, status: 'gameOver', lives: 0 }, []);

        expect(isDungeonShowcaseRestartRun(run)).toBe(true);
        expect(isDungeonShowcaseRestartRun(summary)).toBe(true);
        expect(isDungeonShowcaseRestartRun(createNewRun(0))).toBe(false);
    });

    it('restarts authored game modes from the previous run type', () => {
        const saveData = createDefaultSaveData();

        expect(createRestartedRun(createDailyRun(0), saveData).gameMode).toBe('daily');
        expect(createRestartedRun(createGauntletRun(0, 123_000), saveData)).toMatchObject({
            gameMode: 'gauntlet',
            gauntletSessionDurationMs: 123_000
        });
        expect(createRestartedRun(createMeditationRun(0, ['wide_recall']), saveData)).toMatchObject({
            gameMode: 'meditation',
            activeMutators: ['wide_recall']
        });
    });

    it('restarts puzzle, wild, practice, and dungeon showcase runs with their mode identity preserved', () => {
        const saveData = createDefaultSaveData();
        const puzzle = BUILTIN_PUZZLES.starter_pairs;

        expect(createRestartedRun(createDungeonShowcaseRun(0), saveData)).toMatchObject({
            dungeonShowcaseRun: true,
            gameMode: 'endless',
            practiceMode: true
        });
        expect(createRestartedRun(createWildRun(0), saveData)).toMatchObject({
            wildMenuRun: true,
            activeMutators: ['sticky_fingers', 'short_memorize', 'findables_floor']
        });
        expect(createRestartedRun(createNewRun(0, { practiceMode: true }), saveData).practiceMode).toBe(true);
        expect(createRestartedRun(createPuzzleRun(0, puzzle.id, puzzle.tiles, 1), saveData)).toMatchObject({
            gameMode: 'puzzle',
            puzzleId: puzzle.id
        });
    });

    it('preserves restart contracts and applies onboarding-safe first floor for plain endless restarts', () => {
        const saveData = {
            ...createDefaultSaveData(),
            onboardingDismissed: false
        };
        const pinVow = createNewRun(0, {
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 10 }
        });
        const scholar = createNewRun(0, {
            activeContract: { noShuffle: true, noDestroy: true, maxMismatches: null }
        });

        expect(createRestartedRun(pinVow, saveData).activeContract).toEqual(pinVow.activeContract);
        expect(createRestartedRun(scholar, saveData).activeContract).toEqual(scholar.activeContract);

        const endless = createRestartedRun(createNewRun(0), saveData);
        expect(endless.gameMode).toBe('endless');
        expect(endless.activeContract).toBeNull();
        expect(endless.wildMenuRun).toBe(false);
    });

    it('preserves starting loadout identity on ordinary restarts', () => {
        const saveData = createDefaultSaveData();
        const previous = createNewRun(0, { startingLoadoutId: 'route_tactician' });
        const restarted = createRestartedRun(previous, saveData);

        expect(restarted.startingLoadoutId).toBe('route_tactician');
        expect(restarted.rewardPerkIds).toContain('free_first_swap_per_floor');
        expect(createRunStartTelemetryPayload(restarted)).toMatchObject({
            startingLoadout: 'route_tactician'
        });
    });
});
