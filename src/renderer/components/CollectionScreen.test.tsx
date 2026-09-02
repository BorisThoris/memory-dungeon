import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import CollectionScreen from './CollectionScreen';

const collectionStoreMocks = vi.hoisted(() => ({
    closeSubscreen: vi.fn(),
    saveData: null as SaveData | null
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) => {
        const saveData = collectionStoreMocks.saveData ?? createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;
        return selector({
            closeSubscreen: collectionStoreMocks.closeSubscreen,
            saveData,
            settings: saveData.settings
        });
    }
}));

describe('CollectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        collectionStoreMocks.saveData = null;
    });

    it('opens on achievements with one rail, one grid and an earned count per section', () => {
        render(<CollectionScreen />);

        const rail = screen.getByRole('tablist', { name: /collection sections/i });
        expect(within(rail).getAllByRole('tab')).toHaveLength(5);
        expect(screen.getByTestId('collection-tab-achievements')).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('collection-tab-achievements')).toHaveTextContent(/\d+\/\d+/);

        const entries = screen.getByTestId('collection-entries');
        const cards = within(entries).getAllByRole('listitem');
        expect(cards.length).toBeGreaterThan(0);
        // A first clear is seeded, so at least one card reads Earned.
        expect(entries).toHaveTextContent('Earned');

        // The gallery, reward-signal and payoff strips restated these rows and are gone.
        for (const gone of [
            'collection-reward-gallery',
            'collection-reward-signals',
            'collection-last-run-payoff-burst',
            'collection-last-run-payoff-lane-map',
            'collection-progression-impact-grid',
            'collection-meta-progression-board'
        ]) {
            expect(screen.queryByTestId(gone)).toBeNull();
        }
    });

    it('switches sections from the rail and states each entry once', () => {
        render(<CollectionScreen />);

        for (const [id, kicker] of [
            ['relics', 'Relic'],
            ['cosmetics', 'Cosmetic'],
            ['upgrades', 'Permanent upgrade'],
            ['honors', 'Honor']
        ] as const) {
            act(() => {
                screen.getByTestId(`collection-tab-${id}`).click();
            });
            expect(screen.getByTestId(`collection-tab-${id}`)).toHaveAttribute('aria-selected', 'true');
            const entries = screen.getByTestId('collection-entries');
            expect(entries).toHaveTextContent(kicker);
            expect(within(entries).getAllByRole('listitem').length).toBeGreaterThan(0);
        }
    });

    it('marks never-drafted relics honestly rather than inventing progress', () => {
        render(<CollectionScreen />);
        act(() => {
            screen.getByTestId('collection-tab-relics').click();
        });
        const entries = screen.getByTestId('collection-entries');
        expect(entries).toHaveTextContent('Never drafted');
        expect(entries).not.toHaveTextContent(/NaN|undefined|Infinity/);
    });

    it('normalizes malformed relic pick counts', () => {
        const saveData = createDefaultSaveData();
        collectionStoreMocks.saveData = {
            ...saveData,
            playerStats: {
                ...saveData.playerStats,
                relicPickCounts: { peek_charge_plus_one: Number.NaN, guard_token_plus_one: -4 }
            } as SaveData['playerStats']
        };
        render(<CollectionScreen />);
        act(() => {
            screen.getByTestId('collection-tab-relics').click();
        });
        expect(screen.getByTestId('collection-entries')).not.toHaveTextContent(/NaN|-\d/);
    });
});
