import { describe, expect, it, vi } from 'vitest';
import {
    RUMBLE_BY_TIER,
    RUMBLE_FEVER_ARRIVAL,
    rumbleForBreak,
    rumbleForFeverArrival,
    rumbleGamepads
} from './gamepadRumble';

describe('controller rumble on a break', () => {
    it('scales with the tier and is nothing below Clean', () => {
        expect(RUMBLE_BY_TIER.none).toBeNull();
        expect(RUMBLE_BY_TIER.fever!.durationMs).toBeGreaterThan(RUMBLE_BY_TIER.sharp!.durationMs);
        expect(RUMBLE_BY_TIER.sharp!.durationMs).toBeGreaterThan(RUMBLE_BY_TIER.clean!.durationMs);
    });

    it('plays the effect on every pad that can, and counts them', () => {
        const playEffect = vi.fn(() => Promise.resolve('complete'));
        const rumbled = rumbleGamepads(RUMBLE_BY_TIER.fever, {
            reduceMotion: false,
            gamepads: () => [{ vibrationActuator: { playEffect } }, null, { vibrationActuator: null }, {}]
        });
        expect(rumbled).toBe(1);
        expect(playEffect).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ duration: 320, strongMagnitude: 0.9 }));
    });

    it('survives a missing API, a pad that throws, and a rejected effect', () => {
        expect(rumbleGamepads(RUMBLE_BY_TIER.sharp, { reduceMotion: false, gamepads: () => null })).toBe(0);
        expect(
            rumbleGamepads(RUMBLE_BY_TIER.sharp, {
                reduceMotion: false,
                gamepads: () => [{ vibrationActuator: { playEffect: () => { throw new Error('no'); } } }]
            })
        ).toBe(0);
        expect(
            rumbleGamepads(RUMBLE_BY_TIER.sharp, {
                reduceMotion: false,
                gamepads: () => [{ vibrationActuator: { playEffect: () => Promise.reject(new Error('busy')) } }]
            })
        ).toBe(1);
        // No navigator.getGamepads in this environment: the default source is a silent no-op.
        expect(rumbleForBreak('fever', false)).toBe(0);
    });

    it('is off under reduce motion, whatever the tier', () => {
        const playEffect = vi.fn();
        expect(rumbleGamepads(RUMBLE_BY_TIER.fever, { reduceMotion: true, gamepads: () => [{ vibrationActuator: { playEffect } }] })).toBe(0);
        expect(playEffect).not.toHaveBeenCalled();
    });
});

describe('rumbleForFeverArrival', () => {
    it('holds longer and softer than the break it lands on', () => {
        // The break at Fever is the hit; the arrival is the pad holding on to it, so it must not
        // simply be a bigger version of the same jolt.
        expect(RUMBLE_FEVER_ARRIVAL.durationMs).toBeGreaterThan(RUMBLE_BY_TIER.fever!.durationMs);
        expect(RUMBLE_FEVER_ARRIVAL.strongMagnitude).toBeLessThan(RUMBLE_BY_TIER.fever!.strongMagnitude);
        expect(RUMBLE_FEVER_ARRIVAL.weakMagnitude).toBeLessThan(RUMBLE_BY_TIER.fever!.weakMagnitude);
    });

    it('shakes a pad that can, and never one that asked not to be shaken', () => {
        const playEffect = vi.fn(() => Promise.resolve());
        const gamepads = () => [{ vibrationActuator: { playEffect } }];

        expect(rumbleGamepads(RUMBLE_FEVER_ARRIVAL, { reduceMotion: false, gamepads })).toBe(1);
        expect(playEffect).toHaveBeenCalledTimes(1);

        expect(rumbleGamepads(RUMBLE_FEVER_ARRIVAL, { reduceMotion: true, gamepads })).toBe(0);
        expect(playEffect).toHaveBeenCalledTimes(1);
    });

    it('is a silent no-op with no pad at all', () => {
        expect(rumbleForFeverArrival(false)).toBe(0);
    });
});

