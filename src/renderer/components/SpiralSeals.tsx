import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { type Group, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { BoardState } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { sealedSlabCells, sealSettleScale } from './spiralSealLayout';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * The Spiral's sealed rings (`spiral-rules.ts`, DGE-021/030): every sealed cell is a slab of dark
 * stone with a pale rim, flat in the card's place, so a ring that has fallen reads as stone and not
 * as an empty cell the floor might deal into. A slab drops into place over half a second when its
 * ring seals; with reduced motion it is simply there. It sits behind the cards and is never picked.
 */
const SLAB_COLOR = '#22201c';
const RIM_COLOR = '#8a7d63';
const SEAM_COLOR = '#4a4338';
export function SpiralSeals({ board, compact, reduceMotion, time }: {
    board: Pick<BoardState, 'tiles' | 'columns' | 'rows' | 'level'>;
    compact: boolean;
    reduceMotion: boolean;
    time: MutableRefObject<number>;
}) {
    const cells = useMemo(() => sealedSlabCells(board, compact, reduceMotion), [board, compact, reduceMotion]);
    const rimGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.98, CARD_PLANE_HEIGHT * 0.98), []);
    const slabGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.9, CARD_PLANE_HEIGHT * 0.92), []);
    const seamGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.9, CARD_PLANE_HEIGHT * 0.04), []);
    const rimMaterial = useMemo(() => new MeshBasicMaterial({ color: RIM_COLOR, depthWrite: false }), []);
    const slabMaterial = useMemo(() => new MeshBasicMaterial({ color: SLAB_COLOR, depthWrite: false }), []);
    const seamMaterial = useMemo(() => new MeshBasicMaterial({ color: SEAM_COLOR, depthWrite: false }), []);
    // When each slab was first seen, so a newly sealed ring settles and an old one stays put.
    const sealedAt = useRef(new Map<string, number>());
    const slabRefs = useRef(new Map<number, Group>());
    useFrame(() => {
        const now = time.current;
        for (const { index } of cells) {
            const key = `${board.level}:${index}`;
            if (!sealedAt.current.has(key)) sealedAt.current.set(key, now);
            const slab = slabRefs.current.get(index);
            if (slab) slab.scale.setScalar(sealSettleScale(now - sealedAt.current.get(key)!, reduceMotion));
        }
    });
    if (cells.length === 0) return null;
    return (
        <group name="spiral-seals">
            {cells.map(({ index, x, y }) => (
                <group key={`${board.level}:${index}`} position={[x, y, -0.02]} ref={(node) => {
                    if (node) slabRefs.current.set(index, node);
                    else slabRefs.current.delete(index);
                }}>
                    <mesh geometry={rimGeometry} material={rimMaterial} raycast={noopMeshRaycast} renderOrder={-12} />
                    <mesh geometry={slabGeometry} material={slabMaterial} position={[0, 0, 0.002]} raycast={noopMeshRaycast} renderOrder={-11} />
                    <mesh geometry={seamGeometry} material={seamMaterial} position={[0, CARD_PLANE_HEIGHT * 0.12, 0.004]} raycast={noopMeshRaycast} renderOrder={-10} />
                    <mesh geometry={seamGeometry} material={seamMaterial} position={[0, -CARD_PLANE_HEIGHT * 0.2, 0.004]} raycast={noopMeshRaycast} renderOrder={-10} />
                </group>
            ))}
        </group>
    );
}
