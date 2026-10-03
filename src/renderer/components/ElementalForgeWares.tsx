import type { CSSProperties } from 'react';
import type { RunState } from '../../shared/contracts';
import { essenceOf, focusOf, storeElement, isElementalStoreId } from '../../shared/elemental-loot-rules';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import type { StoreOfferRow } from '../../shared/run-store-rules';
import { STORE_SHEET_COPY } from '../copy/storeSheet';
import styles from './StoreVault.module.css';

export function ElementalForgeWares({ run, offer, onBuy }: { run: RunState; offer: StoreOfferRow[]; onBuy: (row: StoreOfferRow) => void }) {
    return <div className={styles.forgeGrid} data-testid="elemental-forge">
        {TILE_SUITS.map(suit => <section className={styles.forgeElement} key={suit} style={{ '--forge-color': getTileSuit(suit).hue } as CSSProperties}>
            <header><span aria-hidden="true" className={styles.forgeRune}>{getTileSuit(suit).rune}</span><h3>{ELEMENT_NAMES[suit]}</h3>
                {run.elementStreak?.suit === suit && run.elementStreak.links >= 2 ? <span className={styles.forgePrimed}>Primed ×{run.elementStreak.links}</span> : null}
                <p data-testid={`forge-pouch-${suit}`}>{essenceOf(run.elementalEssence, suit)} essence · Focus {focusOf(run, suit)}</p></header>
            {offer.filter(row => isElementalStoreId(row.id) && storeElement(row.id) === suit).map(row => <div className={styles.forgeRecipe} key={row.id}>
                <strong>{row.kind === 'focus' ? 'Deepen the cast' : 'Prepare a reaction'}</strong>
                <p id={`forge-${row.id}`}>{STORE_SHEET_COPY.rowBody(row)}</p>
                <button type="button" data-testid={`store-buy-${row.id}`} data-blocked={row.blocked ?? 'none'}
                    aria-label={STORE_SHEET_COPY.buyAriaLabel(row)} aria-describedby={`forge-${row.id}`}
                    disabled={row.blocked !== null} onClick={() => onBuy(row)}>
                    {row.kind === 'focus' ? 'Forge' : 'Bottle'} · {STORE_SHEET_COPY.priceLabel(row)}
                </button>
            </div>)}
        </section>)}
    </div>;
}
