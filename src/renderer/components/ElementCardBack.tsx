import { useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import { getTileSuit, TILE_SUITS } from '../../shared/tile-suit-rules';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * Every card is made of its element (2026-10-01, `element-alchemy-rules.ts`).
 *
 * The owner, retiring the omen cards and their sigil in the top corner: "Lets figure out a way for
 * you to figure out what a card is without needing these icons. We can make cards literally out of
 * water / fire / ice / growth based on our groups." So the back is no longer a card with a suit
 * badge low on it: the whole back is the material. Fire is char split by molten veins with flames
 * licking up from the foot; Water is deep blue under a caustic web, with bubbles; Frost is pale
 * faceted ice with rime feathering in; Grove is moss and leaves under a creeping vine.
 *
 * The four read apart in greyscale by their pattern (veins and tongues, a web of light, facets,
 * leaves), not only by colour, which this game does not trust alone; the suit's rune is still
 * carved low on the back for a player who wants the glyph. Since a card's element decides what the
 * realm can do to it (a card drinks its own element and puts out the one its element beats), the
 * material is a rule a player can read at a glance.
 *
 * An empowered card (it drank its own element, and pays a gold when matched) burns brighter: its
 * element's light runs round its rim and breathes. One texture per element, painted once and
 * shared by every card; the board's floor warmup uploads them so none is painted mid-floor.
 */
const W = 320;
const H = Math.round(W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));
const INSET = 10;
const RADIUS = 22;

type Rng = () => number;

const clipCard = (ctx: CanvasRenderingContext2D): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(INSET, INSET, W - INSET * 2, H - INSET * 2, RADIUS);
    else ctx.rect(INSET, INSET, W - INSET * 2, H - INSET * 2);
    ctx.clip();
};

const fillGradient = (ctx: CanvasRenderingContext2D, stops: readonly [number, string][]): void => {
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
};

const crackPath = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, a: number, steps: number, len: number): void => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s += 1) {
        a += (rng() - 0.5) * 1.2;
        x += Math.cos(a) * len * (0.6 + rng() * 0.8);
        y += Math.sin(a) * len * (0.6 + rng() * 0.8);
        ctx.lineTo(x, y);
    }
};

const PAINTERS: Readonly<Record<TileSuit, (ctx: CanvasRenderingContext2D, rng: Rng) => void>> = {
    ember: (ctx, rng) => {
        // Char, darkest at the top, heat rising from the foot.
        fillGradient(ctx, [[0, '#1a0703'], [0.55, '#2e0d04'], [1, '#5a1a05']]);
        // Molten veins: a dark seam with a hot core.
        for (let i = 0; i < 14; i += 1) {
            crackPath(ctx, rng, rng() * W, rng() * H, rng() * Math.PI * 2, 4 + Math.floor(rng() * 4), 22);
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255, 90, 20, 0.35)';
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 186, 80, 0.95)';
            ctx.lineWidth = 2.6;
            ctx.stroke();
        }
        // Flames licking up from the foot: overlapping tongues, red behind, white-hot in front.
        const layers: Array<[string, string, number, number]> = [
            ['rgba(190, 40, 10, 0.95)', 'rgba(255, 110, 30, 0)', 0.62, 9],
            ['rgba(255, 120, 25, 0.95)', 'rgba(255, 180, 60, 0)', 0.46, 8],
            ['rgba(255, 220, 120, 0.95)', 'rgba(255, 250, 210, 0)', 0.3, 7]
        ];
        for (const [base, tip, height, count] of layers) {
            ctx.save();
            ctx.shadowColor = base;
            ctx.shadowBlur = 14;
            for (let t = 0; t < count; t += 1) {
                const cx = ((t + 0.5) / count) * W + (rng() - 0.5) * (W / count) * 0.8;
                const half = (W / count) * (0.55 + rng() * 0.35);
                const top = H * (1 - height * (0.65 + rng() * 0.45));
                const lean = (rng() - 0.5) * half * 0.9;
                const g = ctx.createLinearGradient(0, H, 0, top);
                g.addColorStop(0, base);
                g.addColorStop(0.75, base);
                g.addColorStop(1, tip);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(cx - half, H + 4);
                ctx.bezierCurveTo(cx - half * 1.05, H - (H - top) * 0.45, cx + lean - half * 0.35, top + (H - top) * 0.2, cx + lean, top);
                ctx.bezierCurveTo(cx + lean + half * 0.35, top + (H - top) * 0.2, cx + half * 1.05, H - (H - top) * 0.45, cx + half, H + 4);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        // Sparks in the air.
        for (let i = 0; i < 40; i += 1) {
            ctx.fillStyle = `rgba(255, ${150 + Math.floor(rng() * 100)}, 60, ${0.5 + rng() * 0.5})`;
            ctx.beginPath();
            ctx.arc(rng() * W, rng() * H * 0.75, 1 + rng() * 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    tide: (ctx, rng) => {
        fillGradient(ctx, [[0, '#0d4f8f'], [0.5, '#0a3768'], [1, '#04203f']]);
        // The caustic web: light pooled where waves cross.
        ctx.lineCap = 'round';
        for (let i = 0; i < 70; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            const r = 10 + rng() * 22;
            ctx.strokeStyle = `rgba(150, 225, 255, ${0.18 + rng() * 0.3})`;
            ctx.lineWidth = 1.2 + rng() * 2.2;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * (0.55 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Long swells across the card.
        for (let i = 0; i < 7; i += 1) {
            const y0 = (i + 0.6) * (H / 7);
            const amp = 6 + rng() * 6;
            const ph = rng() * Math.PI * 2;
            ctx.strokeStyle = 'rgba(210, 245, 255, 0.55)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 6) {
                const y = y0 + Math.sin(x * 0.045 + ph) * amp;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        // Bubbles rising.
        for (let i = 0; i < 26; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            const r = 2 + rng() * 6;
            ctx.strokeStyle = 'rgba(235, 250, 255, 0.85)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.8, r * 0.25), 0, Math.PI * 2);
            ctx.fill();
        }
        // The surface sheen.
        const sheen = ctx.createLinearGradient(0, 0, W, H * 0.5);
        sheen.addColorStop(0, 'rgba(190, 240, 255, 0.35)');
        sheen.addColorStop(0.4, 'rgba(190, 240, 255, 0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, W, H);
    },
    bone: (ctx, rng) => {
        fillGradient(ctx, [[0, '#e9f7ff'], [0.5, '#b4def5'], [1, '#7fb6dc']]);
        // Facets: shards of ice, each lit on one side.
        for (let i = 0; i < 26; i += 1) {
            const cx = rng() * W;
            const cy = rng() * H;
            const r = 24 + rng() * 40;
            const sides = 4 + Math.floor(rng() * 3);
            const a0 = rng() * Math.PI;
            ctx.beginPath();
            for (let s = 0; s < sides; s += 1) {
                const a = a0 + (s / sides) * Math.PI * 2;
                const rr = r * (0.6 + rng() * 0.5);
                const x = cx + Math.cos(a) * rr;
                const y = cy + Math.sin(a) * rr * 1.3;
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = rng() < 0.5 ? `rgba(255, 255, 255, ${0.12 + rng() * 0.25})` : `rgba(70, 140, 200, ${0.08 + rng() * 0.18})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }
        // Rime feathering in from every edge.
        ctx.lineCap = 'round';
        const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
            if (depth <= 0) return;
            const x2 = x + Math.cos(a) * len;
            const y2 = y + Math.sin(a) * len;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + depth * 0.15})`;
            ctx.lineWidth = depth;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            branch(x2, y2, a + 0.55, len * 0.62, depth - 1);
            branch(x2, y2, a - 0.55, len * 0.62, depth - 1);
        };
        for (let i = 0; i < 16; i += 1) {
            const edge = Math.floor(rng() * 4);
            const t = rng();
            const [x, y, a] = edge === 0 ? [t * W, 0, Math.PI / 2] : edge === 1 ? [W, t * H, Math.PI] : edge === 2 ? [t * W, H, -Math.PI / 2] : [0, t * H, 0];
            branch(x, y, a + (rng() - 0.5) * 0.6, 22 + rng() * 22, 3);
        }
        // Glints.
        for (let i = 0; i < 18; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            const r = 3 + rng() * 5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x - r, y);
            ctx.lineTo(x + r, y);
            ctx.moveTo(x, y - r);
            ctx.lineTo(x, y + r);
            ctx.stroke();
        }
    },
    moss: (ctx, rng) => {
        fillGradient(ctx, [[0, '#2d6a1f'], [0.5, '#1f4d16'], [1, '#12300c']]);
        // Moss: a carpet of small clumps, lighter on top.
        for (let i = 0; i < 260; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            ctx.fillStyle = `rgba(${60 + Math.floor(rng() * 70)}, ${120 + Math.floor(rng() * 90)}, ${30 + Math.floor(rng() * 40)}, ${0.35 + rng() * 0.45})`;
            ctx.beginPath();
            ctx.arc(x, y, 2 + rng() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
        // A vine winding up the card.
        ctx.strokeStyle = 'rgba(40, 90, 25, 0.95)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(W * 0.15, H);
        ctx.bezierCurveTo(W * 0.9, H * 0.75, W * 0.05, H * 0.45, W * 0.75, H * 0.2);
        ctx.bezierCurveTo(W * 0.95, H * 0.1, W * 0.6, 0, W * 0.4, 0);
        ctx.stroke();
        // Leaves, veined.
        for (let i = 0; i < 22; i += 1) {
            ctx.save();
            ctx.translate(rng() * W, rng() * H);
            ctx.rotate(rng() * Math.PI * 2);
            const len = 9 + rng() * 9;
            ctx.fillStyle = `rgba(${130 + Math.floor(rng() * 60)}, ${200 + Math.floor(rng() * 40)}, ${70 + Math.floor(rng() * 40)}, 0.95)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, len * 0.45, len, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(40, 90, 25, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0, -len);
            ctx.lineTo(0, len);
            ctx.stroke();
            ctx.restore();
        }
        // A few small flowers.
        for (let i = 0; i < 5; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            ctx.fillStyle = 'rgba(250, 240, 170, 0.95)';
            for (let p = 0; p < 5; p += 1) {
                const a = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(230, 150, 40, 1)';
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

/** The rune, carved low on the material: dark cut with a lit edge, so it reads on any element. */
const RUNE_INK: Readonly<Record<TileSuit, { cut: string; edge: string }>> = {
    ember: { cut: 'rgba(30, 6, 0, 0.9)', edge: 'rgba(255, 210, 120, 1)' },
    tide: { cut: 'rgba(2, 20, 40, 0.85)', edge: 'rgba(200, 245, 255, 1)' },
    bone: { cut: 'rgba(30, 70, 110, 0.85)', edge: 'rgba(255, 255, 255, 1)' },
    moss: { cut: 'rgba(10, 30, 6, 0.85)', edge: 'rgba(220, 250, 150, 1)' }
};

const paintElement = (canvas: HTMLCanvasElement, suit: TileSuit): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    clipCard(ctx);
    PAINTERS[suit](ctx, createMulberry32(suit.length * 104729 + suit.charCodeAt(0)));
    // Darken the edge a little so the card keeps its shape on the board.
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // The rune, carved.
    const ink = RUNE_INK[suit];
    const { rune } = getTileSuit(suit);
    ctx.font = 'bold 96px system-ui, "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink.edge;
    ctx.strokeText(rune, W / 2, H * 0.76);
    ctx.fillStyle = ink.cut;
    ctx.fillText(rune, W / 2, H * 0.76);
    ctx.restore();
};

/** The empowered rim: the element's light round the card, and motes of it inside. */
const EMPOWERED_LIGHT: Readonly<Record<TileSuit, string>> = {
    ember: '255, 170, 60',
    tide: '120, 220, 255',
    bone: '90, 200, 255',
    moss: '170, 255, 110'
};

const paintEmpowered = (canvas: HTMLCanvasElement, suit: TileSuit): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const light = EMPOWERED_LIGHT[suit];
    ctx.clearRect(0, 0, W, H);
    // The plane is drawn larger than the card, so the light spills past its edge (`GLOW_SPILL`).
    const m = (W * (GLOW_SPILL - 1)) / (2 * GLOW_SPILL) + INSET / GLOW_SPILL;
    const mh = (H * (GLOW_SPILL - 1)) / (2 * GLOW_SPILL) + INSET / GLOW_SPILL;
    for (const [width, alpha] of [[40, 0.22], [24, 0.45], [12, 0.8], [5, 1]] as const) {
        ctx.strokeStyle = `rgba(${light}, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(m, mh, W - m * 2, H - mh * 2, RADIUS);
        else ctx.rect(m, mh, W - m * 2, H - mh * 2);
        ctx.stroke();
    }
    const rng = createMulberry32(suit.length * 7 + 991);
    for (let i = 0; i < 30; i += 1) {
        const x = INSET + rng() * (W - INSET * 2);
        const y = INSET + rng() * (H - INSET * 2);
        const r = 3 + rng() * 7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        g.addColorStop(0, `rgba(${light}, 0.95)`);
        g.addColorStop(1, `rgba(${light}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();
    }
};

/** How much larger than the card the empowered glow is drawn. */
const GLOW_SPILL = 1.12;

const textureCache = new Map<string, CanvasTexture>();

const elementTexture = (suit: TileSuit, empowered: boolean): CanvasTexture => {
    const key = `${suit}:${empowered ? 'e' : 'b'}`;
    const cached = textureCache.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    if (empowered) paintEmpowered(canvas, suit);
    else paintElement(canvas, suit);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    textureCache.set(key, texture);
    return texture;
};

/** Paint every element's back and glow before play (the board's floor warmup calls it). */
export const prewarmElementCardTextures = (upload?: (texture: CanvasTexture) => void): void => {
    for (const suit of TILE_SUITS) {
        upload?.(elementTexture(suit, false));
        upload?.(elementTexture(suit, true));
    }
};

const EmpoweredGlow = ({ suit, reduceMotion }: { suit: TileSuit; reduceMotion: boolean }): ReactElement => {
    const material = useRef<MeshBasicMaterial | null>(null);
    useFrame(({ clock }) => {
        if (!material.current) return;
        material.current.opacity = reduceMotion ? 0.95 : 0.7 + 0.3 * Math.sin(clock.elapsedTime * 3.2);
    });
    return (
        <mesh position={[0, 0, 0.0505]} raycast={noopMeshRaycast} renderOrder={10}>
            <planeGeometry args={[CARD_PLANE_WIDTH * GLOW_SPILL, CARD_PLANE_HEIGHT * GLOW_SPILL]} />
            <meshBasicMaterial
                blending={AdditiveBlending}
                depthTest
                depthWrite={false}
                map={elementTexture(suit, true)}
                opacity={0.85}
                ref={material}
                side={DoubleSide}
                toneMapped={false}
                transparent
            />
        </mesh>
    );
};

/** The card's back, made of its element; brighter while it is empowered. */
export const ElementCardBack = ({
    faceZ,
    suit,
    empowered,
    reduceMotion
}: {
    faceZ: number;
    suit: TileSuit;
    empowered: boolean;
    reduceMotion: boolean;
}): ReactElement => (
    <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0, 0.05]} raycast={noopMeshRaycast} renderOrder={10}>
            <planeGeometry args={[CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT]} />
            <meshBasicMaterial
                depthTest
                depthWrite={false}
                map={elementTexture(suit, false)}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
                side={DoubleSide}
                toneMapped={false}
                transparent
            />
        </mesh>
        {empowered ? <EmpoweredGlow reduceMotion={reduceMotion} suit={suit} /> : null}
    </group>
);
