import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera } from 'three';

import {
    box3CornerPoints,
    clientBoxRectFromProjectedNdcPoints,
    objectClientRectFromCameraProjection,
    projectedNdcPointToClientPoint
} from './tileBoardScreenRect';

describe('tileBoardScreenRect', () => {
    it('maps projected NDC points into client coordinates', () => {
        const rect = { left: 10, top: 20, width: 200, height: 100 };

        expect(projectedNdcPointToClientPoint({ x: -1, y: 1 }, rect)).toEqual({ x: 10, y: 20 });
        expect(projectedNdcPointToClientPoint({ x: 1, y: -1 }, rect)).toEqual({ x: 210, y: 120 });
        expect(projectedNdcPointToClientPoint({ x: 0, y: 0 }, rect)).toEqual({ x: 110, y: 70 });
    });

    it('builds a client box from projected corners', () => {
        expect(
            clientBoxRectFromProjectedNdcPoints(
                [
                    { x: -0.5, y: 0.5 },
                    { x: 0.5, y: 0.25 },
                    { x: 0.25, y: -0.5 },
                    { x: -0.25, y: -0.25 }
                ],
                { left: 10, top: 20, width: 200, height: 100 }
            )
        ).toEqual({
            bottom: 95,
            height: 50,
            left: 60,
            right: 160,
            top: 45,
            width: 100
        });
    });

    it('returns null when projected points cannot form a finite box', () => {
        expect(
            clientBoxRectFromProjectedNdcPoints(
                [
                    { x: Number.NaN, y: 0 },
                    { x: 0.5, y: 0.5 }
                ],
                { left: 10, top: 20, width: 200, height: 100 }
            )
        ).toBeNull();
        expect(clientBoxRectFromProjectedNdcPoints([], { left: 10, top: 20, width: 200, height: 100 })).toBeNull();
    });

    it('builds the eight projected corner points for a box', () => {
        const mesh = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
        mesh.updateMatrixWorld(true);
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;

        if (!bounds) {
            throw new Error('expected box geometry to have computed bounds');
        }

        const corners = box3CornerPoints(bounds);

        expect(corners).toHaveLength(8);
        expect(corners.some((corner) => corner.x === -1 && corner.y === -2 && corner.z === -3)).toBe(true);
        expect(corners.some((corner) => corner.x === 1 && corner.y === 2 && corner.z === 3)).toBe(true);

        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
    });

    it('projects a visible object into a DOM client rect', () => {
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
        mesh.updateMatrixWorld(true);

        expect(
            objectClientRectFromCameraProjection({
                camera,
                object: mesh,
                rect: { left: 10, top: 20, width: 200, height: 100 }
            })
        ).toEqual({
            bottom: 95,
            height: 50,
            left: 60,
            right: 160,
            top: 45,
            width: 100
        });

        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
    });

    it('returns null for objects without projected bounds', () => {
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

        expect(
            objectClientRectFromCameraProjection({
                camera,
                object: new Object3D(),
                rect: { left: 10, top: 20, width: 200, height: 100 }
            })
        ).toBeNull();
    });
});
