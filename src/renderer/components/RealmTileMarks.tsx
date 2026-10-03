import { useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import type { Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { realmTileMarkKey, type RealmTileMark } from './realmTileMarkKey';

/** Persistent edge silhouettes make holds readable between bursts. The center stays clear;
 * counters and shapes also work with reduced motion and without relying on color. */
const CANVAS_W = 256;
const CANVAS_H = Math.round(CANVAS_W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
};

const paint = (canvas: HTMLCanvasElement, mark: RealmTileMark): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (mark.frost > 0 || mark.rime) {
        // Ice grips the edges, leaving the central elemental rune readable.
        ctx.fillStyle = mark.frost ? '#b4e4fb80' : '#b4e4fb45';
        ctx.strokeStyle = '#e0f5ffe0';
        ctx.lineWidth = 2;
        for (const side of [0, 1]) {
            ctx.save();
            if (side) { ctx.translate(w, h); ctx.rotate(Math.PI); }
            ctx.beginPath();
            ctx.moveTo(7, 60); ctx.lineTo(28, 82); ctx.lineTo(15, 115); ctx.lineTo(38, 152);
            ctx.lineTo(20, 178); ctx.lineTo(30, 216); ctx.lineTo(7, 252); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, 130); ctx.lineTo(28, 151); ctx.lineTo(14, 174); ctx.stroke();
            ctx.restore();
        }
    }
    if (mark.vined || mark.seeded) {
        const vine = mark.vined;
        ctx.strokeStyle = '#b1cf76';
        ctx.lineWidth = vine ? 7 : 4;
        ctx.beginPath();
        ctx.moveTo(8, h - 16);
        ctx.bezierCurveTo(52, h - 72, w - 70, h - 3, w - 12, h - 68);
        if (vine) ctx.bezierCurveTo(w - 42, h * 0.57, w + 3, h * 0.44, w - 18, 76);
        ctx.stroke();
        if (vine) {
            // Two broad bindings cross the back: this is a lock, not a harvest sprout.
            ctx.strokeStyle = '#87b95bea'; ctx.lineWidth = 9;
            for (const y of [h * 0.34, h * 0.68]) {
                ctx.beginPath(); ctx.moveTo(4, y); ctx.bezierCurveTo(w * 0.3, y - 24, w * 0.68, y + 25, w - 4, y); ctx.stroke();
            }
            ctx.strokeStyle = '#456e37'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(15, h - 45); ctx.bezierCurveTo(45, h * 0.65, -3, h * 0.42, 25, 72); ctx.stroke();
        }
        ctx.fillStyle = '#82be55';
        for (const [x, y, angle] of [[36, h - 43, -0.6], [w - 38, h - 54, 0.6], ...(vine ? [[20, h * 0.54, -0.8], [w - 21, h * 0.49, 0.7]] : [])]) {
            ctx.save(); ctx.translate(x!, y!); ctx.rotate(angle!);
            ctx.beginPath(); ctx.ellipse(0, 0, 9, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        if (mark.bloom || mark.seeded === 2) {
            ctx.fillStyle = '#ffe19a';
            for (const x of [43, w - 46]) { ctx.beginPath(); ctx.arc(x, h - 62, 8, 0, Math.PI * 2); ctx.fill(); }
        }
    }
    if (mark.fuse > 0) {
        // Persistent flame tongues remain obvious with motion and combo pops disabled.
        for (const side of [0, 1]) {
            ctx.save();
            if (side) { ctx.translate(w, 0); ctx.scale(-1, 1); }
            ctx.fillStyle = '#ef762abb';
            ctx.beginPath(); ctx.moveTo(6, h - 70); ctx.bezierCurveTo(44, h - 115, 4, h - 150, 34, h - 200);
            ctx.bezierCurveTo(27, h - 156, 75, h - 129, 47, h - 83); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffd37acc';
            ctx.beginPath(); ctx.moveTo(10, h - 79); ctx.quadraticCurveTo(35, h - 106, 29, h - 141); ctx.quadraticCurveTo(60, h - 100, 10, h - 79); ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = '#ff914ccc'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(8, 80); ctx.lineTo(15, 118); ctx.lineTo(9, 157); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w - 9, 96); ctx.lineTo(w - 22, 126); ctx.lineTo(w - 9, 175); ctx.stroke();
        ctx.fillStyle = '#ffbb68';
        for (const y of [100, 153, 205]) { ctx.beginPath(); ctx.arc(w - 13, y, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    if (mark.snowed) {
        // Conceal identity even when all motion is disabled.
        ctx.fillStyle = '#23313c';
        roundRect(ctx, 5, 5, w - 10, h - 10, 18);
        ctx.fill();
        ctx.fillStyle = '#e4f3ff';
        ctx.font = 'bold 96px system-ui, sans-serif';
        ctx.fillText('?', w / 2, h / 2);
    }
    const badge = (label: string, color: string, x: number, y: number): void => {
        ctx.fillStyle = '#10171eee';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        roundRect(ctx, x - 51, y - 28, 102, 56, 12);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.fillText(label, x, y);
    };
    if (mark.frost > 0) badge(`◆ ${mark.frost}`, '#d8f2ff', 62, 42);
    if (mark.fuse > 0) badge(`▲ ${mark.fuse}`, '#ffad67', w - 62, 42);
    if (mark.vined) badge(mark.bloom ? '♣ +3' : '♣ ×', '#a6e67f', mark.rime ? 62 : w / 2, h - 44);
    else if (mark.seeded) badge(`♣ +${mark.seeded}`, '#c0ef96', mark.rime ? 62 : w / 2, h - 44);
    if (mark.rime) badge('◆ +', '#b7e8ff', mark.vined || mark.seeded ? w - 62 : w / 2, h - 44);
};

const textures = new Map<string, CanvasTexture>();

const textureFor = (mark: RealmTileMark): CanvasTexture => {
    const key = realmTileMarkKey(mark);
    const cached = textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    paint(canvas, mark);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    textures.set(key, texture);
    return texture;
};

const MarkPlane = ({ mark, z }: { mark: RealmTileMark; z: number }): ReactElement => {
    const texture = useMemo(() => textureFor(mark), [mark]);
    return (
        <mesh position={[0, 0, z]} raycast={noopMeshRaycast} renderOrder={12}>
            <planeGeometry args={[CARD_PLANE_WIDTH * 0.98, CARD_PLANE_HEIGHT * 0.98]} />
            <meshBasicMaterial
                depthTest
                depthWrite={false}
                map={texture}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                side={DoubleSide}
                toneMapped={false}
                transparent
            />
        </mesh>
    );
};

/**
 * The marks for one card's back: everything the realm did to a hidden card. A card face up is
 * neither frozen, held nor burning any more, so its face carries none.
 */
export const RealmTileMarks = ({ faceZ, tile, faceUp }: { faceZ: number; tile: Tile; faceUp: boolean }): ReactElement | null => {
    const back = useMemo<RealmTileMark | null>(() => {
        if (tile.state !== 'hidden') return null;
        const mark: RealmTileMark = {
            frost: Math.max(0, Math.floor(tile.frost ?? 0)),
            snowed: tile.snowed === true,
            fuse: Math.max(0, Math.floor(tile.fuse ?? 0)),
            vined: tile.vined === true,
            bloom: tile.vined === true && tile.bloom === true,
            rime: tile.rime === true,
            seeded: Math.min(2, Math.max(0, tile.seeded ?? 0))
        };
        return mark.frost || mark.snowed || mark.fuse || mark.vined || mark.rime || mark.seeded ? mark : null;
    }, [tile.state, tile.frost, tile.snowed, tile.fuse, tile.vined, tile.bloom, tile.rime, tile.seeded]);
    if (!back || faceUp) return null;
    return (
        <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
            <MarkPlane mark={back} z={0.056} />
        </group>
    );
};
