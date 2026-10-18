import type { DailyMusicNote, DailyMusicPiece, DailyMusicTimbre, DailyMusicVoice } from '../../shared/daily-music-composer';

/**
 * The day's piece made sound (`daily-music-composer.ts` writes it). Rendered once, offline, into a
 * buffer the music element loops like any recorded track - so the crossfade, the music volume, the
 * fever duck and every silence the realm loops had carry over unchanged (`gameplayMusic.ts`).
 *
 * The instruments are built here rather than sampled: a pad of detuned saws through a soft filter,
 * plucks and marimba-like woods with fast decays, FM bells, a reed, a warm sine-and-triangle lead,
 * a sub bass and a light kit, then a room and a gentle compressor. Each realm's timbre picks the
 * lead's voice.
 *
 * **It has to be quick**, because a player's six pieces render while the game boots. The first
 * version gave every note its own filter, panner and reverb send and ran a convolution room over
 * the whole loop: 6.6 to 26 seconds a piece in a browser (2026-10-18). Now each voice owns one
 * bus - its filter, its place in the stereo field, its share of the room - and a note is only its
 * oscillators and an envelope; the room is a Schroeder reverb run over the rendered loop afterwards,
 * circularly, so it rings across the seam.
 *
 * The loop is seamless: the piece is rendered with a tail for the releases, and the tail is folded
 * back onto the head, so the end flows into the start the way the bars do.
 */

const SAMPLE_RATE = 32_000;
const TAIL_SECONDS = 2.5;
/** The level the realm loops were matched to (-19.3 LUFS, `AGENTS.md`); RMS stands in for it here. */
const TARGET_RMS_DB = -20;

const midiHz = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

type BusName = DailyMusicVoice | 'padL' | 'padR' | 'arpL' | 'arpR' | 'bellL' | 'bellR';

interface Renderer {
    ctx: OfflineAudioContext;
    buses: Map<BusName, AudioNode>;
    noise: AudioBuffer;
}

/** A bus: an optional filter, a pan, a level, into the compressor. Made once per voice. */
const makeBus = (ctx: OfflineAudioContext, into: AudioNode, pan: number, level: number, filter?: { type: BiquadFilterType; hz: number; q?: number }): AudioNode => {
    const gain = ctx.createGain();
    gain.gain.value = level;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(into);
    if (!filter) return gain;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.value = filter.hz;
    biquad.Q.value = filter.q ?? 0.7;
    biquad.connect(gain);
    return biquad;
};

const envelope = (gain: GainNode, at: number, attack: number, peak: number, hold: number, release: number): void => {
    const g = gain.gain;
    g.setValueAtTime(0.0001, at);
    g.linearRampToValueAtTime(peak, at + attack);
    g.setValueAtTime(peak, at + Math.max(attack, hold));
    g.exponentialRampToValueAtTime(0.0001, at + Math.max(attack, hold) + release);
};

const osc = (r: Renderer, type: OscillatorType, hz: number, at: number, stop: number, detuneCents = 0): OscillatorNode => {
    const o = r.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    if (detuneCents) o.detune.value = detuneCents;
    o.start(at);
    o.stop(stop);
    return o;
};

/** A note's envelope into its bus. */
const voiceGain = (r: Renderer, bus: BusName, at: number, attack: number, peak: number, hold: number, release: number): GainNode => {
    const gain = r.ctx.createGain();
    envelope(gain, at, attack, peak, hold, release);
    gain.connect(r.buses.get(bus)!);
    return gain;
};

/** An FM pair: a carrier and a modulator whose index falls away, for bells and the glass lead. */
const fm = (r: Renderer, hz: number, at: number, stop: number, ratio: number, index: number, indexDecay: number): OscillatorNode => {
    const carrier = osc(r, 'sine', hz, at, stop);
    const modulator = osc(r, 'sine', hz * ratio, at, stop);
    const depth = r.ctx.createGain();
    depth.gain.setValueAtTime(hz * index, at);
    depth.gain.exponentialRampToValueAtTime(Math.max(1, hz * index * 0.05), at + indexDecay);
    modulator.connect(depth);
    depth.connect(carrier.frequency);
    return carrier;
};

const playLead = (r: Renderer, note: DailyMusicNote, at: number, seconds: number, timbre: DailyMusicTimbre): void => {
    const hz = midiHz(note.pitch);
    const level = note.velocity;
    if (timbre === 'glass') {
        const release = Math.max(1.4, seconds * 1.5);
        fm(r, hz, at, at + release + 0.1, 3.5, 2.2, 0.6).connect(voiceGain(r, 'lead', at, 0.005, level, 0.02, release));
        return;
    }
    if (timbre === 'wood') {
        const g = voiceGain(r, 'lead', at, 0.004, level * 1.2, 0.01, 0.5 + Math.min(0.5, seconds * 0.3));
        osc(r, 'sine', hz, at, at + 1.2).connect(g);
        const partial = r.ctx.createGain();
        partial.gain.setValueAtTime(0.5, at);
        partial.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
        osc(r, 'sine', hz * 4, at, at + 0.12).connect(partial);
        partial.connect(g);
        return;
    }
    const stop = at + seconds + 0.45;
    if (timbre === 'reed') {
        osc(r, 'square', hz, at, stop).connect(voiceGain(r, 'lead', at, 0.06, level * 0.7, seconds, 0.3));
    } else if (timbre === 'electric') {
        const g = voiceGain(r, 'lead', at, 0.01, level * 0.6, seconds, 0.25);
        osc(r, 'sawtooth', hz, at, stop, -6).connect(g);
        osc(r, 'sawtooth', hz, at, stop, 6).connect(g);
    } else {
        // Warm: a triangle with a sine an octave up.
        const g = voiceGain(r, 'lead', at, 0.025, level, seconds, 0.35);
        osc(r, 'triangle', hz, at, stop).connect(g);
        const octave = r.ctx.createGain();
        octave.gain.value = 0.25;
        osc(r, 'sine', hz * 2, at, stop).connect(octave);
        octave.connect(g);
    }
};

const playNoise = (r: Renderer, bus: BusName, at: number, level: number, decay: number): void => {
    const source = r.ctx.createBufferSource();
    source.buffer = r.noise;
    source.connect(voiceGain(r, bus, at, 0.002, level, 0.004, decay));
    source.start(at, (at * 7.3) % 1.5, decay + 0.05);
};

const scheduleNote = (r: Renderer, piece: DailyMusicPiece, note: DailyMusicNote, index: number, secondsPerBeat: number): void => {
    const at = note.beat * secondsPerBeat;
    const seconds = Math.max(0.05, note.length * secondsPerBeat);
    const hz = midiHz(note.pitch);
    switch (note.voice) {
        case 'pad': {
            const stop = at + seconds + 1.5;
            osc(r, 'sawtooth', hz, at, stop, -7).connect(voiceGain(r, 'padL', at, 1.1, note.velocity, seconds, 1.3));
            osc(r, 'sawtooth', hz, at, stop, 7).connect(voiceGain(r, 'padR', at, 1.1, note.velocity, seconds, 1.3));
            return;
        }
        case 'bass': {
            const g = voiceGain(r, 'bass', at, 0.012, note.velocity, seconds * 0.85, 0.16);
            osc(r, 'sine', hz, at, at + seconds + 0.25).connect(g);
            const tri = r.ctx.createGain();
            tri.gain.value = 0.35;
            osc(r, 'triangle', hz, at, at + seconds + 0.25).connect(tri);
            tri.connect(g);
            return;
        }
        case 'lead':
            return playLead(r, note, at, seconds, piece.timbre);
        case 'arp':
            osc(r, 'triangle', hz, at, at + 0.4).connect(voiceGain(r, index % 2 === 0 ? 'arpL' : 'arpR', at, 0.003, note.velocity, 0.01, 0.3));
            return;
        case 'bell':
            fm(r, hz, at, at + 2.7, 2.0, 1.6, 1.2).connect(voiceGain(r, index % 2 === 0 ? 'bellL' : 'bellR', at, 0.004, note.velocity, 0.02, 2.5));
            return;
        case 'kick': {
            const o = osc(r, 'sine', 120, at, at + 0.32);
            o.frequency.setValueAtTime(120, at);
            o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
            o.connect(voiceGain(r, 'kick', at, 0.003, note.velocity, 0.02, 0.26));
            return;
        }
        case 'hat':
            return playNoise(r, 'hat', at, note.velocity, 0.045);
        case 'shaker':
            return playNoise(r, 'shaker', at, note.velocity, 0.07);
        case 'rim':
            return playNoise(r, 'rim', at, note.velocity, 0.05);
    }
};

const makeNoise = (ctx: BaseAudioContext): AudioBuffer => {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e37;
    for (let i = 0; i < length; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return buffer;
};

/** Seconds one loop of the piece lasts. */
export const dailyPieceSeconds = (piece: DailyMusicPiece): number => (piece.loopBeats * 60) / piece.bpm;

/** Fold the rendered tail back onto the head, so the loop's last releases ring into its first bar. */
export const foldLoop = (data: Float32Array, loopSamples: number): Float32Array => {
    const out = new Float32Array(loopSamples);
    for (let i = 0; i < data.length; i += 1) out[i % loopSamples]! += data[i]!;
    return out;
};

/**
 * A Schroeder room - four combs in parallel, two all-passes in series - run over the loop twice,
 * keeping the second pass, so the room's decay from the end of the loop is already ringing at its
 * start: the reverb is as seamless as the loop. `spread` offsets the delays for the second channel.
 */
export const loopReverb = (dry: Float32Array, sampleRate: number, wet: number, spread = 0): Float32Array => {
    const scale = sampleRate / 44_100;
    const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + spread) * scale));
    const allpasses = [225, 556].map((d) => Math.round((d + spread) * scale));
    const feedback = 0.8;
    const damp = 0.25;
    const length = dry.length;
    const combState = combs.map((d) => ({ buffer: new Float32Array(d), index: 0, low: 0 }));
    const allState = allpasses.map((d) => ({ buffer: new Float32Array(d), index: 0 }));
    const out = new Float32Array(length);
    for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < length; i += 1) {
            const input = dry[i]! * 0.015;
            let sum = 0;
            for (const comb of combState) {
                const delayed = comb.buffer[comb.index]!;
                comb.low = delayed * (1 - damp) + comb.low * damp;
                comb.buffer[comb.index] = input + comb.low * feedback;
                comb.index = (comb.index + 1) % comb.buffer.length;
                sum += delayed;
            }
            for (const ap of allState) {
                const delayed = ap.buffer[ap.index]!;
                ap.buffer[ap.index] = sum + delayed * 0.5;
                ap.index = (ap.index + 1) % ap.buffer.length;
                sum = delayed - sum * 0.5;
            }
            if (pass === 1) out[i] = dry[i]! + sum * wet;
        }
    }
    return out;
};

/** Level the loop to the realm loops' level, never past a safe peak. */
export const levelLoop = (channels: Float32Array[]): Float32Array[] => {
    let sumSquares = 0;
    let peak = 0;
    let count = 0;
    for (const data of channels) {
        for (const sample of data) {
            sumSquares += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
        }
        count += data.length;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, count));
    if (rms <= 0) return channels;
    const gain = Math.min(10 ** (TARGET_RMS_DB / 20) / rms, 0.94 / Math.max(peak, 1e-6));
    for (const data of channels) for (let i = 0; i < data.length; i += 1) data[i]! *= gain;
    return channels;
};

/** 16-bit PCM WAV, the format the music element plays everywhere. */
export const encodeWav = (channels: readonly Float32Array[], sampleRate: number): Blob => {
    const frames = channels[0]?.length ?? 0;
    const bytes = 44 + frames * channels.length * 2;
    const view = new DataView(new ArrayBuffer(bytes));
    const text = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    text(0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels.length, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels.length * 2, true);
    view.setUint16(32, channels.length * 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, frames * channels.length * 2, true);
    let offset = 44;
    for (let i = 0; i < frames; i += 1) {
        for (const data of channels) {
            const sample = Math.max(-1, Math.min(1, data[i]!));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([view.buffer], { type: 'audio/wav' });
};

/** How wet each realm's room is: the glass and the reed in a bigger hall than the kit. */
const ROOM_WET: Readonly<Record<DailyMusicTimbre, number>> = { warm: 0.28, glass: 0.42, reed: 0.34, wood: 0.26, electric: 0.22 };

/** Render the piece to a seamless, levelled loop, as a WAV blob. */
export const renderDailyPiece = async (piece: DailyMusicPiece): Promise<Blob> => {
    const loopSeconds = dailyPieceSeconds(piece);
    const ctx = new OfflineAudioContext(2, Math.ceil((loopSeconds + TAIL_SECONDS) * SAMPLE_RATE), SAMPLE_RATE);
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;
    compressor.connect(ctx.destination);
    const leadFilter = piece.timbre === 'reed' ? 1700 : piece.timbre === 'electric' ? 2200 : 3200;
    const buses = new Map<BusName, AudioNode>([
        ['padL', makeBus(ctx, compressor, -0.45, 0.03, { type: 'lowpass', hz: 1100, q: 0.6 })],
        ['padR', makeBus(ctx, compressor, 0.45, 0.03, { type: 'lowpass', hz: 1100, q: 0.6 })],
        ['bass', makeBus(ctx, compressor, 0, 0.22, { type: 'lowpass', hz: 420 })],
        ['lead', makeBus(ctx, compressor, 0, 0.11, piece.timbre === 'glass' || piece.timbre === 'wood' ? undefined : { type: 'lowpass', hz: leadFilter })],
        ['arpL', makeBus(ctx, compressor, -0.32, 0.07, { type: 'lowpass', hz: 2800 })],
        ['arpR', makeBus(ctx, compressor, 0.32, 0.07, { type: 'lowpass', hz: 2800 })],
        ['bellL', makeBus(ctx, compressor, -0.3, 0.06)],
        ['bellR', makeBus(ctx, compressor, 0.3, 0.06)],
        ['kick', makeBus(ctx, compressor, 0, 0.32)],
        ['hat', makeBus(ctx, compressor, 0.18, 0.05, { type: 'highpass', hz: 7200 })],
        ['shaker', makeBus(ctx, compressor, -0.2, 0.06, { type: 'bandpass', hz: 5200, q: 1.2 })],
        ['rim', makeBus(ctx, compressor, 0.1, 0.12, { type: 'bandpass', hz: 1900, q: 6 })]
    ]);
    const renderer: Renderer = { ctx, buses, noise: makeNoise(ctx) };
    const secondsPerBeat = 60 / piece.bpm;
    piece.notes.forEach((note, index) => scheduleNote(renderer, piece, note, index, secondsPerBeat));
    const rendered = await ctx.startRendering();
    const loopSamples = Math.round(loopSeconds * SAMPLE_RATE);
    const wet = ROOM_WET[piece.timbre];
    const channels = [0, 1].map((channel) => loopReverb(foldLoop(rendered.getChannelData(channel), loopSamples), SAMPLE_RATE, wet, channel * 23));
    return encodeWav(levelLoop(channels), SAMPLE_RATE);
};
