import { describe, expect, it } from 'vitest';
import { CASCADE_PITCH_CLASSES } from './musicalScale';
import { COMBO_HEAT_STAGE_FROM } from '../../shared/combo-heat-rules';
import { COMBO_MUSIC_LAYERS, comboLayerGains, comboMusicDrive, comboLayerNotes, RUN_LOOP_BEAT_SECONDS, RUN_LOOP_SECONDS } from './comboMusicLayers';

const pitchClass = (hz: number): number => (((Math.round(12 * Math.log2(hz / 440)) % 12) + 12) % 12);

describe('combo music layers', () => {
    it('keeps climbing past every layer: brighter and further forward with each link, the shimmer from Inferno', () => {
        let last = comboMusicDrive(0);
        expect(last).toEqual({ brightness: 1, mix: 1, shimmer: 0 });
        expect(comboMusicDrive(COMBO_HEAT_STAGE_FROM.inferno - 1).shimmer).toBe(0);
        for (let links = 1; links <= 3000; links += 1) {
            const now = comboMusicDrive(links);
            expect(now.brightness).toBeGreaterThan(last.brightness);
            expect(now.mix).toBeGreaterThan(last.mix);
            if (links > COMBO_HEAT_STAGE_FROM.inferno) expect(now.shimmer).toBeGreaterThan(last.shimmer);
            expect(now.mix).toBeLessThan(1.6);
            expect(now.shimmer).toBeLessThan(1);
            last = now;
        }
    });

    it('brings in pad, pulse, bass and lead at warm, hot, blazing and inferno, and drops them all when the combo breaks', () => {
        expect(Object.values(comboLayerGains(0)).every((gain) => gain === 0)).toBe(true);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.warm).pad).toBeGreaterThan(0);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.warm).pulse).toBe(0);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.hot).pulse).toBeGreaterThan(0);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.blazing).bass).toBeGreaterThan(0);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.inferno).lead).toBeGreaterThan(0);
        const deep = comboLayerGains(2000);
        for (const layer of COMBO_MUSIC_LAYERS) expect(deep[layer]).toBeLessThanOrEqual(1);
        expect(deep.lead).toBeGreaterThanOrEqual(comboLayerGains(COMBO_HEAT_STAGE_FROM.legendary).lead);
    });

    it('enters each layer on the equal-power curve, so a layer joining never dips the loudness', () => {
        // At its rung a layer is 0.6 of the way in: sin(0.3 pi) on the equal-power curve, not 0.6.
        const gain = comboLayerGains(COMBO_HEAT_STAGE_FROM.warm).pad;
        expect(gain).toBeGreaterThan(Math.sin(0.6 * Math.PI / 2) - 0.001);
        expect(gain).toBeGreaterThan(0.6);
        expect(comboLayerGains(COMBO_HEAT_STAGE_FROM.hot).pad).toBeGreaterThan(gain);
    });

    it('plays only the notes the loop was measured to stand behind, on a pattern that fits the loop exactly', () => {
        expect((RUN_LOOP_SECONDS / RUN_LOOP_BEAT_SECONDS) % 6).toBe(0);
        const steps = (RUN_LOOP_SECONDS / RUN_LOOP_BEAT_SECONDS) * 4;
        for (const layer of COMBO_MUSIC_LAYERS) {
            for (let step = 0; step < steps; step += 1) {
                const notes = comboLayerNotes(layer, step, 1000);
                for (const hz of notes?.hz ?? []) expect(CASCADE_PITCH_CLASSES).toContain(pitchClass(hz));
                expect(comboLayerNotes(layer, step + steps, 1000)).toEqual(notes);
            }
        }
        expect(comboLayerNotes('pulse', 0, 10)?.drum).toBe('kick');
    });
});
