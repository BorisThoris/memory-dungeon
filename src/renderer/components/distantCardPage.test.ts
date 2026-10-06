import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, type CanvasTexture, type ShaderMaterial } from 'three';
import { makeBoard, makePair } from '../../shared/test/game-fixtures';
import { installCanvas2dMock } from '../../test/installCanvas2dMock';
import { createDistantCardPage, type DistantCardPageInput } from './distantCardPage';
import { paintDistantCard } from './tileTextures';

vi.mock('./tileTextures', () => ({ paintDistantCard: vi.fn() }));

describe('distant card GPU page lifetime', () => {
    let restoreCanvas: () => void;
    const pages: ReturnType<typeof createDistantCardPage>[] = [];
    beforeEach(() => { restoreCanvas = installCanvas2dMock(); vi.clearAllMocks(); });
    afterEach(() => { pages.splice(0).forEach(page => page.dispose()); restoreCanvas(); });
    const create = () => { const page = createDistantCardPage(32); pages.push(page); return page; };
    const input = (): DistantCardPageInput => ({
        board: makeBoard(Array.from({ length: 32 }, (_, i) => makePair(String(i), String(i))).flat(), { columns: 8, rows: 8 }),
        indices: Array.from({ length: 64 }, (_, i) => i), compact: false, reduceMotion: false,
        previewActive: false, debugPeekActive: false, peekRevealedTileIds: [], textureRevision: 0
    });
    const atlas = (page: ReturnType<typeof createDistantCardPage>) =>
        (page.mesh.material as ShaderMaterial).uniforms.atlas!.value as CanvasTexture;

    it('changes one card without replacing GPU resources or repainting its 63 neighbors', () => {
        const page = create(), first = input();
        page.update(first);
        const texture = atlas(page), version = texture.version;
        const geometry = page.mesh.geometry, material = page.mesh.material;
        const matrices = page.mesh.instanceMatrix.version;
        vi.mocked(paintDistantCard).mockClear();
        page.update({ ...first, board: { ...first.board, tiles: first.board.tiles.map((tile, i) =>
            i === 5 ? { ...tile, state: 'flipped' } : tile), flippedTileIds: [first.board.tiles[5]!.id] } });
        expect(paintDistantCard).toHaveBeenCalledTimes(1);
        expect(page.mesh.geometry).toBe(geometry);
        expect(page.mesh.material).toBe(material);
        expect(atlas(page)).toBe(texture);
        expect(texture.version).toBe(version + 1);
        expect(page.mesh.instanceMatrix.version).toBe(matrices);
    });

    it('reflows positions without repainting or uploading the artwork', () => {
        const page = create(), first = input();
        page.update(first);
        const before = new Matrix4(); page.mesh.getMatrixAt(20, before);
        const version = atlas(page).version;
        vi.mocked(paintDistantCard).mockClear();
        page.update({ ...first, board: { ...first.board, columns: 4, rows: 16 }, compact: true });
        const after = new Matrix4(); page.mesh.getMatrixAt(20, after);
        expect(after.equals(before)).toBe(false);
        expect(paintDistantCard).not.toHaveBeenCalled();
        expect(atlas(page).version).toBe(version);
        expect(page.mesh.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it('keeps spatial atlas slots and actual pick ids when a card enters detailed LOD', () => {
        const page = create(), first = input();
        page.update(first);
        const version = atlas(page).version;
        vi.mocked(paintDistantCard).mockClear();
        page.update({ ...first, indices: first.indices.filter(index => index !== 5) });
        expect(page.mesh.count).toBe(63);
        expect(page.mesh.userData.tileIds[5]).toBe(first.board.tiles[6]!.id);
        expect(page.mesh.geometry.getAttribute('slotOffset').getX(5)).toBe(6);
        expect(paintDistantCard).not.toHaveBeenCalled();
        expect(atlas(page).version).toBe(version);
        page.update(first);
        expect(page.mesh.count).toBe(64);
        expect(page.mesh.userData.tileIds[5]).toBe(first.board.tiles[5]!.id);
        expect(paintDistantCard).not.toHaveBeenCalled();
    });

    it('repaints only the opening lock when a different card is flipped', () => {
        const page = create(), first = input();
        first.stickyBlockedTileId = first.board.tiles[0]!.id;
        page.update(first);
        vi.mocked(paintDistantCard).mockClear();
        page.update({ ...first, board: { ...first.board, flippedTileIds: ['outside-this-page'] } });
        expect(paintDistantCard).toHaveBeenCalledTimes(1);
        expect(paintDistantCard).toHaveBeenLastCalledWith(expect.anything(), first.board.tiles[0], false, false);
        const context = (atlas(page).image as HTMLCanvasElement).getContext('2d')!;
        expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 32, 48);
    });

    it('refreshes all slots after artwork loads and releases all four GPU resources', () => {
        const page = create(), first = input();
        page.update(first);
        vi.mocked(paintDistantCard).mockClear();
        page.update({ ...first, textureRevision: 1 });
        expect(paintDistantCard).toHaveBeenCalledTimes(64);
        const disposals = [page.mesh, page.mesh.geometry, page.mesh.material as ShaderMaterial, atlas(page)]
            .map(resource => vi.spyOn(resource, 'dispose'));
        page.dispose(); pages.splice(pages.indexOf(page), 1);
        disposals.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
    });
});
