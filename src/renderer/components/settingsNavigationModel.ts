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
    { id: 'gameplay', label: 'Gameplay', note: 'Run rules, board flow, and helper systems.' },
    { id: 'controls', label: 'Controls', note: 'Pointer, touch, and keys.' },
    { id: 'audio', label: 'Audio', note: 'Master, music, and effect mix.' },
    { id: 'video', label: 'Video', note: 'Display mode and interface scale.' },
    { id: 'accessibility', label: 'Accessibility', note: 'Motion and clarity.' },
    { id: 'about', label: 'About', note: 'Build info, what’s new, credits, and reset.' },
    { id: 'dev', label: 'Effects', note: 'Extra visual effects. Applies immediately.' }
];

export const SETTINGS_SUBSECTIONS: Record<
    SettingsCategory,
    ReadonlyArray<{ id: SettingsSubsection; label: string }>
> = {
    gameplay: [
        { id: 'board', label: 'Board' },
        { id: 'timing', label: 'Timing' },
        { id: 'assist', label: 'Assist' }
    ],
    controls: [
        { id: 'input', label: 'Input' },
        { id: 'keys', label: 'Keys' }
    ],
    audio: [{ id: 'volume', label: 'Volume' }],
    video: [
        { id: 'display', label: 'Display' },
        { id: 'graphics', label: 'Graphics' }
    ],
    accessibility: [{ id: 'accessibility', label: 'Accessibility' }],
    dev: [{ id: 'effects', label: 'Effects' }],
    about: [
        { id: 'build', label: 'Build' },
        { id: 'whatsNew', label: 'What’s new' },
        { id: 'credits', label: 'Credits' },
        { id: 'transfer', label: 'Move progress' },
        { id: 'reset', label: 'Reset' }
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
