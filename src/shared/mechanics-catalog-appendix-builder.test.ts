import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { GAME_RULES_VERSION, MUTATOR_IDS } from './contracts';
import { ENCYCLOPEDIA_VERSION, GAME_MODE_CODEX } from './mechanics-encyclopedia';
import { buildMechanicsCatalogAppendixMarkdown } from './mechanics-catalog-appendix-builder';
import { RELIC_POOL } from './relics';

describe('mechanics-catalog-appendix-builder', () => {
    it('includes current rule versions and catalog sizes', () => {
        const md = buildMechanicsCatalogAppendixMarkdown('2000-01-01T00:00:00.000Z');
        expect(md).toContain(`| \`GAME_RULES_VERSION\` | ${GAME_RULES_VERSION} |`);
        expect(md).toContain(`| \`ENCYCLOPEDIA_VERSION\` | ${ENCYCLOPEDIA_VERSION} |`);
        expect(md).toContain(`| Relic entries (\`RELIC_CATALOG\`) | ${RELIC_POOL.length} |`);
        expect(md).toContain(`| Mutator entries (\`MUTATOR_CATALOG\`) | ${MUTATOR_IDS.length} |`);
        expect(md).toContain(`| Achievement entries (\`ACHIEVEMENT_CATALOG\`) | ${ACHIEVEMENTS.length} |`);
        expect(md).toContain('2000-01-01T00:00:00.000Z');
    });

    it('is deterministic for a fixed timestamp', () => {
        const a = buildMechanicsCatalogAppendixMarkdown('2000-01-01T00:00:00.000Z');
        const b = buildMechanicsCatalogAppendixMarkdown('2000-01-01T00:00:00.000Z');
        expect(a).toBe(b);
    });

    it('does not emit markdown images with empty alt (informative images need text; decorative use alt="" in source)', () => {
        const md = buildMechanicsCatalogAppendixMarkdown();
        expect(md).not.toMatch(/!\[\s*\]\(/);
    });

    it('lists GameMode ids in en locale sort order (diff-stable)', () => {
        const md = buildMechanicsCatalogAppendixMarkdown('2000-01-01T00:00:00.000Z');
        const sorted = [...GAME_MODE_CODEX.map((m) => m.id)].sort((a, b) => a.localeCompare(b, 'en')).join(', ');
        expect(md).toContain(sorted);
    });

    it('matches stable appendix snapshot', () => {
        expect(buildMechanicsCatalogAppendixMarkdown('2000-01-01T00:00:00.000Z')).toMatchSnapshot();
    });
});
