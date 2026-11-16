import { tr } from '../../shared/i18n';
/**
 * Everything pass-and-play says to the room.
 *
 * A same-device game is read by more than one person at once, often from the wrong angle, so the
 * lines are short and say who rather than what: the player waiting needs to know it is their turn
 * from across a table, not to read a sentence about turn ownership.
 */
export const PASS_AND_PLAY_COPY = {
    /** One start action per seat count, so a table says how many are playing in one press. */
    seatCountLabel: (seats: number): string => tr`${seats} players`,
    /**
     * The seat name with no room to say it. On a phone held sideways the full names pushed the whole
     * stat row past the right edge, taking the mutator with them.
     */
    seatShortLabel: (seatNumber: number): string => `P${seatNumber}`,
    /** What a screen reader reads for a seat, so the short form costs nothing. */
    seatAnnouncement: (label: string, score: number, bestChain = 0): string =>
        `${label}, ${score.toLocaleString()}${bestChain > 0 ? tr`, best chain ×${bestChain}` : ''}`,
    /** The seat's chain record on the standings, beside the score. */
    seatChainNote: (bestChain: number): string => tr`best chain ×${bestChain}`,
    /** How far through the agreed length the table is, so nobody has to remember. */
    floorProgress: (level: number, floors: number): string => `${level} / ${floors}`,
    /** Label over the seat scores in the HUD. */
    seatsLabel: tr.s('Players'),
    /**
     * Spoken by the live region when the device changes hands. When the miss ended a chain worth
     * naming, the line says whose and how long first: that is the moment the table reacts to.
     */
    handoffAnnouncement: (label: string, chainLost: { label: string; chain: number } | null = null): string =>
        chainLost ? tr`${chainLost.label}'s chain of ${chainLost.chain} ends. ${label}'s turn.` : tr`${label}'s turn.`,
    /** The banner over a face-down board between turns. */
    handoffTitle: (label: string): string => tr`Pass to ${label}`,
    handoffBody: tr.s('The board is face down. Flip any tile when you are ready.'),
    /** Marks whose turn it is for anyone reading the HUD rather than the banner. */
    activeSeatHint: tr.s('to play'),
    /** Game over. */
    winnerTitle: (label: string): string => tr`${label} wins`,
    drawTitle: tr.s('A draw'),
    drawBody: tr.s('The same score on both sides, so the table splits it.'),
    standingsLabel: tr.s('Final scores'),
    /**
     * Said plainly on the results screen. A shared game writing one person's number into this
     * save's personal best would be a lie about who did it, so it does not.
     */
    notRecordedNote: tr.s('A shared game is not recorded to this profile: no personal best, no run history.')
} as const;
