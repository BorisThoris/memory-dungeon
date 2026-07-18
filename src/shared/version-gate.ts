import { GAME_RULES_VERSION, SAVE_SCHEMA_VERSION } from './contracts';
import { FLOOR_SCHEDULE_RULES_VERSION } from './floor-mutator-schedule';

export type VersionedSurface = 'save_schema' | 'game_rules' | 'floor_schedule';
export type VersionedSurfaceChange =
    | 'save_shape'
    | 'save_migration'
    | 'board_generation'
    | 'gameplay_rules'
    | 'floor_schedule'
    | 'daily_identity'
    | 'catalog_ids'
    | 'copy_only'
    | 'ui_only'
    | 'asset_only'
    | 'telemetry_only';

export interface VersionManifest {
    saveSchemaVersion: number;
    gameRulesVersion: number;
    floorScheduleRulesVersion: number;
    /** REG-052 / REG-089: v1 version authority is local and offline, never server-backed. */
    authority: 'local_client';
    onlineAuthority: false;
    migrationEntryPoints: readonly string[];
}

export const CURRENT_VERSION_MANIFEST: VersionManifest = {
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    gameRulesVersion: GAME_RULES_VERSION,
    floorScheduleRulesVersion: FLOOR_SCHEDULE_RULES_VERSION,
    authority: 'local_client',
    onlineAuthority: false,
    migrationEntryPoints: ['normalizeSaveData', 'createDefaultSaveData']
} as const;

export const CURRENT_VERSION_GATE = CURRENT_VERSION_MANIFEST;

export type VersionGateChangeKind =
    | 'save_shape'
    | 'save_migration'
    | 'board_generation'
    | 'gameplay_rules'
    | 'generation_rules'
    | 'floor_schedule'
    | 'daily_identity'
    | 'catalog_ids'
    | 'copy_only'
    | 'ui_only'
    | 'asset_only'
    | 'telemetry_only';

export interface VersionGateChange {
    kinds: readonly VersionGateChangeKind[];
    touchedContracts?: readonly string[];
    playerVisibleRuleChange?: boolean;
    changesDailyIdentity?: boolean;
}

export interface VersionGateDecision {
    requiredBumps: readonly VersionedSurface[];
    migrationRequired: boolean;
    localOnly: true;
    onlineAuthorityAllowed: false;
    reasons: readonly string[];
    validationCommands: readonly string[];
}

export interface LegacyVersionGateDecision {
    requiresSaveSchemaVersionBump: boolean;
    requiresGameRulesVersionBump: boolean;
    requiresFloorScheduleRulesVersionBump: boolean;
    requiresOnlineAuthority: false;
    requiredChecks: string[];
}

const SAVE_CONTRACTS = new Set(['SaveData', 'Settings', 'PlayerStatsPersisted', 'AchievementState']);
const RULE_CONTRACTS = new Set([
    'RunState',
    'RunModeDefinition',
    'RelicId',
    'MutatorId',
    'FindableKind',
    'Tile',
    'BoardState',
    'LevelResult',
    'RunSummary'
]);

const add = (set: Set<VersionedSurface>, surface: VersionedSurface): void => {
    set.add(surface);
};

const intersects = (values: readonly string[] | undefined, known: ReadonlySet<string>): boolean =>
    (values ?? []).some((value) => known.has(value));

/**
 * REG-089 rules/versioning gate.
 *
 * This function is deliberately deterministic and conservative so bots can run the same decision before merging
 * gameplay/app refinements. It does not bump constants automatically; it tells the slice owner which surfaces must be
 * reviewed and tested. Online/server authority is explicitly disallowed for v1 per REG-052.
 */
export const assessVersionGate = (change: VersionGateChange): VersionGateDecision => {
    const required = new Set<VersionedSurface>();
    const reasons: string[] = [];
    const kinds = new Set(change.kinds);

    if (
        kinds.has('save_shape') ||
        kinds.has('save_migration') ||
        intersects(change.touchedContracts, SAVE_CONTRACTS)
    ) {
        add(required, 'save_schema');
        reasons.push('Persisted save/settings/player-stats shape changed; bump SAVE_SCHEMA_VERSION and extend normalization fixtures.');
    }

    if (
        kinds.has('generation_rules') ||
        kinds.has('board_generation') ||
        kinds.has('gameplay_rules') ||
        kinds.has('catalog_ids') ||
        change.playerVisibleRuleChange === true ||
        intersects(change.touchedContracts, RULE_CONTRACTS)
    ) {
        add(required, 'game_rules');
        reasons.push('Player-visible run rules, catalogs, or generated board identity changed; bump GAME_RULES_VERSION.');
    }

    if (kinds.has('floor_schedule')) {
        add(required, 'floor_schedule');
        reasons.push('Authored endless floor schedule changed; bump FLOOR_SCHEDULE_RULES_VERSION and schedule tests.');
    }

    if (kinds.has('daily_identity') || change.changesDailyIdentity === true) {
        add(required, 'game_rules');
        reasons.push('Daily/shared seed identity changed; GAME_RULES_VERSION must separate old and new daily runs.');
    }

    if (required.size === 0) {
        reasons.push('No persisted schema, generated-rule, schedule, or daily identity bump required.');
    }

    const validationCommands = [
        'yarn typecheck:shared',
        'yarn vitest run src/shared/save-data.test.ts src/shared/version-gate.test.ts',
        required.has('game_rules') || required.has('floor_schedule')
            ? 'yarn vitest run src/shared/game.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/version-gate.test.ts'
            : 'yarn vitest run src/shared/version-gate.test.ts'
    ];

    return {
        requiredBumps: [...required],
        migrationRequired: required.has('save_schema'),
        localOnly: true,
        onlineAuthorityAllowed: false,
        reasons,
        validationCommands
    };
};

const toChangeKind = (change: VersionedSurfaceChange): VersionGateChangeKind => {
    switch (change) {
        case 'board_generation':
            return 'board_generation';
        case 'gameplay_rules':
            return 'gameplay_rules';
        default:
            return change;
    }
};

export const evaluateVersionGate = (
    changes: readonly VersionedSurfaceChange[]
): LegacyVersionGateDecision => {
    const decision = assessVersionGate({ kinds: changes.map(toChangeKind) });
    const requiresSaveSchemaVersionBump = decision.requiredBumps.includes('save_schema');
    const requiresGameRulesVersionBump = decision.requiredBumps.includes('game_rules');
    const requiresFloorScheduleRulesVersionBump = decision.requiredBumps.includes('floor_schedule');
    const requiredChecks: string[] = [];

    if (requiresSaveSchemaVersionBump) {
        requiredChecks.push('Add or update normalizeSaveData migration fixtures for legacy / partial saves.');
    }
    if (requiresGameRulesVersionBump) {
        requiredChecks.push('Update deterministic board/floor tests and replay fixtures that depend on GAME_RULES_VERSION.');
    }
    if (requiresFloorScheduleRulesVersionBump) {
        requiredChecks.push('Run or update floor-mutator-schedule tests for FLOOR_SCHEDULE_RULES_VERSION.');
    }
    if (requiredChecks.length === 0) {
        requiredChecks.push('No version bump required; keep verification scoped to touched UI/copy surfaces.');
    }

    return {
        requiresSaveSchemaVersionBump,
        requiresGameRulesVersionBump,
        requiresFloorScheduleRulesVersionBump,
        requiresOnlineAuthority: false,
        requiredChecks
    };
};

export const shouldBumpForChange = (
    change: VersionedSurfaceChange
): { save: boolean; rules: boolean; floorSchedule: boolean } => {
    const decision = evaluateVersionGate([change]);
    return {
        save: decision.requiresSaveSchemaVersionBump,
        rules: decision.requiresGameRulesVersionBump,
        floorSchedule: decision.requiresFloorScheduleRulesVersionBump
    };
};

export const formatVersionGateSummary = (manifest: VersionManifest): string =>
    [
        `SAVE_SCHEMA_VERSION=${manifest.saveSchemaVersion}`,
        `GAME_RULES_VERSION=${manifest.gameRulesVersion}`,
        `FLOOR_SCHEDULE_RULES_VERSION=${manifest.floorScheduleRulesVersion}`,
        `authority=${manifest.authority}`,
        `onlineAuthority=${manifest.onlineAuthority}`
    ].join(' · ');

export const evaluateSaveMigrationGate = (
    input?: { schemaVersion?: unknown; lastRunSummary?: unknown } | null
): { keepLastRunSummary: boolean; sourceSchemaVersion: number | null; normalizedSchemaVersion: number } => {
    const sourceSchemaVersion =
        typeof input?.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
            ? input.schemaVersion
            : null;
    return {
        sourceSchemaVersion,
        normalizedSchemaVersion: SAVE_SCHEMA_VERSION,
        keepLastRunSummary: sourceSchemaVersion === null || sourceSchemaVersion <= SAVE_SCHEMA_VERSION
    };
};
