import { describe, expect, it } from 'vitest';
import { createNewRun, createWildRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { buildClassicRunOptions, DEFAULT_CLASSIC_RUN_SETUP } from '../../shared/classic-run-setup';
import {
    createRestartRun,
    createRunStartPlan,
    createRunStartStatePatch,
    createRunStartTelemetryPayload
} from './runStartState';

describe('runStartState', () => {
    it('creates the standard playing-state patch for a new run', () => {
        const saveData = createDefaultSaveData();
        const run = createNewRun(saveData.bestScore);

        expect(createRunStartStatePatch(run, saveData)).toMatchObject({
            boardPinMode: false,
            destroyPairArmed: false,
            matchScorePop: null,
            mismatchScorePop: null,
            newlyUnlockedAchievements: [],
            peekModeArmed: false,
            run,
            runStartSaveData: saveData,
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
        // The joker is a Classic setup option now, not its own start request.
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



    it('restarts a setup-sheet run from the previous run type', () => {
        const saveData = createDefaultSaveData();

        // A setup-sheet run: the pace and both vows all come back, not only the vow.
        const chosen = createNewRun(0, buildClassicRunOptions({ ...DEFAULT_CLASSIC_RUN_SETUP, pacing: 'calm', vows: ['scholar', 'pin_vow'] }));
        expect(createRestartRun(chosen, saveData)).toMatchObject({
            gameMode: 'endless',
            resolveDelayMultiplier: 1.35,
            activeContract: { noShuffle: true, noDestroy: true, maxPinsTotalRun: 10 }
        });
    });

    it('restarts wild and practice runs with their setup preserved', () => {
        const saveData = createDefaultSaveData();

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
