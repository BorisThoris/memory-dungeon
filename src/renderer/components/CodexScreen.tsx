import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { FittedGrid, MetaShell, SectionRail, UiButton } from '../ui';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
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

/** The encyclopedia writes emphasis as `**bold**`; a card shows the words, not the markers. */
const plainText = (text: string): string => text.replace(/\*\*/gu, '');

/**
 * The card's line: the sentence an entry leads with, cut on a word boundary at what three
 * lines of a card actually hold. It is a summary that opens into the whole entry, not the
 * only copy there is with its end hidden.
 */
const CARD_SUMMARY_LIMIT = 96;

const summarize = (description: string): string => {
    const plain = plainText(description).trim();
    const firstStop = plain.search(/[.!?](\s|$)/u);
    const sentence = firstStop === -1 ? plain : plain.slice(0, firstStop + 1);
    if (sentence.length <= CARD_SUMMARY_LIMIT) {
        return sentence;
    }
    const cut = sentence.slice(0, CARD_SUMMARY_LIMIT);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/u, '')}\u2026`;
};

/** Renders `**bold**` runs as emphasis so the entry reads as written. */
const renderEmphasis = (text: string): ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*)/gu).map((part, index) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
            <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>
        ) : (
            part
        )
    );

const CodexScreen = ({ stackedOnGameplay = false }: CodexScreenProps) => {
    const { closeSubscreen, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            settings: state.settings
        }))
    );
    const [filterQuery, setFilterQuery] = useState('');
    const [debouncedFilterQuery, setDebouncedFilterQuery] = useState('');
    const [activeSectionId, setActiveSectionId] = useState('core');
    const [openEntryKey, setOpenEntryKey] = useState<string | null>(null);
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
    const openEntry = openEntryKey
        ? sections
              .flatMap((section) => section.entries.map((entry) => ({ entry, section })))
              .find(({ entry, section }) => `${section.id}:${entry.id}` === openEntryKey) ?? null
        : null;
    const activeSection = sections.find((candidate) => candidate.id === activeSectionId) ?? sections[0]!;
    const visible = useMemo(() => {
        if (filtering) {
            return sections.flatMap((section) =>
                filterTopics(section.entries, debouncedFilterQuery).map((entry) => ({ entry, section }))
            );
        }
        return activeSection.entries.map((entry) => ({ entry, section: activeSection }));
    }, [activeSection, debouncedFilterQuery, filtering, sections]);
    const filterEmptyCopy = getUiStateCopy('codex_filter_empty');

    return (
        <MetaShell
            className={stackedOnGameplay ? styles.codexInRunShell : undefined}
            eyebrow="Reference"
            label="Codex"
            onBack={() => {
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                closeSubscreen();
            }}
            regionProps={{ 'data-codex-context': stackedOnGameplay ? 'in-run-desk' : 'menu' }}
            stackedOnGameplay={stackedOnGameplay}
            subtitle={
                isDemoBuild()
                    ? `Demo build: ${getActiveContentLock().relicPool?.length ?? RELIC_POOL.length} of ${RELIC_POOL.length} relics and Act I mutators are in play.`
                    : `Everything the dungeon can put in front of you, in the words the run uses. Version ${ENCYCLOPEDIA_VERSION}.`
            }
            testId="codex-screen"
            title="Codex"
            toolbar={
                <>
                    <SectionRail
                        activeId={activeSectionId}
                        controls="codex-entries"
                        idPrefix="codex-tab"
                        label="Codex sections"
                        onSelect={(id) => {
                            playUiClick();
                            setActiveSectionId(id);
                            setFilterQuery('');
                            setOpenEntryKey(null);
                        }}
                        options={sections.map((section) => ({
                            badge: String(section.entries.length),
                            id: section.id,
                            label: section.label
                        }))}
                    />
                    <label className={styles.filter}>
                        <span className={styles.srOnly}>Filter topics</span>
                        <input
                            aria-controls="codex-entries"
                            autoComplete="off"
                            className={styles.filterInput}
                            id="codex-filter-query"
                            onChange={(e) => {
                                setFilterQuery(e.target.value);
                                setOpenEntryKey(null);
                            }}
                            placeholder="Filter every section…"
                            type="search"
                            value={filterQuery}
                        />
                    </label>
                </>
            }
        >
            {openEntry ? (
                /*
                 * An entry runs to 888 characters. A card in a grid cannot hold that, and
                 * clamping it to three lines hid the half that answers the question, so the
                 * entry opens in place and reads in full.
                 */
                <article className={styles.entry} data-section={openEntry.section.id} data-testid="codex-entry">
                    <span className={styles.cardKicker}>{openEntry.section.kicker}</span>
                    <strong className={styles.entryTitle}>{openEntry.entry.title}</strong>
                    <p className={styles.entryBody}>{renderEmphasis(openEntry.entry.description)}</p>
                    <UiButton
                        data-testid="codex-entry-back"
                        onClick={() => {
                            playUiClick();
                            setOpenEntryKey(null);
                        }}
                        type="button"
                        variant="secondary"
                    >
                        Back to {openEntry.section.label}
                    </UiButton>
                </article>
            ) : (
                <FittedGrid
                    ariaLabel={filtering ? `Entries matching ${debouncedFilterQuery.trim()}` : activeSection.label}
                    emptyState={`${filterEmptyCopy.message} ${filterEmptyCopy.actionLabel}.`}
                    items={visible}
                    itemNoun="entries"
                    keyForItem={({ entry, section }) => `${section.id}:${entry.id}`}
                    minColumnWidth={250}
                    renderItem={({ entry, section }) => (
                        <button
                            className={styles.card}
                            data-section={section.id}
                            data-testid={`codex-card-${entry.id}`}
                            onClick={() => {
                                playUiClick();
                                setOpenEntryKey(`${section.id}:${entry.id}`);
                            }}
                            type="button"
                        >
                            <span className={styles.cardKicker}>{section.kicker}</span>
                            <strong className={styles.cardTitle}>{entry.title}</strong>
                            <p className={styles.cardBody}>{summarize(entry.description)}</p>
                        </button>
                    )}
                    resetKey={filtering ? `filter:${debouncedFilterQuery}` : `section:${activeSectionId}`}
                    rowHeight={146}
                    testId="codex-entries"
                />
            )}
        </MetaShell>
    );
};

export default CodexScreen;
