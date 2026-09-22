import { useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ChainTier } from '../../shared/chain-tier-rules';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneLook } from '../hooks/useSceneLook';
import { sceneRingLevels } from './gameplaySceneLevels';
import { SceneSprites } from './SceneSprites';
import { ringMotes } from './sceneSpriteClocks';
import plate from './scenePlate.module.css';
import styles from './GameplayScene.module.css';

/**
 * The gameplay backdrop as a relightable room with things moving in it.
 *
 * The painting used to be one image with its light baked in. It is now a dark *base* plus additive
 * layers, each one a family of light in the room: the rune ring's glow and the light it throws on
 * the slabs (a Cycles light-group pass, so the stones catch it in perspective), the torches on each
 * wall and their painted light, the blue wall glyphs. `scripts/scene-pipeline/` makes them. Light
 * adds, so every layer composites with `plus-lighter` at an intensity the run sets:
 *
 *   - the ring follows the chain meter's fill, continuously: a bare stone circle with the chain at
 *     zero, warming and turning toward rose as the run approaches Fever, throwing up motes that
 *     rise from nothing at rest to a full drift at Fever, and breathing while the board is
 *     memorised;
 *   - a break flashes the ring's floor light, harder the further the chain has come (the pulse
 *     remounts on every event, so two breaks in a row each get their flash);
 *   - the torches always burn: their flames are cut out of the painting and play as flipbook
 *     sprites (`SceneSprites`), each on its own clock, with sparks rising off them, while the
 *     painted torchlight on the stone flickers under them; they do not care how the run is going;
 *   - mist drifts in the corridor beyond the ring, and the whole plate drifts slowly and turns a
 *     little with the pointer (`useSceneLook`), the sprites more than the walls, so the painting
 *     reads as a place.
 *
 * Everything sits in a *plate*: a box with the painting's aspect ratio, cover-fitted to the scene,
 * so the sprites' plate fractions land on their torches whatever the viewport. Reduce motion
 * freezes every animation and drops the parallax; `low` quality drops the three rendered light
 * passes, the mist, the embers and the drift, and keeps the glows and the flames, which read on
 * their own.
 */
export interface GameplaySceneProps {
    /** The chain meter's fill, 0..1 of the way to Fever. */
    fill: number;
    memorize: boolean;
    /** The break pulse the stage is showing; `none` between breaks. */
    pulse: ChainTier | 'pop' | 'none';
    /** Identity of the event behind `pulse`, so a second break of the same tier restarts the flash. */
    pulseKey: string | null;
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    tier: ChainTier;
}

const bg = (url: string) => ({ backgroundImage: `url(${url})` });

export function GameplayScene({ fill, memorize, pulse, pulseKey, quality, reduceMotion, tier }: GameplaySceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const ring = sceneRingLevels(fill);
    const still = reduceMotion;
    const lightPasses = quality !== 'low';
    const alive = quality !== 'low' && !still;
    const flames = SCENE_SPRITES.gameplayFlames;
    useSceneLook(sceneRef, alive);
    return (
        <div
            aria-hidden="true"
            className={`${plate.scene} ${styles.scene}`}
            data-alive={alive ? 'true' : 'false'}
            data-memorize={memorize ? 'true' : 'false'}
            data-scene-pulse={pulse}
            data-scene-fill={fill.toFixed(2)}
            data-scene-tier={tier}
            data-still={still ? 'true' : 'false'}
            data-testid="gameplay-scene"
            ref={sceneRef}
            style={
                {
                    '--scene-ring-light': ring.light,
                    '--scene-ring-glow': ring.glow,
                    '--scene-ring-hue': `${ring.hueDeg}deg`,
                    '--scene-ring-saturate': ring.saturate,
                    '--scene-pulse-peak': ring.pulsePeak,
                    '--scene-ring-motes': ring.motes,
                    '--scene-plate-aspect': `${flames.plate[0]} / ${flames.plate[1]}`
                } as CSSProperties
            }
        >
            <div className={plate.plate} data-testid="gameplay-scene-plate">
                <div className={plate.base} style={bg(UI_ART.gameplaySceneBase)} />
                {lightPasses ? (
                    <>
                        <div className={`${plate.layer} ${styles.layer} ${styles.torchLightL}`} style={bg(UI_ART.gameplaySceneLightTorchesL)} />
                        <div className={`${plate.layer} ${styles.layer} ${styles.torchLightR}`} style={bg(UI_ART.gameplaySceneLightTorchesR)} />
                        <div className={`${plate.layer} ${styles.layer} ${styles.ringLight}`} style={bg(UI_ART.gameplaySceneLightRing)} />
                        {pulse !== 'none' ? (
                            <div
                                className={`${plate.layer} ${styles.layer} ${styles.ringPulse}`}
                                data-testid="gameplay-scene-pulse"
                                key={pulseKey ?? pulse}
                                style={bg(UI_ART.gameplaySceneLightRing)}
                            />
                        ) : null}
                    </>
                ) : null}
                <div className={`${plate.layer} ${styles.layer} ${styles.torchGlow}`} style={bg(UI_ART.gameplaySceneGlowTorches)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.runeGlow}`} style={bg(UI_ART.gameplaySceneGlowRunes)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.ringGlow}`} style={bg(UI_ART.gameplaySceneGlowRing)} />
                {alive ? (
                    <div className={styles.mist} data-testid="gameplay-scene-mist">
                        <div className={`${styles.mistBank} ${styles.mistNear}`} />
                        <div className={`${styles.mistBank} ${styles.mistFar}`} />
                    </div>
                ) : null}
                <div className={plate.things}>
                    <SceneSprites embers={alive} set={flames} still={still} />
                    {alive ? (
                        <div className={styles.ringMotes} data-testid="gameplay-scene-ring-motes">
                            {ringMotes().map((mote) => (
                                <i
                                    className={styles.ringMote}
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
                    ) : null}
                </div>
            </div>
        </div>
    );
}
