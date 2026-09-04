import { describe, expect, it, vi } from 'vitest';
import { audioNeverThrows, audioNeverThrowsBoolean } from './audioSafety';

describe('audioNeverThrows', () => {
    it('runs the cue', () => {
        const played = vi.fn();
        audioNeverThrows(played);
        expect(played).toHaveBeenCalledTimes(1);
    });

    it('swallows the InvalidStateError a closed AudioContext raises', () => {
        expect(() =>
            audioNeverThrows(() => {
                throw new DOMException('AudioContext has been closed', 'InvalidStateError');
            })
        ).not.toThrow();
    });

    it('swallows a non-Error throw too, which audio hosts do', () => {
        expect(() =>
            audioNeverThrows(() => {
                throw 'audio device disappeared';
            })
        ).not.toThrow();
    });
});

describe('audioNeverThrowsBoolean', () => {
    it('passes the cue result through', () => {
        expect(audioNeverThrowsBoolean(() => true)).toBe(true);
        expect(audioNeverThrowsBoolean(() => false)).toBe(false);
    });

    it('reads a throw as "did not play", so the caller falls back to its tone', () => {
        expect(
            audioNeverThrowsBoolean(() => {
                throw new Error('decode failed');
            })
        ).toBe(false);
    });
});
