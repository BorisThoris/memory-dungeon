import { useMemo } from 'react';
import { buildWipeBook, WIPE_FRAMES, WIPE_VIEWBOX } from './sceneWipeFrames';
import styles from './SceneWipe.module.css';

/**
 * The wipe (`sceneWipe.ts`), played once per key: `in` grows the ink over the screen and lets it
 * go (for entering a room - the new room is underneath by the time it clears), `out` the same
 * book for leaving. One SVG per frame, stacked; CSS steps through them.
 */
export interface SceneWipeProps {
    wipeKey: string;
    direction: 'in' | 'out';
    reduceMotion: boolean;
}

export const SCENE_WIPE_MS = 760;

export function SceneWipe({ wipeKey, direction, reduceMotion }: SceneWipeProps) {
    const book = useMemo(() => buildWipeBook(wipeKey), [wipeKey]);
    const { width, height } = WIPE_VIEWBOX;
    if (reduceMotion) return null;
    return (
        <div aria-hidden="true" className={styles.wipe} data-direction={direction} data-testid="scene-wipe" style={{ ['--wipe-frames' as string]: WIPE_FRAMES }}>
            {book.map((frame, index) => (
                <svg className={styles.frame} data-frame={index} key={index} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
                    {frame.map((blob, blobIndex) => (
                        <path className={styles.ink} d={blob.d} key={blobIndex} />
                    ))}
                </svg>
            ))}
        </div>
    );
}
