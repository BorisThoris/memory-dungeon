import { useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ChainTier } from '../../shared/chain-tier-rules';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import { SceneMotes } from './SceneMotes';
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
 *     remounts on every event, so two breaks in a row each get their flash), and the torches
 *     flare with it, the pop barely stirring them and Fever throwing them up the wall;
 *   - a cleared floor is the room exhaling: the ring swells bright and settles over a long
 *     breath while the torches gutter and recover;
 *   - reaching Fever is the room arriving with the cards: one flash of the whole ring the moment
 *     the meter fills, thrown on the rising edge so a run that sits at Fever is not strobed, and
 *     never thrown at all under reduce motion;
 *   - the torches always burn, and burn harder the better the run is going: their flames are cut
 *     out of the painting and play as flipbook sprites (`SceneSprites`), each on its own clock,
 *     and the chain drives the rate of those flipbooks, how far each flame climbs its own torch and
 *     how thickly the sparks come off it (`sceneFlameLevels`) — on a curve that is steep off zero,
 *     so the first pair of a chain already shows in the fire. The painted torchlight on the stone
 *     under them does not move with the chain: light thrown across a wall by a flame the painter
 *     painted cannot honestly grow, and holding it still is what lets the flames themselves read;
 *   - mist drifts in the corridor beyond the ring, and the whole plate drifts slowly and turns a
 *     little with the pointer (`useSceneLook`), the sprites more than the walls, so the painting
 *     reads as a place.
 *
 * Everything sits in a *plate*: a box with the painting's aspect ratio, cover-fitted to the scene,
 * so the sprites' plate fractions land on their torches whatever the viewport. What the device
 * gets is `getSceneEffectTier`'s call: `full` on a desktop at medium or high; `lean` on a phone or
 * at `low`, which drops the three rendered light passes, the mist, the embers, the motes and the
 * drift and keeps the glows and the flames, which read on their own; `still` under reduce motion.
 */
export interface GameplaySceneProps {
    /** The chain meter's fill, 0..1 of the way to Fever. */
    fill: number;
    memorize: boolean;
    /** The break pulse the stage is showing; `none` between breaks. */
    pulse: ChainTier | 'pop' | 'none';
    /** Identity of the event behind `pulse`, so a second break of the same tier restarts the flash. */
    pulseKey: string | null;
    /**
     * Identity of the turn that carried the run into Fever, or null when the last turn did not.
     * The flash is keyed on it, so it is thrown once on arrival rather than held while the meter
     * stays full, and a run that loses Fever and takes it again gets another.
     */
    feverKey?: string | null;
    /** The floor has just been cleared: the room exhales. */
    cleared?: boolean;
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    tier: ChainTier;
}

const bg = (url: string) => ({ backgroundImage: `url(${url})` });

export function GameplayScene({
    cleared = false,
    feverKey = null,
    fill,
    memorize,
    pulse,
    pulseKey,
    quality,
    reduceMotion,
    tier
}: GameplaySceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const ring = sceneRingLevels(fill);
    const effectTier = useSceneEffectTier(quality, reduceMotion);
    const still = effectTier === 'still';
    const alive = effectTier === 'full';
    const lightPasses = alive;
    const flames = SCENE_SPRITES.gameplayFlames;
    useSceneLook(sceneRef, alive);
    return (
        <div
            aria-hidden="true"
            className={`${plate.scene} ${styles.scene}`}
            data-alive={alive ? 'true' : 'false'}
            data-cleared={cleared ? 'true' : 'false'}
            data-scene-effect-tier={effectTier}
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
                    '--scene-flare-peak': sceneTorchFlarePeak(pulse),
                    '--scene-motes-opacity': ring.motes,
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
                {pulse !== 'none' && !still ? (
                    <div
                        className={`${plate.layer} ${styles.layer} ${styles.torchFlare}`}
                        data-testid="gameplay-scene-flare"
                        key={pulseKey ?? pulse}
                        style={bg(UI_ART.gameplaySceneGlowTorches)}
                    />
                ) : null}
                <div className={`${plate.layer} ${styles.layer} ${styles.runeGlow}`} style={bg(UI_ART.gameplaySceneGlowRunes)} />
                <div className={`${plate.layer} ${styles.layer} ${styles.ringGlow}`} style={bg(UI_ART.gameplaySceneGlowRing)} />
                {feverKey && !still ? (
                    <div
                        className={`${plate.layer} ${styles.layer} ${styles.feverArrival}`}
                        data-testid="gameplay-scene-fever"
                        key={feverKey}
                        style={bg(UI_ART.gameplaySceneGlowRing)}
                    />
                ) : null}
                {alive ? (
                    <div className={styles.mist} data-testid="gameplay-scene-mist">
                        <div className={`${styles.mistBank} ${styles.mistNear}`} />
                        <div className={`${styles.mistBank} ${styles.mistFar}`} />
                    </div>
                ) : null}
                <div className={plate.things}>
                    <SceneSprites embers={alive} heat={fill} set={flames} still={still} />
                    {alive ? (
                        <div className={styles.ringMotes}>
                            <SceneMotes
                                color="#d9c6ff"
                                glow="rgba(170, 130, 255, 0.8)"
                                motes={ringMotes()}
                                still={false}
                                testId="gameplay-scene-ring-motes"
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
