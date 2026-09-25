import { useMemo, type ReactElement } from 'react';
import { DoubleSide } from 'three';
import { badgeTexture } from './pairProximityBadges';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

export const PairProximityHintPlane = ({ distance, faceZ }: { distance: number; faceZ: number }): ReactElement => {
    const texture = useMemo(() => badgeTexture(distance), [distance]);

    const z = faceZ + 0.028;
    const x = CARD_PLANE_WIDTH * 0.5 - 0.095;
    const y = CARD_PLANE_HEIGHT * 0.5 - 0.095;

    return (
        <mesh position={[x, y, z]} raycast={noopMeshRaycast} renderOrder={12}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshBasicMaterial
                depthTest
                depthWrite={false}
                map={texture}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
                side={DoubleSide}
                toneMapped={false}
                transparent
            />
        </mesh>
    );
};
