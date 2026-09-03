import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game';
import { canRegionShuffleRow } from '../../shared/board-powers';
import {
    createArmedBoardPowerPressResult,
    createRegionShuffleArmToggleSurfaceResult,
    regionShuffleRowForTile
} from './runSurfaceState';

/**
 * Row shuffle had rules, a command, surface results and two store actions, and no caller for any
 * of it: the affordance lived in a toolbar deleted during the run-shell rebuild. Every unit test
 * around it passed the whole time, because each one called the layer below directly.
 *
 * These tests are deliberately about reachability rather than rules — can a player, starting from
 * an armed power and a press, actually shuffle a row?
 */
const playingRun = () => ({ ...createNewRun(0), regionShuffleCharges: 1, status: 'playing' as const });

describe('reaching row shuffle from a press', () => {
    it('translates a pressed tile into the row it sits in', () => {
        const run = playingRun();
        const columns = run.board?.columns ?? 0;
        const tiles = run.board?.tiles ?? [];

        expect(columns).toBeGreaterThan(0);
        expect(regionShuffleRowForTile(run, tiles[0]!.id)).toBe(0);
        expect(regionShuffleRowForTile(run, tiles[columns]!.id)).toBe(1);
        // A tile that is not on this board cannot name a row, and must not be read as row zero.
        expect(regionShuffleRowForTile(run, 'no-such-tile')).toBeNull();
    });

    it('arms, then shuffles the pressed tile\'s row and spends the charge', () => {
        const run = playingRun();
        const armed = createRegionShuffleArmToggleSurfaceResult({ armed: false, run, view: 'playing' });

        expect(armed).toMatchObject({ kind: 'applied', patch: { regionShuffleArmed: true } });

        const tiles = run.board?.tiles ?? [];
        const rowZeroTile = tiles[0]!;
        expect(canRegionShuffleRow(run, 0)).toBe(true);

        const pressed = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: true,
            destroyPairArmed: false,
            enemyContacted: false,
            peekModeArmed: false,
            regionShuffleArmed: true,
            run,
            tileId: rowZeroTile.id
        });

        expect(pressed.kind).toBe('regionShuffleApplied');
        if (pressed.kind === 'regionShuffleApplied') {
            expect(pressed.run.regionShuffleCharges).toBe(run.regionShuffleCharges - 1);
            // Same nonce discipline as every other shuffle, so a replay lands on the same board.
            expect(pressed.run.shuffleNonce).toBe(run.shuffleNonce + 1);
        }
    });

    it('does not fire while the power is unarmed', () => {
        const run = playingRun();
        const pressed = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: true,
            destroyPairArmed: false,
            enemyContacted: false,
            peekModeArmed: false,
            regionShuffleArmed: false,
            run,
            tileId: run.board!.tiles[0]!.id
        });

        expect(pressed.kind).toBe('notArmed');
    });

    it('refuses a run under a contract that forbids shuffling', () => {
        const run = { ...playingRun(), activeContract: { maxMismatches: null, noDestroy: false, noShuffle: true } };
        const pressed = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: true,
            destroyPairArmed: false,
            enemyContacted: false,
            peekModeArmed: false,
            regionShuffleArmed: true,
            run,
            tileId: run.board!.tiles[0]!.id
        });

        // The press is consumed rather than falling through to an ordinary flip: the player armed
        // a power, and a contract refusal should not cost them a tile they did not mean to turn.
        expect(pressed.kind).toBe('handled');
    });
});
