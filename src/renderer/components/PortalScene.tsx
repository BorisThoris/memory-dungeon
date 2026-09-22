import { useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { portalMotes } from './portalSceneMotes';
import { SceneMotes } from './SceneMotes';
import plate from './scenePlate.module.css';
import styles from './PortalScene.module.css';

/**
 * The portal clearing behind Choose Your Path (the Classic poster), as a place.
 *
 * `scripts/scene-pipeline/portal.sh` splits the painting into a dark *base* and three additive
 * light layers, the cyan of the arch's runes and the glowing plants, the moon and its halo, and
 * the stars, and cuts the vortex out of the arch as one feathered disc. Over the base the runes
 * breathe, the moon pulses on a slower clock, the stars twinkle (two copies on stepped clocks
 * that never agree), and the vortex spins: the cut disc turns in the opening while the spiral's
 * outer arms stay painted, its feathered rim dissolving the one into the other, with a fainter
 * copy turning the other way behind it. Mist drifts over the clearing's floor and a few motes
 * rise through the trees. The plate drifts slowly and turns with the pointer (`useSceneLook`).
 *
 * The parent owns the mask, the filter and how far the scene sinks into the page; the base reads
 * `--scene-base-opacity` and the lights `--scene-light-opacity`. `getSceneEffectTier` decides the
 * rest: `full` on a desktop, `lean` on a phone or at `low` (the layers and the vortex, no echo, no
 * mist, no motes, no drift), `still` under reduce motion.
 */
export interface PortalSceneProps {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
}

const bg = (url: string) => ({ backgroundImage: `url(${url})` });
const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;

export function PortalScene({ quality, reduceMotion }: PortalSceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const tier = useSceneEffectTier(quality, reduceMotion);
    const still = tier === 'still';
    const alive = tier === 'full';
    const set = SCENE_SPRITES.portalVortex;
    const vortex = set.sprites[0] ?? null;
    useSceneLook(sceneRef, alive);
    return (
        <div
            aria-hidden="true"
            className={`${plate.scene} ${styles.scene}`}
            data-alive={alive ? 'true' : 'false'}
            data-scene-effect-tier={tier}
            data-still={still ? 'true' : 'false'}
            data-testid="portal-scene"
            ref={sceneRef}
            style={{ '--scene-plate-aspect': `${set.plate[0]} / ${set.plate[1]}` } as CSSProperties}
        >
            <div className={plate.plate} data-testid="portal-scene-plate">
                <div className={plate.base} style={bg(UI_ART.portalSceneBase)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.starsA}`} style={bg(UI_ART.portalSceneStars)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.starsB}`} style={bg(UI_ART.portalSceneStars)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.moon}`} style={bg(UI_ART.portalSceneGlowMoon)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.runes}`} style={bg(UI_ART.portalSceneGlowRunes)} />
                {vortex ? (
                    <div
                        className={`${styles.vortex} ${styles.things}`}
                        data-testid="portal-scene-vortex"
                        style={{ left: pct(vortex.x), top: pct(vortex.y), width: pct(vortex.w), height: pct(vortex.h) }}
                    >
                        {alive ? <img alt="" className={`${styles.disc} ${styles.discEcho}`} draggable={false} src={vortex.sheet} /> : null}
                        <img alt="" className={`${styles.disc} ${styles.discCore}`} decoding="async" draggable={false} src={vortex.sheet} />
                    </div>
                ) : null}
                {alive ? (
                    <>
                        <div className={styles.mist} data-testid="portal-scene-mist">
                            <div className={`${styles.mistBank} ${styles.mistNear}`} />
                            <div className={`${styles.mistBank} ${styles.mistFar}`} />
                        </div>
                        <div className={`${plate.things} ${styles.things}`}>
                            <SceneMotes
                                color="#bfe9ff"
                                glow="rgba(120, 220, 255, 0.7)"
                                motes={portalMotes()}
                                still={false}
                                testId="portal-scene-motes"
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
