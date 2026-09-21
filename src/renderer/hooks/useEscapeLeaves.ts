import { useEffect } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * Whether Escape from this target means "leave the screen" rather than "clear this field".
 *
 * A text field owns its own Escape — a player clearing a pasted run key does not mean to close the
 * Collection. Button-like inputs (checkbox, radio, submit) have no text to clear, so Escape there
 * is a leave like anywhere else.
 */
export const targetAllowsEscapeToLeave = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable || target.closest('textarea, select')) {
    return false;
  }

  const input = target.closest('input');
  if (!input) {
    return true;
  }

  return ['button', 'checkbox', 'radio', 'reset', 'submit'].includes(input.type);
};

/**
 * Escape leaves a meta screen, which is also how a controller leaves one.
 *
 * The pad's B button maps to `back`, and `back` dispatches Escape (`gamepadNavigation.ts`). None of
 * the five meta screens listened for it, so B did nothing on Collection, Profile, Inventory, Codex
 * or Settings — measured by keyboard too, which is how we know it was never a pad problem. On a
 * Deck, B is the universal back; a player who opened the Codex had to hunt the on-screen Back
 * button with the stick, and Valve's controller criterion is about the DEFAULT configuration
 * reaching content (`docs/RESEARCH_NOTES_2.md` §1).
 *
 * This listens on `window` in the bubble phase, which is the last thing to run: `OverlayModal` and
 * `GameScreen`'s shortcut overlay both take Escape on `document` in the capture phase and call
 * `preventDefault`, so a dialog over the screen still wins and the screen behind it stays open.
 */
export const useEscapeLeaves = (onBack: () => void, active = true): void => {
  const onBackRef = useLatestRef(onBack);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !targetAllowsEscapeToLeave(event.target)
      ) {
        return;
      }
      event.preventDefault();
      onBackRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onBackRef]);
};
