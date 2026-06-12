import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, Vector2 } from 'three';

import {
    getTileClientRectByIdFromBoard,
    pickTileAtClientPointFromBoard,
    type TileBoardDomElementLike,
    type TileBoardRaycasterLike
} from './tileBoardImperativeHandle';

const domElement = (rect: { height: number; left: number; top: number; width: number }): TileBoardDomElementLike => ({
    getBoundingClientRect: () => rect
});

const camera = (): OrthographicCamera => {
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return cam;
};

describe('tileBoardImperativeHandle', () => {
    it('returns null tile client rects when the board, viewport, or tile is unavailable', () => {
        const cam = camera();
        const boardGroup = new Object3D();
        const tileObjects = new Map<string, Object3D>();

        expect(
            getTileClientRectByIdFromBoard({
                boardGroup: null,
                camera: cam,
                domElement: domElement({ left: 0, top: 0, width: 100, height: 100 }),
                tileId: 'tile-a',
                tileObjects
            })
        ).toBeNull();
        expect(
            getTileClientRectByIdFromBoard({
                boardGroup,
                camera: cam,
                domElement: domElement({ left: 0, top: 0, width: 0, height: 100 }),
                tileId: 'tile-a',
                tileObjects
            })
        ).toBeNull();
        expect(
            getTileClientRectByIdFromBoard({
                boardGroup,
                camera: cam,
                domElement: domElement({ left: 0, top: 0, width: 100, height: 100 }),
                tileId: 'tile-a',
                tileObjects
            })
        ).toBeNull();
    });

    it('projects a tile object into a DOM client rect', () => {
        const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
        mesh.updateMatrixWorld(true);

        expect(
            getTileClientRectByIdFromBoard({
                boardGroup: new Object3D(),
                camera: camera(),
                domElement: domElement({ left: 10, top: 20, width: 200, height: 100 }),
                tileId: 'tile-a',
                tileObjects: new Map([['tile-a', mesh]])
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

    it('returns false for pointer picks when board or viewport are unavailable', () => {
        const onTilePick = vi.fn();
        const raycaster: TileBoardRaycasterLike = {
            intersectObjects: vi.fn(() => []),
            setFromCamera: vi.fn()
        };

        expect(
            pickTileAtClientPointFromBoard({
                boardGroup: null,
                camera: camera(),
                clientX: 10,
                clientY: 20,
                domElement: domElement({ left: 0, top: 0, width: 100, height: 100 }),
                onTilePick,
                pickPointer: new Vector2(),
                raycaster,
                tileObjects: new Map()
            })
        ).toBe(false);
        expect(
            pickTileAtClientPointFromBoard({
                boardGroup: new Object3D(),
                camera: camera(),
                clientX: 10,
                clientY: 20,
                domElement: domElement({ left: 0, top: 0, width: 0, height: 100 }),
                onTilePick,
                pickPointer: new Vector2(),
                raycaster,
                tileObjects: new Map()
            })
        ).toBe(false);
        expect(onTilePick).not.toHaveBeenCalled();
        expect(raycaster.setFromCamera).not.toHaveBeenCalled();
    });

    it('picks the first raycast tile id and reports success', () => {
        const onTilePick = vi.fn();
        const pickPointer = new Vector2();
        const tile = new Object3D();
        const raycaster: TileBoardRaycasterLike = {
            intersectObjects: vi.fn((objects) => {
                expect(objects).toEqual([tile]);
                return [{ object: { userData: { tileId: 'tile-a' } } }];
            }),
            setFromCamera: vi.fn()
        };

        expect(
            pickTileAtClientPointFromBoard({
                boardGroup: new Object3D(),
                camera: camera(),
                clientX: 60,
                clientY: 70,
                domElement: domElement({ left: 10, top: 20, width: 100, height: 100 }),
                onTilePick,
                pickPointer,
                raycaster,
                tileObjects: new Map([['tile-a', tile]])
            })
        ).toBe(true);

        expect(pickPointer.x).toBeCloseTo(0);
        expect(pickPointer.y).toBeCloseTo(0);
        expect(raycaster.setFromCamera).toHaveBeenCalledTimes(1);
        expect(onTilePick).toHaveBeenCalledWith('tile-a');
    });

    it('returns false when raycast intersections have no tile id', () => {
        const onTilePick = vi.fn();
        const raycaster: TileBoardRaycasterLike = {
            intersectObjects: vi.fn(() => [{ object: { userData: {} } }]),
            setFromCamera: vi.fn()
        };

        expect(
            pickTileAtClientPointFromBoard({
                boardGroup: new Object3D(),
                camera: camera(),
                clientX: 10,
                clientY: 20,
                domElement: domElement({ left: 0, top: 0, width: 100, height: 100 }),
                onTilePick,
                pickPointer: new Vector2(),
                raycaster,
                tileObjects: new Map([['tile-a', new Object3D()]])
            })
        ).toBe(false);
        expect(onTilePick).not.toHaveBeenCalled();
    });
});
