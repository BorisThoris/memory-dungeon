import { Box3, Vector3, type Camera, type Object3D } from 'three';
import type { ClientRectLike } from './tileBoardPointerPick';

interface ProjectedNdcPoint {
    x: number;
    y: number;
}

export interface ClientBoxRect {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
}

export const projectedNdcPointToClientPoint = (
    point: ProjectedNdcPoint,
    rect: ClientRectLike
): { x: number; y: number } => ({
    x: rect.left + ((point.x + 1) * 0.5) * rect.width,
    y: rect.top + ((1 - point.y) * 0.5) * rect.height
});

export const clientBoxRectFromProjectedNdcPoints = (
    points: readonly ProjectedNdcPoint[],
    rect: ClientRectLike
): ClientBoxRect | null => {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const point of points) {
        const clientPoint = projectedNdcPointToClientPoint(point, rect);
        left = Math.min(left, clientPoint.x);
        right = Math.max(right, clientPoint.x);
        top = Math.min(top, clientPoint.y);
        bottom = Math.max(bottom, clientPoint.y);
    }

    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
        return null;
    }

    return {
        bottom,
        height: Math.max(0, bottom - top),
        left,
        right,
        top,
        width: Math.max(0, right - left)
    };
};

export const box3CornerPoints = (bounds: Box3): Vector3[] => [
    new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
];

export const objectClientRectFromCameraProjection = ({
    camera,
    object,
    rect
}: {
    camera: Camera;
    object: Object3D;
    rect: ClientRectLike;
}): ClientBoxRect | null => {
    const worldBounds = new Box3().setFromObject(object);

    if (worldBounds.isEmpty()) {
        return null;
    }

    const corners = box3CornerPoints(worldBounds);

    for (const corner of corners) {
        corner.project(camera);
    }

    return clientBoxRectFromProjectedNdcPoints(corners, rect);
};
