import type { FloorIdentityContract } from '../../shared/boss-encounters';
import type { FloorArchetypeDefinition } from '../../shared/floor-mutator-schedule';
import styles from './GameScreen.module.css';

interface GameScreenEndlessChapterBannerProps {
    archetype: FloorArchetypeDefinition;
    featuredObjectiveLabel: string;
    floorIdentity: FloorIdentityContract | null;
}

export const GameScreenEndlessChapterBanner = ({
    archetype,
    featuredObjectiveLabel,
    floorIdentity
}: GameScreenEndlessChapterBannerProps) => (
    <div
        className={styles.endlessChapterBanner}
        data-chapter-theme={archetype.theme}
        data-testid="endless-chapter-banner"
    >
        <strong className={styles.endlessChapterTitle}>{archetype.title}</strong>
        <span className={styles.endlessChapterHint}>{floorIdentity?.teachingSentence ?? archetype.hint}</span>
        <span className={styles.endlessChapterRisk}>
            {archetype.theme}: {floorIdentity?.counterplaySentence ?? archetype.riskProfile}
        </span>
        <span className={styles.endlessChapterObjective}>Objective: {featuredObjectiveLabel}</span>
    </div>
);
