import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import { deriveElementScene, ELEMENT_SCENE_KINDS } from './elementScene';
import { ELEMENT_SCENE_ART } from './elementSceneArt';
import { ElementSceneLayers } from './ElementSceneLayers';

it('has real desktop and mobile paintings for every chemistry and storm combination', () => {
    expect(Object.keys(ELEMENT_SCENE_ART)).toEqual(ELEMENT_SCENE_KINDS);
    for (const [kind, art] of Object.entries(ELEMENT_SCENE_ART)) {
        expect(art.desktop).toContain(`bg-gameplay-element-${kind}-v1.webp`);
        expect(art.mobile).toContain(`bg-gameplay-element-${kind}-v1-mobile.webp`);
    }
});
it('records which chemistry is in the room and how much of the wall each has; the canvas paints it', () => {
    const r = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: 'ember', realmSecondaryId: 'tide' });
    const { rerender } = render(<ElementSceneLayers scene={deriveElementScene(r)} alive still={false} plate="dungeon" />);
    const world = screen.getByTestId('element-scene');
    const steam = screen.getByTestId('element-scene-steam');
    expect(world).toHaveAttribute('data-reactions', 'steam');
    expect(steam).toHaveAttribute('data-active', 'true');
    expect(Number(steam.getAttribute('data-opacity'))).toBeGreaterThan(0);
    // It is a record, not a picture: no image is fetched or layered here, and it takes no space.
    expect(world.querySelectorAll('img')).toHaveLength(0);
    expect(world).toHaveAttribute('hidden');
    rerender(<ElementSceneLayers scene={deriveElementScene({ ...r, realmId: 'frost', realmSecondaryId: 'grove' })} alive={false} still plate="dungeon" />);
    expect(world).toHaveAttribute('data-reactions', 'frostbloom');
    expect(world).toHaveAttribute('data-still', 'true');
    expect(steam).toHaveAttribute('data-active', 'false');
    expect(steam).toHaveAttribute('data-opacity', '0.000');
    expect(screen.getByTestId('element-scene-frostbloom')).toHaveAttribute('data-active', 'true');
});
