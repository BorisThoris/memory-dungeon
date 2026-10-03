import { useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { getTileSuit, TILE_SUITS } from '../../shared/tile-suit-rules';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/** Clean card bodies and a persistent rune. Fire, water, ice and growth move
 * through the shared particle pool, never as painted-on effects. */
const W = 320;
const H = Math.round(W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));
const INSET = 10;
const RADIUS = 22;

const clipCard = (ctx: CanvasRenderingContext2D): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(INSET, INSET, W - INSET * 2, H - INSET * 2, RADIUS);
    else ctx.rect(INSET, INSET, W - INSET * 2, H - INSET * 2);
    ctx.clip();
};
const BASE: Record<TileSuit, string> = { ember: '#291b18', tide: '#152734', bone: '#34444c', moss: '#1d2b20' };

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
    ctx.fillStyle = BASE[suit];
    ctx.fillRect(0, 0, W, H);
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
    ctx.strokeText(rune, W / 2, H * 0.52);
    ctx.fillStyle = ink.cut;
    ctx.fillText(rune, W / 2, H * 0.52);
    ctx.restore();
};

/** A quiet charge outline; the shared pool supplies the moving motes. */
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
// eslint-disable-next-line react-refresh/only-export-components -- GPU warmup must upload the same cached textures used below.
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
