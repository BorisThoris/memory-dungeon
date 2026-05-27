import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import CollectionScreen from './CollectionScreen';

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) => {
        const saveData = createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;
        return selector({
            closeSubscreen: vi.fn(),
            saveData,
            settings: saveData.settings
        });
    }
}));

describe('CollectionScreen REG-093 reward gallery', () => {
    it('surfaces owned, in-progress, and missing local reward rows', () => {
        render(<CollectionScreen />);

        const gallery = screen.getByTestId('collection-reward-gallery');
        expect(gallery).toHaveTextContent(/Achievement gallery/);
        expect(gallery).toHaveTextContent(/Cosmetic gallery/);
        expect(gallery).toHaveTextContent(/in progress|missing|owned/i);

        const metaBoard = screen.getByTestId('collection-meta-progression-board');
        expect(metaBoard).toHaveTextContent(/Initiate tier - 3 honor marks to next profile level/i);
        expect(metaBoard).toHaveTextContent(/Progression focus/i);
        expect(metaBoard).toHaveTextContent(/Next: Week of Archives/i);
        expect(metaBoard).toHaveTextContent(/Adept tier at profile level 3/i);
    });
});
