import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getSharedAudioContext,
    resetSharedAudioContextForTests,
    resumeSharedAudioContext
} from './webAudioContext';

const installAudioContext = ({
    resume,
    state = 'suspended'
}: {
    resume: () => Promise<void>;
    state?: AudioContextState;
}) => {
    const close = vi.fn(async () => undefined);

    vi.stubGlobal(
        'AudioContext',
        class {
            readonly state = state;
            readonly close = close;
            readonly resume = resume;
        }
    );

    return { close };
};

describe('webAudioContext', () => {
    afterEach(() => {
        resetSharedAudioContextForTests();
        vi.unstubAllGlobals();
    });

    it('replaces a context the browser closed instead of handing the closed one back', () => {
        // Every node factory on a closed context throws, so a cached closed handle turns one
        // audio failure into a permanent one — and cues run before the actions they accompany.
        let state: AudioContextState = 'running';
        let built = 0;
        vi.stubGlobal(
            'AudioContext',
            class {
                get state(): AudioContextState {
                    return state;
                }
                readonly close = vi.fn(async () => undefined);
                readonly resume = vi.fn(async () => undefined);
                constructor() {
                    built += 1;
                }
            }
        );

        const first = getSharedAudioContext();
        expect(built).toBe(1);
        expect(getSharedAudioContext()).toBe(first);

        state = 'closed';
        const replacement = getSharedAudioContext();
        expect(built).toBe(2);
        expect(replacement).not.toBe(first);
    });

    it('settles a rejected resume attempt', async () => {
        const resume = vi.fn(async () => {
            throw new Error('autoplay denied');
        });
        installAudioContext({ resume });

        expect(() => resumeSharedAudioContext()).not.toThrow();
        await Promise.resolve();

        expect(resume).toHaveBeenCalledTimes(1);
    });

    it('contains a synchronous resume failure from the host', () => {
        const resume = vi.fn((): Promise<void> => {
            throw new Error('context closing');
        });
        installAudioContext({ resume });

        expect(() => resumeSharedAudioContext()).not.toThrow();
        expect(resume).toHaveBeenCalledTimes(1);
    });

    it('does not resume a context that is already running', () => {
        const resume = vi.fn(async () => undefined);
        installAudioContext({ resume, state: 'running' });

        resumeSharedAudioContext();

        expect(resume).not.toHaveBeenCalled();
    });
});
