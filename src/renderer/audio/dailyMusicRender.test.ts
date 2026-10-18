import { describe, expect, it } from 'vitest';
import { composeDailyPiece, dailyMusicSalt } from '../../shared/daily-music-composer';
import { dailyPieceSeconds, encodeWav, foldLoop, levelLoop, loopReverb } from './dailyMusicRender';

describe('rendering the day’s piece', () => {
    it('folds the tail onto the head, so a release past the end rings into the start', () => {
        const rendered = new Float32Array([1, 0, 0, 0, 0.5, 0.25]);
        expect([...foldLoop(rendered, 4)]).toEqual([1.5, 0.25, 0, 0]);
    });

    it('rings the room across the seam: the loop’s start already carries the end’s reverb', () => {
        const dry = new Float32Array(8000);
        dry[7990] = 1;
        const wet = loopReverb(dry, 8000, 0.5);
        const head = wet.slice(0, 2000).reduce((sum, v) => sum + Math.abs(v), 0);
        expect(head).toBeGreaterThan(0);
        expect(wet[7990]).toBeCloseTo(1, 1);
    });

    it('levels a loop to the realm loops’ level, never past a safe peak', () => {
        const loud = new Float32Array(1000).map((_, i) => Math.sin(i / 5) * 0.9);
        const [levelled] = levelLoop([loud]);
        const rms = Math.sqrt(levelled!.reduce((sum, v) => sum + v * v, 0) / levelled!.length);
        expect(20 * Math.log10(rms)).toBeCloseTo(-20, 0);
        expect(Math.max(...levelled!.map(Math.abs))).toBeLessThanOrEqual(0.94 + 1e-6);
    });

    it('writes a 16-bit stereo WAV the music element can play', async () => {
        const wav = encodeWav([new Float32Array([0, 0.5]), new Float32Array([0, -0.5])], 32_000);
        const bytes = new DataView(await wav.arrayBuffer());
        expect(wav.type).toBe('audio/wav');
        expect(bytes.byteLength).toBe(44 + 2 * 2 * 2);
        expect(String.fromCharCode(bytes.getUint8(0), bytes.getUint8(1), bytes.getUint8(2), bytes.getUint8(3))).toBe('RIFF');
        expect(bytes.getUint16(22, true)).toBe(2);
        expect(bytes.getUint32(24, true)).toBe(32_000);
        expect(bytes.getInt16(48, true)).toBe(Math.trunc(0.5 * 0x7fff));
    });

    it('lasts sixteen bars at the piece’s tempo', () => {
        const piece = composeDailyPiece(dailyMusicSalt('p', '2026-10-18'), 'tide');
        expect(dailyPieceSeconds(piece)).toBeCloseTo((64 * 60) / piece.bpm, 6);
    });
});
