import { describe, expect, it } from 'vitest';
import { getTileBoardCanvasContextConfig } from './tileBoardCanvasContext';

describe('getTileBoardCanvasContextConfig', () => {
    it('keeps the canvas mounted when equivalent native-AA modes change', () => {
        expect(getTileBoardCanvasContextConfig('smaa', 0)).toEqual(
            getTileBoardCanvasContextConfig('msaa', 0)
        );
    });

    it('remounts when the immutable native antialias setting changes', () => {
        const enabled = getTileBoardCanvasContextConfig('msaa', 0);
        const disabled = getTileBoardCanvasContextConfig('off', 0);

        expect(enabled.antialias).toBe(true);
        expect(disabled.antialias).toBe(false);
        expect(enabled.key).not.toBe(disabled.key);
    });

    it('remounts after WebGL context recovery', () => {
        expect(getTileBoardCanvasContextConfig('smaa', 0).key).not.toBe(
            getTileBoardCanvasContextConfig('smaa', 1).key
        );
    });
});
