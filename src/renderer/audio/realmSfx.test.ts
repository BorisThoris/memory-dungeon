import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RealmEvent, RunState } from '../../shared/contracts';
import { REALM_EVENT_SOUND, __resetGameSfxEngineForTests, playRealmEventSfx, playResolveSfx, playVoidSpewSfx, sfxGainFromSettings } from './gameSfx';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });

/** A fake context that counts the tones and the noise bursts the realm cues schedule. */
const stubContext = () => {
    const made = { tones: 0, noises: 0, filters: [] as string[] };
    vi.stubGlobal(
        'AudioContext',
        class {
            currentTime = 0;
            sampleRate = 8000;
            destination = {};
            state = 'running';
            createOscillator = () => {
                made.tones += 1;
                return { type: 'sine', frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn() };
            };
            createGain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() });
            createBuffer = (_channels: number, length: number) => {
                const data = new Float32Array(length);
                return { sampleRate: 8000, getChannelData: () => data };
            };
            createBufferSource = () => {
                made.noises += 1;
                return { buffer: null, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn() };
            };
            createBiquadFilter = () => {
                const filter = { type: 'lowpass', Q: { value: 0 }, frequency: param(), connect: vi.fn(), disconnect: vi.fn() };
                made.filters.push('made');
                return filter;
            };
            close = (): Promise<void> => Promise.resolve();
            resume = (): Promise<void> => Promise.resolve();
        }
    );
    return made;
};

const KINDS = Object.keys(REALM_EVENT_SOUND) as RealmEvent['kind'][];

describe('the realm, heard', () => {
    afterEach(() => {
        __resetGameSfxEngineForTests();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('gives every realm event a sound', () => {
        for (const kind of KINDS) {
            __resetGameSfxEngineForTests();
            const made = stubContext();
            playRealmEventSfx(sfxGainFromSettings(1, 1), kind);
            expect(made.tones + made.noises, kind).toBeGreaterThan(0);
            vi.unstubAllGlobals();
        }
    });

    it('is silent when muted', () => {
        const made = stubContext();
        playRealmEventSfx(sfxGainFromSettings(1, 0), 'lightning');
        playVoidSpewSfx(sfxGainFromSettings(1, 0));
        expect(made.tones + made.noises).toBe(0);
    });

    it('sounds a new realm event on a resolved turn, once, and the void when it spits', () => {
        vi.useFakeTimers();
        const made = stubContext();
        const event: RealmEvent = { key: 'k1', kind: 'wildfire', tileIds: ['a'] };
        const before = { stats: { matchesFound: 0, tries: 0, currentStreak: 0 }, board: { level: 3 }, lastRealmEvent: null, voidSpewsThisFloor: 0 } as unknown as RunState;
        const after = { ...before, lastRealmEvent: event } as RunState;
        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        const firstNoises = made.noises;
        expect(firstNoises).toBeGreaterThan(0);
        // The same event again (a resolve that did not change it) is not heard twice.
        playResolveSfx(after, after, sfxGainFromSettings(1, 1));
        expect(made.noises).toBe(firstNoises);
        playResolveSfx(after, { ...after, voidSpewsThisFloor: 1 } as RunState, sfxGainFromSettings(1, 1));
        expect(made.noises).toBeGreaterThan(firstNoises);
    });
});
