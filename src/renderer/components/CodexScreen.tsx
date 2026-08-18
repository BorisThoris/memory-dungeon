import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    ACHIEVEMENTS,
    CODEX_CORE_TOPICS,
    ENCYCLOPEDIA_CONTRACT_TOPICS,
    ENCYCLOPEDIA_FEATURED_RUN_TOPICS,
    ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
    ENCYCLOPEDIA_POWER_TOPICS,
    ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
    ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
    ENCYCLOPEDIA_VERSION
} from '../../shared/game-catalog';
import { getCodexKnowledgeBaseRows } from '../../shared/codex-knowledge-base';
import { getCodexRewardSignal } from '../../shared/meta-reward-signals';
import { getTileTraitCodexRows, getTileTraitInteractionCodexRows } from '../../shared/tile-trait-codex';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { cx, MetaFrame, Panel, UiButton } from '../ui';
import {
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { VIEWPORT_MOBILE_MAX } from '../breakpoints';
import { useViewportSize } from '../hooks/useViewportSize';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import MetaScreenHeader from './MetaScreenHeader';
import MetaSearchField from './MetaSearchField';
import MetaSectionRail from './MetaSectionRail';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import {
    buildCodexBuildRows,
    buildCodexModeRows,
    buildCodexMutatorRows,
    buildCodexRelicRows,
    codexTabAllows,
    CODEX_TOC,
    filterTopics,
    hasCodexFilterMatch,
    tocVisible,
    type CodexTab
} from './codexScreenModel';
import styles from './CodexScreen.module.css';

const CODEX_HEADER_SUBTITLE = `Read-only reference v${ENCYCLOPEDIA_VERSION} for cards, traits, rewards, and run rules.`;

interface CodexScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const formatCodexRewardSignalLabel = (signal: { body: string; cta: string; title: string }): string =>
    `Codex reward signal. ${signal.title}. ${signal.body} Next: ${signal.cta}.`;

const CODEX_SECTION_COMPACT_LABELS: Record<(typeof CODEX_TOC)[number]['label'], string> = {
    Achievements: 'Achieve',
    Builds: 'Build',
    Contracts: 'Vows',
    Core: 'Core',
    Featured: 'Runs',
    Modes: 'Modes',
    Mutators: 'Mods',
    Pickups: 'Pickups',
    Powers: 'Powers',
    Relics: 'Relics',
    Scoring: 'Score',
    Settings: 'Assist',
    Traits: 'Traits'
};

const CODEX_SECTION_RAIL_ITEMS: ReadonlyArray<{
    compactLabel: string;
    href: string;
    kind: (typeof CODEX_TOC)[number]['kind'];
    label: string;
}> = CODEX_TOC.map((item) => ({
    compactLabel: CODEX_SECTION_COMPACT_LABELS[item.label],
    href: item.href,
    kind: item.kind,
    label: item.label
}));

type CodexTopicRow = {
    description: string;
    id: string;
    title: string;
};

type CodexTopicPanelConfig = {
    dataTestId?: string;
    id: string;
    open?: boolean;
    rows: readonly CodexTopicRow[];
    show: boolean;
    title: ReactNode;
};

const formatCodexDisplayText = (value: string): string =>
    value
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');

const renderCodexTopicPanel = (
    { dataTestId, id, open = true, rows, show, title }: CodexTopicPanelConfig,
    panelClassName: string | undefined
): ReactNode => {
    if (!show) {
        return null;
    }

    const panel = (
        <Panel className={panelClassName} key={id} padding="lg" variant="default">
            <details className={cx(styles.sectionFold, metaStyles.sectionAnchor)} id={id} open={open}>
                <summary className={cx(styles.groupTitle, styles.foldSummary)}>{title}</summary>
                <div className={styles.group}>
                    {rows.map((topic) => (
                        <div className={styles.entry} key={topic.id}>
                            <strong>{topic.title}</strong>
                            <p>{formatCodexDisplayText(topic.description)}</p>
                        </div>
                    ))}
                </div>
            </details>
        </Panel>
    );

    return dataTestId ? (
        <MetaFrame data-testid={dataTestId} key={id}>
            {panel}
        </MetaFrame>
    ) : (
        panel
    );
};

const CodexScreen = ({ stackedOnGameplay = false }: CodexScreenProps) => {
    const { closeSubscreen, saveData, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            saveData: state.saveData,
            settings: state.settings
        }))
    );
    const { shellStageClass, panelClassName, heroPanelClassName, titleLevel } = getMetaSubscreenLayout(
        stackedOnGameplay,
        { panel: inRunFramedPanel.inRunPanel, hero: inRunFramedPanel.inRunHeroPanel }
    );
    const { width } = useViewportSize();
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [debouncedFilterQuery, setDebouncedFilterQuery] = useState('');
    const [codexTab, setCodexTab] = useState<CodexTab>('all');
    const codexRewardSignal = getCodexRewardSignal(saveData);
    const knowledgeRows = getCodexKnowledgeBaseRows();
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const playUiClick = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    };
    const playUiBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    };

    useEffect(() => {
        const schedule = window.setTimeout(() => setDebouncedFilterQuery(filterQuery), 125);
        return () => window.clearTimeout(schedule);
    }, [filterQuery]);

    const coreFiltered = filterTopics(CODEX_CORE_TOPICS, debouncedFilterQuery);
    const powersFiltered = filterTopics(ENCYCLOPEDIA_POWER_TOPICS, debouncedFilterQuery);
    const scoringFiltered = filterTopics(ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS, debouncedFilterQuery);
    const settingsFiltered = filterTopics(ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS, debouncedFilterQuery);
    const pickupsFiltered = filterTopics(ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS, debouncedFilterQuery);
    const traitRows = useMemo(
        () => [
            ...getTileTraitCodexRows(),
            ...getTileTraitInteractionCodexRows()
        ],
        []
    );
    const traitsFiltered = filterTopics(traitRows, debouncedFilterQuery);
    const contractsFiltered = filterTopics(ENCYCLOPEDIA_CONTRACT_TOPICS, debouncedFilterQuery);
    const featuredFiltered = filterTopics(ENCYCLOPEDIA_FEATURED_RUN_TOPICS, debouncedFilterQuery);
    const buildRows = useMemo(() => buildCodexBuildRows(), []);
    const buildRowsFiltered = filterTopics(buildRows, debouncedFilterQuery);

    const relicList = useMemo(() => buildCodexRelicRows(), []);
    const mutatorList = useMemo(() => buildCodexMutatorRows(), []);

    const filteredRelics = filterTopics(relicList, debouncedFilterQuery);
    const filteredMutators = filterTopics(mutatorList, debouncedFilterQuery);
    const filteredAchievements = filterTopics(ACHIEVEMENTS, debouncedFilterQuery);

    const modeRows = useMemo(() => buildCodexModeRows(), []);
    const filteredModes = filterTopics(modeRows, debouncedFilterQuery);

    const tabAllows = (kind: 'guide' | 'table'): boolean => codexTabAllows(codexTab, kind);

    const anyFilterMatch = hasCodexFilterMatch({
        guideCounts: [
            coreFiltered.length,
            powersFiltered.length,
            scoringFiltered.length,
            settingsFiltered.length,
            pickupsFiltered.length,
            traitsFiltered.length,
            contractsFiltered.length,
            featuredFiltered.length,
            buildRowsFiltered.length,
            filteredModes.length
        ],
        tableCounts: [filteredAchievements.length, filteredRelics.length, filteredMutators.length],
        tab: codexTab
    });

    const showWhenFiltered = (count: number): boolean => !debouncedFilterQuery.trim() || count > 0;

    const showGuidePanel = (count: number): boolean => tabAllows('guide') && showWhenFiltered(count);
    const showTablePanel = (count: number): boolean => tabAllows('table') && showWhenFiltered(count);
    const filterEmptyCopy = getUiStateCopy('codex_filter_empty');
    const deferReferenceMeta = width <= VIEWPORT_MOBILE_MAX;
    const showReferenceMeta = !(stackedOnGameplay && width <= VIEWPORT_MOBILE_MAX);
    const collapseMobileSections = width <= VIEWPORT_MOBILE_MAX && !debouncedFilterQuery.trim();
    const isSectionOpenByDefault = (index: number): boolean => !collapseMobileSections || index === 0;
    const referenceMetaBlock = (
        <>
            <MetaFrame className={styles.knowledgeSummaryFrame} data-testid="codex-knowledge-base-summary">
                <Panel className={heroPanelClassName} padding="md" variant="strong">
                    <div className={styles.knowledgeBaseGrid}>
                        {knowledgeRows.map((row) => (
                            <div className={styles.knowledgeBaseCard} key={row.id}>
                                <strong>{row.title}</strong>
                                <span>{row.count}</span>
                                <p>{row.action}</p>
                            </div>
                        ))}
                    </div>
                </Panel>
            </MetaFrame>

            <MetaFrame
                aria-label={formatCodexRewardSignalLabel(codexRewardSignal)}
                className={styles.rewardSignalFrame}
                data-testid="codex-reward-signal"
            >
                <Panel
                    className={cx(panelClassName, styles.rewardSignalPanel)}
                    padding="md"
                    variant="default"
                >
                    <strong className={styles.rewardSignalTitle}>{codexRewardSignal.title}</strong>
                    <p className={metaStyles.subtitle}>{codexRewardSignal.body}</p>
                    <p className={cx(metaStyles.subtitle, styles.rewardSignalCta)}>{codexRewardSignal.cta}</p>
                </Panel>
            </MetaFrame>
        </>
    );
    const guideSections: CodexTopicPanelConfig[] = [
        {
            dataTestId: 'codex-meta-frame-core',
            id: 'codex-core',
            rows: coreFiltered,
            show: showGuidePanel(coreFiltered.length),
            title: 'Core systems'
        },
        {
            id: 'codex-powers',
            rows: powersFiltered,
            show: showGuidePanel(powersFiltered.length),
            title: 'Powers & tools'
        },
        {
            id: 'codex-scoring',
            rows: scoringFiltered,
            show: showGuidePanel(scoringFiltered.length),
            title: 'Scoring & survival'
        },
        {
            id: 'codex-settings',
            rows: settingsFiltered,
            show: showGuidePanel(settingsFiltered.length),
            title: 'Settings & assists'
        },
        {
            id: 'codex-pickups',
            rows: pickupsFiltered,
            show: showGuidePanel(pickupsFiltered.length),
            title: 'Pickups & board'
        },
        {
            id: 'codex-traits',
            rows: traitsFiltered,
            show: showGuidePanel(traitsFiltered.length),
            title: 'Traits & interactions'
        },
        {
            id: 'codex-contracts',
            rows: contractsFiltered,
            show: showGuidePanel(contractsFiltered.length),
            title: 'Contracts & vows'
        },
        {
            id: 'codex-featured-runs',
            rows: featuredFiltered,
            show: showGuidePanel(featuredFiltered.length),
            title: 'Featured runs'
        },
        {
            id: 'codex-builds',
            rows: buildRowsFiltered,
            show: showGuidePanel(buildRowsFiltered.length),
            title: 'Build archetypes'
        },
        {
            id: 'codex-modes',
            rows: filteredModes,
            show: showGuidePanel(filteredModes.length),
            title: 'Game modes'
        }
    ];
    const tableSections: CodexTopicPanelConfig[] = [
        {
            id: 'codex-achievements',
            rows: filteredAchievements,
            show: showTablePanel(filteredAchievements.length),
            title: 'Achievements'
        },
        {
            id: 'codex-relics',
            rows: filteredRelics,
            show: showTablePanel(filteredRelics.length),
            title: 'Relics'
        },
        {
            id: 'codex-mutators',
            rows: filteredMutators,
            show: showTablePanel(filteredMutators.length),
            title: 'Mutators'
        }
    ];
    let visibleSectionIndex = 0;
    const renderResponsiveCodexTopicPanel = (section: CodexTopicPanelConfig): ReactNode => {
        const open = isSectionOpenByDefault(visibleSectionIndex);
        if (section.show) {
            visibleSectionIndex += 1;
        }
        return renderCodexTopicPanel({ ...section, open }, panelClassName);
    };

    return (
        <section
            aria-label="Codex"
            className={cx(metaStyles.shell, shellStageClass, stackedOnGameplay && styles.codexInRunShell)}
            data-codex-context={stackedOnGameplay ? 'in-run-desk' : 'menu'}
            data-codex-filter-state={debouncedFilterQuery.trim() ? 'filtered' : 'unfiltered'}
            data-testid="codex-screen"
            role="region"
        >
            <MetaScreenHeader
                action={
                    <UiButton
                        className={metaStyles.compactHeaderAction}
                        size="md"
                        variant="secondary"
                        onClick={() => {
                            playUiBack();
                            closeSubscreen();
                        }}
                        type="button"
                    >
                        Back
                    </UiButton>
                }
                className={cx(styles.screenHeader, metaStyles.denseDesktopHeader)}
                compact
                eyebrow="Reference"
                subtitle={CODEX_HEADER_SUBTITLE}
                subtitleClassName={styles.screenSubtitle}
                title="Codex"
                titleAs={titleLevel}
                titleClassName={styles.screenTitle}
                titleRole="display"
            />

            <div ref={bodyScrollRef} className={metaStyles.body}>
                <div className={styles.tabRail} role="tablist" aria-label="Codex browse">
                    {(
                        [
                            ['all', 'All'],
                            ['guides', 'Guides'],
                            ['tables', 'Tables']
                        ] as const
                    ).map(([id, label]) => (
                        <button
                            className={styles.tabButton}
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={codexTab === id}
                            id={`codex-tab-${id}`}
                            tabIndex={codexTab === id ? 0 : -1}
                            onClick={() => {
                                playUiClick();
                                setCodexTab(id);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <MetaSectionRail
                    ariaLabel="Codex sections"
                    bodyScrollRef={bodyScrollRef}
                    className={cx(styles.sectionRail, metaStyles.denseDesktopRail)}
                    compact
                    dataTestId="codex-section-rail"
                    items={CODEX_SECTION_RAIL_ITEMS.filter((item) => tocVisible(codexTab, item.kind))}
                />

                {!deferReferenceMeta && showReferenceMeta ? referenceMetaBlock : null}

                <div className={styles.filterRow} data-testid="codex-filter-row">
                    <MetaSearchField
                        ariaControls="codex-main-column"
                        id="codex-filter-query"
                        inputClassName={styles.filterInput}
                        label="Filter topics"
                        labelClassName={styles.filterLabel}
                        onChange={setFilterQuery}
                        placeholder="Filter by keyword…"
                        value={filterQuery}
                    />
                </div>

                {!anyFilterMatch ? (
                    <p className={styles.filterEmpty}>
                        {filterEmptyCopy.message} {filterEmptyCopy.actionLabel}.
                    </p>
                ) : null}

                <div
                    className={cx(styles.contentColumn, metaStyles.metaLongList)}
                    data-testid="codex-main-column"
                    id="codex-main-column"
                >
                    {guideSections.map(renderResponsiveCodexTopicPanel)}
                    {tableSections.map(renderResponsiveCodexTopicPanel)}
                </div>

                {deferReferenceMeta && showReferenceMeta ? referenceMetaBlock : null}
            </div>
        </section>
    );
};

export default CodexScreen;
