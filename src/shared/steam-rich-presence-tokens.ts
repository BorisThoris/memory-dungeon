import type { RichPresenceToken } from './contracts';

/**
 * The English text behind each `#Status_*` token, as it has to be entered on the Partner site.
 *
 * Steam does not read these from the build: the game broadcasts a token name, and Steam looks the
 * sentence up in the localization table someone typed into the dashboard. Until that table exists,
 * a player's friends see the literal string `#Status_Endless` next to their name.
 *
 * `%floor%` and `%mode%` are the rich-presence keys `richPresencePairs` sets. Steam substitutes
 * them; a token naming a key the game never sets renders empty, which is why the two live together
 * here rather than in separate lists that can drift.
 */
export const RICH_PRESENCE_TOKEN_TEXT: Record<RichPresenceToken, string> = {
    '#Status_Daily': 'Daily Challenge — floor %floor%',
    '#Status_Endless': 'Endless — floor %floor%',
    '#Status_Menu': 'In the menus',
    '#Status_Puzzle': 'Solving a puzzle',
    '#Status_Run': '%mode% — floor %floor%'
};
