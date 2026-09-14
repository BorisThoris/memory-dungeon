import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { __resetGameSfxEngineForTests, playFloorClearSfx, playResolveSfx } from './gameSfx';

const before = {
    stats: { matchesFound: 1, tries: 1, currentStreak: 7 },
    chunkPairsBrokenThisFloor: 0,
    board: { pairCount: 12 }
} as unknown as RunState;
const after = {
    stats: { matchesFound: 2, tries: 2, currentStreak: 8 },
    chunkPairsBrokenThisFloor: 12,
    chunkPairsThisChain: 12,
    board: { pairCount: 12 }
} as unknown as RunState;

describe('queued gameplay audio cancellation', () => {
    afterEach(() => {
        __resetGameSfxEngineForTests();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it.each(['mute', 'reset'] as const)('does not restart a cascade or floor-clear cue after %s', (action) => {
        vi.useFakeTimers();
        const createOscillator = vi.fn(() => ({
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn()
        }));
        vi.stubGlobal('AudioContext', class {
            currentTime = 0;
            destination = {};
            createOscillator = createOscillator;
            createGain = () => ({
                gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(), disconnect: vi.fn()
            });
            close = () => Promise.resolve();
        });
        playResolveSfx(before, after, 1);
        vi.advanceTimersByTime(100);
        playFloorClearSfx(1);
        expect(createOscillator).toHaveBeenCalled();
        if (action === 'mute') {
            playResolveSfx(before, after, 0);
        } else {
            __resetGameSfxEngineForTests();
        }
        const countAtCancellation = createOscillator.mock.calls.length;
        vi.advanceTimersByTime(2_000);
        expect(createOscillator).toHaveBeenCalledTimes(countAtCancellation);
        // Cancelling one phrase must not silence a later, newly requested sound.
        playFloorClearSfx(1);
        vi.advanceTimersByTime(1);
        expect(createOscillator.mock.calls.length).toBeGreaterThan(countAtCancellation);
    });
});
