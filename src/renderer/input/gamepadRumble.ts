import type { ChainTier } from '../../shared/chain-tier-rules';

/**
 * Controller rumble for the break, through the Gamepad vibration actuator.
 *
 * Feel is the last channel the cascade had not touched. The pattern scales with the tier; a
 * missing actuator, a browser without the API, or a pad that refuses the effect is a silent no-op
 * (the `audioSafety` rule: a cue that cannot fire must never take the press with it). Reduce
 * motion turns it off — it is the one accessibility switch this game has for "less shaking", and
 * a rumble is shaking.
 */
export interface RumblePattern {
    durationMs: number;
    strongMagnitude: number;
    weakMagnitude: number;
}

export const RUMBLE_BY_TIER: Readonly<Record<ChainTier, RumblePattern | null>> = {
    none: null,
    clean: { durationMs: 90, strongMagnitude: 0.25, weakMagnitude: 0.45 },
    sharp: { durationMs: 160, strongMagnitude: 0.55, weakMagnitude: 0.7 },
    fever: { durationMs: 320, strongMagnitude: 0.9, weakMagnitude: 1 }
};

interface VibrationActuatorLike {
    playEffect?: (type: string, params: Record<string, number>) => unknown;
}

interface GamepadLike {
    vibrationActuator?: VibrationActuatorLike | null;
}

type GamepadSource = () => ReadonlyArray<GamepadLike | null> | null | undefined;

const defaultGamepads: GamepadSource = () => {
    try {
        return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
            ? (navigator.getGamepads() as ReadonlyArray<GamepadLike | null>)
            : null;
    } catch {
        return null;
    }
};

/** Rumbles every connected pad that can; returns how many did. Never throws. */
export const rumbleGamepads = (
    pattern: RumblePattern | null,
    { reduceMotion, gamepads = defaultGamepads }: { reduceMotion: boolean; gamepads?: GamepadSource }
): number => {
    if (!pattern || reduceMotion) {
        return 0;
    }
    let rumbled = 0;
    for (const pad of gamepads() ?? []) {
        const actuator = pad?.vibrationActuator;
        if (!actuator || typeof actuator.playEffect !== 'function') continue;
        try {
            const result = actuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: pattern.durationMs,
                strongMagnitude: pattern.strongMagnitude,
                weakMagnitude: pattern.weakMagnitude
            });
            if (result && typeof (result as Promise<unknown>).catch === 'function') {
                (result as Promise<unknown>).catch(() => undefined);
            }
            rumbled += 1;
        } catch {
            // A pad that refuses the effect is a pad without rumble; the break still happened.
        }
    }
    return rumbled;
};

export const rumbleForBreak = (tier: ChainTier, reduceMotion: boolean): number =>
    rumbleGamepads(RUMBLE_BY_TIER[tier], { reduceMotion });
