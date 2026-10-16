import type { CSSProperties } from 'react';
import styles from './TileBoard.module.css';

interface TileBoardPrestageOverlayProps {
    cardCount: number;
    /** The deal has begun: the veil fades out over the board coming in (`PRESTAGE_VEIL_EXIT_MS`). */
    leaving?: boolean;
}

/** How long the veil takes to fade once the deal begins; matches `prestageVeilOut`. */
export const PRESTAGE_VEIL_EXIT_MS = 220;

export const TileBoardPrestageOverlay = ({ cardCount, leaving = false }: TileBoardPrestageOverlayProps) => (
    <div
        aria-hidden
        className={styles.prestageOverlay}
        data-leaving={leaving ? 'true' : undefined}
        data-testid={leaving ? 'tile-board-prestage-overlay-leaving' : 'tile-board-prestage-overlay'}
    >
        <div
            className={styles.prestageDeck}
            style={{ '--prestage-cards': cardCount } as CSSProperties}
        >
            <div className={styles.prestageStack}>
                {Array.from({ length: cardCount }, (_, deckI) => (
                    <span
                        className={styles.prestageCard}
                        key={deckI}
                        style={{ '--deck-i': deckI } as CSSProperties}
                    />
                ))}
            </div>
        </div>
    </div>
);
