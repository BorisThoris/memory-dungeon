import type { CSSProperties } from 'react';
import { TILE_SUIT_CATALOG } from '../../shared/tile-suit-rules';
import type { OddCardLegendEntry } from '../copy/oddCardBeat';
import styles from './OddCardLegend.module.css';

/**
 * The key to the floor's odd cards (`odd-card-rules.ts`), beside the board while one stands: the
 * same mark the card wears and the one sentence that says what it means. Gone when they are.
 */
export function OddCardLegend({ entries }: { entries: readonly OddCardLegendEntry[] }) {
    if (entries.length === 0) return null;
    return (
        <ul className={styles.legend} data-testid="odd-card-legend">
            {entries.map((entry) => (
                <li
                    key={entry.id}
                    className={styles.entry}
                    data-odd-card={entry.id}
                    data-testid={`odd-card-${entry.id}`}
                    style={entry.suit ? ({ '--odd-hue': TILE_SUIT_CATALOG[entry.suit].hue } as CSSProperties) : undefined}
                >
                    <span aria-hidden="true" className={styles.mark}>
                        {entry.id === 'turncoat' && entry.suit ? TILE_SUIT_CATALOG[entry.suit].rune : entry.sand}
                    </span>
                    <span className={styles.name}>{entry.name}</span>
                    <span className={styles.line}>{entry.line}</span>
                </li>
            ))}
        </ul>
    );
}
