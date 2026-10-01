import { useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import type { RealmId, Tile } from '../../shared/contracts';
import { REALMS } from '../../shared/realm-rules';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { realmTileMarkKey, type RealmTileMark } from './realmTileMarkKey';

/**
 * What a realm has done to a card, drawn on it (`realm-weather-rules.ts`): ice over a frozen card
 * with the turns it has left, snow over a back whose suit a blizzard buried, a flame and its fuse
 * on a burning card, vines over a held one, and an omen's sigil on both halves of the omen pair.
 *
 * One canvas per combination of marks, shared by every card that shows it, so a board of frozen
 * cards paints the ice once. Painted, not modelled: the marks have to read at a glance on a phone,
 * the way the suit does, and a number on the ice says more than any shader could.
 */
const CANVAS_W = 256;
const CANVAS_H = Math.round(CANVAS_W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));

const RUNES: Readonly<Record<RealmId, string>> = {
    frost: '❄',
    ember: '▲',
    tide: '≈',
    storm: 'ϟ',
    grove: '♣'
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
};

const paint = (canvas: HTMLCanvasElement, mark: RealmTileMark): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (mark.vined) {
        ctx.strokeStyle = 'rgba(70, 140, 50, 0.95)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 16;
        for (const [x0, y0, x1, y1, cx, cy] of [
            [0, h * 0.15, w, h * 0.55, w * 0.4, h * 0.05],
            [w, h * 0.3, 0, h * 0.85, w * 0.7, h * 0.75],
            [w * 0.2, h, w * 0.85, 0, w * 0.1, h * 0.4]
        ] as const) {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cx, cy, x1, y1);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(140, 214, 90, 0.95)';
        for (const [x, y] of [[0.3, 0.2], [0.7, 0.45], [0.25, 0.65], [0.6, 0.8], [0.5, 0.33]] as const) {
            ctx.beginPath();
            ctx.ellipse(x * w, y * h, 16, 9, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (mark.frost > 0) {
        ctx.fillStyle = 'rgba(170, 222, 255, 0.62)';
        roundRect(ctx, 6, 6, w - 12, h - 12, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.lineWidth = 3;
        for (const [x0, y0, x1, y1] of [[0.1, 0.2, 0.45, 0.5], [0.9, 0.15, 0.55, 0.42], [0.15, 0.85, 0.5, 0.6], [0.88, 0.8, 0.6, 0.62]] as const) {
            ctx.beginPath();
            ctx.moveTo(x0 * w, y0 * h);
            ctx.lineTo(x1 * w, y1 * h);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(16, 40, 64, 0.92)';
        ctx.font = 'bold 150px system-ui, "Segoe UI", sans-serif';
        ctx.fillText(String(mark.frost), w / 2, h * 0.5);
    }

    if (mark.snowed) {
        // A drift over the lower third, where the suit is painted: the suit cannot be read.
        ctx.fillStyle = 'rgba(246, 250, 255, 0.97)';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.58);
        for (let i = 0; i <= 6; i += 1) {
            const x = (w * i) / 6;
            ctx.quadraticCurveTo(x - w / 12, h * (0.5 + (i % 2) * 0.06), x, h * 0.56);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(150, 180, 210, 0.9)';
        ctx.font = 'bold 54px system-ui, "Segoe UI", sans-serif';
        ctx.fillText('?', w / 2, h * 0.8);
    }

    if (mark.fuse > 0) {
        // The burning card: a hot rim and a flame with the turns left on its fuse.
        ctx.strokeStyle = 'rgba(255, 110, 40, 0.98)';
        ctx.lineWidth = 14;
        roundRect(ctx, 8, 8, w - 16, h - 16, 22);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 150, 50, 0.95)';
        ctx.beginPath();
        const cx = w / 2;
        const top = h * 0.12;
        ctx.moveTo(cx, top);
        ctx.bezierCurveTo(cx + 70, h * 0.3, cx + 60, h * 0.46, cx, h * 0.5);
        ctx.bezierCurveTo(cx - 60, h * 0.46, cx - 70, h * 0.3, cx, top);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 230, 120, 0.95)';
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.38, 26, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 12, 4, 0.95)';
        ctx.font = 'bold 72px system-ui, "Segoe UI", sans-serif';
        ctx.fillText(String(mark.fuse), cx, h * 0.38);
    }

    if (mark.omen) {
        // The omen's sigil, in its realm's colour, in a disc at the top corner: an environment card.
        const color = REALMS[mark.omen].color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        roundRect(ctx, 4, 4, w - 8, h - 8, 24);
        ctx.stroke();
        const r = 42;
        const x = w - r - 12;
        const y = r + 12;
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 52px system-ui, "Segoe UI Symbol", sans-serif';
        ctx.fillText(RUNES[mark.omen], x, y + 3);
    }
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
 * The marks for one card. The back shows everything the realm did to a hidden card; the face shows
 * only the omen, since a card face up is neither frozen, held nor burning any more.
 */
export const RealmTileMarks = ({ faceZ, tile, faceUp }: { faceZ: number; tile: Tile; faceUp: boolean }): ReactElement | null => {
    const back = useMemo<RealmTileMark | null>(() => {
        if (tile.state !== 'hidden') return null;
        const mark: RealmTileMark = {
            frost: Math.max(0, Math.floor(tile.frost ?? 0)),
            snowed: tile.snowed === true,
            fuse: Math.max(0, Math.floor(tile.fuse ?? 0)),
            vined: tile.vined === true,
            omen: tile.omen ?? null
        };
        return mark.frost || mark.snowed || mark.fuse || mark.vined || mark.omen ? mark : null;
    }, [tile.state, tile.frost, tile.snowed, tile.fuse, tile.vined, tile.omen]);
    const front = useMemo<RealmTileMark | null>(
        () => (tile.omen && tile.state !== 'removed' ? { frost: 0, snowed: false, fuse: 0, vined: false, omen: tile.omen } : null),
        [tile.omen, tile.state]
    );
    if (!back && !front) return null;
    return (
        <>
            {back && !faceUp ? (
                <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
                    <MarkPlane mark={back} z={0.056} />
                </group>
            ) : null}
            {front && faceUp ? (
                <group position={[0, 0, faceZ]}>
                    <MarkPlane mark={front} z={0.0009} />
                </group>
            ) : null}
        </>
    );
};
