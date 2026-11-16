import { COMPONENT_PROSE } from '../copy/componentProse';
import { tr } from '../../shared/i18n';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import type { FusionId, RunState } from '../../shared/contracts';
import { runGold, storeOffer, type StoreItemId, type StoreOfferRow } from '../../shared/run-store-rules';
import { useFocusLossRecovery } from '../a11y/focusLossRecovery';
import { acquireToolbarRovingPause } from '../a11y/toolbarRoving';
import { STORE_SHEET_COPY } from '../copy/storeSheet';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { storeWareGlyph } from './storeWareGlyphs';
import styles from './Camp.module.css';
import { AWAKENING_FROM, availableFusions, awakeningDefinition, BUILD_PAYS_FROM, FUSION_PRICE, isSnowballRelicId, relicScoreFactors, relicScoreMultiplier, snowballRelicTitle } from '../../shared/snowball-relic-rules';
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
    /** Fuses two relics that grow into one power (`snowball-relic-rules.ts`, rules 102). */
    onFuse: (id: FusionId) => void;
}

/**
 * The stop every third floor (rules 100: the player's again, `snowball-relic-rules.ts`): three relics from the
 * run's seed, misses and tools, bought with the run's gold; Descend goes on. What the run's growing relics
 * multiply by now is read at the top, so a build is something the player watches climb.
 */
const StoreVault = ({ run, floor, onBuy, onDescend, onEvolve, onFuse }: StoreVaultProps): ReactElement => {
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
    const fusions = availableFusions(run);

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
                <div><span className={styles.eyebrow}>{tr.s("Floor")} {floor} {tr.s("cleared · Camp")}</span>
                    <h2 id={titleId}>{COMPONENT_PROSE.storeVaultMakeTheNextFloors}</h2></div>
                <strong className={styles.purse} data-testid="camp-gold">{gold} <span>gold</span></strong>
            </header>
            <p className={styles.subtitle} data-testid="store-subtitle" id={subtitleId}>
                {COMPONENT_PROSE.storeVaultBuildYourRunOr}
            </p>
            <div className={styles.scroll} ref={spotsRef} data-testid="store-rows">
                {build.length > 0 ? (
                    <p className={styles.subtitle} data-testid="store-build">
                        {tr.s("Your build:")} {build.map((entry) => `${snowballRelicTitle(run, entry.id, relicDefinition(entry.id).title)} ×${entry.factor.toFixed(2)}`).join(' · ')}
                        {(run.runRulesVersion ?? 0) >= BUILD_PAYS_FROM ? tr` · every match and every clear’s gold ×${relicScoreMultiplier(run).toFixed(2)}` : null}
                    </p>
                ) : null}
                {fusions.length > 0 ? <section className={styles.section} aria-label={tr.s("Fusions")}>
                    <div className={styles.sectionHead}><h3>{tr.s("Fuse")}</h3><span>{COMPONENT_PROSE.storeVaultTwoRelicsThatGrow}</span></div>
                    <div className={styles.grid}>{fusions.map((fusion) =>
                        <article className={styles.card} key={fusion.id} data-testid={`store-fuse-${fusion.id}`}>
                            <div className={styles.cardHead}><h4>{fusion.title}</h4></div>
                            <p>{fusion.body}</p>
                            <span className={styles.blocked}>{gold < FUSION_PRICE ? tr`Need ${FUSION_PRICE - gold} more gold` : fusion.from}</span>
                            <button data-testid={`store-fuse-buy-${fusion.id}`} disabled={gold < FUSION_PRICE} type="button" onClick={() => onFuse(fusion.id)}>
                                {tr`Fuse · ${FUSION_PRICE} gold`}
                            </button>
                        </article>
                    )}</div>
                </section> : null}
                {evolutions.length > 0 ? <section className={styles.section} aria-label={tr.s("Evolutions")}>
                    <div className={styles.sectionHead}><h3>{tr.s("Evolve")}</h3><span>{COMPONENT_PROSE.storeVaultTwoRelicsAtRank}</span></div>
                    <div className={styles.grid}>{evolutions.map((recipe) =>
                        <article className={styles.card} key={recipe.id} data-testid={`store-evolve-${recipe.id}`}>
                            <div className={styles.cardHead}><h4>{recipe.title}</h4></div>
                            <p>{EVOLUTION_LINES[recipe.id]}</p>
                            <span className={styles.blocked}>{gold < EVOLUTION_PRICE ? tr`Need ${EVOLUTION_PRICE - gold} more gold` : ' '}</span>
                            <button data-testid={`store-evolve-buy-${recipe.id}`} disabled={gold < EVOLUTION_PRICE} type="button" onClick={() => onEvolve(recipe.id)}>
                                {tr`Evolve · ${EVOLUTION_PRICE} gold`}
                            </button>
                        </article>
                    )}</div>
                </section> : null}
                {(['relic', 'consumable'] as const).map(kind => <section key={kind} className={styles.section} aria-label={kind === 'relic' ? tr.s('Run upgrades') : tr.s('Supplies')}>
                    <div className={styles.sectionHead}><h3>{kind === 'relic' ? tr.s('Build your run') : tr.s('Need help now?')}</h3>
                        <span>{kind === 'relic' ? COMPONENT_PROSE.storeVaultThreeOnThisShelf : COMPONENT_PROSE.storeVaultOneChargePerPurchase}</span></div>
                    <div className={styles.grid}>{offer.filter(row => row.kind === kind).map(row =>
                        <article className={styles.card} key={row.id} data-testid={`store-row-${row.id}`} data-maxed={row.blocked === 'max_rank'}>
                            <div className={styles.cardHead}>
                                <svg className={styles.ware} viewBox="0 0 40 40" aria-hidden="true">{storeWareGlyph(row.id)}</svg>
                                <h4>{row.title}</h4>
                                {row.rank !== undefined ? <span className={styles.rank} aria-label={tr`Rank ${row.rank} of 3`}>
                                    {[1, 2, 3].map(rank => <i key={rank} data-filled={rank <= row.rank!} />)}<span>{row.rank}/3</span>
                                </span> : null}
                            </div>
                            <p id={`${titleId}-${row.id}`}>{row.body}{(run.runRulesVersion ?? 0) >= AWAKENING_FROM && isSnowballRelicId(row.id) ? ` ${awakeningDefinition(row.id).mark}` : null}</p>
                            <span className={styles.blocked}>
                                {row.blocked === 'gold' ? tr`Need ${row.goldShortfall} more gold` : row.blocked === 'full' ? COMPONENT_PROSE.storeVaultYouHoldAllThe : row.blocked === 'max_rank' ? COMPONENT_PROSE.storeVaultFullyUpgradedForThis : row.blocked === 'no_bank' ? COMPONENT_PROSE.storeVaultThisModeHasNo : row.blocked === 'owned' ? tr.s('Already owned') : row.blocked === 'slots' ? tr.s('Your four slots are full') : '\u00a0'}
                            </span>
                            <button aria-label={STORE_SHEET_COPY.buyAriaLabel(row)} aria-describedby={`${titleId}-${row.id}`}
                                data-testid={`store-buy-${row.id}`} disabled={row.blocked !== null} type="button"
                                onClick={() => { if (onBuy(row.id)) setReceipt(row); }}>
                                {row.blocked === 'max_rank' ? tr.s('Max rank') : row.blocked === 'owned' ? tr.s('Owned') : row.blocked === 'slots' ? tr.s('No slot') : tr`${row.rank === undefined ? tr.s('Buy') : row.rank ? tr.s('Upgrade') : tr.s('Unlock')} · ${row.price} gold`}
                            </button>
                        </article>
                    )}</div>
                </section>)}
            </div>
            <footer className={styles.footer}>
                <p aria-atomic="true" aria-live="polite" data-testid="store-receipt" role="status">
                    {receipt ? STORE_SHEET_COPY.receipt(receipt, gold) : COMPONENT_PROSE.storeVaultSavingForAnUpgrade}
                </p>
                <button className={styles.continue} data-modal-initial-focus data-testid="store-descend" ref={descendRef} type="button" onClick={onDescend}>
                    {tr.s("Descend to floor")} {floor + 1} <span aria-hidden="true">→</span>
                </button>
            </footer>
        </div>
    );
};

export default StoreVault;
