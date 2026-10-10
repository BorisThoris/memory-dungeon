import type { DepartureBinding } from './cardDepartureWorld';
import type { DepartureMaterial } from './cardDepartureGrouping';
import { DEPARTURE_PHYSICS_STEP } from './cardDeparturePhysics';

/** A little destructible cloth/soft-body surface preserves the departing card's real art.
 * Its positions are integrated and constrained; the face shader only shades/dissolves them. */
export const createDepartureSheet = (original: Float32Array, columns: number, rows: number, material: DepartureMaterial, seed: number) => {
    const positions = original.slice();
    for (let i = 2; i < positions.length; i += 3) positions[i] = -.08;
    const velocities = new Float64Array(original.length);
    const before = new Float64Array(original.length);
    const links: [number, number, number][] = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
        const a = y * (columns + 1) + x;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
            if (x + dx! < 0 || x + dx! > columns || y + dy! > rows) continue;
            const b = (y + dy!) * (columns + 1) + x + dx!;
            links.push([a * 3, b * 3, Math.hypot(original[a * 3]! - original[b * 3]!, original[a * 3 + 1]! - original[b * 3 + 1]!)]);
        }
    }
    let clock = 0;
    return {
        positions,
        advance(age: number, floor: number, binding?: DepartureBinding): void {
            while (clock + DEPARTURE_PHYSICS_STEP <= age + 1e-8) {
                const dt = DEPARTURE_PHYSICS_STEP;
                clock += dt; before.set(positions);
                const softness = material === 'water' ? Math.max(0, 1 - clock * 2) : material === 'fire' ? Math.max(0, 1 - clock * .6) : .9;
                for (let i = 0; i < positions.length; i += 3) {
                    const release = material === 'water' ? .08 + .08 * (1 + Math.sin(i * 1.7 + seed)) : material === 'fire' ? .18 : .12;
                    if (clock < release) continue;
                    const drag = Math.exp(-dt * 1.6);
                    velocities[i] = velocities[i]! * drag;
                    const burn = Math.min(1, Math.max(0, (clock * .72 - (original[i + 1]! / 1.08 + .5) + .2) * 4));
                    velocities[i + 1] = velocities[i + 1]! * drag + (material === 'fire' ? burn * 1.2 : -7.8) * dt;
                    velocities[i + 2] = velocities[i + 2]! * drag - dt * (material === 'fire' ? burn * .8 : .15);
                    if (material === 'fire') velocities[i] += Math.sin(seed + original[i]! * 8) * burn * dt * .25;
                    // Physical material catches the softening face. Nearby vertices follow the
                    // same pressure/branch bodies as the shared surface, with spring inertia.
                    if (binding && material !== 'fire') {
                        const origin = binding.body.cluster.sources[binding.source]!;
                        let nearest = binding.body.particles[0]!, distance = Infinity;
                        for (const p of binding.body.particles) {
                            if (p.source !== binding.source) continue;
                            const d = Math.hypot(p.x - origin.x - positions[i]!, p.y - origin.y - positions[i + 1]!);
                            if (d < distance) { nearest = p; distance = d; }
                        }
                        if (distance < Infinity) {
                            const strength = material === 'growth' ? 12 : 5;
                            velocities[i] += (nearest.x - origin.x - positions[i]!) * dt * strength;
                            velocities[i + 1] += (nearest.y - origin.y - positions[i + 1]!) * dt * strength;
                        }
                    }
                    positions[i] += velocities[i]! * dt;
                    positions[i + 1] += velocities[i + 1]! * dt;
                    positions[i + 2] += velocities[i + 2]! * dt;
                }
                for (let pass = 0; pass < 2; pass++) for (const [a, b, rest] of links) {
                    const dx = positions[b]! - positions[a]!, dy = positions[b + 1]! - positions[a + 1]!, dz = positions[b + 2]! - positions[a + 2]!;
                    const distance = Math.hypot(dx, dy, dz) || .001;
                    const strain = (distance - rest) / distance * softness * .4;
                    positions[a] += dx * strain; positions[a + 1] += dy * strain; positions[a + 2] += dz * strain;
                    positions[b] -= dx * strain; positions[b + 1] -= dy * strain; positions[b + 2] -= dz * strain;
                }
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 1] = Math.max(floor, positions[i + 1]!);
                    positions[i + 2] = Math.min(-.08, positions[i + 2]!);
                    for (let axis = 0; axis < 3; axis++) velocities[i + axis] = (positions[i + axis]! - before[i + axis]!) / dt;
                }
            }
        }
    };
};
