import { tr } from '../../shared/i18n';
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
    privacyLink: tr.s('Privacy policy and contact'),
    privacyHint: tr.s('Opens the privacy policy, which also says how to get in touch.'),
    reportLink: tr.s('Report a problem'),
    reportHint: tr.s('Opens a mail to the developer with your version, device and language filled in. Nothing is sent until you send it.'),
    creditsTitle: tr.s('Credits'),
    licencesTitle: tr.s('Licences'),
    licencesLead: tr.s('Memory Dungeon is built on open-source software and free assets. Their licences allow a commercial game; the notices are kept here.'),
    deleteTitle: tr.s('Delete all progress'),
    deleteLead:
        tr.s('Starts a fresh profile on this device: best score, run history, profile level, honors, cosmetics, unlocks and any run in progress are erased. Your settings are kept. Achievements already unlocked on Steam stay on Steam.'),
    deleteAction: tr.s('Delete all progress'),
    deleteConfirmTitle: tr.s('Delete all progress?'),
    deleteConfirmBody: tr.s('This cannot be undone. Everything on this device starts again from nothing.'),
    deleteConfirm: tr.s('Delete everything'),
    deleteCancel: tr.s('Keep my progress'),
    deleteDone: tr.s('Progress deleted. A fresh profile starts with your next run.'),
    transferTitle: tr.s('Move your progress'),
    transferLead:
        tr.s('There is no cloud sync, so to play on another device, export your progress here and import the file there. Settings stay with each device.'),
    exportAction: tr.s('Export progress'),
    importAction: tr.s('Import progress'),
    importConfirmTitle: tr.s('Replace your progress?'),
    importConfirmBody: (bestScore: number): string =>
        tr`The imported profile (best score ${bestScore.toLocaleString('en')}) replaces everything on this device, and any run in progress here is dropped. This cannot be undone.`,
    importConfirm: tr.s('Replace it'),
    importCancel: tr.s('Keep mine'),
    importDone: tr.s('Progress imported.')
} as const;

export const CREDIT_GROUPS: readonly CreditGroup[] = [
    {
        title: tr.s('Made by'),
        lines: [{ what: tr.s('Design, code, art direction and sound'), who: tr.s('Memory Dungeon') }]
    },
    {
        title: tr.s('Made with'),
        lines: [
            { what: tr.s('Code'), who: tr.s('Written with heavy AI assistance (Claude, by Anthropic)') },
            { what: tr.s('Card and scene paintings'), who: tr.s('Painted with Z-Image-Turbo, run locally') },
            { what: tr.s('Realm music'), who: tr.s('Rendered with ACE-Step 1.5, run locally') }
        ]
    },
    {
        title: tr.s('Sounds'),
        lines: [
            { what: tr.s('Basic Spell Impacts (fire, ice, water, lightning)'), who: 'lentikula', note: tr.s('CC0 1.0 · lentikula.itch.io') },
            { what: tr.s('Earth Element Magic Spell'), who: 'qubodup', note: tr.s('CC0 · opengameart.org') },
            { what: tr.s('Fire Crackling'), who: 'AntumDeluge', note: tr.s('CC0 · opengameart.org') },
            { what: tr.s('Wind whoosh loop'), who: 'SketchMan3', note: tr.s('CC0 · opengameart.org') },
            { what: tr.s('Sci-Fi Sounds, RPG Audio, Interface Sounds, Impact Sounds'), who: tr.s('Kenney'), note: tr.s('CC0 1.0 · kenney.nl') }
        ]
    },
    {
        title: tr.s('Typefaces'),
        lines: [
            { what: tr.s('Cinzel'), who: tr.s('Natanael Gama'), note: tr.s('SIL Open Font License 1.1') },
            { what: tr.s('Cormorant Garamond'), who: tr.s('Christian Thalmann'), note: tr.s('SIL Open Font License 1.1') },
            { what: tr.s('Lora'), who: tr.s('Cyreal'), note: tr.s('SIL Open Font License 1.1') },
            { what: tr.s('Source Sans 3'), who: tr.s('Paul D. Hunt, Adobe'), note: tr.s('SIL Open Font License 1.1') }
        ]
    }
];

/** The runtime libraries the game ships, each with the licence its own package declares. */
export const SOFTWARE_LICENCES: readonly CreditLine[] = [
    { what: tr.s('React and React DOM'), who: tr.s('Meta Platforms, Inc. and affiliates'), note: 'MIT' },
    { what: 'three.js', who: tr.s('three.js authors'), note: 'MIT' },
    { what: tr.s('React Three Fiber'), who: tr.s('Poimandres'), note: 'MIT' },
    { what: 'PixiJS', who: tr.s('PixiJS authors'), note: 'MIT' },
    { what: tr.s('Zustand'), who: tr.s('Poimandres'), note: 'MIT' },
    { what: 'XState', who: tr.s('Stately'), note: 'MIT' },
    { what: tr.s('Zod'), who: tr.s('Colin McDonnell'), note: 'MIT' },
    { what: 'opentype.js', who: tr.s('Frederik De Bleser and contributors'), note: 'MIT' },
    { what: tr.s('Electron'), who: tr.s('OpenJS Foundation and contributors'), note: tr.s('MIT · desktop build') },
    { what: 'electron-store', who: tr.s('Sindre Sorhus'), note: tr.s('MIT · desktop build') },
    { what: 'steamworks.js', who: 'ceifa', note: tr.s('MIT · desktop build') }
];
