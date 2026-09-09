import type { Settings } from './contracts';

export type SettingsReferenceControlStatus = 'live' | 'future_placeholder' | 'roadmap_only';
export type SettingsReferenceControlImpact = 'preference' | 'rules_variant' | 'cosmetic';

export interface SettingsReferenceControlRow {
    id:
        | 'difficulty'
        | 'timer_mode'
        | 'card_theme'
        | 'tutorial_hints'
        | 'resolve_delay'
        | 'weaker_shuffle'
        | 'card_bloom';
    label: string;
    status: SettingsReferenceControlStatus;
    impact: SettingsReferenceControlImpact;
    persistedField: keyof Settings | null;
    visibleInSettings: boolean;
    copy: string;
    hint: string;
    options: readonly string[];
    persistedSettingKey: keyof Settings | null;
    ruleImpact: string;
    achievementImplication: string;
    saveMigrationImplication: string;
    migrationRequiredWhenEnabled: boolean;
    rulesVersionRequiredWhenEnabled: boolean;
}

export const SETTINGS_REFERENCE_CONTROL_ROWS: readonly SettingsReferenceControlRow[] = [
    {
        id: 'difficulty',
        label: 'Difficulty',
        status: 'future_placeholder',
        impact: 'rules_variant',
        persistedField: null,
        visibleInSettings: true,
        copy: 'Reference-only. Shipped balance uses the Standard fair curve; enabling variants requires rules identity and achievement/daily copy.',
        hint: 'Reference only: shipped balance is the Standard profile (one par curve, a turn ceiling at three times par, softened memorize curve).',
        options: ['Easy', 'Normal', 'Hard', 'Nightmare'],
        persistedSettingKey: null,
        ruleImpact: 'Would require GAME_RULES_VERSION because scoring, the turn ceiling, and fairness identity change.',
        achievementImplication: 'Daily fairness and achievement eligibility need explicit per-profile copy before enabling.',
        saveMigrationImplication: 'Add a Settings field and normalize/migrate previous SaveData before enabling.',
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: true
    },
    {
        id: 'timer_mode',
        label: 'Timer mode',
        status: 'future_placeholder',
        impact: 'rules_variant',
        persistedField: null,
        visibleInSettings: true,
        copy: 'Reference-only. No saved timer mode exists; current timers follow run rules and accessibility pacing settings.',
        hint: 'Timer mode is not connected to save data or run rules in this build.',
        options: ['Classic', 'Countdown', 'Relentless'],
        persistedSettingKey: null,
        ruleImpact: 'Would require GAME_RULES_VERSION for run identity and export strings.',
        achievementImplication: 'Daily and achievement comparability must state which timer modes count.',
        saveMigrationImplication: 'Add a Settings field and migration/default before enabling.',
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: true
    },
    {
        id: 'card_theme',
        label: 'Card theme',
        status: 'future_placeholder',
        impact: 'cosmetic',
        persistedField: null,
        visibleInSettings: true,
        copy: 'Reference-only. Cosmetic ownership is visible in Collection/Inventory; board theme selection is not persisted yet.',
        hint: 'Hidden cards use one shared back; hidden-card theme variants are not available.',
        options: ['Shared Card Back'],
        persistedSettingKey: null,
        ruleImpact: 'Cosmetic only; no GAME_RULES_VERSION required if it remains visual.',
        achievementImplication: 'No achievement impact when visual-only.',
        saveMigrationImplication: 'Add SaveData/Settings selected theme field and migration before enabling.',
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'tutorial_hints',
        label: 'Tutorial hints',
        status: 'roadmap_only',
        impact: 'preference',
        persistedField: null,
        visibleInSettings: true,
        copy: 'Layout-fidelity placeholder only. Current onboarding uses SaveData onboardingDismissed and powersFtueSeen.',
        hint: 'Tutorial hint visibility is presented here for layout fidelity only.',
        options: ['Off', 'On'],
        persistedSettingKey: null,
        ruleImpact: 'Preference only; no rules bump if it only controls UI prompts.',
        achievementImplication: 'No achievement impact if it only changes instructional UI.',
        saveMigrationImplication: 'Add Settings field and migration/default before enabling.',
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'resolve_delay',
        label: 'Resolve delay',
        status: 'live',
        impact: 'preference',
        persistedField: 'resolveDelayMultiplier',
        visibleInSettings: true,
        copy: 'Live persisted accessibility pacing preference.',
        hint: 'Live setting.',
        options: [],
        persistedSettingKey: 'resolveDelayMultiplier',
        ruleImpact: 'Live preference; no rules version bump.',
        achievementImplication: 'No achievement impact.',
        saveMigrationImplication: 'Already in Settings.',
        migrationRequiredWhenEnabled: false,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'weaker_shuffle',
        label: 'Shuffle style',
        status: 'live',
        impact: 'preference',
        persistedField: 'weakerShuffleMode',
        visibleInSettings: true,
        copy: 'Live persisted board presentation assist; scoring impact is separately controlled by shuffle score tax.',
        hint: 'Live setting.',
        options: [],
        persistedSettingKey: 'weakerShuffleMode',
        ruleImpact: 'Live preference; no rules version bump.',
        achievementImplication: 'No achievement impact by itself.',
        saveMigrationImplication: 'Already in Settings.',
        migrationRequiredWhenEnabled: false,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'card_bloom',
        label: 'Board bloom',
        status: 'live',
        impact: 'preference',
        persistedField: 'boardBloomEnabled',
        visibleInSettings: true,
        copy: 'Live persisted graphics preference; disabled on Low quality.',
        hint: 'Live setting.',
        options: [],
        persistedSettingKey: 'boardBloomEnabled',
        ruleImpact: 'Graphics preference; no rules version bump.',
        achievementImplication: 'No achievement impact.',
        saveMigrationImplication: 'Already in Settings.',
        migrationRequiredWhenEnabled: false,
        rulesVersionRequiredWhenEnabled: false
    }
];

export const getSettingsReferenceControlRows = (): readonly SettingsReferenceControlRow[] =>
    SETTINGS_REFERENCE_CONTROL_ROWS;

export const getReferenceSettingsControlRows = (): SettingsReferenceControlRow[] =>
    SETTINGS_REFERENCE_CONTROL_ROWS.filter((row) => row.status === 'future_placeholder');

export const referenceControlsWithPersistedSettings = (): SettingsReferenceControlRow[] =>
    getReferenceSettingsControlRows().filter((row) => row.persistedSettingKey !== null);

export const getReferenceOnlySettingsRows = (): SettingsReferenceControlRow[] =>
    SETTINGS_REFERENCE_CONTROL_ROWS.filter((row) => row.status !== 'live' && row.visibleInSettings);
