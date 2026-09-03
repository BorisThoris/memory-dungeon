import { useEffect, useState } from 'react';
import {
    createGamepadRepeatState,
    pickActiveGamepad,
    readGamepadActions,
    stepGamepadInput,
    type GamepadRepeatState
} from '../../shared/gamepad-input';
import { applyGamepadAction, GAMEPAD_ACTIVE_ATTRIBUTE, isDispatchingGamepadKey } from '../input/gamepadNavigation';

/**
 * Polls the connected controller and runs what it asks for.
 *
 * The Gamepad API has no input events — a pad's state can only be sampled — so this is a frame
 * loop, and it only runs while a pad is connected: with nothing plugged in the hook costs two
 * event listeners and no frames.
 */
export const useGamepadNavigation = (enabled = true): void => {
    useEffect(() => {
        if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
            return undefined;
        }

        let frame: number | null = null;
        let repeat: GamepadRepeatState = createGamepadRepeatState();

        const connectedPads = (): ReturnType<Navigator['getGamepads']> => navigator.getGamepads();
        const anyConnected = (): boolean => Array.from(connectedPads()).some((pad) => pad !== null);

        const setPadActive = (active: boolean): void => {
            const root = document.documentElement;
            if (active) {
                root.setAttribute(GAMEPAD_ACTIVE_ATTRIBUTE, 'true');
            } else {
                root.removeAttribute(GAMEPAD_ACTIVE_ATTRIBUTE);
            }
        };

        const tick = (): void => {
            const pad = pickActiveGamepad(Array.from(connectedPads()));
            if (pad) {
                const stepped = stepGamepadInput(repeat, readGamepadActions(pad), performance.now());
                repeat = stepped.state;
                if (stepped.actions.length > 0) {
                    setPadActive(true);
                    for (const action of stepped.actions) {
                        applyGamepadAction(action);
                    }
                }
            }
            frame = requestAnimationFrame(tick);
        };

        const start = (): void => {
            frame ??= requestAnimationFrame(tick);
        };
        const stop = (): void => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
                frame = null;
            }
            repeat = createGamepadRepeatState();
            setPadActive(false);
        };

        const onConnected = (): void => start();
        const onDisconnected = (): void => {
            if (!anyConnected()) {
                stop();
            }
        };

        /*
         * Real mouse or keyboard input hands the focus-ring styling back — but not the keys this
         * layer dispatches on the pad's behalf, or the pad would switch itself off on every press.
         */
        const onHumanInput = (): void => {
            if (!isDispatchingGamepadKey()) {
                setPadActive(false);
            }
        };

        window.addEventListener('gamepadconnected', onConnected);
        window.addEventListener('gamepaddisconnected', onDisconnected);
        window.addEventListener('pointerdown', onHumanInput, true);
        window.addEventListener('keydown', onHumanInput, true);

        // A pad held through a reload never fires `gamepadconnected`, so poll if one is already up.
        if (anyConnected()) {
            start();
        }

        return () => {
            window.removeEventListener('gamepadconnected', onConnected);
            window.removeEventListener('gamepaddisconnected', onDisconnected);
            window.removeEventListener('pointerdown', onHumanInput, true);
            window.removeEventListener('keydown', onHumanInput, true);
            stop();
        };
    }, [enabled]);
};

/**
 * Whether a controller is plugged in right now. Screens use it to say what the player is holding
 * instead of listing every input path at once.
 */
export const useGamepadConnected = (): boolean => {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
            return undefined;
        }
        const sync = (): void => setConnected(Array.from(navigator.getGamepads()).some((pad) => pad !== null));
        sync();
        window.addEventListener('gamepadconnected', sync);
        window.addEventListener('gamepaddisconnected', sync);
        return () => {
            window.removeEventListener('gamepadconnected', sync);
            window.removeEventListener('gamepaddisconnected', sync);
        };
    }, []);

    return connected;
};
