import type { CSSProperties } from 'react';
import styles from './TileBoard.module.css';

interface TileBoardPrestageOverlayProps {
    cardCount: number;
}

export const TileBoardPrestageOverlay = ({ cardCount }: TileBoardPrestageOverlayProps) => (
    <div
        aria-hidden
        className={styles.prestageOverlay}
        data-testid="tile-board-prestage-overlay"
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
