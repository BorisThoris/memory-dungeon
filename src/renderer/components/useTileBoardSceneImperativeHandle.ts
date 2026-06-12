import {
    useImperativeHandle,
    useRef,
    type RefObject,
    type Ref
} from 'react';
import {
    Raycaster,
    Vector2,
    type Camera,
    type Group,
    type Mesh,
    type WebGLRenderer
} from 'three';
import {
    getTileClientRectByIdFromBoard,
    pickTileAtClientPointFromBoard
} from './tileBoardImperativeHandle';

export interface TileBoardSceneHandle {
    getTileClientRectById: (
        tileId: string
    ) => { bottom: number; height: number; left: number; right: number; top: number; width: number } | null;
    pickTileAtClientPoint: (clientX: number, clientY: number) => boolean;
}

interface UseTileBoardSceneImperativeHandleInput {
    boardGroupRef: RefObject<Group | null>;
    camera: Camera;
    gl: WebGLRenderer;
    onTilePick: (tileId: string) => void;
    ref: Ref<TileBoardSceneHandle>;
    tilePickMeshesRef: RefObject<Map<string, Mesh>>;
}

export const useTileBoardSceneImperativeHandle = ({
    boardGroupRef,
    camera,
    gl,
    onTilePick,
    ref,
    tilePickMeshesRef
}: UseTileBoardSceneImperativeHandleInput): void => {
    const pickRaycasterRef = useRef<Raycaster>(new Raycaster());
    const pickPointerRef = useRef<Vector2>(new Vector2());

    useImperativeHandle(
        ref,
        () => ({
            getTileClientRectById: (tileId: string) => {
                return getTileClientRectByIdFromBoard({
                    boardGroup: boardGroupRef.current,
                    camera,
                    domElement: gl.domElement,
                    tileId,
                    tileObjects: tilePickMeshesRef.current
                });
            },
            pickTileAtClientPoint: (clientX: number, clientY: number): boolean => {
                return pickTileAtClientPointFromBoard({
                    boardGroup: boardGroupRef.current,
                    camera,
                    clientX,
                    clientY,
                    domElement: gl.domElement,
                    onTilePick,
                    pickPointer: pickPointerRef.current,
                    raycaster: pickRaycasterRef.current,
                    tileObjects: tilePickMeshesRef.current
                });
            }
        }),
        [boardGroupRef, camera, gl, onTilePick, tilePickMeshesRef]
    );
};
