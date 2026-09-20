import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ChainTier } from '../../shared/chain-tier-rules';
import { UI_ART } from '../assets/ui';
import { sceneRingLevels } from './gameplaySceneLevels';
import styles from './GameplayScene.module.css';

/**
 * The gameplay backdrop as a relightable room.
 *
 * The painting used to be one image with its light baked in. It is now a dark *base* plus additive
 * layers, each one a family of light in the room: the rune ring's glow and the light it throws on
 * the slabs (a Cycles light-group pass, so the stones catch it in perspective), the torches on each
 * wall and their painted light, the blue wall glyphs. `scripts/scene-pipeline/` makes them. Light
 * adds, so every layer composites with `plus-lighter` at an intensity the run sets:
 *
 *   - the ring follows the chain meter's fill, continuously: a bare stone circle with the chain at
 *     zero, warming and turning toward rose as the run approaches Fever, and breathing while the
 *     board is memorised;
 *   - a break flashes the ring's floor light, harder the further the chain has come (the pulse
 *     remounts on every event, so two breaks in a row each get their flash);
 *   - the torches always burn, flickering on two clocks so the walls never move together; they do
 *     not care how the run is going.
 *
 * Reduce motion freezes every animation; `low` quality drops the three rendered light passes and
 * keeps the glows, which read on their own.
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
    const ring = sceneRingLevels(fill);
    const still = reduceMotion;
    const lightPasses = quality !== 'low';
    return (
        <div
            aria-hidden="true"
            className={styles.scene}
            data-memorize={memorize ? 'true' : 'false'}
            data-scene-pulse={pulse}
            data-scene-fill={fill.toFixed(2)}
            data-scene-tier={tier}
            data-still={still ? 'true' : 'false'}
            data-testid="gameplay-scene"
            style={
                {
                    '--scene-ring-light': ring.light,
                    '--scene-ring-glow': ring.glow,
                    '--scene-ring-hue': `${ring.hueDeg}deg`,
                    '--scene-ring-saturate': ring.saturate,
                    '--scene-pulse-peak': ring.pulsePeak
                } as React.CSSProperties
            }
        >
            <div className={styles.base} style={bg(UI_ART.gameplaySceneBase)} />
            {lightPasses ? (
                <>
                    <div className={`${styles.layer} ${styles.torchLightL}`} style={bg(UI_ART.gameplaySceneLightTorchesL)} />
                    <div className={`${styles.layer} ${styles.torchLightR}`} style={bg(UI_ART.gameplaySceneLightTorchesR)} />
                    <div className={`${styles.layer} ${styles.ringLight}`} style={bg(UI_ART.gameplaySceneLightRing)} />
                    {pulse !== 'none' ? (
                        <div
                            className={`${styles.layer} ${styles.ringPulse}`}
                            data-testid="gameplay-scene-pulse"
                            key={pulseKey ?? pulse}
                            style={bg(UI_ART.gameplaySceneLightRing)}
                        />
                    ) : null}
                </>
            ) : null}
            <div className={`${styles.layer} ${styles.torchGlow}`} style={bg(UI_ART.gameplaySceneGlowTorches)} />
            <div className={`${styles.layer} ${styles.runeGlow}`} style={bg(UI_ART.gameplaySceneGlowRunes)} />
            <div className={`${styles.layer} ${styles.ringGlow}`} style={bg(UI_ART.gameplaySceneGlowRing)} />
        </div>
    );
}
