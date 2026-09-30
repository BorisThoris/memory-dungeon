import { useMemo, type CSSProperties } from 'react';
import { buildEmberDrift, EMBER_VIEWBOX } from './emberDrift';
import styles from './EmberDriftOverlay.module.css';

/**
 * The ember run's weather: sparks and ash drifting up through the room, in the plate's space so
 * they rise off the same floor at every viewport. Built once per seed; `--scene-ash` (0..1, from
 * the run's first turn, growing with the heat) sets how much of it shows and how fast it climbs.
 */
export function EmberDriftOverlay({ seed, count, palette = 'ember' }: { seed: number; count: number; palette?: 'ember' | 'spore' }) {
    const motes = useMemo(() => buildEmberDrift(seed, count), [seed, count]);
    const { width, height } = EMBER_VIEWBOX;
    return (
        <svg aria-hidden="true" className={styles.drift} data-palette={palette} data-testid={palette === 'spore' ? 'gameplay-scene-spores' : 'gameplay-scene-embers'} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <filter id={`drift-glow-${palette}`} x="-200%" y="-200%" width="500%" height="500%">
                    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="7" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {motes.map((mote, index) => (
                <circle
                    className={mote.spark ? styles.spark : styles.ash}
                    cx={mote.x}
                    cy={mote.y}
                    filter={mote.spark ? `url(#drift-glow-${palette})` : undefined}
                    key={index}
                    r={mote.r}
                    style={
                        {
                            '--rise': `${-mote.rise}px`,
                            '--sway': `${mote.sway}px`,
                            '--dur': `${mote.duration}s`,
                            '--phase': mote.phase
                        } as CSSProperties
                    }
                />
            ))}
        </svg>
    );
}
