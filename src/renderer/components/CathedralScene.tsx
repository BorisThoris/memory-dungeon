import { useCallback, useRef } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { composeCathedralScene } from './cathedralSceneFrame';
import { SceneCanvas, type SceneLevels } from './SceneCanvas';
import { SCENE_CANVAS_MAX_SCALE, SCENE_FPS_FULL, SCENE_FPS_LEAN } from './sceneCanvasLayout';
import type { SceneClock } from './sceneClock';
import plate from './scenePlate.module.css';

/**
 * The cathedral behind the main menu and the run's end, as a place rather than a picture.
 *
 * `scripts/scene-pipeline/cathedral.sh` splits the painting into a dark *base* and two additive
 * light layers: the candlelight pooled on the pillars, rails and floor, and the teal spirit-light
 * climbing the far arch, and cuts every candle flame out as a flipbook. `composeCathedralScene`
 * turns those and the baked ambient sprites into one frame — the candlelight wavering, each
 * candle on its own clock, a draught now and then, moonlight and dust, mist, moths, a bat — and
 * `SceneCanvas` paints it into a single canvas. The plate drifts slowly and turns with the
 * pointer (`useSceneLook`).
 *
 * The parent owns the mask, the filter and how far the whole scene sinks into the page; the base
 * alone reads `--scene-base-opacity` and the lights `--scene-light-opacity`, so the candles can
 * burn brighter than the nave they light. At the run's end (`mood="ended"`) the candlelight
 * sinks and the spirit-light takes the nave, and `heat` lets the candles go on burning at the rate
 * the run earned while it does. `getSceneEffectTier` decides the rest: `full` on a desktop (the
 * plate drifts and turns), `lean` on a phone or at `low` (the same room, fewer specks, no drift),
 * `still` under reduce motion.
 */
export interface CathedralSceneProps {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    /**
     * `ended` is the run's end: the candlelight sinks and the spirit-light takes the nave, the
     * candles burning low over their stands. Default `menu`.
     */
    mood?: 'menu' | 'ended';
    /**
     * How hot the run behind this screen got, 0..1 on the chain meter's own scale, or null when
     * there is no run behind it — the main menu, or a first launch.
     *
     * The gameplay room reads this live; here it is a run already over, so what it lights is the
     * best chain the player actually reached. It is not a contradiction with `ended`: the nave
     * sinks either way, and the candles going on burning at the rate the run earned, against a
     * room going dark, is the room remembering how the run went. A player who never chained ends
     * on guttering candles; one who hit Fever ends on a nave still alight.
     */
    heat?: number | null;
    /**
     * The player is about to go in (the menu's Play has the pointer or the focus): the candles
     * burn up and the candlelight on the stone rises with them, and settle when the hand moves on.
     */
    stirred?: boolean;
}

export function CathedralScene({ heat = null, mood = 'menu', quality, reduceMotion, stirred = false }: CathedralSceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const lookRef = useRef({ x: 0, y: 0 });
    const tier = useSceneEffectTier(quality, reduceMotion);
    const still = tier === 'still';
    const alive = tier === 'full';
    const candles = SCENE_SPRITES.cathedralCandles;
    useSceneLook(sceneRef, alive, lookRef);
    const compose = useCallback(
        (clock: SceneClock, levels: SceneLevels) => composeCathedralScene({ mood, heat, stirred, tier, base: levels.base, light: levels.light }, clock),
        [mood, heat, stirred, tier]
    );
    return (
        <div
            aria-hidden="true"
            className={plate.scene}
            data-alive={alive ? 'true' : 'false'}
            data-mood={mood}
            data-scene-heat={heat === null ? 'none' : heat.toFixed(2)}
            data-scene-effect-tier={tier}
            data-stirred={stirred ? 'true' : 'false'}
            data-still={still ? 'true' : 'false'}
            data-testid="cathedral-scene"
            ref={sceneRef}
            style={{ '--scene-plate-aspect': `${candles.plate[0]} / ${candles.plate[1]}` } as React.CSSProperties}
        >
            <div className={plate.plate} data-testid="cathedral-scene-plate">
                <SceneCanvas
                    compose={compose}
                    fps={alive ? SCENE_FPS_FULL : SCENE_FPS_LEAN}
                    maxScale={tier === 'lean' ? 1 : SCENE_CANVAS_MAX_SCALE}
                    lookRef={lookRef}
                    plate={candles.plate}
                    still={still}
                    testId="cathedral-scene-canvas"
                />
            </div>
        </div>
    );
}
