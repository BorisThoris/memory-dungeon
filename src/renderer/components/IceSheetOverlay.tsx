import { useMemo } from 'react';
import { buildIceCracks, ICE_SHEET_VIEWBOX } from './iceSheet';
import styles from './IceSheetOverlay.module.css';

/**
 * A slick pane of ice over the screen, for a frost run (`sceneMood.ts`).
 *
 * One inline SVG: a glassy sheen that catches light across the pane, a frosted rim, and the
 * cracks (`iceSheet.ts`) drawn in with a dash as the combo climbs, glowing pale blue. Everything
 * that moves is a CSS variable the scene sets - `--scene-ice` for how much pane there is,
 * `--scene-ice-cracks` for how far the cracks have run, `--scene-ice-glow` for the light in
 * them - so this renders once per seed and the run drives it the way it drives the light passes.
 * Pointer-events none; the board underneath stays the board, and the cracks stop short of it.
 */
export interface IceSheetOverlayProps {
    seed: number;
    reduceMotion: boolean;
}

export function IceSheetOverlay({ seed, reduceMotion }: IceSheetOverlayProps) {
    const cracks = useMemo(() => buildIceCracks(seed), [seed]);
    const { width, height } = ICE_SHEET_VIEWBOX;
    return (
        <svg
            aria-hidden="true"
            className={styles.sheet}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-testid="ice-sheet"
            preserveAspectRatio="none"
            viewBox={`0 0 ${width} ${height}`}
        >
            <defs>
                <linearGradient id="ice-sheen" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#dff4ff" stopOpacity="0.18" />
                    <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="0.62" stopColor="#bfe6ff" stopOpacity="0.04" />
                    <stop offset="1" stopColor="#8fd3ff" stopOpacity="0.14" />
                </linearGradient>
                <radialGradient id="ice-rim" cx="0.5" cy="0.5" r="0.7">
                    <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="0.8" stopColor="#cfeaff" stopOpacity="0.2" />
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0.42" />
                </radialGradient>
                <filter id="ice-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            <rect className={styles.sheen} fill="url(#ice-sheen)" height={height} width={width} />
            <rect className={styles.rim} fill="url(#ice-rim)" height={height} width={width} />
            <g className={styles.glow} filter="url(#ice-glow)">
                {cracks.map((crack, index) => (
                    <path
                        className={crack.fork ? styles.forkGlow : styles.crackGlow}
                        d={crack.d}
                        key={`glow-${index}`}
                        style={{ strokeDasharray: crack.length, ['--crack-length' as string]: crack.length }}
                    />
                ))}
            </g>
            <g className={styles.cracks}>
                {cracks.map((crack, index) => (
                    <path
                        className={crack.fork ? styles.fork : styles.crack}
                        d={crack.d}
                        key={index}
                        style={{ strokeDasharray: crack.length, ['--crack-length' as string]: crack.length }}
                    />
                ))}
            </g>
        </svg>
    );
}
