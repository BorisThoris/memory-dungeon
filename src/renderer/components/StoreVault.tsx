import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { RunState } from '../../shared/contracts';
import { runGold, storeOffer, type StoreItemId, type StoreOfferRow } from '../../shared/run-store-rules';
import { useFocusLossRecovery } from '../a11y/focusLossRecovery';
import { acquireToolbarRovingPause } from '../a11y/toolbarRoving';
import { STORE_SHEET_COPY } from '../copy/storeSheet';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { STORE_VAULT_ASPECT, storeHotspot } from './storeVaultLayout';
import { storeWareGlyph } from './storeWareGlyphs';
import styles from './StoreVault.module.css';
import { usesElementalLoot } from '../../shared/elemental-loot-rules';
import { ElementalForgeWares } from './ElementalForgeWares';

interface StoreVaultProps {
    run: RunState;
    /** The floor just cleared, for the line that says what the stop is. */
    floor: number;
    /** Buys the item; true when the purchase went through. */
    onBuy: (id: StoreItemId) => boolean;
    onDescend: () => void;
}

/**
 * The store stop as a place.
 *
 * The room behind is the merchant's vault (`sceneMood.ts` swaps the plate while this is open),
 * and the things on sale are the things in the painting: a ring of light on the coins, the
 * crystal, the scales, the bell, the ledger, the bottles, the lanterns, each a real button laid
 * on its object (`storeVaultLayout.ts`), with the name and price beside it and what it does on
 * hover or focus. The trapdoor in the floor is Descend. No sheet, no list.
 *
 * It is still a dialog for everyone who is not looking: labelled, focus-trapped, Escape descends,
 * the first focus is Descend, every hotspot has the same accessible name the sheet's button had,
 * a purchase is announced once in a status line, and a button that just sold out under focus
 * hands focus on rather than dropping it on the page.
 */
const StoreVault = ({ run, floor, onBuy, onDescend }: StoreVaultProps): ReactElement => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const spotsRef = useRef<HTMLDivElement | null>(null);
    const descendRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();
    const subtitleId = useId();
    const [receipt, setReceipt] = useState<StoreOfferRow | null>(null);
    const [shown, setShown] = useState<StoreItemId | null>(null);
    const offer = storeOffer(run);
    const gold = runGold(run);
    const elemental = usesElementalLoot(run);

    useModalFocusTrap({
        containerRef: rootRef,
        onActivate: acquireToolbarRovingPause,
        onDocumentKeyDown: (event) => {
            if (event.key === 'Escape' && !event.defaultPrevented && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                onDescend();
                return true;
            }
            return false;
        }
    });
    useEffect(() => {
        descendRef.current?.focus();
    }, []);
    useFocusLossRecovery(spotsRef, {
        selector: 'button',
        fallback: () => descendRef.current
    });

    const descend = storeHotspot('descend');
    return (
        <div
            aria-describedby={subtitleId}
            aria-labelledby={titleId}
            aria-modal="true"
            className={`${styles.vault} ${elemental ? styles.forge : ''}`}
            data-testid="store-sheet"
            ref={rootRef}
            role="dialog"
        >
            <div className={styles.head}>
                <h2 className={styles.title} id={titleId}>
                    {elemental ? 'Elemental forge' : STORE_SHEET_COPY.title}
                </h2>
                <p className={styles.subtitle} data-testid="store-subtitle" id={subtitleId}>
                    {elemental ? `Floor ${floor} cleared · ${gold} gold. Spend the essence you found: deepen a cast for this run, or bottle a reaction for the next floor.` : STORE_SHEET_COPY.subtitle(floor, gold)}
                </p>
            </div>
            <div className={styles.stage}>
                {elemental ? <div className={styles.forgeBody} ref={spotsRef}>
                    <ElementalForgeWares run={run} offer={offer} onBuy={row => { if (onBuy(row.id)) setReceipt(row); }} />
                    <button className={styles.forgeDescend} data-modal-initial-focus data-testid="store-descend" ref={descendRef} type="button" onClick={onDescend}>Descend</button>
                </div> :
                <div className={styles.plate} data-testid="store-rows" ref={spotsRef} style={{ '--store-plate-aspect': STORE_VAULT_ASPECT } as CSSProperties}>
                    {/* Descend first in the DOM (Tab from it reaches the wares), last on the floor. Only
                        what the stop stocked is here at all (`rollStoreStock`): a bare shelf is a bare shelf. */}
                    <button
                        className={`${styles.spot} ${styles.descend}`}
                        data-modal-initial-focus
                        data-testid="store-descend"
                        onClick={onDescend}
                        ref={descendRef}
                        style={spotStyle(descend.x, descend.y, descend.r)}
                        type="button"
                    >
                        <span className={styles.glint} aria-hidden="true" />
                        <span className={styles.ware} aria-hidden="true">
                            <svg viewBox="0 0 40 40">
                                <ellipse cx="20" cy="22" fill="#0b0810" rx="15" ry="9" stroke="#e8b96a" strokeWidth="1.2" />
                                <path d="M8 20 L32 20" stroke="#e8b96a" strokeOpacity="0.7" strokeWidth="1" />
                                <path d="M20 12 L20 30 M15 25 L20 30 L25 25" fill="none" stroke="#8fdcff" strokeWidth="1.8" />
                            </svg>
                        </span>
                        <span className={styles.chip} title={descend.object}>
                            <span className={styles.chipName}>{STORE_SHEET_COPY.descend}</span>
                        </span>
                    </button>
                    {offer.map((row, index) => {
                        const spot = storeHotspot(row.id);
                        const open = shown === row.id;
                        return (
                            <button
                                aria-describedby={`${titleId}-${row.id}`}
                                aria-label={STORE_SHEET_COPY.buyAriaLabel(row)}
                                className={styles.spot}
                                data-blocked={row.blocked ?? 'none'}
                                data-kind={row.kind}
                                data-shown={open ? 'true' : 'false'}
                                data-testid={`store-buy-${row.id}`}
                                disabled={row.blocked !== null}
                                key={row.id}
                                onBlur={() => setShown((current) => (current === row.id ? null : current))}
                                onClick={() => {
                                    if (onBuy(row.id)) setReceipt(row);
                                }}
                                onFocus={() => setShown(row.id)}
                                onMouseEnter={() => setShown(row.id)}
                                onMouseLeave={() => setShown((current) => (current === row.id ? null : current))}
                                style={{ ...spotStyle(spot.x, spot.y, spot.r), '--spot-col': index % 3, '--spot-row': Math.floor(index / 3) } as CSSProperties}
                                type="button"
                            >
                                <span className={styles.glint} aria-hidden="true" />
                                {/* The ware itself, drawn: it is on the shelf because the stop stocked it. */}
                                <span className={styles.ware} aria-hidden="true" data-testid={`store-ware-${row.id}`}>
                                    <svg viewBox="0 0 40 40">{storeWareGlyph(row.id)}</svg>
                                </span>
                                <span className={styles.chip}>
                                    <span className={styles.chipName}>{row.title}</span>
                                    <span className={styles.chipPrice}>{STORE_SHEET_COPY.priceLabel(row)}</span>
                                </span>
                                <span className={styles.card} data-testid={`store-row-${row.id}`} id={`${titleId}-${row.id}`}>
                                    <span className={styles.cardObject}>{spot.object}</span>
                                    {STORE_SHEET_COPY.rowBody(row)}
                                </span>
                            </button>
                        );
                    })}
                </div>}
            </div>
            {/* Present and empty from the moment the vault opens, so the first purchase is a change. */}
            <p aria-atomic="true" aria-live="polite" className={styles.srOnly} data-testid="store-receipt" role="status">
                {receipt ? STORE_SHEET_COPY.receipt(receipt, gold) : ''}
            </p>
        </div>
    );
};

const spotStyle = (x: number, y: number, r: number): CSSProperties =>
    ({ '--spot-x': x.toFixed(4), '--spot-y': y.toFixed(4), '--spot-r': r.toFixed(4) }) as CSSProperties;

export default StoreVault;
