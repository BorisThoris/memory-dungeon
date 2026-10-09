import { useEffect, useRef } from 'react';
import { comboHeatLevels } from '../../shared/combo-heat-rules';
import { getRunMusicElement } from './gameplayMusic';
import { getSharedAudioContext } from './webAudioContext';

/**
 * The music climbs with the combo (2026-10-09). The run music was one 24-second loop with no idea
 * of the combo: a cold board and a Legendary chain sounded the same. Now four layers come in over
 * it as the combo heats - a pad from Warm, a pulse from Hot, a bass from Blazing, a lead from
 * Inferno - and go out again when it breaks, so the music thickens without ever restarting.
 *
 * Vertical layering per the research: every layer on its own gain, entries on an equal-power
 * curve, and every note scheduled on the AudioContext clock by a lookahead scheduler ("A Tale of
 * Two Clocks"), never by a timer firing the sound itself. The clock is anchored to the run loop's
 * own playback position, so the layers sit on its beat: the loop was measured (librosa-style
 * onset autocorrelation over the whole file) at **75 BPM, 30 beats in 24 s, beats 0.47 s in**,
 * and its notes are the frame `musicalScale.ts` measured - A, B, D, E - so nothing here commits
 * to the third the loop leaves open.
 *
 * **Voices.** Synthesised for now. The slot for real stems is `assets/audio/music/stems/run-<layer>.ogg`
 * (ACE-Step renders on the owner's PC, cut to the loop's 24 s): a file there replaces that layer's
 * synth, is preloaded with the music (`preloadComboStems`), and is started at the loop's position
 * and re-aligned if it drifts.
 */
export type ComboMusicLayer = 'pad' | 'pulse' | 'bass' | 'lead';
export const COMBO_MUSIC_LAYERS: readonly ComboMusicLayer[] = ['pad', 'pulse', 'bass', 'lead'];

/** The heat stage each layer enters at (`comboHeatLevels(...).stageIndex`): warm, hot, blazing, inferno. */
export const COMBO_LAYER_ENTRY_STAGE: Readonly<Record<ComboMusicLayer, number>> = { pad: 1, pulse: 2, bass: 3, lead: 4 };
/** Every layer's level against the loop: under it, never over it. */
export const COMBO_LAYERS_MIX = 0.42;

export const RUN_LOOP_SECONDS = 24;
export const RUN_LOOP_BEAT_SECONDS = 0.8;
export const RUN_LOOP_BEAT_PHASE_SECONDS = 0.47;
const STEP_SECONDS = RUN_LOOP_BEAT_SECONDS / 4;
const STEPS_PER_LOOP = Math.round(RUN_LOOP_SECONDS / STEP_SECONDS);

/**
 * Each layer's gain at a combo. A layer fades in over the heat it takes to cross its stage, on the
 * equal-power (sine) curve, so two layers crossing never dip in loudness; the surge past Legendary
 * lifts the lead a little more, softly capped.
 */
export const comboLayerGains = (combo: number): Record<ComboMusicLayer, number> => {
    const { stageIndex, heat, surge } = comboHeatLevels(combo);
    const gains = {} as Record<ComboMusicLayer, number>;
    for (const layer of COMBO_MUSIC_LAYERS) {
        const entry = COMBO_LAYER_ENTRY_STAGE[layer];
        if (stageIndex < entry) {
            gains[layer] = 0;
            continue;
        }
        // Into the stage: 0.6 at the rung, full by the next.
        const into = Math.min(1, 0.6 + (stageIndex - entry) * 0.4 + heat * 0.1);
        gains[layer] = Math.sin((into * Math.PI) / 2);
    }
    gains.lead = Math.min(1, gains.lead * (1 + 0.15 * (1 - Math.exp(-surge))));
    return gains;
};

const A1 = 55;
const semis = (base: number, n: number): number => base * Math.pow(2, n / 12);
/** The frame: A, B, D, E as semitones above A. */
const FRAME = [0, 2, 5, 7] as const;
/** Bass root per beat of the six-beat phrase: A A D D E A. */
const BASS_PHRASE = [0, 0, 5, 5, 7, 0] as const;
/** The lead's arpeggio, frame indices an octave over A4. */
const LEAD_FIGURE = [0, 1, 2, 3, 2, 1, 3, 2] as const;

/** What a layer plays on a sixteenth step of the loop: frequencies (Hz), or a drum. Pure, for the tests. */
export const comboLayerNotes = (layer: ComboMusicLayer, step: number, combo: number): { hz: number[]; drum?: 'kick' | 'hat' | 'rim'; seconds: number } | null => {
    const k = ((step % STEPS_PER_LOOP) + STEPS_PER_LOOP) % STEPS_PER_LOOP;
    const beat = Math.floor(k / 4);
    const sub = k % 4;
    const inPhrase = beat % 6;
    switch (layer) {
        case 'pad':
            if (sub !== 0 || inPhrase !== 0) return null;
            // A and E under either a D or a B, phrase by phrase: no third.
            return { hz: [semis(A1 * 4, 0), semis(A1 * 4, 7), semis(A1 * 4, Math.floor(beat / 6) % 2 === 0 ? 5 : 2)], seconds: RUN_LOOP_BEAT_SECONDS * 6 };
        case 'pulse':
            if (sub === 0 && beat % 2 === 0) return { hz: [], drum: 'kick', seconds: 0.3 };
            if (sub === 0) return { hz: [], drum: 'rim', seconds: 0.08 };
            if (sub === 2) return { hz: [], drum: 'hat', seconds: 0.05 };
            return null;
        case 'bass':
            if (sub !== 0 && sub !== 2) return null;
            return { hz: [semis(A1, BASS_PHRASE[inPhrase]!)], seconds: STEP_SECONDS * 1.7 };
        case 'lead': {
            // Eighths from Inferno, every sixteenth once the chain is Legendary.
            const dense = comboHeatLevels(combo).stageIndex >= 5;
            if (!dense && sub % 2 === 1) return null;
            const note = LEAD_FIGURE[(dense ? k : k / 2) % LEAD_FIGURE.length]!;
            return { hz: [semis(A1 * 8, FRAME[note]!)], seconds: STEP_SECONDS * 0.9 };
        }
    }
};

const stemUrls = import.meta.glob<string>('../assets/audio/music/stems/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });
const stemBuffers = new Map<ComboMusicLayer, AudioBuffer>();
let stemPreload: Promise<void> | null = null;

/** Fetch and decode any stem files with the music, so a layer never streams in mid-run. */
export const preloadComboStems = (): Promise<void> => {
    if (stemPreload) return stemPreload;
    const ctx = getSharedAudioContext();
    if (!ctx || typeof fetch === 'undefined') return Promise.resolve();
    stemPreload = Promise.all(
        COMBO_MUSIC_LAYERS.map(async (layer) => {
            const url = Object.entries(stemUrls).find(([path]) => /run-(\w+)\.(ogg|mp3)$/.exec(path)?.[1] === layer)?.[1];
            if (!url) return;
            try {
                const response = await fetch(url);
                if (response.ok) stemBuffers.set(layer, await ctx.decodeAudioData(await response.arrayBuffer()));
            } catch {
                // That layer keeps its synth voice.
            }
        })
    ).then(() => undefined);
    return stemPreload;
};

/**
 * How far ahead notes are put on the clock, and how often the scheduler looks. Wider than the
 * article's 100 ms: the board's frames share this thread, and a tick that lands late must still
 * find the next notes ahead of it rather than behind.
 */
const LOOKAHEAD_SECONDS = 0.3;
const TICK_MS = 40;

const createEngine = (ctx: AudioContext) => {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(ctx.destination);
    const stems = Object.fromEntries(COMBO_MUSIC_LAYERS.map((layer) => {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(bus);
        return [layer, gain];
    })) as Record<ComboMusicLayer, GainNode>;
    const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const tone = (layer: ComboMusicLayer, hz: number, when: number, seconds: number): void => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = layer === 'pad' ? 'sawtooth' : layer === 'bass' ? 'triangle' : 'square';
        osc.frequency.value = hz;
        if (layer === 'pad') osc.detune.value = (Math.random() - 0.5) * 12;
        filter.type = 'lowpass';
        filter.frequency.value = layer === 'pad' ? 900 : layer === 'bass' ? 420 : 2400;
        const peak = layer === 'pad' ? 0.06 : layer === 'bass' ? 0.32 : 0.07;
        const attack = layer === 'pad' ? seconds * 0.3 : 0.008;
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(peak, when + attack);
        env.gain.setTargetAtTime(0, when + (layer === 'pad' ? seconds * 0.65 : attack), layer === 'pad' ? seconds * 0.15 : seconds * 0.3);
        osc.connect(filter).connect(env).connect(stems[layer]);
        osc.start(when);
        osc.stop(when + seconds + 0.5);
        osc.onended = () => env.disconnect();
    };
    const drum = (kind: 'kick' | 'hat' | 'rim', when: number): void => {
        const env = ctx.createGain();
        if (kind === 'kick') {
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(110, when);
            osc.frequency.exponentialRampToValueAtTime(38, when + 0.18);
            env.gain.setValueAtTime(0.5, when);
            env.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
            osc.connect(env).connect(stems.pulse);
            osc.start(when);
            osc.stop(when + 0.32);
            osc.onended = () => env.disconnect();
            return;
        }
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
        filter.frequency.value = kind === 'hat' ? 7000 : 1800;
        env.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.18, when);
        env.gain.exponentialRampToValueAtTime(0.001, when + (kind === 'hat' ? 0.05 : 0.08));
        source.connect(filter).connect(env).connect(stems.pulse);
        source.start(when);
        source.stop(when + 0.1);
        source.onended = () => env.disconnect();
    };

    // File stems: started at the loop's position, re-aligned if they drift from it.
    const playing = new Map<ComboMusicLayer, { source: AudioBufferSourceNode; startedAt: number; offset: number }>();
    const alignStem = (layer: ComboMusicLayer, position: number): void => {
        const buffer = stemBuffers.get(layer);
        if (!buffer) return;
        const current = playing.get(layer);
        if (current) {
            const expected = (ctx.currentTime - current.startedAt + current.offset) % buffer.duration;
            const drift = Math.abs(expected - (position % buffer.duration));
            if (Math.min(drift, buffer.duration - drift) < 0.04) return;
            current.source.stop();
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(stems[layer]);
        const offset = position % buffer.duration;
        source.start(ctx.currentTime, offset);
        playing.set(layer, { source, startedAt: ctx.currentTime, offset });
    };

    let scheduledUntil: number | null = null;
    let lastPosition = 0;
    let loops = 0;
    let combo = 0;
    let running = true;
    const tick = (): void => {
        const element = getRunMusicElement();
        const gains = comboLayerGains(combo);
        if (!running || !element || element.paused) {
            bus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
            scheduledUntil = null;
            return;
        }
        bus.gain.setTargetAtTime(element.volume * COMBO_LAYERS_MIX, ctx.currentTime, 0.2);
        for (const layer of COMBO_MUSIC_LAYERS) stems[layer].gain.setTargetAtTime(gains[layer], ctx.currentTime, 0.6);
        const position = element.currentTime;
        if (position < lastPosition - RUN_LOOP_SECONDS / 2) loops += 1;
        lastPosition = position;
        const now = loops * RUN_LOOP_SECONDS + position;
        if (scheduledUntil === null || scheduledUntil < now - 0.5 || scheduledUntil > now + 1) scheduledUntil = now;
        for (const layer of COMBO_MUSIC_LAYERS) if (gains[layer] > 0.01 && stemBuffers.has(layer)) alignStem(layer, position);
        // Every sixteenth whose time falls inside the lookahead window, on the context clock.
        const first = Math.ceil((scheduledUntil - RUN_LOOP_BEAT_PHASE_SECONDS) / STEP_SECONDS - 1e-6);
        for (let step = first; RUN_LOOP_BEAT_PHASE_SECONDS + step * STEP_SECONDS <= now + LOOKAHEAD_SECONDS; step += 1) {
            const at = RUN_LOOP_BEAT_PHASE_SECONDS + step * STEP_SECONDS;
            // A step already gone (a late tick) is dropped, never played late in a bunch.
            if (at <= scheduledUntil || at < now) continue;
            const when = ctx.currentTime + (at - now);
            for (const layer of COMBO_MUSIC_LAYERS) {
                if (gains[layer] <= 0.01 || stemBuffers.has(layer)) continue;
                const notes = comboLayerNotes(layer, step, combo);
                if (!notes) continue;
                if (notes.drum) drum(notes.drum, when);
                else for (const hz of notes.hz) tone(layer, hz, when, notes.seconds);
            }
        }
        scheduledUntil = now + LOOKAHEAD_SECONDS;
    };
    const timer = window.setInterval(tick, TICK_MS);
    return {
        setCombo(next: number): void {
            combo = next;
        },
        dispose(): void {
            running = false;
            window.clearInterval(timer);
            bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            for (const { source } of playing.values()) source.stop(ctx.currentTime + 0.5);
            window.setTimeout(() => bus.disconnect(), 800);
        }
    };
};

/** Run the combo's music layers over the run loop while `active`. */
export const useComboMusicLayers = ({ combo, active }: { combo: number; active: boolean }): void => {
    const engine = useRef<ReturnType<typeof createEngine> | null>(null);
    useEffect(() => {
        if (!active || typeof window === 'undefined') return undefined;
        const ctx = getSharedAudioContext();
        if (!ctx || typeof ctx.createGain !== 'function') return undefined;
        let created: ReturnType<typeof createEngine> | null = null;
        try {
            created = createEngine(ctx);
        } catch {
            return undefined;
        }
        engine.current = created;
        return () => {
            created?.dispose();
            if (engine.current === created) engine.current = null;
        };
    }, [active]);
    useEffect(() => {
        engine.current?.setCombo(combo);
    }, [combo, active]);
};
