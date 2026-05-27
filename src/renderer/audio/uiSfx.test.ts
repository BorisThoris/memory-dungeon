import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetUiSfxEngineForTests,
    playGameOverOpenSfx,
    playUiClickSfx,
    playUiCopySfx,
    playUiConfirmSfx,
    playPauseOpenSfx,
    playPauseResumeSfx,
    playIntroStingSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings,
    uiSfxSampleKeyForCue
} from './uiSfx';

describe('uiSfx', () => {
    afterEach(() => {
        __resetUiSfxEngineForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('multiplies clamped master and sfx volumes', () => {
        expect(uiSfxGainFromSettings(0.5, 0.25)).toBe(0.125);
        expect(uiSfxGainFromSettings(2, 0.5)).toBe(0.5);
        expect(uiSfxGainFromSettings(-1, 0.5)).toBe(0);
    });

    it('routes cue names to sample keys', () => {
        expect(uiSfxSampleKeyForCue('click')).toBe('ui-click');
        expect(uiSfxSampleKeyForCue('confirm')).toBe('ui-confirm');
        expect(uiSfxSampleKeyForCue('back')).toBe('ui-back');
        expect(uiSfxSampleKeyForCue('counter')).toBe('ui-counter');
        expect(uiSfxSampleKeyForCue('menuOpen')).toBe('menu-open');
        expect(uiSfxSampleKeyForCue('runStart')).toBe('run-start');
        expect(uiSfxSampleKeyForCue('introSting')).toBe('intro-sting');
        expect(uiSfxSampleKeyForCue('pauseOpen')).toBe('pause-open');
        expect(uiSfxSampleKeyForCue('pauseResume')).toBe('pause-resume');
        expect(uiSfxSampleKeyForCue('gameOverOpen')).toBe('game-over-open');
        expect(uiSfxSampleKeyForCue('copy')).toBe('ui-copy');
    });

    it('respects mute without scheduling nodes', () => {
        const createOscillator = vi.fn();
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playUiClickSfx(uiSfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('schedules procedural fallback tones in test mode', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn()
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

        resumeUiSfxContext();
        playUiConfirmSfx(uiSfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(1);
        expect(createGain).toHaveBeenCalledTimes(1);
    });

    it('supports the expanded cue wrappers', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn()
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

        resumeUiSfxContext();
        const gain = uiSfxGainFromSettings(1, 1);
        playIntroStingSfx(gain);
        playPauseOpenSfx(gain);
        playPauseResumeSfx(gain);
        playGameOverOpenSfx(gain);
        playUiCopySfx(gain);

        expect(createOscillator).toHaveBeenCalledTimes(5);
    });

    it('steals oldest procedural UI fallback voices by category', () => {
        const stops: Array<ReturnType<typeof vi.fn>> = [];
        const createOscillator = vi.fn(() => {
            const stop = vi.fn();
            stops.push(stop);
            return {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                disconnect: vi.fn(),
                start: vi.fn(),
                stop
            };
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn()
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

        resumeUiSfxContext();
        const gain = uiSfxGainFromSettings(1, 1);
        for (let i = 0; i < 6; i += 1) {
            playUiClickSfx(gain);
        }

        expect(createOscillator).toHaveBeenCalledTimes(6);
        expect(stops[0]).toHaveBeenCalledTimes(2);
    });
});
