import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, Vector3, type Texture } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { CARD_DISSOLVE_EDGE } from './cardDissolveMaterial';
import { cardShardPieces, SHARD_STYLES, shardFlight, shardPath, shardPose, shardStyleOf, type ShardFlight, type ShardPath, type ShardPiece, type ShardStyleSpec } from './cardShards';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getCardFaceStaticTexture, getTileFaceOverlayTexture, getTileFaceTexture } from './tileTextures';

/**
 * The pieces of the cards that break (`cardShards.ts`), drawn on the board: each piece a polygon of
 * its card - the face and its illustration on one side, the card's back on the other - going its
 * element's way (the look, in the shader below): fire chars from the break behind a moving ember
 * rim and crumbles to ash; water turns to clear water with a light running over it and drains away
 * from the bottom; ice frosts over, bright at the break and glinting, and melts; growth greens in
 * from its edges and crumbles; stone greys at the break and crumbles to dust. Pooled by card: a
 * break makes one material and its pieces' meshes, dropped when its last piece is gone.
 */

const vertexShader = `
varying vec2 vUv;
varying float vEdge;
attribute float edge;
void main() {
    vUv = uv;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
uniform sampler2D uFace;
uniform sampler2D uOverlay;
uniform sampler2D uBack;
uniform float uHasOverlay;
uniform vec3 uEdge;
uniform float uLook;
uniform float uGo;
uniform float uAge;
uniform float uFade;
varying vec2 vUv;
varying float vEdge;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
    vec4 colour;
    if (gl_FrontFacing) {
        colour = texture2D(uFace, vUv);
        vec4 art = texture2D(uOverlay, vUv);
        colour.rgb = mix(colour.rgb, art.rgb, art.a * uHasOverlay);
        colour.a = max(colour.a, art.a * uHasOverlay);
    } else {
        colour = texture2D(uBack, vec2(1.0 - vUv.x, vUv.y));
    }
    // 0 on the break, 1 deep inside the piece; roughened so nothing goes in a clean line.
    float inside = clamp(vEdge * 4.0, 0.0, 1.0);
    float grain = noise(vUv * 38.0);
    float rough = clamp(1.0 - inside + (grain - 0.5) * 0.35, 0.0, 1.0);
    float crack = 1.0 - smoothstep(0.0, 0.05, vEdge);
    vec3 rgb = colour.rgb;
    float alpha = colour.a;
    int look = int(uLook + 0.5);
    if (look == 1) {
        // Fire: char eats in from the break (rough = 1) behind a moving ember rim, the char behind it going to ash.
        float front = 1.0 - uGo * 1.4;
        float charred = smoothstep(front, front + 0.2, rough);
        rgb = mix(rgb, vec3(0.07, 0.045, 0.035), charred);
        float rim = exp(-pow(rough - front, 2.0) / 0.006) * step(0.001, uGo);
        rgb += uEdge * (1.7 * rim + 0.9 * crack * (1.0 - uGo));
        alpha *= 1.0 - smoothstep(front + 0.35, front + 0.55, rough) * step(0.25, uGo);
    } else if (look == 2) {
        // Water: it turns to clear water, a light running over it, and drains away from the bottom.
        rgb = mix(rgb, vec3(0.16, 0.42, 0.62), 0.3 + 0.45 * uGo);
        float sheen = smoothstep(0.6, 1.0, sin(vUv.y * 26.0 - uAge * 7.0 + vUv.x * 9.0));
        rgb += vec3(0.55, 0.8, 1.0) * sheen * 0.35 + uEdge * crack * 0.5;
        alpha *= (0.92 - 0.35 * uGo) * smoothstep(uGo * 1.25 - 0.25, uGo * 1.25, vUv.y + (grain - 0.5) * 0.1);
    } else if (look == 3) {
        // Ice: frosted, bright and cold at the break, glinting, melting at the end.
        // Glass: the card seen through cold ice, clear in the middle, bright where it broke, a light
        // sweeping across each piece as it turns, and melting away at the end.
        rgb = mix(rgb, vec3(0.62, 0.84, 0.98), 0.45);
        rgb += vec3(0.75, 0.95, 1.0) * crack * 1.6;
        float sweep = smoothstep(0.82, 1.0, sin((vUv.x + vUv.y) * 9.0 - uAge * 6.0));
        rgb += vec3(0.85, 0.97, 1.0) * sweep * 0.5;
        float glint = step(0.993, hash(floor(vUv * 70.0) + floor(uAge * 9.0)));
        rgb += vec3(1.0) * glint * 1.6;
        alpha *= (1.0 - uGo) * mix(0.95, 0.42, inside) + sweep * 0.25 * (1.0 - uGo);
    } else if (look == 4) {
        // Growth: a leaf's green creeps in from the break; it crumbles away from the edges at the end.
        float green = smoothstep(1.0 - uGo * 1.3, 1.3 - uGo * 1.3, rough);
        rgb = mix(rgb, vec3(0.2, 0.42, 0.14), max(green * 0.75, crack * 0.45));
        rgb += uEdge * crack * 0.4;
        alpha *= 1.0 - smoothstep(0.55, 0.95, uGo + rough * 0.3 - 0.15);
    } else {
        // Stone: grey at the break, crumbling to dust from the edges.
        float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
        rgb = mix(rgb, vec3(grey * 0.8), crack * 0.8 + uGo * 0.3);
        alpha *= 1.0 - smoothstep(0.5, 0.9, uGo + rough * 0.35 - 0.15);
    }
    alpha *= uFade;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    // The card textures are sRGB: convert to the output the way the cards themselves are drawn.
    #include <colorspace_fragment>
}`;

interface ShardMesh {
    mesh: Mesh;
    path: ShardPath;
    flight: ShardFlight;
}

interface Break {
    start: number;
    style: ShardStyleSpec;
    material: ShaderMaterial;
    pieces: ShardMesh[];
}

/** A piece's geometry: a fan over its outline, the card's own UVs, and how far each vertex is from the break. */
const pieceGeometry = (piece: ShardPiece): BufferGeometry => {
    const points = piece.outline;
    const positions: number[] = [];
    const uvs: number[] = [];
    const edges: number[] = [];
    const push = ([x, y]: readonly [number, number], edge: number): void => {
        positions.push(x, y, 0);
        uvs.push((x + piece.cx) / CARD_PLANE_WIDTH + 0.5, (y + piece.cy) / CARD_PLANE_HEIGHT + 0.5);
        edges.push(edge);
    };
    // The centre is as far from the break as the piece is wide; the outline is on it.
    const reach = Math.min(...points.map(([x, y]) => Math.hypot(x, y))) / CARD_PLANE_WIDTH;
    for (let index = 0; index < points.length; index += 1) {
        push([0, 0], reach);
        push(points[index]!, 0);
        push(points[(index + 1) % points.length]!, 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute('edge', new BufferAttribute(new Float32Array(edges), 1));
    return geometry;
};

const BLANK = { value: null as Texture | null };

export const createCardShardSystem = () => {
    const group = new Group();
    group.name = 'card-shards';
    const breaks: Break[] = [];
    const quaternion = new Quaternion();
    const axis = new Vector3();
    const drop = (shattered: Break): void => {
        for (const { mesh } of shattered.pieces) {
            group.remove(mesh);
            mesh.geometry.dispose();
        }
        shattered.material.dispose();
    };
    return {
        group,
        /**
         * Break a card, its element's way: its pieces start where they lie on it and are thrown off,
         * `delay` seconds after `time`; `floorY` is the floor under the board's lowest row.
         */
        spawn({ tile, x, y, z, seed, time, delay, floorY, quality, energy }: { tile: Tile; x: number; y: number; z: number; seed: number; time: number; delay: number; floorY: number; quality: GraphicsQualityPreset; energy: number }): number {
            const style = SHARD_STYLES[shardStyleOf(tile.suit)];
            const count = Math.max(3, Math.round(style.count * (quality === 'low' ? 0.6 : quality === 'medium' ? 0.8 : 1)));
            const face = getCardFaceStaticTexture();
            const overlay = getTileFaceOverlayTexture(tile, 'matched', quality);
            const back = getTileFaceTexture(tile, 'back', 'hidden', 'panel');
            const material = new ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: {
                    uFace: { value: face },
                    uOverlay: overlay ? { value: overlay } : BLANK,
                    uBack: { value: back ?? face },
                    uHasOverlay: { value: overlay ? 1 : 0 },
                    uEdge: { value: new Color(CARD_DISSOLVE_EDGE[tile.suit ?? 'none'] ?? '#ffd27a') },
                    uLook: { value: style.look },
                    uGo: { value: 0 },
                    uAge: { value: 0 },
                    uFade: { value: 0 }
                },
                side: DoubleSide,
                transparent: true,
                depthWrite: false
            });
            const pieces = cardShardPieces(seed, count).map((piece, index) => {
                const mesh = new Mesh(pieceGeometry(piece), material);
                mesh.renderOrder = 3;
                mesh.visible = false;
                mesh.frustumCulled = false;
                group.add(mesh);
                const flight = shardFlight(piece, seed, index, style, energy);
                return { mesh, flight, path: shardPath(flight, style, x + piece.cx, y + piece.cy, z, floorY) };
            });
            breaks.push({ start: time + delay, style, material, pieces });
            return pieces.length;
        },
        /** Pose every piece at `now`; drop the breaks that are over. Returns how many pieces are showing. */
        advance(now: number): number {
            let live = 0;
            for (let index = breaks.length - 1; index >= 0; index -= 1) {
                const shattered = breaks[index]!;
                const t = now - shattered.start;
                if (t > shattered.style.life) {
                    drop(shattered);
                    breaks.splice(index, 1);
                    continue;
                }
                const uniforms = shattered.material.uniforms;
                uniforms.uAge!.value = Math.max(0, t);
                uniforms.uGo!.value = Math.min(1, Math.max(0, (t - shattered.style.goFrom) / (shattered.style.life - shattered.style.goFrom)));
                uniforms.uFade!.value = t < 0 ? 0 : Math.min(1, t / 0.05);
                for (const { mesh, path, flight } of shattered.pieces) {
                    if (t < 0) {
                        mesh.visible = false;
                        continue;
                    }
                    const pose = shardPose(path, t);
                    mesh.visible = true;
                    mesh.position.set(pose.x, pose.y, pose.z);
                    axis.set(flight.axis[0], flight.axis[1], flight.axis[2]);
                    quaternion.setFromAxisAngle(axis, pose.angle);
                    mesh.quaternion.copy(quaternion);
                    live += 1;
                }
            }
            return live;
        },
        clear(): void {
            for (const shattered of breaks) drop(shattered);
            breaks.length = 0;
        },
        dispose(): void {
            this.clear();
        }
    };
};

export type CardShardSystem = ReturnType<typeof createCardShardSystem>;
