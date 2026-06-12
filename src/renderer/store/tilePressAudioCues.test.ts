import { describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/run-creation-rules';
import {
    playTilePressAudioCues,
    type TilePressAudioCuePlayers
} from './tilePressAudioCues';

const createPlayers = (): TilePressAudioCuePlayers => ({
    getSfxGain: vi.fn(() => 0.42),
    playDestroyPairSfx: vi.fn(),
    playFlipSfx: vi.fn(),
    playPeekPowerSfx: vi.fn(),
    playResolveSfx: vi.fn(),
    playStrayPowerSfx: vi.fn(),
    playTrapSfx: vi.fn(),
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
        const fromRun = createNewRun(0, { echoFeedbackEnabled: false });
        const toRun = { ...fromRun, lives: fromRun.lives - 1 };

        playTilePressAudioCues([
            { kind: 'destroyPair' },
            { kind: 'flip' },
            { kind: 'peekPower' },
            { kind: 'resolveContact', fromRun, toRun },
            { kind: 'strayPower' },
            { kind: 'trap' }
        ], players);

        expect(players.resumeAudioContext).toHaveBeenCalledTimes(1);
        expect(players.getSfxGain).toHaveBeenCalledTimes(1);
        expect(players.playDestroyPairSfx).toHaveBeenCalledWith(0.42);
        expect(players.playFlipSfx).toHaveBeenCalledWith(0.42);
        expect(players.playPeekPowerSfx).toHaveBeenCalledWith(0.42);
        expect(players.playResolveSfx).toHaveBeenCalledWith(fromRun, toRun, 0.42);
        expect(players.playStrayPowerSfx).toHaveBeenCalledWith(0.42);
        expect(players.playTrapSfx).toHaveBeenCalledWith(0.42);
    });
});
