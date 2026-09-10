import { describe, expect, it, vi } from 'vitest';
import {
    playTilePressAudioCues,
    type TilePressAudioCuePlayers
} from './tilePressAudioCues';

const createPlayers = (): TilePressAudioCuePlayers => ({
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
    });

    it('plays each tile press cue with one gain lookup', () => {
        const players = createPlayers();

        playTilePressAudioCues([{ kind: 'flip' }, { kind: 'peekPower' }], players);

        expect(players.resumeAudioContext).toHaveBeenCalledTimes(1);
        expect(players.getSfxGain).toHaveBeenCalledTimes(1);
        expect(players.playFlipSfx).toHaveBeenCalledWith(0.42);
        expect(players.playPeekPowerSfx).toHaveBeenCalledWith(0.42);
    });
});
