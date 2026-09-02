import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MUTATOR_CATALOG, RELIC_CATALOG } from '../../shared/game-catalog';
import { getRelicDecisionImpactCopy } from '../../shared/relics';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import { createInventoryQuantityMap, modeTitle } from './inventoryScreenModel';
import styles from './InventoryScreen.module.css';

/**
 * Inventory. Three sections that matter mid-run: relics, mutators, charges and tokens. The
 * run snapshot is one header line. Build identity, contract flags and economy restated the
 * codex and were removed.
 */

interface InventoryScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const CHARGE_ROWS: readonly { id: string; label: string }[] = [
    { id: 'shuffle_charge', label: 'Full shuffle' },
    { id: 'region_shuffle_charge', label: 'Row / swap' },
    { id: 'peek_charge', label: 'Peek' },
    { id: 'destroy_charge', label: 'Destroy pair' },
    { id: 'stray_remove_charge', label: 'Stray remove' },
    { id: 'undo_charge', label: 'Undo this floor' },
    { id: 'guard_token', label: 'Guard tokens' },
    { id: 'combo_shard', label: 'Combo shards' }
];

const InventoryScreen = ({ stackedOnGameplay = false }: InventoryScreenProps) => {
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const { closeSubscreen, run, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            run: state.run,
            settings: state.settings
        }))
    );

    const { shellStageClass, panelClassName, titleLevel } = getMetaSubscreenLayout(stackedOnGameplay, {
        panel: inRunFramedPanel.inRunPanel,
        hero: inRunFramedPanel.inRunHeroPanel
    });
    const shellClassName = `${metaStyles.shell} ${shellStageClass} ${stackedOnGameplay ? styles.inRunShell : ''}`.trim();
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const handleBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
        closeSubscreen();
    };

    if (!run) {
        const emptyState = getUiStateCopy('inventory_no_run');
        return (
            <section aria-label="Inventory" className={shellClassName} role="region">
                <header className={metaStyles.header}>
                    <div className={metaStyles.headerText}>
                        <Eyebrow tone="menu">Expedition</Eyebrow>
                        <ScreenTitle as={titleLevel} role="display">
                            Inventory
                        </ScreenTitle>
                        <p className={metaStyles.subtitle}>No active expedition.</p>
                    </div>
                    <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                        Back
                    </UiButton>
                </header>
                <div ref={bodyScrollRef} className={metaStyles.body}>
                    <MetaFrame data-testid="inventory-meta-frame-empty">
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <p className={styles.empty}>
                                {emptyState.message} {emptyState.actionLabel}.
                            </p>
                        </Panel>
                    </MetaFrame>
                </div>
            </section>
        );
    }

    const quantities = createInventoryQuantityMap(run);
    const floor = run.board?.level ?? run.stats.highestLevel;
    const snapshot = [
        `Floor ${floor}`,
        modeTitle(run.gameMode ?? 'classic'),
        `Score ${run.stats.totalScore.toLocaleString()}`,
        `Lives ${run.lives}`,
        `Shop gold ${run.shopGold}`
    ].join(' · ');

    return (
        <section aria-label="Inventory" className={shellClassName} role="region">
            <header className={metaStyles.header} data-testid="inventory-meta-frame-run">
                <div className={metaStyles.headerText}>
                    <Eyebrow tone="menu">Run snapshot</Eyebrow>
                    <ScreenTitle as={titleLevel} role="display">
                        Inventory
                    </ScreenTitle>
                    <p className={metaStyles.subtitle} data-testid="inventory-run-line">
                        {snapshot}
                    </p>
                </div>
                <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                    Back
                </UiButton>
            </header>

            <div ref={bodyScrollRef} className={`${metaStyles.body} ${styles.columns}`}>
                <div className={styles.main}>
                    <MetaFrame data-testid="inventory-meta-frame-relics">
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <section aria-labelledby="inventory-relics-title" className={styles.section}>
                                <h2 className={styles.sectionTitle} id="inventory-relics-title">
                                    Relics
                                </h2>
                                {run.relicIds.length > 0 ? (
                                    <ul className={styles.cards}>
                                        {run.relicIds.map((id) => {
                                            const def = RELIC_CATALOG[id];
                                            return (
                                                <li className={styles.card} key={id}>
                                                    <strong className={styles.cardTitle}>{def?.title ?? id}</strong>
                                                    {def?.description ? <span className={styles.cardLine}>{def.description}</span> : null}
                                                    <span className={styles.cardMuted}>{getRelicDecisionImpactCopy(id)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className={styles.empty}>
                                        {getUiStateCopy('inventory_no_relics').message} {getUiStateCopy('inventory_no_relics').actionLabel}.
                                    </p>
                                )}
                            </section>
                        </Panel>
                    </MetaFrame>

                    <MetaFrame data-testid="inventory-meta-frame-mutators">
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <section aria-labelledby="inventory-mutators-title" className={styles.section}>
                                <h2 className={styles.sectionTitle} id="inventory-mutators-title">
                                    Mutators
                                </h2>
                                {run.activeMutators.length > 0 ? (
                                    <ul className={styles.chips}>
                                        {run.activeMutators.map((id) => {
                                            const def = MUTATOR_CATALOG[id];
                                            return (
                                                <li className={styles.chip} key={id} title={def?.description}>
                                                    <strong>{def?.title ?? id}</strong>
                                                    {def?.description ? <span>{def.description}</span> : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className={styles.empty}>{getUiStateCopy('inventory_no_mutators').message}</p>
                                )}
                            </section>
                        </Panel>
                    </MetaFrame>
                </div>

                <Panel className={panelClassName} padding="lg" variant="default">
                    <section aria-labelledby="inventory-charges-title" className={styles.section} data-testid="inventory-charges-panel">
                        <h2 className={styles.sectionTitle} id="inventory-charges-title">
                            Charges and tokens
                        </h2>
                        <dl className={styles.charges}>
                            {CHARGE_ROWS.map((row) => (
                                <div className={styles.chargeRow} key={row.id}>
                                    <dt>{row.label}</dt>
                                    <dd>{quantities.get(row.id) ?? 0}</dd>
                                </div>
                            ))}
                            <div className={styles.chargeRow}>
                                <dt>Free shuffle this floor</dt>
                                <dd>{run.freeShuffleThisFloor ? 'Ready' : 'Used'}</dd>
                            </div>
                            <div className={styles.chargeRow}>
                                <dt>Match score multiplier</dt>
                                <dd>{run.matchScoreMultiplier.toFixed(2)}&times;</dd>
                            </div>
                        </dl>
                    </section>
                </Panel>
            </div>
        </section>
    );
};

export default InventoryScreen;
