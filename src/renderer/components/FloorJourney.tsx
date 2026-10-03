import type { CSSProperties } from 'react';
import type { RunState } from '../../shared/contracts';
import { essenceOf } from '../../shared/elemental-loot-rules';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { realmCarryoverLines } from '../copy/realmCopy';
import styles from './FloorJourney.module.css';

/** Keep the earned rewards and next destination readable for the whole intermission. */
export function FloorJourney({ run, phase }: { run: RunState; phase: 'forge' | 'route' }) {
    const result = run.lastLevelResult;
    if (!result) return null;
    const carry = realmCarryoverLines(result, run.realmAttunement);
    return <aside className={styles.journey} aria-label="Between floors" data-testid="floor-journey">
        <div className={styles.path}>
            <span>Floor {result.level} cleared</span><span aria-hidden="true">/</span>
            <strong>{phase === 'forge' ? 'Prepare your next cast' : 'Choose your next arena'}</strong>
            <span className={styles.next}>Floor {result.level + 1} ahead <span aria-hidden="true">↘</span></span>
        </div>
        <div className={styles.rewards} aria-label="Rewards earned on this floor">
            <strong>+{result.goldEarned ?? 0} gold earned</strong>
            {TILE_SUITS.filter(suit => essenceOf(result.elementalDrops, suit) > 0).map(suit =>
                <span key={suit} style={{ '--reward-color': getTileSuit(suit).hue } as CSSProperties}>
                    <span aria-hidden="true">{getTileSuit(suit).rune}</span> +{essenceOf(result.elementalDrops, suit)} {ELEMENT_NAMES[suit]} essence
                </span>)}
        </div>
        {carry.length ? <details className={styles.carry}><summary>{result.realmSmoke || result.realmChill ? `Carried downstairs: ${[result.realmSmoke ? 'smoke' : null, result.realmChill ? 'chill' : null].filter(Boolean).join(' and ')}` : 'What follows you downstairs'}</summary>
            <ul>{carry.map(line => <li key={line}>{line}</li>)}</ul>
        </details> : null}
    </aside>;
}
