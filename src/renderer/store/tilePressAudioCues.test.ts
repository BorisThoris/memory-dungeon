import { describe, expect, it, vi } from 'vitest';
import type { ChainMeter } from '../../shared/chain-tier-rules';
import {
    playTilePressAudioCues,
    type TilePressAudioCuePlayers
} from './tilePressAudioCues';

const METER: ChainMeter = {
    tier: 'sharp',
    fill: 0.6,
    ticks: { clean: 0.3, sharp: 0.6 },
    full: false,
    momentum: 6,
    feverAt: 10
};

const createPlayers = (): TilePressAudioCuePlayers => ({
    getComboMeter: vi.fn(() => METER),
    getSfxGain: vi.fn(() => 0.42),
    playFlipSfx: vi.fn(),
    playPeekPowerSfx: vi.fn(),
    resumeAudioContext: vi.fn()
});

describe('playTilePressAudioCues', () => {
    it('does nothing for empty cue lists', () => {
        const players = createPlayers();

        playTilePressAudioCues([], players);

        expect(players.resumeAudioContext).not.toHaveBeenCalled();
        expect(players.getSfxGain).not.toHaveBeenCalled();
        expect(players.getComboMeter).not.toHaveBeenCalled();
    });

    it('plays each tile press cue with one gain lookup', () => {
        const players = createPlayers();

        playTilePressAudioCues([{ kind: 'flip' }, { kind: 'peekPower' }], players);

        expect(players.resumeAudioContext).toHaveBeenCalledTimes(1);
        expect(players.getSfxGain).toHaveBeenCalledTimes(1);
        // One meter read per press, not one per cue: every cue in a press is the same instant.
        expect(players.getComboMeter).toHaveBeenCalledTimes(1);
        expect(players.playFlipSfx).toHaveBeenCalledWith(0.42, METER);
        expect(players.playPeekPowerSfx).toHaveBeenCalledWith(0.42);
    });
});
