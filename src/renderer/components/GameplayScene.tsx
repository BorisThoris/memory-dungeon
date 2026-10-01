import { useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ChainTier } from '../../shared/chain-tier-rules';
import type { ComboHeatStage } from '../../shared/combo-heat-rules';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import type { SceneMood } from './sceneMood';
import { StormBoltsOverlay } from './StormBoltsOverlay';
import { EmberDriftOverlay } from './EmberDriftOverlay';
import { emberMoteCount } from './emberDrift';
import { GoldRain } from './GoldRain';
import { useBeat } from './useSceneBeat';
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
 *   - and when the next pair would land a rung (`imminent`), the fire *draws breath* for it —
 *     pulled in, tighter, fewer sparks. It is the one thing in the room that looks forward rather
 *     than reporting, it is the inverse of every other state here so the rung landing releases it,
 *     and it is the room leaning toward the same moment the ladder is lighting;
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
    /**
     * The next pair would land a rung (`chainRungApproach`). The fire draws breath for it, the way
     * the ladder lights the rung ahead — the room leaning toward the same moment the HUD is.
     */
    imminent?: boolean;
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    tier: ChainTier;
    /** The combo heat (`combo-heat-rules.ts`): the room keeps answering past Fever. */
    comboHeat?: number;
    comboStage?: ComboHeatStage;
    /** The temper's hue (`ComboHeatTheme.ringHueDeg`): where the ring turns at full heat. */
    comboHueDeg?: number;
    /** What the room has become (`sceneMood.ts`): the plate, the frost, the black hole. */
    mood?: SceneMood;
    /** The run seed: the storm's bolts are laid out from it. */
    runSeed?: number;
}

const bg = (url: string) => ({ backgroundImage: `url(${url})` });

export function GameplayScene({
    cleared = false,
    imminent = false,
    feverKey = null,
    fill,
    memorize,
    pulse,
    pulseKey,
    quality,
    reduceMotion,
    tier,
    comboHeat = 0,
    comboStage = 'cold',
    comboHueDeg = 0,
    mood,
    runSeed = 0
}: GameplaySceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const ring = sceneRingLevels(fill, comboHeat, comboHueDeg);
    // The room's beats: a class held for the beat's length, keyed so one turn is one beat.
    const hitting = useBeat(mood?.hitKey ?? null, 520);
    const missing = useBeat(mood?.missKey ?? null, 700);
    const frozen = useBeat(mood?.freezeKey ?? null, 900);
    const spewing = useBeat(mood?.spewKey ?? null, 1100);
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
            data-scene-drawing={imminent ? 'true' : 'false'}
            data-scene-fill={fill.toFixed(2)}
            data-scene-tier={tier}
            data-combo-stage={comboStage}
            data-scene-plate={mood?.plate ?? 'dungeon'}
            data-scene-prismatic={mood?.prismatic ? 'true' : 'false'}
            data-scene-hit={hitting && !still ? 'true' : 'false'}
            data-scene-spew={spewing && !still ? 'true' : 'false'}
            data-scene-miss={missing && !still ? 'true' : 'false'}
            data-scene-frozen={frozen && !still ? 'true' : 'false'}
            data-scene-peril={mood?.peril ? 'true' : 'false'}
            data-relics={(mood?.relics ?? []).join(' ')}
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
                    '--combo-heat': comboHeat.toFixed(3),
                    '--scene-frost': mood?.frost ?? 0,
                    '--scene-snow': mood?.snow ?? 0,
                    '--scene-snow-glow': mood?.snowGlow ?? 0,
                    '--scene-storm': mood?.storm ?? 0,
                    '--scene-wet': mood?.wet ?? 0,
                    '--scene-ash': mood?.ash ?? 0,
                    '--scene-tempo': mood?.tempo ?? 1,
                    '--scene-grade-hue': `${mood?.hueDeg ?? 0}deg`,
                    '--scene-grade-saturate': mood?.saturate ?? 1,
                    '--scene-grade-brightness': mood?.brightness ?? 1,
                    '--scene-plate-aspect': `${flames.plate[0]} / ${flames.plate[1]}`
                } as CSSProperties
            }
        >
            <div className={plate.plate} data-testid="gameplay-scene-plate">
                <div className={`${plate.base} ${styles.dungeonBase}`} style={bg(UI_ART.gameplaySceneBase)} />
                {/* The other rooms, crossfaded over the dungeon: the shop while the store is open, the
                    void after a great combo died. The light passes below belong to the dungeon and fade with it. */}
                <div className={`${plate.base} ${styles.altPlate}`} data-testid="gameplay-scene-shop" data-shown={mood?.plate === 'shop' ? 'true' : 'false'} style={bg(UI_ART.gameplaySceneShop)} />
                <div className={`${plate.base} ${styles.altPlate}`} data-testid="gameplay-scene-void" data-shown={mood?.plate === 'void' ? 'true' : 'false'} style={bg(UI_ART.gameplaySceneVoid)} />
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
                {/* A frost run: snow settles on the room's ledges and stones with the heat, and glows. */}
                <div className={`${plate.layer} ${styles.snowGlow}`} data-plate="dungeon" style={bg(UI_ART.gameplaySceneSnow)} />
                <div className={`${plate.layer} ${styles.snow}`} data-plate="dungeon" data-testid="gameplay-scene-snow" style={bg(UI_ART.gameplaySceneSnow)} />
                <div className={`${plate.layer} ${styles.snow}`} data-plate="shop" style={bg(UI_ART.gameplaySceneSnowShop)} />
                <div className={`${plate.layer} ${styles.snow}`} data-plate="void" style={bg(UI_ART.gameplaySceneSnowVoid)} />
                {/* A storm run: the stone runs wet, and lightning comes down through the arches on the beat. */}
                <div className={`${plate.layer} ${styles.wet}`} data-testid="gameplay-scene-wet" style={bg(UI_ART.gameplaySceneWet)} />
                {!still && (mood?.storm ?? 0) > 0 ? <StormBoltsOverlay count={3 + Math.min(6, Math.floor(mood?.surge ?? 0))} seed={runSeed} /> : null}
                {/* An ember run: sparks and ash drift up off the floor, thicker with the heat. */}
                {!still && (mood?.ash ?? 0) > 0 ? <EmberDriftOverlay count={emberMoteCount(mood?.surge ?? 0) + Math.round((mood?.ash ?? 0) * 14)} seed={runSeed} tone={mood?.driftTone ?? 'ember'} /> : null}
                {/* A frost run: ice grows in from the edges with the heat, screened over the room. */}
                <div className={`${plate.layer} ${styles.frost}`} data-testid="gameplay-scene-frost" style={bg(UI_ART.gameplaySceneFrost)} />
                {/* A storm run: the room flashes white now and then, more often the hotter it is. */}
                {!still && (mood?.storm ?? 0) > 0 ? <div className={styles.stormFlash} data-testid="gameplay-scene-storm" /> : null}
                {/* The black hole: the room collapses into it once, on the miss that opened it. */}
                {mood?.blackHoleKey && !still ? (
                    <div className={styles.blackHole} data-testid="gameplay-scene-black-hole" key={mood.blackHoleKey} />
                ) : null}
                {/* A payout: coins fall through the room, in front of the stone and behind the cards. */}
                {mood?.goldRain && !still ? <GoldRain coins={mood.goldRain.coins} key={mood.goldRain.key} rainKey={mood.goldRain.key} /> : null}
                {/* Peril: the bank is empty, and the room says so - a red edge and the torches low. */}
                <div className={styles.peril} data-testid="gameplay-scene-peril" />
                {/* Back from the void: the dungeon returns with one flash of the whole ring, like Fever's arrival. */}
                {mood?.voidReturnKey && !still ? (
                    <div className={`${plate.layer} ${styles.layer} ${styles.feverArrival}`} data-testid="gameplay-scene-return" key={mood.voidReturnKey} style={bg(UI_ART.gameplaySceneGlowRing)} />
                ) : null}
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
                    <SceneSprites comboHeat={comboHeat} embers={alive} heat={fill} imminent={imminent} set={flames} still={still} tempo={mood?.tempo ?? 1} />
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
