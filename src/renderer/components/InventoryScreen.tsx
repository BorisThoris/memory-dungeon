import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GAME_MODE_CODEX, MUTATOR_CATALOG, RELIC_CATALOG } from '../../shared/game-catalog';
import { getRewardPerkRows } from '../../shared/bonus-rewards';
import { getCosmeticCollectionRows } from '../../shared/cosmetics';
import { getInventoryPrepRows } from '../../shared/inventory-prep';
import { getInventoryRewardSignal } from '../../shared/meta-reward-signals';
import { getRunInventoryRows, getRunLoadoutSummary } from '../../shared/run-inventory';
import { getRunEconomyRows } from '../../shared/run-economy';
import { getPerfectMemoryAttribution } from '../../shared/long-run-feedback';
import { getRunBuildProfile, getRelicDecisionImpactCopy } from '../../shared/relics';
import { getRunStartingLoadoutRow } from '../../shared/starting-loadouts';
import {
    getTraitBuildRewardRows,
    getTraitBuildRewardRowsForLoadout
} from '../../shared/trait-build-rewards';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { inventoryScreenCopy } from '../copy/inventoryScreen';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';
import styles from './InventoryScreen.module.css';

const modeTitle = (gameMode: string): string =>
    GAME_MODE_CODEX.find((m) => m.id === gameMode)?.title ?? gameMode;

interface InventoryScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const InventoryScreen = ({ stackedOnGameplay = false }: InventoryScreenProps) => {
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const { closeSubscreen, run, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            run: state.run,
            settings: state.settings
        }))
    );

    const { shellStageClass, panelClassName, heroPanelClassName, titleLevel } = getMetaSubscreenLayout(
        stackedOnGameplay,
        { panel: inRunFramedPanel.inRunPanel, hero: inRunFramedPanel.inRunHeroPanel }
    );
    const shellClassName = `${metaStyles.shell} ${shellStageClass} ${stackedOnGameplay ? styles.inRunInventoryShell : ''}`.trim();
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
                        <p className={metaStyles.subtitle}>No active expedition. Start a run from the main menu.</p>
                    </div>
                    <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                        Back
                    </UiButton>
                </header>
                <div ref={bodyScrollRef} className={metaStyles.body}>
                    <MetaFrame data-testid="inventory-meta-frame-empty">
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <p className={styles.emptyState}>
                                {emptyState.message} {emptyState.actionLabel}.
                            </p>
                        </Panel>
                    </MetaFrame>
                </div>
            </section>
        );
    }

    const contract = run.activeContract;
    const economyRows = getRunEconomyRows(run);
    const inventoryRows = getRunInventoryRows(run);
    const inventoryQuantityById = new Map(inventoryRows.map((row) => [row.id, row.quantity]));
    const loadoutSummary = getRunLoadoutSummary(run);
    const rewardSignal = getInventoryRewardSignal(run);
    const perfectMemoryAttribution = run ? getPerfectMemoryAttribution(run) : null;
    const prepRows = getInventoryPrepRows(run);
    const buildProfile = getRunBuildProfile(run);
    const startingLoadoutRow = getRunStartingLoadoutRow(run);
    const relicTraitBuildRows = getTraitBuildRewardRows().filter((row) =>
        row.relicIds.some((relicId) => run.relicIds.includes(relicId))
    );
    const activeTraitBuildRows = [...getTraitBuildRewardRowsForLoadout(run.startingLoadoutId), ...relicTraitBuildRows].filter(
        (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index
    );
    const rewardPerkRows = getRewardPerkRows(run);
    const equippedCosmetic = getCosmeticCollectionRows(useAppStore.getState().saveData).find((row) => row.equipped);

    return (
        <section aria-label="Inventory" className={shellClassName} role="region">
            <header className={metaStyles.header}>
                <div className={metaStyles.headerText}>
                    <Eyebrow tone="menu">Active run</Eyebrow>
                    <ScreenTitle as={titleLevel} role="display">
                        Inventory
                    </ScreenTitle>
                    <p className={metaStyles.subtitle}>Read-only snapshot of this descent (charges, relics, mutators).</p>
                </div>
                <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                    Back
                </UiButton>
            </header>

            <div ref={bodyScrollRef} className={metaStyles.body}>
                <nav aria-label="Inventory sections" className={metaStyles.inPageToc}>
                    <a href="#inventory-run" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Run
                    </a>
                    <a href="#inventory-build" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Build
                    </a>
                    <a href="#inventory-consumables" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Consumables
                    </a>
                    <a href="#inventory-relics" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Relics
                    </a>
                    <a href="#inventory-mutators" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Mutators
                    </a>
                    <a href="#inventory-charges" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Charges
                    </a>
                    <a href="#inventory-economy" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Economy
                    </a>
                    <a href="#inventory-contract" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Contract
                    </a>
                </nav>
                <MetaFrame data-testid="inventory-meta-frame-run">
                    <Panel className={heroPanelClassName} padding="lg" variant="strong">
                        <div className={`${styles.loadoutBoard} ${metaStyles.sectionAnchor}`} id="inventory-run">
                            <h2 className={styles.sectionTitle}>Run snapshot</h2>
                            <div className={metaStyles.archiveCatalogGrid} data-testid="inventory-reward-signal">
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>{rewardSignal.title}</p>
                                    <p className={metaStyles.subtitle}>{rewardSignal.body}</p>
                                    <span className={styles.cosmeticNote}>{rewardSignal.cta}</span>
                                </div>
                            </div>
                            <div className={styles.prepGrid} data-testid="inventory-prep-strip">
                                {prepRows.map((row) => (
                                    <div className={styles.prepCard} data-status={row.status} key={row.id}>
                                        <strong>{row.title}</strong>
                                        <span>{row.value}</span>
                                        <p>{row.detail}</p>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.kv}>
                                <div className={styles.kvRow}>
                                    <span>
                                        Mode<strong>{modeTitle(run.gameMode)}</strong>
                                    </span>
                                    <span>
                                        Floor<strong>{run.board?.level ?? run.stats.highestLevel}</strong>
                                    </span>
                                    <span>
                                        Lives<strong>{run.lives}</strong>
                                    </span>
                                </div>
                                <div className={styles.kvRow}>
                                    <span>
                                        Practice<strong>{run.practiceMode ? 'Yes' : 'No'}</strong>
                                    </span>
                                    <span>
                                        Achievements enabled<strong>{run.achievementsEnabled ? 'Yes' : 'No'}</strong>
                                    </span>
                                    <span>
                                        Powers used this run<strong>{run.powersUsedThisRun ? 'Yes' : 'No'}</strong>
                                    </span>
                                </div>
                                {run.dailyDateKeyUtc ? (
                                    <div className={styles.kvRow}>
                                        <span>
                                            Daily key (UTC)<strong>{run.dailyDateKeyUtc}</strong>
                                        </span>
                                    </div>
                                ) : null}
                                <div className={styles.kvRow}>
                                    <span>
                                        Loadout slots<strong>{loadoutSummary.equipped}/{loadoutSummary.capacity}</strong>
                                    </span>
                                    <span>
                                        Consumable stacks<strong>{loadoutSummary.totalStacks}</strong>
                                    </span>
                                    <span>
                                        Mid-run mutable<strong>{loadoutSummary.midRunMutable ? 'Yes' : 'No'}</strong>
                                    </span>
                                </div>
                            </div>
                            <p className={metaStyles.subtitle}>
                                {inventoryScreenCopy.perfectMemoryPowersHint(
                                    run.achievementsEnabled,
                                    run.powersUsedThisRun
                                )}{' '}
                                {perfectMemoryAttribution?.locked ? perfectMemoryAttribution.summary : ''}
                            </p>
                            {equippedCosmetic ? (
                                <p className={styles.cosmeticNote}>
                                    Cosmetic theme: <strong>{equippedCosmetic.title ?? equippedCosmetic.label}</strong> (
                                    {equippedCosmetic.slot}; fallback: {equippedCosmetic.fallback})
                                </p>
                            ) : null}
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="inventory-meta-frame-build">
                    <Panel className={panelClassName} padding="lg" variant="default">
                        <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-build">
                            <h2 className={styles.sectionTitle}>Build identity</h2>
                            {buildProfile.primary ? (
                                <>
                                    <div className={metaStyles.archiveCatalogGrid} data-testid="inventory-build-identity">
                                        <div className={metaStyles.archiveCatalogRow}>
                                            <p className={metaStyles.archiveCatalogRowTitle}>{buildProfile.summary}</p>
                                            <p className={metaStyles.subtitle}>{buildProfile.primary.summary}</p>
                                            <span className={styles.cosmeticNote}>
                                                Decisions: {buildProfile.primary.decisionVerbs.join(', ')}
                                            </span>
                                        </div>
                                        {buildProfile.signals.slice(0, 3).map((signal) => (
                                            <div className={metaStyles.archiveCatalogRow} key={signal.id}>
                                                <p className={metaStyles.archiveCatalogRowTitle}>
                                                    {signal.label}: {signal.score}
                                                </p>
                                                <p className={metaStyles.subtitle}>{signal.summary}</p>
                                                <span className={styles.cosmeticNote}>
                                                    Relics: {signal.supportingRelicIds.map((id) => RELIC_CATALOG[id]?.title ?? id).join(', ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className={styles.empty}>{buildProfile.summary}. Draft a relic to start shaping a build.</p>
                            )}
                            {startingLoadoutRow ? (
                                <div className={metaStyles.archiveCatalogGrid} data-testid="inventory-starting-loadout">
                                    <div className={metaStyles.archiveCatalogRow}>
                                        <p className={metaStyles.archiveCatalogRowTitle}>{startingLoadoutRow.label}</p>
                                        <p className={metaStyles.subtitle}>{startingLoadoutRow.summary}</p>
                                        <span className={styles.cosmeticNote}>{startingLoadoutRow.firstFloorDecision}</span>
                                    </div>
                                </div>
                            ) : null}
                            {activeTraitBuildRows.length > 0 ? (
                                <div className={metaStyles.archiveCatalogGrid} data-testid="inventory-trait-builds">
                                    {activeTraitBuildRows.slice(0, 4).map((row) => (
                                        <div className={metaStyles.archiveCatalogRow} key={row.id}>
                                            <p className={metaStyles.archiveCatalogRowTitle}>{row.label}</p>
                                            <p className={metaStyles.subtitle}>{row.decision}</p>
                                            <span className={styles.cosmeticNote}>{row.payoff}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {rewardPerkRows.length > 0 ? (
                                <div className={metaStyles.archiveCatalogGrid} data-testid="inventory-reward-perks">
                                    {rewardPerkRows.map((row) => (
                                        <div className={metaStyles.archiveCatalogRow} key={row.id}>
                                            <p className={metaStyles.archiveCatalogRowTitle}>{row.label}</p>
                                            <p className={metaStyles.subtitle}>{row.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="inventory-meta-frame-consumables">
                    <Panel className={panelClassName} padding="lg" variant="default">
                        <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-consumables">
                            <h2 className={styles.sectionTitle}>Run consumables and loadout</h2>
                            <div className={metaStyles.archiveCatalogGrid}>
                                {inventoryRows.map((row) => (
                                    <div className={metaStyles.archiveCatalogRow} key={row.slotId}>
                                        <p className={metaStyles.archiveCatalogRowTitle}>
                                            {row.label}: {row.quantityLabel}
                                        </p>
                                        <p className={metaStyles.subtitle}>
                                            {row.mutability}. {row.source} {'\u2192'} {row.useWindow}. {row.effectPreview}
                                        </p>
                                        {row.fullReason ?? row.unavailableReason ? (
                                            <span className={styles.inventoryRowNote}>
                                                {row.fullReason ?? row.unavailableReason}
                                            </span>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="inventory-meta-frame-relics">
                    <Panel className={panelClassName} padding="lg" variant="default">
                        <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-relics">
                            <h2 className={styles.sectionTitle}>Relics</h2>
                            {run.relicIds.length > 0 ? (
                                <div className={metaStyles.archiveCatalogGrid}>
                                    {run.relicIds.map((id) => {
                                        const def = RELIC_CATALOG[id];
                                        return (
                                            <div className={metaStyles.archiveCatalogRow} key={id}>
                                                <p className={metaStyles.archiveCatalogRowTitle}>{def?.title ?? id}</p>
                                                {def?.description ? (
                                                    <p className={metaStyles.subtitle}>{def.description}</p>
                                                ) : null}
                                                <p className={metaStyles.subtitle}>{getRelicDecisionImpactCopy(id)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className={styles.empty}>
                                    {getUiStateCopy('inventory_no_relics').message} {getUiStateCopy('inventory_no_relics').actionLabel}.
                                </p>
                            )}
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="inventory-meta-frame-mutators">
                    <Panel className={panelClassName} padding="lg" variant="default">
                        <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-mutators">
                            <h2 className={styles.sectionTitle}>Mutators</h2>
                            {run.activeMutators.length > 0 ? (
                                <div className={metaStyles.archiveCatalogGrid}>
                                    {run.activeMutators.map((id) => {
                                        const def = MUTATOR_CATALOG[id];
                                        return (
                                            <div className={metaStyles.archiveCatalogRow} key={id}>
                                                <p className={metaStyles.archiveCatalogRowTitle}>{def?.title ?? id}</p>
                                                {def?.description ? (
                                                    <p className={metaStyles.subtitle}>{def.description}</p>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className={styles.empty}>{getUiStateCopy('inventory_no_mutators').message}</p>
                            )}
                        </div>
                    </Panel>
                </MetaFrame>

                <Panel className={panelClassName} padding="lg" variant="default">
                    <div
                        className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`}
                        data-testid="inventory-charges-panel"
                        id="inventory-charges"
                    >
                        <h2 className={styles.sectionTitle}>Charges and tokens</h2>
                        <div className={styles.kv}>
                            <div className={styles.kvRow}>
                                <span>
                                    Shuffle charges<strong>{inventoryQuantityById.get('shuffle_charge') ?? 0}</strong>
                                </span>
                                <span>
                                    Destroy charges<strong>{inventoryQuantityById.get('destroy_charge') ?? 0}</strong>
                                </span>
                                <span>
                                    Peek charges<strong>{inventoryQuantityById.get('peek_charge') ?? 0}</strong>
                                </span>
                            </div>
                            <div className={styles.kvRow}>
                                <span>
                                    Stray remove<strong>{inventoryQuantityById.get('stray_remove_charge') ?? 0}</strong>
                                </span>
                                <span>
                                    Guard tokens<strong>{inventoryQuantityById.get('guard_token') ?? 0}</strong>
                                </span>
                                <span>
                                    Combo shards<strong>{inventoryQuantityById.get('combo_shard') ?? 0}</strong>
                                </span>
                            </div>
                            <div className={styles.kvRow}>
                                <span>
                                    Undo this floor<strong>{inventoryQuantityById.get('undo_charge') ?? 0}</strong>
                                </span>
                                <span>
                                    Free shuffle this floor
                                    <strong>{run.freeShuffleThisFloor ? 'Available' : 'Used / n/a'}</strong>
                                </span>
                                <span>
                                    Match score mult.<strong>{run.matchScoreMultiplier.toFixed(2)}&times;</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </Panel>

                <Panel className={panelClassName} padding="lg" variant="default">
                    <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-contract">
                        <h2 className={styles.sectionTitle}>Contract flags</h2>
                        {contract ? (
                            <ul className={styles.list}>
                                <li>No shuffle: {contract.noShuffle ? 'Yes' : 'No'}</li>
                                <li>No destroy: {contract.noDestroy ? 'Yes' : 'No'}</li>
                                <li>Max mismatches: {contract.maxMismatches === null ? 'None' : contract.maxMismatches}</li>
                            </ul>
                        ) : (
                            <p className={styles.empty}>{getUiStateCopy('inventory_no_contract').message}</p>
                        )}
                    </div>
                </Panel>

                <MetaFrame data-testid="inventory-meta-frame-economy">
                    <Panel className={panelClassName} padding="lg" variant="default">
                        <div className={`${styles.loadoutSection} ${metaStyles.sectionAnchor}`} id="inventory-economy">
                            <h2 className={styles.sectionTitle}>Run economy</h2>
                            <div className={metaStyles.archiveCatalogGrid}>
                                {economyRows.map((row) => (
                                    <div className={metaStyles.archiveCatalogRow} key={row.key}>
                                        <p className={metaStyles.archiveCatalogRowTitle}>
                                            {row.label}: {row.value}
                                        </p>
                                        <p className={metaStyles.subtitle}>
                                            {row.persistence}. {row.sink}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>
            </div>
        </section>
    );
};

export default InventoryScreen;
