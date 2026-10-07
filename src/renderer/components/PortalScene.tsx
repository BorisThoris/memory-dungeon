import { useCallback, useRef, type CSSProperties } from 'react';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { useSceneEffectTier } from '../hooks/useSceneEffectTier';
import { useSceneLook } from '../hooks/useSceneLook';
import { composePortalScene } from './portalSceneFrame';
import { SceneCanvas, type SceneLevels } from './SceneCanvas';
import { SCENE_FPS_FULL, SCENE_FPS_LEAN } from './sceneCanvasLayout';
import type { SceneClock } from './sceneClock';
import plate from './scenePlate.module.css';

/**
 * The portal clearing behind Choose Your Path (the Classic poster), as a place.
 *
 * `scripts/scene-pipeline/portal.sh` splits the painting into a dark *base* and three additive
 * light layers, the cyan of the arch's runes and the glowing plants, the moon and its halo, and
 * the stars, and cuts the vortex out of the arch as one feathered disc. `composePortalScene` turns
 * those and the baked ambient sprites into one frame — the lights breathing, the vortex turning
 * and drawing sparks in, mist, motes, fireflies, falling leaves, a falling star — and `SceneCanvas`
 * paints it into a single canvas. The plate drifts slowly and turns with the pointer
 * (`useSceneLook`).
 *
 * The parent owns the mask, the filter and how far the scene sinks into the page; the base reads
 * `--scene-base-opacity` and the lights `--scene-light-opacity`. `getSceneEffectTier` decides the
 * rest: `full` on a desktop, `lean` on a phone or at `low` (the same clearing, fewer specks, no
 * drift), `still` under reduce motion.
 */
export interface PortalSceneProps {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
}

export function PortalScene({ quality, reduceMotion }: PortalSceneProps) {
    const sceneRef = useRef<HTMLDivElement>(null);
    const lookRef = useRef({ x: 0, y: 0 });
    const tier = useSceneEffectTier(quality, reduceMotion);
    const still = tier === 'still';
    const alive = tier === 'full';
    const set = SCENE_SPRITES.portalVortex;
    useSceneLook(sceneRef, alive, lookRef);
    const compose = useCallback(
        (clock: SceneClock, levels: SceneLevels) => composePortalScene({ tier, base: levels.base, light: levels.light }, clock),
        [tier]
    );
    return (
        <div
            aria-hidden="true"
            className={plate.scene}
            data-alive={alive ? 'true' : 'false'}
            data-scene-effect-tier={tier}
            data-still={still ? 'true' : 'false'}
            data-testid="portal-scene"
            ref={sceneRef}
            style={{ '--scene-plate-aspect': `${set.plate[0]} / ${set.plate[1]}` } as CSSProperties}
        >
            <div className={plate.plate} data-testid="portal-scene-plate">
                <SceneCanvas
                    compose={compose}
                    fps={alive ? SCENE_FPS_FULL : SCENE_FPS_LEAN}
                    lookRef={lookRef}
                    plate={set.plate}
                    still={still}
                    testId="portal-scene-canvas"
                />
            </div>
        </div>
    );
}
