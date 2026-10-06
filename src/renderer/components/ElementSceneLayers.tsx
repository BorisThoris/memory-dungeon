import { useState, type CSSProperties } from 'react';
import { UI_ART } from '../assets/ui';
import { ELEMENT_SCENE_SUITS, ELEMENT_SCENE_VISUALS, type ElementSceneKind, type ElementSceneState } from './elementScene';
import { ELEMENT_SCENE_ART } from './elementSceneArt';
import { useBeat } from './useSceneBeat';
import styles from './ElementSceneLayers.module.css';

const lightHue = { ember: 100, tide: -45, bone: -25, moss: -125 };

export function ElementSceneLayers({ scene, still, alive, plate }: {
    scene: ElementSceneState; still: boolean; alive: boolean; plate: 'dungeon' | 'void' | 'shop';
}) {
    const [loaded, setLoaded] = useState<Partial<Record<ElementSceneKind, boolean>>>({});
    const beat = useBeat(scene.pulseKey, 1000);
    return <div className={styles.world} data-testid="element-scene" data-still={still} data-alive={alive}
        data-reactions={scene.reactions.filter(r => r.weight > 0.01).map(r => r.kind).join(' ')} data-plate={plate}>
        {scene.reactions.map(({ kind, opacity, weight }) => <div key={kind} className={styles.reaction}
            data-testid={`element-scene-${kind}`} data-kind={kind} data-active={weight > 0.01}
            data-pulse={beat && !still && scene.pulseKinds.includes(kind)}
            style={{ '--element-opacity': loaded[kind] ? opacity : 0, '--element-energy': weight,
                '--element-light': ELEMENT_SCENE_VISUALS[kind].light } as CSSProperties}>
            <img alt="" aria-hidden="true" className={styles.painting} src={ELEMENT_SCENE_ART[kind].desktop}
                srcSet={`${ELEMENT_SCENE_ART[kind].mobile} 768w, ${ELEMENT_SCENE_ART[kind].desktop} 1376w`}
                sizes="100vw" decoding="async" draggable={false}
                onLoad={() => setLoaded(previous => previous[kind] ? previous : { ...previous, [kind]: true })} />
            <div className={styles.energy} />
        </div>)}
        {ELEMENT_SCENE_SUITS.map(suit => <div key={suit} className={styles.materialLight} data-element={suit}
            style={{ backgroundImage: `url(${UI_ART.gameplaySceneLightRing})`, opacity: scene.elements[suit] * 0.32,
                filter: `hue-rotate(${lightHue[suit]}deg) saturate(1.35)` }} />)}
    </div>;
}
