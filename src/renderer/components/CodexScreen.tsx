import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getTileTraitCodexRows, getTileTraitInteractionCodexRows } from '../../shared/tile-trait-codex';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import {
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import inRunFramedPanel from '../ui/metaInRunFramedPanel.module.css';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';
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

interface CodexScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

const CodexScreen = ({ stackedOnGameplay = false }: CodexScreenProps) => {
    const { closeSubscreen, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            settings: state.settings
        }))
    );
    const { shellStageClass, panelClassName, titleLevel } = getMetaSubscreenLayout(
        stackedOnGameplay,
        { panel: inRunFramedPanel.inRunPanel, hero: inRunFramedPanel.inRunHeroPanel }
    );
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [debouncedFilterQuery, setDebouncedFilterQuery] = useState('');
    const [codexTab, setCodexTab] = useState<CodexTab>('all');
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

    return (
        <section
            aria-label="Codex"
            className={[metaStyles.shell, shellStageClass, stackedOnGameplay && styles.codexInRunShell]
                .filter(Boolean)
                .join(' ')}
            data-codex-context={stackedOnGameplay ? 'in-run-desk' : 'menu'}
            data-testid="codex-screen"
            role="region"
        >
            <header className={metaStyles.header}>
                <div className={metaStyles.headerText}>
                    <Eyebrow tone="menu">Reference</Eyebrow>
                    <ScreenTitle as={titleLevel} role="display">
                        Codex
                    </ScreenTitle>
                    <p className={metaStyles.subtitle}>
                        Read-only mechanics encyclopedia (v{ENCYCLOPEDIA_VERSION}): achievements, relics, mutators, modes,
                        powers, scoring, settings assists, pickups, and board rules. Does not change gameplay.
                    </p>
                </div>
                <UiButton
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
            </header>

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

                <nav aria-label="Codex sections" className={metaStyles.inPageToc}>
                    {CODEX_TOC.filter((item) => tocVisible(codexTab, item.kind)).map((item) => (
                        <a
                            href={item.href}
                            key={item.href}
                            onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>

                <div className={styles.filterRow}>
                    <label className={styles.filterLabel} htmlFor="codex-filter-query">
                        Filter topics
                    </label>
                    <input
                        aria-controls="codex-main-column"
                        autoComplete="off"
                        className={styles.filterInput}
                        id="codex-filter-query"
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filter by keyword…"
                        type="search"
                        value={filterQuery}
                    />
                </div>

                {!anyFilterMatch ? (
                    <p className={styles.filterEmpty}>
                        {filterEmptyCopy.message} {filterEmptyCopy.actionLabel}.
                    </p>
                ) : null}

                <div id="codex-main-column">
                    {showGuidePanel(coreFiltered.length) ? (
                        <MetaFrame data-testid="codex-meta-frame-core">
                            <Panel className={panelClassName} padding="lg" variant="default">
                                <details
                                    className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                    id="codex-core"
                                    open
                                >
                                    <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                        Core systems
                                    </summary>
                                    <div className={styles.group}>
                                        {coreFiltered.map((topic) => (
                                            <div className={styles.entry} key={topic.id}>
                                                <strong>{topic.title}</strong>
                                                <p>{topic.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </Panel>
                        </MetaFrame>
                    ) : null}

                    {showGuidePanel(powersFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-powers"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Powers &amp; tools
                                </summary>
                                <div className={styles.group}>
                                    {powersFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(scoringFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-scoring"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Scoring &amp; survival
                                </summary>
                                <div className={styles.group}>
                                    {scoringFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(settingsFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-settings"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Settings &amp; assists
                                </summary>
                                <div className={styles.group}>
                                    {settingsFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(pickupsFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-pickups"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Pickups &amp; board
                                </summary>
                                <div className={styles.group}>
                                    {pickupsFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(traitsFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-traits"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Traits &amp; interactions
                                </summary>
                                <div className={styles.group}>
                                    {traitsFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(contractsFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-contracts"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Contracts &amp; vows
                                </summary>
                                <div className={styles.group}>
                                    {contractsFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(featuredFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-featured-runs"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Featured runs
                                </summary>
                                <div className={styles.group}>
                                    {featuredFiltered.map((topic) => (
                                        <div className={styles.entry} key={topic.id}>
                                            <strong>{topic.title}</strong>
                                            <p>{topic.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(buildRowsFiltered.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-builds"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Build archetypes
                                </summary>
                                <div className={styles.group}>
                                    {buildRowsFiltered.map((row) => (
                                        <div className={styles.entry} key={row.id}>
                                            <strong>{row.title}</strong>
                                            <p>{row.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showGuidePanel(filteredModes.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-modes"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Game modes
                                </summary>
                                <div className={styles.group}>
                                    {filteredModes.map((m) => (
                                        <div className={styles.entry} key={m.id}>
                                            <strong>{m.title}</strong>
                                            <p>{m.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showTablePanel(filteredAchievements.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-achievements"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>
                                    Achievements
                                </summary>
                                <div className={styles.group}>
                                    {filteredAchievements.map((a) => (
                                        <div className={styles.entry} key={a.id}>
                                            <strong>{a.title}</strong>
                                            <p>{a.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showTablePanel(filteredRelics.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-relics"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>Relics</summary>
                                <div className={styles.group}>
                                    {filteredRelics.map((r) => (
                                        <div className={styles.entry} key={r.id}>
                                            <strong>{r.title}</strong>
                                            <p>{r.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}

                    {showTablePanel(filteredMutators.length) ? (
                        <Panel className={panelClassName} padding="lg" variant="default">
                            <details
                                className={`${styles.sectionFold} ${metaStyles.sectionAnchor}`}
                                id="codex-mutators"
                                open
                            >
                                <summary className={`${styles.groupTitle} ${styles.foldSummary}`}>Mutators</summary>
                                <div className={styles.group}>
                                    {filteredMutators.map((m) => (
                                        <div className={styles.entry} key={m.id}>
                                            <strong>{m.title}</strong>
                                            <p>{m.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </Panel>
                    ) : null}
                </div>
            </div>
        </section>
    );
};

export default CodexScreen;
