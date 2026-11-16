import { tr } from './i18n';
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
        label: tr.s('Difficulty'),
        status: 'future_placeholder',
        impact: 'rules_variant',
        persistedField: null,
        visibleInSettings: true,
        copy: tr.s('Reference-only. Shipped balance uses the Standard fair curve; enabling variants requires rules identity and achievement/daily copy.'),
        hint: tr.s('Reference only: shipped balance is the Standard profile (one par curve, a run-wide miss bank topped up by one each floor, softened memorize curve).'),
        options: [tr.s('Easy'), tr.s('Normal'), tr.s('Hard'), tr.s('Nightmare')],
        persistedSettingKey: null,
        ruleImpact: tr.s('Would require GAME_RULES_VERSION because scoring, the miss bank, and fairness identity change.'),
        achievementImplication: tr.s('Daily fairness and achievement eligibility need explicit per-profile copy before enabling.'),
        saveMigrationImplication: tr.s('Add a Settings field and normalize/migrate previous SaveData before enabling.'),
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: true
    },
    {
        id: 'timer_mode',
        label: tr.s('Timer mode'),
        status: 'future_placeholder',
        impact: 'rules_variant',
        persistedField: null,
        visibleInSettings: true,
        copy: tr.s('Reference-only. No saved timer mode exists; current timers follow run rules and accessibility pacing settings.'),
        hint: tr.s('Timer mode is not connected to save data or run rules in this build.'),
        options: [tr.s('Classic'), tr.s('Countdown'), tr.s('Relentless')],
        persistedSettingKey: null,
        ruleImpact: tr.s('Would require GAME_RULES_VERSION for run identity and export strings.'),
        achievementImplication: tr.s('Daily and achievement comparability must state which timer modes count.'),
        saveMigrationImplication: tr.s('Add a Settings field and migration/default before enabling.'),
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: true
    },
    {
        id: 'card_theme',
        label: tr.s('Card theme'),
        status: 'future_placeholder',
        impact: 'cosmetic',
        persistedField: null,
        visibleInSettings: true,
        copy: tr.s('Reference-only. Cosmetic ownership is visible in Collection/Inventory; board theme selection is not persisted yet.'),
        hint: tr.s('Hidden cards use one shared back; hidden-card theme variants are not available.'),
        options: [tr.s('Shared Card Back')],
        persistedSettingKey: null,
        ruleImpact: tr.s('Cosmetic only; no GAME_RULES_VERSION required if it remains visual.'),
        achievementImplication: tr.s('No achievement impact when visual-only.'),
        saveMigrationImplication: tr.s('Add SaveData/Settings selected theme field and migration before enabling.'),
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'tutorial_hints',
        label: tr.s('Tutorial hints'),
        status: 'roadmap_only',
        impact: 'preference',
        persistedField: null,
        visibleInSettings: true,
        copy: tr.s('Layout-fidelity placeholder only. Current onboarding uses SaveData onboardingDismissed and powersFtueSeen.'),
        hint: tr.s('Tutorial hint visibility is presented here for layout fidelity only.'),
        options: [tr.s('Off'), tr.s('On')],
        persistedSettingKey: null,
        ruleImpact: tr.s('Preference only; no rules bump if it only controls UI prompts.'),
        achievementImplication: tr.s('No achievement impact if it only changes instructional UI.'),
        saveMigrationImplication: tr.s('Add Settings field and migration/default before enabling.'),
        migrationRequiredWhenEnabled: true,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'resolve_delay',
        label: tr.s('Resolve delay'),
        status: 'live',
        impact: 'preference',
        persistedField: 'resolveDelayMultiplier',
        visibleInSettings: true,
        copy: tr.s('Live persisted accessibility pacing preference.'),
        hint: tr.s('Live setting.'),
        options: [],
        persistedSettingKey: 'resolveDelayMultiplier',
        ruleImpact: tr.s('Live preference; no rules version bump.'),
        achievementImplication: tr.s('No achievement impact.'),
        saveMigrationImplication: tr.s('Already in Settings.'),
        migrationRequiredWhenEnabled: false,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'weaker_shuffle',
        label: tr.s('Shuffle style'),
        status: 'live',
        impact: 'preference',
        persistedField: 'weakerShuffleMode',
        visibleInSettings: true,
        copy: tr.s('Live persisted board presentation assist; scoring impact is separately controlled by shuffle score tax.'),
        hint: tr.s('Live setting.'),
        options: [],
        persistedSettingKey: 'weakerShuffleMode',
        ruleImpact: tr.s('Live preference; no rules version bump.'),
        achievementImplication: tr.s('No achievement impact by itself.'),
        saveMigrationImplication: tr.s('Already in Settings.'),
        migrationRequiredWhenEnabled: false,
        rulesVersionRequiredWhenEnabled: false
    },
    {
        id: 'card_bloom',
        label: tr.s('Board bloom'),
        status: 'live',
        impact: 'preference',
        persistedField: 'boardBloomEnabled',
        visibleInSettings: true,
        copy: tr.s('Live persisted graphics preference; disabled on Low quality.'),
        hint: tr.s('Live setting.'),
        options: [],
        persistedSettingKey: 'boardBloomEnabled',
        ruleImpact: tr.s('Graphics preference; no rules version bump.'),
        achievementImplication: tr.s('No achievement impact.'),
        saveMigrationImplication: tr.s('Already in Settings.'),
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
