import { useFrame } from '@react-three/fiber';
import { useMemo, type MutableRefObject } from 'react';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import type { BoardState } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { heldSeedCells, holdSeedGlow } from './spiralSealLayout';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * The Hold's seeds (`hold-rules.ts`, DGE-008/030): a held pair leaves the board like any match, so
 * each of its cells keeps a gold ember outline and a small gold diamond until the release takes it.
 * The outline breathes, brighter the more pairs are held; with reduced motion it holds still. It
 * sits behind the cards and is never picked.
 */
const SEED_GOLD = '#ffcf6a';
const SEED_EMBER = '#d9792e';
/** One Hold at a time, so one set of materials: the breath writes their opacity each frame. */
const SEED_MATERIALS = {
    rim: new MeshBasicMaterial({ color: SEED_EMBER, transparent: true, depthWrite: false }),
    hole: new MeshBasicMaterial({ color: '#140d08', transparent: true, opacity: 0.85, depthWrite: false }),
    seed: new MeshBasicMaterial({ color: SEED_GOLD, transparent: true, depthWrite: false })
};

export function HoldSeeds({ board, heldSeedIds, compact, reduceMotion, time }: {
    board: Pick<BoardState, 'tiles' | 'columns' | 'rows'>;
    heldSeedIds: readonly string[];
    compact: boolean;
    reduceMotion: boolean;
    time: MutableRefObject<number>;
}) {
    const cells = useMemo(() => heldSeedCells(board, heldSeedIds, compact, reduceMotion), [board, heldSeedIds, compact, reduceMotion]);
    const rimGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.96, CARD_PLANE_HEIGHT * 0.96), []);
    const holeGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.86, CARD_PLANE_HEIGHT * 0.88), []);
    const seedGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.22, CARD_PLANE_WIDTH * 0.22), []);
    const heldPairs = Math.floor(heldSeedIds.length / 2);
    useFrame(() => {
        const glow = holdSeedGlow(time.current, heldPairs, reduceMotion);
        SEED_MATERIALS.rim.opacity = glow;
        SEED_MATERIALS.seed.opacity = Math.min(1, glow + 0.15);
    });
    if (cells.length === 0) return null;
    return (
        <group name="hold-seeds">
            {cells.map(({ index, x, y }) => (
                <group key={index} position={[x, y, -0.02]}>
                    <mesh geometry={rimGeometry} material={SEED_MATERIALS.rim} raycast={noopMeshRaycast} renderOrder={-12} />
                    <mesh geometry={holeGeometry} material={SEED_MATERIALS.hole} position={[0, 0, 0.002]} raycast={noopMeshRaycast} renderOrder={-11} />
                    <mesh geometry={seedGeometry} material={SEED_MATERIALS.seed} position={[0, 0, 0.004]} rotation={[0, 0, Math.PI / 4]} raycast={noopMeshRaycast} renderOrder={-10} />
                </group>
            ))}
        </group>
    );
}
