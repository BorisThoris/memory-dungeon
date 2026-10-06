import type { BoardState, GraphicsQualityPreset } from '../../shared/contracts';
import { hashStringToSeed } from '../../shared/rng';
import type { BoardParticleBurst } from './boardParticleSystem';
import { particleBoardChanged } from './boardParticleCues';
import { realmEventMote } from './realmParticles';
import { REALM_JOLT_FAMILY } from './realmCardMotion';
import { getTileTransform } from './tileBoardTransform';

/** Ground chemistry and amplified chemistry each get a bounded, material-specific response. */
export function collectElementReactionParticles(before: BoardState | null, board: BoardState,
    quality: GraphicsQualityPreset, compact: boolean, reduceMotion: boolean, time: number): BoardParticleBurst[] {
    const cast = board.elementCast;
    if (reduceMotion || !cast || cast.key === before?.elementCast?.key || particleBoardChanged(before, board)) return [];
    const cues: BoardParticleBurst[] = [];
    for (const reaction of (cast.reactions ?? []).slice(0, 2)) {
        const mote = realmEventMote(reaction.kind, REALM_JOLT_FAMILY[reaction.kind]);
        const maxContacts = quality === 'low' ? 2 : quality === 'medium' ? 4 : 6;
        // Resolve identity after currents and weather. Ground sources remain fixed cells.
        const targets = [...new Set(reaction.changes.map(change => change.tileId))]
            .map(id => board.tiles.findIndex(tile => tile.id === id)).filter(cell => cell >= 0).slice(0, maxContacts);
        const cells = [...new Set([...reaction.sourceCells.slice(0, 1), ...targets])];
        for (const [index, cell] of cells.entries()) {
            const tile = board.tiles[cell];
            if (!tile) continue;
            const point = getTileTransform(tile, cell, board.columns, board.rows, compact, true, false);
            cues.push({ kind: 'ember', priority: 'event', quality, reduceMotion: false, time,
                x: point.baseX + point.layoutJitterX, y: point.baseY + point.layoutJitterY, z: 0.1,
                seed: hashStringToSeed(`${cast.key}:${reaction.scope}:${reaction.kind}:${cell}`),
                delay: (reaction.scope === 'ground' ? 0.05 : 0.3) + index * 0.035,
                shape: mote.shape, tint: mote.tint, emberMode: mote.mode, sizeScale: reaction.scope === 'ground' ? 1.5 : 2.2,
                energy: reaction.scope === 'ground' ? 0.25 : 0.6 });
        }
    }
    return cues;
}
