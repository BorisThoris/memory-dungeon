import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MeshBasicMaterial, PlaneGeometry, Vector2, type Group } from 'three';
import type { BoardState } from '../../shared/contracts';
import { colossusElement } from '../../shared/colossus-rules';
import { elementTexture } from './ElementCardBack';
import { CARD_DISSOLVE_EDGE, installCardDissolve, setCardDissolve } from './cardDissolveMaterial';
import { CARD_BACK_INK } from './cardBackInk';
import { noopMeshRaycast } from './tileBoardPick';
import { colossusStoneLayout } from './colossusStoneLayout';

/**
 * The Colossus on the board (rules 63, `colossus-rules.ts`): a card two cells wide and two tall,
 * standing at the head of the grid in the space the board's fit leaves for it
 * (`colossusStoneLayout.ts`). It is the element's own card back, grown to four cells - the same
 * art, the same rune, nothing a run has not already loaded - and the fight is written on it:
 *
 * - **Cracks** run out from its heart as hits land, lit from inside in its element.
 * - **A flash** on every hit.
 * - **A pip** for every hit it still takes, along its foot.
 * - **Felled**, it burns away its element's way, like any card leaving the board.
 * - **Broken** (out of turns), its four quarters fly apart - its four cells' worth of cards, now
 *   two face-down pairs somewhere on the board.
 *
 * The words - its clock, what the last turn did - stay on the card in the board's crown
 * (`ColossusCard.tsx`), which a screen reader can read. Not pickable: it is never turned over.
 */
const QUARTERS = [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const;
const BREAK_SECONDS = 1.1;
const FELL_SECONDS = 0.9;

const crackShader = /* glsl */ `
if (diffuseColor.a > 0.5) {
    vec2 q = (vStoneUv - 0.5) * vec2(1.0, 1.42);
    // Voronoi seams, shown from the heart out as far as the hits have reached.
    vec2 p = vStoneUv * vec2(4.0, 5.6) + 3.7;
    vec2 cell = floor(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 n = cell + vec2(float(x), float(y));
            vec2 site = n + fract(sin(vec2(dot(n, vec2(127.1, 311.7)), dot(n, vec2(269.5, 183.3)))) * 43758.5453);
            float d = length(site - p);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
        }
    }
    float seam = 1.0 - smoothstep(0.0, 0.05, d2 - d1);
    float reach = smoothstep(uCrack * 0.62 + 0.02, uCrack * 0.62 - 0.04, length(q));
    float crack = seam * reach * step(0.001, uCrack);
    diffuseColor.rgb = mix(diffuseColor.rgb, uStoneLight * 1.8, crack * 0.85);
    // Hits left, as pips along the foot.
    float pips = 0.0;
    for (int i = 0; i < 6; i++) {
        if (float(i) >= uPips.y) break;
        float x = (float(i) - (uPips.y - 1.0) * 0.5) * 0.085;
        float r = length((vStoneUv - vec2(0.5 + x, 0.115)) * vec2(1.0, 1.42));
        float ring = 1.0 - smoothstep(0.012, 0.016, abs(r - 0.022));
        float dot_ = (1.0 - smoothstep(0.014, 0.018, r)) * step(float(i), uPips.x - 0.5);
        pips = max(pips, max(ring, dot_));
    }
    // A border rule like every card back's (cardBackInk.ts), inset from the painted edge.
    vec2 b = abs(vStoneUv - 0.5) * vec2(1.0, 1.42) - vec2(0.43, 0.6);
    float box = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.02;
    float rule = 1.0 - smoothstep(0.0015, 0.0015 + fwidth(box) * 1.5, abs(box));
    pips = max(pips, rule * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, uStoneInk, pips * 0.9);
    diffuseColor.rgb += uStoneLight * uFlash * 0.9;
}`;

type StoneUniforms = { uCrack: { value: number }; uFlash: { value: number }; uPips: { value: Vector2 }; uStoneLight: { value: Color }; uStoneInk: { value: Color } };

/** One frame of the fight on the card's face. */
const paintStone = (uniforms: StoneUniforms, crack: number, flash: number, hitsLeft: number, hitsMax: number): void => {
    uniforms.uCrack.value = crack;
    uniforms.uFlash.value = flash;
    uniforms.uPips.value.set(hitsLeft, hitsMax);
};

const installStone = (material: MeshBasicMaterial, uniforms: { uCrack: { value: number }; uFlash: { value: number }; uPips: { value: Vector2 }; uStoneLight: { value: Color }; uStoneInk: { value: Color } }) => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vStoneUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvStoneUv = uv;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vStoneUv;\nuniform float uCrack;\nuniform float uFlash;\nuniform vec2 uPips;\nuniform vec3 uStoneLight;\nuniform vec3 uStoneInk;')
            .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${crackShader}`);
    };
    const key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `colossusStone:${key}`;
    material.needsUpdate = true;
};

export function ColossusStone({ board, compact, reduceMotion, rows, time }: {
    board: BoardState;
    compact: boolean;
    /** The rows the grid is drawn in, which can differ from the board's own while it reflows. */
    rows: number;
    reduceMotion: boolean;
    time: MutableRefObject<number>;
}) {
    const colossus = board.colossus!;
    const element = colossusElement(colossus);
    const layout = colossusStoneLayout(board, compact, rows);
    const group = useRef<Group | null>(null);
    const quarters = useRef<(Group | null)[]>([]);
    const uniforms = useMemo(() => ({
        uCrack: { value: 0 },
        uFlash: { value: 0 },
        uPips: { value: new Vector2() },
        uStoneLight: { value: new Color(CARD_DISSOLVE_EDGE[element]) },
        uStoneInk: { value: new Color(CARD_BACK_INK[element]) }
    }), [element]);
    const materials = useMemo(() => QUARTERS.map(() => {
        const material = new MeshBasicMaterial({ map: elementTexture(element, false), transparent: true, toneMapped: false, alphaTest: 0.06 });
        installCardDissolve(material, element, { seed: board.level * 7919 });
        installStone(material, uniforms);
        return material;
    }), [board.level, element, uniforms]);
    // Each quarter shows its own quarter of the card, so whole they are the card.
    const geometries = useMemo(() => QUARTERS.map(([sx, sy]) => {
        const geometry = new PlaneGeometry(layout.width / 2, layout.height / 2);
        const uv = geometry.attributes.uv!;
        for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 0.5 + (sx > 0 ? 0.5 : 0), uv.getY(i) * 0.5 + (sy > 0 ? 0.5 : 0));
        uv.needsUpdate = true;
        return geometry;
    }), [layout.height, layout.width]);
    useEffect(() => () => {
        for (const material of materials) material.dispose();
        for (const geometry of geometries) geometry.dispose();
    }, [geometries, materials]);

    const seen = useRef({ hits: colossus.hits, status: colossus.status, flashAt: -10, endedAt: null as number | null });
    useFrame(() => {
        const now = time.current;
        const memory = seen.current;
        if (colossus.hits < memory.hits) memory.flashAt = now;
        if (colossus.status !== 'standing' && memory.status === 'standing') memory.endedAt = now;
        memory.hits = colossus.hits;
        memory.status = colossus.status;
        paintStone(
            uniforms,
            colossus.hitsMax > 0 ? 1 - colossus.hits / colossus.hitsMax : 0,
            reduceMotion ? 0 : Math.max(0, 1 - (now - memory.flashAt) / 0.35),
            colossus.status === 'standing' ? colossus.hits : 0,
            colossus.hitsMax
        );
        const ended = memory.endedAt;
        // A Colossus that ended before this board mounted (a restore) is simply gone.
        const age = ended === null ? (colossus.status === 'standing' ? -1 : Infinity) : now - ended;
        if (group.current) group.current.visible = age < Math.max(BREAK_SECONDS, FELL_SECONDS);
        QUARTERS.forEach(([sx, sy], index) => {
            const quarter = quarters.current[index];
            if (!quarter) return;
            const material = materials[index]!;
            if (colossus.status === 'split' && age >= 0) {
                const t = reduceMotion ? 1 : Math.min(1, age / BREAK_SECONDS);
                const out = t * t * 0.9;
                quarter.position.set(sx * (layout.width / 4 + out), sy * (layout.height / 4 + out) - t * t * 0.6, 0);
                quarter.rotation.z = sx * sy * t * 0.5;
                setCardDissolve(material, Math.max(0, (t - 0.35) / 0.65));
            } else if (colossus.status === 'felled' && age >= 0) {
                quarter.position.set(sx * layout.width / 4, sy * layout.height / 4, 0);
                setCardDissolve(material, reduceMotion ? 1 : Math.min(1, age / FELL_SECONDS));
            } else {
                quarter.position.set(sx * layout.width / 4, sy * layout.height / 4, 0);
                quarter.rotation.z = 0;
                setCardDissolve(material, 0);
            }
        });
    });

    return (
        <group ref={group} position={[layout.x, layout.y, 0.02]}>
            {QUARTERS.map((_, index) => (
                <group key={index} ref={(node) => { quarters.current[index] = node; }}>
                    <mesh geometry={geometries[index]} material={materials[index]} raycast={noopMeshRaycast} renderOrder={8} />
                </group>
            ))}
        </group>
    );
}
