import { useCallback, useState } from 'react';
import { useTileBoardWebglContextRecovery } from './useTileBoardWebglContextRecovery';

export const useTileBoardLiveRegionRecovery = () => {
    const [boardLiveMessage, setBoardLiveMessage] = useState('');
    const announceBoardLiveMessage = useCallback((message: string): void => {
        setBoardLiveMessage(message);
    }, []);
    const {
        gpuSurfaceLost,
        handleCanvasCreated,
        webglCanvasRemountKey
    } = useTileBoardWebglContextRecovery({ announce: announceBoardLiveMessage });

    return {
        announceBoardLiveMessage,
        boardLiveMessage,
        gpuSurfaceLost,
        handleCanvasCreated,
        webglCanvasRemountKey
    };
};
