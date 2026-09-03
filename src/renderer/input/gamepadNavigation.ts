/**
 * The browser half of controller support: turn pad actions into the same events the game already
 * answers for a keyboard.
 *
 * Nothing here knows what a screen is. Every interactive surface in this game is a real focusable
 * element, so driving the focus ring spatially and synthesising the key the screen already listens
 * for gives the whole game controller support at once — menus, the codex, the shop, the board —
 * rather than one screen at a time.
 */

import { getFocusableElements } from '../a11y/focusables';
import { pickSpatialNeighbour, type FocusDirection, type SpatialCandidate } from './spatialFocus';
import type { GamepadActionId } from '../../shared/gamepad-input';

/** Marks the document while a pad is driving, so focus rings can be shown the way a pad needs. */
export const GAMEPAD_ACTIVE_ATTRIBUTE = 'data-gamepad-active';

const DIRECTIONS: Readonly<Record<string, FocusDirection>> = {
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right'
};

const ARROW_KEYS: Readonly<Record<FocusDirection, string>> = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight'
};

/**
 * Only elements a player can actually see and reach. `getFocusableElements` already drops
 * `inert`, `aria-hidden` and disabled subtrees; this adds the ones that are laid out to nothing.
 */
export const listNavigableElements = (root: Document = document): HTMLElement[] =>
    getFocusableElements(root.body).filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        const style = root.defaultView?.getComputedStyle(element);
        return !style || (style.visibility !== 'hidden' && style.display !== 'none');
    });

/*
 * Raised while this layer is dispatching a key of its own. `dispatchEvent` is synchronous, so any
 * listener that runs inside the window is looking at the pad's key, not the player's. The keyboard
 * listener that hands focus styling back reads this rather than `isTrusted`, which is a property
 * the pad's own synthetic events happen to share with the ones a test writes.
 */
let dispatchingSyntheticKey = false;

export const isDispatchingGamepadKey = (): boolean => dispatchingSyntheticKey;

const dispatchKey = (target: EventTarget, key: string, code: string): boolean => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code, key });
    dispatchingSyntheticKey = true;
    try {
        // `dispatchEvent` returns false exactly when something called `preventDefault` — that is the
        // signal that a screen consumed the key and we should not also act on it ourselves.
        return !target.dispatchEvent(event);
    } finally {
        dispatchingSyntheticKey = false;
    }
};

/** The board is a `role="application"` region that runs its own grid navigation. */
const applicationRegion = (element: Element | null): HTMLElement | null =>
    element instanceof HTMLElement ? element.closest<HTMLElement>('[role="application"]') : null;

const moveFocusSpatially = (direction: FocusDirection, root: Document): boolean => {
    const active = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    const elements = listNavigableElements(root);
    if (elements.length === 0) {
        return false;
    }
    if (!active || active === root.body) {
        elements[0]?.focus();
        return true;
    }
    const candidates: SpatialCandidate<HTMLElement>[] = elements
        .filter((element) => element !== active)
        .map((element) => ({ rect: element.getBoundingClientRect(), value: element }));
    const next = pickSpatialNeighbour(active.getBoundingClientRect(), candidates, direction);
    if (!next) {
        return false;
    }
    next.focus();
    return true;
};

const moveFocusInOrder = (step: 1 | -1, root: Document): boolean => {
    const elements = listNavigableElements(root);
    if (elements.length === 0) {
        return false;
    }
    const active = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    const index = active ? elements.indexOf(active) : -1;
    const next = elements[(index + step + elements.length) % elements.length];
    next?.focus();
    return true;
};

/**
 * Run one pad action against the live document. Returns whether anything happened, which the
 * caller uses to decide if the pad is the input device currently in charge.
 */
export const applyGamepadAction = (action: GamepadActionId, root: Document = document): boolean => {
    const active = root.activeElement instanceof HTMLElement ? root.activeElement : root.body;
    const region = applicationRegion(root.activeElement);
    const direction = DIRECTIONS[action];

    if (direction) {
        // Inside the board, the region's own grid navigation gets first refusal: it knows which
        // cells are still pickable. It consumes the key only when it actually moved, so the edge
        // of the board hands the stick back and the next push walks out to the surrounding HUD.
        if (region && dispatchKey(region, ARROW_KEYS[direction], ARROW_KEYS[direction])) {
            return true;
        }
        return moveFocusSpatially(direction, root);
    }

    switch (action) {
        case 'confirm':
            if (region) {
                return dispatchKey(region, 'Enter', 'Enter');
            }
            if (active && active !== root.body) {
                active.click();
                return true;
            }
            return moveFocusSpatially('down', root);
        case 'back':
            return dispatchKey(active, 'Escape', 'Escape');
        case 'pause':
            return dispatchKey(active, 'p', 'KeyP');
        case 'help':
            return dispatchKey(active, 'F1', 'F1');
        case 'tabPrev':
            return moveFocusInOrder(-1, root);
        case 'tabNext':
            return moveFocusInOrder(1, root);
        default:
            return false;
    }
};
