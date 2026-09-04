import { afterEach, describe, expect, it, vi } from 'vitest';
import * as gameSfx from './gameSfx';
import * as uiSfx from './uiSfx';

/**
 * Every cue, not just the ones someone remembered to guard.
 *
 * A cue call is the first statement in almost every click handler in this game, so a cue that
 * throws takes the press with it. This walks the whole exported surface of both cue modules with
 * an AudioContext whose every factory throws, which is what a closed context behaves like.
 */

const installHostileAudioContext = (): void => {
    const explode = (): never => {
        throw new DOMException('AudioContext has been closed', 'InvalidStateError');
    };
    vi.stubGlobal(
        'AudioContext',
        class {
            currentTime = 0;
            destination = {};
            state = 'running';
            createOscillator = explode;
            createGain = explode;
            createBufferSource = explode;
            createBiquadFilter = explode;
            createStereoPanner = explode;
            createDynamicsCompressor = explode;
            decodeAudioData = explode;
            close = async (): Promise<void> => undefined;
            resume = async (): Promise<void> => undefined;
        }
    );
};

/**
 * Cues that need a shaped argument rather than a plain gain get one here. Everything else is
 * called as `(gain)`; a cue this list forgets still gets called, it just gets a bare gain.
 */
const EXTRA_ARGS: Record<string, readonly unknown[]> = {
    playChainOpportunityBeatSfx: ['surge', 3],
    playMatchSfx: [3],
    playMismatchRecoveryCrescendoSfx: ['recover', 3],
    playRelicChoiceCrescendoSfx: ['rare'],
    playShuffleSfx: [true],
    playUiCue: [{ durationSec: 0.05, frequency: 440, type: 'sine' }]
};

/**
 * Not cues: these take a run, a settings pair or nothing at all, and are covered by their own
 * tests. Named rather than counted, so a new export cannot hide inside a total.
 */
const NOT_A_CUE = new Set([
    '__resetGameSfxEngineForTests',
    '__resetUiSfxEngineForTests',
    'UI_SFX_SAMPLE_KEYS',
    'maybePreloadUiSfx',
    'playMatchPayoffSfx',
    'playResolveSfx',
    'preloadUiSfx',
    'resumeAudioContext',
    'resumeUiSfxContext',
    'sfxGainFromSettings',
    'silenceAllUiSampleVoices',
    'uiSfxGainFromSettings',
    'uiSfxSampleKeyForCue'
]);

const cueEntries = (module: Record<string, unknown>): [string, (...args: unknown[]) => unknown][] =>
    Object.entries(module).filter(
        (entry): entry is [string, (...args: unknown[]) => unknown] =>
            typeof entry[1] === 'function' && entry[0].startsWith('play') && !NOT_A_CUE.has(entry[0])
    );

describe('every audio cue survives a hostile AudioContext', () => {
    afterEach(() => {
        gameSfx.__resetGameSfxEngineForTests();
        uiSfx.__resetUiSfxEngineForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    for (const [moduleName, module] of [
        ['gameSfx', gameSfx as unknown as Record<string, unknown>],
        ['uiSfx', uiSfx as unknown as Record<string, unknown>]
    ] as const) {
        it(`${moduleName}: no cue throws at its caller`, () => {
            installHostileAudioContext();
            const cues = cueEntries(module);
            expect(cues.length, `${moduleName} exposes cues to check`).toBeGreaterThan(0);
            for (const [name, cue] of cues) {
                expect(() => cue(1, ...(EXTRA_ARGS[name] ?? [])), `${name} must not throw`).not.toThrow();
            }
        });
    }

    it('also survives the resume and preload paths a first click runs', () => {
        installHostileAudioContext();
        expect(() => gameSfx.resumeAudioContext()).not.toThrow();
        expect(() => uiSfx.resumeUiSfxContext()).not.toThrow();
    });
});
