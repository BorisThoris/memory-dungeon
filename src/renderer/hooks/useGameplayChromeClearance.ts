import { useEffect, type RefObject } from 'react';

/**
 * Publishes how much room the fixed gameplay chrome actually takes at the top and bottom
 * of the shell, as `--gameplay-hud-top-clearance` and `--gameplay-dock-bottom-clearance`.
 *
 * The floating board overlays - the chain-opportunity chip, the trait-mode cue, the
 * action-feedback rail, the dungeon run strip - are each absolutely positioned against
 * the stage by a different component, and each picked its own offset. None of them knew
 * how tall the HUD deck or the action dock had grown, so they landed on top of them: the
 * chip covered the floor/lives rail, the feedback rail painted over the score at a higher
 * z-index, and the run strip sat inside the dock.
 *
 * Measuring is the only honest answer here. Both bars size to their content, which
 * changes with the run (more charges, more mutators, a longer feedback line), so any
 * constant would be wrong at some viewport or some floor. The properties are written on
 * the shell so every overlay reads the same number.
 */
export const useGameplayChromeClearance = ({
    shellRef,
    hudClassName,
    dockClassName,
    boardChipClassName
}: {
    shellRef: RefObject<HTMLElement | null>;
    /** Scoped class of the HUD header, from the shared CSS module. */
    hudClassName: string;
    /** Scoped class of the bottom action dock, from the shared CSS module. */
    dockClassName: string;
    /** Scoped class of the chain-opportunity chip, from the board's CSS module. */
    boardChipClassName: string;
}): void => {
    useEffect(() => {
        const shell = shellRef.current;
        if (!shell || typeof ResizeObserver === 'undefined') {
            return;
        }
        const hud = shell.querySelector<HTMLElement>(`.${hudClassName}`);
        const dock = shell.querySelector<HTMLElement>(`.${dockClassName}`);

        const lastWritten = new Map<string, string>();
        const write = (property: string, value: string): void => {
            if (lastWritten.get(property) === value) {
                return;
            }
            lastWritten.set(property, value);
            shell.style.setProperty(property, value);
        };

        const publish = (): void => {
            const shellRect = shell.getBoundingClientRect();
            const hudRect = hud?.getBoundingClientRect();
            const dockRect = dock?.getBoundingClientRect();
            // Re-queried each time: the chip mounts and unmounts with the run, unlike the
            // two bars, which live for as long as the shell does.
            const chipHeight =
                shell.querySelector<HTMLElement>(`.${boardChipClassName}`)?.getBoundingClientRect().height ?? 0;
            write('--gameplay-board-chip-height', `${Math.round(chipHeight)}px`);
            // Bottom of the HUD relative to the shell, not its height: the HUD may itself
            // be inset from the top, and an overlay needs to clear where it ends.
            const topClearance = hudRect ? Math.max(0, hudRect.bottom - shellRect.top) : 0;
            const bottomClearance = dockRect ? Math.max(0, shellRect.bottom - dockRect.top) : 0;
            write('--gameplay-hud-top-clearance', `${Math.round(topClearance)}px`);
            write('--gameplay-dock-bottom-clearance', `${Math.round(bottomClearance)}px`);
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
        if (hud) {
            observer.observe(hud);
        }
        if (dock) {
            observer.observe(dock);
        }
        // The chip mounts after the run starts and resizes as reward lanes come and go, so
        // the subtree has to be watched, not just the two bars.
        const mutation = new MutationObserver(schedule);
        mutation.observe(shell, { childList: true, subtree: true });
        return () => {
            if (frame !== 0) {
                cancelAnimationFrame(frame);
            }
            observer.disconnect();
            mutation.disconnect();
        };
    }, [boardChipClassName, dockClassName, hudClassName, shellRef]);
};
