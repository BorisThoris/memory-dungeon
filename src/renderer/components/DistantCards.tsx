import { memo, useContext, useEffect, useLayoutEffect, useMemo } from 'react';
import { TilePickMeshRegistryContext } from './tileBoardSceneRegistries';
import { createDistantCardPage, DISTANT_CARD_PAGE_SIZE, type DistantCardPageInput } from './distantCardPage';

interface Props extends DistantCardPageInput {
    interactive: boolean;
    tileSize: 16 | 32 | 64;
}

/** Original artwork at screen-appropriate resolution. One draw call and atlas for 64 real cards. */
function CardPageView(props: Props) {
    const registry = useContext(TilePickMeshRegistryContext);
    const page = useMemo(() => createDistantCardPage(props.tileSize), [props.tileSize]);
    useLayoutEffect(() => page.update(props), [page, props]);
    useLayoutEffect(() => {
        if (!props.interactive || !registry) return;
        const ids = page.mesh.userData.tileIds as string[];
        ids.forEach(id => registry.register(id, page.mesh));
        return () => { ids.forEach(id => registry.unregister(id)); };
    }, [props, page, registry]);
    useEffect(() => () => page.dispose(), [page]);
    return <primitive object={page.mesh} />;
}

const CardPage = memo(CardPageView, (previous, next) =>
    previous.board.columns === next.board.columns && previous.board.rows === next.board.rows &&
    // The opening count only changes artwork on the page containing the sticky-fingers mark.
    (!(previous.stickyBlockedTileId && previous.indices.some(index => previous.board.tiles[index]!.id === previous.stickyBlockedTileId)) ||
        previous.board.flippedTileIds.length === next.board.flippedTileIds.length) &&
    previous.compact === next.compact && previous.reduceMotion === next.reduceMotion &&
    previous.previewActive === next.previewActive && previous.debugPeekActive === next.debugPeekActive &&
    previous.peekRevealedTileIds === next.peekRevealedTileIds && previous.interactive === next.interactive &&
    previous.textureRevision === next.textureRevision && previous.tileSize === next.tileSize &&
    previous.stickyBlockedTileId === next.stickyBlockedTileId &&
    previous.indices.length === next.indices.length && previous.indices.every((index, offset) =>
        index === next.indices[offset] && previous.board.tiles[index] === next.board.tiles[index]));

export function DistantCards(props: Props) {
    const pages = useMemo(() => {
        const result = new Map<number, number[]>();
        for (const index of props.indices) {
            const page = Math.floor(index / DISTANT_CARD_PAGE_SIZE);
            let indices = result.get(page);
            if (!indices) { indices = []; result.set(page, indices); }
            indices.push(index);
        }
        return [...result];
    }, [props.indices]);
    return <>{pages.map(([page, indices]) => <CardPage key={page} {...props} indices={indices} />)}</>;
}
