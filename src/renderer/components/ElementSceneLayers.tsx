import type { ElementSceneState } from './elementScene';
import type { ScenePlateId } from './sceneMood';

/**
 * What chemistry is in the room, as data.
 *
 * The paintings, their crossfade and the light each element throws are drawn by the scene's canvas
 * (`elementDraws` in `gameplaySceneFrame.ts`), under the room's light passes where they belong.
 * They used to be elements here, each a full-plate image screened over the stone. What is left is
 * the record of the room's state: one node per reaction with whether it is active and how much of
 * the wall it has, which is what the tests and anything driving the app read.
 */
export function ElementSceneLayers({ scene, still, alive, plate }: {
    scene: ElementSceneState; still: boolean; alive: boolean; plate: ScenePlateId;
}) {
    return (
        <div
            data-alive={alive}
            data-plate={plate}
            data-reactions={scene.reactions.filter((reaction) => reaction.weight > 0.01).map((reaction) => reaction.kind).join(' ')}
            data-still={still}
            data-testid="element-scene"
            hidden
        >
            {scene.reactions.map(({ kind, opacity, weight }) => (
                <i
                    data-active={weight > 0.01}
                    data-kind={kind}
                    data-opacity={opacity.toFixed(3)}
                    data-testid={`element-scene-${kind}`}
                    key={kind}
                />
            ))}
        </div>
    );
}
