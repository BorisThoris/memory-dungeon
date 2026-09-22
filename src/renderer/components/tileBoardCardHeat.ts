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
    /** Degrees of hue rotation on the card's light: cyan at rest, toward gold at Fever. */
    hueDeg: number;
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
        spinRate: round(0.02 + 0.14 * turning),
        hueDeg: Math.round(26 * eased) + 0
    };
};

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
