import { describe, expect, it, vi } from 'vitest';
import {
    playTilePressAudioCues,
    type TilePressAudioCuePlayers
} from './tilePressAudioCues';

const createPlayers = (): TilePressAudioCuePlayers => ({
    getSfxGain: vi.fn(() => 0.42),
    playDestroyPairSfx: vi.fn(),
    playFlipSfx: vi.fn(),
    playPeekPowerSfx: vi.fn(),
    playStrayPowerSfx: vi.fn(),
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

        playTilePressAudioCues([
            { kind: 'destroyPair' },
            { kind: 'flip' },
            { kind: 'peekPower' },
            { kind: 'strayPower' }
        ], players);

        expect(players.resumeAudioContext).toHaveBeenCalledTimes(1);
        expect(players.getSfxGain).toHaveBeenCalledTimes(1);
        expect(players.playDestroyPairSfx).toHaveBeenCalledWith(0.42);
        expect(players.playFlipSfx).toHaveBeenCalledWith(0.42);
        expect(players.playPeekPowerSfx).toHaveBeenCalledWith(0.42);
        expect(players.playStrayPowerSfx).toHaveBeenCalledWith(0.42);
    });
});
