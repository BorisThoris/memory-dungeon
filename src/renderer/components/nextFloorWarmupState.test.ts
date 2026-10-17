import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_WARMUP_WAIT_CAP_MS, setBoardWarmupPending, waitForBoardWarmup } from './nextFloorWarmupState';

describe('waiting on the board warm-up under the veil', () => {
    afterEach(() => {
        setBoardWarmupPending(false);
        vi.useRealTimers();
    });

    it('does not wait when nothing is pending', async () => {
        await expect(waitForBoardWarmup()).resolves.toBeUndefined();
    });

    it('lifts the veil as soon as the textures are up', async () => {
        vi.useFakeTimers();
        setBoardWarmupPending(true);
        let lifted = false;
        void waitForBoardWarmup().then(() => {
            lifted = true;
        });
        await vi.advanceTimersByTimeAsync(100);
        expect(lifted).toBe(false);
        setBoardWarmupPending(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(lifted).toBe(true);
    });

    it('never holds the veil past the cap', async () => {
        vi.useFakeTimers();
        setBoardWarmupPending(true);
        let lifted = false;
        void waitForBoardWarmup().then(() => {
            lifted = true;
        });
        await vi.advanceTimersByTimeAsync(BOARD_WARMUP_WAIT_CAP_MS + 1);
        expect(lifted).toBe(true);
    });
});
