import { useLayoutEffect, useMemo, type ReactElement } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const paintOrdinal = (canvas: HTMLCanvasElement, ordinal: number): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    ctx.fillStyle = 'rgba(18, 14, 8, 0.82)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 10);
    } else {
        ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 211, 157, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f2d39d';
    ctx.font = 'bold 72px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ordinal), w / 2, h / 2 + 2);
};

/**
 * Early-tutorial pair index badge on the **hidden back** face (WebGL parity with DOM pair-index chrome).
 */
export const TutorialPairMarkerPlane = ({
    faceZ,
    ordinal
}: {
    faceZ: number;
    ordinal: number;
}): ReactElement => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        // Smooth on a tilted card: nearest sampling made the marker jagged.
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        return tex;
    }, []);

    useLayoutEffect(() => {
        paintOrdinal(texture.image as HTMLCanvasElement, ordinal);
        /* Three.js: flag GPU upload after 2D canvas paint (mutation required). */
        // eslint-disable-next-line react-hooks/immutability -- CanvasTexture GPU sync
        texture.needsUpdate = true;
    }, [ordinal, texture]);

    useLayoutEffect(() => {
        return () => {
            texture.dispose();
        };
    }, [texture]);

    const z = 0.052;
    const x = CARD_PLANE_WIDTH * 0.5 - 0.1;
    const y = CARD_PLANE_HEIGHT * 0.5 - 0.1;

    return (
        <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
            <mesh position={[x, y, z]} raycast={noopMeshRaycast} renderOrder={11}>
                <planeGeometry args={[0.16, 0.16]} />
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
