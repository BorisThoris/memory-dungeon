import type { CSSProperties } from 'react';
import styles from './SceneMotes.module.css';

/**
 * Points of light drifting up through a scene: the portal clearing's fireflies, the rune ring's
 * sparks, the cathedral's spirit-light. Each mote is one dot on its own loop, rising and wandering
 * from where it starts; the scene supplies the list (deterministic, so a render is the same every
 * time) and the colour, and can fade the whole drift with `--scene-motes-opacity`.
 *
 * Must sit inside a plate-sized box: positions are percentages of it.
 */
export interface SceneMote {
    id: string;
    /** Start point, percent of the plate. */
    x: number;
    y: number;
    durationMs: number;
    delayMs: number;
    /** Sideways wander and rise over one loop, CSS pixels. */
    driftPx: number;
    risePx: number;
    size: number;
}

export interface SceneMotesProps {
    motes: readonly SceneMote[];
    /** The dot's colour and its glow. */
    color: string;
    glow: string;
    still: boolean;
    testId?: string;
}

export function SceneMotes({ motes, color, glow, still, testId = 'scene-motes' }: SceneMotesProps) {
    return (
        <div
            className={styles.motes}
            data-still={still ? 'true' : 'false'}
            data-testid={testId}
            style={{ '--mote-color': color, '--mote-glow': glow } as CSSProperties}
        >
            {motes.map((mote) => (
                <i
                    className={styles.mote}
                    key={mote.id}
                    style={
                        {
                            left: `${mote.x}%`,
                            top: `${mote.y}%`,
                            '--mote-duration': `${mote.durationMs}ms`,
                            '--mote-delay': `${mote.delayMs}ms`,
                            '--mote-drift': `${mote.driftPx}px`,
                            '--mote-rise': `${mote.risePx}px`,
                            '--mote-size': `${mote.size}px`
                        } as CSSProperties
                    }
                />
            ))}
        </div>
    );
}
