import { tr } from '../../shared/i18n';
/**
 * Settings › About › What's new (2026-11-13). Written from the commit log, one entry per week,
 * newest first: what a player can see, never a number or name the log does not state. Add the
 * newest week at the top when a release goes out.
 */
export interface PatchNote {
    /** The Monday of the week, YYYY-MM-DD. */
    week: string;
    items: readonly string[];
}

export const PATCH_NOTES: readonly PatchNote[] = [
    {
        week: '2026-11-09',
        items: [
            tr.s('A run you leave mid-way waits on the menu under Continue.'),
            tr.s('Settings › About has the credits, the licences, the privacy policy and a way to delete all progress.'),
            tr.s('Move your progress to another device: export a save file here, import it there.'),
            tr.s('Keys can be rebound in Settings › Controls, and the dock’s tools answer to 1 to 9.'),
            tr.s('High Contrast in Settings › Accessibility strengthens the interface’s text and rules.'),
            tr.s('A one-time note about flashing light, with Reduce Motion one tap away.'),
            tr.s('The first card flip no longer stalls while the card art is prepared.'),
            tr.s('Phones start on Low graphics, and Chrome no longer translates the game’s numbers and names.'),
            tr.s('The Turncoat is retired.')
        ]
    },
    {
        week: '2026-11-02',
        items: [
            tr.s('The store’s shelves fit on a laptop’s screen, and the store and the doors stay clear of the room.'),
            tr.s('Reprise lands, Bomb sounds as it arms, and each tool has an effect of its own.'),
            tr.s('The crown’s stacked notices became chips, and the board got its height back.'),
            tr.s('A floor’s notices hang below the memorize heading, with the board fitted under them.')
        ]
    },
    {
        week: '2026-10-26',
        items: [
            tr.s('The combo pays, the dungeon answers it, and a broken streak is felt.'),
            tr.s('Your best combo is replayed at the end of a run.'),
            tr.s('The store stop is yours again, with relics that grow, awaken and fuse.'),
            tr.s('Match rules: Opposites, Element pairs, Triples, Sequences and the Flurry, more of them deeper down.')
        ]
    },
    {
        week: '2026-10-19',
        items: [
            tr.s('The Descent is forty floors, and the Depths go twenty rungs past the Warden.'),
            tr.s('New in the dungeon: the Spiral, Sleepers, Masks, Carve, Reprise, the Cartographer and the Keeper of Halls.'),
            tr.s('Relics evolve, and you can carry four.'),
            tr.s('Doors before each act boss, three painted boss rooms, and the complete Warden.'),
            tr.s('Thirty feats, and the Codex names every act, tier, evolution, feat and rung.')
        ]
    }
];

export const PATCH_NOTES_COPY = {
    title: tr.s('What’s new'),
    weekOf: (week: string): string => tr`Week of ${week}`
} as const;
