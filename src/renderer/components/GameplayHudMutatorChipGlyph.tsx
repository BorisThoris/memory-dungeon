import { type MutatorId } from '../../shared/contracts';
import codexBookUrl from '../assets/ui/icons/icon-codex-book-v1.svg?url';
import shuffleIconUrl from '../assets/ui/icons/icon-shuffle-v1.svg?url';
import styles from './GameScreen.module.css';
import { type GameplayHudContextChipKind } from './gameplayHudMutatorChipMeta';

type GameplayHudMutatorChipGlyphProps =
    | { chipKind: GameplayHudContextChipKind; mutator?: never }
    | { chipKind?: never; mutator: MutatorId };

const GameplayHudMutatorChipGlyph = ({ chipKind, mutator }: GameplayHudMutatorChipGlyphProps) => {
    if (chipKind === 'gauntlet') {
        return (
            <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                    <rect fill="none" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" width="9" x="3.5" y="3.5" />
                    <path d="M8 2.4V4.2M8 11.8v1.8M2.4 8H4.2M11.8 8H13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
                </svg>
            </span>
        );
    }
    if (chipKind === 'scholar') {
        return (
            <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                <img alt="" className={styles.mutatorChipBookImg} height={14} src={codexBookUrl} width={14} />
            </span>
        );
    }
    if (chipKind === 'shuffle_tax') {
        return (
            <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                <img alt="" className={styles.mutatorChipShuffleImg} height={14} src={shuffleIconUrl} width={14} />
            </span>
        );
    }

    switch (mutator) {
        case 'short_memorize':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <circle cx="8" cy="8" fill="none" r="6.25" stroke="currentColor" strokeWidth="1.35" />
                        <path d="M8 4.35V8l2.6 1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
                    </svg>
                </span>
            );
        case 'n_back_anchor':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <path
                            d="M3.4 10.2c0-2.1 1.7-3.8 3.8-3.8h1.6c2.1 0 3.8 1.7 3.8 3.8v1.1H3.4z"
                            fill="none"
                            stroke="currentColor"
                            strokeLinejoin="round"
                            strokeWidth="1.25"
                        />
                        <path d="M8 2.7v3.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
                        <circle cx="8" cy="2.2" fill="currentColor" r="1.05" />
                    </svg>
                </span>
            );
        case 'shifting_spotlight':
            return (
                <span aria-hidden="true" className={styles.mutatorChipSpotlightPair}>
                    <span className={styles.mutatorChipSpotWard} />
                    <span className={styles.mutatorChipSpotBounty} />
                </span>
            );
        default:
            return null;
    }
};

export default GameplayHudMutatorChipGlyph;
