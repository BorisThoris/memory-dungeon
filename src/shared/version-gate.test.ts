import { describe, expect, it } from 'vitest';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, SAVE_SCHEMA_VERSION } from './contracts';
import { FLOOR_SCHEDULE_RULES_VERSION } from './floor-mutator-schedule';
import {
    CURRENT_VERSION_MANIFEST,
    assessVersionGate,
    evaluateSaveMigrationGate,
    evaluateVersionGate,
    formatVersionGateSummary,
    shouldBumpForChange
} from './version-gate';

describe('REG-089 local version gate', () => {
    it('publishes a local-only manifest for release and migration bots', () => {
        expect(CURRENT_VERSION_MANIFEST).toEqual({
            saveSchemaVersion: SAVE_SCHEMA_VERSION,
            gameRulesVersion: GAME_RULES_VERSION,
            floorScheduleRulesVersion: FLOOR_SCHEDULE_RULES_VERSION,
            authority: 'local_client',
            onlineAuthority: false,
            migrationEntryPoints: ['normalizeSaveData', 'createDefaultSaveData']
        });
        expect(formatVersionGateSummary(CURRENT_VERSION_MANIFEST)).toBe(
            [
                `SAVE_SCHEMA_VERSION=${SAVE_SCHEMA_VERSION}`,
                `GAME_RULES_VERSION=${GAME_RULES_VERSION}`,
                `FLOOR_SCHEDULE_RULES_VERSION=${FLOOR_SCHEDULE_RULES_VERSION}`,
                'authority=local_client',
                'onlineAuthority=false'
            ].join(' · ')
        );
    });

    it('requires save schema review for persisted contract or migration changes', () => {
        const decision = assessVersionGate({
            kinds: ['copy_only'],
            touchedContracts: ['Settings', 'PlayerStatsPersisted']
        });

        expect(decision.requiredBumps).toEqual(['save_schema']);
        expect(decision.migrationRequired).toBe(true);
        expect(decision.localOnly).toBe(true);
        expect(decision.onlineAuthorityAllowed).toBe(false);
        expect(decision.reasons).toContain(
            'Persisted save/settings/player-stats shape changed; bump SAVE_SCHEMA_VERSION and extend normalization fixtures.'
        );
        expect(decision.validationCommands).toContain(
            'yarn vitest run src/shared/save-data.test.ts src/shared/version-gate.test.ts'
        );
    });

    it('requires game rules review for run contracts, catalog ids, daily identity, and player-visible rules', () => {
        const decision = assessVersionGate({
            kinds: ['catalog_ids', 'daily_identity'],
            touchedContracts: ['RunState', 'RelicId', 'MutatorId', 'FindableKind'],
            playerVisibleRuleChange: true,
            changesDailyIdentity: true
        });

        expect(decision.requiredBumps).toEqual(['game_rules']);
        expect(decision.migrationRequired).toBe(false);
        expect(decision.reasons).toEqual(
            expect.arrayContaining([
                'Player-visible run rules, catalogs, or generated board identity changed; bump GAME_RULES_VERSION.',
                'Daily/shared seed identity changed; GAME_RULES_VERSION must separate old and new daily runs.'
            ])
        );
        expect(decision.validationCommands).toContain(
            'yarn vitest run src/shared/game.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/version-gate.test.ts'
        );
    });

    it('covers the current findable weighting rules under the game-rules gate', () => {
        expect(GAME_RULES_VERSION).toBe(32);
        expect(FINDABLE_KIND_SPAWN_WEIGHTS).toEqual({
            shard_spark: 35,
            score_glint: 35,
            ward_spark: 15,
            scout_glint: 15
        });

        const decision = assessVersionGate({
            kinds: ['gameplay_rules', 'generation_rules'],
            touchedContracts: ['FindableKind'],
            playerVisibleRuleChange: true
        });

        expect(decision.requiredBumps).toEqual(['game_rules']);
    });

    it('requires floor schedule review independently from game rules', () => {
        const decision = assessVersionGate({ kinds: ['floor_schedule'] });

        expect(decision.requiredBumps).toEqual(['floor_schedule']);
        expect(decision.reasons).toContain(
            'Authored endless floor schedule changed; bump FLOOR_SCHEDULE_RULES_VERSION and schedule tests.'
        );
    });

    it('does not require version bumps for UI, copy, asset, or telemetry-only changes', () => {
        const decision = assessVersionGate({
            kinds: ['ui_only', 'copy_only', 'asset_only', 'telemetry_only']
        });

        expect(decision.requiredBumps).toEqual([]);
        expect(decision.migrationRequired).toBe(false);
        expect(decision.localOnly).toBe(true);
        expect(decision.onlineAuthorityAllowed).toBe(false);
        expect(decision.reasons).toEqual([
            'No persisted schema, generated-rule, schedule, or daily identity bump required.'
        ]);
    });

    it('keeps legacy evaluateVersionGate and shouldBumpForChange behavior aligned', () => {
        expect(evaluateVersionGate(['save_shape']).requiresSaveSchemaVersionBump).toBe(true);
        expect(evaluateVersionGate(['board_generation']).requiresGameRulesVersionBump).toBe(true);
        expect(evaluateVersionGate(['floor_schedule']).requiresFloorScheduleRulesVersionBump).toBe(true);
        expect(evaluateVersionGate(['ui_only']).requiresOnlineAuthority).toBe(false);

        expect(shouldBumpForChange('save_shape')).toEqual({
            save: true,
            rules: false,
            floorSchedule: false
        });
        expect(shouldBumpForChange('gameplay_rules').rules).toBe(true);
        expect(shouldBumpForChange('floor_schedule').floorSchedule).toBe(true);
        expect(shouldBumpForChange('asset_only')).toEqual({
            save: false,
            rules: false,
            floorSchedule: false
        });
    });

    it('normalizes migration gate metadata without trusting newer unknown last-run summaries', () => {
        expect(evaluateSaveMigrationGate({ schemaVersion: SAVE_SCHEMA_VERSION - 1 })).toEqual({
            keepLastRunSummary: true,
            sourceSchemaVersion: SAVE_SCHEMA_VERSION - 1,
            normalizedSchemaVersion: SAVE_SCHEMA_VERSION
        });
        expect(evaluateSaveMigrationGate({ schemaVersion: SAVE_SCHEMA_VERSION + 1 })).toEqual({
            keepLastRunSummary: false,
            sourceSchemaVersion: SAVE_SCHEMA_VERSION + 1,
            normalizedSchemaVersion: SAVE_SCHEMA_VERSION
        });
        expect(evaluateSaveMigrationGate({ schemaVersion: Number.NaN })).toEqual({
            keepLastRunSummary: true,
            sourceSchemaVersion: null,
            normalizedSchemaVersion: SAVE_SCHEMA_VERSION
        });
    });
});
