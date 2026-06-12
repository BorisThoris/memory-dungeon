export interface ClientRectLike {
    height: number;
    left: number;
    top: number;
    width: number;
}

export interface TilePickIntersectionLike {
    object: {
        userData?: {
            tileId?: unknown;
        };
    };
}

export const isUsableClientRect = (rect: ClientRectLike): boolean => rect.width > 0 && rect.height > 0;

export const clientPointToNormalizedDeviceCoordinates = (
    clientX: number,
    clientY: number,
    rect: ClientRectLike
): { x: number; y: number } | null => {
    if (!isUsableClientRect(rect)) {
        return null;
    }

    return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((clientY - rect.top) / rect.height) * 2 - 1)
    };
};

export const firstTileIdFromPickIntersections = (
    intersections: readonly TilePickIntersectionLike[]
): string | null => {
    const hit = intersections.find((intersection) => typeof intersection.object.userData?.tileId === 'string');
    return hit ? String(hit.object.userData?.tileId) : null;
};
