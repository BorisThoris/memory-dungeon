import type { CSSProperties, ReactElement } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { isStreakPrimed, resonanceOf, resonanceTier, runElementResonance, runElementStreak, stacksForTier } from '../../shared/element-resonance-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import styles from './ElementResonanceStrip.module.css';

/**
 * The resonance strip (2026-10-02, `element-resonance-rules.ts`): the four elements' stacks, which
 * never stop climbing, and the streak in hand. The element in hand is lit and counts its links; at
 * two it is primed and pulses, which is the cue that a different element matched now will react.
 * While a Freeze-over holds the floor still, the strip counts the turns left.
 */
const ElementResonanceStrip = ({
    run
}: {
    run: Pick<RunState, 'elementResonance' | 'elementStreak' | 'realmStillTurns'>;
}): ReactElement | null => {
    const resonance = runElementResonance(run);
    const streak = runElementStreak(run);
    const still = runNonNegativeInteger(run.realmStillTurns ?? 0);
    const total = TILE_SUITS.reduce((sum, suit) => sum + resonanceOf(resonance, suit), 0);
    if (total === 0 && !streak && still === 0) return null;
    const primed = isStreakPrimed(streak);
    const label =
        TILE_SUITS.map((suit) => `${ELEMENT_NAMES[suit]} ${resonanceOf(resonance, suit)}`).join(', ') +
        (streak ? `. ${ELEMENT_NAMES[streak.suit]} in hand, ${streak.links} in a row${primed ? ': primed, a different element reacts' : ''}.` : '.') +
        (still > 0 ? ` The floor holds still for ${still} more ${still === 1 ? 'turn' : 'turns'}.` : '');
    return (
        <span aria-label={`Resonance: ${label}`} className={styles.strip} data-primed={primed ? 'true' : undefined} data-testid="hud-resonance" role="img">
            {TILE_SUITS.map((suit) => {
                const stacks = resonanceOf(resonance, suit);
                const inHand = streak?.suit === suit;
                return (
                    <span
                        className={styles.element}
                        data-in-hand={inHand ? 'true' : undefined}
                        data-primed={inHand && primed ? 'true' : undefined}
                        data-suit={suit}
                        data-testid={`hud-resonance-${suit}`}
                        data-tier={resonanceTier(stacks)}
                        key={suit}
                        style={{ '--element-color': getTileSuit(suit).hue } as CSSProperties}
                        title={`${ELEMENT_NAMES[suit]}: ${stacks} ${stacks === 1 ? 'stack' : 'stacks'}, tier ${resonanceTier(stacks)}, the next at ${stacksForTier(resonanceTier(stacks) + 1)}`}
                    >
                        <span aria-hidden="true" className={styles.rune}>
                            {getTileSuit(suit).rune}
                        </span>
                        <span className={styles.stacks}>{stacks}</span>
                        {inHand ? (
                            <span className={styles.links} data-testid="hud-resonance-streak">
                                ×{streak.links}
                            </span>
                        ) : null}
                    </span>
                );
            })}
            {still > 0 ? (
                <span className={styles.still} data-testid="hud-resonance-still">
                    Still {still}
                </span>
            ) : null}
        </span>
    );
};

export default ElementResonanceStrip;
