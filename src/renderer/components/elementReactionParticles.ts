import type { BoardState, GraphicsQualityPreset } from '../../shared/contracts';
import { hashStringToSeed } from '../../shared/rng';
import type { BoardParticleBurst } from './boardParticleSystem';
import { particleBoardChanged } from './boardParticleCues';
import { getTileTransform } from './tileBoardTransform';
import { ELEMENT_REACTION_VISUALS } from './elementScene';

/** Ground chemistry and amplified chemistry each get a bounded, material-specific response. */
export function collectElementReactionParticles(before: BoardState | null, board: BoardState,
    quality: GraphicsQualityPreset, compact: boolean, reduceMotion: boolean, time: number): BoardParticleBurst[] {
    const cast = board.elementCast;
    if (reduceMotion || !cast || cast.key === before?.elementCast?.key || particleBoardChanged(before, board)) return [];
    const cues: BoardParticleBurst[] = [];
    const cellById = new Map(board.tiles.map((tile, cell) => [tile.id, cell]));
    const seen = new Set<string>();
    for (const reaction of cast.reactions ?? []) {
        const identity = `${reaction.scope}:${reaction.kind}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        const visual = ELEMENT_REACTION_VISUALS[reaction.kind];
        const potency = Math.min(1, Math.log2(1 + Math.max(0, reaction.potency)) / 6);
        const maxContacts = quality === 'low' ? 2 : quality === 'medium' ? 4 : 6;
        // Resolve identity after currents and weather. Ground sources remain fixed cells.
        const targets = [...new Set(reaction.changes.map(change => change.tileId))]
            .map(id => cellById.get(id)).filter((cell): cell is number => cell !== undefined).slice(0, maxContacts);
        const cells = [...new Set([...reaction.sourceCells.slice(0, 1), ...targets])];
        for (const [index, cell] of cells.entries()) {
            const tile = board.tiles[cell];
            if (!tile) continue;
            const point = getTileTransform(tile, cell, board.columns, board.rows, compact, true, false);
            const delay = (reaction.scope === 'ground' ? 0.05 : 0.3) + index * 0.035;
            const common: BoardParticleBurst = { kind: 'ember', priority: 'event', quality, reduceMotion: false, time,
                x: point.baseX + point.layoutJitterX, y: point.baseY + point.layoutJitterY, z: 0.1,
                seed: hashStringToSeed(`${cast.key}:${reaction.scope}:${reaction.kind}:${cell}`),
                delay, sizeScale: (reaction.scope === 'ground' ? 1.1 : 1.4) + potency * 0.3,
                energy: (reaction.scope === 'ground' ? 0.3 : 0.5) + potency * 0.2 };
            cues.push({ ...common, ...visual.materials[0] });
            // The second material arrives after contact: water crystallises; ice becomes droplets.
            // Limit secondary emitters, not reaction types, so simultaneous chemistry is never dropped.
            if (index < (quality === 'low' ? 1 : 2)) cues.push({ ...common, ...visual.materials[1],
                seed: common.seed + 7919, delay: delay + 0.18, sizeScale: common.sizeScale! * 0.85 });
            if (index === 0) cues.push({ ...common, kind: 'ripple', shape: undefined,
                tint: visual.light, placement: 'ground', z: -0.025, energy: 0.2 + potency * 0.35 });
        }
    }
    return cues;
}
