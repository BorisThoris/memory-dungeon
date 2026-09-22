import type { ChainMeter } from '../../shared/chain-tier-rules';
import type { TilePressAudioCue } from './tilePressController';

export interface TilePressAudioCuePlayers {
    getSfxGain: () => number;
    /**
     * The chain meter the flip is happening on, so the flip tick can sit at the pitch the
     * ladder has reached (`comboVoicing.ts`). Read once per press, beside the gain, because a
     * press produces at most a couple of cues and they all belong to the same instant.
     */
    getComboMeter: () => ChainMeter | null;
    playFlipSfx: (gain: number, meter: ChainMeter | null) => void;
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
    const meter = players.getComboMeter();
    for (const cue of audio) {
        if (cue.kind === 'flip') {
            players.playFlipSfx(gain, meter);
        } else if (cue.kind === 'peekPower') {
            players.playPeekPowerSfx(gain);
        }
    }
};
