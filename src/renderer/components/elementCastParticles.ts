import type { BoardState, GraphicsQualityPreset } from '../../shared/contracts';
import { hashStringToSeed } from '../../shared/rng';
import type { BoardParticleBurst } from './boardParticleSystem';
import { particleBoardChanged } from './boardParticleCues';
import { ELEMENT_CARD_MOTE } from './realmParticles';
import { getTileTransform } from './tileBoardTransform';

/** Casts share the board's existing particle pool; no second overlay or text painted over cards. */
export function collectElementCastParticles(before: BoardState | null, board: BoardState,
    quality: GraphicsQualityPreset, compact: boolean, reduceMotion: boolean, time: number): BoardParticleBurst[] {
    const cast = board.elementCast;
    if (reduceMotion || !cast || cast.key === before?.elementCast?.key || particleBoardChanged(before, board)) return [];
    const sourceCells = cast.sourceCells.filter(cell => board.tiles[cell]);
    if (!sourceCells.length) return [];
    const point = (cell: number) => {
        const p = getTileTransform(board.tiles[cell]!, cell, board.columns, board.rows, compact, true, false);
        return { x: p.baseX + p.layoutJitterX, y: p.baseY + p.layoutJitterY, z: 0.08 };
    };
    const material = ELEMENT_CARD_MOTE[cast.suit];
    const strong = cast.power >= 4;
    const cues: BoardParticleBurst[] = [];
    const emit = (cell: number, tag: string, delay: number, response?: 'charged' | 'neutralized', at = point(cell)) => {
        cues.push({ kind: 'ember', ...at, time, delay, seed: hashStringToSeed(`${cast.key}:${cell}:${tag}`),
            quality, reduceMotion: false, energy: response === 'neutralized' ? 0.05 : strong ? 0.4 : 0.2,
            shape: response === 'neutralized' ? undefined : material.shape,
            tint: response === 'charged' ? '#e7c879' : response === 'neutralized' ? '#aebfca' : material.tint,
            emberMode: response ? 'spark' : 'rise', sizeScale: response ? 1.15 : strong ? 1.5 : 1.2 });
    };
    for (const cell of sourceCells.slice(0, quality === 'low' ? 1 : 2)) emit(cell, 'source', 0);
    // Always show changed cards first. Counter and kin responses share the same bounded allowance.
    const rank = { affected: 0, charged: 1, neutralized: 2 };
    const ordered = cast.contacts.filter(c => board.tiles[c.cell]?.id === c.tileId)
        .sort((a, b) => rank[a.outcome] - rank[b.outcome]);
    const contacts = [...new Set([
        ...(['affected', 'charged', 'neutralized'] as const).flatMap(kind => {
            const contact = ordered.find(c => c.outcome === kind);
            return contact ? [contact] : [];
        }), ...ordered
    ])].slice(0, quality === 'low' ? 4 : quality === 'medium' ? 6 : 8);
    const traced = new Set<number>();
    for (const contact of contacts) {
        const distance = (cell: number) => Math.abs(Math.floor(cell / board.columns) - Math.floor(contact.cell / board.columns))
            + Math.abs(cell % board.columns - contact.cell % board.columns);
        const source = sourceCells.reduce((a, b) => distance(a) <= distance(b) ? a : b);
        // A few close, staggered motes show direction. No full-board beam web, even at Fever.
        if (quality !== 'low' && traced.size < (strong ? 3 : 2) && !traced.has(contact.group) && distance(source) <= 3) {
            traced.add(contact.group);
            const from = point(source), to = point(contact.cell);
            for (let step = 1; step <= 3; step += 1) {
                const t = step / 4;
                emit(contact.cell, `trail-${step}`, step * 0.055, undefined,
                    { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: 0.12 });
            }
        }
        emit(contact.cell, 'contact', 0.2, contact.outcome === 'affected' ? undefined : contact.outcome);
    }
    return cues;
}
