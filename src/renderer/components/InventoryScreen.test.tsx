import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import InventoryScreen from './InventoryScreen';

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

const closeSubscreen = vi.fn();
let currentRun: ReturnType<typeof createNewRun> | null = null;

beforeEach(() => {
    closeSubscreen.mockClear();
    currentRun = {
        ...createNewRun(0),
        activeMutators: ['wide_recall']
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

describe('InventoryScreen', () => {
    it('states the run once in the header line', () => {
        render(<InventoryScreen />);
        const header = screen.getByTestId('inventory-meta-frame-run');
        expect(header).toHaveTextContent(/Run snapshot/);
        expect(screen.getByTestId('inventory-run-line')).toHaveTextContent(/Floor 1 · .* · Score 0$/);
        expect(screen.getByTestId('inventory-run-line')).not.toHaveTextContent(/Lives/);
        // The build identity, contract and economy frames restated the codex and are gone.
        expect(screen.queryByTestId('inventory-meta-frame-build')).toBeNull();
        expect(screen.queryByTestId('inventory-meta-frame-economy')).toBeNull();
        expect(screen.queryByTestId('inventory-run-loop-signals')).toBeNull();
    });


    it('lists active mutators as chips and charges as one row each', () => {
        render(<InventoryScreen />);
        const mutators = screen.getByTestId('inventory-meta-frame-mutators');
        expect(within(mutators).getAllByRole('listitem')).toHaveLength(1);
        expect(mutators).toHaveTextContent(/Wide recall/i);

        const charges = screen.getByTestId('inventory-charges-panel');
        expect(charges).toHaveTextContent(/Peek\s*\d/);
        expect(charges).toHaveTextContent(/Combo shards\s*\d/);
        expect(charges).not.toHaveTextContent(/Guard tokens/);
        expect(charges).toHaveTextContent(/Match score multiplier/);
    });

    it('uses normalized inventory quantities in the charges summary', () => {
        const base = currentRun!;
        currentRun = {
            ...base,
            shuffleCharges: -2,
            peekCharges: -4,
            stats: { ...base.stats, comboShards: Number.POSITIVE_INFINITY }
        };
        render(<InventoryScreen />);
        const charges = screen.getByTestId('inventory-charges-panel');
        expect(charges).not.toHaveTextContent(/Infinity|NaN|-\d/);
        expect(charges).toHaveTextContent(/Full shuffle\s*0/);
        expect(charges).toHaveTextContent(/Peek\s*0/);
        expect(charges).toHaveTextContent(/Combo shards\s*0/);
    });

    it('shows the empty state and Back when no run is active', () => {
        currentRun = null;
        render(<InventoryScreen />);
        expect(screen.getByTestId('inventory-meta-frame-empty')).toHaveTextContent(/start a run/i);
        screen.getByRole('button', { name: /^back$/i }).click();
        expect(closeSubscreen).toHaveBeenCalledTimes(1);
    });
});
