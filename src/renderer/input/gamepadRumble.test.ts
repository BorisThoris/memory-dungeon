import { describe, expect, it, vi } from 'vitest';
import { RUMBLE_BY_TIER, rumbleForBreak, rumbleGamepads } from './gamepadRumble';

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
