import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { buyStoreItem } from '../../shared/run-store-rules';
import StoreVault from './StoreVault';
import { STORE_HOTSPOTS } from './storeVaultLayout';

const Vault = ({ gold, onDescend = vi.fn() }: { gold: number; onDescend?: () => void }) => {
    const [run, setRun] = useState<RunState>(() => ({ ...createNewRun(0), gold }));
    return (
        <StoreVault
            floor={3}
            onBuy={(id) => {
                const bought = buyStoreItem(run, id);
                if (bought) setRun(bought);
                return bought !== null;
            }}
            onDescend={onDescend}
            run={run}
        />
    );
};

describe('the store as a place', () => {
    it('is a labelled dialog whose wares are buttons on the room\'s objects, opening on Descend', () => {
        render(<Vault gold={12} />);
        const dialog = screen.getByTestId('store-sheet');
        expect(dialog).toHaveAttribute('role', 'dialog');
        expect(dialog).toHaveAccessibleName('Store');
        expect(document.activeElement).toBe(screen.getByTestId('store-descend'));
        expect(screen.getByTestId('store-descend')).toHaveTextContent('Descend');
        for (const spot of STORE_HOTSPOTS) {
            if (spot.id === 'descend') continue;
            const button = screen.getByTestId(`store-buy-${spot.id}`);
            expect(button).toHaveAttribute('style', expect.stringContaining('--spot-x'));
            expect(button.getAttribute('aria-label')).toMatch(/^Buy .* for \d+ gold$|: owned$/);
        }
        expect(screen.getByTestId('store-buy-bomb')).toHaveAccessibleName('Buy a bomb for 4 gold');
    });

    it('shows what a thing does on hover and on focus, and hides it again', () => {
        render(<Vault gold={12} />);
        const bomb = screen.getByTestId('store-buy-bomb');
        expect(bomb).toHaveAttribute('data-shown', 'false');
        fireEvent.mouseEnter(bomb);
        expect(bomb).toHaveAttribute('data-shown', 'true');
        expect(screen.getByTestId('store-row-bomb')).toHaveTextContent(/Flip a card, then bomb it/);
        fireEvent.mouseLeave(bomb);
        expect(bomb).toHaveAttribute('data-shown', 'false');
        act(() => bomb.focus());
        expect(bomb).toHaveAttribute('data-shown', 'true');
    });

    it('says a purchase once, in a status line inside the dialog, and never one that did not go through', () => {
        render(<Vault gold={12} />);
        const receipt = screen.getByTestId('store-receipt');
        expect(receipt).toHaveAttribute('role', 'status');
        expect(receipt.textContent).toBe('');
        act(() => screen.getByTestId('store-buy-bomb').click());
        expect(receipt).toHaveTextContent(/^Bought a bomb\. 8 gold left\.$/);
        act(() => screen.getByTestId('store-buy-peek').click());
        expect(receipt).toHaveTextContent(/^Bought a peek\. 5 gold left\.$/);
        expect(screen.getByTestId('store-subtitle')).toHaveTextContent('5 gold');
    });

    it('moves focus on when the button that held it goes disabled, and to Descend when nothing is left', () => {
        render(<Vault gold={10} />);
        const longLook = screen.getByTestId('store-buy-long_look');
        expect(longLook).not.toBeDisabled();
        act(() => longLook.focus());
        act(() => longLook.click());
        expect(longLook).toBeDisabled();
        expect(longLook).toHaveAttribute('data-blocked', 'owned');
        expect(document.activeElement).toBe(screen.getByTestId('store-descend'));
    });

    it('descends on Escape and on the trapdoor', () => {
        const onDescend = vi.fn();
        render(<Vault gold={5} onDescend={onDescend} />);
        act(() => screen.getByTestId('store-descend').click());
        expect(onDescend).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onDescend).toHaveBeenCalledTimes(2);
    });
});
