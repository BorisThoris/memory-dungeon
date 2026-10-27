import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import type { RunState } from '../../shared/contracts';
import { runGold, storeOffer, type StoreItemId, type StoreOfferRow } from '../../shared/run-store-rules';
import { useFocusLossRecovery } from '../a11y/focusLossRecovery';
import { acquireToolbarRovingPause } from '../a11y/toolbarRoving';
import { STORE_SHEET_COPY } from '../copy/storeSheet';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { storeWareGlyph } from './storeWareGlyphs';
import styles from './Camp.module.css';
import { relicScoreFactors } from '../../shared/snowball-relic-rules';
import { relicDefinition } from '../../shared/run-relic-rules';
import { availableEvolutions, EVOLUTION_PRICE } from '../../shared/relic-evolution-rules';
import type { BlueprintId } from '../../shared/boss-reward-rules';
import { EVOLUTION_LINES } from '../copy/relicEvolutionCopy';

interface StoreVaultProps {
    run: RunState;
    /** The floor just cleared, for the line that says what the stop is. */
    floor: number;
    /** Buys the item; true when the purchase went through. */
    onBuy: (id: StoreItemId) => boolean;
    onDescend: () => void;
    /** Evolves two rank-3 relics by a blueprint (`relic-evolution-rules.ts`). */
    onEvolve: (id: BlueprintId) => void;
}

/**
 * The stop every third floor (rules 100: the player's again, `snowball-relic-rules.ts`): three relics from the
 * run's seed, misses and tools, bought with the run's gold; Descend goes on. What the run's growing relics
 * multiply by now is read at the top, so a build is something the player watches climb.
 */
const StoreVault = ({ run, floor, onBuy, onDescend, onEvolve }: StoreVaultProps): ReactElement => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const spotsRef = useRef<HTMLDivElement | null>(null);
    const descendRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();
    const subtitleId = useId();
    const [receipt, setReceipt] = useState<StoreOfferRow | null>(null);
    const offer = storeOffer(run);
    const gold = runGold(run);
    const build = relicScoreFactors(run);
    const evolutions = availableEvolutions(run);

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

    return (
        <div aria-describedby={subtitleId} aria-labelledby={titleId} aria-modal="true"
            className={styles.camp} data-testid="store-sheet" ref={rootRef} role="dialog">
            <header className={styles.head}>
                <div><span className={styles.eyebrow}>Floor {floor} cleared · Camp</span>
                    <h2 id={titleId}>Make the next floors yours</h2></div>
                <strong className={styles.purse} data-testid="camp-gold">{gold} <span>gold</span></strong>
            </header>
            <p className={styles.subtitle} data-testid="store-subtitle" id={subtitleId}>
                Build your run or stock up for the next floor. The stop comes back every 3 floors, with a new shelf.
            </p>
            <div className={styles.scroll} ref={spotsRef} data-testid="store-rows">
                {build.length > 0 ? (
                    <p className={styles.subtitle} data-testid="store-build">
                        Your build: {build.map((entry) => `${relicDefinition(entry.id).title} ×${entry.factor.toFixed(2)}`).join(' · ')}
                    </p>
                ) : null}
                {evolutions.length > 0 ? <section className={styles.section} aria-label="Evolutions">
                    <div className={styles.sectionHead}><h3>Evolve</h3><span>Two relics at rank 3 and a boss's blueprint · Kept to the end of the run</span></div>
                    <div className={styles.grid}>{evolutions.map((recipe) =>
                        <article className={styles.card} key={recipe.id} data-testid={`store-evolve-${recipe.id}`}>
                            <div className={styles.cardHead}><h4>{recipe.title}</h4></div>
                            <p>{EVOLUTION_LINES[recipe.id]}</p>
                            <span className={styles.blocked}>{gold < EVOLUTION_PRICE ? `Need ${EVOLUTION_PRICE - gold} more gold` : ' '}</span>
                            <button data-testid={`store-evolve-buy-${recipe.id}`} disabled={gold < EVOLUTION_PRICE} type="button" onClick={() => onEvolve(recipe.id)}>
                                {`Evolve · ${EVOLUTION_PRICE} gold`}
                            </button>
                        </article>
                    )}</div>
                </section> : null}
                {(['relic', 'consumable'] as const).map(kind => <section key={kind} className={styles.section} aria-label={kind === 'relic' ? 'Run upgrades' : 'Supplies'}>
                    <div className={styles.sectionHead}><h3>{kind === 'relic' ? 'Build your run' : 'Need help now?'}</h3>
                        <span>{kind === 'relic' ? 'Three on this shelf, drawn for this run · Four slots · Kept to the end of the run' : 'One charge per purchase · Repeat purchases cost more'}</span></div>
                    <div className={styles.grid}>{offer.filter(row => row.kind === kind).map(row =>
                        <article className={styles.card} key={row.id} data-testid={`store-row-${row.id}`} data-maxed={row.blocked === 'max_rank'}>
                            <div className={styles.cardHead}>
                                <svg className={styles.ware} viewBox="0 0 40 40" aria-hidden="true">{storeWareGlyph(row.id)}</svg>
                                <h4>{row.title}</h4>
                                {row.rank !== undefined ? <span className={styles.rank} aria-label={`Rank ${row.rank} of 3`}>
                                    {[1, 2, 3].map(rank => <i key={rank} data-filled={rank <= row.rank!} />)}<span>{row.rank}/3</span>
                                </span> : null}
                            </div>
                            <p id={`${titleId}-${row.id}`}>{row.body}</p>
                            <span className={styles.blocked}>
                                {row.blocked === 'gold' ? `Need ${row.goldShortfall} more gold` : row.blocked === 'full' ? 'Your miss bank is full' : row.blocked === 'max_rank' ? 'Fully upgraded for this run' : row.blocked === 'no_bank' ? 'This mode has no miss bank' : row.blocked === 'owned' ? 'Already owned' : row.blocked === 'slots' ? 'Your four slots are full' : '\u00a0'}
                            </span>
                            <button aria-label={STORE_SHEET_COPY.buyAriaLabel(row)} aria-describedby={`${titleId}-${row.id}`}
                                data-testid={`store-buy-${row.id}`} disabled={row.blocked !== null} type="button"
                                onClick={() => { if (onBuy(row.id)) setReceipt(row); }}>
                                {row.blocked === 'max_rank' ? 'Max rank' : row.blocked === 'owned' ? 'Owned' : row.blocked === 'slots' ? 'No slot' : `${row.rank === undefined ? 'Buy' : row.rank ? 'Upgrade' : 'Unlock'} · ${row.price} gold`}
                            </button>
                        </article>
                    )}</div>
                </section>)}
            </div>
            <footer className={styles.footer}>
                <p aria-atomic="true" aria-live="polite" data-testid="store-receipt" role="status">
                    {receipt ? STORE_SHEET_COPY.receipt(receipt, gold) : 'Saving for an upgrade? Keep your gold and continue. Gold and upgrades reset when the run ends.'}
                </p>
                <button className={styles.continue} data-modal-initial-focus data-testid="store-descend" ref={descendRef} type="button" onClick={onDescend}>
                    Descend to floor {floor + 1} <span aria-hidden="true">→</span>
                </button>
            </footer>
        </div>
    );
};

export default StoreVault;
