import { describe, expect, it } from 'vitest';

import type { BoardState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    applyFindableScoutGlint,
    applyLanternWardScout,
    applyOmenSealScout
} from './dungeon-scout-rules';

describe('dungeon scout rules', () => {
    it('lantern ward prioritizes hidden dungeon threats', () => {
        const run = createNewRun(0);
        const board = boardWith([
            tile('enemy-a', 'enemy', { dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardState: 'hidden' }),
            tile('route-a', 'route', { routeSpecialKind: 'mystery_veil' }),
            tile('hazard-a', 'hazard', { tileHazardKind: 'shuffle_snare' })
        ]);

        const result = applyLanternWardScout(board, run);

        expect(result.scouted).toBe(true);
        expect(result.board.tiles.find((candidate) => candidate.id === 'enemy-a')).toMatchObject({
            dungeonCardState: 'revealed',
            lanternScouted: true,
            scoutRevealSource: 'lantern_ward'
        });
        expect(result.board.tiles.find((candidate) => candidate.id === 'route-a')?.routeSpecialRevealed).toBeUndefined();
    });

    it('omen seal prioritizes hazards before dungeon and route targets', () => {
        const run = createNewRun(0);
        const board = boardWith([
            tile('enemy-a', 'enemy', { dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardState: 'hidden' }),
            tile('route-a', 'route', { routeSpecialKind: 'mystery_veil' }),
            tile('hazard-a', 'hazard', { tileHazardKind: 'cascade_cache' })
        ]);

        const result = applyOmenSealScout(board, run);

        expect(result.scouted).toBe(true);
        expect(result.board.tiles.find((candidate) => candidate.id === 'hazard-a')).toMatchObject({
            scoutRevealSource: 'omen_seal'
        });
        expect(result.board.tiles.find((candidate) => candidate.id === 'enemy-a')?.dungeonCardState).toBe('hidden');
    });

    it('findable scout glint triggers omen-style scouting only for scout glint claims', () => {
        const run = createNewRun(0);
        const board = boardWith([tile('route-a', 'route', { routeSpecialKind: 'secret_door' })]);

        expect(applyFindableScoutGlint(board, run, 'score_glint')).toEqual({ board, scouted: false });
        expect(applyFindableScoutGlint(board, run, 'scout_glint').board.tiles[0]).toMatchObject({
            routeSpecialRevealed: true,
            routeSpecialRevealSource: 'omen_seal'
        });
    });
});

const boardWith = (tiles: Tile[]): BoardState => ({
    ...createNewRun(0).board!,
    tiles
});

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    ...extra
});
