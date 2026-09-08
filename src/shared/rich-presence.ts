/**
 * What a player's friends see next to their name.
 *
 * Steam Rich Presence is two things: a `steam_display` key naming a localization token from the
 * Partner site, and whatever tokens that string interpolates. Everything here decides *what* to
 * say; `src/main/steam.ts` does the saying.
 *
 * The restraint worth stating: presence is broadcast to a player's whole friends list, so it says
 * what they are doing and never how well. A floor number is a place; a score, a life count, or a
 * run about to end is a performance, and nobody opted into publishing that by pressing Play.
 */
import type { GameMode, RichPresenceState, RichPresenceToken } from './contracts';

export type { RichPresenceState, RichPresenceToken } from './contracts';

const MODE_LABELS: Record<GameMode, string> = {
    endless: 'Endless'
};

export interface RichPresenceInput {
    readonly floor?: number | null;
    readonly gameMode?: GameMode | null;
    readonly inRun: boolean;
}

/*
 * One mode, one token. The map stays a map rather than a constant because the fallback below is
 * what a mode added later gets before it has a Partner-site token of its own, and losing that
 * would mean a new mode silently broadcasting the wrong line.
 */
const TOKEN_BY_MODE: Partial<Record<GameMode, RichPresenceToken>> = {
    endless: '#Status_Endless'
};

/**
 * A menu player is "In the menus" and nothing else — not "just lost on floor 12", which is what a
 * naive implementation broadcasts for the seconds after a run ends.
 */
export const buildRichPresence = ({ floor, gameMode, inRun }: RichPresenceInput): RichPresenceState => {
    if (!inRun || !gameMode) {
        return { display: '#Status_Menu' };
    }
    const display = TOKEN_BY_MODE[gameMode] ?? '#Status_Run';
    const state: RichPresenceState = { display, mode: MODE_LABELS[gameMode] };
    const safeFloor = typeof floor === 'number' && Number.isFinite(floor) && floor >= 1 ? Math.floor(floor) : null;
    return safeFloor === null ? state : { ...state, floor: String(safeFloor) };
};

/** The key/value pairs to hand Steam. A key whose value is absent is cleared, not skipped. */
export const richPresencePairs = (state: RichPresenceState): ReadonlyArray<readonly [string, string | null]> => [
    ['steam_display', state.display],
    ['mode', state.mode ?? null],
    ['floor', state.floor ?? null]
];

export const richPresenceEquals = (left: RichPresenceState | null, right: RichPresenceState | null): boolean =>
    left?.display === right?.display && left?.floor === right?.floor && left?.mode === right?.mode;
