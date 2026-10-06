import type { RealmId, RunState, TileSuit } from '../../shared/contracts';
import { ELEMENT_REACTIONS, ELEMENT_REACTION_KINDS, type ElementReactionKind } from '../../shared/element-resonance-rules';
import { SUIT_REALM } from '../../shared/realm-sway-rules';
import type { BoardParticleShape } from './boardParticleSystem';

export const ELEMENT_SCENE_SUITS: readonly TileSuit[] = ['ember', 'tide', 'bone', 'moss'];
type Material = { shape: BoardParticleShape; tint: string };
/** One exhaustive palette shared by the painted room, its light, and contact particles. */
export const ELEMENT_REACTION_VISUALS: Readonly<Record<ElementReactionKind, {
    light: string; materials: readonly [Material, Material];
}>> = {
    steam: { light: '#acdce7', materials: [{ shape: 'vapor', tint: '#c7e7eb' }, { shape: 'droplet', tint: '#78bbd8' }] },
    blaze: { light: '#ff8a36', materials: [{ shape: 'flame', tint: '#ff842a' }, { shape: 'leaf', tint: '#d98b49' }] },
    melt: { light: '#ffc98f', materials: [{ shape: 'shard', tint: '#bce9ff' }, { shape: 'droplet', tint: '#c3dce4' }] },
    freezeover: { light: '#96cbff', materials: [{ shape: 'droplet', tint: '#73b5e7' }, { shape: 'shard', tint: '#d3edff' }] },
    flood: { light: '#62d6b4', materials: [{ shape: 'droplet', tint: '#59c8c1' }, { shape: 'leaf', tint: '#a1de65' }] },
    frostbloom: { light: '#c9bfff', materials: [{ shape: 'shard', tint: '#a7e6db' }, { shape: 'petal', tint: '#d8c1ff' }] }
};
export const ELEMENT_SCENE_KINDS = [...ELEMENT_REACTION_KINDS, 'firestorm', 'downpour', 'hailstorm', 'thornstorm'] as const;
export type ElementSceneKind = typeof ELEMENT_SCENE_KINDS[number];
const STORM_SCENES: Record<TileSuit, ElementSceneKind> = { ember: 'firestorm', tide: 'downpour', bone: 'hailstorm', moss: 'thornstorm' };
export const ELEMENT_SCENE_VISUALS = { ...ELEMENT_REACTION_VISUALS,
    firestorm: { light: '#db887e' }, downpour: { light: '#8d9fe8' },
    hailstorm: { light: '#bfdcff' }, thornstorm: { light: '#a5d580' }
};

export interface ElementSceneState {
    elements: Record<TileSuit, number>;
    /** Normalized painted contributions. Multiple ground/streak reactions remain visible together. */
    reactions: { kind: ElementSceneKind; weight: number; opacity: number }[];
    storm: number;
    pulseKey: string | null;
    pulseKinds: ElementSceneKind[];
}

type SceneRun = Pick<RunState, 'board'> & Partial<Pick<RunState,
    'realmId' | 'realmSecondaryId' | 'realmSeverity' | 'realmSway' | 'elementResonance' | 'lastRealmEvent'>>;
const unit = (n: number): number => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
const realmSuit = (realm: RealmId | null | undefined) => ELEMENT_SCENE_SUITS.find(suit => SUIT_REALM[suit] === realm);
const reactionKind = (kind: string | undefined): ElementReactionKind | undefined =>
    ELEMENT_REACTION_KINDS.find(candidate => candidate === kind);

/** Read the current world, never a guessed combo from the cards' decorative suits. No timers or save fields. */
export function deriveElementScene(run: SceneRun): ElementSceneState {
    const elements: Record<TileSuit, number> = { ember: 0, tide: 0, bone: 0, moss: 0 };
    const board = run.board;
    const tiles = board?.tiles ?? [];
    const primary = realmSuit(run.realmId), secondary = realmSuit(run.realmSecondaryId);
    const strength = run.realmSeverity === 'raging' ? 0.85 : run.realmSeverity === 'wild' ? 0.7 : 0.55;
    if (primary) elements[primary] = strength;
    if (secondary) elements[secondary] = Math.max(elements[secondary], strength * 0.85);
    const change = run.lastRealmEvent?.kind === 'reaction' ? run.lastRealmEvent : null;
    // Realm tipping keeps the material it met: Thaw and Freeze-over must not become a plain room.
    for (const realm of [change?.from, change?.to]) {
        const suit = realmSuit(realm);
        if (suit) elements[suit] = Math.max(elements[suit], 0.65);
    }
    const storm = run.realmId === 'storm' || run.realmSecondaryId === 'storm' ? strength
        : change?.from === 'storm' || change?.to === 'storm' ? 0.65 : 0;
    const ground: Record<TileSuit, number> = { ember: 0, tide: 0, bone: 0, moss: 0 };
    const coatings = { ...ground };
    tiles.forEach((tile, cell) => {
        const suit = board?.elementalGround?.[cell];
        if (suit && ELEMENT_SCENE_SUITS.includes(suit)) ground[suit]++;
        if (tile.state === 'removed' || tile.state === 'matched') return;
        if (tile.fuse != null) coatings.ember++;
        if (tile.frost || tile.snowed || tile.rime) coatings.bone++;
        if (tile.vined || tile.seeded) coatings.moss++;
    });
    for (const suit of ELEMENT_SCENE_SUITS) {
        const groundCoverage = Math.sqrt(ground[suit] / Math.max(1, tiles.length));
        const coatingCoverage = Math.sqrt(coatings[suit] / Math.max(1, tiles.length));
        const sway = Math.min(0.5, Math.max(0, run.realmSway?.[suit] ?? 0) * 0.09);
        const resonance = Math.min(0.16, Math.log2(1 + Math.max(0, run.elementResonance?.[suit] ?? 0)) * 0.025);
        elements[suit] = unit(Math.max(elements[suit], groundCoverage * 0.9, coatingCoverage * 0.65, sway) + resonance);
    }
    const cast = board?.elementCast;
    if (cast) elements[cast.suit] = Math.max(elements[cast.suit], Math.min(0.95, 0.55 + Math.log2(1 + Math.max(0, cast.power)) * 0.06));
    const weights = Object.fromEntries(ELEMENT_SCENE_KINDS.map(kind => [kind, 0])) as Record<ElementSceneKind, number>;
    for (const kind of ELEMENT_REACTION_KINDS) {
        const [a, b] = ELEMENT_REACTIONS[kind].elements;
        weights[kind] = Math.min(elements[a], elements[b]) * 0.62;
    }
    for (const suit of ELEMENT_SCENE_SUITS) weights[STORM_SCENES[suit]] = Math.min(storm, elements[suit]) * 0.85;
    const pulseKinds: ElementSceneKind[] = [];
    for (const impact of cast?.reactions ?? []) {
        weights[impact.kind] = Math.max(weights[impact.kind], 0.72 + Math.min(0.22, Math.log2(1 + Math.max(0, impact.potency)) * 0.045));
        if (!pulseKinds.includes(impact.kind)) pulseKinds.push(impact.kind);
    }
    const weatherReaction = reactionKind(run.lastRealmEvent?.kind);
    if (weatherReaction) {
        weights[weatherReaction] = Math.max(weights[weatherReaction], 0.55);
        if (!pulseKinds.includes(weatherReaction)) pulseKinds.push(weatherReaction);
    }
    if (change) for (const kind of ELEMENT_SCENE_KINDS) if (weights[kind] > 0 && !pulseKinds.includes(kind)) pulseKinds.push(kind);
    // Keep weaker coexisting combinations, but give the actual reaction room to read.
    const total = ELEMENT_SCENE_KINDS.reduce((sum, kind) => sum + weights[kind], 0);
    const scale = total > 0.94 ? 0.94 / total : 1;
    let underneath = 1 - Math.min(0.94, total);
    const reactions = ELEMENT_SCENE_KINDS.map(kind => {
        const weight = weights[kind] * scale;
        underneath += weight;
        return { kind, weight, opacity: underneath ? weight / underneath : 0 };
    });
    return { elements, reactions, storm,
        pulseKey: cast || change || weatherReaction ? `${board?.level}:${cast?.key ?? ''}:${change?.key ?? (weatherReaction ? run.lastRealmEvent?.key : '')}` : null, pulseKinds };
}
