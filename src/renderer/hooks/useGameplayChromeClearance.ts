import { useEffect, type RefObject } from 'react';

/**
 * Publishes how much room the fixed gameplay chrome actually takes at the top and bottom
 * of the shell, as `--gameplay-hud-top-clearance` and `--gameplay-dock-bottom-clearance`.
 *
 * The floating board overlays are each absolutely positioned against the stage by a different
 * component, and each picked its own offset. None of them knew how tall the HUD bar or the action
 * dock had grown, so they landed on top of them.
 *
 * Measuring is the only honest answer here. Both bars size to their content, which changes with
 * the run (more charges, more mutators, a longer feedback line), so any constant would be wrong at
 * some viewport or some floor. The properties are written on the shell so every overlay reads the
 * same number.
 *
 * It finds the chrome by test id rather than by CSS-module class, because a class is a styling
 * detail and this measurement is not. It used to name `styles.hudRow` and `styles.actionDock` from
 * the game screen's own module; the bar and the dock later moved into the run shell's module, and
 * nothing said so. `querySelector` found nothing, the hook published a clearance of zero every
 * frame, and the overlays went back to sitting on the chrome — the trap toast on the stats at
 * 1280x800, the trait chip under the dock — with the system that exists to prevent exactly that
 * still running, still measuring, and measuring nothing.
 *
 * A clearance it cannot measure is not written at all. Publishing a zero overwrote each overlay's
 * own fallback with a confident wrong answer, which is how this stayed invisible.
 */
export const useGameplayChromeClearance = ({
    shellRef,
    hudTestId,
    dockTestId
}: {
    shellRef: RefObject<HTMLElement | null>;
    /** `data-testid` of the HUD bar. */
    hudTestId: string;
    /** `data-testid` of the bottom action dock. */
    dockTestId: string;
}): void => {
    useEffect(() => {
        const shell = shellRef.current;
        if (!shell || typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const lastWritten = new Map<string, string | null>();
        const write = (property: string, value: string | null): void => {
            if (lastWritten.get(property) === value) {
                return;
            }
            lastWritten.set(property, value);
            if (value === null) {
                shell.style.removeProperty(property);
            } else {
                shell.style.setProperty(property, value);
            }
        };

        const publish = (): void => {
            const shellRect = shell.getBoundingClientRect();
            // Re-queried each time: the bars mount with the run, and a stale node measures nothing.
            const hud = shell.querySelector<HTMLElement>(`[data-testid="${hudTestId}"]`);
            const dock = shell.querySelector<HTMLElement>(`[data-testid="${dockTestId}"]`);
            // Bottom of the HUD relative to the shell, not its height: the HUD may itself be inset
            // from the top, and an overlay needs to clear where it ends.
            write(
                '--gameplay-hud-top-clearance',
                hud ? `${Math.round(Math.max(0, hud.getBoundingClientRect().bottom - shellRect.top))}px` : null
            );
            write(
                '--gameplay-dock-bottom-clearance',
                dock ? `${Math.round(Math.max(0, shellRect.bottom - dock.getBoundingClientRect().top))}px` : null
            );
        };

        // Coalesced to one measurement per frame: the board mutates its subtree constantly
        // during play, and each publish reads layout.
        let frame = 0;
        const schedule = (): void => {
            if (frame !== 0) {
                return;
            }
            frame = requestAnimationFrame(() => {
                frame = 0;
                publish();
            });
        };

        publish();
        const observer = new ResizeObserver(schedule);
        observer.observe(shell);
        const hud = shell.querySelector<HTMLElement>(`[data-testid="${hudTestId}"]`);
        const dock = shell.querySelector<HTMLElement>(`[data-testid="${dockTestId}"]`);
        if (hud) {
            observer.observe(hud);
        }
        if (dock) {
            observer.observe(dock);
        }
        // The bars mount after the run starts and resize as charges and mutators come and go, so
        // the subtree has to be watched, not just the two elements found at mount.
        const mutation = new MutationObserver(schedule);
        mutation.observe(shell, { childList: true, subtree: true });
        return () => {
            if (frame !== 0) {
                cancelAnimationFrame(frame);
            }
            observer.disconnect();
            mutation.disconnect();
        };
    }, [dockTestId, hudTestId, shellRef]);
};
