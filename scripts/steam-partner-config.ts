/**
 * Prints the Steamworks Partner-site rows to enter by hand: achievements and Rich Presence tokens.
 *
 * Both are typed into a web form, which is exactly the kind of thing that drifts from the code it
 * describes — and both fail quietly when they do. A missing achievement API name makes an unlock
 * throw at the Steam boundary on the one moment that matters; a missing `#Status_*` row shows a
 * player's friends the raw token instead of a sentence.
 *
 * So the rows are derived from what the game actually awards and broadcasts. The achievement titles
 * here are the same strings the in-game Codex shows, which is the point: the Steam overlay and the
 * Collection screen cannot describe the same achievement differently.
 *
 * Auto-Cloud has its own printer: `yarn steam:cloud-config`.
 */
import { ACHIEVEMENT_BY_ID } from '../src/shared/achievements';
import { ACHIEVEMENT_IDS } from '../src/shared/save-data';
import { RICH_PRESENCE_TOKEN_TEXT } from '../src/shared/steam-rich-presence-tokens';
import { STEAM_ACHIEVEMENT_API_NAME } from '../src/shared/steam-achievement-api-names';

export const renderAchievementRows = (): string =>
    [
        '# Achievements',
        '',
        'Steamworks > Application > Stats & Achievements > Achievements. One row each, plus icons:',
        '',
        '| API Name | Display Name | Description |',
        '|---|---|---|',
        ...ACHIEVEMENT_IDS.map((id) => {
            const entry = ACHIEVEMENT_BY_ID[id];
            return `| ${STEAM_ACHIEVEMENT_API_NAME[id]} | ${entry.title} | ${entry.description} |`;
        }),
        '',
        `${ACHIEVEMENT_IDS.length} achievements. Every one the game can award is listed; an API name`,
        'missing from the dashboard makes that unlock fail at the Steam boundary.',
        ''
    ].join('\n');

export const renderRichPresenceRows = (): string =>
    [
        '# Rich Presence localization',
        '',
        'Steamworks > Application > Rich Presence Localization, English. The game sets the keys',
        '`steam_display`, `mode` and `floor`; these tokens are what Steam renders from them:',
        '',
        '| Token | English |',
        '|---|---|',
        ...Object.entries(RICH_PRESENCE_TOKEN_TEXT).map(([token, text]) => `| ${token} | ${text} |`),
        '',
        'Until these exist a friends list shows the raw token, not a sentence.',
        ''
    ].join('\n');

if (process.argv[1]?.includes('steam-partner-config')) {
    process.stdout.write(`${renderAchievementRows()}\n${renderRichPresenceRows()}`);
}
