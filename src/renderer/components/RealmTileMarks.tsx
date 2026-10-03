import { useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import type { Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { realmTileMarkKey, type RealmTileMark } from './realmTileMarkKey';

/** Tiny factual badges, never painted coatings. Status motion is emitted by the
 * shared particle pool. These counters remain readable with reduced motion. */
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
