import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
