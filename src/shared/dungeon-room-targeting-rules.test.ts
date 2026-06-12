import { describe, expect, it } from 'vitest';

import type { Tile } from './contracts';
import {
    revealFirstHiddenDungeonPair,
    scryDungeonCardTiles,
    trapWorkshopTileUpdates
} from './dungeon-room-targeting-rules';
import { ROOM_PAIR_KEY } from './tile-identity';

describe('dungeon room targeting rules', () => {
    it('targets the first hidden dungeon card pair outside the source room', () => {
        const tiles = [
            tile('room', ROOM_PAIR_KEY, { dungeonCardKind: 'room', dungeonCardEffectId: 'room_scrying_lens' }),
            tile('enemy-a', 'enemy-a', { dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardState: 'hidden' }),
            tile('enemy-b', 'enemy-a', { dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardState: 'hidden' }),
            tile('trap-a', 'trap-a', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_alarm', dungeonCardState: 'hidden' })
        ];

        expect([...scryDungeonCardTiles(tiles, 'room')].sort()).toEqual(['enemy-a', 'enemy-b']);
        expect([...revealFirstHiddenDungeonPair(tiles, 'room')].sort()).toEqual(['enemy-a', 'enemy-b']);
    });

    it('prefers revealed trap workshop targets and marks them resolved', () => {
        const result = trapWorkshopTileUpdates([
            tile('trap-a', 'trap-a', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_alarm', dungeonCardState: 'hidden' }),
            tile('trap-b', 'trap-b', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_snare', dungeonCardState: 'revealed' }),
            tile('trap-c', 'trap-b', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_snare', dungeonCardState: 'hidden' })
        ]);

        expect(result.resolved).toBe(true);
        expect([...result.ids].sort()).toEqual(['trap-b', 'trap-c']);
    });

    it('falls back to the first hidden trap and returns empty when none exist', () => {
        const hidden = trapWorkshopTileUpdates([
            tile('enemy-a', 'enemy-a', { dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardState: 'hidden' }),
            tile('trap-a', 'trap-a', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_alarm', dungeonCardState: 'hidden' })
        ]);
        expect(hidden.resolved).toBe(false);
        expect([...hidden.ids]).toEqual(['trap-a']);

        expect(trapWorkshopTileUpdates([])).toEqual({ ids: new Set(), resolved: false });
    });
});

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    ...extra
});
