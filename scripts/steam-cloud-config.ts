/**
 * Prints the Steam Auto-Cloud configuration to enter on the Partner site.
 *
 * Auto-Cloud is configured by hand in a web form, which is exactly the kind of thing that drifts
 * from the code it is supposed to describe. Deriving the rows from `save-location.ts` means what
 * gets pasted into Steamworks comes from the same constant the game writes its save with.
 */
import { SAVE_FILE_NAME, STEAM_CLOUD_EXCLUSIONS, STEAM_CLOUD_RULES } from '../src/shared/save-location';

export const renderSteamCloudConfig = (): string =>
    [
        '# Steam Auto-Cloud configuration',
        '',
        'Steamworks > Application > Cloud > Auto-Cloud. One row per platform:',
        '',
        '| Platform | Root | Subdirectory | Pattern |',
        '|---|---|---|---|',
        ...STEAM_CLOUD_RULES.map((rule) => `| ${rule.platform} | ${rule.root} | ${rule.subdirectory} | ${rule.pattern} |`),
        '',
        `Only \`${SAVE_FILE_NAME}\` is synced. Everything else beside it stays local:`,
        '',
        ...STEAM_CLOUD_EXCLUSIONS.map((row) => `- \`${row.path}\` — ${row.reason}`),
        '',
        'Set `VITE_FEATURE_CLOUD_SAVE=1` when packaging, but only once the rows above are saved on',
        'the Partner site — the flag only changes what the game tells the player.',
        ''
    ].join('\n');

process.stdout.write(renderSteamCloudConfig());
