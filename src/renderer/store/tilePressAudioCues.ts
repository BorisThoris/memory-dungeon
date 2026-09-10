import type { TilePressAudioCue } from './tilePressController';

export interface TilePressAudioCuePlayers {
    getSfxGain: () => number;
    playFlipSfx: (gain: number) => void;
    playPeekPowerSfx: (gain: number) => void;
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
        if (cue.kind === 'flip') {
            players.playFlipSfx(gain);
        } else if (cue.kind === 'peekPower') {
            players.playPeekPowerSfx(gain);
        }
    }
};
