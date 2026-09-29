import { useMemo } from 'react';
import { buildStormBolts, STORM_VIEWBOX } from './stormBolts';
import styles from './StormBoltsOverlay.module.css';

/**
 * The storm's lightning through the arches: an SVG in the plate's space, drawn once per seed,
 * shown by the same beat as the room's white flash (`--scene-storm` sets its period). Each bolt
 * strikes on its own offset of the beat so the room never flashes the same way twice in a row.
 */
export function StormBoltsOverlay({ seed, count = 3 }: { seed: number; count?: number }) {
    const bolts = useMemo(() => buildStormBolts(seed, count), [seed, count]);
    const { width, height } = STORM_VIEWBOX;
    return (
        <svg aria-hidden="true" className={styles.bolts} data-testid="gameplay-scene-bolts" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <filter id="storm-bolt-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                </filter>
            </defs>
            {bolts.map((bolt, index) => (
                <g className={styles.bolt} key={index} style={{ ['--bolt-offset' as string]: `${index * 0.37}` }}>
                    <path className={styles.glow} d={bolt.d} filter="url(#storm-bolt-glow)" />
                    <path className={styles.core} d={bolt.d} />
                </g>
            ))}
        </svg>
    );
}
