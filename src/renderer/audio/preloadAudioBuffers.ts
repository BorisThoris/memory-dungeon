import { runNonNegativeIntegerWithFallback } from '../../shared/run-number-guards';

interface PreloadAudioBuffersOptions<Key extends string> {
    concurrency?: number;
    decode: (arrayBuffer: ArrayBuffer) => Promise<AudioBuffer>;
    fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer | null>;
    keys: readonly Key[];
    timeoutMs?: number;
    urlForKey: (key: Key) => string | undefined;
}

const DEFAULT_AUDIO_PRELOAD_CONCURRENCY = 3;
const DEFAULT_AUDIO_PRELOAD_TIMEOUT_MS = 1500;

const positiveIntegerOption = (value: number, fallback: number): number =>
    Math.max(1, runNonNegativeIntegerWithFallback(value, fallback));

const defaultFetchArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    const res = await fetch(url);
    if (!res.ok) {
        return null;
    }
    return res.arrayBuffer();
};

/**
 * Preload audio samples in small batches so the first user gesture does not kick
 * off a large burst of concurrent network reads and audio decodes.
 */
export const preloadAudioBuffers = async <Key extends string>({
    concurrency = DEFAULT_AUDIO_PRELOAD_CONCURRENCY,
    decode,
    fetchArrayBuffer = defaultFetchArrayBuffer,
    keys,
    timeoutMs = DEFAULT_AUDIO_PRELOAD_TIMEOUT_MS,
    urlForKey
}: PreloadAudioBuffersOptions<Key>): Promise<Map<Key, AudioBuffer>> => {
    const loaded = new Map<Key, AudioBuffer>();
    const safeConcurrency = positiveIntegerOption(concurrency, DEFAULT_AUDIO_PRELOAD_CONCURRENCY);
    const safeTimeoutMs = positiveIntegerOption(timeoutMs, DEFAULT_AUDIO_PRELOAD_TIMEOUT_MS);
    const uniqueKeys = [...new Set(keys)];
    const workerCount = Math.max(1, Math.min(safeConcurrency, uniqueKeys.length));
    let cursor = 0;

    const withTimeout = async <Value,>(work: Promise<Value>): Promise<Value | null> => {
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeout = new Promise<null>((resolve) => {
            timeoutHandle = globalThis.setTimeout(() => resolve(null), safeTimeoutMs);
        });

        try {
            return await Promise.race([work, timeout]);
        } finally {
            if (timeoutHandle) {
                globalThis.clearTimeout(timeoutHandle);
            }
        }
    };

    const worker = async (): Promise<void> => {
        while (cursor < uniqueKeys.length) {
            const key = uniqueKeys[cursor];
            cursor += 1;
            if (!key) {
                continue;
            }

            const url = urlForKey(key);
            if (!url) {
                continue;
            }

            try {
                const arrayBuffer = await withTimeout(fetchArrayBuffer(url));
                if (!arrayBuffer) {
                    continue;
                }
                const decoded = await withTimeout(decode(arrayBuffer.slice(0)));
                if (!decoded) {
                    continue;
                }
                loaded.set(key, decoded);
            } catch {
                /* missing file or decode error: procedural fallback */
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return loaded;
};
