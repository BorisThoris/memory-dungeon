import type { GraphicsQualityPreset } from '../../shared/contracts';
import { comboDepth, comboSoftCap } from '../../shared/combo-heat-rules';
import { createMulberry32 } from '../../shared/rng';
import type { DepartureCluster, DepartureMaterial } from './cardDepartureGrouping';

export const DEPARTURE_PHYSICS_STEP = 1 / 120;
export const DEPARTURE_PHYSICS_LIFE: Readonly<Record<DepartureMaterial, number>> = {
    water: 2.2, fire: 2.4, growth: 2.3, ice: 2.35, stone: 2.15
};
export const departurePhysicsBudget = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 24 : quality === 'medium' ? 36 : 48;

export interface DepartureParticle {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    radius: number;
    mass: number;
    temperature: number;
    source: number;
    /** First release time, or the birth of a recycled tongue of flame. */
    born: number;
    pinned: boolean;
    landed: boolean;
    angle: number;
    angularVelocity: number;
    /** A shared fuel inlet between neighbouring burning cards. */
    feed?: number;
}

export interface DepartureStem {
    a: number;
    b: number;
    rest: number;
    /** Separate branches physically meet at a junction rather than merely crossing in a shader. */
    junction: boolean;
}

export interface DeparturePhysics {
    cluster: DepartureCluster;
    particles: DepartureParticle[];
    stems: DepartureStem[];
    age: number;
    clock: number;
    start: number;
    end: number;
    drive: number;
    depth: number;
    centerX: number;
    previousPositions: Float64Array;
    rng: () => number;
}

const sourceTime = (body: DeparturePhysics, particle: DepartureParticle): number =>
    body.cluster.sources[particle.source]!.start - body.start;

const activeParticle = (body: DeparturePhysics, particle: DepartureParticle, age: number): boolean =>
    age >= particle.born && age <= sourceTime(body, particle) + DEPARTURE_PHYSICS_LIFE[body.cluster.material] &&
    (particle.feed === undefined || age <= body.cluster.sources[particle.feed]!.start - body.start + DEPARTURE_PHYSICS_LIFE.fire);

export const createDeparturePhysics = (cluster: DepartureCluster, quality: GraphicsQualityPreset): DeparturePhysics => {
    const rng = createMulberry32(cluster.seed);
    const start = Math.min(...cluster.sources.map(source => source.start));
    const depth = comboDepth(Math.max(...cluster.sources.map(source => source.combo)));
    const drive = 1 + depth * 0.12;
    const body: DeparturePhysics = {
        cluster, particles: [], stems: [], age: 0, clock: 0, start,
        end: Math.max(...cluster.sources.map(source => source.start)) + DEPARTURE_PHYSICS_LIFE[cluster.material],
        drive, depth, rng,
        centerX: cluster.sources.reduce((sum, source) => sum + source.x, 0) / cluster.sources.length,
        previousPositions: new Float64Array(departurePhysicsBudget(quality) * 3)
    };
    const budget = departurePhysicsBudget(quality);
    const grow = cluster.material === 'growth';
    const quantity = quality === 'low' ? .5 : quality === 'medium' ? .75 : 1;
    const debris = cluster.material === 'ice' || cluster.material === 'stone';
    const debrisCount = Math.max(3, Math.round((cluster.material === 'ice' ? 8 : 6) * quantity));
    const branches = Math.min(Math.floor(budget / 8), Math.max(1, Math.ceil(cluster.sources.length * 2 * quantity)));
    const count = grow ? branches * 6 : debris ? Math.min(budget, cluster.sources.length * debrisCount) : Math.min(budget, Math.max(16 * quantity, cluster.sources.length * 12 * quantity));
    for (let index = 0; index < count; index++) {
        const chain = Math.floor(index / 6);
        const source = Math.min(cluster.sources.length - 1,
            Math.floor((grow ? chain / (count / 6) : index / count) * cluster.sources.length));
        const origin = cluster.sources[source]!;
        const segment = index % 6;
        const phase = rng() * Math.PI * 2;
        const angle = chain * 2.39996 + origin.seed * 0.001;
        const mass = cluster.sources.length / count;
        body.particles.push({
            x: origin.x + (grow ? Math.cos(angle) * segment * 0.035 : (rng() - 0.5) * 0.65),
            y: origin.y + (grow ? -0.45 + segment * 0.035 : cluster.material === 'fire' ? -0.5 : (rng() - 0.5) * 0.85),
            z: Math.min(-0.025, origin.z - 0.1) - (grow ? segment * 0.005 : rng() * 0.045),
            vx: Math.cos(phase) * (cluster.material === 'fire' ? 0.15 : 0.45) * drive,
            vy: (cluster.material === 'fire' ? 0.6 + rng() * 0.4 : 0.1 + rng() * 0.25) * drive,
            vz: -0.08 - rng() * 0.12,
            radius: grow ? 0.045 : 0.085 * Math.cbrt(0.6 + comboSoftCap(Math.max(0, mass * 16 - 0.6), 5)),
            mass, temperature: 0.85 + rng() * 0.15, source,
            born: origin.start - start + (grow ? 0 : rng() * 0.14),
            pinned: grow && segment === 0, landed: false,
            angle: 0, angularVelocity: (rng() - .5) * (cluster.material === 'ice' ? 16 : 10) * drive
        });
        if (grow && segment > 0) body.stems.push({ a: index - 1, b: index, rest: 0.16 + rng() * 0.055, junction: false });
    }
    if (cluster.material === 'fire' && cluster.edges.length) {
        body.particles.forEach((particle, index) => {
            if (index % 3 !== 0) return;
            const edge = cluster.edges[Math.floor(index / 3) % cluster.edges.length]!;
            const a = cluster.sources[edge[0]]!, b = cluster.sources[edge[1]]!;
            particle.source = edge[0]; particle.feed = edge[1];
            particle.x = (a.x + b.x) / 2 + (rng() - .5) * .15;
            particle.y = (a.y + b.y) / 2 - .5;
            particle.born = Math.max(a.start, b.start) - start + rng() * .14;
        });
    }
    if (grow) {
        // A minimum-distance tree between branch tips gives one connected canopy. It is small
        // (four to eight branches) even when the cluster represents a very large break wave.
        const tips = body.particles.map((_, index) => index).filter(index => index % 6 === 5);
        const attached = new Set([tips[0]!]);
        while (attached.size < tips.length) {
            let best: [number, number] | null = null, distance = Infinity;
            for (const a of attached) for (const b of tips) {
                if (attached.has(b)) continue;
                const p = body.particles[a]!, q = body.particles[b]!;
                const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
                if (d < distance) { distance = d; best = [a, b]; }
            }
            if (!best) break;
            const a = body.particles[best[0]]!, b = body.particles[best[1]]!;
            let previous = best[0];
            for (let joint = 1; joint <= 2; joint++) {
                const t = joint / 3, index = body.particles.length;
                body.particles.push({ ...a, x: a.x + (b.x - a.x) * t,
                    y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
                    radius: .02, source: joint === 1 ? a.source : b.source,
                    born: Math.max(a.born, b.born), pinned: false });
                body.stems.push({ a: previous, b: index, rest: Math.max(.04, distance * 1.06 / 3), junction: true });
                previous = index;
            }
            body.stems.push({ a: previous, b: best[1], rest: Math.max(.04, distance * 1.06 / 3), junction: true });
            attached.add(best[1]);
        }
        for (const particle of body.particles) particle.mass = cluster.sources.length / body.particles.length;
    }
    return body;
};

/** An actual impulse changes future trajectories; no position here is a canned time curve. */
export const impulseDeparturePhysics = (body: DeparturePhysics, x: number, y: number, ix: number, iy: number): void => {
    for (const particle of body.particles) {
        if (particle.pinned || !activeParticle(body, particle, body.age)) continue;
        const weight = Math.exp(-Math.hypot(particle.x - x, particle.y - y) * 1.4);
        particle.vx += ix * weight;
        particle.vy += iy * weight;
    }
};

const constrainStem = (body: DeparturePhysics, stem: DepartureStem, age: number): void => {
    const a = body.particles[stem.a]!, b = body.particles[stem.b]!;
    if (!activeParticle(body, a, age) || !activeParticle(body, b, age)) return;
    const x = b.x - a.x, y = b.y - a.y, z = b.z - a.z;
    const distance = Math.hypot(x, y, z) || 0.0001;
    const grown = Math.min(1, Math.max(0, (age - Math.max(sourceTime(body, a), sourceTime(body, b))) / 0.7));
    const length = stem.junction ? stem.rest : stem.rest * (0.2 + 0.8 * grown);
    const wa = a.pinned ? 0 : 1, wb = b.pinned ? 0 : 1;
    const error = (distance - length) / distance * (stem.junction ? grown * 0.6 : 0.85) / Math.max(1, wa + wb);
    a.x += x * error * wa; a.y += y * error * wa; a.z += z * error * wa;
    b.x -= x * error * wb; b.y -= y * error * wb; b.z -= z * error * wb;
};

const stepDeparturePhysics = (body: DeparturePhysics): void => {
    const dt = DEPARTURE_PHYSICS_STEP;
    const age = body.clock + dt;
    const material = body.cluster.material;
    const liquid = material === 'water', fire = material === 'fire', growth = material === 'growth';
    const originPositions = body.previousPositions;
    const cx = body.centerX;
    for (let index = 0; index < body.particles.length; index++) {
        const particle = body.particles[index]!;
        originPositions[index * 3] = particle.x;
        originPositions[index * 3 + 1] = particle.y;
        originPositions[index * 3 + 2] = particle.z;
        const source = body.cluster.sources[particle.source]!;
        const localAge = age - (source.start - body.start);
        if (localAge < 0 || !activeParticle(body, particle, age)) continue;
        if (growth && particle.pinned && localAge > 1.35) particle.pinned = false;
        if (particle.pinned) { particle.vx = 0; particle.vy = 0; particle.vz = 0; continue; }
        if (fire && age - particle.born > 0.75 && localAge < 1.55) {
            // Finite fuel feeds the same bounded particle pool, rather than allocating new puffs.
            const feed = particle.feed === undefined ? source : body.cluster.sources[particle.feed]!;
            particle.x = (source.x + feed.x) / 2 + (body.rng() - 0.5) * (particle.feed === undefined ? .65 : .2);
            particle.y = (source.y + feed.y) / 2 - 0.48 + Math.min(0.8, localAge * 0.5);
            particle.z = Math.min(-0.025, source.z - 0.08);
            particle.vx = (body.rng() - 0.5) * 0.3;
            particle.vy = 0.5;
            particle.born = age;
            particle.temperature = 1;
        }
        const drag = Math.exp(-(fire ? 1.8 : liquid ? 0.65 : growth ? 2.5 : 0.35) * dt);
        particle.vx *= drag; particle.vy *= drag; particle.vz *= drag;
        if (fire) {
            const whirl = body.cluster.seed * 0.0001;
            // Buoyancy and a divergence-free curl force advect hot gas. Neighbouring fuel feeds
            // one common updraft; noise perturbs forces, never the particle's rendered position.
            particle.vx += (Math.max(-.8, Math.min(.8, cx - particle.x)) * 2.4 + Math.cos(particle.y * 4 + age * body.drive + whirl) * 1.6) * dt;
            particle.vy += (4.5 * particle.temperature * body.drive - Math.cos(particle.x * 4 + whirl) * 0.6) * dt;
            particle.temperature *= Math.exp(-0.85 * dt);
        } else {
            particle.vy -= (growth ? 2.7 : 9.8) * dt;
            if (growth) {
                particle.vx += (Math.cos(particle.y * 2.3 + age * body.drive + body.cluster.seed) * 1.4 + (cx - particle.x) * 0.25) * dt;
                particle.vz -= Math.sin(particle.x * 2 + age * 0.8) * dt * 0.3;
            }
        }
        particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt;
        particle.angle += particle.angularVelocity * dt;
        particle.angularVelocity *= Math.exp(-(particle.landed ? 9 : .25) * dt);
    }
    if (liquid || fire || material === 'ice' || material === 'stone') {
        for (let i = 0; i < body.particles.length; i++) for (let j = i + 1; j < body.particles.length; j++) {
            const a = body.particles[i]!, b = body.particles[j]!;
            if (!activeParticle(body, a, age) || !activeParticle(body, b, age)) continue;
            const floor = body.cluster.sources[a.source]!.floorY;
            const flatten = liquid ? 1 + 3 * Math.max(0, 1 - Math.max(a.y - floor, b.y - floor) / .35) : 1;
            const dx = b.x - a.x, dy = (b.y - a.y) * flatten, dz = b.z - a.z;
            const d = Math.hypot(dx, dy, dz) || 0.0001;
            const rest = (a.radius + b.radius) * (fire ? 0.65 : 0.85);
            if (d > rest * (liquid ? 2.8 : 1)) continue;
            // Position-based pressure prevents compression. Water also has cohesive surface
            // tension and symmetric viscosity; the equal/opposite exchange conserves momentum.
            const strength = d < rest ? (rest - d) * (fire ? 0.12 : 0.42)
                : -Math.min(0.00012, (d - rest) * 0.001);
            const total = a.mass + b.mass;
            const pa = strength * b.mass / total / d, pb = strength * a.mass / total / d;
            a.x -= dx * pa; a.y -= dy / flatten * pa; a.z -= dz * pa;
            b.x += dx * pb; b.y += dy / flatten * pb; b.z += dz * pb;
        }
    }
    if (growth) for (let iteration = 0; iteration < 4; iteration++) for (const stem of body.stems) constrainStem(body, stem, age);
    for (let index = 0; index < body.particles.length; index++) {
        const p = body.particles[index]!;
        if (!activeParticle(body, p, age) || p.pinned) continue;
        const floor = body.cluster.sources[p.source]!.floorY + p.radius * (liquid ? 0.15 : growth ? .4 : 1);
        if (!fire) {
            p.vx = (p.x - originPositions[index * 3]!) / dt;
            p.vy = (p.y - originPositions[index * 3 + 1]!) / dt;
            p.vz = (p.z - originPositions[index * 3 + 2]!) / dt;
        }
        if (p.y < floor) {
            p.y = floor;
            const bounce = liquid ? 0.08 : growth ? 0.1 : material === 'ice' ? 0.34 : 0.22;
            if (p.vy < 0) p.vy *= -bounce;
            p.vx *= liquid ? 0.94 : 0.78; p.vz *= liquid ? 0.94 : 0.78;
            p.landed = true;
        }
        // All loose material stays behind readable cards, with physical depth rather than a HUD layer.
        const behind = -.018 - (material === 'ice' || material === 'stone' ? p.radius : 0);
        if (p.z > behind) { p.z = behind; p.vz = Math.min(0, p.vz); }
    }
    if (liquid) {
        for (let i = 0; i < body.particles.length; i++) for (let j = i + 1; j < body.particles.length; j++) {
            const a = body.particles[i]!, b = body.particles[j]!;
            if (!activeParticle(body, a, age) || !activeParticle(body, b, age) || Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > (a.radius + b.radius) * 2.8) continue;
            const vx = (b.vx - a.vx) * 0.018, vy = (b.vy - a.vy) * 0.018, vz = (b.vz - a.vz) * 0.018;
            a.vx += vx; a.vy += vy; a.vz += vz;
            b.vx -= vx; b.vy -= vy; b.vz -= vz;
        }
    }
    body.clock = age;
};

/** Absolute visual time, with fixed integration steps for identical motion at 30/60/120 FPS. */
export const advanceDeparturePhysics = (body: DeparturePhysics, now: number): boolean => {
    if (now > body.end) return false;
    const target = Math.max(0, now - body.start);
    while (body.clock + DEPARTURE_PHYSICS_STEP <= target + 1e-8) stepDeparturePhysics(body);
    body.age = target;
    return true;
};

export const departureParticleRadius = (body: DeparturePhysics, particle: DepartureParticle): number => {
    // The visual footprint has a budget. The drive above still increases with every combo link.
    return particle.radius * (1 + comboSoftCap(body.depth, 1.5) * 0.18);
};

