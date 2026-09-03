import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ACHIEVEMENT_BY_ID } from '../../shared/achievements';
import { getCosmeticCollectionRows } from '../../shared/cosmetics';
import { HONOR_UNLOCK_CATALOG, HONOR_UNLOCK_ORDER, hasHonorUnlock } from '../../shared/honorUnlocks';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import { getMetaHonorMarks, getPermanentUpgradeRows } from '../../shared/meta-progression';
import { ACHIEVEMENT_IDS, getRelicPickCountRows } from '../../shared/save-data';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { FittedGrid, MetaShell, SectionRail } from '../ui';
import { collectionStorageNote } from '../copy/collectionStorageNote';
import { useAppStore } from '../store/useAppStore';
import styles from './CollectionScreen.module.css';

/**
 * Collection. One section rail over one fitted grid: achievements, honors, relics, cosmetics,
 * upgrades. Each card states what it is, whether it is earned, and what earns it. The reward
 * signal, gallery, payoff burst, lane-map and impact strips restated the same rows and are gone.
 */

type CollectionSectionId = 'achievements' | 'honors' | 'relics' | 'cosmetics' | 'upgrades';

interface CollectionEntry {
    id: string;
    title: string;
    detail: string;
    /** Right-aligned state chip: Earned, Locked, 3 picks, Equipped. */
    status: string;
    earned: boolean;
}

interface CollectionSection {
    id: CollectionSectionId;
    label: string;
    kicker: string;
    entries: readonly CollectionEntry[];
    /** "12 of 30" for the rail badge and the subtitle. */
    earnedCount: number;
}

const CollectionScreen = () => {
    const { closeSubscreen, saveData, settings, steamConnected } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            saveData: state.saveData,
            settings: state.settings,
            steamConnected: state.steamConnected
        }))
    );
    const [activeSectionId, setActiveSectionId] = useState<CollectionSectionId>('achievements');
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);

    const sections = useMemo((): CollectionSection[] => {
        const achievements: CollectionEntry[] = ACHIEVEMENT_IDS.map((id) => {
            const def = ACHIEVEMENT_BY_ID[id];
            const earned = saveData.achievements[id] === true;
            return {
                id,
                title: def?.title ?? id,
                detail: def?.description ?? '',
                status: earned ? 'Earned' : 'Locked',
                earned
            };
        });

        const honors: CollectionEntry[] = HONOR_UNLOCK_ORDER.map((id) => {
            const def = HONOR_UNLOCK_CATALOG[id];
            const earned = hasHonorUnlock(saveData, id);
            return { id, title: def.title, detail: def.description, status: earned ? 'Earned' : 'Locked', earned };
        });

        const relics: CollectionEntry[] = getRelicPickCountRows(saveData.playerStats?.relicPickCounts).map((row) => {
            const def = RELIC_CATALOG[row.id];
            return {
                id: row.id,
                title: def?.title ?? row.id,
                detail: def?.description ?? '',
                status: row.count > 0 ? `${row.count} ${row.count === 1 ? 'pick' : 'picks'}` : 'Never drafted',
                earned: row.count > 0
            };
        });

        const cosmetics: CollectionEntry[] = getCosmeticCollectionRows(saveData).map((row) => ({
            id: row.id,
            title: row.title ?? row.label,
            detail: row.description,
            status: row.equipped ? 'Equipped' : row.status === 'owned' ? 'Owned' : 'Locked',
            earned: row.status === 'owned'
        }));

        const upgrades: CollectionEntry[] = getPermanentUpgradeRows(saveData).map((row) => ({
            id: row.id,
            title: row.title,
            detail: `${row.description} Reward: ${row.reward}.`,
            status:
                row.status === 'owned'
                    ? 'Owned'
                    : `${row.progress.current}/${row.progress.target} · ${row.cost} marks`,
            earned: row.status === 'owned'
        }));

        return [
            { id: 'achievements', label: 'Achievements', kicker: 'Achievement', entries: achievements, earnedCount: achievements.filter((row) => row.earned).length },
            { id: 'honors', label: 'Honors', kicker: 'Honor', entries: honors, earnedCount: honors.filter((row) => row.earned).length },
            { id: 'relics', label: 'Relics', kicker: 'Relic', entries: relics, earnedCount: relics.filter((row) => row.earned).length },
            { id: 'cosmetics', label: 'Cosmetics', kicker: 'Cosmetic', entries: cosmetics, earnedCount: cosmetics.filter((row) => row.earned).length },
            { id: 'upgrades', label: 'Upgrades', kicker: 'Permanent upgrade', entries: upgrades, earnedCount: upgrades.filter((row) => row.earned).length }
        ];
    }, [saveData]);

    const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0]!;
    const honorMarks = getMetaHonorMarks(saveData);

    return (
        <MetaShell
            eyebrow="Archive"
            label="Collection"
            onBack={() => {
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                closeSubscreen();
            }}
            subtitle={`${activeSection.earnedCount} of ${activeSection.entries.length} ${activeSection.label.toLowerCase()} · ${honorMarks} honor ${honorMarks === 1 ? 'mark' : 'marks'} · ${collectionStorageNote({ isAchievements: activeSection.id === 'achievements', steamConnected })}`}
            testId="collection-screen"
            title="Collection"
            toolbar={
                <SectionRail
                    activeId={activeSectionId}
                    controls="collection-entries"
                    idPrefix="collection-tab"
                    label="Collection sections"
                    onSelect={(id) => {
                        resumeUiSfxContext();
                        playUiClickSfx(uiGain);
                        setActiveSectionId(id as CollectionSectionId);
                    }}
                    options={sections.map((section) => ({
                        badge: `${section.earnedCount}/${section.entries.length}`,
                        id: section.id,
                        label: section.label
                    }))}
                />
            }
        >
            <FittedGrid
                ariaLabel={activeSection.label}
                emptyState={`No ${activeSection.label.toLowerCase()} yet. Finish a run to start the archive.`}
                items={activeSection.entries}
                itemNoun={activeSection.label.toLowerCase()}
                keyForItem={(entry) => `${activeSection.id}:${entry.id}`}
                minColumnWidth={250}
                renderItem={(entry) => (
                    <article className={styles.card} data-earned={entry.earned ? 'true' : 'false'} data-section={activeSection.id}>
                        <span className={styles.cardHead}>
                            <span className={styles.cardKicker}>{activeSection.kicker}</span>
                            <span className={styles.cardStatus}>{entry.status}</span>
                        </span>
                        <strong className={styles.cardTitle}>{entry.title}</strong>
                        <p className={styles.cardBody}>{entry.detail}</p>
                    </article>
                )}
                resetKey={activeSectionId}
                rowHeight={146}
                testId="collection-entries"
            />
        </MetaShell>
    );
};

export default CollectionScreen;
