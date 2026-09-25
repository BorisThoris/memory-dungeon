import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { buyStoreItem } from '../../shared/run-store-rules';
import StoreSheetRows from './StoreSheetRows';

/** The sheet as the dialog hosts it: rows in a dialog whose Descend is its initial-focus action. */
const Sheet = ({ gold }: { gold: number }) => {
    const [run, setRun] = useState<RunState>(() => ({ ...createNewRun(0), gold }));
    return (
        <section role="dialog">
            <StoreSheetRows
                onBuy={(id) => {
                    const bought = buyStoreItem(run, id);
                    if (bought) setRun(bought);
                    return bought !== null;
                }}
                run={run}
            />
            <button data-modal-initial-focus="" type="button">
                Descend
            </button>
        </section>
    );
};

describe('the store sheet for a keyboard and a screen reader', () => {
    it('says a purchase once, in a status line inside the dialog', () => {
        render(<Sheet gold={12} />);
        const receipt = screen.getByTestId('store-receipt');
        expect(receipt).toHaveAttribute('role', 'status');
        expect(receipt.textContent).toBe('');

        act(() => screen.getByTestId('store-buy-bomb').click());
        expect(receipt).toHaveTextContent(/^Bought a bomb\. 8 gold left\.$/);

        act(() => screen.getByTestId('store-buy-peek').click());
        expect(receipt).toHaveTextContent(/^Bought a peek\. 5 gold left\.$/);
    });

    it('does not claim a purchase that did not go through', () => {
        render(<Sheet gold={0} />);
        // Every row is short of gold, so every button is disabled and a click is not a sale.
        act(() => screen.getByTestId('store-buy-bomb').click());
        expect(screen.getByTestId('store-receipt').textContent).toBe('');
    });

    it('moves focus on when the button that held it goes disabled, and to Descend when nothing is left', () => {
        render(<Sheet gold={10} />);
        const longLook = screen.getByTestId('store-buy-long_look');
        expect(longLook).not.toBeDisabled();
        longLook.focus();
        act(() => longLook.click());

        // Long Look is owned now and the gold is gone: nothing on the sheet can be bought.
        expect(longLook).toBeDisabled();
        expect(screen.getByTestId('store-receipt')).toHaveTextContent(/Bought Long Look, yours for the rest of the run\. 0 gold left\./);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Descend' }));
    });

    it('keeps focus in the rows while something is still for sale', () => {
        render(<Sheet gold={13} />);
        const longLook = screen.getByTestId('store-buy-long_look');
        longLook.focus();
        act(() => longLook.click());
        // 3 gold left buys a peek or a shuffle. Long Look is the last row, so focus goes back to the
        // nearest thing still for sale above it, not to the page.
        expect(document.activeElement?.getAttribute('data-testid')).toBe('store-buy-shuffle');
    });
});
