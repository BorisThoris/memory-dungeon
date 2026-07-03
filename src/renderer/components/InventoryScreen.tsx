import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MUTATOR_CATALOG, RELIC_CATALOG } from '../../shared/game-catalog';
import { getRelicDecisionImpactCopy } from '../../shared/relics';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { inventoryScreenCopy } from '../copy/inventoryScreen';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';
import { createInventoryScreenModel, modeTitle } from './inventoryScreenModel';
import styles from './InventoryScreen.module.css';

interface InventoryScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const formatInventorySignalLabel = (
    label: string,
    rows: readonly { detail?: string; label?: string; value?: string; lane?: string; payoff?: string; nextCue?: string }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            [
                row.label ?? row.lane,
                row.value ?? row.payoff,
                row.nextCue,
                row.detail
            ].filter(Boolean).join(': ')
        )
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

type InventoryRewardPerkLaneMapEntry = {
    action: string;
    count: number;
    lane: string;
    payoff: string;
    slug: string;
};

const inventoryRewardPerkLaneSlug = (lane: string): string =>
    lane.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lane';

const inventoryRewardPerkLaneAction = (lane: string, slug = inventoryRewardPerkLaneSlug(lane)): string => {
    if (slug.includes('trait') || slug.includes('combo')) {
        return 'Set combo';
    }
    if (slug.includes('hazard') || slug.includes('control')) {
        return 'Pre-clear hazard';
    }
    if (slug.includes('chain')) {
        return 'Push chain';
    }
    if (slug.includes('key') || slug.includes('lock')) {
        return 'Open lock';
    }
    return 'Use perk';
};

const buildInventoryRewardPerkLaneMap = (
    rows: readonly { lane: string; payoff: string }[]
): InventoryRewardPerkLaneMapEntry[] => {
    const state = new Map<string, InventoryRewardPerkLaneMapEntry>();
    rows.forEach((row) => {
        const slug = inventoryRewardPerkLaneSlug(row.lane);
        const existing = state.get(slug);
        if (existing) {
            existing.count += 1;
            return;
        }
        state.set(slug, {
            action: inventoryRewardPerkLaneAction(row.lane, slug),
            count: 1,
            lane: row.lane,
            payoff: row.payoff,
            slug
        });
    });
    return [...state.values()];
};

const inventoryRewardPerkLaneMapAttr = (laneMap: readonly InventoryRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.slug}:${lane.count}`).join('>') : 'none';

const inventoryRewardPerkLaneActionMapAttr = (laneMap: readonly InventoryRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.slug}:${lane.action}:${lane.count}`).join('>') : 'none';

const inventoryRewardPerkLaneMapLabel = (laneMap: readonly InventoryRewardPerkLaneMapEntry[]): string =>
    laneMap.length > 0
        ? `Inventory reward perk lane map. ${laneMap.map((lane) => `${lane.lane}: ${lane.count}. ${lane.action}. ${lane.payoff}.`).join(' ')}`
        : 'Inventory reward perk lane map';

const inventoryRewardPerkLaneBeatCount = (lane: Pick<InventoryRewardPerkLaneMapEntry, 'count' | 'slug'>): 2 | 3 | 4 => {
    if (lane.count > 1 || lane.slug.includes('trait') || lane.slug.includes('chain')) {
        return 4;
    }
    if (lane.slug.includes('hazard') || lane.slug.includes('control') || lane.slug.includes('key')) {
        return 3;
    }
    return 2;
};

const inventoryRewardPerkLaneAudioCue = (
    lane: Pick<InventoryRewardPerkLaneMapEntry, 'slug'>
): 'reward-perk-lane-combo' | 'reward-perk-lane-chain' | 'reward-perk-lane-guard' | 'reward-perk-lane-key' | 'reward-perk-lane-setup' => {
    if (lane.slug.includes('trait') || lane.slug.includes('combo')) {
        return 'reward-perk-lane-combo';
    }
    if (lane.slug.includes('chain')) {
        return 'reward-perk-lane-chain';
    }
    if (lane.slug.includes('hazard') || lane.slug.includes('control')) {
        return 'reward-perk-lane-guard';
    }
    if (lane.slug.includes('key') || lane.slug.includes('lock')) {
        return 'reward-perk-lane-key';
    }
    return 'reward-perk-lane-setup';
};

const inventoryRewardPerkLaneScreenCue = (
    lane: Pick<InventoryRewardPerkLaneMapEntry, 'count' | 'slug'>
): 'burst' | 'chain' | 'guard' | 'unlock' | 'pulse' => {
    if (lane.count > 1 || lane.slug.includes('trait') || lane.slug.includes('combo')) {
        return 'burst';
    }
    if (lane.slug.includes('chain')) {
        return 'chain';
    }
    if (lane.slug.includes('hazard') || lane.slug.includes('control')) {
        return 'guard';
    }
    if (lane.slug.includes('key') || lane.slug.includes('lock')) {
        return 'unlock';
    }
    return 'pulse';
};

type RewardPerkSignalId = 'lane' | 'payoff' | 'moment' | 'next';

const rewardPerkSignalBeatCount = (signal: RewardPerkSignalId): 1 | 2 | 3 | 4 => {
    if (signal === 'payoff') {
        return 4;
    }
    if (signal === 'next') {
        return 3;
    }
    if (signal === 'moment') {
        return 2;
    }
    return 1;
};

type InventoryPayoffEngineTone = ReturnType<typeof createInventoryScreenModel>['payoffEngineSignal']['tone'];
type InventoryRunLoopSignal = ReturnType<typeof createInventoryScreenModel>['runLoopSignals'][number];
type InventoryLoadoutImpactSignal = NonNullable<ReturnType<typeof createInventoryScreenModel>['startingLoadoutRow']>['impactSignals'][number];

const inventoryPayoffEngineBeatCount = (tone: InventoryPayoffEngineTone): 2 | 4 | 5 => {
    if (tone === 'super') {
        return 5;
    }
    if (tone === 'burst') {
        return 4;
    }
    return 2;
};

const inventoryPayoffEngineAction = (tone: InventoryPayoffEngineTone): 'Push reward stack' | 'Prime payoff route' | 'Start loop' => {
    if (tone === 'super') {
        return 'Push reward stack';
    }
    if (tone === 'burst') {
        return 'Prime payoff route';
    }
    return 'Start loop';
};

const inventoryPayoffEngineAudioCue = (
    tone: InventoryPayoffEngineTone
): 'inventory-payoff-super' | 'inventory-payoff-burst' | 'inventory-payoff-setup' => {
    if (tone === 'super') {
        return 'inventory-payoff-super';
    }
    if (tone === 'burst') {
        return 'inventory-payoff-burst';
    }
    return 'inventory-payoff-setup';
};

const inventoryPayoffEngineScreenCue = (tone: InventoryPayoffEngineTone): 'super' | 'burst' | 'pulse' => {
    if (tone === 'super') {
        return 'super';
    }
    if (tone === 'burst') {
        return 'burst';
    }
    return 'pulse';
};

const inventoryRunLoopSignalBeatCount = (signal: InventoryRunLoopSignal): 2 | 3 | 4 => {
    if (signal.id === 'chain' && signal.value !== 'ready') {
        return 4;
    }
    if (signal.id === 'resource' && signal.nextCue.toLowerCase().includes('primed')) {
        return 4;
    }
    if (signal.id === 'trait' && signal.value !== 'scout') {
        return 4;
    }
    if (signal.id === 'pickup' && signal.value !== '0') {
        return 3;
    }
    return 2;
};

const inventoryRunLoopSignalAction = (signal: InventoryRunLoopSignal): 'Push chain' | 'Claim pickup' | 'Bank resource' | 'Cash trait' | 'Read loop' => {
    if (signal.id === 'chain') {
        return 'Push chain';
    }
    if (signal.id === 'pickup') {
        return 'Claim pickup';
    }
    if (signal.id === 'resource') {
        return 'Bank resource';
    }
    if (signal.id === 'trait') {
        return 'Cash trait';
    }
    return 'Read loop';
};

const inventoryRunLoopSignalAudioCue = (
    signal: InventoryRunLoopSignal
): 'inventory-loop-chain' | 'inventory-loop-pickup' | 'inventory-loop-resource' | 'inventory-loop-trait' | 'inventory-loop-neutral' => {
    if (signal.id === 'chain') {
        return 'inventory-loop-chain';
    }
    if (signal.id === 'pickup') {
        return 'inventory-loop-pickup';
    }
    if (signal.id === 'resource') {
        return 'inventory-loop-resource';
    }
    if (signal.id === 'trait') {
        return 'inventory-loop-trait';
    }
    return 'inventory-loop-neutral';
};

const inventoryRunLoopSignalScreenCue = (signal: InventoryRunLoopSignal): 'burst' | 'snap' | 'pulse' => {
    if (inventoryRunLoopSignalBeatCount(signal) >= 4) {
        return 'burst';
    }
    if (inventoryRunLoopSignalBeatCount(signal) === 3) {
        return 'snap';
    }
    return 'pulse';
};

const inventoryLoadoutImpactSignalBeatCount = (signal: InventoryLoadoutImpactSignal): 3 | 4 => {
    if (signal.tone === 'payoff') {
        return 4;
    }
    return 3;
};

const inventoryLoadoutImpactSignalAction = (signal: InventoryLoadoutImpactSignal): 'Bank resource' | 'Prime build' | 'Chase payoff' => {
    if (signal.tone === 'resource') {
        return 'Bank resource';
    }
    if (signal.tone === 'build') {
        return 'Prime build';
    }
    return 'Chase payoff';
};

const inventoryLoadoutImpactSignalAudioCue = (
    signal: InventoryLoadoutImpactSignal
): 'inventory-loadout-resource' | 'inventory-loadout-build' | 'inventory-loadout-payoff' => {
    if (signal.tone === 'resource') {
        return 'inventory-loadout-resource';
    }
    if (signal.tone === 'build') {
        return 'inventory-loadout-build';
    }
    return 'inventory-loadout-payoff';
};

const inventoryLoadoutImpactSignalScreenCue = (signal: InventoryLoadoutImpactSignal): 'pulse' | 'snap' | 'burst' => {
    if (signal.tone === 'payoff') {
        return 'burst';
    }
    if (signal.tone === 'build') {
        return 'snap';
    }
    return 'pulse';
};

const rewardPerkSignalAction = (signal: RewardPerkSignalId): 'Read lane' | 'Claim payoff' | 'Watch moment' | 'Play next' => {
    if (signal === 'payoff') {
        return 'Claim payoff';
    }
    if (signal === 'moment') {
        return 'Watch moment';
    }
    if (signal === 'next') {
        return 'Play next';
    }
    return 'Read lane';
};

const rewardPerkSignalAudioCue = (
    signal: RewardPerkSignalId
): 'reward-perk-lane' | 'reward-perk-payoff' | 'reward-perk-moment' | 'reward-perk-next' => {
    if (signal === 'payoff') {
        return 'reward-perk-payoff';
    }
    if (signal === 'moment') {
        return 'reward-perk-moment';
    }
    if (signal === 'next') {
        return 'reward-perk-next';
    }
    return 'reward-perk-lane';
};

const rewardPerkSignalScreenCue = (signal: RewardPerkSignalId): 'pulse' | 'burst' | 'snap' => {
    if (signal === 'payoff') {
        return 'burst';
    }
    if (signal === 'next') {
        return 'snap';
    }
    return 'pulse';
};

const InventoryScreen = ({ stackedOnGameplay = false }: InventoryScreenProps) => {
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const { closeSubscreen, run, saveData, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            run: state.run,
            saveData: state.saveData,
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
    const {
        activeTraitBuildRows,
        buildProfile,
        economyRows,
        equippedCosmetic,
        inventoryQuantityById,
        inventoryRows,
        loadoutSummary,
        payoffEngineSignal,
        perfectMemoryAttribution,
        prepRows,
        rewardPerkRows,
        rewardSignal,
        runLoopSignals,
        startingLoadoutRow
    } = createInventoryScreenModel(run, saveData);
    const runLoopSignalsLabel = formatInventorySignalLabel('Inventory run loop signals', runLoopSignals);
    const payoffEngineSignalLabel = formatInventorySignalLabel('Inventory payoff engine', [
        {
            label: payoffEngineSignal.label,
            nextCue: payoffEngineSignal.nextCue,
            value: `${inventoryPayoffEngineAction(payoffEngineSignal.tone)}. ${payoffEngineSignal.value}. ${payoffEngineSignal.detail}`
        }
    ]);
    const rewardPerkRowsLabel = formatInventorySignalLabel(
        'Inventory durable reward perks',
        rewardPerkRows.map((row) => ({
            detail: row.label,
            label: row.lane,
            nextCue: row.nextCue,
            value: `${row.payoff}. Moment: ${row.moment}`
        }))
    );
    const rewardPerkLaneMap = buildInventoryRewardPerkLaneMap(rewardPerkRows);
    const primaryRewardPerkLane = rewardPerkLaneMap[0] ?? null;
    const rewardPerkLaneMapAttr = inventoryRewardPerkLaneMapAttr(rewardPerkLaneMap);
    const rewardPerkLaneActionMapAttr = inventoryRewardPerkLaneActionMapAttr(rewardPerkLaneMap);
    const rewardPerkLaneMapLabel = inventoryRewardPerkLaneMapLabel(rewardPerkLaneMap);
    const payoffEngineBeatCount = inventoryPayoffEngineBeatCount(payoffEngineSignal.tone);
    const payoffEngineAction = inventoryPayoffEngineAction(payoffEngineSignal.tone);
    const payoffEngineAudio = inventoryPayoffEngineAudioCue(payoffEngineSignal.tone);
    const payoffEngineScreenCue = inventoryPayoffEngineScreenCue(payoffEngineSignal.tone);

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
                            <div
                                aria-label={payoffEngineSignalLabel}
                                className={styles.payoffEngineSignal}
                                data-inventory-payoff-engine-action={payoffEngineAction}
                                data-inventory-payoff-engine-audio={payoffEngineAudio}
                                data-inventory-payoff-engine-beats={payoffEngineBeatCount}
                                data-inventory-payoff-engine-screen-cue={payoffEngineScreenCue}
                                data-inventory-payoff-engine-tone={payoffEngineSignal.tone}
                                data-testid="inventory-payoff-engine"
                            >
                                <small>{payoffEngineSignal.label}</small>
                                <strong>{payoffEngineSignal.value}</strong>
                                <span>{payoffEngineSignal.detail}</span>
                                <b>{payoffEngineSignal.nextCue}</b>
                                <span aria-hidden="true" className={styles.payoffEngineSignalBeatPips}>
                                    {Array.from({ length: payoffEngineBeatCount }, (_, beatIndex) => (
                                        <i data-inventory-payoff-engine-beat={beatIndex + 1} key={beatIndex} />
                                    ))}
                                </span>
                            </div>
                            <div
                                aria-label={runLoopSignalsLabel}
                                className={styles.runLoopSignalRows}
                                data-testid="inventory-run-loop-signals"
                            >
                                {runLoopSignals.map((signal) => (
                                    <span
                                        data-run-loop-action={inventoryRunLoopSignalAction(signal)}
                                        data-run-loop-audio={inventoryRunLoopSignalAudioCue(signal)}
                                        data-run-loop-beats={inventoryRunLoopSignalBeatCount(signal)}
                                        data-run-loop-screen-cue={inventoryRunLoopSignalScreenCue(signal)}
                                        data-run-loop-signal={signal.tone}
                                        key={signal.id}
                                    >
                                        <small>{signal.label}</small>
                                        <strong>{signal.value}</strong>
                                        <b>{signal.nextCue}</b>
                                        <i>{inventoryRunLoopSignalAction(signal)}</i>
                                        <em>{signal.detail}</em>
                                        <span aria-hidden="true" className={styles.runLoopSignalBeatPips}>
                                            {Array.from({ length: inventoryRunLoopSignalBeatCount(signal) }, (_, beatIndex) => (
                                                <i data-run-loop-signal-beat={beatIndex + 1} key={beatIndex} />
                                            ))}
                                        </span>
                                    </span>
                                ))}
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
                                        <div
                                            aria-label={`${startingLoadoutRow.label} impact: ${startingLoadoutRow.impactSignals
                                                .map((signal) => `${signal.label}: ${signal.value}`)
                                                .join('. ')}`}
                                            className={styles.loadoutImpactSignals}
                                            data-testid="inventory-starting-loadout-signals"
                                        >
                                            {startingLoadoutRow.impactSignals.map((signal) => (
                                                <span
                                                    data-loadout-impact-action={inventoryLoadoutImpactSignalAction(signal)}
                                                    data-loadout-impact-audio={inventoryLoadoutImpactSignalAudioCue(signal)}
                                                    data-loadout-impact-beats={inventoryLoadoutImpactSignalBeatCount(signal)}
                                                    data-loadout-impact-screen-cue={inventoryLoadoutImpactSignalScreenCue(signal)}
                                                    data-loadout-impact-tone={signal.tone}
                                                    key={signal.label}
                                                >
                                                    <small>{signal.label}</small>
                                                    <strong>{signal.value}</strong>
                                                    <b>{inventoryLoadoutImpactSignalAction(signal)}</b>
                                                    <span aria-hidden="true" className={styles.loadoutImpactSignalBeatPips}>
                                                        {Array.from(
                                                            { length: inventoryLoadoutImpactSignalBeatCount(signal) },
                                                            (_, beatIndex) => (
                                                                <i data-loadout-impact-signal-beat={beatIndex + 1} key={beatIndex} />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
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
                                <div
                                    aria-label={rewardPerkRowsLabel}
                                    className={metaStyles.archiveCatalogGrid}
                                    data-reward-perk-lane-actions={rewardPerkLaneActionMapAttr}
                                    data-reward-perk-lane-map={rewardPerkLaneMapAttr}
                                    data-testid="inventory-reward-perks"
                                >
                                    {rewardPerkLaneMap.length > 1 ? (
                                        <div
                                            aria-label={rewardPerkLaneMapLabel}
                                            className={styles.rewardPerkLaneMap}
                                            data-reward-perk-lane-actions={rewardPerkLaneActionMapAttr}
                                            data-reward-perk-lane-map={rewardPerkLaneMapAttr}
                                            data-reward-perk-primary-lane={primaryRewardPerkLane?.slug ?? 'none'}
                                            data-reward-perk-primary-lane-action={primaryRewardPerkLane?.action ?? 'none'}
                                            data-reward-perk-primary-lane-audio={
                                                primaryRewardPerkLane ? inventoryRewardPerkLaneAudioCue(primaryRewardPerkLane) : 'none'
                                            }
                                            data-reward-perk-primary-lane-beats={
                                                primaryRewardPerkLane ? inventoryRewardPerkLaneBeatCount(primaryRewardPerkLane) : 0
                                            }
                                            data-reward-perk-primary-lane-payoff={primaryRewardPerkLane?.payoff ?? 'none'}
                                            data-reward-perk-primary-lane-screen-cue={
                                                primaryRewardPerkLane ? inventoryRewardPerkLaneScreenCue(primaryRewardPerkLane) : 'none'
                                            }
                                            data-testid="inventory-reward-perk-lane-map"
                                        >
                                            {primaryRewardPerkLane ? (
                                                <span
                                                    aria-label={`Primary inventory perk lane. ${primaryRewardPerkLane.lane}: ${primaryRewardPerkLane.action}. ${primaryRewardPerkLane.payoff}. ${inventoryRewardPerkLaneBeatCount(primaryRewardPerkLane)} beats.`}
                                                    className={styles.rewardPerkPrimaryLaneCue}
                                                    data-reward-perk-primary-lane={primaryRewardPerkLane.slug}
                                                    data-reward-perk-primary-lane-action={primaryRewardPerkLane.action}
                                                    data-reward-perk-primary-lane-audio={inventoryRewardPerkLaneAudioCue(primaryRewardPerkLane)}
                                                    data-reward-perk-primary-lane-beats={inventoryRewardPerkLaneBeatCount(primaryRewardPerkLane)}
                                                    data-reward-perk-primary-lane-payoff={primaryRewardPerkLane.payoff}
                                                    data-reward-perk-primary-lane-screen-cue={inventoryRewardPerkLaneScreenCue(primaryRewardPerkLane)}
                                                    data-testid="inventory-reward-perk-primary-lane"
                                                >
                                                    <small>Best perk lane</small>
                                                    <strong>{primaryRewardPerkLane.lane}</strong>
                                                    <b>{primaryRewardPerkLane.action}</b>
                                                    <em>{primaryRewardPerkLane.payoff}</em>
                                                    <span aria-hidden="true" className={styles.rewardPerkPrimaryLaneBeatPips}>
                                                        {Array.from(
                                                            { length: inventoryRewardPerkLaneBeatCount(primaryRewardPerkLane) },
                                                            (_, beatIndex) => (
                                                                <i data-reward-perk-primary-lane-beat={beatIndex + 1} key={beatIndex} />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {rewardPerkLaneMap.map((lane) => (
                                                <span
                                                    data-reward-perk-lane-action={lane.action}
                                                    data-reward-perk-lane-audio={inventoryRewardPerkLaneAudioCue(lane)}
                                                    data-reward-perk-lane-beats={inventoryRewardPerkLaneBeatCount(lane)}
                                                    data-reward-perk-lane-count={lane.count}
                                                    data-reward-perk-lane-kind={lane.slug}
                                                    data-reward-perk-lane-screen-cue={inventoryRewardPerkLaneScreenCue(lane)}
                                                    key={lane.slug}
                                                >
                                                    <small>{lane.lane}</small>
                                                    <strong>{lane.count}</strong>
                                                    <b>{lane.action}</b>
                                                    <em>{lane.payoff}</em>
                                                    <span aria-hidden="true" className={styles.rewardPerkLaneBeatPips}>
                                                        {Array.from(
                                                            { length: inventoryRewardPerkLaneBeatCount(lane) },
                                                            (_, beatIndex) => (
                                                                <i data-reward-perk-lane-beat={beatIndex + 1} key={beatIndex} />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    {rewardPerkRows.map((row) => (
                                        <div
                                            aria-label={`${row.label}. Lane: ${row.lane}. Payoff: ${row.payoff}. Moment: ${row.moment}. Next: ${row.nextCue}. ${row.detail}`}
                                            className={metaStyles.archiveCatalogRow}
                                            key={row.id}
                                        >
                                            <p className={metaStyles.archiveCatalogRowTitle}>{row.label}</p>
                                            <div
                                                aria-label={`${row.label}. Lane: ${row.lane}. Payoff: ${row.payoff}. Moment: ${row.moment}. Next: ${row.nextCue}. ${row.detail}`}
                                                className={styles.rewardPerkSignalRows}
                                            >
                                                {([
                                                    ['lane', 'Lane', row.lane],
                                                    ['payoff', 'Payoff', row.payoff],
                                                    ['moment', 'Moment', row.moment],
                                                    ['next', 'Next', row.nextCue]
                                                ] as const).map(([signal, label, value]) => (
                                                    <span
                                                        data-reward-perk-signal-action={rewardPerkSignalAction(signal)}
                                                        data-reward-perk-signal-audio={rewardPerkSignalAudioCue(signal)}
                                                        data-reward-perk-signal={signal}
                                                        data-reward-perk-signal-beats={rewardPerkSignalBeatCount(signal)}
                                                        data-reward-perk-signal-screen-cue={rewardPerkSignalScreenCue(signal)}
                                                        key={signal}
                                                    >
                                                        <small>{label}</small>
                                                        <strong>{value}</strong>
                                                        <b>{rewardPerkSignalAction(signal)}</b>
                                                        <span aria-hidden="true" className={styles.rewardPerkSignalBeatPips}>
                                                            {Array.from({ length: rewardPerkSignalBeatCount(signal) }, (_, beatIndex) => (
                                                                <i data-reward-perk-signal-beat={beatIndex + 1} key={beatIndex} />
                                                            ))}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
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
                                        <span
                                            aria-label={`${row.label} action cue. ${row.actionCue.label}: ${row.actionCue.detail}`}
                                            className={styles.inventoryActionCue}
                                            data-inventory-action-cue={row.actionCue.label}
                                            data-inventory-action-tone={row.actionCue.tone}
                                        >
                                            <small>Action</small>
                                            <strong>{row.actionCue.label}</strong>
                                            <em>{row.actionCue.detail}</em>
                                        </span>
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
