import { useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import type { RealmId } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { useRealmAmbience } from './realmAmbience';

/**
 * The realm on every face-down card (2026-10-01). The realm's weather marked only the cards it
 * acted on (`RealmTileMarks`), so a floor in the grove looked like any other floor until the vines
 * struck. Now every back wears the place: rime feathering in from the edges in the frost, charred
 * edges with cracks glowing through in the ember realm, a wet sheen and droplets in the tide, violet
 * static in the storm, moss creeping in from the corners in the grove. One texture per realm,
 * painted once and shared; the fire's cracks and the storm's static breathe.
 */
const W = 256;
const H = 360;

type Painter = (ctx: CanvasRenderingContext2D, rng: () => number) => void;

const edgeVignette = (ctx: CanvasRenderingContext2D, inner: string, outer: string): void => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.68);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
};

const fromEdge = (rng: () => number): [number, number, number] => {
    const edge = Math.floor(rng() * 4);
    const t = rng();
    return edge === 0 ? [t * W, 0, Math.PI / 2] : edge === 1 ? [W, t * H, Math.PI] : edge === 2 ? [t * W, H, -Math.PI / 2] : [0, t * H, 0];
};

const PAINTERS: Record<RealmId, Painter> = {
    frost: (ctx, rng) => {
        edgeVignette(ctx, 'rgba(200, 235, 255, 0)', 'rgba(215, 240, 255, 0.55)');
        ctx.lineCap = 'round';
        const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
            if (depth <= 0) return;
            const x2 = x + Math.cos(a) * len;
            const y2 = y + Math.sin(a) * len;
            ctx.strokeStyle = `rgba(250, 253, 255, ${0.3 + depth * 0.13})`;
            ctx.lineWidth = depth * 0.8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            branch(x2, y2, a + 0.6, len * 0.6, depth - 1);
            branch(x2, y2, a - 0.6, len * 0.6, depth - 1);
        };
        for (let i = 0; i < 18; i += 1) {
            const [x, y, a] = fromEdge(rng);
            branch(x, y, a + (rng() - 0.5) * 0.7, 18 + rng() * 22, 3);
        }
    },
    ember: (ctx, rng) => {
        edgeVignette(ctx, 'rgba(20, 8, 4, 0)', 'rgba(25, 8, 2, 0.8)');
        // Cracks that glow: dark line with a hot core.
        for (let i = 0; i < 9; i += 1) {
            let [x, y, a] = fromEdge(rng);
            ctx.beginPath();
            ctx.moveTo(x, y);
            const steps = 4 + Math.floor(rng() * 4);
            for (let s = 0; s < steps; s += 1) {
                a += (rng() - 0.5) * 1.1;
                x += Math.cos(a) * (14 + rng() * 16);
                y += Math.sin(a) * (14 + rng() * 16);
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(255, 120, 30, 0.35)';
            ctx.lineWidth = 9;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 190, 90, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
        // Embers caught in the char.
        for (let i = 0; i < 26; i += 1) {
            const [x, y] = fromEdge(rng);
            ctx.fillStyle = `rgba(255, ${120 + Math.floor(rng() * 90)}, 40, ${0.5 + rng() * 0.5})`;
            ctx.beginPath();
            ctx.arc(x + (rng() - 0.5) * 30, y + (rng() - 0.5) * 30, 1.5 + rng() * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    tide: (ctx, rng) => {
        const sheen = ctx.createLinearGradient(0, 0, W, H);
        sheen.addColorStop(0, 'rgba(120, 190, 255, 0.35)');
        sheen.addColorStop(0.45, 'rgba(160, 220, 255, 0.08)');
        sheen.addColorStop(0.55, 'rgba(220, 245, 255, 0.4)');
        sheen.addColorStop(1, 'rgba(80, 150, 230, 0.4)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 34; i += 1) {
            const x = rng() * W;
            const y = rng() * H;
            const r = 2 + rng() * 6;
            const drop = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
            drop.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            drop.addColorStop(0.5, 'rgba(170, 220, 255, 0.35)');
            drop.addColorStop(1, 'rgba(60, 120, 200, 0.05)');
            ctx.fillStyle = drop;
            ctx.beginPath();
            ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    storm: (ctx, rng) => {
        edgeVignette(ctx, 'rgba(80, 40, 160, 0)', 'rgba(70, 30, 150, 0.55)');
        for (let i = 0; i < 7; i += 1) {
            let [x, y, a] = fromEdge(rng);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let s = 0; s < 6; s += 1) {
                a += (rng() - 0.5) * 1.6;
                x += Math.cos(a) * (10 + rng() * 14);
                y += Math.sin(a) * (10 + rng() * 14);
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(190, 150, 255, 0.4)';
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(245, 235, 255, 0.95)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }
    },
    grove: (ctx, rng) => {
        edgeVignette(ctx, 'rgba(20, 50, 10, 0)', 'rgba(25, 60, 15, 0.6)');
        // Moss clumps in from the corners, and leaves.
        const corners: Array<[number, number]> = [[0, 0], [W, 0], [0, H], [W, H]];
        for (const [cx, cy] of corners) {
            for (let i = 0; i < 40; i += 1) {
                const d = rng() * 70;
                const a = rng() * Math.PI * 2;
                ctx.fillStyle = `rgba(${70 + Math.floor(rng() * 60)}, ${130 + Math.floor(rng() * 80)}, ${40 + Math.floor(rng() * 30)}, ${0.5 + rng() * 0.4})`;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + rng() * 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        for (let i = 0; i < 12; i += 1) {
            const [x, y] = fromEdge(rng);
            ctx.save();
            ctx.translate(x + (rng() - 0.5) * 40, y + (rng() - 0.5) * 40);
            ctx.rotate(rng() * Math.PI * 2);
            ctx.fillStyle = 'rgba(150, 215, 90, 0.9)';
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

const textures = new Map<RealmId, CanvasTexture>();

const realmTexture = (realm: RealmId): CanvasTexture => {
    const cached = textures.get(realm);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (ctx) PAINTERS[realm](ctx, createMulberry32(realm.length * 7919 + 13));
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    textures.set(realm, texture);
    return texture;
};

/** The breath of the fire and the storm: their marks pulse; the rest hold still. */
const BREATHES: ReadonlySet<RealmId> = new Set(['ember', 'storm']);

export const RealmAmbientBackPlane = ({ faceZ, reduceMotion }: { faceZ: number; reduceMotion: boolean }): ReactElement | null => {
    const realm = useRealmAmbience((state) => state.realm);
    const strength = useRealmAmbience((state) => state.strength);
    const material = useRef<MeshBasicMaterial | null>(null);
    useFrame(({ clock }) => {
        if (!material.current || !realm) return;
        const base = 0.55 + 0.45 * strength;
        material.current.opacity = BREATHES.has(realm) && !reduceMotion ? base * (0.78 + 0.22 * Math.sin(clock.elapsedTime * (realm === 'storm' ? 9 : 2.4))) : base;
    });
    if (!realm) return null;
    return (
        <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
            <mesh position={[0, 0, 0.052]} raycast={noopMeshRaycast} renderOrder={11}>
                <planeGeometry args={[CARD_PLANE_WIDTH * 1.01, CARD_PLANE_HEIGHT * 1.01]} />
                <meshBasicMaterial depthTest depthWrite={false} map={realmTexture(realm)} opacity={0.55 + 0.45 * strength} ref={material} side={DoubleSide} toneMapped={false} transparent />
            </mesh>
        </group>
    );
};
