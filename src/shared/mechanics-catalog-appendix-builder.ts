/**
 * Markdown appendix for `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md`.
 * Emitted by `yarn docs:mechanics-appendix` — keeps machine-verifiable counts in sync with catalogs.
 */
import { ACHIEVEMENTS } from './achievements';
import { GAME_RULES_VERSION, MUTATOR_IDS } from './contracts';
import { ENCYCLOPEDIA_VERSION, GAME_MODE_CODEX } from './mechanics-encyclopedia';
import { RELIC_POOL } from './relics';

export function buildMechanicsCatalogAppendixMarkdown(generatedAtIso = new Date().toISOString()): string {
    const relicN = RELIC_POOL.length;
    const mutN = MUTATOR_IDS.length;
    const achN = ACHIEVEMENTS.length;
    const modes = [...GAME_MODE_CODEX.map((m) => m.id)].sort((a, b) => a.localeCompare(b, 'en')).join(', ');

    return [
        '# Gameplay mechanics — machine snapshot',
        '',
        `**Generated:** ${generatedAtIso}`,
        '',
        '> Regenerate with ' + '`yarn docs:mechanics-appendix`' + '. Do not edit by hand.',
        '',
        '| Constant / count | Value |',
        '| --- | --- |',
        `| \`GAME_RULES_VERSION\` | ${GAME_RULES_VERSION} |`,
        `| \`ENCYCLOPEDIA_VERSION\` | ${ENCYCLOPEDIA_VERSION} |`,
        `| Relic entries (\`RELIC_CATALOG\`) | ${relicN} |`,
        `| Mutator entries (\`MUTATOR_CATALOG\`) | ${mutN} |`,
        `| Achievement entries (\`ACHIEVEMENT_CATALOG\`) | ${achN} |`,
        `| \`GameMode\` codex ids | ${modes} |`,
        ''
    ].join('\n');
}
