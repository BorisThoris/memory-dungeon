/**
 * Settings > About: who made the game, what it is made with, and the licences it ships under
 * (2026-11-13). Every market-leading roguelike has a credits page; this game had none, and its
 * privacy policy (`public/privacy.html`, linked from its store listing) was linked from nowhere in
 * the game itself. Sources for every line: `src/renderer/assets/ASSET_SOURCES.md`, the audio
 * READMEs beside the files, and each dependency's own `package.json`.
 */
export interface CreditLine {
    readonly what: string;
    readonly who: string;
    /** A licence or a link, when there is one to give. */
    readonly note?: string;
}

export interface CreditGroup {
    readonly title: string;
    readonly lines: readonly CreditLine[];
}

/** The hosted policy, the one the store listing links: the desktop build has no page of its own to open. */
export const PRIVACY_POLICY_URL = 'https://memory-dungeon-git.pages.dev/privacy';

export const ABOUT_COPY = {
    privacyLink: 'Privacy policy and contact',
    privacyHint: 'Opens the privacy policy, which also says how to get in touch.',
    creditsTitle: 'Credits',
    licencesTitle: 'Licences',
    licencesLead: 'Memory Dungeon is built on open-source software and free assets. Their licences allow a commercial game; the notices are kept here.',
    deleteTitle: 'Delete all progress',
    deleteLead:
        'Starts a fresh profile on this device: best score, run history, profile level, honors, cosmetics, unlocks and any run in progress are erased. Your settings are kept. Achievements already unlocked on Steam stay on Steam.',
    deleteAction: 'Delete all progress',
    deleteConfirmTitle: 'Delete all progress?',
    deleteConfirmBody: 'This cannot be undone. Everything on this device starts again from nothing.',
    deleteConfirm: 'Delete everything',
    deleteCancel: 'Keep my progress',
    deleteDone: 'Progress deleted. A fresh profile starts with your next run.'
} as const;

export const CREDIT_GROUPS: readonly CreditGroup[] = [
    {
        title: 'Made by',
        lines: [{ what: 'Design, code, art direction and sound', who: 'Memory Dungeon' }]
    },
    {
        title: 'Made with',
        lines: [
            { what: 'Code', who: 'Written with heavy AI assistance (Claude, by Anthropic)' },
            { what: 'Card and scene paintings', who: 'Painted with Z-Image-Turbo, run locally' },
            { what: 'Realm music', who: 'Rendered with ACE-Step 1.5, run locally' }
        ]
    },
    {
        title: 'Sounds',
        lines: [
            { what: 'Basic Spell Impacts (fire, ice, water, lightning)', who: 'lentikula', note: 'CC0 1.0 · lentikula.itch.io' },
            { what: 'Earth Element Magic Spell', who: 'qubodup', note: 'CC0 · opengameart.org' },
            { what: 'Fire Crackling', who: 'AntumDeluge', note: 'CC0 · opengameart.org' },
            { what: 'Wind whoosh loop', who: 'SketchMan3', note: 'CC0 · opengameart.org' },
            { what: 'Sci-Fi Sounds, RPG Audio, Interface Sounds, Impact Sounds', who: 'Kenney', note: 'CC0 1.0 · kenney.nl' }
        ]
    },
    {
        title: 'Typefaces',
        lines: [
            { what: 'Cinzel', who: 'Natanael Gama', note: 'SIL Open Font License 1.1' },
            { what: 'Cormorant Garamond', who: 'Christian Thalmann', note: 'SIL Open Font License 1.1' },
            { what: 'Lora', who: 'Cyreal', note: 'SIL Open Font License 1.1' },
            { what: 'Source Sans 3', who: 'Paul D. Hunt, Adobe', note: 'SIL Open Font License 1.1' }
        ]
    }
];

/** The runtime libraries the game ships, each with the licence its own package declares. */
export const SOFTWARE_LICENCES: readonly CreditLine[] = [
    { what: 'React and React DOM', who: 'Meta Platforms, Inc. and affiliates', note: 'MIT' },
    { what: 'three.js', who: 'three.js authors', note: 'MIT' },
    { what: 'React Three Fiber', who: 'Poimandres', note: 'MIT' },
    { what: 'PixiJS', who: 'PixiJS authors', note: 'MIT' },
    { what: 'Zustand', who: 'Poimandres', note: 'MIT' },
    { what: 'XState', who: 'Stately', note: 'MIT' },
    { what: 'Zod', who: 'Colin McDonnell', note: 'MIT' },
    { what: 'opentype.js', who: 'Frederik De Bleser and contributors', note: 'MIT' },
    { what: 'Electron', who: 'OpenJS Foundation and contributors', note: 'MIT · desktop build' },
    { what: 'electron-store', who: 'Sindre Sorhus', note: 'MIT · desktop build' },
    { what: 'steamworks.js', who: 'ceifa', note: 'MIT · desktop build' }
];
