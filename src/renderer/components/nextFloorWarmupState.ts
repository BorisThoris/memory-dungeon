/**
 * Whether the next floor's textures are still being prepared during the clear, shared by the board
 * scene that prepares them (`TileBoardScene`) and the floor-clear beat that ends the clear
 * (`GameScreen`).
 *
 * The scene uploads the next floor's faces a few milliseconds a frame while the beat plays. On a
 * slow or busy machine the beat ran out first, and the new floor's mount uploaded the rest in one
 * frame: 1.1 to 1.8 seconds frozen under the veil (production build, measured 2026-10-17). A loading
 * screen that waits on its assets is the fix games use: the beat holds the floor change until the
 * warm-up is done, never longer than `NEXT_FLOOR_WARMUP_HOLD_CAP_MS` past its own time, and while it
 * holds - its own motion already played - the warm-up may take a larger share of each frame.
 */
let pending = false;
let hurried = false;

/** The longest the beat waits on the warm-up beyond its own time. */
export const NEXT_FLOOR_WARMUP_HOLD_CAP_MS = 2000;

export const setNextFloorWarmupPending = (value: boolean): void => {
    pending = value;
    if (!value) hurried = false;
};

export const isNextFloorWarmupPending = (): boolean => pending;

/** The beat has had its time and waits only on the warm-up. */
export const setNextFloorWarmupHurried = (value: boolean): void => {
    hurried = value;
};

export const isNextFloorWarmupHurried = (): boolean => hurried;

/*
 * The board's own floor, from its mount: whatever the clear's warm-up left undone is uploaded under
 * the veil a slice a frame, and the veil stays up until it is done (`TileBoard`'s entrance waits on
 * `waitForBoardWarmup`). The mount used to upload all of it in its first frame - after a held beat
 * that ran out on a saturated machine, still 600-700ms frozen.
 */
let boardPending = false;
const boardListeners = new Set<() => void>();

/** The longest the veil waits on the board's warm-up. */
export const BOARD_WARMUP_WAIT_CAP_MS = 1500;

export const setBoardWarmupPending = (value: boolean): void => {
    boardPending = value;
    if (value) return;
    for (const listener of [...boardListeners]) listener();
    boardListeners.clear();
};

export const isBoardWarmupPending = (): boolean => boardPending;

/** Resolves once the board's textures are up, or after `capMs`, whichever is first. */
export const waitForBoardWarmup = (capMs: number = BOARD_WARMUP_WAIT_CAP_MS): Promise<void> =>
    boardPending
        ? new Promise<void>((resolve) => {
              const done = (): void => {
                  window.clearTimeout(timer);
                  boardListeners.delete(done);
                  resolve();
              };
              const timer = window.setTimeout(done, capMs);
              boardListeners.add(done);
          })
        : Promise.resolve();
