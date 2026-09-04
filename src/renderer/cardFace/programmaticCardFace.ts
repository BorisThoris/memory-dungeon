/**
 * Deterministic card-face shell: framed procedural illustration only (no rank/symbol glyphs).
 * SVG retains vector sigil geometry for exports; canvas matches illustration + frame + vignette.
 */
import type { Tile } from '../../shared/contracts';
import { hashPairKey } from '../../shared/hashPairKey';
import { getCardFaceOverlayColors, type ProgrammaticOverlayVariant } from './cardFaceOverlayPalette';
import type { OverlayDrawTier } from './overlayDrawTier';
import { CARD_ILLUSTRATION_REGISTRY } from './cardIllustrationRegistry';
import { getCardIllustrationImageByUrl } from './cardIllustrationImages';
import { drawIllustrationCoverInViewBox, drawProceduralIllustrationCoverInViewBox } from './cardIllustrationDraw';
import { resolveCardIllustrationUrl } from './resolveCardIllustrationUrl';
import { svgLinearGradientDef } from './svgMarkup';

export type { ProgrammaticOverlayVariant };

export const PROGRAMMATIC_CARD_VIEWBOX = { w: 400, h: 560 } as const;

/** Layout tuned to sit in the authored `front.svg` inner panel (safe zone). */
const LAYOUT = {
    frame: { x: 24, y: 28, w: 352, h: 504, rx: 28 },
    shape: { cx: 200, cy: 196, scale: 1 }
} as const;

const SHAPE_COUNT = 5;

/** True when we use the programmatic frame shell (digits-only symbols like "01".."30"). */
export const tileUsesProgrammaticFaceMotif = (tile: Tile): boolean => /^\d{1,4}$/.test(tile.symbol.trim());

const shapeKind = (tile: Tile): number => {
    if (tile.atomicVariant != null) {
        return tile.atomicVariant % SHAPE_COUNT;
    }
    return hashPairKey(tile.pairKey) % SHAPE_COUNT;
};

function noiseSeed(tile: Tile, variant: ProgrammaticOverlayVariant): number {
    return Math.abs(hashPairKey(`${tile.id}|${tile.pairKey}|${variant}`)) % 500;
}

/** SVG path / primitive for sigil body (stroke on main layer; fill uses gradient url). */
const shapeSvgElements = (
    kind: number,
    cx: number,
    cy: number,
    s: number,
    stroke: string,
    highlightStroke: string,
    includeHighlight: boolean
): string => {
    const k = ((kind % SHAPE_COUNT) + SHAPE_COUNT) % SHAPE_COUNT;
    const sw = 3.2;
    const hi = `fill="none" stroke="${highlightStroke}" stroke-width="1.35" stroke-linejoin="round" opacity="0.9"`;

    const tail = includeHighlight;

    switch (k) {
        case 0: {
            const core = `<circle fill="url(#pgSigil)" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" cx="${cx}" cy="${cy}" r="${62 * s}" />`;
            return tail ? `${core}\n  <circle ${hi} cx="${cx}" cy="${cy}" r="${62 * s}" />` : core;
        }
        case 1: {
            const w = 112 * s;
            const h = 112 * s;
            const x = cx - w / 2;
            const y = cy - h / 2;
            const r = 14 * s;
            const core = `<rect fill="url(#pgSigil)" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" />`;
            return tail ? `${core}\n  <rect ${hi} x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" />` : core;
        }
        case 2: {
            const r = 74 * s;
            const pts = `${cx},${cy - r} ${cx + r * 0.866},${cy + r * 0.5} ${cx - r * 0.866},${cy + r * 0.5}`;
            const core = `<polygon fill="url(#pgSigil)" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" points="${pts}" />`;
            return tail ? `${core}\n  <polygon ${hi} points="${pts}" />` : core;
        }
        case 3: {
            const r = 52 * s;
            const pts = `${cx},${cy - r * 1.35} ${cx + r * 1.35},${cy} ${cx},${cy + r * 1.35} ${cx - r * 1.35},${cy}`;
            const core = `<polygon fill="url(#pgSigil)" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" points="${pts}" />`;
            return tail ? `${core}\n  <polygon ${hi} points="${pts}" />` : core;
        }
        default: {
            const n = 6;
            const r = 64 * s;
            const pts: string[] = [];
            for (let i = 0; i < n; i++) {
                const a = (Math.PI / 6 + (i * 2 * Math.PI) / n) - Math.PI / 2;
                pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
            }
            const p = pts.join(' ');
            const core = `<polygon fill="url(#pgSigil)" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" points="${p}" />`;
            return tail ? `${core}\n  <polygon ${hi} points="${p}" />` : core;
        }
    }
};

/**
 * Full SVG document for export, tests, or future rasterization — deterministic from tile + variant.
 * @param tier `full` matches golden tests; lighter tiers omit grain / emboss for exports.
 */
export const buildProgrammaticCardFaceSvg = (
    tile: Tile,
    variant: ProgrammaticOverlayVariant,
    tier: OverlayDrawTier = 'full'
): string => {
    const { w, h } = PROGRAMMATIC_CARD_VIEWBOX;
    const { frame, shape } = LAYOUT;
    const c = getCardFaceOverlayColors(variant);
    const k = shapeKind(tile);
    const inner = shapeSvgElements(
        k,
        shape.cx,
        shape.cy,
        shape.scale,
        c.sigilStroke,
        c.sigilHighlight,
        tier !== 'minimal'
    );
    const grainSeed = noiseSeed(tile, variant);
    const fx = frame.x;
    const fy = frame.y;
    const fw = frame.w;
    const fh = frame.h;

    const grainDef =
        tier === 'full'
            ? `<filter id="pgGrain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="${grainSeed}" result="n"/>
      <feColorMatrix in="n" type="matrix"
        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" result="g"/>
    </filter>`
            : '';
    const innerRim =
        tier === 'minimal'
            ? ''
            : `  <rect x="${fx + 5}" y="${fy + 5}" width="${fw - 10}" height="${fh - 10}" rx="${frame.rx * 0.72}" ry="${frame.rx * 0.72}"
    fill="none" stroke="${c.frameInnerRim}" stroke-width="1.1" opacity="0.95"/>
`;
    const grainRect =
        tier === 'full'
            ? `  <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" filter="url(#pgGrain)" opacity="${Math.min(0.22, c.grainAlpha * 4)}" pointer-events="none"/>
`
            : '';

    // The two gradients are the same shape; `svgLinearGradientDef` is where that shape lives.
    const frameGradient = svgLinearGradientDef('pgFrame', fx, fy, fx, fy + fh, true, [
        { color: c.frameFillTop, offset: '0' },
        { color: c.frameFillBottom, offset: '0.52' },
        { color: c.frameFillBottom, offset: '1' }
    ]);
    const sigilGradient = svgLinearGradientDef(
        'pgSigil',
        shape.cx - 96,
        shape.cy - 96,
        shape.cx + 96,
        shape.cy + 96,
        true,
        [
            { color: c.sigilFillDark, offset: '0' },
            { color: c.sigilFillLight, offset: '0.5' },
            { color: c.sigilFillDark, offset: '1' }
        ]
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    ${frameGradient}
    ${sigilGradient}
    <radialGradient id="pgVin" gradientUnits="userSpaceOnUse" cx="${shape.cx}" cy="${shape.cy * 0.92}" r="260">
      <stop offset="0.25" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="${c.vignette}"/>
    </radialGradient>
${grainDef}
  </defs>
  <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${frame.rx}" ry="${frame.rx}"
    fill="url(#pgFrame)" stroke="${c.frameStroke}" stroke-width="3"/>
${innerRim}
  ${inner}
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#pgVin)" pointer-events="none"/>
${grainRect}</svg>`;
};

const createOverlayRng = (tile: Tile, variant: ProgrammaticOverlayVariant): (() => number) => {
    let s = noiseSeed(tile, variant) + 1;
    return (): number => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
};

const drawFilmGrain = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    count: number,
    rgb: string,
    alpha: number,
    rng: () => number
): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${rgb})`;
    for (let i = 0; i < count; i += 1) {
        const x = rng() * width;
        const y = rng() * height;
        const z = 0.35 + rng() * 1.1;
        ctx.fillRect(x, y, z, z);
    }
    ctx.restore();
};

/** Canvas overlay scaled to target bitmap (same visual intent as {@link buildProgrammaticCardFaceSvg}). */
export const drawProgrammaticCardFaceOverlay = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tile: Tile,
    variant: ProgrammaticOverlayVariant,
    tier: OverlayDrawTier = 'full'
): void => {
    const { width, height } = canvas;
    const { w: vbW, h: vbH } = PROGRAMMATIC_CARD_VIEWBOX;
    const { frame, shape } = LAYOUT;
    const c = getCardFaceOverlayColors(variant);
    const rng = createOverlayRng(tile, variant);
    const grainMul = tier === 'full' ? 1 : tier === 'standard' ? 0.55 : 0;

    context.clearRect(0, 0, width, height);
    context.save();
    context.scale(width / vbW, height / vbH);

    const { x: fx, y: fy, w: fw, h: fh, rx } = frame;

    const frameGrad = context.createLinearGradient(fx, fy, fx, fy + fh);
    frameGrad.addColorStop(0, c.frameFillTop);
    frameGrad.addColorStop(0.52, c.frameFillBottom);
    frameGrad.addColorStop(1, c.frameFillBottom);

    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.fillStyle = frameGrad;
    context.strokeStyle = c.frameStroke;
    roundRectPath(context, fx, fy, fw, fh, rx);
    context.fill();
    context.stroke();

    if (tier !== 'minimal') {
        context.save();
        context.strokeStyle = c.frameInnerRim;
        context.lineWidth = 1.1;
        roundRectPath(context, fx + 5, fy + 5, fw - 10, fh - 10, rx * 0.72);
        context.stroke();
        context.restore();
    }

    const illUrl = resolveCardIllustrationUrl(tile, CARD_ILLUSTRATION_REGISTRY);
    const illImg = illUrl ? getCardIllustrationImageByUrl(illUrl) : null;
    const matStrength = tier === 'minimal' ? 0.55 : 1;
    if (illImg?.naturalWidth) {
        drawIllustrationCoverInViewBox(context, illImg, width, height, vbW, vbH, {
            matFeatherStrength: matStrength
        });
    } else {
        drawProceduralIllustrationCoverInViewBox(
            context,
            width,
            height,
            vbW,
            vbH,
            tile.pairKey,
            tier,
            c,
            {
                matFeatherStrength: matStrength
            }
        );
    }

    context.save();
    context.globalAlpha = 0.74;
    const vin = context.createRadialGradient(shape.cx, shape.cy * 0.92, 40, shape.cx, shape.cy * 0.92, 260);
    vin.addColorStop(0.25, 'rgba(0,0,0,0)');
    vin.addColorStop(1, c.vignette);
    context.fillStyle = vin;
    context.beginPath();
    context.rect(0, 0, vbW, vbH);
    context.fill();
    context.restore();

    if (grainMul > 0) {
        drawFilmGrain(context, vbW, vbH, Math.round(110 * grainMul), c.grainRgb, c.grainAlpha * 0.55, rng);
    }

    context.restore();
};

function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
