import { useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { cardStatusMark, realmTileMarkKey, type RealmTileMark } from './realmTileMarkKey';
import { paintCardStatus } from './cardStatusPaint';

const CANVAS_W = 256;
const CANVAS_H = Math.round(CANVAS_W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));

const textures = new Map<string, CanvasTexture>();

const textureFor = (mark: RealmTileMark, faceUp: boolean): CanvasTexture => {
    const key = `${realmTileMarkKey(mark)}:${faceUp ? 'front' : 'back'}`;
    const cached = textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const context = canvas.getContext('2d');
    if (context) paintCardStatus(context, canvas.width, canvas.height, mark, faceUp);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    // Mipmapped: a tilted or distant card shrinks this, and without mips it shimmers.
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    textures.set(key, texture);
    return texture;
};

const MarkPlane = ({ mark, z, faceUp }: { mark: RealmTileMark; z: number; faceUp: boolean }): ReactElement => {
    const texture = useMemo(() => textureFor(mark, faceUp), [mark, faceUp]);
    return (
        <mesh position={[0, 0, z]} raycast={noopMeshRaycast} renderOrder={30}>
            <planeGeometry args={[CARD_PLANE_WIDTH * 1.08, CARD_PLANE_HEIGHT * 1.04]} />
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

/** Persistent state survives study and peeks: a revealed hidden card can still be locked. */
export const RealmTileMarks = ({ faceZ, tile, faceUp, openingLocked = false }: {
    faceZ: number; tile: Tile; faceUp: boolean; openingLocked?: boolean;
}): ReactElement | null => {
    const mark = useMemo(() => cardStatusMark(tile, openingLocked), [tile, openingLocked]);
    if (!mark) return null;
    return (
        <group position={[0, 0, faceUp ? faceZ : -faceZ]} rotation={[0, faceUp ? 0 : Math.PI, 0]}>
            <MarkPlane mark={mark} faceUp={faceUp} z={0.075} />
        </group>
    );
};