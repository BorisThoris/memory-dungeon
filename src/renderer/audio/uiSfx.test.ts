import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import uiSfxManifest from '../assets/audio/ui/manifest.json';
import {
    __resetUiSfxEngineForTests,
    maybePreloadUiSfx,
    playGameOverOpenSfx,
    playUiClickSfx,
    playUiCue,
    playUiCopySfx,
    playUiConfirmSfx,
    playPauseOpenSfx,
    playPauseResumeSfx,
    playIntroStingSfx,
    preloadUiSfx,
    resumeUiSfxContext,
    silenceAllUiSampleVoices,
    UI_SFX_SAMPLE_KEYS,
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

    it('keeps sampled UI coverage backed by runtime OGG files', () => {
        const uiAssetDir = path.resolve(process.cwd(), 'src/renderer/assets/audio/ui');

        expect(Object.keys(uiSfxManifest.entries)).toEqual([...UI_SFX_SAMPLE_KEYS]);
        for (const key of UI_SFX_SAMPLE_KEYS) {
            const entry = uiSfxManifest.entries[key];
            expect(entry.file, `manifest key ${key} should use runtime OGG`).toMatch(/\.ogg$/);
            const assetPath = path.join(uiAssetDir, entry.file);
            expect(fs.existsSync(assetPath), `manifest key ${key} points to missing file ${entry.file}`).toBe(true);
        }
    });

    it('does not throw a closed context at the click handler that asked for the cue', () => {
        /*
         * Every button in the game calls a cue before doing what it was pressed for. A closed
         * AudioContext makes createOscillator throw on every call, so before this guard a closed
         * context meant the Play button stopped opening Choose Your Path.
         */
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                state = 'running';
                createOscillator = (): never => {
                    throw new DOMException('AudioContext has been closed', 'InvalidStateError');
                };
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
                resume = (): Promise<void> => Promise.resolve();
            }
        );

        expect(() => playUiClickSfx(uiSfxGainFromSettings(1, 1))).not.toThrow();
        expect(() => resumeUiSfxContext()).not.toThrow();
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

    it('keeps UI sampled preload helpers safe in test mode', async () => {
        maybePreloadUiSfx();
        silenceAllUiSampleVoices();
        await expect(preloadUiSfx()).resolves.toBeUndefined();
    });

    it('exposes the generic UI cue primitive used by wrappers', () => {
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
        playUiCue('click', uiSfxGainFromSettings(1, 1), { frequency: 620, durationSec: 0.04, type: 'sine' });

        expect(createOscillator).toHaveBeenCalledTimes(1);
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
