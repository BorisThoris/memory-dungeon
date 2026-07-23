/**
 * Shared AudioContext for procedural (`gameSfx`) and sampled (`sampledSfx`) playback.
 */

let audioContext: AudioContext | null = null;

export const getSharedAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!audioContext) {
        try {
            audioContext = new AudioContext();
        } catch {
            return null;
        }
    }
    return audioContext;
};

export const resumeSharedAudioContext = (): void => {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
        try {
            void Promise.resolve(ctx.resume()).catch(() => undefined);
        } catch {
            // Audio hosts can throw synchronously while a context is closing.
        }
    }
};

export const resetSharedAudioContextForTests = (): void => {
    if (audioContext && typeof audioContext.close === 'function') {
        void audioContext.close().catch(() => undefined);
    }
    audioContext = null;
};
