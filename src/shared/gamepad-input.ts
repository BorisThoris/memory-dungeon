/**
 * Controller input, as pure data.
 *
 * REG-029 listed the gamepad path as deferred while keyboard and pointer shipped. This module is
 * the half of it that has no browser in it: a `Gamepad`-shaped snapshot goes in, a list of discrete
 * actions comes out. Everything stateful about a held stick — the wait before a direction starts
 * repeating, and the cadence once it does — lives in a plain value the caller threads through, so
 * the whole feel of the pad is testable without a pad.
 */

export type GamepadActionId =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'confirm'
    | 'back'
    | 'pause'
    | 'help'
    | 'tabPrev'
    | 'tabNext';

/** The subset of the `Gamepad` interface this reader touches. */
export interface GamepadSnapshot {
    readonly axes: readonly number[];
    readonly buttons: readonly { readonly pressed: boolean }[];
}

/**
 * Standard-mapping button indices (W3C Gamepad "standard" layout), named for the Xbox face since
 * that is the layout Steam presents to a game by default.
 */
export const STANDARD_GAMEPAD_BUTTONS = {
    a: 0,
    b: 1,
    x: 2,
    y: 3,
    leftBumper: 4,
    rightBumper: 5,
    select: 8,
    start: 9,
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15
} as const;

/**
 * A stick has to be pushed most of the way to count as a direction. A worn thumbstick resting at
 * 0.2 is common; treating that as "down" would walk the focus ring across a menu on its own.
 */
export const GAMEPAD_STICK_DEADZONE = 0.55;

/** How long a direction is held before it starts repeating, and the cadence once it does. */
export const GAMEPAD_REPEAT_DELAY_MS = 420;
export const GAMEPAD_REPEAT_INTERVAL_MS = 130;

/** Directions repeat while held; every other action fires once per press. */
const REPEATING_ACTIONS: ReadonlySet<GamepadActionId> = new Set<GamepadActionId>(['up', 'down', 'left', 'right']);

const isPressed = (snapshot: GamepadSnapshot, index: number): boolean => snapshot.buttons[index]?.pressed === true;

const axis = (snapshot: GamepadSnapshot, index: number): number => {
    const value = snapshot.axes[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/**
 * Which actions the pad is asking for right now, with no memory of the last frame. A d-pad press
 * and a stick push are the same action: players use whichever their hand is already on.
 */
export const readGamepadActions = (snapshot: GamepadSnapshot): GamepadActionId[] => {
    const horizontal = axis(snapshot, 0);
    const vertical = axis(snapshot, 1);
    const held: GamepadActionId[] = [];

    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.dpadUp) || vertical <= -GAMEPAD_STICK_DEADZONE) held.push('up');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.dpadDown) || vertical >= GAMEPAD_STICK_DEADZONE) held.push('down');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.dpadLeft) || horizontal <= -GAMEPAD_STICK_DEADZONE) held.push('left');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.dpadRight) || horizontal >= GAMEPAD_STICK_DEADZONE) held.push('right');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.a)) held.push('confirm');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.b)) held.push('back');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.start)) held.push('pause');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.y) || isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.select)) held.push('help');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.leftBumper)) held.push('tabPrev');
    if (isPressed(snapshot, STANDARD_GAMEPAD_BUTTONS.rightBumper)) held.push('tabNext');

    return held;
};

/** Per-action clock: when each held action is next allowed to fire. Absent means "not held". */
export interface GamepadRepeatState {
    readonly nextFireAt: Readonly<Partial<Record<GamepadActionId, number>>>;
}

export const createGamepadRepeatState = (): GamepadRepeatState => ({ nextFireAt: {} });

/**
 * One frame of the pad. Returns the actions to run now and the state to carry into the next frame.
 * A newly held action fires immediately; a repeating one fires again on the cadence; a released one
 * is forgotten, so tapping a direction twice quickly gives two moves rather than one and a wait.
 */
export const stepGamepadInput = (
    state: GamepadRepeatState,
    heldActions: readonly GamepadActionId[],
    nowMs: number
): { readonly actions: GamepadActionId[]; readonly state: GamepadRepeatState } => {
    const held = new Set(heldActions);
    const nextFireAt: Partial<Record<GamepadActionId, number>> = {};
    const actions: GamepadActionId[] = [];

    for (const action of held) {
        const due = state.nextFireAt[action];
        if (due === undefined) {
            actions.push(action);
            nextFireAt[action] = REPEATING_ACTIONS.has(action) ? nowMs + GAMEPAD_REPEAT_DELAY_MS : Number.POSITIVE_INFINITY;
            continue;
        }
        if (nowMs >= due) {
            actions.push(action);
            nextFireAt[action] = nowMs + GAMEPAD_REPEAT_INTERVAL_MS;
            continue;
        }
        nextFireAt[action] = due;
    }

    return { actions, state: { nextFireAt } };
};

/**
 * The first pad reporting any input wins. Browsers pad the array with nulls for disconnected slots,
 * and a connected-but-idle pad should not out-rank the one the player is actually holding.
 */
export const pickActiveGamepad = (
    pads: ReadonlyArray<GamepadSnapshot | null>
): GamepadSnapshot | null => {
    let firstConnected: GamepadSnapshot | null = null;
    for (const pad of pads) {
        if (!pad) {
            continue;
        }
        firstConnected ??= pad;
        if (readGamepadActions(pad).length > 0) {
            return pad;
        }
    }
    return firstConnected;
};
