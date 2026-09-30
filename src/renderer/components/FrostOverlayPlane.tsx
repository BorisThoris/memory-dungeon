import type { ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import { createMulberry32 } from '../../shared/rng';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * Ice on a frozen card's back (`world-reaction-rules.ts`): a cold pane over the whole back, frost
 * crystals feathering in from the edges, a bright rim, so a frozen card reads as frozen from across
 * the board rather than as one more tint. One texture, painted once and shared by every frozen card.
 */
const paintFrost = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const rng = createMulberry32(0xf207);
    ctx.clearRect(0, 0, w, h);
    // The pane: pale and cold, thicker at the edges.
    const pane = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.7);
    pane.addColorStop(0, 'rgba(200, 235, 255, 0.28)');
    pane.addColorStop(0.7, 'rgba(170, 220, 255, 0.5)');
    pane.addColorStop(1, 'rgba(235, 248, 255, 0.85)');
    ctx.fillStyle = pane;
    ctx.fillRect(0, 0, w, h);
    // Frost crystals: branching strokes feathering in from the four edges.
    ctx.lineCap = 'round';
    const branch = (x: number, y: number, angle: number, length: number, depth: number): void => {
        if (depth <= 0 || length < 4) return;
        const x2 = x + Math.cos(angle) * length;
        const y2 = y + Math.sin(angle) * length;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + depth * 0.12})`;
        ctx.lineWidth = Math.max(1, depth * 0.9);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        branch(x2, y2, angle + 0.55 + rng() * 0.3, length * 0.62, depth - 1);
        branch(x2, y2, angle - 0.55 - rng() * 0.3, length * 0.62, depth - 1);
        if (rng() < 0.5) branch(x2, y2, angle + (rng() - 0.5) * 0.3, length * 0.7, depth - 1);
    };
    for (let index = 0; index < 22; index += 1) {
        const edge = index % 4;
        const t = rng();
        const [x, y, angle] =
            edge === 0 ? [t * w, 0, Math.PI / 2] : edge === 1 ? [w, t * h, Math.PI] : edge === 2 ? [t * w, h, -Math.PI / 2] : [0, t * h, 0];
        branch(x, y, angle + (rng() - 0.5) * 0.8, 26 + rng() * 34, 4);
    }
    // The rim: a hard bright edge, the ice's lip.
    ctx.strokeStyle = 'rgba(245, 252, 255, 0.95)';
    ctx.lineWidth = 7;
    ctx.strokeRect(3.5, 3.5, w - 7, h - 7);
    ctx.strokeStyle = 'rgba(140, 205, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
};

let frostTexture: CanvasTexture | null = null;

const sharedFrostTexture = (): CanvasTexture => {
    if (frostTexture) return frostTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 360;
    paintFrost(canvas);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    frostTexture = texture;
    return texture;
};

export const FrostOverlayPlane = ({ faceZ }: { faceZ: number }): ReactElement => (
    <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0, 0.06]} raycast={noopMeshRaycast} renderOrder={11}>
            <planeGeometry args={[CARD_PLANE_WIDTH * 1.02, CARD_PLANE_HEIGHT * 1.02]} />
            <meshBasicMaterial depthTest depthWrite={false} map={sharedFrostTexture()} side={DoubleSide} toneMapped={false} transparent />
        </mesh>
    </group>
);
