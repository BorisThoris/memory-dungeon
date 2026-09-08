import { describe, expect, it } from 'vitest';
import {
    createDungeonShowcaseRun,
    createNewRun,
    createRunSummary,
    createWildRun
} from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { buildClassicRunOptions, DEFAULT_CLASSIC_RUN_SETUP } from '../../shared/classic-run-setup';
import {
    createRestartRun,
    createRunStartPlan,
    createRunStartStatePatch,
    createRunStartTelemetryPayload,
    isDungeonShowcaseRestartRun
} from './runStartState';

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

        expect(createRunStartTelemetryPayload(run, { scholar: true })).toEqual({
            mode: 'endless',
            practice: true,
            scholar: true
        });
    });

    it('creates patched start plans for standard run modes', () => {
        const saveData = createDefaultSaveData();
        const settings = { ...saveData.settings, resolveDelayMultiplier: 1.5 };

        expect(createRunStartPlan({ request: { kind: 'endless' }, saveData, settings })).toMatchObject({
            patch: { view: 'playing' },
            run: { gameMode: 'endless', resolveDelayMultiplier: 1.5 },
            telemetry: { mode: 'endless', practice: false }
        });
        // The timer and the joker are Classic setup options now, not their own start requests.
        expect(
            createRunStartPlan({
                request: { kind: 'endless', setup: { ...DEFAULT_CLASSIC_RUN_SETUP, pressure: 'timed_5' } },
                saveData,
                settings
            })?.run
        ).toMatchObject({ gauntletSessionDurationMs: 300_000 });
        expect(
            createRunStartPlan({
                request: { kind: 'endless', setup: { ...DEFAULT_CLASSIC_RUN_SETUP, chaos: true } },
                saveData,
                settings
            })?.run.activeMutators
        ).toContain('sticky_fingers');
    });

    it('creates start plans with setup-specific telemetry extras', () => {
        const saveData = createDefaultSaveData();
        const settings = saveData.settings;

        expect(
            createRunStartPlan({
                request: {
                    kind: 'endless',
                    setup: { ...DEFAULT_CLASSIC_RUN_SETUP, focusMutators: ['wide_recall', 'n_back_anchor'] }
                },
                saveData,
                settings
            })?.run.activeMutators
        ).toEqual(['wide_recall', 'n_back_anchor']);
    });


    it('recognizes live and summarized dungeon showcase runs for restart', () => {
        const run = createDungeonShowcaseRun(0);
        const summary = createRunSummary({ ...run, status: 'gameOver', lives: 0 }, []);

        expect(isDungeonShowcaseRestartRun(run)).toBe(true);
        expect(isDungeonShowcaseRestartRun(summary)).toBe(true);
        expect(isDungeonShowcaseRestartRun(createNewRun(0))).toBe(false);
    });

    it('restarts a setup-sheet run from the previous run type', () => {
        const saveData = createDefaultSaveData();

        // A setup-sheet run: the clock, the pace and both vows all come back, not only the vow.
        const chosen = createNewRun(0, buildClassicRunOptions({ ...DEFAULT_CLASSIC_RUN_SETUP, pacing: 'calm', pressure: 'timed_5', vows: ['scholar', 'pin_vow'] }));
        expect(createRestartRun(chosen, saveData)).toMatchObject({
            gameMode: 'endless',
            gauntletSessionDurationMs: 5 * 60 * 1000,
            resolveDelayMultiplier: 1.35,
            activeContract: { noShuffle: true, noDestroy: true, maxPinsTotalRun: 10 }
        });
    });

    it('restarts wild, practice, and dungeon showcase runs with their setup preserved', () => {
        const saveData = createDefaultSaveData();

        expect(createRestartRun(createDungeonShowcaseRun(0), saveData)).toMatchObject({
            dungeonShowcaseRun: true,
            gameMode: 'endless',
            practiceMode: true
        });
        expect(createRestartRun(createWildRun(0), saveData)).toMatchObject({
            wildMenuRun: true,
            activeMutators: ['sticky_fingers', 'short_memorize', 'findables_floor']
        });
        expect(createRestartRun(createNewRun(0, { practiceMode: true }), saveData).practiceMode).toBe(true);
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

        expect(createRestartRun(pinVow, saveData).activeContract).toEqual(pinVow.activeContract);
        expect(createRestartRun(scholar, saveData).activeContract).toEqual(scholar.activeContract);

        const endless = createRestartRun(createNewRun(0), saveData);
        expect(endless.gameMode).toBe('endless');
        expect(endless.activeContract).toBeNull();
        expect(endless.wildMenuRun).toBe(false);
    });

});
