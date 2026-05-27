import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_GUARD_TOKENS } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import InventoryScreen from './InventoryScreen';

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

const closeSubscreen = vi.fn();
let currentRun = {
    ...createNewRun(0),
    dungeonKeys: { iron: 1 },
    dungeonMasterKeys: 1,
    relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one']
};

beforeEach(() => {
    currentRun = {
        ...createNewRun(0),
        dungeonKeys: { iron: 1 },
        dungeonMasterKeys: 1,
        relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one']
    };
});

vi.mock('../store/useAppStore', () => ({
    useAppStore: Object.assign(
        (selector: (state: unknown) => unknown) =>
            selector({
                closeSubscreen,
                run: currentRun,
                settings: { masterVolume: 0, sfxVolume: 0 },
                saveData: { unlocks: [] }
            }),
        {
            getState: () => ({ saveData: { unlocks: [] } })
        }
    )
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));

describe('InventoryScreen REG-079 run inventory model', () => {
    it('shows active relic archetype as the run build identity', () => {
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('The Seer');
        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('peek, pin, read');
        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('Scrying Spark');
    });

    it('shows run-scoped loadout and consumable stack rules', () => {
        render(<InventoryScreen />);

        expect(screen.getByRole('heading', { name: 'Run consumables and loadout' })).toBeInTheDocument();
        expect(screen.getByText(/Mid-run mutable/)).toBeInTheDocument();
        expect(screen.getByText(/Shuffle charge:/)).toBeInTheDocument();
        expect(screen.getByText(/Dungeon key:/)).toBeInTheDocument();
        expect(screen.getByText(/Master key:/)).toBeInTheDocument();
        expect(screen.getByText(/Loadout slots/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Consumables' })).toHaveAttribute('href', '#inventory-consumables');
        expect(screen.getByTestId('inventory-prep-strip')).toHaveTextContent(/Run prep snapshot/);
        expect(screen.getByTestId('inventory-prep-strip')).toHaveTextContent(/Mutable windows/);
    });

    it('does not invent a build identity before the first relic', () => {
        currentRun = { ...createNewRun(0), dungeonKeys: { iron: 1 }, dungeonMasterKeys: 1 };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-meta-frame-build')).toHaveTextContent('First relic still ahead');
        expect(screen.queryByTestId('inventory-build-identity')).toBeNull();
    });

    it('surfaces full inventory edge cases on capped run rows', () => {
        currentRun = {
            ...currentRun,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...currentRun.stats, guardTokens: MAX_GUARD_TOKENS }
        };
        render(<InventoryScreen />);

        expect(screen.getByText('Gambit token: 1/1')).toBeInTheDocument();
        expect(screen.getByText('Gambit token is at its run limit.')).toBeInTheDocument();
        expect(screen.getByText('Guard token is at its run limit.')).toBeInTheDocument();
    });

    it('uses normalized inventory quantities in the charges summary', () => {
        currentRun = {
            ...currentRun,
            shuffleCharges: -2,
            destroyPairCharges: -1,
            peekCharges: -4,
            strayRemoveCharges: -3,
            undoUsesThisFloor: -1,
            stats: { ...currentRun.stats, guardTokens: -2, comboShards: -5 }
        };
        render(<InventoryScreen />);
        const chargesPanel = within(screen.getByTestId('inventory-charges-panel'));

        expect(chargesPanel.getByText(/Shuffle charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Destroy charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Peek charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Stray remove/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Guard tokens/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Combo shards/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Undo this floor/)).toHaveTextContent('0');
    });
});
