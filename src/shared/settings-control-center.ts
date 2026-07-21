import type { Settings } from './contracts';
import { DEFAULT_SETTINGS } from './save-data';

export type SettingsControlCenterRowId =
    | 'live_controls'
    | 'reference_placeholders'
    | 'profile_trust'
    | 'mobile_reachability';

export interface SettingsControlCenterRow {
    id: SettingsControlCenterRowId;
    label: string;
    value: string;
    detail: string;
    localOnly: true;
}

export const LIVE_SETTINGS_CONTROL_KEYS = [
    'masterVolume',
    'musicVolume',
    'sfxVolume',
    'displayMode',
    'uiScale',
    'reduceMotion',
    'graphicsQuality',
    'boardScreenSpaceAA',
    'boardBloomEnabled',
    'boardPresentation',
    'cameraViewportModePreference',
    'tileFocusAssist',
    'resolveDelayMultiplier',
    'weakerShuffleMode',
    'echoFeedbackEnabled',
    'distractionChannelEnabled',
    'shuffleScoreTaxEnabled',
    'pairProximityHintsEnabled'
] as const satisfies readonly (keyof Settings)[];

export const getLiveSettingsControlCount = (settings: Settings = DEFAULT_SETTINGS): number => {
    return LIVE_SETTINGS_CONTROL_KEYS.filter((key) => key in settings).length;
};

export const getSettingsControlCenterRows = (settings: Settings = DEFAULT_SETTINGS): SettingsControlCenterRow[] => [
    {
        id: 'live_controls',
        label: 'Live controls',
        value: `${getLiveSettingsControlCount(settings)} saved preferences`,
        detail: 'Audio, video, gameplay, accessibility, timing, and board-presentation controls write real Settings fields.',
        localOnly: true
    },
    {
        id: 'reference_placeholders',
        label: 'Reference placeholders',
        value: 'Honest future rows',
        detail: 'Difficulty, timer mode, max lives, card theme, and tutorial hints stay disabled until they have schema/rules backing.',
        localOnly: true
    },
    {
        id: 'profile_trust',
        label: 'Profile trust',
        value: 'Local save shell',
        detail: 'About explains single-profile saves, cloud deferral, profile summary, and non-destructive reset boundaries.',
        localOnly: true
    },
    {
        id: 'mobile_reachability',
        label: 'Mobile reachability',
        value: 'Sticky footer',
        detail: 'Back/Save remain in the footer while category and subsection chips keep controls grouped on short screens.',
        localOnly: true
    }
];
