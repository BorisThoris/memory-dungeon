/**
 * What still stands between this build and a Steam release.
 *
 * The list exists as data rather than prose because a hand-written checklist rots: a row saying
 * "controller support: done" stays green long after someone deletes the last gamepad call site.
 * Every `repo` row here is re-proved against the live modules by `release-checklist.test.ts`, and
 * `docs/RELEASE_CHECKLIST.md` is generated from this file, so the document cannot drift from the
 * code either. Rows a person owns are the ones that matter most on this list — nothing in the
 * repository can enter an achievement on the Partner site or shoot a trailer.
 */

/** Who can actually close a row. */
export type ReleaseChecklistOwner =
    /** Done in this repository, and re-proved by the checklist test. */
    | 'repo'
    /** Someone has to do it outside the repository: Partner site, store page, a second machine. */
    | 'person'
    /** Nobody has decided yet. Not work, a choice. */
    | 'decision';

export interface ReleaseChecklistItem {
    readonly id: string;
    readonly section: string;
    readonly label: string;
    readonly owner: ReleaseChecklistOwner;
    /** For `repo` rows: where the claim lives, so a reader can go read it. */
    readonly evidence?: string;
    /** For `person` and `decision` rows: what doing it involves. */
    readonly note?: string;
}

export const RELEASE_CHECKLIST: readonly ReleaseChecklistItem[] = [
    {
        evidence: 'src/shared/gamepad-input.ts',
        id: 'controller-support',
        label: 'Every screen is reachable on a controller, not just the board',
        owner: 'repo',
        section: 'Input and display'
    },
    {
        evidence: 'src/main/window-bounds.ts',
        id: 'window-state',
        label: 'Window size and position survive a restart, clamped to a usable minimum',
        owner: 'repo',
        section: 'Input and display'
    },
    {
        evidence: 'src/shared/tile-trait-marks.ts',
        id: 'trait-second-channel',
        label: 'Traits carry a shape as well as a colour, so the board reads without colour vision',
        owner: 'repo',
        section: 'Input and display'
    },
    {
        evidence: 'src/shared/steam-achievement-api-names.ts',
        id: 'achievement-api-names',
        label: 'Every achievement the game can award has a Steam API name to award it under',
        owner: 'repo',
        section: 'Steamworks'
    },
    {
        evidence: 'src/shared/rich-presence.ts',
        id: 'rich-presence',
        label: 'Rich Presence publishes what the player is doing, and clears when the run ends',
        owner: 'repo',
        section: 'Steamworks'
    },
    {
        evidence: 'src/shared/save-location.ts',
        id: 'cloud-save-paths',
        label: 'The save file sits at one stable path per platform, ready for Auto-Cloud',
        owner: 'repo',
        section: 'Steamworks'
    },
    {
        evidence: 'scripts/steam-partner-config.ts',
        id: 'partner-rows-derived',
        label: 'The Partner-site rows are generated from what the game awards and broadcasts',
        owner: 'repo',
        section: 'Steamworks'
    },
    {
        evidence: 'scripts/store-action-reachability.ts',
        id: 'store-reachability',
        label: 'No player-facing state or action is left with nothing able to reach it',
        owner: 'repo',
        section: 'Diagnostics'
    },
    {
        evidence: 'src/main/save-recovery.ts',
        id: 'save-read-recovery',
        label: 'A save this build cannot read is survivable, and the player is told and given a way out',
        owner: 'repo',
        section: 'Diagnostics'
    },
    {
        evidence: 'src/main/crash-log.ts',
        id: 'crash-reports',
        label: 'Crashes are written to disk with user paths redacted, and pruned',
        owner: 'repo',
        section: 'Diagnostics'
    },
    {
        id: 'achievements-on-partner-site',
        label: 'The 20 achievement API names exist on the Partner site',
        note: 'Stats & Achievements. `yarn steam:partner-config` prints the rows, titles and descriptions to paste.',
        owner: 'person',
        section: 'Steamworks'
    },
    {
        id: 'rich-presence-tokens',
        label: 'The `#Status_*` localization tokens are defined on the Partner site',
        note: '`yarn steam:partner-config` prints them. Until they exist, friends see the raw token instead of a sentence.',
        owner: 'person',
        section: 'Steamworks'
    },
    {
        id: 'auto-cloud-rows',
        label: 'The Auto-Cloud rows are entered on the Partner site',
        note: 'Run `yarn steam:cloud-config` — it prints the rows to copy in.',
        owner: 'person',
        section: 'Steamworks'
    },
    {
        id: 'cloud-save-flag',
        label: 'Ship with `VITE_FEATURE_CLOUD_SAVE=1` once Auto-Cloud is live',
        note: 'The flag is off by default so a half-configured app never claims cloud saves.',
        owner: 'person',
        section: 'Steamworks'
    },
    {
        id: 'cloud-save-round-trip',
        label: 'A save has actually round-tripped between two machines',
        note: 'The one row no amount of configuration proves. Somebody has to play on two boxes.',
        owner: 'person',
        section: 'Steamworks'
    },
    {
        id: 'store-page',
        label: 'Store page copy, capsule art and trailer',
        note: 'Valve reviews the page separately from the build, and it takes them days.',
        owner: 'person',
        section: 'Store'
    },
    {
        evidence: 'scripts/copy-locality.ts',
        id: 'copy-extracted',
        label: 'Every player-facing sentence lives in a copy module, not inside a component',
        owner: 'repo',
        section: 'Store'
    },
    {
        id: 'localization',
        label: 'Which languages, if any',
        note: 'Every player-facing sentence is already in a copy module, so this is purely a question of budget.',
        owner: 'decision',
        section: 'Open decisions'
    },
    {
        id: 'crash-upload',
        label: 'Whether crash reports should ever leave the machine',
        note: 'Today they stay on disk. Sending them needs a backend and a consent flow.',
        owner: 'decision',
        section: 'Open decisions'
    },
    {
        id: 'electron-major',
        label: 'Whether to move Electron past 41',
        note: 'A release-sized change on its own; the current line is patched and clean.',
        owner: 'decision',
        section: 'Open decisions'
    }
];

export const releaseChecklistSections = (): readonly string[] => [
    ...new Set(RELEASE_CHECKLIST.map((item) => item.section))
];

export const releaseChecklistByOwner = (owner: ReleaseChecklistOwner): readonly ReleaseChecklistItem[] =>
    RELEASE_CHECKLIST.filter((item) => item.owner === owner);

const OWNER_STATE: Record<ReleaseChecklistOwner, string> = {
    decision: 'undecided',
    person: 'not done',
    repo: 'done'
};

const OWNER_LABEL: Record<ReleaseChecklistOwner, string> = {
    decision: 'a decision',
    person: 'a person',
    repo: 'the repository'
};

export const renderReleaseChecklistMarkdown = (
    checklist: readonly ReleaseChecklistItem[] = RELEASE_CHECKLIST
): string => {
    const lines: string[] = [
        '<!-- Generated by `yarn docs:release-checklist`. Edit src/shared/release-checklist.ts instead. -->',
        '',
        '# Release checklist',
        '',
        'Rows owned by **the repository** are re-proved against the live modules by',
        '`src/shared/release-checklist.test.ts`; if one of them stops being true, that test fails.',
        'The rows that are actually left are the ones a person owns — nothing in here can enter an',
        'achievement on the Partner site or shoot a trailer.',
        ''
    ];

    for (const section of [...new Set(checklist.map((item) => item.section))]) {
        lines.push(`## ${section}`, '', '| Item | State | Owner | Where |', '|---|---|---|---|');
        for (const item of checklist.filter((candidate) => candidate.section === section)) {
            const state = item.owner === 'repo' ? OWNER_STATE[item.owner] : `**${OWNER_STATE[item.owner]}**`;
            const where = item.evidence ? `\`${item.evidence}\`` : (item.note ?? '');
            lines.push(`| ${item.label} | ${state} | ${OWNER_LABEL[item.owner]} | ${where} |`);
        }
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
};
