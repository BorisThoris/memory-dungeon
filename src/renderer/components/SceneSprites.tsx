import type { CSSProperties } from 'react';
import type { SceneSpriteSet } from '../assets/ui/sprites';
import { sceneSpriteClocks, sceneSpriteEmbers } from './sceneSpriteClocks';
import styles from './SceneSprites.module.css';

/**
 * The cut-outs of a painted backdrop, playing. Each sprite is a clipping box at its place on the
 * plate with its flipbook strip inside, stepped along by a CSS animation, drawn over the plate
 * where the pipeline dimmed the painted flame to its core. Every sprite runs on its own clock
 * (`sceneSpriteClocks`), so six torches on a wall never move together.
 *
 * Must sit inside a plate-sized box (`GameplayScene`'s `.plate`): positions are fractions of it.
 * `still` freezes every strip on its first frame, which is the painting's own flame.
 */
export interface SceneSpritesProps {
    set: SceneSpriteSet;
    still: boolean;
    /** Sparks rising from each flame; off on low quality. */
    embers?: boolean;
}

const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;

export function SceneSprites({ set, still, embers = false }: SceneSpritesProps) {
    return (
        <div
            className={styles.sprites}
            data-sprite-kind={set.kind}
            data-still={still ? 'true' : 'false'}
            data-testid="scene-sprites"
        >
            {set.sprites.map((sprite, index) => {
                const clock = sceneSpriteClocks(sprite, index);
                return (
                    <div
                        className={styles.sprite}
                        data-sprite-id={sprite.id}
                        data-still={still ? 'true' : 'false'}
                        key={sprite.id}
                        style={
                            {
                                left: pct(sprite.x),
                                top: pct(sprite.y),
                                width: pct(sprite.w),
                                height: pct(sprite.h),
                                '--sprite-frames': sprite.frames,
                                '--sprite-duration': `${clock.durationMs}ms`,
                                '--sprite-delay': `${clock.delayMs}ms`
                            } as CSSProperties
                        }
                    >
                        <img alt="" className={styles.strip} decoding="async" draggable={false} src={sprite.sheet} />
                    </div>
                );
            })}
            {embers
                ? set.sprites.map((sprite, index) => (
                      <div
                          className={styles.embers}
                          data-testid="scene-embers"
                          key={`embers-${sprite.id}`}
                          style={{
                              left: pct(sprite.x + sprite.w * 0.25),
                              top: pct(sprite.y - sprite.h * 0.35),
                              width: pct(sprite.w * 0.5),
                              height: pct(sprite.h * 0.75)
                          }}
                      >
                          {sceneSpriteEmbers(sprite, index).map((ember) => (
                              <i
                                  className={styles.ember}
                                  key={ember.id}
                                  style={
                                      {
                                          left: `${ember.x}%`,
                                          '--ember-drift': `${ember.driftPx}px`,
                                          '--ember-duration': `${ember.durationMs}ms`,
                                          '--ember-delay': `${ember.delayMs}ms`,
                                          '--ember-size': `${ember.size}px`
                                      } as CSSProperties
                                  }
                              />
                          ))}
                      </div>
                  ))
                : null}
        </div>
    );
}
