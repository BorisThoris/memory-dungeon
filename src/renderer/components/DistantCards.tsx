import { memo, useContext, useEffect, useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { BoardState } from '../../shared/contracts';
import { paintDistantCard } from './tileTextures';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { TilePickMeshRegistryContext } from './tileBoardSceneRegistries';
import { isTileBoardFaceUp } from './tileBoardFaceUp';
import { initialTileBoardCardTint } from './tileBoardInitialCardTint';
import { isStickyFingerSlotMarked } from './tileBoardRowMarkers';

interface Props {
    board: BoardState; indices: readonly number[]; compact: boolean; reduceMotion: boolean;
    previewActive: boolean; debugPeekActive: boolean; peekRevealedTileIds: readonly string[];
    interactive: boolean; textureRevision: number; tileSize: 16 | 32 | 64; stickyBlockedTileId?: string | null;
}
const PAGE = 64;

/** Original artwork at screen-appropriate resolution. One draw call and atlas for 64 real cards. */
function CardPageView({ board, indices, compact, reduceMotion, previewActive, debugPeekActive, peekRevealedTileIds,
    interactive, textureRevision, tileSize, stickyBlockedTileId }: Props) {
    const registry = useContext(TilePickMeshRegistryContext);
    const mesh = useMemo(() => {
        void textureRevision;
        const canvas = document.createElement('canvas'); canvas.width = tileSize*8; canvas.height = tileSize*12;
        const context = canvas.getContext('2d')!;
        const slot = document.createElement('canvas'); slot.width = tileSize; slot.height = tileSize*1.5;
        const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
        const geometry = new PlaneGeometry(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT);
        const offsets = new Float32Array(indices.length*2);
        const colors = new Float32Array(indices.length*3);
        const material = new ShaderMaterial({
            uniforms: { atlas: { value: texture } }, transparent: true, depthWrite: true,
            vertexShader: `attribute vec2 slotOffset; attribute vec3 cardColor; varying vec2 atlasUv; varying vec3 tint;
                void main(){atlasUv=(uv+slotOffset)/8.;tint=cardColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
            fragmentShader: `uniform sampler2D atlas; varying vec2 atlasUv; varying vec3 tint;
                void main(){vec4 pixel=texture2D(atlas,atlasUv);if(pixel.a<.1)discard;gl_FragColor=vec4(pixel.rgb*tint,pixel.a);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                }`
        });
        const instanced = new InstancedMesh(geometry, material, indices.length);
        const revealed = new Set(peekRevealedTileIds);
        const ids: string[]=[];
        indices.forEach((index,instance)=>{
            const tile=board.tiles[index]!;
            const faceUp=isTileBoardFaceUp({tile,previewActive,debugPeekActive,peekRevealedTileIds:revealed});
            paintDistantCard(slot,tile,faceUp,isStickyFingerSlotMarked({
                tile, faceUp, flippedTileCount: board.flippedTileIds.length, stickyBlockedTileId: stickyBlockedTileId ?? null
            }));
            context.drawImage(slot,(instance%8)*slot.width,Math.floor(instance/8)*slot.height);
            offsets[instance*2]=instance%8; offsets[instance*2+1]=7-Math.floor(instance/8);
            const tint=new Color(initialTileBoardCardTint({faceUp,isPinned:false,resolvingSelection:null,tile}));
            tint.toArray(colors,instance*3);
            const t=getTileTransform(tile,index,board.columns,board.rows,compact,faceUp,reduceMotion);
            const matrix=new Matrix4().makeRotationZ(t.imperfectionRotationZ+t.layoutYaw);
            matrix.scale(new Vector3(t.baseScale,t.baseScale,1));
            matrix.setPosition(t.baseX+t.imperfectionX+t.layoutJitterX,t.baseY+t.imperfectionY+t.layoutJitterY,0);
            instanced.setMatrixAt(instance,matrix); ids.push(tile.id);
        });
        geometry.setAttribute('slotOffset',new InstancedBufferAttribute(offsets,2));
        geometry.setAttribute('cardColor',new InstancedBufferAttribute(colors,3));
        instanced.userData.tileIds=ids;
        instanced.instanceMatrix.needsUpdate=true;
        instanced.computeBoundingSphere();
        return instanced;
    },[board,indices,compact,reduceMotion,previewActive,debugPeekActive,peekRevealedTileIds,textureRevision,tileSize,stickyBlockedTileId]);
    useLayoutEffect(()=>{
        if (!interactive || !registry) return;
        const ids=mesh.userData.tileIds as string[];
        ids.forEach(id=>registry.register(id,mesh));
        return ()=>{ids.forEach(id=>registry.unregister(id));};
    },[interactive,mesh,registry]);
    useEffect(()=>()=>{
        mesh.geometry.dispose(); const material=mesh.material as ShaderMaterial;
        (material.uniforms.atlas!.value as CanvasTexture).dispose(); material.dispose(); mesh.dispose();
    },[mesh]);
    return <primitive object={mesh} />;
}

const CardPage = memo(CardPageView, (previous, next) =>
    previous.board.columns === next.board.columns && previous.board.rows === next.board.rows &&
    previous.board.flippedTileIds.length === next.board.flippedTileIds.length &&
    previous.compact === next.compact && previous.reduceMotion === next.reduceMotion &&
    previous.previewActive === next.previewActive && previous.debugPeekActive === next.debugPeekActive &&
    previous.peekRevealedTileIds === next.peekRevealedTileIds && previous.interactive === next.interactive &&
    previous.textureRevision === next.textureRevision && previous.tileSize === next.tileSize &&
    previous.stickyBlockedTileId === next.stickyBlockedTileId &&
    previous.indices.length === next.indices.length && previous.indices.every((index, offset) =>
        index === next.indices[offset] && previous.board.tiles[index] === next.board.tiles[index]));

export function DistantCards(props: Props) {
    const pages=useMemo(()=>{
        // Stable spatial pages: flipping one card must not shift and repaint every later atlas.
        const result=new Map<number, number[]>();
        for (const index of props.indices) {
            const page=Math.floor(index/PAGE);
            let indices=result.get(page);
            if (!indices) { indices=[]; result.set(page,indices); }
            indices.push(index);
        }
        return [...result];
    },[props.indices]);
    return <>{pages.map(([page,indices])=><CardPage key={page} {...props} indices={indices}/>)}</>;
}
