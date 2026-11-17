/**
 * The Vibration setting (Settings › Accessibility), for the phone's taps and the controller's rumble.
 *
 * Reduce Motion already stops both, but it also stops the shake, the camera and the room's
 * flashes; a player who wants all of that and no buzz in the hand had no way to say so (the wider
 * market review, P2). This switch is that way. `App.tsx` keeps it in step with the saved setting,
 * so the three places that buzz (the dock, the study clock, an item's impact) and the two that
 * rumble (a break, reaching Fever) need no new prop.
 */
let enabled = true;

export const setVibrationEnabled = (next: boolean): void => {
    enabled = next;
};

export const vibrationEnabled = (): boolean => enabled;
