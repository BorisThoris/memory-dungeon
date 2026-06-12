import type { Camera, Object3D, Raycaster, Vector2 } from 'three';
import {
    clientPointToNormalizedDeviceCoordinates,
    firstTileIdFromPickIntersections,
    isUsableClientRect,
    type ClientRectLike,
    type TilePickIntersectionLike
} from './tileBoardPointerPick';
import { objectClientRectFromCameraProjection, type ClientBoxRect } from './tileBoardScreenRect';

export interface TileBoardDomElementLike {
    getBoundingClientRect(): ClientRectLike;
}

export interface TileBoardRaycasterLike {
    intersectObjects(objects: Object3D[], recursive?: boolean): TilePickIntersectionLike[];
    setFromCamera(pointer: Vector2, camera: Camera): void;
}

export const getTileClientRectByIdFromBoard = ({
    boardGroup,
    camera,
    domElement,
    tileId,
    tileObjects
}: {
    boardGroup: Object3D | null;
    camera: Camera;
    domElement: TileBoardDomElementLike;
    tileId: string;
    tileObjects: ReadonlyMap<string, Object3D>;
}): ClientBoxRect | null => {
    if (!boardGroup) {
        return null;
    }

    const rect = domElement.getBoundingClientRect();
    if (!isUsableClientRect(rect)) {
        return null;
    }

    const tileObject = tileObjects.get(tileId) ?? null;

    if (!tileObject) {
        return null;
    }

    return objectClientRectFromCameraProjection({ camera, object: tileObject, rect });
};

export const pickTileAtClientPointFromBoard = ({
    boardGroup,
    camera,
    clientX,
    clientY,
    domElement,
    onTilePick,
    pickPointer,
    raycaster,
    tileObjects
}: {
    boardGroup: Object3D | null;
    camera: Camera;
    clientX: number;
    clientY: number;
    domElement: TileBoardDomElementLike;
    onTilePick: (tileId: string) => void;
    pickPointer: Vector2;
    raycaster: Raycaster | TileBoardRaycasterLike;
    tileObjects: ReadonlyMap<string, Object3D>;
}): boolean => {
    if (!boardGroup) {
        return false;
    }

    const rect = domElement.getBoundingClientRect();
    const pointer = clientPointToNormalizedDeviceCoordinates(clientX, clientY, rect);

    if (!pointer) {
        return false;
    }

    pickPointer.set(pointer.x, pointer.y);
    raycaster.setFromCamera(pickPointer, camera);

    const tileId = firstTileIdFromPickIntersections(raycaster.intersectObjects([...tileObjects.values()], false));

    if (!tileId) {
        return false;
    }

    onTilePick(tileId);
    return true;
};
