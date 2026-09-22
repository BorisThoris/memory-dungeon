import { useRef } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { SceneMotes } from './SceneMotes';
import { cathedralMotes } from './sceneSpriteClocks';
import { SceneSprites } from './SceneSprites';
import plate from './scenePlate.module.css';
import styles from './CathedralScene.module.css';

/**
 * The cathedral behind the main menu and the run's end, as a place rather than a picture.
 *
 * `scripts/scene-pipeline/cathedral.sh` splits the painting into a dark *base* and two additive
 * light layers: the candlelight pooled on the pillars, rails and floor, and the teal spirit-light
 * climbing the far arch. Over them the candle flames, cut out of the painting, play as flipbook
 * sprites (`SceneSprites`), each on its own clock, so twenty-nine candles never flicker together;
 * the candlelight on the stone flickers under them on a slower clock of its own, and the wisps
 * breathe and drift, and motes of the same light climb the arch. The plate drifts slowly and
 * turns with the pointer (`useSceneLook`).
 *
 * The parent owns the mask, the filter and how far the whole scene sinks into the page; the base
 * alone reads `--scene-base-opacity` and the lights `--scene-light-opacity`, so the candles can
 * burn brighter than the nave they light. At the run's end (`mood="ended"`) the candlelight
 * sinks and the spirit-light takes the nave. `getSceneEffectTier` decides the rest: `full` on a
 * desktop, `lean` on a phone or at `low` (the flames and the lights only, no drift, no echo, no
 * motes), `still` under reduce motion.
 */
export interface CathedralSceneProps {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    /**
     * `ended` is the run's end: the candlelight sinks and the spirit-light takes the nave, the
     * candles burning low over their stands. Default `menu`.
     */
    mood?: 'menu' | 'ended';
}

const bg = (url: string) => ({ backgroundImage: `url(${url})` });

export function CathedralScene({ mood = 'menu', quality, reduceMotion }: CathedralSceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const tier = useSceneEffectTier(quality, reduceMotion);
    const still = tier === 'still';
    const alive = tier === 'full';
    const candles = SCENE_SPRITES.cathedralCandles;
    useSceneLook(sceneRef, alive);
    return (
        <div
            aria-hidden="true"
            className={`${plate.scene} ${styles.scene}`}
            data-alive={alive ? 'true' : 'false'}
            data-mood={mood}
            data-scene-effect-tier={tier}
            data-still={still ? 'true' : 'false'}
            data-testid="cathedral-scene"
            ref={sceneRef}
            style={{ '--scene-plate-aspect': `${candles.plate[0]} / ${candles.plate[1]}` } as React.CSSProperties}
        >
            <div className={plate.plate} data-testid="cathedral-scene-plate">
                <div className={plate.base} style={bg(UI_ART.menuSceneBase)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.candleGlow}`} style={bg(UI_ART.menuSceneGlowCandles)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.wisps}`} style={bg(UI_ART.menuSceneGlowWisps)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.wispsEcho}`} style={bg(UI_ART.menuSceneGlowWisps)} />
                <div className={`${plate.things} ${styles.things}`}>
                    <SceneSprites set={candles} still={still} />
                    {alive ? (
                        <SceneMotes
                            color="#bff5ea"
                            glow="rgba(90, 220, 200, 0.7)"
                            motes={cathedralMotes()}
                            still={false}
                            testId="cathedral-scene-motes"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
