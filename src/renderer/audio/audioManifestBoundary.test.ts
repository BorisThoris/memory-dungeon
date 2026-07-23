import sfxManifest from '../assets/audio/sfx/manifest.json';
import uiSfxManifest from '../assets/audio/ui/manifest.json';
import { describe, expect, it } from 'vitest';
import { sfxManifestSchema, uiSfxManifestSchema } from './audioManifestBoundary';

describe('audio manifest boundaries', () => {
    it('accepts the bundled runtime manifests', () => {
        expect(sfxManifestSchema.safeParse(sfxManifest).success).toBe(true);
        expect(uiSfxManifestSchema.safeParse(uiSfxManifest).success).toBe(true);
    });

    it('rejects unsupported runtime categories', () => {
        expect(
            sfxManifestSchema.safeParse({
                ...sfxManifest,
                entries: { ...sfxManifest.entries, flip: { file: 'flip.ogg', category: 'ambient' } }
            }).success
        ).toBe(false);
        expect(
            uiSfxManifestSchema.safeParse({
                ...uiSfxManifest,
                entries: { ...uiSfxManifest.entries, 'ui-click': { file: 'ui-click.ogg', category: 'gameplay' } }
            }).success
        ).toBe(false);
    });

    it('rejects malformed match-tier ranges and unknown fields', () => {
        expect(
            sfxManifestSchema.safeParse({
                ...sfxManifest,
                matchTierDepthRanges: { ...sfxManifest.matchTierDepthRanges, 'match-tier-low': [5, 1] }
            }).success
        ).toBe(false);
        expect(uiSfxManifestSchema.safeParse({ ...uiSfxManifest, undocumentedBus: 'music' }).success).toBe(false);
    });
});

