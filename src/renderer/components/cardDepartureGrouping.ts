import { hashStringToSeed } from '../../shared/rng';

export type DepartureMaterial = 'water' | 'fire' | 'growth' | 'ice' | 'stone';

export interface DepartureSource {
    /** Includes the departure occurrence, not just a tile ID that can be restored by Undo. */
    key: string;
    material: DepartureMaterial;
    x: number;
    y: number;
    z: number;
    floorY: number;
    start: number;
    seed: number;
    combo: number;
}

export interface DepartureCluster {
    key: string;
    material: DepartureMaterial;
    sources: DepartureSource[];
    /** A proximity spanning forest: actual neighbours, never all-to-all connections. */
    edges: [number, number][];
    seed: number;
}

export const DEPARTURE_JOIN_DISTANCE = 1.62;
export const DEPARTURE_JOIN_SECONDS = 0.45;

export const departureSourcesTouch = (a: DepartureSource, b: DepartureSource): boolean =>
    a.material === b.material && Math.abs(a.start - b.start) <= DEPARTURE_JOIN_SECONDS &&
    Math.abs(a.floorY - b.floorY) < 0.25 && Math.hypot(a.x - b.x, a.y - b.y) <= DEPARTURE_JOIN_DISTANCE;

/** Spatial union-find, so a large break does not compare every card with every other card. */
export const groupCardDepartures = (input: readonly DepartureSource[]): DepartureCluster[] => {
    const sources = [...input].sort((a, b) => a.key.localeCompare(b.key));
    const parents = sources.map((_, index) => index);
    const buckets = new Map<string, number[]>();
    const forest: [number, number][] = [];
    const root = (index: number): number => {
        while (parents[index] !== index) {
            parents[index] = parents[parents[index]!]!;
            index = parents[index]!;
        }
        return index;
    };
    for (let index = 0; index < sources.length; index++) {
        const source = sources[index]!;
        const bx = Math.floor(source.x / DEPARTURE_JOIN_DISTANCE);
        const by = Math.floor(source.y / DEPARTURE_JOIN_DISTANCE);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const near = buckets.get(`${source.material}:${bx + dx}:${by + dy}`);
            for (const other of near ?? []) {
                const a = root(index), b = root(other);
                if (a === b) continue;
                if (!departureSourcesTouch(source, sources[other]!)) continue;
                parents[Math.max(a, b)] = Math.min(a, b);
                forest.push([other, index]);
            }
        }
        const key = `${source.material}:${bx}:${by}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
    }
    const components = new Map<number, number[]>();
    for (let index = 0; index < sources.length; index++) {
        const key = root(index);
        const component = components.get(key);
        if (component) component.push(index);
        else components.set(key, [index]);
    }
    const componentEdges = new Map<number, [number, number][]>();
    for (const edge of forest) {
        const key = root(edge[0]);
        const edges = componentEdges.get(key);
        if (edges) edges.push(edge);
        else componentEdges.set(key, [edge]);
    }
    return [...components.entries()].map(([component, indices]) => {
        const local = new Map(indices.map((index, offset) => [index, offset]));
        const members = indices.map(index => sources[index]!);
        const key = members.map(source => source.key).join('|');
        return {
            key, material: members[0]!.material, sources: members,
            edges: (componentEdges.get(component) ?? []).map(([a, b]) => [local.get(a)!, local.get(b)!]),
            seed: hashStringToSeed(members.map(source => `${source.key}:${source.seed}`).join('|'))
        };
    });
};
