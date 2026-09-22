import {
    CARD_BREAK_DROP,
    CARD_FEVER_FILL,
    cardBreakSnuff,
    cardFeverArrival,
    cardHeatLevels,
    cardMatchFlare
} from './tileBoardCardHeat';

/**
 * One frame of a card's light, as a function rather than a closure over refs.
 *
 * `tileBoardCardHeat` says how bright a streak makes a card; this says what a card actually shows
 * on a given frame, which is that answer plus three things that only a frame loop can know: how
 * long ago the pair landed, how long ago the chain broke, and where the card is in its own breath.
 *
 * Under reduce motion a card's light is a pure function of the chain and nothing else: no breath,
 * no turning medallion, and none of the transients — no flare when a pair lands, no gutter when one
 * is lost, no flourish at Fever. Those are all sudden changes in brightness, which is the thing the
 * setting exists to spare someone, and the chain is still legible without them because the light
 * level itself is what carries it.
 *
 * It lives apart from the component because it is the part worth testing. The wiring from a chain
 * meter to a material's opacity is where a streak becomes something a player can see, and it was
 * the one step in that chain with no test: the levels were proven, the component's use of them was
 * not. Being pure, it also means the transitions — a pair landing, a chain breaking, a card being
 * turned over mid-flare — can be driven frame by frame in a test at whatever rate is interesting.
 */
export interface CardGlowFrameInput {
    /** Chain meter fill, 0 at rest to 1 at Fever. */
    heat: number;
    matched: boolean;
    reduceMotion: boolean;
    /** Per-card phase source, so two cards never breathe together. */
    seed: number;
    /** The render clock, in seconds. */
    time: number;
}

/** What the card carries between frames. `heat` is kept to spot the fall that means a break. */
export interface CardGlowFrameMemory {
    heat: number;
    matchedAt: number | null;
    snuffedAt: number | null;
    /** When the meter last filled, so the arrival is thrown once rather than held. */
    feverAt: number | null;
}

export interface CardGlowFrame {
    glowOpacity: number;
    spinOpacity: number;
    /** Radians about the card's centre; one way, so the medallion reads as a mechanism. */
    spinRotation: number;
}

export const initialCardGlowMemory = (heat: number): CardGlowFrameMemory => ({
    heat,
    matchedAt: null,
    snuffedAt: null,
    feverAt: null
});

const fract = (value: number): number => value - Math.floor(value);

export const cardGlowPhase = (seed: number): number => fract(seed * 0.618034) * Math.PI * 2;

export const advanceCardGlowFrame = (
    { heat, matched, reduceMotion, seed, time }: CardGlowFrameInput,
    memory: CardGlowFrameMemory
): { frame: CardGlowFrame; memory: CardGlowFrameMemory } => {
    const matchedAt = matched ? (memory.matchedAt ?? time) : null;
    // The chain meter only empties on a mismatch, so a fall this large is the break itself.
    const broke = heat < memory.heat - CARD_BREAK_DROP;
    const snuffedAtCandidate = broke ? time : memory.snuffedAt;
    const snuff = snuffedAtCandidate == null || reduceMotion ? 1 : cardBreakSnuff(time - snuffedAtCandidate);
    // Let the card forget a gutter it has finished, so it never carries one into the next chain.
    const snuffedAt = snuff >= 1 ? null : snuffedAtCandidate;

    // Fever is the top of the meter, and reaching it is a rising edge: a board already at Fever
    // must not throw the flourish again on every frame it stays there.
    const atFever = heat >= CARD_FEVER_FILL;
    const arrivedNow = atFever && memory.heat < CARD_FEVER_FILL;
    const feverAtCandidate = arrivedNow ? time : (atFever ? memory.feverAt : null);
    const arrival = feverAtCandidate == null || reduceMotion ? 0 : cardFeverArrival(time - feverAtCandidate);
    const feverAt = arrival <= 0 && !arrivedNow ? null : feverAtCandidate;

    const levels = cardHeatLevels(heat);
    const phase = cardGlowPhase(seed);
    // A slow breath per card so a still board is never dead, and never a single pulse.
    const breath = reduceMotion ? 1 : 1 + 0.12 * Math.sin(time * 0.9 + phase);
    const flare = matchedAt == null || reduceMotion ? 0 : cardMatchFlare(time - matchedAt, heat);

    return {
        frame: {
            glowOpacity: Math.min(1.6, levels.runeGlow * breath * snuff + flare + arrival),
            spinOpacity: Math.min(1.4, levels.spin * breath * snuff + flare * 0.6 + arrival * 0.5),
            spinRotation: reduceMotion ? 0 : -time * levels.spinRate * Math.PI * 2 + phase * 0.2
        },
        memory: { heat, matchedAt, snuffedAt, feverAt }
    };
};
