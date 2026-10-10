import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { groupCardDepartures, type DepartureSource } from './cardDepartureGrouping';
import { advanceDeparturePhysics, createDeparturePhysics, departureParticleRadius, impulseDeparturePhysics, DEPARTURE_PHYSICS_LIFE, type DeparturePhysics } from './cardDeparturePhysics';

const vertex = `varying vec2 vPoint; uniform vec4 uBounds;
void main(){vPoint=uBounds.xy+uv*uBounds.zw;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// A compact density kernel blends neighbours into ONE surface. Its analytic gradient supplies
// the normal; highlights and the thin rim follow the simulated surface, not moving UV noise.
const fragment = `
varying vec2 vPoint; uniform vec4 uParticles[48]; uniform vec4 uShape[48]; uniform float uCount;
uniform vec3 uTint; uniform float uFire; uniform float uDrive;
void main(){
 float density=0.;vec2 gradient=vec2(0.);float hot=0.;
 for(int i=0;i<48;i++){
  if(float(i)>=uCount)break;
  vec4 p=uParticles[i]; vec2 q=vPoint-p.xy;
  vec4 shape=uShape[i];
  vec2 axis=normalize(shape.zw+vec2(0.,.001));
  vec2 local=mix(q,vec2(dot(q,vec2(axis.y,-axis.x)),dot(q,axis)),uFire);
  float taper=mix(1.,1.-.68*clamp(local.y/max(.001,p.z),0.,1.),uFire);
  vec2 scale=shape.xy/vec2(taper,1.);
  vec2 d=local*scale;float r=max(.001,p.z);float k=max(0.,1.-dot(d,d)/(r*r));
  density+=k*k*k*p.w;
  gradient+=-6.*k*k*d*scale/(r*r)*p.w;
  hot+=k*k*p.w;
 }
 float edge=smoothstep(mix(.24,.16,uFire),.32,density);if(edge<.01)discard;
 vec3 n=normalize(vec3(-gradient*.19,1.));
 vec3 light=normalize(vec3(-.45,.7,.65));
 float spec=pow(max(0.,dot(n,normalize(light+vec3(0.,0.,1.)))),48.);
 float rim=pow(1.-n.z,2.);
 vec3 water=uTint*(.08+.17*max(0.,dot(n,light)))+vec3(.85,.96,1.)*(spec*.8+rim*.5);
 float shell=1.-smoothstep(.3,.85,density);
 float heat=clamp(hot*.6,0.,1.);
 vec3 fire=uTint*(.85+.15*heat)+vec3(1.,.85,.5)*pow(heat,3.)*(1.3+.18*uDrive);
 vec3 rgb=mix(water,fire,uFire);
 float alpha=mix((.13+.52*shell+.25*spec)*edge,edge*(.3+.65*sqrt(heat)),uFire);
 gl_FragColor=vec4(rgb,alpha);
 #include <colorspace_fragment>
}`;

const vineVertex = `attribute vec3 shade; varying vec3 vShade;
void main(){vShade=shade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const vineFragment = `varying vec3 vShade;uniform float uFade;uniform vec3 uTint;
void main(){if(uFade<.01)discard;gl_FragColor=vec4(uTint*vShade,uFade);
 #include <colorspace_fragment>
}`;

interface MaterialGroup { body: DeparturePhysics; mesh: Mesh<BufferGeometry, ShaderMaterial>; positions?: Float32Array; shades?: Float32Array }
export interface DepartureBinding { body: DeparturePhysics; source: number }
const groupBudget = (quality: GraphicsQualityPreset): number => quality === 'low' ? 4 : quality === 'medium' ? 6 : 8;
const tint = { water: '#5fd8ff', fire: '#ff8a2a', growth: '#8ef05a', ice: '#e8f6ff', stone: '#bcae93' };

const build = (body: DeparturePhysics): MaterialGroup => {
    if (body.cluster.material !== 'growth') {
        const uniforms = {
            uBounds: { value: new Vector4() }, uCount: { value: 0 },
            uParticles: { value: Array.from({ length: 48 }, () => new Vector4()) },
            uShape: { value: Array.from({ length: 48 }, () => new Vector4()) },
            uTint: { value: new Color(tint[body.cluster.material]) },
            uFire: { value: body.cluster.material === 'fire' ? 1 : 0 }, uDrive: { value: body.drive }
        };
        const mesh = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, blending: NormalBlending, side: DoubleSide }));
        mesh.position.z = -.021;
        mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.visible = false;
        return { body, mesh };
    }
    // Six-sided stems and folded leaves have real geometry and depth. One bounded buffer owns
    // the connected canopy; leaf bases are attached to the solver's stem endpoints.
    const positions = new Float32Array(body.stems.length * (6 * 6 * 4 + 6 * 6 * 4) * 3);
    const shades = new Float32Array(positions.length);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('shade', new BufferAttribute(shades, 3));
    const material = new ShaderMaterial({ vertexShader: vineVertex, fragmentShader: vineFragment, uniforms: { uFade: { value: 0 }, uTint: { value: new Color(tint.growth) } }, side: DoubleSide, transparent: true, depthWrite: false });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
    return { body, mesh, positions, shades };
};

const envelope = (body: DeparturePhysics, source: number, now: number): number => {
    const age = now - body.cluster.sources[source]!.start;
    return age < 0 ? 0 : Math.min(1, age / .12) * Math.min(1, Math.max(0, (DEPARTURE_PHYSICS_LIFE[body.cluster.material] - age) / .55));
};

const ease = (value: number): number => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
};

const update = (entry: MaterialGroup, now: number): void => {
    const { body, mesh } = entry;
    mesh.visible = now >= body.start;
    if (!mesh.visible) return;
    if (!entry.positions || !entry.shades) {
        let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
        const values = mesh.material.uniforms.uParticles!.value as Vector4[];
        const shapes = mesh.material.uniforms.uShape!.value as Vector4[];
        body.particles.forEach((particle, index) => {
            const fire = body.cluster.material === 'fire';
            const age = body.age - particle.born;
            // The fixed gas pool recycles at .75 s. Cool each tongue to nothing before moving
            // it back to its fuel inlet, then kindle it gently instead of teleporting a flame.
            const emission = fire ? ease(age / .09) * (1 - ease((age - .5) / .24)) : Number(age >= 0);
            const fade = Math.min(envelope(body, particle.source, now), particle.feed === undefined ? 1 : envelope(body, particle.feed, now)) * emission;
            const radius = departureParticleRadius(body, particle) * (fire ? 1.15 : 1.65);
            const contact = Math.max(0, 1 - (particle.y - body.cluster.sources[particle.source]!.floorY) / .3);
            const stretch = Math.min(.35, Math.max(0, -particle.vy) * .07) * (1 - contact);
            const sx = fire ? 1.05 : 1 - contact * .4 + stretch;
            const sy = fire ? .45 : (1 + contact * 3.8) / (1 + stretch);
            values[index]!.set(particle.x, particle.y, radius, fade * (body.cluster.material === 'fire' ? particle.temperature : 1));
            shapes[index]!.set(sx, sy, particle.vx, particle.vy);
            const reach = radius * (fire ? 2.4 : 1 / Math.min(sx, sy));
            left = Math.min(left, particle.x - reach); right = Math.max(right, particle.x + reach);
            bottom = Math.min(bottom, particle.y - reach); top = Math.max(top, particle.y + reach);
        });
        const width = right - left, height = top - bottom;
        mesh.material.uniforms.uCount!.value = body.particles.length;
        (mesh.material.uniforms.uBounds!.value as Vector4).set(left, bottom, width, height);
        mesh.position.set((left + right) / 2, (bottom + top) / 2, -.021);
        mesh.scale.set(width, height, 1);
        return;
    }
    const positions = entry.positions, shades = entry.shades;
    let cursor = 0;
    let fade = 0;
    const put = (x: number, y: number, z: number, light: number): void => {
        positions[cursor] = x; shades[cursor++] = light * .28;
        positions[cursor] = y; shades[cursor++] = light * .55;
        positions[cursor] = Math.min(-.018, z); shades[cursor++] = light * .2;
    };
    for (const stem of body.stems) {
        const a = body.particles[stem.a]!, b = body.particles[stem.b]!;
        const localFade = Math.min(envelope(body, a.source, now), envelope(body, b.source, now));
        fade = Math.max(fade, localFade);
        const length = Math.hypot(b.x - a.x, b.y - a.y) || .001;
        const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
        const age = now - Math.max(body.cluster.sources[a.source]!.start, body.cluster.sources[b.source]!.start);
        const segment = stem.junction ? 5 : stem.b % 6;
        const grown = ease((age - segment * .035) / .5);
        const radius = (stem.junction ? .018 : .012 + .012 * (1 - stem.b % 6 / 6)) * grown * localFade;
        const previous = body.stems.find(link => link.b === stem.a);
        const nextStem = body.stems.find(link => link.a === stem.b);
        const p0 = previous ? body.particles[previous.a]! : a;
        const p3 = nextStem ? body.particles[nextStem.b]! : b;
        // Hermite interpolation only rounds the solver's constrained polyline; all control
        // points are physical bodies, so bends respond to neighbour motion and impacts.
        const point = (t: number, axis: 'x' | 'y' | 'z'): number => {
            const t2 = t * t, t3 = t2 * t;
            return (2 * t3 - 3 * t2 + 1) * a[axis] + (t3 - 2 * t2 + t) * (b[axis] - p0[axis]) * .5
                + (-2 * t3 + 3 * t2) * b[axis] + (t3 - t2) * (p3[axis] - a[axis]) * .5;
        };
        for (let section = 0; section < 4; section++) for (let side = 0; side < 6; side++) {
            const angle = side * Math.PI / 3, next = (side + 1) * Math.PI / 3;
            const ring = (t: number, theta: number, light: number): void => put(point(t, 'x') + nx * Math.cos(theta) * radius, point(t, 'y') + ny * Math.cos(theta) * radius, point(t, 'z') + Math.sin(theta) * radius, light);
            const light = .7 + .45 * Math.sin(angle + .7), t = section / 4, end = (section + 1) / 4;
            ring(t, angle, light); ring(end, angle, light); ring(end, next, light);
            ring(t, angle, light); ring(end, next, light); ring(t, next, light);
        }
        for (const side of [-1, 1]) {
            // Alternating leaves unfurl after their stem; junctions remain bare flexible vines.
            const unfurl = ease((age - .12 - segment * .055 - (side === (stem.b % 2 ? 1 : -1) ? 0 : .13)) / .34);
            const leaf = stem.junction ? 0 : (.085 + .025 * Math.sin(stem.b * 17 + body.cluster.seed)) * unfurl * localFade;
            const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
            const lx = nx * side + tx * .5, ly = ny * side + ty * .5;
            for (let part = 0; part < 6; part++) {
                const t0 = part / 6, t1 = (part + 1) / 6;
                for (const half of [-1, 1]) {
                    const edge = (t: number, ridge: boolean): void => {
                        const width = ridge ? 0 : Math.sin(Math.PI * t) * leaf * .3 * half;
                        put(b.x + lx * leaf * t * 1.9 - ly * width, b.y + ly * leaf * t * 1.9 + lx * width,
                            b.z - Math.sin(Math.PI * t) * leaf * (ridge ? .16 : .34 + (1 - unfurl) * .7), half < 0 ? .8 : 1.3);
                    };
                    edge(t0, true); edge(t0, false); edge(t1, false);
                    edge(t0, true); edge(t1, false); edge(t1, true);
                }
            }
        }
    }
    mesh.material.uniforms.uFade!.value = fade;
    mesh.geometry.attributes.position!.needsUpdate = true;
    mesh.geometry.attributes.shade!.needsUpdate = true;
};

export const createCardDepartureWorld = () => {
    const group = new Group(); group.name = 'card-departure-world';
    const entries: MaterialGroup[] = [];
    let worldTime = 0;
    const bindings = new Map<string, DepartureBinding>();
    const drop = (entry: MaterialGroup): void => {
        group.remove(entry.mesh); entry.mesh.geometry.dispose(); entry.mesh.material.dispose();
        for (const source of entry.body.cluster.sources) bindings.delete(source.key);
    };
    return {
        group,
        impulse(x: number, y: number, ix: number, iy: number): void {
            for (const entry of entries) impulseDeparturePhysics(entry.body, x, y, ix * entry.body.drive, iy * entry.body.drive);
        },
        binding: (key: string): DepartureBinding | undefined => bindings.get(key),
        spawnWave(sources: readonly DepartureSource[], quality: GraphicsQualityPreset): void {
            if (!sources.length) return;
            const pending = [...sources];
            // Only still-fresh neighbouring emissions can merge. Transfer old particle states
            // into the new bounded pool so an arriving card cannot reset the group's motion.
            // Regroup the bounded active world with a spatial index. Comparing every incoming
            // source against every old source would freeze on overlapping huge break waves.
            const merging = [...entries];
            const earliest = Math.min(worldTime, ...sources.map(source => source.start));
            for (const entry of merging) pending.push(...entry.body.cluster.sources.filter(source => source.start + DEPARTURE_PHYSICS_LIFE[source.material] > earliest));
            const clusters = groupCardDepartures(pending);
            const incoming = new Set(sources.map(source => source.key));
            clusters.sort((a, b) => Number(b.sources.some(source => incoming.has(source.key))) - Number(a.sources.some(source => incoming.has(source.key))));
            const oldByKey = new Map(merging.flatMap(entry => entry.body.particles.map(particle => [entry.body.cluster.sources[particle.source]!.key, entry.body] as const)));
            for (const entry of merging) { drop(entry); entries.splice(entries.indexOf(entry), 1); }
            for (const cluster of clusters) {
                if (entries.length >= groupBudget(quality)) break;
                const body = createDeparturePhysics(cluster, quality);
                const old = cluster.sources.map(source => oldByKey.get(source.key)).find(Boolean);
                if (old) {
                    body.clock = Math.max(0, Math.min(worldTime, old.start + old.clock) - body.start);
                    body.age = body.clock;
                    const counts = new Map<string, number>();
                    for (const particle of body.particles) {
                        const key = cluster.sources[particle.source]!.key;
                        const prior = oldByKey.get(key);
                        if (!prior) continue;
                        const previous = prior.particles.filter(p => prior.cluster.sources[p.source]!.key === key);
                        const offset = counts.get(key) ?? 0; counts.set(key, offset + 1);
                        const match = previous[offset % previous.length];
                        if (match) {
                            const source = particle.source, mass = particle.mass;
                            const radius = cluster.material === 'ice' || cluster.material === 'stone' ? Math.max(particle.radius, match.radius) : particle.radius;
                            const feed = match.feed === undefined ? undefined : cluster.sources.findIndex(item => item.key === prior.cluster.sources[match.feed!]!.key);
                            Object.assign(particle, match, { source, mass, radius, feed: feed === -1 ? undefined : feed, born: match.born + prior.start - body.start });
                        }
                    }
                }
                // Ice/stone geometry is drawn with the original card's own face by shardSystem.
                const entry = build(body);
                if (cluster.material === 'ice' || cluster.material === 'stone') entry.mesh.visible = false;
                entries.push(entry); group.add(entry.mesh);
                cluster.sources.forEach((source, index) => bindings.set(source.key, { body, source: index }));
            }
        },
        advance(now: number): number {
            worldTime = now;
            for (let index = entries.length - 1; index >= 0; index--) {
                const entry = entries[index]!;
                if (!advanceDeparturePhysics(entry.body, now)) { drop(entry); entries.splice(index, 1); continue; }
                if (entry.body.cluster.material !== 'ice' && entry.body.cluster.material !== 'stone') update(entry, now);
            }
            return entries.length;
        },
        stats: () => ({ groups: entries.length, particles: entries.reduce((sum, entry) => sum + entry.body.particles.length, 0), sources: bindings.size }),
        clear(): void { entries.forEach(drop); entries.length = 0; bindings.clear(); },
        dispose(): void { this.clear(); }
    };
};
