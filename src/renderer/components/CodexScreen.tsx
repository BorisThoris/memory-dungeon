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
    ENCYCLOPEDIA_VERSION,
    GAME_MODE_CODEX,
    MUTATOR_CATALOG,
    RELIC_CATALOG,
    VISUAL_ENDLESS_MODE_LOCKED
} from '../../shared/game-catalog';
import { getCodexKnowledgeBaseRows } from '../../shared/codex-knowledge-base';
import type { MutatorId, RelicId } from '../../shared/contracts';
import { getCodexRewardSignal } from '../../shared/meta-reward-signals';
import { getRelicBuildArchetypeSummaries } from '../../shared/relics';
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
import styles from './CodexScreen.module.css';

interface CodexScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

type TextTopic = { title: string; description: string };

/** META-005: browse by article guides vs ID tables (rel/relic/mut/ach). */
type CodexTab = 'all' | 'guides' | 'tables';

type TocKind = 'guide' | 'table';

const TOC: { href: string; label: string; kind: TocKind }[] = [
    { href: '#codex-core', label: 'Core', kind: 'guide' },
    { href: '#codex-powers', label: 'Powers', kind: 'guide' },
    { href: '#codex-scoring', label: 'Scoring', kind: 'guide' },
    { href: '#codex-settings', label: 'Settings', kind: 'guide' },
    { href: '#codex-pickups', label: 'Pickups', kind: 'guide' },
    { href: '#codex-traits', label: 'Traits', kind: 'guide' },
    { href: '#codex-contracts', label: 'Contracts', kind: 'guide' },
    { href: '#codex-featured-runs', label: 'Featured', kind: 'guide' },
    { href: '#codex-builds', label: 'Builds', kind: 'guide' },
    { href: '#codex-modes', label: 'Modes', kind: 'guide' },
    { href: '#codex-achievements', label: 'Achievements', kind: 'table' },
    { href: '#codex-relics', label: 'Relics', kind: 'table' },
    { href: '#codex-mutators', label: 'Mutators', kind: 'table' }
];

function filterTopics<T extends TextTopic>(topics: readonly T[], query: string): T[] {
    const q = query.trim().toLowerCase();
    if (!q) {
        return [...topics];
    }
    return topics.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
}

function tocVisible(tab: CodexTab, kind: TocKind): boolean {
    if (tab === 'all') {
        return true;
    }
    if (tab === 'guides') {
        return kind === 'guide';
    }
    return kind === 'table';
}

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
    const buildRows = useMemo(
        () =>
            getRelicBuildArchetypeSummaries().map((row) => ({
                id: row.id,
                title: row.label,
                description: `${row.fantasy} ${row.summary} Decisions: ${row.decisionVerbs.join(', ')}. Relics: ${row.relicIds
                    .map((id) => RELIC_CATALOG[id]?.title ?? id)
                    .join(', ')}.`
            })),
        []
    );
    const buildRowsFiltered = filterTopics(buildRows, debouncedFilterQuery);

    const relicList = useMemo(
        () => (Object.keys(RELIC_CATALOG) as RelicId[]).map((id) => RELIC_CATALOG[id]),
        []
    );
    const mutatorList = useMemo(
        () => (Object.keys(MUTATOR_CATALOG) as MutatorId[]).map((id) => MUTATOR_CATALOG[id]),
        []
    );

    const filteredRelics = filterTopics(relicList, debouncedFilterQuery);
    const filteredMutators = filterTopics(mutatorList, debouncedFilterQuery);
    const filteredAchievements = filterTopics(ACHIEVEMENTS, debouncedFilterQuery);

    const modeRows = useMemo(
        () => [
            ...GAME_MODE_CODEX.map((m) => ({ id: m.id, title: m.title, description: m.description })),
            {
                id: 'visual_endless_locked',
                title: VISUAL_ENDLESS_MODE_LOCKED.title,
                description: VISUAL_ENDLESS_MODE_LOCKED.description
            }
        ],
        []
    );
    const filteredModes = filterTopics(modeRows, debouncedFilterQuery);

    const tabAllows = (kind: 'guide' | 'table'): boolean => {
        if (codexTab === 'all') {
            return true;
        }
        if (codexTab === 'guides') {
            return kind === 'guide';
        }
        return kind === 'table';
    };

    const anyFilterMatch = (() => {
        const q = debouncedFilterQuery.trim();
        const row = [
            tabAllows('guide') ? coreFiltered.length : 0,
            tabAllows('guide') ? powersFiltered.length : 0,
            tabAllows('guide') ? scoringFiltered.length : 0,
            tabAllows('guide') ? settingsFiltered.length : 0,
            tabAllows('guide') ? pickupsFiltered.length : 0,
            tabAllows('guide') ? traitsFiltered.length : 0,
            tabAllows('guide') ? contractsFiltered.length : 0,
            tabAllows('guide') ? featuredFiltered.length : 0,
            tabAllows('guide') ? buildRowsFiltered.length : 0,
            tabAllows('guide') ? filteredModes.length : 0,
            tabAllows('table') ? filteredAchievements.length : 0,
            tabAllows('table') ? filteredRelics.length : 0,
            tabAllows('table') ? filteredMutators.length : 0
        ];
        if (!q) {
            return row.some((n) => n > 0);
        }
        return row.some((n) => n > 0);
    })();

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
                    {TOC.filter((item) => tocVisible(codexTab, item.kind)).map((item) => (
                        <a
                            href={item.href}
                            key={item.href}
                            onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>

                <MetaFrame data-testid="codex-knowledge-base-summary">
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

                <MetaFrame data-testid="codex-reward-signal">
                    <Panel className={panelClassName} padding="md" variant="default">
                        <strong>{codexRewardSignal.title}</strong>
                        <p className={metaStyles.subtitle}>{codexRewardSignal.body}</p>
                        <p className={metaStyles.subtitle}>{codexRewardSignal.cta}</p>
                    </Panel>
                </MetaFrame>

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
