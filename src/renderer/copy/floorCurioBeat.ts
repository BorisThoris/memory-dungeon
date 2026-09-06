import type { FloorCurio } from '../../shared/floor-curio-rules';

/**
 * How a floor introduces whoever lives on it.
 *
 * The resident is decided from the run's seed before the stairs are taken, so the floor-clear
 * screen can name them honestly: this is not a tease, it is the same roll the floor advance will
 * apply. Naming them there rather than on arrival is the point — meeting a hoarding rat is a
 * shrug, but being told a hoarding rat is downstairs makes the descent a decision about who you
 * are about to share a room with.
 *
 * Two registers, deliberately. The written line keeps the resident's voice, because the voice is
 * the whole reason they exist. The spoken line drops it and states what will change, because a
 * screen reader user gets one pass and cannot re-read the joke to find the mechanic inside it.
 */
export const FLOOR_CURIO_COPY = {
    /** Prefix on the floor-clear note. Short, because the resident's own line follows it. */
    downstairsPrefix: 'Downstairs',
    /** Heading for the Codex article that lists the whole cast. */
    codexTitle: 'The residents',
    codexDescription:
        'Every floor has someone else on it, rolled from your run seed. Most of them help. One of them ' +
        'talks over the memorize window. One of them is a sock. You are told who is coming before you ' +
        'take the stairs, and once you are down there you can say hello — free, once per floor, from ' +
        'the Greet control. It never costs you anything, and most of them give you something for it.'
} as const;

/** "Downstairs: A hoarding rat. It has been collecting..." — the note on the floor-clear screen. */
export const floorClearResidentLine = (curio: FloorCurio): string =>
    `${FLOOR_CURIO_COPY.downstairsPrefix}: ${curio.name}. ${curio.line}`;

/** How the Codex describes one resident: what they do on arrival, and what they say if greeted. */
export const codexResidentDescription = (curio: FloorCurio, greetingGained: string): string =>
    `${curio.line} ${curio.effectSummary} Greet them: ${greetingGained}`;

/** The same meeting, said plainly: who, and what it changes. */
export const floorCurioAnnouncement = (curio: FloorCurio): string =>
    `${curio.name} is on the next floor. ${curio.effectSummary}`;
