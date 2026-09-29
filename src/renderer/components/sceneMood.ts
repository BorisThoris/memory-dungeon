import type { RunState } from '../../shared/contracts';
import { COMBO_HEAT_STAGE_FROM, comboHeat, type ComboHeatTheme } from '../../shared/combo-heat-rules';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';

/**
 * What the room becomes, read off the run.
 *
 * The backdrop was a painting the run lit (`GameplayScene`: base + additive light passes). Now the
 * run can change the painting itself, the way a table in the arcade pool games freezes over on an
 * ice streak or the shop is a different room. Three things move it, all derived from run state so
 * a restore shows the same room and nothing replays on a mount:
 *
 * - **The temper and the heat** grade the room: a frost run turns cold and crystallises inward
 *   from the edges as the combo climbs; storm goes violet and flashes; prismatic shifts hue.
 * - **A great combo dying** (Inferno or better lost to a miss) opens a black hole: the plate
 *   collapses into it and the room is the void for the rest of that floor. The next floor is the
 *   dungeon again - the stairs are the way out.
 * - **The store stop** is its own place: while the sheet is open the room is the merchant's
 *   vault, and Descend brings the dungeon back.
 *
 * Everything here is presentation; nothing a rule reads.
 */
export type ScenePlateId = 'dungeon' | 'shop' | 'void';

export interface SceneMood {
    plate: ScenePlateId;
    /** Identity of the miss that opened the black hole, for the collapse animation; null when none. */
    blackHoleKey: string | null;
    /** How far the frost has grown in from the edges, 0..1; only a frost run's. */
    frost: number;
    /** Snow settled on the room's surfaces, 0..1, and the light in it; only a frost run's. */
    snow: number;
    snowGlow: number;
    /** The ice sheet over the screen: how much pane, how far its cracks have run, the light in them. */
    ice: number;
    iceCracks: number;
    iceGlow: number;
    /** A storm run's flashes, 0..1 with the heat; 0 otherwise. */
    storm: number;
    /** A storm run's wet stone: the sheen on the room's upward faces, 0..1. */
    wet: number;
    /** Identity of the floor the run came back to after a void floor, for the return beat; null otherwise. */
    voidReturnKey: string | null;
    /** Grade over the plate: hue rotation, saturation and brightness, from the temper and the heat. */
    hueDeg: number;
    saturate: number;
    brightness: number;
    /** The prismatic run's slow hue cycle, on when the combo is warm. */
    prismatic: boolean;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

const isMiss = (event: BoardTurnResolvedEvent): boolean => event.outcome === 'mismatch' || event.outcome === 'gambit_mismatch';

/**
 * The black hole: the latest turn was a miss that ended a combo of Inferno or better, on the floor
 * the run is still on. A floor clear or a new floor closes it; a later match on the same floor
 * does not, because the room stays what the loss made it until the stairs.
 */
export const blackHoleKeyFor = (run: Pick<RunState, 'board' | 'status'>, latestLossEvent: BoardTurnResolvedEvent | null): string | null => {
    if (!latestLossEvent || !isMiss(latestLossEvent)) return null;
    if (latestLossEvent.announcement.currentStreakBefore < COMBO_HEAT_STAGE_FROM.inferno) return null;
    if (run.status !== 'playing' && run.status !== 'resolving') return null;
    if (latestLossEvent.announcement.level !== run.board?.level) return null;
    return `void:${latestLossEvent.eventId}`;
};

/**
 * The return from the void: the floor after a black hole's. Keyed to the loss that opened it, so
 * the beat plays once as the dungeon comes back and never on a later floor or a restore of one.
 */
export const voidReturnKeyFor = (run: Pick<RunState, 'board' | 'status'>, latestLoss: BoardTurnResolvedEvent | null): string | null => {
    if (!latestLoss || !isMiss(latestLoss)) return null;
    if (latestLoss.announcement.currentStreakBefore < COMBO_HEAT_STAGE_FROM.inferno) return null;
    if (run.board?.level !== latestLoss.announcement.level + 1) return null;
    return `return:${latestLoss.eventId}`;
};

export const deriveSceneMood = ({
    combo,
    latestLoss,
    run,
    storeOpen,
    temper
}: {
    combo: number;
    /** The latest miss on the journal, or null: the black hole reads it. */
    latestLoss: BoardTurnResolvedEvent | null;
    run: Pick<RunState, 'board' | 'status'>;
    storeOpen: boolean;
    temper: ComboHeatTheme;
}): SceneMood => {
    const heat = comboHeat(combo);
    const blackHoleKey = blackHoleKeyFor(run, latestLoss);
    const plate: ScenePlateId = storeOpen ? 'shop' : blackHoleKey ? 'void' : 'dungeon';
    // A frost run stays frozen through every room: the snow masks are per plate, the pane is the screen's.
    const frost = temper.id === 'frost' && plate === 'dungeon' ? round(Math.min(1, heat * 1.15)) : 0;
    // Snow settles first, the pane follows, the cracks run last: the room freezes in that order.
    const cold = temper.id === 'frost' ? heat : 0;
    const snow = round(Math.min(1, cold * 1.6));
    const ice = round(Math.max(0, Math.min(1, (cold - 0.15) * 1.4)));
    const iceCracks = round(Math.max(0, Math.min(1, (cold - 0.35) * 1.8)));
    const storm = temper.id === 'storm' && plate === 'dungeon' ? round(heat) : 0;
    const voidReturnKey = voidReturnKeyFor(run, latestLoss);
    const graded = plate === 'dungeon';
    return {
        plate,
        blackHoleKey,
        frost,
        snow,
        snowGlow: round(snow * (0.3 + 0.7 * cold)),
        ice,
        iceCracks,
        iceGlow: round(iceCracks * (0.4 + 0.6 * cold)),
        storm,
        wet: round(temper.id === 'storm' && plate === 'dungeon' ? Math.min(1, 0.3 + heat) : 0),
        voidReturnKey,
        hueDeg: graded ? Math.round(temper.ringHueDeg * 0.35 * heat) + 0 : 0,
        saturate: round(graded ? (temper.id === 'frost' ? 1 - 0.45 * heat : 1 + 0.25 * heat) : plate === 'void' ? 0.8 : 1),
        brightness: round(graded ? (temper.id === 'frost' ? 1 + 0.12 * heat : 1 + 0.06 * heat) : plate === 'void' ? 0.85 : 1),
        prismatic: temper.id === 'prismatic' && graded && heat > 0
    };
};

/** The latest miss on the journal, for the black hole; the caller hands it the resolved events. */
export const latestMissEvent = (events: readonly BoardTurnResolvedEvent[]): BoardTurnResolvedEvent | null => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]!;
        if (isMiss(event)) return event;
    }
    return null;
};
