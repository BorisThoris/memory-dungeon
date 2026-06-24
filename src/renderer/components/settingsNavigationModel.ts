export type SettingsCategory = 'gameplay' | 'audio' | 'video' | 'accessibility' | 'controls' | 'about';

export type SettingsSubsection =
    | 'board'
    | 'timing'
    | 'assist'
    | 'reference'
    | 'input'
    | 'tuning'
    | 'volume'
    | 'display'
    | 'graphics'
    | 'accessibility'
    | 'build'
    | 'reset';

export const SETTINGS_CATEGORIES: ReadonlyArray<{ id: SettingsCategory; label: string; note: string }> = [
    { id: 'gameplay', label: 'Gameplay', note: 'Run rules, board flow, and helper systems.' },
    { id: 'controls', label: 'Controls', note: 'Input reference and future tuning (UI-only).' },
    { id: 'audio', label: 'Audio', note: 'Master, music, and effect mix.' },
    { id: 'video', label: 'Video', note: 'Display mode and interface scale.' },
    { id: 'accessibility', label: 'Accessibility', note: 'Motion, clarity, and tutorial support.' },
    { id: 'about', label: 'About', note: 'Build info, credits, and reset.' }
];

export const SETTINGS_SUBSECTIONS: Record<
    SettingsCategory,
    ReadonlyArray<{ id: SettingsSubsection; label: string }>
> = {
    gameplay: [
        { id: 'board', label: 'Board' },
        { id: 'timing', label: 'Timing' },
        { id: 'assist', label: 'Assist' },
        { id: 'reference', label: 'Gameplay reference' }
    ],
    controls: [
        { id: 'input', label: 'Input' },
        { id: 'tuning', label: 'Tuning' }
    ],
    audio: [{ id: 'volume', label: 'Volume' }],
    video: [
        { id: 'display', label: 'Display' },
        { id: 'graphics', label: 'Graphics' }
    ],
    accessibility: [{ id: 'accessibility', label: 'Accessibility' }],
    about: [
        { id: 'build', label: 'Build' },
        { id: 'reset', label: 'Reset' }
    ]
};

export const DEFAULT_SUBSECTION_BY_CATEGORY: Record<SettingsCategory, SettingsSubsection> = {
    gameplay: 'board',
    controls: 'input',
    audio: 'volume',
    video: 'display',
    accessibility: 'accessibility',
    about: 'build'
};
