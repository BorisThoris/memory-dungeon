import type { RunState } from '../../shared/contracts';
import type { TilePressAudioCue } from './tilePressController';

export interface TilePressAudioCuePlayers {
    getSfxGain: () => number;
    playDestroyPairSfx: (gain: number) => void;
    playFlipSfx: (gain: number) => void;
    playPeekPowerSfx: (gain: number) => void;
    playResolveSfx: (fromRun: RunState, toRun: RunState, gain: number) => void;
    playStrayPowerSfx: (gain: number) => void;
    playTrapSfx: (gain: number) => void;
    resumeAudioContext: () => void;
}

export const playTilePressAudioCues = (
    audio: readonly TilePressAudioCue[],
    players: TilePressAudioCuePlayers
): void => {
    if (audio.length === 0) {
        return;
    }

    players.resumeAudioContext();
    const gain = players.getSfxGain();
    for (const cue of audio) {
        if (cue.kind === 'destroyPair') {
            players.playDestroyPairSfx(gain);
        } else if (cue.kind === 'flip') {
            players.playFlipSfx(gain);
        } else if (cue.kind === 'peekPower') {
            players.playPeekPowerSfx(gain);
        } else if (cue.kind === 'resolveContact') {
            players.playResolveSfx(cue.fromRun, cue.toRun, gain);
        } else if (cue.kind === 'strayPower') {
            players.playStrayPowerSfx(gain);
        } else if (cue.kind === 'trap') {
            players.playTrapSfx(gain);
        }
    }
};
