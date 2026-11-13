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
            'A run you leave mid-way waits on the menu under Continue.',
            'Settings › About has the credits, the licences, the privacy policy and a way to delete all progress.',
            'Move your progress to another device: export a save file here, import it there.',
            'Keys can be rebound in Settings › Controls, and the dock’s tools answer to 1 to 9.',
            'High Contrast in Settings › Accessibility strengthens the interface’s text and rules.',
            'A one-time note about flashing light, with Reduce Motion one tap away.',
            'The first card flip no longer stalls while the card art is prepared.',
            'Phones start on Low graphics, and Chrome no longer translates the game’s numbers and names.',
            'The Turncoat is retired.'
        ]
    },
    {
        week: '2026-11-02',
        items: [
            'The store’s shelves fit on a laptop’s screen, and the store and the doors stay clear of the room.',
            'Reprise lands, Bomb sounds as it arms, and each tool has an effect of its own.',
            'The crown’s stacked notices became chips, and the board got its height back.',
            'A floor’s notices hang below the memorize heading, with the board fitted under them.'
        ]
    },
    {
        week: '2026-10-26',
        items: [
            'The combo pays, the dungeon answers it, and a broken streak is felt.',
            'Your best combo is replayed at the end of a run.',
            'The store stop is yours again, with relics that grow, awaken and fuse.',
            'Match rules: Opposites, Element pairs, Triples, Sequences and the Flurry, more of them deeper down.'
        ]
    },
    {
        week: '2026-10-19',
        items: [
            'The Descent is forty floors, and the Depths go twenty rungs past the Warden.',
            'New in the dungeon: the Spiral, Sleepers, Masks, Carve, Reprise, the Cartographer and the Keeper of Halls.',
            'Relics evolve, and you can carry four.',
            'Doors before each act boss, three painted boss rooms, and the complete Warden.',
            'Thirty feats, and the Codex names every act, tier, evolution, feat and rung.'
        ]
    }
];

export const PATCH_NOTES_COPY = {
    title: 'What’s new',
    weekOf: (week: string): string => `Week of ${week}`
} as const;
