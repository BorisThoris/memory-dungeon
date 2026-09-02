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
import { getActiveContentLock, isDemoBuild } from '../../shared/content-lock-state';
import { RELIC_POOL } from '../../shared/relics';
import { getUiStateCopy } from '../../shared/ui-state-copy';
import { Eyebrow, ScreenTitle, UiButton } from '../ui';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import metaStyles from './MetaScreen.module.css';
import { getMetaSubscreenLayout } from './metaStackedShellLayout';
import {
    buildCodexBuildRows,
    buildCodexModeRows,
    buildCodexMutatorRows,
    buildCodexRelicRows,
    CODEX_TOC,
    filterTopics
} from './codexScreenModel';
import styles from './CodexScreen.module.css';

/**
 * Codex. One section rail, one filter, one grid of entries. Each entry is a card: the section
 * it belongs to, its title, one description. A filter searches every section at once.
 */

interface CodexScreenProps {
    /** When true, shell title is `h2` so `GameScreen`'s level `h1` stays the sole document `h1`. */
    stackedOnGameplay?: boolean;
}

interface CodexEntry {
    id: string;
    title: string;
    description: string;
}

interface CodexSection {
    id: string;
    label: string;
    kicker: string;
    entries: readonly CodexEntry[];
}

const sectionIdFromHref = (href: string): string => href.replace('#codex-', '');

const CodexScreen = ({ stackedOnGameplay = false }: CodexScreenProps) => {
    const { closeSubscreen, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            settings: state.settings
        }))
    );
    const { shellStageClass, titleLevel } = getMetaSubscreenLayout(stackedOnGameplay, {
        panel: '',
        hero: ''
    });
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [debouncedFilterQuery, setDebouncedFilterQuery] = useState('');
    const [activeSectionId, setActiveSectionId] = useState('core');
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const playUiClick = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    };

    useEffect(() => {
        const schedule = window.setTimeout(() => setDebouncedFilterQuery(filterQuery), 125);
        return () => window.clearTimeout(schedule);
    }, [filterQuery]);

    const sections = useMemo((): CodexSection[] => {
        const entriesById: Record<string, { kicker: string; entries: readonly CodexEntry[] }> = {
            core: { kicker: 'Core system', entries: CODEX_CORE_TOPICS },
            powers: { kicker: 'Power', entries: ENCYCLOPEDIA_POWER_TOPICS },
            scoring: { kicker: 'Scoring', entries: ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS },
            settings: { kicker: 'Assist', entries: ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS },
            pickups: { kicker: 'Board', entries: ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS },
            traits: { kicker: 'Trait', entries: [...getTileTraitCodexRows(), ...getTileTraitInteractionCodexRows()] },
            contracts: { kicker: 'Contract', entries: ENCYCLOPEDIA_CONTRACT_TOPICS },
            'featured-runs': { kicker: 'Featured run', entries: ENCYCLOPEDIA_FEATURED_RUN_TOPICS },
            builds: { kicker: 'Build archetype', entries: buildCodexBuildRows() },
            modes: { kicker: 'Mode', entries: buildCodexModeRows() },
            achievements: { kicker: 'Achievement', entries: ACHIEVEMENTS },
            relics: { kicker: 'Relic', entries: buildCodexRelicRows() },
            mutators: { kicker: 'Mutator', entries: buildCodexMutatorRows() }
        };
        return CODEX_TOC.map((item) => {
            const id = sectionIdFromHref(item.href);
            const bucket = entriesById[id] ?? { kicker: item.label, entries: [] };
            return { id, label: item.label, kicker: bucket.kicker, entries: bucket.entries };
        });
    }, []);

    const filtering = debouncedFilterQuery.trim().length > 0;
    const visible = useMemo(() => {
        if (filtering) {
            return sections.flatMap((section) =>
                filterTopics(section.entries, debouncedFilterQuery).map((entry) => ({ entry, section }))
            );
        }
        const section = sections.find((candidate) => candidate.id === activeSectionId) ?? sections[0]!;
        return section.entries.map((entry) => ({ entry, section }));
    }, [activeSectionId, debouncedFilterQuery, filtering, sections]);
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
                        Everything the dungeon can put in front of you, in the words the run uses. Version{' '}
                        {ENCYCLOPEDIA_VERSION}; reading it changes nothing.
                    </p>
                    {isDemoBuild() ? (
                        <p className={metaStyles.subtitle} data-testid="codex-demo-cap">
                            Demo build: {getActiveContentLock().relicPool?.length ?? RELIC_POOL.length} of {RELIC_POOL.length}{' '}
                            relics and the first act of mutators are in play. The full game adds the rest.
                        </p>
                    ) : null}
                </div>
                <UiButton
                    size="md"
                    variant="secondary"
                    onClick={() => {
                        resumeUiSfxContext();
                        playUiBackSfx(uiGain);
                        closeSubscreen();
                    }}
                    type="button"
                >
                    Back
                </UiButton>
            </header>

            <div ref={bodyScrollRef} className={`${metaStyles.body} ${styles.body}`}>
                <div className={styles.toolbar}>
                    <div aria-label="Codex sections" className={styles.tabRail} role="tablist">
                        {sections.map((section) => (
                            <button
                                aria-controls="codex-entries"
                                aria-selected={!filtering && section.id === activeSectionId}
                                className={styles.tabButton}
                                id={`codex-tab-${section.id}`}
                                key={section.id}
                                onClick={() => {
                                    playUiClick();
                                    setActiveSectionId(section.id);
                                    setFilterQuery('');
                                }}
                                role="tab"
                                tabIndex={section.id === activeSectionId ? 0 : -1}
                                type="button"
                            >
                                {section.label}
                                <span className={styles.tabCount}>{section.entries.length}</span>
                            </button>
                        ))}
                    </div>
                    <label className={styles.filter}>
                        <span className={styles.srOnly}>Filter topics</span>
                        <input
                            aria-controls="codex-entries"
                            autoComplete="off"
                            className={styles.filterInput}
                            id="codex-filter-query"
                            onChange={(e) => setFilterQuery(e.target.value)}
                            placeholder="Filter every section…"
                            type="search"
                            value={filterQuery}
                        />
                    </label>
                </div>

                {visible.length === 0 ? (
                    <p className={styles.filterEmpty}>
                        {filterEmptyCopy.message} {filterEmptyCopy.actionLabel}.
                    </p>
                ) : (
                    <ul
                        aria-labelledby={filtering ? undefined : `codex-tab-${activeSectionId}`}
                        aria-label={filtering ? `Entries matching “${debouncedFilterQuery.trim()}”` : undefined}
                        className={styles.grid}
                        data-testid="codex-entries"
                        id="codex-entries"
                        role="tabpanel"
                    >
                        {visible.map(({ entry, section }) => (
                            <li className={styles.card} data-section={section.id} key={`${section.id}:${entry.id}`}>
                                <span className={styles.cardKicker}>{section.kicker}</span>
                                <strong className={styles.cardTitle}>{entry.title}</strong>
                                <p className={styles.cardBody}>{entry.description}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default CodexScreen;
