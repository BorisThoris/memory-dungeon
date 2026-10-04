import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { buyStoreItem } from '../../shared/run-store-rules';
import StoreVault from './StoreVault';

const Camp = ({ gold, onDescend = vi.fn() }: { gold: number; onDescend?: () => void }) => {
    const [run, setRun] = useState<RunState>(() => ({ ...createNewRun(0), gold }));
    return <StoreVault floor={3} run={run} onDescend={onDescend} onBuy={id => {
        const bought = buyStoreItem(run, id);
        if (bought) setRun(bought);
        return bought !== null;
    }} />;
};

describe('camp', () => {
    it('explains each upgrade without hovering, with ranks, costs and no element purchases', () => {
        render(<Camp gold={12} />);
        expect(screen.getByRole('dialog')).toHaveAccessibleName('Make the next floors yours');
        expect(screen.getByTestId('store-row-long_look')).toHaveTextContent('Study time: +0 → +1 seconds');
        expect(screen.getByTestId('store-row-gilded_chain')).toHaveTextContent('2 gold every 5 matches in a row');
        expect(screen.getByTestId('store-buy-long_look')).toHaveAccessibleName('Buy long look for 8 gold');
        expect(screen.getAllByLabelText('Rank 0 of 3')).toHaveLength(3);
        expect(screen.queryByText(/essence|elemental forge/i)).toBeNull();
        expect(screen.getByTestId('store-descend')).toHaveFocus();
    });
    it('announces upgrades, updates the purse and rank, and recovers focus when gold runs out', () => {
        render(<Camp gold={8} />);
        const buy = screen.getByTestId('store-buy-long_look');
        act(() => buy.focus());
        fireEvent.click(buy);
        expect(screen.getByTestId('camp-gold')).toHaveTextContent('0 gold');
        expect(screen.getByTestId('store-row-long_look')).toHaveTextContent('1/3');
        expect(screen.getByTestId('store-receipt')).toHaveTextContent('Upgraded Long Look to rank 1 of 3. 0 gold left.');
        expect(buy).toBeDisabled();
        expect(screen.getByTestId('store-descend')).toHaveFocus();
    });
    it('shows exact gold shortfalls and lets an empty purse continue', () => {
        const onDescend = vi.fn();
        render(<Camp gold={0} onDescend={onDescend} />);
        expect(screen.getByTestId('store-row-long_look')).toHaveTextContent('Need 8 more gold');
        fireEvent.click(screen.getByTestId('store-descend'));
        expect(onDescend).toHaveBeenCalledOnce();
    });
    it('caps ranks visibly and supports Escape to continue', () => {
        const onDescend = vi.fn();
        render(<Camp gold={100} onDescend={onDescend} />);
        for (let rank = 0; rank < 3; rank++) fireEvent.click(screen.getByTestId('store-buy-long_look'));
        expect(screen.getByTestId('store-buy-long_look')).toBeDisabled();
        expect(screen.getByTestId('store-buy-long_look')).toHaveTextContent('Max rank');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onDescend).toHaveBeenCalledOnce();
    });
});
