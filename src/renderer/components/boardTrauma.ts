import type { ChainTier } from '../../shared/chain-tier-rules';
import type { BoardState, RunStatus } from '../../shared/contracts';
import { getResolvingSelectionState } from './tileResolvingSelection';

/**
 * The shake, on Eiserloh's trauma model (GDC 2016, "Juicing Your Cameras With Math"; the three
 * claims taken from it are verified 3-0 in `docs/RESEARCH_NOTES.md` §2).
 *
 * What was here before: `Math.sin(t * 36) * 0.022` on the two mismatched cards, switched on while
 * `resolvingSelection === 'mismatch'` and off the frame it stopped. Three things wrong with that,
 * two of them load-bearing for this game rather than matters of taste.
 *
 * - **It could not stack.** Two events in a turn gave the same shake as one, and a Fever break -
 *   the biggest thing that happens on this board - shook nothing at all, because only a mismatch
 *   was wired to it.
 * - **It could not decay.** A shake that ends on a state change ends mid-swing, which reads as a
 *   dropped frame rather than as a settling.
 * - **It was a sine, not noise.** A pure tone is legible as a tone; the model's whole point is that
 *   the offset is sampled from smooth noise so the motion has no period to hear.
 *
 * The model: a `trauma` scalar in [0, 1]. Events ADD to it (0.2 to 0.5 in the source's own band),
 * it decays linearly with time, and the applied shake is trauma raised to a power - so a small
 * trauma is nearly nothing and a full one is violent, rather than the linear ramp that makes every
 * event feel the same size.
 *
 * **The exponent is cubic, deliberately.** The talk publishes the mapping trauma .30/.60/.90 ->
 * 3%/22%/73% of maximum shake. That is the CUBIC branch: 0.3^3 = 0.027, 0.6^3 = 0.216,
 * 0.9^3 = 0.729. Squared would give 9/36/81, which is a different and much flatter curve. The
 * source offers both; this picks cubic and `boardTrauma.test.ts` pins it against those three
 * published figures, so a later "simplification" to squared fails rather than passes quietly.
 *
 * **Translational and rotational together**, which is the source's advice for 2D specifically
 * (rotational alone it calls "kinda lame", translational alone "nice", the two together best). Its
 * 3D advice inverts and does not apply to a board seen flat on.
 *
 * **Why this matters here and not only elsewhere.** Two properties of the game make the model
 * load-bearing rather than a nicer curve:
 *
 * - **Hit-stop.** A Fever break slows and holds time (`FEVER_WAVE_SLOW`, Gen 139). The shake is a
 *   pure function of the clock it is handed, so scaling or pausing that clock scales or pauses the
 *   shake and nothing else - the same sample comes back for the same time. A per-frame random
 *   shake keeps jittering at full speed through a hold, which is exactly when the player is
 *   looking at it.
 * - **Replay.** Share codes, daily runs and the endless simulation's replay verification all
 *   re-run a run and expect the same thing back. Noise indexed by time is resamplable; frame
 *   randomness is not, and would make a recorded run and its replay differ on screen.
 *
 * The magnitudes below are this game's, not the source's - the talk publishes none and says so.
 */

/**
 * The maxima, in board units (a card is `CARD_PLANE_WIDTH` 0.74 wide) and radians. These are the
 * trauma-1.0 asymptote, and it is worth saying what the cubic does to them rather than leaving the
 * numbers to be read as the shake anyone sees:
 *
 *   mismatch   trauma 0.20 -> 0.8% of maximum  -> peak 0.002 units, a hint
 *   pop        trauma 0.20 -> 0.8%             -> peak 0.002 units
 *   Fever      trauma 0.50 -> 12.5%            -> peak 0.024 units, a shade over the old wobble
 *   stacked    trauma 1.00 -> 100%             -> peak 0.19 units, a quarter of a card, violent
 *
 * (Peaks, not the maxima themselves: noise touches its bound rarely, so the asymptote below is a
 * ceiling on the channel rather than a figure anyone sees.)
 *
 * So a single miss is a whisper where it used to be the loudest shake in the game, and that is the
 * intended correction, not an accident of the curve: a miss already has the red tint, the danger
 * rim and the miss floater saying so, while the break - the thing the hit-stop exists to let the
 * player watch - shook nothing at all. Full trauma needs events stacking inside a second, which is
 * a Fever break landing on top of a miss and its own ripple; it is reachable and it is rare.
 */
export const BOARD_SHAKE_MAX_OFFSET_X = 0.2;
export const BOARD_SHAKE_MAX_OFFSET_Y = 0.16;
/** 0.09 rad is 5.2 degrees at full trauma and about 0.65 at a Fever break's: a tip, not a spin. */
export const BOARD_SHAKE_MAX_ANGLE = 0.09;

export interface TraumaShakeMaxima {
    angle: number;
    offsetX: number;
    offsetY: number;
}

export const BOARD_SHAKE_MAXIMA: TraumaShakeMaxima = {
    angle: BOARD_SHAKE_MAX_ANGLE,
    offsetX: BOARD_SHAKE_MAX_OFFSET_X,
    offsetY: BOARD_SHAKE_MAX_OFFSET_Y
};

/**
 * The two cards of a miss shake on the same model but in their own space, because the subject is
 * different: the board shaking is the room, and a card shaking is the card saying it was wrong.
 * Sized so a miss at `TRAUMA_BY_SOURCE.mismatchTile` peaks at about 0.021 board units - which is
 * where the sine wobble this replaces sat, so the beat of a miss is unchanged while the shape of
 * it is.
 */
export const TILE_SHAKE_MAXIMA: TraumaShakeMaxima = { angle: 0.07, offsetX: 0.176, offsetY: 0.145 };
/** Noise cycles a second. Fast enough to read as a shake, slow enough that a frame is a step. */
export const BOARD_SHAKE_FREQUENCY_HZ = 17;

/**
 * The three channels are the same noise read at three places far apart on its line, so x, y and
 * the tilt never move together and never repeat each other.
 */
export const BOARD_SHAKE_CHANNEL_OFFSETS = { angleZ: 3121.7, offsetX: 0, offsetY: 1013.3 } as const;

export const TRAUMA_EXPONENT = 3;
/**
 * Trauma a second. A Fever break's 0.5 is gone in 1.1 seconds and a mismatch's 0.25 in 0.55 - about
 * the length of the wobble this replaces, so the beat of a miss is unchanged while the shape of it
 * is not.
 */
export const TRAUMA_DECAY_PER_SECOND = 0.45;

export type BoardTraumaSource = ChainTier | 'mismatch' | 'mismatchTile' | 'pop';

/**
 * What each event is worth, inside the source's 0.2-0.5 band. The ladder is the game's own: a pop
 * is the smallest break there is and Fever the largest, and a miss sits with a Clean break because
 * losing a turn and winning a small one are about equally loud.
 */
export const TRAUMA_BY_SOURCE: Record<BoardTraumaSource, number> = {
    clean: 0.3,
    fever: 0.5,
    /** A miss, felt by the whole board: the bottom of the band, because one miss is not the room shaking. */
    mismatch: 0.2,
    /** The same miss felt by the two cards that made it: the top of the band, because it is theirs. */
    mismatchTile: 0.5,
    none: 0,
    pop: 0.2,
    sharp: 0.4
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Quintic fade, 6t^5 - 15t^4 + 10t^3: the curve Perlin moved to so the second derivative is continuous too. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * The gradient at a lattice point, in [-1, 1]. One dimension admits only two UNIT gradients, and a
 * noise built on those two alone is exactly zero at every lattice point and at half of the
 * half-cells besides - a third of the samples are nothing, which reads as a stutter rather than a
 * shake. Hashing to a continuous gradient instead keeps the construction (a gradient per lattice
 * point, dotted with the offset, faded between) and loses the dead samples. A cheap integer hash
 * rather than a permutation table: the line this is read along is short, and the table would be the
 * larger thing to keep honest.
 */
const gradientAt = (cell: number): number => {
    let hash = Math.imul(cell | 0, 0x27d4_eb2d) ^ 0x165_667b1;
    hash = Math.imul(hash ^ (hash >>> 15), 0x85eb_ca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2_ae35);
    hash ^= hash >>> 16;
    return ((hash >>> 0) / 0xffff_ffff) * 2 - 1;
};

/**
 * One-dimensional Perlin (gradient) noise, bounded by [-1, 1] and smooth across every lattice
 * point. Not a uniform random per frame and not a sine: the source is specific that the shake
 * should be sampled from smoothed fractal noise, because that is what makes it look like a camera
 * rather than like a sequence of jumps, and what makes it resamplable at any time rather than only
 * at the time it was first drawn. Doubled because the construction's own range is half a unit.
 */
export const traumaNoise = (x: number): number => {
    const cell = Math.floor(x);
    const t = x - cell;
    const low = gradientAt(cell) * t;
    const high = gradientAt(cell + 1) * (t - 1);
    const blend = fade(t);
    return 2 * (low + blend * (high - low));
};

/** The applied shake: trauma cubed, so a small trauma is nearly nothing. */
export const traumaShakeAmount = (trauma: number): number => clamp01(trauma) ** TRAUMA_EXPONENT;

/** An event's trauma, added and clamped. Two events in a turn stack, which is the point of the scalar. */
export const addTrauma = (trauma: number, amount: number): number => clamp01(trauma + Math.max(0, amount));

/** Linear decay, per the source. Never below zero, never a negative delta pushing it back up. */
export const decayTrauma = (trauma: number, deltaSeconds: number): number =>
    Math.max(0, clamp01(trauma) - Math.max(0, deltaSeconds) * TRAUMA_DECAY_PER_SECOND);

export interface BoardShakeSample {
    angleZ: number;
    offsetX: number;
    offsetY: number;
}

export const BOARD_SHAKE_AT_REST: BoardShakeSample = { angleZ: 0, offsetX: 0, offsetY: 0 };

/**
 * The shake at a moment. A pure function of (trauma, seconds): hand it a slowed or held clock and
 * the shake slows or holds with it, hand it the same run's clock twice and it draws the same thing
 * twice.
 */
export const sampleTraumaShake = ({
    maxima = BOARD_SHAKE_MAXIMA,
    seconds,
    trauma
}: {
    maxima?: TraumaShakeMaxima;
    seconds: number;
    trauma: number;
}): BoardShakeSample => {
    const amount = traumaShakeAmount(trauma);
    if (amount <= 0) {
        return BOARD_SHAKE_AT_REST;
    }
    const phase = seconds * BOARD_SHAKE_FREQUENCY_HZ;
    return {
        angleZ: amount * maxima.angle * traumaNoise(phase + BOARD_SHAKE_CHANNEL_OFFSETS.angleZ),
        offsetX: amount * maxima.offsetX * traumaNoise(phase + BOARD_SHAKE_CHANNEL_OFFSETS.offsetX),
        offsetY: amount * maxima.offsetY * traumaNoise(phase + BOARD_SHAKE_CHANNEL_OFFSETS.offsetY)
    };
};

/**
 * What the board is doing that deserves trauma, read off the board alone - the same way the match
 * wave key is read (`getResolvingMatchWaveKey`), so no event has to be threaded from the store
 * through six components to reach the scene.
 *
 * Two readings, because two things shake the board:
 *
 * - **A break**, when the count of removed tiles goes UP. Not "there are removed tiles": a break's
 *   casualties sit in the array while their shatter wave plays, so presence is a state and only the
 *   increase is an event. The tier is the strongest `brokenAtTier` among them, which is the tier
 *   the break pulse and the rumble already use.
 * - **A miss**, when a new pair of flipped tiles is resolving as a mismatch. Keyed by the pair, so
 *   two misses in a row are two events and one miss held on screen is one.
 */
export interface BoardTraumaReading {
    mismatchKey: string | null;
    removedCount: number;
    tier: ChainTier;
}

export interface BoardTraumaMemory {
    mismatchKey: string | null;
    removedCount: number;
}

export const BOARD_TRAUMA_AT_START: BoardTraumaMemory = { mismatchKey: null, removedCount: 0 };

/**
 * One frame of the model: decay what is there, then add what just happened. Decay first, so an
 * event landing on this frame is not shortened by the same frame's decay.
 */
export const advanceBoardTrauma = ({
    delta,
    previous,
    reading,
    reduceMotion,
    trauma
}: {
    delta: number;
    previous: BoardTraumaMemory;
    reading: BoardTraumaReading;
    reduceMotion: boolean;
    trauma: number;
}): { previous: BoardTraumaMemory; trauma: number } => {
    const nextPrevious: BoardTraumaMemory = {
        mismatchKey: reading.mismatchKey,
        removedCount: reading.removedCount
    };
    if (reduceMotion) {
        return { previous: nextPrevious, trauma: 0 };
    }
    let next = decayTrauma(trauma, delta);
    if (reading.removedCount > previous.removedCount) {
        next = addTrauma(next, TRAUMA_BY_SOURCE[reading.tier]);
    }
    if (reading.mismatchKey !== null && reading.mismatchKey !== previous.mismatchKey) {
        next = addTrauma(next, TRAUMA_BY_SOURCE.mismatch);
    }
    return { previous: nextPrevious, trauma: next };
};

const TIER_ORDER: readonly ChainTier[] = ['none', 'clean', 'sharp', 'fever'];

/** The board's trauma reading for this frame. Pure, so the scene's frame can stay a step. */
export const readBoardTrauma = (board: BoardState, runStatus: RunStatus): BoardTraumaReading => {
    let removedCount = 0;
    let tier: ChainTier = 'none';
    for (const tile of board.tiles) {
        if (tile.state !== 'removed') {
            continue;
        }
        removedCount += 1;
        const broken = tile.brokenAtTier ?? 'none';
        if (TIER_ORDER.indexOf(broken) > TIER_ORDER.indexOf(tier)) {
            tier = broken;
        }
    }
    const flipped = board.flippedTileIds;
    const mismatchKey =
        flipped.length === 2 &&
        flipped.every((id) => getResolvingSelectionState(board, runStatus, id) === 'mismatch')
            ? [...flipped].sort().join(':')
            : null;
    return { mismatchKey, removedCount, tier };
};
