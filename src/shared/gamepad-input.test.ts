import { describe, expect, it } from 'vitest';
import {
    createGamepadRepeatState,
    GAMEPAD_REPEAT_DELAY_MS,
    GAMEPAD_REPEAT_INTERVAL_MS,
    GAMEPAD_STICK_DEADZONE,
    pickActiveGamepad,
    readGamepadActions,
    STANDARD_GAMEPAD_BUTTONS,
    stepGamepadInput,
    type GamepadActionId,
    type GamepadSnapshot
} from './gamepad-input';

const pad = (options: { axes?: number[]; pressed?: number[] } = {}): GamepadSnapshot => ({
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_unused, index) => ({ pressed: (options.pressed ?? []).includes(index) }))
});

describe('readGamepadActions', () => {
    it('reads the d-pad', () => {
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.dpadLeft] }))).toEqual(['left']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.dpadDown] }))).toEqual(['down']);
    });

    it('maps the face and shoulder buttons to their actions', () => {
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.a] }))).toEqual(['confirm']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.b] }))).toEqual(['back']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.start] }))).toEqual(['pause']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.y] }))).toEqual(['help']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.select] }))).toEqual(['help']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.leftBumper] }))).toEqual(['tabPrev']);
        expect(readGamepadActions(pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.rightBumper] }))).toEqual(['tabNext']);
    });

    it('reads the left stick like the d-pad once it is pushed past the deadzone', () => {
        expect(readGamepadActions(pad({ axes: [0, -1, 0, 0] }))).toEqual(['up']);
        expect(readGamepadActions(pad({ axes: [1, 0, 0, 0] }))).toEqual(['right']);
    });

    it('ignores a stick resting inside the deadzone, so a worn pad does not walk the focus ring', () => {
        const drift = GAMEPAD_STICK_DEADZONE - 0.05;
        expect(readGamepadActions(pad({ axes: [drift, drift, 0, 0] }))).toEqual([]);
    });

    it('survives a pad reporting fewer axes and buttons than the standard layout', () => {
        expect(readGamepadActions({ axes: [], buttons: [] })).toEqual([]);
        expect(readGamepadActions({ axes: [Number.NaN, 0], buttons: [] })).toEqual([]);
    });
});

describe('stepGamepadInput', () => {
    const press = (state = createGamepadRepeatState(), held: GamepadActionId[] = ['down'], now = 0) =>
        stepGamepadInput(state, held, now);

    it('fires a newly held action immediately', () => {
        expect(press().actions).toEqual(['down']);
    });

    it('waits out the delay before a held direction repeats, then repeats on the interval', () => {
        let step = press();
        step = stepGamepadInput(step.state, ['down'], GAMEPAD_REPEAT_DELAY_MS - 1);
        expect(step.actions).toEqual([]);
        step = stepGamepadInput(step.state, ['down'], GAMEPAD_REPEAT_DELAY_MS);
        expect(step.actions).toEqual(['down']);
        step = stepGamepadInput(step.state, ['down'], GAMEPAD_REPEAT_DELAY_MS + GAMEPAD_REPEAT_INTERVAL_MS - 1);
        expect(step.actions).toEqual([]);
        step = stepGamepadInput(step.state, ['down'], GAMEPAD_REPEAT_DELAY_MS + GAMEPAD_REPEAT_INTERVAL_MS);
        expect(step.actions).toEqual(['down']);
    });

    it('never repeats a button, however long it is held', () => {
        let step = press(createGamepadRepeatState(), ['confirm']);
        expect(step.actions).toEqual(['confirm']);
        for (const now of [100, 1_000, 60_000]) {
            step = stepGamepadInput(step.state, ['confirm'], now);
            expect(step.actions).toEqual([]);
        }
    });

    it('forgets a released action, so two taps are two moves', () => {
        let step = press();
        step = stepGamepadInput(step.state, [], 20);
        expect(step.actions).toEqual([]);
        step = stepGamepadInput(step.state, ['down'], 40);
        expect(step.actions).toEqual(['down']);
    });
});

describe('pickActiveGamepad', () => {
    it('ignores the empty slots browsers pad the list with', () => {
        expect(pickActiveGamepad([null, null])).toBeNull();
    });

    it('prefers the pad the player is actually holding over an idle one', () => {
        const idle = pad();
        const held = pad({ pressed: [STANDARD_GAMEPAD_BUTTONS.a] });
        expect(pickActiveGamepad([null, idle, held])).toBe(held);
    });

    it('falls back to the first connected pad when none is being touched', () => {
        const first = pad();
        expect(pickActiveGamepad([null, first, pad()])).toBe(first);
    });
});
