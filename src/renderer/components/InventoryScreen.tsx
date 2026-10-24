import { EVOLUTIONS } from '../../shared/relic-evolution-rules';
import { runBlueprints } from '../../shared/boss-reward-rules';
import { blueprintLine, EVOLUTION_LINES } from '../copy/relicEvolutionCopy';
import { EvolutionGlyph } from './EvolutionGlyph';
import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MUTATOR_CATALOG } from '../../shared/game-catalog';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { useEscapeLeaves } from '../hooks/useEscapeLeaves';
import { useViewportSize } from '../hooks/useViewportSize';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import { createInventoryQuantityMap, modeTitle } from './inventoryScreenModel';
import styles from './InventoryScreen.module.css';
import { campUpgradeIdsFor, CURIO_RELIC_IDS, hasRelic, usesCampUpgrades, relicRank, relicDefinition, campUpgradeBenefit, heldRelicIds, RELIC_SLOTS, RELIC_SLOTS_FROM } from '../../shared/run-relic-rules';
import { RELIC_SLOT_COPY } from '../copy/relicSlotCopy';
import { runGold } from '../../shared/run-store-rules';
import { canAimMeteor, meteorCharges } from '../../shared/meteor-rules';

/**
 * Inventory. Two sections that matter mid-run: mutators, charges and tokens. The
 * run snapshot is one header line. Build identity, contract flags and economy restated the
 * codex and were removed.
 */

interface InventoryScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const CHARGE_ROWS: readonly { id: string; label: string }[] = [
    { id:'meteor_charge',label:'Meteors' },
    { id: 'crucible_charge', label: 'Crucibles' },
    { id: 'storm_glass_charge', label: 'Storm Glasses' },
    { id: 'still_bell_charge', label: 'Still Bells' },
    { id: 'shuffle_charge', label: 'Full shuffle' },
    { id: 'region_shuffle_charge', label: 'Row / swap' },
    { id: 'peek_charge', label: 'Peek' },
    { id: 'undo_charge', label: 'Undo this floor' }
];

/**
 * A phone, either way up, cannot show the three sections at once: sideways the body is 231px and
 * the two columns asked about 380 each, so the body scrolled and the fit contract failed it. There
 * the run's Inventory is tabs, one section to a page, charges first - the actions a player opens it
 * for mid-run. A window this short or narrow gets them; everything else keeps the two columns.
 */
const INVENTORY_TABS_MAX_WIDTH = 600;
const INVENTORY_TABS_MAX_HEIGHT = 560;
type InventoryTab = 'charges' | 'upgrades' | 'mutators';
const INVENTORY_TAB_LABEL: Readonly<Record<InventoryTab, string>> = {
    charges: 'Charges',
    upgrades: 'Upgrades',
    mutators: 'Mutators'
};

const InventoryScreen = ({ stackedOnGameplay = false }: InventoryScreenProps) => {
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const [tab, setTab] = useState<InventoryTab>('charges');
    const { height: viewportHeight, width: viewportWidth } = useViewportSize();
    const tabbed =
        stackedOnGameplay &&
        ((viewportWidth > 0 && viewportWidth <= INVENTORY_TABS_MAX_WIDTH) ||
            (viewportHeight > 0 && viewportHeight <= INVENTORY_TABS_MAX_HEIGHT));
    const { closeSubscreen, openModeSelect, run, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            openModeSelect: state.openModeSelect,
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

    useEscapeLeaves(handleBack);

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
                            {/* What lives here and the way to it: the bare action label was all that showed. */}
                            <div className={styles.emptyState}>
                                <p className={styles.empty}>{emptyState.body}</p>
                                <UiButton
                                    size="md"
                                    variant="primary"
                                    type="button"
                                    onClick={() => {
                                        resumeUiSfxContext();
                                        playUiClickSfx(uiGain);
                                        openModeSelect();
                                    }}
                                >
                                    {emptyState.actionLabel}
                                </UiButton>
                            </div>
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
        `Score ${run.stats.totalScore.toLocaleString()}`
    ].join(' · ');

    const upgradesSection = usesCampUpgrades(run) ? (
        <Panel className={panelClassName} padding="lg" variant="default">
            <section aria-label="Run upgrades" className={styles.section}>
                <h2 className={styles.sectionTitle}>Run upgrades · {runGold(run)} gold</h2>
                <p className={styles.upgradesNote}>Gold buys automatic upgrades every 3 floors.</p>
                {run.runRulesVersion >= RELIC_SLOTS_FROM ? (
                    <p className={styles.upgradesNote} data-testid="inventory-relic-slots">{RELIC_SLOT_COPY.slotsLine(heldRelicIds(run).length, RELIC_SLOTS)}</p>
                ) : null}
                <ul className={styles.chips}>{campUpgradeIdsFor(run).map(id => <li className={styles.chip} key={id}>
                    <strong>{relicDefinition(id).title} · Rank {relicRank(run, id)}/3</strong>
                    <span>{campUpgradeBenefit(id, relicRank(run, id))}</span>
                </li>)}
                {(run.evolutions ?? []).map((id) => <li className={styles.chip} data-testid={`inventory-evolution-${id}`} key={id}>
                    <strong><EvolutionGlyph className={styles.chipGlyph} id={id} />{EVOLUTIONS.find((recipe) => recipe.id === id)?.title ?? id} · Evolved</strong>
                    <span>{EVOLUTION_LINES[id as keyof typeof EVOLUTION_LINES] ?? ''}</span>
                </li>)}
                {runBlueprints(run).filter((id) => !(run.evolutions ?? []).includes(id)).map((id) => <li className={styles.chip} data-testid={`inventory-blueprint-${id}`} key={`blueprint-${id}`}>
                    <strong><EvolutionGlyph className={styles.chipGlyph} id={id} />Blueprint: {EVOLUTIONS.find((recipe) => recipe.id === id)?.title ?? id}</strong>
                    <span>{blueprintLine(id)}</span>
                </li>)}
                {CURIO_RELIC_IDS.filter((id) => hasRelic(run, id)).map((id) => <li className={styles.chip} data-testid={`inventory-relic-${id}`} key={id}>
                    <strong>{relicDefinition(id).title}</strong>
                    <span>{relicDefinition(id).body}</span>
                </li>)}</ul>
            </section>
        </Panel>
    ) : null;
    const mutatorsSection = (
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
    );
    const suppliesSection = (
        <Panel className={`${panelClassName} ${styles.supplies}`} padding="lg" variant="default">
            <section aria-labelledby="inventory-charges-title" className={styles.section} data-testid="inventory-charges-panel">
                <h2 className={styles.sectionTitle} id="inventory-charges-title">
                    Charges and tokens
                </h2>
                <div className={styles.meteorCallout}>
                    <span className={styles.meteorGlyph} aria-hidden="true">☄</span>
                    <div className={styles.meteorCopy}>
                        <strong>Meteor strike</strong>
                        <p>Collect shards, then choose a target.</p>
                    </div>
                    <UiButton type="button" variant="primary" disabled={!canAimMeteor({...run,status:run.status==='paused' ? run.timerState.pausedFromStatus ?? 'paused' : run.status})}
                        onClick={() => useAppStore.getState().armMeteor()}>Call meteor · {meteorCharges(run)}</UiButton>
                </div>
                <dl className={styles.charges}>
                    {CHARGE_ROWS.map((row) => (
                        <div className={styles.chargeRow} key={row.id}>
                            <dt>{row.label}</dt>
                            <dd>{quantities.get(row.id) ?? 0}</dd>
                        </div>
                    ))}
                    <div className={styles.chargeRow}>
                        <dt>Score multiplier</dt>
                        <dd>{run.matchScoreMultiplier.toFixed(2)}&times;</dd>
                    </div>
                </dl>
            </section>
        </Panel>
    );
    const tabs: InventoryTab[] = upgradesSection ? ['charges', 'upgrades', 'mutators'] : ['charges', 'mutators'];
    const shownTab = tabs.includes(tab) ? tab : 'charges';

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

            {tabbed ? (
                <div ref={bodyScrollRef} className={`${metaStyles.body} ${styles.tabbed}`} data-testid="inventory-tabbed">
                    <div aria-label="Inventory sections" className={styles.tabs} role="tablist">
                        {tabs.map((id) => (
                            <button
                                aria-controls={`inventory-tab-panel-${id}`}
                                aria-selected={shownTab === id}
                                className={styles.tab}
                                data-selected={shownTab === id}
                                data-testid={`inventory-tab-${id}`}
                                id={`inventory-tab-${id}`}
                                key={id}
                                onClick={() => {
                                    resumeUiSfxContext();
                                    playUiClickSfx(uiGain);
                                    setTab(id);
                                }}
                                role="tab"
                                type="button"
                            >
                                {INVENTORY_TAB_LABEL[id]}
                            </button>
                        ))}
                    </div>
                    <div aria-labelledby={`inventory-tab-${shownTab}`} className={styles.tabPanel} id={`inventory-tab-panel-${shownTab}`} role="tabpanel">
                        {shownTab === 'charges' ? suppliesSection : shownTab === 'upgrades' ? upgradesSection : mutatorsSection}
                    </div>
                </div>
            ) : (
                <div ref={bodyScrollRef} className={`${metaStyles.body} ${styles.columns}`}>
                    <div className={styles.main}>
                        {upgradesSection}
                        {mutatorsSection}
                    </div>

                    {suppliesSection}
                </div>
            )}
        </section>
    );
};

export default InventoryScreen;
