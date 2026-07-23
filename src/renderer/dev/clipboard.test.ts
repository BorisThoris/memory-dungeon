import { describe, expect, it, vi } from 'vitest';
import { copyDevTextToClipboard } from './clipboard';

describe('dev clipboard helper', () => {
    it('copies text through the provided clipboard writer', async () => {
        const clipboard = {
            writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
        };

        await expect(copyDevTextToClipboard('yarn test:unit', clipboard)).resolves.toBe('Copied yarn test:unit');
        expect(clipboard.writeText).toHaveBeenCalledWith('yarn test:unit');
    });

    it('fails closed when clipboard access is unavailable', async () => {
        await expect(copyDevTextToClipboard('yarn test:unit', null)).resolves.toBe('Clipboard unavailable');
    });

    it('reports clipboard write failures without throwing', async () => {
        const clipboard = {
            writeText: vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('permission denied'))
        };

        await expect(copyDevTextToClipboard('yarn test:unit', clipboard)).resolves.toBe('permission denied');
    });
});
