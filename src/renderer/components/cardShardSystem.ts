import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, Vector3, type Texture } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { CARD_DISSOLVE_EDGE } from './cardDissolveMaterial';
import { cardShardPieces, shardFlight, shardPose, type ShardFlight, type ShardPiece } from './cardShards';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getCardFaceStaticTexture, getTileFaceOverlayTexture, getTileFaceTexture } from './tileTextures';

/**
 * The pieces of the cards that break (`cardShards.ts`), drawn on the board: each piece a polygon of
 * its card, the face art and the card's illustration on its front and the card's back on its back,
 * the element's own colour burning in from its broken edges as it goes. Pooled by card: a break
 * makes one material and its pieces' meshes, and they are dropped when the last piece has burned.
 */

/** How long a piece lasts: thrown, falling, lying a beat, burning away. */
export const SHARD_LIFE_SECONDS = 3.0;
const BURN_FROM = 2.2;

const vertexShader = `
varying vec2 vUv;
varying vec2 vEdge;
attribute vec2 edge;
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
uniform float uBurn;
uniform float uFade;
varying vec2 vUv;
varying vec2 vEdge;
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
    // The broken edge: how near this point is to the piece's outline (0 on it).
    float edge = vEdge.x;
    // A thin bright line along the break, the element's colour, and the burn eating in from it.
    float crack = 1.0 - smoothstep(0.0, 0.035, edge);
    float burnt = smoothstep(uBurn - 0.05, uBurn, 1.0 - edge * 4.0);
    vec3 lit = colour.rgb + uEdge * crack * 0.9;
    lit = mix(lit, uEdge * 1.4, smoothstep(uBurn - 0.12, uBurn, 1.0 - edge * 4.0) * step(0.001, uBurn));
    float alpha = colour.a * (1.0 - burnt * step(0.001, uBurn)) * uFade;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(lit, alpha);
    // The card textures are sRGB: convert to the output the way the cards themselves are drawn.
    #include <colorspace_fragment>
}`;

interface ShardMesh {
    mesh: Mesh;
    flight: ShardFlight;
    piece: ShardPiece;
}

interface Break {
    start: number;
    origin: Vector3;
    floorY: number;
    material: ShaderMaterial;
    pieces: ShardMesh[];
}

/** A piece's geometry: a fan over its outline, the card's own UVs, and how far each vertex is from the break. */
const pieceGeometry = (piece: ShardPiece): BufferGeometry => {
    const points = piece.outline;
    const centre: [number, number] = [0, 0];
    const positions: number[] = [];
    const uvs: number[] = [];
    const edges: number[] = [];
    const push = ([x, y]: readonly [number, number], edge: number): void => {
        positions.push(x, y, 0);
        uvs.push((x + piece.cx) / CARD_PLANE_WIDTH + 0.5, (y + piece.cy) / CARD_PLANE_HEIGHT + 0.5);
        edges.push(edge, 0);
    };
    // The centre is as far from the break as the piece is wide; the outline is on it.
    const reach = Math.min(...points.map(([x, y]) => Math.hypot(x, y))) / CARD_PLANE_WIDTH;
    for (let index = 0; index < points.length; index += 1) {
        push(centre, reach);
        push(points[index]!, 0);
        push(points[(index + 1) % points.length]!, 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute('edge', new BufferAttribute(new Float32Array(edges), 2));
    return geometry;
};

const BLANK = { value: null as Texture | null };

export const createCardShardSystem = () => {
    const group = new Group();
    group.name = 'card-shards';
    const breaks: Break[] = [];
    const quaternion = new Quaternion();
    const axis = new Vector3();
    return {
        group,
        /**
         * Break a card: its pieces start where they lie on it and are thrown off. `delay` seconds after
         * `time`; `floorY` is where the board's floor is, under the lowest row.
         */
        spawn({ tile, x, y, z, seed, time, delay, floorY, quality, energy }: { tile: Tile; x: number; y: number; z: number; seed: number; time: number; delay: number; floorY: number; quality: GraphicsQualityPreset; energy: number }): number {
            const count = quality === 'low' ? 5 : quality === 'medium' ? 7 : 9;
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
                    uBurn: { value: 0 },
                    uFade: { value: 1 }
                },
                side: DoubleSide,
                transparent: true,
                depthWrite: false
            });
            const pieces = cardShardPieces(seed, count).map((piece, index) => {
                const mesh = new Mesh(pieceGeometry(piece), material);
                mesh.renderOrder = 8;
                mesh.visible = false;
                mesh.frustumCulled = false;
                group.add(mesh);
                return { mesh, piece, flight: shardFlight(piece, seed, index, 1.6 + 1.4 * energy) };
            });
            breaks.push({ start: time + delay, origin: new Vector3(x, y, z), floorY, material, pieces });
            return pieces.length;
        },
        /** Pose every piece at `now`; drop the breaks that are over. Returns how many pieces are flying or lying. */
        advance(now: number): number {
            let live = 0;
            for (let index = breaks.length - 1; index >= 0; index -= 1) {
                const shattered = breaks[index]!;
                const t = now - shattered.start;
                if (t > SHARD_LIFE_SECONDS) {
                    for (const { mesh } of shattered.pieces) {
                        group.remove(mesh);
                        mesh.geometry.dispose();
                    }
                    shattered.material.dispose();
                    breaks.splice(index, 1);
                    continue;
                }
                const uniforms = shattered.material.uniforms;
                uniforms.uBurn!.value = t < BURN_FROM ? 0 : Math.min(1.2, (t - BURN_FROM) / (SHARD_LIFE_SECONDS - BURN_FROM) * 1.2);
                uniforms.uFade!.value = t < 0 ? 0 : Math.min(1, t / 0.05);
                for (const { mesh, piece, flight } of shattered.pieces) {
                    if (t < 0) {
                        mesh.visible = false;
                        continue;
                    }
                    const pose = shardPose(flight, t, shattered.origin.x + piece.cx, shattered.origin.y + piece.cy, shattered.origin.z, shattered.floorY);
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
            for (const shattered of breaks) {
                for (const { mesh } of shattered.pieces) {
                    group.remove(mesh);
                    mesh.geometry.dispose();
                }
                shattered.material.dispose();
            }
            breaks.length = 0;
        },
        dispose(): void {
            this.clear();
        }
    };
};

export type CardShardSystem = ReturnType<typeof createCardShardSystem>;
