export interface ClientRectLike {
    height: number;
    left: number;
    top: number;
    width: number;
}

export interface TilePickIntersectionLike {
    instanceId?: number;
    object: {
        userData?: {
            tileId?: unknown;
            tileIds?: unknown;
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
    for (const hit of intersections) {
        const data = hit.object.userData;
        const id = hit.instanceId != null && Array.isArray(data?.tileIds) ? data.tileIds[hit.instanceId] : data?.tileId;
        if (typeof id === 'string') return id;
    }
    return null;
};
