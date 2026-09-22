import type { SceneMote } from './SceneMotes';

/**
 * The motes that rise through the portal clearing: a dozen points of light, each on its own loop,
 * deterministic so a render is the same every time. They keep to the trees and the ground on
 * either side of the arch (the middle is the vortex's, and the page's copy sits over it).
 */
export type PortalMote = SceneMote;

const fract = (value: number): number => value - Math.floor(value);

export const PORTAL_MOTE_COUNT = 12;

export const portalMotes = (): PortalMote[] =>
    Array.from({ length: PORTAL_MOTE_COUNT }, (_, i) => {
        const side = i % 2 === 0 ? 0 : 1;
        const durationMs = Math.round(9000 + 7000 * fract(i * 0.618034));
        return {
            id: `mote-${i}`,
            x: Math.round(side === 0 ? 4 + 30 * fract(i * 0.381966 + 0.2) : 66 + 30 * fract(i * 0.381966 + 0.2)),
            y: Math.round(48 + 44 * fract(i * 0.754878 + 0.4)),
            durationMs,
            delayMs: -Math.round(durationMs * fract(i * 0.56984 + 0.1)),
            driftPx: Math.round(-24 + 48 * fract(i * 0.271828 + 0.3)),
            risePx: Math.round(50 + 70 * fract(i * 0.141421 + 0.5)),
            size: 2 + (i % 3 === 0 ? 1 : 0)
        };
    });
