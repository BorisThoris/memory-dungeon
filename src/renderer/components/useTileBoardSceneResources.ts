import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef
} from 'react';
import {
    PlaneGeometry,
    type ShaderMaterial,
    type WebGLRenderer
} from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { getBoardAnisotropyCap } from '../../shared/graphicsQuality';
import { preloadCardRankOpentypeFont } from '../cardFace/opentypeCardRankFont';
import { createBoardRuneFieldMaterial } from './boardRuneFieldMaterial';
import { disposeTileBoardResource } from './tileBoardDisposables';
import type { TileBoardRuneFieldMetrics } from './tileBoardRuneField';
import { syncTileBoardTextureQuality } from './tileBoardTextureQuality';
import {
    applyAnisotropyToCachedTileTextures,
    runDemandDrivenTileFaceOverlayPrewarmSession,
    setTileTextureSamplingQuality
} from './tileTextures';

interface UseTileBoardSceneResourcesInput {
    boardRuneFieldMetrics: TileBoardRuneFieldMetrics;
    gl: WebGLRenderer;
    graphicsQuality: GraphicsQualityPreset;
    overlayPrewarmDemandPairKeys: readonly string[];
    tiles: readonly Tile[];
    textureRevision: number;
}

export const useTileBoardSceneResources = ({
    boardRuneFieldMetrics,
    gl,
    graphicsQuality,
    overlayPrewarmDemandPairKeys,
    tiles,
    textureRevision
}: UseTileBoardSceneResourcesInput) => {
    const boardRuneFieldGeometry = useMemo(
        () => new PlaneGeometry(boardRuneFieldMetrics.width, boardRuneFieldMetrics.height, 1, 1),
        [boardRuneFieldMetrics.height, boardRuneFieldMetrics.width]
    );
    const boardRuneFieldMaterial = useMemo(() => createBoardRuneFieldMaterial(), []);
    const boardRuneFieldMatRef = useRef<ShaderMaterial | null>(null);

    useEffect(() => {
        return () => {
            disposeTileBoardResource(boardRuneFieldGeometry);
        };
    }, [boardRuneFieldGeometry]);

    useEffect(() => {
        return () => {
            disposeTileBoardResource(boardRuneFieldMaterial);
        };
    }, [boardRuneFieldMaterial]);

    useEffect(() => {
        return runDemandDrivenTileFaceOverlayPrewarmSession(overlayPrewarmDemandPairKeys, graphicsQuality, tiles);
    }, [graphicsQuality, overlayPrewarmDemandPairKeys, tiles]);

    useLayoutEffect(() => {
        syncTileBoardTextureQuality({
            applyAnisotropy: applyAnisotropyToCachedTileTextures,
            getAnisotropyCap: getBoardAnisotropyCap,
            getMaxAnisotropy: () => gl.capabilities.getMaxAnisotropy(),
            graphicsQuality,
            preloadRankFont: (quality) => {
                void preloadCardRankOpentypeFont(quality);
            },
            setSamplingQuality: setTileTextureSamplingQuality
        });
    }, [gl, graphicsQuality, textureRevision]);

    return {
        boardRuneFieldGeometry,
        boardRuneFieldMaterial,
        boardRuneFieldMatRef
    };
};
