import type { RelicId, RunState } from '../../shared/contracts';
import { COMBO_HEAT_STAGE_FROM, comboAscensionReached, comboHeat, comboStageReached, comboSurge, type ComboHeatTheme } from '../../shared/combo-heat-rules';
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
    /** An ember run's weather: sparks and ash drifting up through the room, 0..1. */
    ash: number;
    /** Identity of the floor the run came back to after a void floor, for the return beat; null otherwise. */
    voidReturnKey: string | null;
    /** Grade over the plate: hue rotation, saturation and brightness, from the temper and the heat. */
    hueDeg: number;
    saturate: number;
    brightness: number;
    /** The prismatic run's slow hue cycle, on when the combo is warm. */
    prismatic: boolean;
    /** The unbounded climb past Legendary (`comboSurge`): more bolts, more of everything, forever. */
    surge: number;
    /**
     * The room's beats (the arcade tables' cabinet reacting, 捕鱼达人's jackpots and boss warnings):
     * a hit the whole room punches in on (a Fever break, an ascension), a miss the room darkens on,
     * a frost stage-up the room freezes on, a payout it rains gold on. Keyed to the turn or purchase
     * that made them, so a restore replays none.
     */
    hitKey: string | null;
    missKey: string | null;
    freezeKey: string | null;
    goldRain: { key: string; coins: number } | null;
    /** The bank is empty: the boss-warning state, held until a miss is banked again. */
    peril: boolean;
    /** How fast the room moves, 1 at rest, climbing with the surge: the frenzy tempo. */
    tempo: number;
    /** The relics on the run: each lights a fixture of the room for good. */
    relics: readonly RelicId[];
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

/** The weather every run shows at a cold combo, before the heat builds it (0..1). */
export const WEATHER_FLOOR = 0.45;

export const deriveSceneMood = ({
    combo,
    latestLoss,
    latestTurn = null,
    missesLeft = null,
    payout = null,
    run,
    storeOpen,
    temper
}: {
    combo: number;
    /** The latest miss on the journal, or null: the black hole reads it. */
    latestLoss: BoardTurnResolvedEvent | null;
    /** The latest resolved turn, for the hits, the miss beat and the freeze. */
    latestTurn?: BoardTurnResolvedEvent | null;
    /** Misses the bank holds now, null without a bank: zero is peril. */
    missesLeft?: number | null;
    /** A payout to rain gold on (a floor clear, a purchase), keyed by what paid it. */
    payout?: { key: string; gold: number } | null;
    run: Pick<RunState, 'board' | 'status' | 'relics'>;
    storeOpen: boolean;
    temper: ComboHeatTheme;
}): SceneMood => {
    const heat = comboHeat(combo);
    const surge = comboSurge(combo);
    const relics = run.relics ?? [];
    const turn = latestTurn;
    const before = turn?.announcement.currentStreakBefore ?? 0;
    const after = turn?.announcement.currentStreakAfter ?? 0;
    const ascended = turn ? comboAscensionReached(before, after) !== null : false;
    const feverBreak = turn ? turn.announcement.chainTierAfter === 'fever' && turn.announcement.chunkPairsBrokenAfter > turn.announcement.chunkPairsBrokenBefore : false;
    const hitKey = turn && (ascended || feverBreak) ? `hit:${turn.eventId}` : null;
    const missKey = turn && isMiss(turn) ? `miss:${turn.eventId}` : null;
    const freezeKey = turn && temper.id === 'frost' && comboStageReached(before, after) ? `freeze:${turn.eventId}` : null;
    // A payout rains its gold; an ascension rains on its own, and Deep Pockets makes every shower bigger.
    const pocketed = relics.includes('deep_pockets') ? 1.6 : 1;
    const goldRain = payout && payout.gold > 0
        ? { key: payout.key, coins: Math.round(payout.gold * 3 * pocketed) }
        : turn && ascended
          ? { key: `ascend:${turn.eventId}`, coins: Math.round((18 + surge * 12) * pocketed) }
          : null;
    const blackHoleKey = blackHoleKeyFor(run, latestLoss);
    const plate: ScenePlateId = storeOpen ? 'shop' : blackHoleKey ? 'void' : 'dungeon';
    /*
     * Every run has weather from its first turn (`SCENE_WEATHER_FLOOR`): a frost run opens on a
     * dusting of snow and rime at the edges, a storm run on wet stone and the odd far bolt, an
     * ember run on sparks and ash drifting up. The heat builds each from there. Until 2026-09-30
     * all of it started at zero, so a cold combo - every run's first turns, and every turn after a
     * miss - looked like no weather at all, and an ember run (seven in ten) never had any.
     */
    const weather = WEATHER_FLOOR + (1 - WEATHER_FLOOR) * heat;
    // A frost run stays frozen through every room: the snow masks are per plate, the pane is the screen's.
    const frost = temper.id === 'frost' && plate === 'dungeon' ? round(Math.min(1, weather * 1.15)) : 0;
    // Snow settles first, the pane follows, the cracks run last: the room freezes in that order.
    // The pane over the screen waits for the heat: it covers the board, so it is earned.
    const cold = temper.id === 'frost' ? heat : 0;
    const snow = temper.id === 'frost' ? round(Math.min(1, weather * 1.6)) : 0;
    const ice = round(Math.max(0, Math.min(1, (cold - 0.15) * 1.4)));
    const iceCracks = round(Math.max(0, Math.min(1, (cold - 0.35) * 1.8)));
    const storm = temper.id === 'storm' && plate === 'dungeon' ? round(weather) : 0;
    const ash = (temper.id === 'ember' || temper.id === 'prismatic') && plate !== 'shop' ? round(weather) : 0;
    const voidReturnKey = voidReturnKeyFor(run, latestLoss);
    const graded = plate === 'dungeon';
    return {
        plate,
        blackHoleKey,
        frost,
        snow,
        snowGlow: round(snow * (0.3 + 0.7 * cold)),
        ash,
        ice,
        iceCracks,
        iceGlow: round(iceCracks * (0.4 + 0.6 * cold)),
        storm,
        wet: round(temper.id === 'storm' && plate === 'dungeon' ? Math.min(1, 0.3 + heat) : 0),
        voidReturnKey,
        hueDeg: graded ? Math.round(temper.ringHueDeg * 0.35 * heat) + 0 : 0,
        saturate: round(graded ? (temper.id === 'frost' ? 1 - 0.45 * heat : 1 + 0.25 * heat) : plate === 'void' ? 0.8 : 1),
        brightness: round(graded ? (temper.id === 'frost' ? 1 + 0.12 * heat : 1 + 0.06 * heat) : plate === 'void' ? 0.85 : 1),
        prismatic: temper.id === 'prismatic' && graded && heat > 0,
        surge: round(surge),
        hitKey,
        missKey,
        freezeKey,
        goldRain,
        peril: missesLeft === 0 && (run.status === 'playing' || run.status === 'resolving'),
        tempo: round(1 + 0.35 * surge),
        relics
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
