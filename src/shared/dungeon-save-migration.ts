export type DungeonSaveMigrationFieldScope = 'persisted_save' | 'run_local_recoverable';

export interface DungeonSaveMigrationFieldPolicy {
    field: string;
    scope: DungeonSaveMigrationFieldScope;
    owner: 'SaveData' | 'RunSummary' | 'PlayerStatsPersisted' | 'Settings' | 'RunState' | 'BoardState';
    migrationRequiredWhenChanged: boolean;
    recoveryPolicy: string;
}

export const DUNGEON_SAVE_MIGRATION_POLICY_VERSION = 'dng-073-v2';

const DUNGEON_SAVE_MIGRATION_FIELD_POLICIES: readonly DungeonSaveMigrationFieldPolicy[] = [
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
        field: 'playerStats.relicPickCounts',
        scope: 'persisted_save',
        owner: 'PlayerStatsPersisted',
        migrationRequiredWhenChanged: true,
        recoveryPolicy: 'Invalid pick-count maps reset to an empty local counter map.'
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
    },
    {
        field: 'dungeonRun',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Active dungeon map state is rebuilt by starting or continuing a valid run, not persisted in SaveData.'
    },
    {
        field: 'pendingRouteCardPlan',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Pending route intent is floor-local and may be safely dropped with an abandoned active run.'
    },
    {
        field: 'sideRoom',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Side-room choices are regenerated from route flow rather than loaded from SaveData.'
    },
    {
        field: 'bonusRewardLedger',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Anti-grind ledgers are run-local and reset when an invalid active run is abandoned.'
    },
    {
        field: 'dungeonKeys',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Dungeon key inventory is run-only and absent from SaveData migrations.'
    },
    {
        field: 'dungeonMasterKeys',
        scope: 'run_local_recoverable',
        owner: 'RunState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Master keys are run-only and absent from SaveData migrations.'
    },
    {
        field: 'board.dungeonKeysHeld',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Floor-local legacy key count is recovered from active run repair and is treated as iron only when typed counts are absent.'
    },
    {
        field: 'board.dungeonKeysHeldByKind',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Typed floor-local key counts are run-only and are rebuilt by active board generation or abandoned with invalid active runs.'
    },
    {
        field: 'board.dungeonExitTileId',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Board exit references are regenerated with the board and never trusted from SaveData.'
    },
    {
        field: 'board.dungeonExitLockKind',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Board-level exit locks are reconciled from the primary exit tile by active run progression repair.'
    },
    {
        field: 'tile.dungeonExitLockKind',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Exit-tile lock metadata is board-local and repaired with softlock fallback rules for active runs.'
    },
    {
        field: 'tile.dungeonKeyKind',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Typed key and lock card metadata is regenerated with the board and guarded by topology audits rather than persisted save migrations.'
    },
    {
        field: 'board.enemyHazards',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Moving hazard overlays are regenerated with the board and never trusted from SaveData.'
    },
    {
        field: 'board.dungeonBossId',
        scope: 'run_local_recoverable',
        owner: 'BoardState',
        migrationRequiredWhenChanged: false,
        recoveryPolicy: 'Boss board identity is board-local; summaries retain only generic seeded-run metadata.'
    }
];

export const getDungeonSaveMigrationFieldPolicies = (): readonly DungeonSaveMigrationFieldPolicy[] =>
    DUNGEON_SAVE_MIGRATION_FIELD_POLICIES;

export const shouldDungeonSaveFieldRequireMigration = (field: string): boolean =>
    DUNGEON_SAVE_MIGRATION_FIELD_POLICIES.some(
        (policy) => policy.field === field && policy.migrationRequiredWhenChanged
    );
