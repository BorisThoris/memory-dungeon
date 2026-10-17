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
