import { useEffect, type RefObject } from 'react';

/**
 * Where the player is looking, as two CSS variables on a scene element: `--scene-look-x` and
 * `--scene-look-y` in -1..1, the pointer's place in the window, eased so the room turns with the
 * hand rather than snapping to it. The scene's plate and its sprites read them at different
 * gains, which is what makes a flat painting read as a place with depth.
 *
 * Runs outside React: one `pointermove` listener, one animation frame while the value is still
 * settling, nothing while the pointer rests. Disabled (reduce motion, low quality, no window)
 * it leaves the variables at 0.
 */
export const useSceneLook = (ref: RefObject<HTMLElement | null>, enabled: boolean): void => {
    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element || typeof window === 'undefined') {
            element?.style.removeProperty('--scene-look-x');
            element?.style.removeProperty('--scene-look-y');
            return undefined;
        }
        let targetX = 0;
        let targetY = 0;
        let x = 0;
        let y = 0;
        let frame = 0;
        const write = (): void => {
            element.style.setProperty('--scene-look-x', x.toFixed(3));
            element.style.setProperty('--scene-look-y', y.toFixed(3));
        };
        const step = (): void => {
            frame = 0;
            x += (targetX - x) * 0.08;
            y += (targetY - y) * 0.08;
            write();
            if (Math.abs(targetX - x) > 0.002 || Math.abs(targetY - y) > 0.002) {
                frame = window.requestAnimationFrame(step);
            }
        };
        const onMove = (event: PointerEvent): void => {
            const w = window.innerWidth || 1;
            const h = window.innerHeight || 1;
            targetX = Math.max(-1, Math.min(1, (event.clientX / w) * 2 - 1));
            targetY = Math.max(-1, Math.min(1, (event.clientY / h) * 2 - 1));
            if (!frame) {
                frame = window.requestAnimationFrame(step);
            }
        };
        const onLeave = (): void => {
            targetX = 0;
            targetY = 0;
            if (!frame) {
                frame = window.requestAnimationFrame(step);
            }
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerleave', onLeave);
        window.addEventListener('blur', onLeave);
        write();
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerleave', onLeave);
            window.removeEventListener('blur', onLeave);
            if (frame) {
                window.cancelAnimationFrame(frame);
            }
            element.style.removeProperty('--scene-look-x');
            element.style.removeProperty('--scene-look-y');
        };
    }, [enabled, ref]);
};
