import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Mesh, type MeshBasicMaterial, type PlaneGeometry, type Texture } from 'three';

import { noopMeshRaycast } from './tileBoardPick';
import { CARD_BREAK_DROP, cardBreakSnuff, cardHeatLevels, cardMatchFlare } from './tileBoardCardHeat';

/**
 * A card side, answering the run.
 *
 * Additive light over the painted plate, keyed out of that same painting so nothing has to be
 * erased from it (`scripts/card-pipeline/cut_card_back_glow.py`). The back gets its cyan runes and
 * the labyrinth medallion, which turns; the face gets the gems set around its frame. Both sides
 * ride the same `heat` — the chain meter's fill — so a streak winds the whole board up and a break
 * drops it still (`tileBoardCardHeat`). A landed pair throws a flare on top.
 *
 * Every card gets its own phase from its seed, so a board of backs shimmers rather than pulsing as
 * one slab, and the medallions are never in step.
 *
 * A card whose back is hidden, or a device that cannot afford the motion, does no per-frame work at
 * all: the frame callback returns immediately and the medallion is not mounted. The rune light is
 * still there at its resting level, because a streak has to be legible on every device.
 */
interface AnimatedCardGlowProps {
    /** Chain meter fill, 0 at rest to 1 at Fever. */
    heat: number;
    /** False while the card is face up: its back is behind the art and nothing here can be seen. */
    visible: boolean;
    /**
     * False on a device that cannot afford the medallion's mesh and its frame loop. The rune light
     * still rises with the chain — it is the streak's feedback and the reason the feature exists —
     * but it is set when the heat changes rather than driven every frame.
     */
    animated: boolean;
    /** True once this card's pair has landed; the flare is timed from the transition. */
    matched: boolean;
    geometry: PlaneGeometry;
    glowTexture: Texture | null;
    reduceMotion: boolean;
    seed: number;
    /** The turning medallion, on the side that has one; omitted on the face. */
    spinGeometry?: PlaneGeometry;
    spinTexture?: Texture | null;
    z: number;
}

const fract = (value: number): number => value - Math.floor(value);

export const AnimatedCardGlow = memo(
    ({
        geometry,
        glowTexture,
        animated,
        heat,
        matched,
        reduceMotion,
        visible,
        seed,
        spinGeometry,
        spinTexture = null,
        z
    }: AnimatedCardGlowProps) => {
        const glowMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMeshRef = useRef<Mesh | null>(null);
        /*
         * When the pair landed, on the render clock. Stamped inside the frame loop because that is
         * the only clock the flare is measured against, and cleared when the card leaves the matched
         * state so a re-deal cannot inherit an old flare.
         */
        const matchedAtRef = useRef<number | null>(null);
        /*
         * The last heat this card saw, and when it last fell. A break is read from the input rather
         * than plumbed as another event: the chain meter empties on a mismatch and nothing else
         * moves it down, so a large drop between frames is the break, and the card can gutter
         * without the board having to tell it anything.
         */
        const lastHeatRef = useRef(heat);
        const snuffedAtRef = useRef<number | null>(null);
        const phase = fract(seed * 0.618034) * Math.PI * 2;

        // The still level for a card whose device (or player) has turned the motion off, and the
        // starting level for one that has not: a board is never drawn with the light at zero.
        const restingGlow = cardHeatLevels(heat).runeGlow;

        useFrame((state) => {
            if (!visible || !animated) {
                return;
            }
            const t = state.clock.elapsedTime;
            if (matched && matchedAtRef.current == null) {
                matchedAtRef.current = t;
            } else if (!matched && matchedAtRef.current != null) {
                matchedAtRef.current = null;
            }
            if (heat < lastHeatRef.current - CARD_BREAK_DROP) {
                snuffedAtRef.current = t;
            }
            lastHeatRef.current = heat;
            const snuffedAt = snuffedAtRef.current;
            const snuff = snuffedAt == null ? 1 : cardBreakSnuff(t - snuffedAt);
            if (snuff >= 1) {
                snuffedAtRef.current = null;
            }
            const levels = cardHeatLevels(heat);
            // A slow breath per card so a still board is never dead, and never a single pulse.
            const breath = reduceMotion ? 1 : 1 + 0.12 * Math.sin(t * 0.9 + phase);
            const matchedAt = matchedAtRef.current;
            const flare = matchedAt == null ? 0 : cardMatchFlare(t - matchedAt, heat);

            const glowMat = glowMatRef.current;
            if (glowMat) {
                glowMat.opacity = Math.min(1.6, levels.runeGlow * breath * snuff + flare);
            }

            const spinMat = spinMatRef.current;
            if (spinMat) {
                spinMat.opacity = Math.min(1.4, levels.spin * breath * snuff + flare * 0.6);
            }

            const spinMesh = spinMeshRef.current;
            if (spinMesh && !reduceMotion) {
                // Turns per second, one way: a mechanism winding, not an ornament wobbling.
                spinMesh.rotation.z = -t * levels.spinRate * Math.PI * 2 + phase * 0.2;
            }
        });

        return (
            <>
                {glowTexture ? (
                    <mesh geometry={geometry} position={[0, 0, z]} raycast={noopMeshRaycast} renderOrder={4}>
                        <meshBasicMaterial
                            ref={glowMatRef}
                            blending={AdditiveBlending}
                            depthWrite={false}
                            map={glowTexture}
                            opacity={restingGlow}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {spinTexture && spinGeometry && animated ? (
                    <mesh
                        geometry={spinGeometry}
                        position={[0, 0, z + 0.00008]}
                        raycast={noopMeshRaycast}
                        ref={spinMeshRef}
                        renderOrder={5}
                    >
                        <meshBasicMaterial
                            ref={spinMatRef}
                            blending={AdditiveBlending}
                            depthWrite={false}
                            map={spinTexture}
                            opacity={0}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
            </>
        );
    }
);
AnimatedCardGlow.displayName = 'AnimatedCardGlow';
