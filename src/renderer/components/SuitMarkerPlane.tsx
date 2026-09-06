import { useLayoutEffect, useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { getTileSuit } from '../../shared/tile-suit-rules';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * The suit on a tile's hidden back: a colour field low on the card and the suit's rune inside it.
 *
 * The rune is not decoration. Colour alone is not a channel this game trusts on a board that
 * already carries trait tints and hazard accents, so every suit is readable in greyscale by
 * shape, and the field is large enough that a clump reads as a clump from across the board.
 */
const paintSuit = (canvas: HTMLCanvasElement, suit: TileSuit): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const { hue, rune } = getTileSuit(suit);
    ctx.clearRect(0, 0, w, h);
    const pad = 6;
    const radius = 18;
    ctx.fillStyle = hue;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius);
    } else {
        ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(12, 10, 8, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(14, 12, 10, 0.92)';
    ctx.font = 'bold 118px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rune, w / 2, h / 2 + 4);
};

export const SuitMarkerPlane = ({ faceZ, suit }: { faceZ: number; suit: TileSuit }): ReactElement => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 192;
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        return tex;
    }, []);

    useLayoutEffect(() => {
        paintSuit(texture.image as HTMLCanvasElement, suit);
        /* Three.js: flag GPU upload after 2D canvas paint (mutation required). */
        // eslint-disable-next-line react-hooks/immutability -- CanvasTexture GPU sync
        texture.needsUpdate = true;
    }, [suit, texture]);

    useLayoutEffect(() => {
        return () => {
            texture.dispose();
        };
    }, [texture]);

    const z = 0.05;
    const size = Math.min(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT) * 0.42;
    const y = -CARD_PLANE_HEIGHT * 0.5 + size * 0.5 + 0.09;

    return (
        <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
            <mesh position={[0, y, z]} raycast={noopMeshRaycast} renderOrder={10}>
                <planeGeometry args={[size, size]} />
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
        </group>
    );
};
