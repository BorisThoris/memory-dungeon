import { useCallback, useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import type { ChainTier } from '../../shared/chain-tier-rules';
import type { ComboHeatStage } from '../../shared/combo-heat-rules';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { ElementSceneLayers } from './ElementSceneLayers';
import { prefersCompactSceneArt } from './elementSceneArt';
import { composeGameplayScene, stormBoltCount } from './gameplaySceneFrame';
import { sceneFlameLevels, sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import { SceneCanvas, type SceneLevels } from './SceneCanvas';
import { SCENE_FPS_FULL, SCENE_FPS_LEAN } from './sceneCanvasLayout';
import type { SceneClock } from './sceneClock';
import type { SceneMood } from './sceneMood';
import { useBeat } from './useSceneBeat';
import plate from './scenePlate.module.css';
import styles from './GameplayScene.module.css';

/**
 * The gameplay backdrop as a relightable room with things moving in it.
 *
 * The painting used to be one image with its light baked in. It is now a dark *base* plus additive
 * layers, each one a family of light in the room: the rune ring's glow and the light it throws on
 * the slabs (a Cycles light-group pass, so the stones catch it in perspective), the torches on each
 * wall and their painted light, the blue wall glyphs. `scripts/scene-pipeline/` makes them. Light
 * adds, so every layer is drawn additively at an intensity the run sets:
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
 *     out of the painting and play as flipbook sprites (`flameDraws`), each on its own clock,
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
 * Everything sits in a *plate*: a box with the painting's aspect ratio, cover-fitted to the scene.
 * In it is one canvas (`SceneCanvas`), and `composeGameplayScene` decides each frame what is drawn
 * there: the stone, every light at the strength the run sets, the weather, the flames and
 * everything that drifts. It used to be an element per light, blended by the browser, which cost
 * a screen-sized surface each and flashed on large displays and phones; one canvas the size of
 * the art costs the same everywhere. Only the black hole is still an element over it (one small
 * disc on a transform), and the plate still takes the room's beats (the hit, the spew, the grade) as
 * transforms and a filter on the one box.
 *
 * What the device gets is `getSceneEffectTier`'s call: `full` on a desktop; `lean` on a phone or
 * at `low` (the same room, thinner specks, the plate held still); `still` under reduce motion.
 *
 * The state the room is in is on the root as data attributes and custom properties, for the
 * stylesheet's few rules and for anything that needs to read the room from outside.
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
    const lookRef = useRef({ x: 0, y: 0 });
    const ring = sceneRingLevels(fill, comboHeat, comboHueDeg);
    const flame = sceneFlameLevels(fill, imminent, comboHeat);
    // The room's beats that move the whole plate: a class held for the beat's length, keyed so one turn is one beat.
    const hitting = useBeat(mood?.hitKey ?? null, 520);
    const missing = useBeat(mood?.missKey ?? null, 700);
    const frozen = useBeat(mood?.freezeKey ?? null, 900);
    const spewing = useBeat(mood?.spewKey ?? null, 1100);
    const realmStruck = useBeat(mood?.realmEventKey ?? null, 900);
    const effectTier = useSceneEffectTier(quality, reduceMotion);
    const still = effectTier === 'still';
    const alive = effectTier === 'full';
    const flames = SCENE_SPRITES.gameplayFlames;
    const chemistryPainted = (mood?.elements.reactions.reduce((sum, reaction) => sum + reaction.weight, 0) ?? 0) > 0.2;
    useSceneLook(sceneRef, alive, lookRef);
    const compose = useCallback(
        (clock: SceneClock, levels: SceneLevels) =>
            composeGameplayScene(
                { fill, memorize, pulse, pulseKey, feverKey, cleared, imminent, comboHeat, comboHueDeg, mood, runSeed, tier: effectTier, compactArt: prefersCompactSceneArt(), base: levels.base },
                clock
            ),
        [fill, memorize, pulse, pulseKey, feverKey, cleared, imminent, comboHeat, comboHueDeg, mood, runSeed, effectTier]
    );
    return (
        <div
            aria-hidden="true"
            className={`${plate.scene} ${styles.scene}`}
            data-flame-drawing={imminent ? 'true' : 'false'}
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
            data-scene-prismatic={mood?.prismatic && !chemistryPainted ? 'true' : 'false'}
            data-scene-hit={hitting && !still ? 'true' : 'false'}
            data-scene-spew={spewing && !still ? 'true' : 'false'}
            data-scene-realm-event={realmStruck && !still ? mood?.realmEventFamily ?? 'none' : 'none'}
            data-scene-miss={missing && !still ? 'true' : 'false'}
            data-scene-frozen={frozen && !still ? 'true' : 'false'}
            data-scene-peril={mood?.peril ? 'true' : 'false'}
            data-relics={(mood?.relics ?? []).join(' ')}
            data-scene-storm-bolts={!still && (mood?.storm ?? 0) > 0 ? stormBoltCount(mood?.surge ?? 0) : 0}
            data-scene-gold-rain={mood?.goldRain && !still ? mood.goldRain.key : 'none'}
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
                    '--flame-rate': flame.rate * (mood?.tempo ?? 1),
                    '--flame-lift': flame.lift,
                    '--flame-embers': flame.embers,
                    '--flame-ember-rate': flame.emberRate * (mood?.tempo ?? 1),
                    '--combo-heat': comboHeat.toFixed(3),
                    '--scene-frost': mood?.frost ?? 0,
                    '--scene-snow': mood?.snow ?? 0,
                    '--scene-snow-glow': mood?.snowGlow ?? 0,
                    '--scene-storm': mood?.storm ?? 0,
                    '--scene-wet': mood?.wet ?? 0,
                    '--scene-ash': mood?.ash ?? 0,
                    '--scene-tempo': mood?.tempo ?? 1,
                    '--scene-grade-hue': `${chemistryPainted ? 0 : mood?.hueDeg ?? 0}deg`,
                    '--scene-grade-saturate': chemistryPainted ? 1 : mood?.saturate ?? 1,
                    '--scene-grade-brightness': chemistryPainted ? 1 : mood?.brightness ?? 1,
                    '--scene-plate-aspect': `${flames.plate[0]} / ${flames.plate[1]}`
                } as CSSProperties
            }
        >
            <div className={`${plate.plate} ${styles.plate}`} data-testid="gameplay-scene-plate">
                <SceneCanvas
                    compose={compose}
                    fps={alive ? SCENE_FPS_FULL : SCENE_FPS_LEAN}
                    lookRef={lookRef}
                    plate={flames.plate}
                    still={still}
                    testId="gameplay-scene-canvas"
                />
                {/* What chemistry is in the room, for the tests and anything that reads the room; the canvas paints it. */}
                {mood?.elements ? <ElementSceneLayers scene={mood.elements} still={still} alive={alive} plate={mood.plate} /> : null}
                {/* The black hole: the room collapses into it once, on the miss that opened it. */}
                {mood?.blackHoleKey && !still ? (
                    <div className={styles.blackHole} data-testid="gameplay-scene-black-hole" key={mood.blackHoleKey} />
                ) : null}
            </div>
        </div>
    );
}
