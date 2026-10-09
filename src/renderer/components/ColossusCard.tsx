import type { CSSProperties } from 'react';
import type { ColossusEvent, ColossusState, TileSuit } from '../../shared/contracts';
import { colossusElement, colossusNextElement } from '../../shared/colossus-rules';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { TILE_SUIT_CATALOG } from '../../shared/tile-suit-rules';
import { COLOSSUS_COPY, colossusBeatLine, colossusCardLabel, colossusClockLabel } from '../copy/colossusBeat';
import styles from './ColossusCard.module.css';

export interface ColossusCardProps {
    colossus: ColossusState;
    /** The latest turn of the fight, for the words under the card and the hit flash. */
    event: ColossusEvent | null;
    reduceMotion: boolean;
}

/**
 * The boss card (`colossus-rules.ts`): bigger than anything on the board and not on it.
 *
 * Everything the fight turns on is on its face, so nothing has to be remembered about it: the
 * element it shows (colour and rune, never colour alone), the whole order with the next one
 * marked, a pip for every hit it has left, and its clock. It is drawn from the suit catalogue's
 * own runes and hues, so it streams nothing a run has not already loaded.
 */
export function ColossusCard({ colossus, event, reduceMotion }: ColossusCardProps) {
    const showing = colossusElement(colossus);
    const next = colossusNextElement(colossus);
    const standing = colossus.status === 'standing';
    const suit = TILE_SUIT_CATALOG[showing];
    const at = colossus.step % colossus.cycle.length;
    const urgent = standing && colossus.turnsLeft <= colossus.hits;
    const fixed = colossus.form === 'fixed';
    const line = event ? colossusBeatLine(event, standing ? showing : null, fixed) : fixed ? COLOSSUS_COPY.ruleFixed : COLOSSUS_COPY.rule;
    return (
        <section
            aria-label={colossusCardLabel(colossus, showing, next)}
            className={`${styles.card} ${reduceMotion ? styles.still : ''}`}
            data-testid="colossus-card"
            data-status={colossus.status}
            data-element={showing}
            data-urgent={urgent ? 'true' : 'false'}
            data-beat={event?.kind ?? 'none'}
            style={{ '--colossus-hue': suit.hue } as CSSProperties}
        >
            {/* Remounted on each turn of the fight, so the face's turn plays once per turn and never on a restore. */}
            <div key={event?.key ?? 'standing'} aria-hidden="true" className={styles.face} data-testid="colossus-face">
                <span className={styles.rune}>{standing ? suit.rune : colossus.status === 'felled' ? '✕' : '⁘'}</span>
            </div>
            <div className={styles.body}>
                <div className={styles.head}>
                    <span className={styles.name}>{COLOSSUS_COPY.name}</span>
                    <span className={styles.showing} data-testid="colossus-showing">
                        {standing ? ELEMENT_NAMES[showing] : colossus.status === 'felled' ? COLOSSUS_COPY.felled : COLOSSUS_COPY.split}
                    </span>
                </div>
                {standing ? (
                    <>
                        <ol aria-hidden="true" className={styles.cycle} data-testid="colossus-cycle">
                            {colossus.cycle.map((element: TileSuit, index) => (
                                <li
                                    key={`${element}-${index}`}
                                    className={styles.step}
                                    data-now={index === at ? 'true' : 'false'}
                                    data-next={index === (at + 1) % colossus.cycle.length && colossus.cycle.length > 1 ? 'true' : 'false'}
                                    style={{ '--step-hue': TILE_SUIT_CATALOG[element].hue } as CSSProperties}
                                    title={ELEMENT_NAMES[element]}
                                >
                                    <span className={styles.stepRune}>{TILE_SUIT_CATALOG[element].rune}</span>
                                    {index === (at + 1) % colossus.cycle.length && colossus.cycle.length > 1 ? <span className={styles.nextTag}>{COLOSSUS_COPY.next}</span> : null}
                                </li>
                            ))}
                        </ol>
                        <div aria-hidden="true" className={styles.meters}>
                            <span className={styles.pips} data-testid="colossus-hits" data-hits={colossus.hits}>
                                {Array.from({ length: colossus.hitsMax }, (_, index) => (
                                    <span key={index} className={styles.pip} data-left={index < colossus.hits ? 'true' : 'false'} />
                                ))}
                                {colossus.chips > 0 ? <span className={styles.chip} data-testid="colossus-chip" title={COLOSSUS_COPY.chipTitle} /> : null}
                            </span>
                            <span className={styles.clock} data-testid="colossus-turns">
                                {colossusClockLabel(colossus.turnsLeft)}
                            </span>
                        </div>
                    </>
                ) : null}
                <p className={styles.line} data-testid="colossus-line">
                    {line}
                </p>
            </div>
        </section>
    );
}
