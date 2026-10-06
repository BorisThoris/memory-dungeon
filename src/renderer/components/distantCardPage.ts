import { CanvasTexture, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { BoardState, Tile } from '../../shared/contracts';
import { paintDistantCard } from './tileTextures';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { isTileBoardFaceUp } from './tileBoardFaceUp';
import { isStickyFingerSlotMarked } from './tileBoardRowMarkers';

export const DISTANT_CARD_PAGE_SIZE = 64;

export interface DistantCardPageInput {
    board: BoardState;
    indices: readonly number[];
    compact: boolean;
    reduceMotion: boolean;
    previewActive: boolean;
    debugPeekActive: boolean;
    peekRevealedTileIds: readonly string[];
    textureRevision: number;
    stickyBlockedTileId?: string | null;
}

/** A spatial page owns one persistent GPU allocation, even as cards enter or leave detailed LOD. */
export function createDistantCardPage(tileSize: 16 | 32 | 64) {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize * 8;
    canvas.height = tileSize * 12;
    const context = canvas.getContext('2d')!;
    const slot = document.createElement('canvas');
    slot.width = tileSize;
    slot.height = tileSize * 1.5;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT);
    const offsets = new InstancedBufferAttribute(new Float32Array(DISTANT_CARD_PAGE_SIZE * 2), 2);
    offsets.setUsage(DynamicDrawUsage);
    geometry.setAttribute('slotOffset', offsets);
    const material = new ShaderMaterial({
        uniforms: { atlas: { value: texture } }, transparent: true, depthWrite: true,
        vertexShader: `attribute vec2 slotOffset; varying vec2 atlasUv;
            void main(){atlasUv=(uv+slotOffset)/8.;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D atlas; varying vec2 atlasUv;
            void main(){vec4 pixel=texture2D(atlas,atlasUv);if(pixel.a<.1)discard;gl_FragColor=pixel;
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            }`
    });
    const mesh = new InstancedMesh(geometry, material, DISTANT_CARD_PAGE_SIZE);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const painted: ({ tile: Tile; faceUp: boolean; locked: boolean; revision: number } | undefined)[] = [];
    let previous: DistantCardPageInput | null = null;
    const matrix = new Matrix4();
    const scale = new Vector3();

    const update = (input: DistantCardPageInput): void => {
        const { board, indices, compact, reduceMotion } = input;
        const layoutChanged = !previous || previous.board.columns !== board.columns || previous.board.rows !== board.rows ||
            previous.compact !== compact || previous.reduceMotion !== reduceMotion;
        const instancesChanged = !previous || previous.indices.length !== indices.length ||
            indices.some((index, instance) => index !== previous!.indices[instance] || board.tiles[index]!.id !== previous!.board.tiles[index]!.id);
        const revealed = new Set(input.peekRevealedTileIds);
        let textureChanged = false;
        const ids: string[] = [];
        for (let instance = 0; instance < indices.length; instance++) {
            const index = indices[instance]!;
            const tile = board.tiles[index]!;
            // Fixed spatial atlas slots avoid repainting the whole page when one card is promoted.
            const atlasSlot = index % DISTANT_CARD_PAGE_SIZE;
            const faceUp = isTileBoardFaceUp({ tile, previewActive: input.previewActive,
                debugPeekActive: input.debugPeekActive, peekRevealedTileIds: revealed });
            const locked = isStickyFingerSlotMarked({ tile, faceUp, flippedTileCount: board.flippedTileIds.length,
                stickyBlockedTileId: input.stickyBlockedTileId ?? null });
            const cached = painted[atlasSlot];
            if (!cached || cached.tile !== tile || cached.faceUp !== faceUp || cached.locked !== locked || cached.revision !== input.textureRevision) {
                paintDistantCard(slot, tile, faceUp, locked);
                const x = (atlasSlot % 8) * slot.width, y = Math.floor(atlasSlot / 8) * slot.height;
                // Transparent corners/status removal must replace the previous slot, never accumulate it.
                context.clearRect(x, y, slot.width, slot.height);
                context.drawImage(slot, x, y);
                painted[atlasSlot] = { tile, faceUp, locked, revision: input.textureRevision };
                textureChanged = true;
            }
            if (instancesChanged) offsets.setXY(instance, atlasSlot % 8, 7 - Math.floor(atlasSlot / 8));
            if (layoutChanged || instancesChanged) {
                const transform = getTileTransform(tile, index, board.columns, board.rows, compact, faceUp, reduceMotion);
                matrix.makeRotationZ(transform.imperfectionRotationZ + transform.layoutYaw);
                matrix.scale(scale.set(transform.baseScale, transform.baseScale, 1));
                matrix.setPosition(transform.baseX + transform.imperfectionX + transform.layoutJitterX,
                    transform.baseY + transform.imperfectionY + transform.layoutJitterY, 0);
                mesh.setMatrixAt(instance, matrix);
            }
            ids.push(tile.id);
        }
        mesh.count = indices.length;
        mesh.userData.tileIds = ids;
        if (textureChanged) texture.needsUpdate = true;
        if (instancesChanged) offsets.needsUpdate = true;
        if (layoutChanged || instancesChanged) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        }
        previous = input;
    };
    const dispose = (): void => {
        geometry.dispose();
        material.dispose();
        texture.dispose();
        mesh.dispose();
    };
    return { mesh, update, dispose };
}
