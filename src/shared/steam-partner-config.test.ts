import { describe, expect, it } from 'vitest';
import { renderAchievementRows, renderRichPresenceRows } from '../../scripts/steam-partner-config';
import { ACHIEVEMENT_BY_ID } from './achievements';
import { ACHIEVEMENT_IDS } from './save-data';
import { buildRichPresence, richPresencePairs } from './rich-presence';
import { RICH_PRESENCE_TOKEN_TEXT } from './steam-rich-presence-tokens';
import { STEAM_ACHIEVEMENT_API_NAME } from './steam-achievement-api-names';
import type { GameMode } from './contracts';

const GAME_MODES: GameMode[] = ['daily', 'endless', 'gauntlet', 'meditation', 'puzzle'];

describe('the Partner-site rows', () => {
    it('lists every achievement the game can award', () => {
        const rendered = renderAchievementRows();

        for (const id of ACHIEVEMENT_IDS) {
            // An API name missing from the dashboard makes that unlock fail at the Steam boundary,
            // so a row this printer omits is a row nobody knows to create.
            expect(rendered).toContain(STEAM_ACHIEVEMENT_API_NAME[id]);
            expect(rendered).toContain(ACHIEVEMENT_BY_ID[id].title);
            expect(rendered).toContain(ACHIEVEMENT_BY_ID[id].description);
        }
        expect(rendered).toContain(`${ACHIEVEMENT_IDS.length} achievements`);
    });

    it('does not let a table cell break the markdown it is pasted into', () => {
        for (const id of ACHIEVEMENT_IDS) {
            expect(ACHIEVEMENT_BY_ID[id].title).not.toContain('|');
            expect(ACHIEVEMENT_BY_ID[id].description).not.toContain('|');
        }
    });

    it('covers every token the game can actually broadcast', () => {
        const rendered = renderRichPresenceRows();
        const broadcast = new Set([
            buildRichPresence({ floor: null, gameMode: null, inRun: false }).display,
            ...GAME_MODES.map((gameMode) => buildRichPresence({ floor: 3, gameMode, inRun: true }).display)
        ]);

        expect(broadcast.size).toBeGreaterThan(1);
        for (const token of broadcast) {
            expect(RICH_PRESENCE_TOKEN_TEXT[token]).toMatch(/\S/);
            expect(rendered).toContain(token);
        }
    });

    it('only interpolates keys the game actually sets', () => {
        const keys = new Set(
            richPresencePairs(buildRichPresence({ floor: 3, gameMode: 'endless', inRun: true })).map(([key]) => key)
        );

        for (const text of Object.values(RICH_PRESENCE_TOKEN_TEXT)) {
            // A token naming a key nothing sets renders as an empty gap on a friends list.
            for (const placeholder of text.match(/%(\w+)%/gu) ?? []) {
                expect(keys).toContain(placeholder.replaceAll('%', ''));
            }
        }
    });
});
