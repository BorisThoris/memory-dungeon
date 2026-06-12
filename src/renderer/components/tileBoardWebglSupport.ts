export interface TileBoardWebglProbeDocument {
    createElement: (tagName: 'canvas') => {
        getContext: (contextId: string) => unknown;
    };
}

export const canUseWebGL = (
    probeDocument: TileBoardWebglProbeDocument | null =
        typeof document === 'undefined' ? null : (document as unknown as TileBoardWebglProbeDocument)
): boolean => {
    if (!probeDocument) {
        return false;
    }

    try {
        const canvas = probeDocument.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'));
    } catch {
        return false;
    }
};
