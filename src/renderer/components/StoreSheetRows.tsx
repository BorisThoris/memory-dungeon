import { useRef, useState, type ReactElement } from 'react';
import type { RunState } from '../../shared/contracts';
import { runGold, storeOffer, type StoreItemId, type StoreOfferRow } from '../../shared/run-store-rules';
import { useFocusLossRecovery } from '../a11y/focusLossRecovery';
import { STORE_SHEET_COPY } from '../copy/storeSheet';
import styles from './GameScreen.module.css';

interface StoreSheetRowsProps {
    run: RunState;
    /** Buys the item; true when the purchase went through. */
    onBuy: (id: StoreItemId) => boolean;
}

/**
 * The store stop's rows: each thing on sale says what it is and carries its own price.
 *
 * The sheet used to describe the items in one list and sell them from a second, and the two
 * together outgrew the dialog: at 720px the last three descriptions were cut off while their
 * buttons stayed, so two relics were sold without saying what they did (Gen 263, found by the
 * playtest).
 *
 * Two things a sighted player gets for free are said here for everyone else. A purchase changes
 * nothing but a number in the subtitle and one button's label, so it is announced, once, in a
 * status line that lives inside the dialog (the HUD's own region is under it, and inert). And the
 * button that just bought the last relic, or the last thing the gold covered, goes disabled while
 * it holds focus: focus moves on to the next thing still for sale, or to Descend.
 */
const StoreSheetRows = ({ run, onBuy }: StoreSheetRowsProps): ReactElement => {
    const rowsRef = useRef<HTMLUListElement | null>(null);
    const [receipt, setReceipt] = useState<StoreOfferRow | null>(null);

    useFocusLossRecovery(rowsRef, {
        selector: 'button',
        fallback: () =>
            rowsRef.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>('[data-modal-initial-focus]') ?? null
    });

    return (
        <>
            <ul className={styles.storeRows} data-testid="store-rows" ref={rowsRef}>
                {storeOffer(run).map((row) => (
                    <li className={styles.storeRow} key={row.id}>
                        <span className={styles.storeRowTitle}>{row.title}</span>
                        <span className={styles.storeRowBody} data-testid={`store-row-${row.id}`}>
                            {STORE_SHEET_COPY.rowBody(row)}
                        </span>
                        <button
                            aria-label={STORE_SHEET_COPY.buyAriaLabel(row)}
                            className={styles.storeBuy}
                            data-testid={`store-buy-${row.id}`}
                            disabled={row.blocked !== null}
                            onClick={() => {
                                if (onBuy(row.id)) {
                                    setReceipt(row);
                                }
                            }}
                            type="button"
                        >
                            {STORE_SHEET_COPY.priceLabel(row)}
                        </button>
                    </li>
                ))}
            </ul>
            {/* Present and empty from the moment the sheet opens, so the first purchase is a change. */}
            <p aria-atomic="true" aria-live="polite" className={styles.srOnly} data-testid="store-receipt" role="status">
                {receipt ? STORE_SHEET_COPY.receipt(receipt, runGold(run)) : ''}
            </p>
        </>
    );
};

export default StoreSheetRows;
