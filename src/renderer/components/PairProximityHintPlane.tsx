import { useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type Mesh } from 'three';
import { badgeTexture } from './pairProximityBadges';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { useAppStore } from '../store/useAppStore';

/** The badge's size on the card, and how long its pop-in lasts. */
export const PAIR_HINT_SIZE = 0.3;
export const PAIR_HINT_POP_MS = 420;

/**
 * Steps to the flipped card's partner, in the card's top-right corner (`pairProximityBadges.ts`).
 * It pops in over-size and settles, then breathes a little, so the eye goes to it the moment the
 * card turns; a player who asked for reduced motion gets it settled and still.
 */
export const PairProximityHintPlane = ({ distance, faceZ }: { distance: number; faceZ: number }): ReactElement => {
    const texture = useMemo(() => badgeTexture(distance), [distance]);
    const savedReduceMotion = useAppStore((state) => state.settings.reduceMotion);
    const reduceMotion = useEffectiveReducedMotion(savedReduceMotion);
    const mesh = useRef<Mesh | null>(null);
    const shownAt = useRef<number | null>(null);

    useFrame(({ clock }) => {
        const node = mesh.current;
        if (!node) return;
        if (reduceMotion) {
            node.scale.setScalar(1);
            return;
        }
        const now = clock.elapsedTime * 1000;
        if (shownAt.current === null) shownAt.current = now;
        const t = Math.min(1, (now - shownAt.current) / PAIR_HINT_POP_MS);
        // Overshoot to 1.25 and settle; then a slow breath.
        const pop = t < 1 ? 0.55 + 0.7 * Math.sin(t * Math.PI * 0.75) : 1 + 0.06 * Math.sin((now - shownAt.current) / 260);
        node.scale.setScalar(Math.max(0.55, pop));
    });

    const z = faceZ + 0.03;
    const x = CARD_PLANE_WIDTH * 0.5 - PAIR_HINT_SIZE * 0.42;
    const y = CARD_PLANE_HEIGHT * 0.5 - PAIR_HINT_SIZE * 0.42;

    return (
        <mesh position={[x, y, z]} raycast={noopMeshRaycast} ref={mesh} renderOrder={19}>
            <planeGeometry args={[PAIR_HINT_SIZE, PAIR_HINT_SIZE]} />
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
