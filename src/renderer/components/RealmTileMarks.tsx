import { useMemo, type ReactElement } from 'react';
import { DoubleSide } from 'three';
import type { Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { cardStatusMark, type RealmTileMark } from './realmTileMarkKey';
import { realmTileMarkTexture } from './realmTileMarkTextures';

const MarkPlane = ({ mark, z, faceUp }: { mark: RealmTileMark; z: number; faceUp: boolean }): ReactElement => {
    const texture = useMemo(() => realmTileMarkTexture(mark, faceUp), [mark, faceUp]);
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