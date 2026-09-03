/**
 * Whether two colours stay different when the eye reading them cannot see the difference.
 *
 * This game asks a player to tell nine tile traits apart at a glance, and it says which trait a
 * tile carries by tinting a marker. Roughly one man in twelve cannot separate some of those hues,
 * so "the colours look distinct" is a claim that needs measuring rather than eyeballing.
 *
 * The simulation is Viénot, Brettel and Mollon's: project the colour onto the plane of hues a
 * dichromat can still distinguish, in LMS cone space. The distance is CIE76 in L*a*b*, which is
 * coarse but well-defined and monotonic enough for "are these two markers telling me different
 * things". Everything is pure, so the palette can be gated without a screen.
 */

export type ColorVision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const COLOR_VISION_KINDS: readonly ColorVision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

export interface Rgb {
    readonly b: number;
    readonly g: number;
    readonly r: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const hexToRgb = (hex: string): Rgb => {
    const cleaned = hex.replace('#', '').trim();
    const full =
        cleaned.length === 3
            ? cleaned
                  .split('')
                  .map((char) => char + char)
                  .join('')
            : cleaned;
    if (!/^[0-9a-fA-F]{6}$/u.test(full)) {
        throw new Error(`Not a hex colour: ${hex}`);
    }
    return {
        b: Number.parseInt(full.slice(4, 6), 16) / 255,
        g: Number.parseInt(full.slice(2, 4), 16) / 255,
        r: Number.parseInt(full.slice(0, 2), 16) / 255
    };
};

export const rgbToHex = ({ b, g, r }: Rgb): string => {
    const channel = (value: number): string =>
        Math.round(clamp01(value) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`;
};

/** sRGB transfer function, both directions. Colour maths only means anything in linear light. */
const toLinear = (value: number): number =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = (value: number): number =>
    value <= 0.0031308 ? value * 12.92 : 1.055 * clamp01(value) ** (1 / 2.4) - 0.055;

/**
 * Dichromacy in linear sRGB, as the matrices Viénot, Brettel and Mollon published for the
 * single-plane approximation. Applying them in linear light rather than on the encoded bytes is
 * what keeps the simulated colours from drifting dark.
 */
const DICHROMACY_MATRICES: Record<Exclude<ColorVision, 'normal'>, readonly number[]> = {
    protanopia: [0.1121, 0.8853, -0.0005, 0.1127, 0.8897, -0.0001, 0.0045, 0.0085, 0.9917],
    deuteranopia: [0.292, 0.7054, -0.0003, 0.2934, 0.7089, 0.0004, -0.0195, 0.0333, 0.9862],
    tritanopia: [1.255, -0.0765, -0.1789, -0.0783, 0.9312, 0.1473, 0.0042, 0.6941, 0.3018]
};

export const simulateColorVision = (rgb: Rgb, vision: ColorVision): Rgb => {
    if (vision === 'normal') {
        return rgb;
    }
    const m = DICHROMACY_MATRICES[vision];
    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);
    return {
        b: toSrgb(m[6]! * r + m[7]! * g + m[8]! * b),
        g: toSrgb(m[3]! * r + m[4]! * g + m[5]! * b),
        r: toSrgb(m[0]! * r + m[1]! * g + m[2]! * b)
    };
};

interface Lab {
    readonly a: number;
    readonly b: number;
    readonly l: number;
}

/** D65 white point, the one sRGB is defined against. */
const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 } as const;

const labFinalize = (value: number): number => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);

export const rgbToLab = ({ b, g, r }: Rgb): Lab => {
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);
    const x = labFinalize((lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / WHITE.x);
    const y = labFinalize((lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / WHITE.y);
    const z = labFinalize((lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / WHITE.z);
    return { a: 500 * (x - y), b: 200 * (y - z), l: 116 * y - 16 };
};

/** CIE76: plain Euclidean distance in L*a*b*. Around 2.3 is the "just noticeable" step. */
export const colorDistance = (left: Rgb, right: Rgb): number => {
    const a = rgbToLab(left);
    const b = rgbToLab(right);
    return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
};

export interface ConfusablePair {
    readonly distance: number;
    readonly left: string;
    readonly right: string;
    readonly vision: ColorVision;
}

/**
 * Every pair of palette entries that lands closer than `threshold` under any vision, worst first.
 * The caller decides the threshold; what matters is that the answer is a measurement.
 */
export const findConfusablePairs = (
    palette: Readonly<Record<string, string>>,
    threshold: number,
    visions: readonly ColorVision[] = COLOR_VISION_KINDS
): ConfusablePair[] => {
    const names = Object.keys(palette);
    const found: ConfusablePair[] = [];
    for (const vision of visions) {
        const simulated = new Map(
            names.map((name) => [name, simulateColorVision(hexToRgb(palette[name]!), vision)] as const)
        );
        for (let i = 0; i < names.length; i += 1) {
            for (let j = i + 1; j < names.length; j += 1) {
                const left = names[i]!;
                const right = names[j]!;
                const distance = colorDistance(simulated.get(left)!, simulated.get(right)!);
                if (distance < threshold) {
                    found.push({ distance, left, right, vision });
                }
            }
        }
    }
    return found.sort((a, b) => a.distance - b.distance);
};
