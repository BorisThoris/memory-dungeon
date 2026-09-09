/**
 * Which save fields need a migration when they change, and what happens to a field this build
 * cannot read. Not a migration routine: nothing calls it at load. The save tests hold the schema
 * to it and `yarn audit:save-field-policy` holds every `SaveData` field to a row here.
 *
 * It began life as `dungeon-save-migration.ts`; the dungeon layer is gone (Gen 176) and the
 * table stayed, because it was never about the dungeon.
 */
export type SaveFieldPolicyScope = 'persisted_save' | 'run_local_recoverable';

export interface SaveFieldPolicy {
    field: string;
    scope: SaveFieldPolicyScope;
    owner: 'SaveData' | 'RunSummary' | 'PlayerStatsPersisted' | 'Settings' | 'RunState' | 'BoardState';
    migrationRequiredWhenChanged: boolean;
    recoveryPolicy: string;
}

export const SAVE_FIELD_POLICY_VERSION = 'save-178-v7';

const SAVE_FIELD_POLICIES: readonly SaveFieldPolicy[] = [
    {
        field: 'runHistory',
        scope: 'persisted_save',
        owner: 'SaveData',
        migrationRequiredWhenChanged: true,
        recoveryPolicy:
            'Entries this build cannot read are dropped and the rest of the save loads; a missing history reads as an empty one.'
    },
    {
        field: 'runHistory.shareKey',
        scope: 'persisted_save',
        owner: 'SaveData',
        migrationRequiredWhenChanged: true,
        recoveryPolicy:
            'Keys carry their own md1 prefix, so a later key shape is refused rather than misread; a refused key reads as no key.'
    },
    {
        field: 'lastRunSummary.runSeed',
        scope: 'persisted_save',
        owner: 'RunSummary',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Seeded summaries are preserved for current and older schema versions.'
    },
    {
        field: 'lastRunSummary.runRulesVersion',
        scope: 'persisted_save',
        owner: 'RunSummary',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Rules-version summaries are preserved for current and older schema versions.'
    },
    {
        field: 'lastRunSummary.gameMode',
        scope: 'persisted_save',
        owner: 'RunSummary',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Game mode is retained for summary display; future schema summaries are abandoned.'
    },
    {
        field: 'playerStats.encorePairKeysLastRun',
        scope: 'persisted_save',
        owner: 'PlayerStatsPersisted',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Invalid or missing encore history resets to an empty local history.'
    },
    {
        field: 'playerStats.dailyStreakGraceAvailable',
        scope: 'persisted_save',
        owner: 'PlayerStatsPersisted',
        migrationRequiredWhenChanged: true,
        recoveryPolicy:
            'A missing or invalid grace flag reads as available, so an older save is forgiven its next missed day rather than punished for having no record of one.'
    },
    {
        field: 'playerStats.sharpFloors',
        scope: 'persisted_save',
        owner: 'PlayerStatsPersisted',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'A missing or invalid Sharp-floor count reads as zero; the chain quest starts over rather than the save being refused.'
    },
    {
        field: 'playerStats.feverFloors',
        scope: 'persisted_save',
        owner: 'PlayerStatsPersisted',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'A missing or invalid Fever-floor count reads as zero.'
    },
    {
        field: 'settings.cameraViewportModePreference',
        scope: 'persisted_save',
        owner: 'Settings',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Invalid viewport preferences fall back to the default auto mode.'
    },
    {
        field: 'settings.pairProximityHintsEnabled',
        scope: 'persisted_save',
        owner: 'Settings',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Invalid proximity hint toggles fall back to the default enabled state.'
    }
];

export const getSaveFieldPolicies = (): readonly SaveFieldPolicy[] =>
    SAVE_FIELD_POLICIES;

export const shouldSaveFieldRequireMigration = (field: string): boolean =>
    SAVE_FIELD_POLICIES.some(
        (policy) => policy.field === field && policy.migrationRequiredWhenChanged
    );
