import { tr } from '../../shared/i18n';
export type SettingsCategory = 'gameplay' | 'audio' | 'video' | 'accessibility' | 'controls' | 'about' | 'dev';

export type SettingsSubsection =
    | 'board'
    | 'timing'
    | 'assist'
    | 'input'
    | 'keys'
    | 'whatsNew'
    | 'volume'
    | 'display'
    | 'graphics'
    | 'accessibility'
    | 'build'
    | 'credits'
    | 'transfer'
    | 'reset'
    | 'effects';

export const SETTINGS_CATEGORIES: ReadonlyArray<{ id: SettingsCategory; label: string; note: string }> = [
    { id: 'gameplay', label: tr.s('Gameplay'), note: tr.s('Run rules, board flow, and helper systems.') },
    { id: 'controls', label: tr.s('Controls'), note: tr.s('Pointer, touch, and keys.') },
    { id: 'audio', label: tr.s('Audio'), note: tr.s('Master, music, and effect mix.') },
    { id: 'video', label: tr.s('Video'), note: tr.s('Display mode and interface scale.') },
    { id: 'accessibility', label: tr.s('Accessibility'), note: tr.s('Motion and clarity.') },
    { id: 'about', label: tr.s('About'), note: tr.s('Build info, what’s new, credits, and reset.') },
    { id: 'dev', label: tr.s('Effects'), note: tr.s('Extra visual effects. Applies immediately.') }
];

export const SETTINGS_SUBSECTIONS: Record<
    SettingsCategory,
    ReadonlyArray<{ id: SettingsSubsection; label: string }>
> = {
    gameplay: [
        { id: 'board', label: tr.s('Board') },
        { id: 'timing', label: tr.s('Timing') },
        { id: 'assist', label: tr.s('Assist') }
    ],
    controls: [
        { id: 'input', label: tr.s('Input') },
        { id: 'keys', label: tr.s('Keys') }
    ],
    audio: [{ id: 'volume', label: tr.s('Volume') }],
    video: [
        { id: 'display', label: tr.s('Display') },
        { id: 'graphics', label: tr.s('Graphics') }
    ],
    accessibility: [{ id: 'accessibility', label: tr.s('Accessibility') }],
    dev: [{ id: 'effects', label: tr.s('Effects') }],
    about: [
        { id: 'build', label: tr.s('Build') },
        { id: 'whatsNew', label: tr.s('What’s new') },
        { id: 'credits', label: tr.s('Credits') },
        { id: 'transfer', label: tr.s('Move progress') },
        { id: 'reset', label: tr.s('Reset') }
    ]
};

export const DEFAULT_SUBSECTION_BY_CATEGORY: Record<SettingsCategory, SettingsSubsection> = {
    gameplay: 'board',
    controls: 'input',
    audio: 'volume',
    video: 'display',
    accessibility: 'accessibility',
    about: 'build',
    dev: 'effects'
};
