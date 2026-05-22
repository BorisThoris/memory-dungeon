import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetGameSfxEngineForTests,
    playCountdownPressureSfx,
    playFlipSfx,
    playGambitCommitSfx,
    playFloorClearSfx,
    playMatchSfx,
    playRelicOfferOpenSfx,
    playRelicPickSfx,
    playShuffleSfx,
    playWagerArmSfx,
    sfxGainFromSettings
} from './gameSfx';

describe('gameSfx', () => {
    const oscillators: { addEventListener: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];

    afterEach(() => {
        __resetGameSfxEngineForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        oscillators.length = 0;
    });

    it('respects mute instantly (does not schedule nodes)', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playFlipSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
        playGambitCommitSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('steals oldest match voice when polyphony is exceeded', () => {
        const stops: string[] = [];
        const createOscillator = vi.fn(() => {
            const id = `osc-${stops.length}`;
            const o = {
                id,
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(() => {
                    stops.push(id);
                }),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const g = sfxGainFromSettings(1, 1);
        for (let i = 0; i < 5; i += 1) {
            playMatchSfx(g);
        }
        expect(stops.length).toBeGreaterThanOrEqual(1);
    });

    it('playShuffleSfx respects mute', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playShuffleSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('playShuffleSfx full uses layered voices', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playShuffleSfx(sfxGainFromSettings(1, 1));
        expect(createOscillator.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('playFloorClearSfx defers oscillators to next macrotask', async () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playFloorClearSfx(sfxGainFromSettings(1, 1));
        expect(createOscillator).not.toHaveBeenCalled();

        await new Promise<void>((resolve) => {
            globalThis.setTimeout(() => {
                resolve();
            }, 0);
        });

        expect(createOscillator).toHaveBeenCalled();
    });

    it('supports dedicated relic and wager cues', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playRelicOfferOpenSfx(gain);
        playRelicPickSfx(gain);
        playWagerArmSfx(gain);

        expect(createOscillator).toHaveBeenCalledTimes(3);
    });

    it('uses one pressure voice for countdown pulses', () => {
        const stops: string[] = [];
        let index = 0;
        const createOscillator = vi.fn(() => {
            const id = `pressure-${index}`;
            index += 1;
            return {
                id,
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(() => {
                    stops.push(id);
                }),
                addEventListener: vi.fn()
            };
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playCountdownPressureSfx(gain);
        playCountdownPressureSfx(gain);

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(stops.length).toBeGreaterThanOrEqual(1);
    });
});
