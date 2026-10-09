import { useEffect, useRef, type ReactElement } from 'react';
import { plasmaRailLook } from './plasmaRailLook';

/**
 * The combo meter as a beam of plasma (2026-10-09). The ladder's rail was a 1px hairline with a
 * blurred flame gradient behind it. Now a beam runs up the rail as far as the meter is filled: a
 * hairline when the combo is cold, thickening with the heat, plasma flowing up it in bright knots,
 * and from Hot on it drips - beads that swell on the beam, let go and fall away. Past Legendary
 * the ascensions keep it growing on a soft cap (`plasmaRailLook`), so a combo carried across ten
 * floors is still climbing and never a solid bar.
 *
 * Drawn on a small 2D canvas over the rail, not WebGL: the HUD is DOM, and a second GL context
 * for a 24-pixel strip would cost more than the strip. Only the element's own colour is added
 * (the temper's flame), as the effects rules ask. Reduced motion draws the beam once, still.
 */
/** The canvas's width either side of the rail, in CSS pixels. */
const HALF = 12;

interface Drip { x: number; y: number; vy: number; vx: number; life: number; size: number }

const hash = (n: number): number => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
};
const noise = (x: number): number => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
};

export const PlasmaRail = ({ combo, fill, colour, reduceMotion }: {
    combo: number;
    /** How far up the rail the meter is filled, 0..1. */
    fill: number;
    /** The temper's flame for the stage (`comboHeatThemeForRun`). */
    colour: string;
    reduceMotion: boolean;
}): ReactElement => {
    const canvas = useRef<HTMLCanvasElement | null>(null);
    const inputs = useRef({ combo, fill, colour, reduceMotion });
    useEffect(() => {
        inputs.current = { combo, fill, colour, reduceMotion };
    }, [colour, combo, fill, reduceMotion]);

    useEffect(() => {
        const node = canvas.current;
        const context = node?.getContext('2d');
        if (!node || !context) return;
        let frame = 0;
        let last = performance.now();
        let shown = inputs.current.fill;
        let pending = 0;
        const drips: Drip[] = [];
        const draw = (now: number) => {
            const { combo: links, fill: target, colour: flame, reduceMotion: still } = inputs.current;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const ratio = window.devicePixelRatio || 1;
            const width = HALF * 2;
            const height = node.clientHeight;
            if (height <= 0) {
                frame = requestAnimationFrame(draw);
                return;
            }
            if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
                node.width = Math.round(width * ratio);
                node.height = Math.round(height * ratio);
            }
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, width, height);
            // The fill eases to its target the way the CSS fill did (400 ms).
            shown = still ? target : shown + (target - shown) * Math.min(1, dt * 7);
            const look = plasmaRailLook(links);
            const top = height * (1 - Math.max(0, Math.min(1, shown)));
            const t = now / 1000;
            if (links > 0 && height - top > 0.5) {
                context.globalCompositeOperation = 'lighter';
                // The glow, then the beam in knots, then the white-hot core.
                const step = 2;
                for (let y = height; y > top; y -= step) {
                    const along = (height - y) / height;
                    const knot = still ? 0.6 : noise(along * 9 - t * look.flow * 6) * 0.7 + noise(along * 23 - t * look.flow * 11) * 0.3;
                    const w = look.width * (0.75 + knot * 0.5);
                    context.globalAlpha = look.glow * (0.18 + knot * 0.22);
                    context.fillStyle = flame;
                    context.fillRect(HALF - w * 2.2, y - step, w * 4.4, step);
                    context.globalAlpha = 0.55 + knot * 0.45;
                    context.fillRect(HALF - w / 2, y - step, w, step);
                    context.globalAlpha = Math.min(1, 0.25 + look.glow * knot * 0.6);
                    context.fillStyle = '#fff6e6';
                    context.fillRect(HALF - Math.max(0.5, w * 0.22), y - step, Math.max(1, w * 0.44), step);
                }
                // Drips: swell on the beam, let go, fall, fade.
                if (!still) {
                    pending += look.drips * dt;
                    while (pending >= 1) {
                        pending -= 1;
                        const side = hash(t * 13.7 + drips.length) > 0.5 ? 1 : -1;
                        drips.push({ x: HALF + side * look.width * 0.4, y: top + (height - top) * hash(t * 7.1) * 0.85, vy: 0, vx: side * (2 + hash(t) * 6), life: 1, size: 0.8 + look.width * 0.35 });
                    }
                    for (const drip of drips) {
                        drip.vy += 140 * dt;
                        drip.y += drip.vy * dt;
                        drip.x += drip.vx * dt;
                        drip.life -= dt * 1.4;
                        context.globalAlpha = Math.max(0, drip.life) * 0.9;
                        context.fillStyle = flame;
                        context.beginPath();
                        context.ellipse(drip.x, drip.y, drip.size * 0.7, drip.size * (1 + Math.min(2, drip.vy / 120)), 0, 0, Math.PI * 2);
                        context.fill();
                    }
                    for (let i = drips.length - 1; i >= 0; i -= 1) if (drips[i]!.life <= 0 || drips[i]!.y > height + 8) drips.splice(i, 1);
                }
                context.globalAlpha = 1;
                context.globalCompositeOperation = 'source-over';
            }
            const settled = Math.abs(target - shown) < 0.001 && drips.length === 0;
            if (still && settled) {
                frame = 0;
                return;
            }
            if (links === 0 && settled) {
                frame = 0;
                return;
            }
            frame = requestAnimationFrame(draw);
        };
        const wake = () => {
            if (frame === 0) {
                last = performance.now();
                frame = requestAnimationFrame(draw);
            }
        };
        frame = requestAnimationFrame(draw);
        const timer = window.setInterval(wake, 250);
        return () => {
            cancelAnimationFrame(frame);
            window.clearInterval(timer);
        };
    }, []);

    return <canvas aria-hidden="true" data-testid="hud-plasma-rail" ref={canvas} style={{ position: 'absolute', top: 0, bottom: 0, left: -HALF, width: HALF * 2, height: '100%', pointerEvents: 'none' }} />;
};
