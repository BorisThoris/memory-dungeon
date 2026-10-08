import type { GraphicsQualityPreset } from '../shared/contracts';

/**
 * The graphics tier a device starts on (2026-10-08). Every new player began on Medium, so a phone
 * with an old GPU ran the medium board and a gaming PC never saw High until it went looking in
 * Settings. The research behind this (detect-gpu's tiers, react-three-fiber's scaling guidance) says
 * to choose quality per device; this does it from what the browser already tells us, without
 * shipping a benchmark table or calling out to one:
 *
 * - the GPU's own name (WebGL's unmasked renderer): software rasterisers and old integrated or
 *   mobile parts start Low, current discrete and Apple-silicon parts start High;
 * - a phone or tablet (a coarse pointer) never starts above Medium;
 * - few cores or little memory caps it at Medium, and very little at Low.
 *
 * Only a first launch is chosen for: once a save holds a setting it is the player's (`hydrationController.ts`).
 */
export interface GraphicsDeviceProfile {
    /** The unmasked renderer string, or the masked one, or '' when WebGL gave neither. */
    renderer: string;
    coarsePointer: boolean;
    cores: number | null;
    memoryGb: number | null;
}

const WEAK = /swiftshader|llvmpipe|software|microsoft basic|intel\(r\) hd graphics [2-5]\d{2,3}|intel hd graphics [2-5]\d{2,3}|mali-[4t]|mali-g[57]\d\b|adreno \(tm\) [3-5]\d{2}|adreno [3-5]\d{2}|powervr|videocore/i;
const STRONG = /geforce (rtx|gtx (9[6-9]0|10[6-8]0|16))|rtx [2-9]\d{3}|radeon rx (5[5-9]|[67]\d)\d{2}|radeon rx [6-9]\d{3}|apple m[1-9]|apple gpu|adreno \(tm\) [7-9]\d{2}|adreno [7-9]\d{2}|arc a[5-7]/i;

export const classifyGraphicsTier = ({ renderer, coarsePointer, cores, memoryGb }: GraphicsDeviceProfile): GraphicsQualityPreset => {
    if (WEAK.test(renderer)) return 'low';
    if ((cores != null && cores <= 2) || (memoryGb != null && memoryGb <= 2)) return 'low';
    let tier: GraphicsQualityPreset = STRONG.test(renderer) ? 'high' : 'medium';
    if (coarsePointer && tier === 'high') tier = 'medium';
    if (((cores != null && cores <= 4) || (memoryGb != null && memoryGb <= 4)) && tier === 'high') tier = 'medium';
    return tier;
};

/** What this browser says about its device. Never throws; an unknown device reads as Medium. */
export const readGraphicsDeviceProfile = (): GraphicsDeviceProfile => {
    let renderer = '';
    // A test DOM has no WebGL and complains when asked; it reads as an unknown device.
    const testDom = typeof navigator !== 'undefined' && /jsdom|happydom/i.test(navigator.userAgent);
    try {
        if (testDom) throw new Error('no WebGL in a test DOM');
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (gl) {
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    } catch {
        renderer = '';
    }
    const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { deviceMemory?: number });
    let coarsePointer = false;
    try {
        coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    } catch {
        coarsePointer = false;
    }
    return {
        renderer,
        coarsePointer,
        cores: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
        memoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null
    };
};

export const detectGraphicsTier = (): GraphicsQualityPreset => classifyGraphicsTier(readGraphicsDeviceProfile());
