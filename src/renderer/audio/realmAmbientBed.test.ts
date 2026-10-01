import { afterEach, describe, expect, it, vi } from 'vitest';
import { REALM_IDS } from '../../shared/contracts';
import { REALM_BED_LAYERS, setRealmAmbientBed } from './realmAmbientBed';
import { resetSharedAudioContextForTests } from './webAudioContext';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });

const stubContext = () => {
    const made = { sources: 0, stops: 0, masters: [] as { ramps: ReturnType<typeof vi.fn> }[] };
    vi.stubGlobal(
        'AudioContext',
        class {
            currentTime = 0;
            sampleRate = 8000;
            destination = {};
            state = 'running';
            createGain = () => {
                const gain = param();
                made.masters.push({ ramps: gain.exponentialRampToValueAtTime });
                return { gain, connect: vi.fn(), disconnect: vi.fn() };
            };
            createBuffer = (_c: number, length: number) => {
                const data = new Float32Array(length);
                return { sampleRate: 8000, getChannelData: () => data };
            };
            createBufferSource = () => {
                made.sources += 1;
                return { buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn(() => (made.stops += 1)) };
            };
            createOscillator = () => ({ frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
            createBiquadFilter = () => ({ type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn() });
            close = (): Promise<void> => Promise.resolve();
            resume = (): Promise<void> => Promise.resolve();
        }
    );
    return made;
};

describe('the realm bed', () => {
    afterEach(() => {
        setRealmAmbientBed(null, 0, 0);
        resetSharedAudioContextForTests();
        vi.unstubAllGlobals();
    });

    it('has a bed for every realm', () => {
        for (const realm of REALM_IDS) expect(REALM_BED_LAYERS[realm].length, realm).toBeGreaterThan(0);
    });

    it('starts on a realm, holds it, crossfades to the next and stops on none', () => {
        const made = stubContext();
        setRealmAmbientBed('tide', 1, 0.8, true);
        const after = made.sources;
        expect(after).toBe(REALM_BED_LAYERS.tide.length);
        // The same realm again only re-levels: no new sources.
        setRealmAmbientBed('tide', 0.6, 0.8, true);
        expect(made.sources).toBe(after);
        setRealmAmbientBed('storm', 1, 0.8, true);
        // The tide fades out and the storm comes in.
        expect(made.stops).toBe(REALM_BED_LAYERS.tide.length);
        expect(made.sources).toBe(after + REALM_BED_LAYERS.storm.length);
        setRealmAmbientBed(null, 0, 0.8, true);
        expect(made.stops).toBe(REALM_BED_LAYERS.tide.length + REALM_BED_LAYERS.storm.length);
    });

    it('stays off until it is switched on', () => {
        const made = stubContext();
        setRealmAmbientBed('tide', 1, 0.8);
        expect(made.sources).toBe(0);
    });

    it('is silent when the sound is muted', () => {
        const made = stubContext();
        setRealmAmbientBed('ember', 1, 0, true);
        expect(made.sources).toBe(0);
    });
});
