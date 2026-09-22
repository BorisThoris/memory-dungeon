/**
 * How the card backs answer a streak.
 *
 * The board is what a player stares at, so it is where a streak should be felt. The painted back
 * carries its own light — cyan runes and a gold labyrinth (`scripts/card-pipeline/cut_card_back_glow.py`
 * keys them out as additive layers) — and this says how hard that light burns and how fast the
 * medallion turns, as continuous functions of the chain meter's fill rather than four steps.
 *
 * The shape of the ramp is the point. At chain zero the backs are the painting, dead still: there
 * is nothing to lose yet. The rune light comes up early and gently, so the first pair already
 * changes the board. The medallion only starts turning once a chain is real, and its speed keeps
 * climbing to Fever, so the board is visibly accelerating under the player's hands — and a break
 * drops it back to stillness, which is the cost being shown rather than written.
 */
export interface CardHeatLevels {
    /** Opacity of the rune glow over the whole back. */
    runeGlow: number;
    /** Opacity of the turning medallion. */
    spin: number;
    /** Turns per second of the medallion. */
    spinRate: number;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const cardHeatLevels = (fill: number): CardHeatLevels => {
    const f = clamp01(fill);
    // Ease out: the first pairs of a chain change the board most, which is what makes a player
    // reach for the second one.
    const eased = 1 - (1 - f) * (1 - f);
    // The medallion is still until a chain exists, then accelerates the whole way to Fever.
    const turning = clamp01((f - 0.12) / 0.88);
    return {
        runeGlow: round(0.22 + 0.78 * eased),
        spin: round(0.9 * turning * turning * (3 - 2 * turning)),
        spinRate: round(0.02 + 0.14 * turning)
    };
};

/**
 * Fever is the top of the meter: `chainMeter.fill` reaches exactly 1 there and stays until the
 * chain drops, so crossing it is a rising edge a card can watch for.
 */
export const CARD_FEVER_FILL = 1;

/**
 * The flourish the whole board throws in the moment a run reaches Fever, as an addition on top of
 * everything else. `age` is seconds since the meter filled.
 *
 * Climbing to Fever was a ramp with no arrival. Every step of the chain already brightened the
 * cards and wound the medallion faster, so the top of the meter — the thing the run is *for* —
 * passed without a beat of its own. This is that beat: longer and larger than the flare a single
 * pair throws, and it lands on every card at once, because the board arrives at Fever as one thing
 * rather than card by card.
 */
export const cardFeverArrival = (age: number): number => {
    if (!Number.isFinite(age) || age < 0) {
        return 0;
    }
    const attack = 0.12;
    const decay = 1.1;
    if (age < attack) {
        return round(0.95 * (age / attack));
    }
    const fade = 1 - (age - attack) / decay;
    return fade <= 0 ? 0 : round(0.95 * fade * fade);
};

/**
 * How far a card's light is pulled down in the moment a streak is lost, as a multiplier on
 * everything else. `age` is seconds since the chain fell.
 *
 * Winning is already felt — the board brightens and the medallion winds up. Losing was not: the
 * heat simply went to zero and the light faded on its own ramp, which reads as the board settling
 * rather than as something being taken away. The cards now gutter: the light is snuffed below its
 * resting level for a moment and then comes back, so a break is a thing that *happens* rather than
 * a thing that stops happening.
 */
export const cardBreakSnuff = (age: number): number => {
    if (!Number.isFinite(age) || age < 0) {
        return 1;
    }
    const hold = 0.09;
    const recover = 0.55;
    if (age < hold) {
        return 0.22;
    }
    const t = (age - hold) / recover;
    return t >= 1 ? 1 : round(0.22 + 0.78 * t * t);
};

/**
 * How far the chain has to fall in one frame to count as a break rather than the meter easing.
 * A mismatch empties the meter, so the drop is large; nothing else moves it down at all.
 */
export const CARD_BREAK_DROP = 0.12;

/**
 * The flare a card throws when its pair lands: a short, hard spike on top of whatever the streak
 * already had, bigger the further the chain has come. `age` is seconds since the match.
 */
export const cardMatchFlare = (age: number, fill: number): number => {
    if (!Number.isFinite(age) || age < 0) {
        return 0;
    }
    const peak = 0.55 + 0.85 * clamp01(fill);
    const attack = 0.07;
    const decay = 0.62;
    if (age < attack) {
        return round(peak * (age / attack));
    }
    const fade = 1 - (age - attack) / decay;
    return fade <= 0 ? 0 : round(peak * fade * fade);
};
