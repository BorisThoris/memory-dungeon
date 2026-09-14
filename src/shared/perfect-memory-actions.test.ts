import { describe, expect, it } from 'vitest';
import type { PerfectMemoryAction, RunState } from './contracts';
import {
    applyDestroyPair, applyFlashPair, applyPeek, applyRegionShuffle, applyShuffle,
    applyStrayRemove, applyTileSwap, cancelResolvingWithUndo, togglePinnedTile
} from './board-powers';
import { advanceToNextLevel, createNewRun, finishMemorizePhase } from './game-core';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { makePair, makeRun, makeTile, playPair, playPerfectFloor } from './test/game-fixtures';

const actions: [PerfectMemoryAction, (run: RunState) => RunState][] = [
    ['shuffle', (run) => applyShuffle({ ...run, shuffleCharges: 1 })],
    ['region_shuffle', (run) => applyRegionShuffle({ ...run, regionShuffleCharges: 1 }, 0)],
    ['tile_swap', (run) => applyTileSwap({ ...run, regionShuffleCharges: 1 }, 'A-a', 'B-a')],
    ['destroy_pair', (run) => applyDestroyPair({ ...run, destroyPairCharges: 1 }, 'A-a')],
    ['peek', (run) => applyPeek({ ...run, peekCharges: 1 }, 'A-a')],
    ['flash_pair', (run) => applyFlashPair({ ...run, practiceMode: true, flashPairCharges: 1 })],
    ['stray_remove', (run) => applyStrayRemove({ ...run, strayRemoveArmed: true, strayRemoveCharges: 1 }, 'wild')],
    ['undo', (run) => cancelResolvingWithUndo({
        ...flipTile(flipTile(run, 'A-a'), 'B-a'), undoUsesThisFloor: 1
    })],
    ['gambit', (run) => resolveBoardTurn(flipTile(flipTile(flipTile({
        ...run, gambitAvailableThisFloor: true
    }, 'A-a'), 'B-a'), 'A-b'))],
    ['wild_match', (run) => playPair({ ...run, wildMatchesRemaining: 1 }, 'wild', 'A-a')]
];

describe('Perfect Memory action history', () => {
    it.each(actions)('records successful %s at the action boundary', (action, apply) => {
        const run = makeRun([
            ...makePair('A', 'A'), ...makePair('B', 'B'),
            makeTile('decoy', DECOY_PAIR_KEY, '?'), makeTile('wild', WILD_PAIR_KEY, '*')
        ]);
        const next = apply(run);
        expect(next.powersUsedThisRun).toBe(true);
        expect(next.perfectMemoryActions).toEqual({ first: action, latest: action });
        expect(run.perfectMemoryActions).toBeUndefined();
    });

    it('keeps the first action across later assists and ignores rejected actions and pins', () => {
        const run = makeRun([...makePair('A', 'A'), ...makePair('B', 'B')], {
            peekCharges: 1, regionShuffleCharges: 1
        });
        expect(togglePinnedTile(run, 'A-a').perfectMemoryActions).toBeUndefined();
        expect(applyPeek(run, 'missing')).toBe(run);
        const peeked = applyPeek(run, 'A-a');
        expect(applyPeek(peeked, 'A-a')).toBe(peeked);
        const swapped = applyTileSwap(peeked, 'A-a', 'B-a');
        expect(swapped.perfectMemoryActions).toEqual({ first: 'peek', latest: 'tile_swap' });
    });

    it('preserves attribution through floor completion and resets it for a new run', () => {
        const run = makeRun([...makePair('A', 'A'), ...makePair('B', 'B')], {
            peekCharges: 1, gameMode: 'endless'
        });
        const cleared = playPerfectFloor(applyPeek(run, 'A-a'));
        expect(cleared.status).toBe('levelComplete');
        const next = finishMemorizePhase(advanceToNextLevel(cleared));
        expect(next.board?.level).toBe(2);
        expect(next.peekRevealedTileIds).toEqual([]);
        expect(next.perfectMemoryActions).toEqual({ first: 'peek', latest: 'peek' });
        expect(createNewRun(0).perfectMemoryActions).toBeUndefined();
    });

    it('records a failed Gambit as an assist too', () => {
        const run = makeRun([...makePair('A', 'A'), ...makePair('B', 'B'), ...makePair('C', 'C')], {
            gambitAvailableThisFloor: true
        });
        const next = resolveBoardTurn(flipTile(flipTile(flipTile(run, 'A-a'), 'B-a'), 'C-a'));
        expect(next.perfectMemoryActions).toEqual({ first: 'gambit', latest: 'gambit' });
    });
});
