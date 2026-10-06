import { fireEvent, render, screen } from '@testing-library/react';
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
it('crossfades loaded art as the current world changes and keeps still art under reduced motion', () => {
    const r = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: 'ember', realmSecondaryId: 'tide' });
    const { rerender } = render(<ElementSceneLayers scene={deriveElementScene(r)} alive still={false} plate="dungeon" />);
    const steam = screen.getByTestId('element-scene-steam');
    expect(steam.style.getPropertyValue('--element-opacity')).toBe('0');
    const img = steam.querySelector('img')!;
    expect(img.srcset).toContain('768w');
    fireEvent.load(img);
    expect(Number(steam.style.getPropertyValue('--element-opacity'))).toBeGreaterThan(0);
    rerender(<ElementSceneLayers scene={deriveElementScene({ ...r, realmId: 'frost', realmSecondaryId: 'grove' })} alive={false} still plate="dungeon" />);
    expect(screen.getByTestId('element-scene')).toHaveAttribute('data-reactions', 'frostbloom');
    expect(screen.getByTestId('element-scene')).toHaveAttribute('data-still', 'true');
    expect(steam.style.getPropertyValue('--element-opacity')).toBe('0');
    expect(screen.getByTestId('element-scene-frostbloom')).toHaveAttribute('data-active', 'true');
});
