/**
 * Markdown appendix for `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md`.
 * Emitted by `yarn docs:mechanics-appendix` — keeps machine-verifiable counts in sync with catalogs.
 */
import { ACHIEVEMENTS } from './achievements';
import { GAME_RULES_VERSION, MUTATOR_IDS } from './contracts';
import { ENCYCLOPEDIA_VERSION, GAME_MODE_CODEX } from './mechanics-encyclopedia';
import { SYSTEM_REFINEMENT_LEDGER } from './system-refinement-ledger';

export function buildMechanicsCatalogAppendixMarkdown(generatedAtIso = new Date().toISOString()): string {
    const mutN = MUTATOR_IDS.length;
    const achN = ACHIEVEMENTS.length;
    const modes = [...GAME_MODE_CODEX.map((m) => m.id)].sort((a, b) => a.localeCompare(b, 'en')).join(', ');
    const verdictCount = (verdict: string): number =>
        SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === verdict).length;
    const changedN = verdictCount('changed');
    const confirmedN = verdictCount('confirmed');
    const removedN = verdictCount('removed');

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
        `| Mutator entries (\`MUTATOR_CATALOG\`) | ${mutN} |`,
        `| Achievement entries (\`ACHIEVEMENT_CATALOG\`) | ${achN} |`,
        `| \`GameMode\` codex ids | ${modes} |`,
        '',
        /*
         * The refinement ledger, printed rather than left in a source file only its own gate reads.
         * A record of what state every system is in is worth having where a person will find it.
         */
        '## System refinement ledger',
        '',
        `Every system in the game, with the last generation that passed over it. ${changedN} changed, `
            + `${confirmedN} confirmed already in their refined state, ${removedN} removed outright.`,
        '',
        '| System | Verdict | Gen | What was found |',
        '| --- | --- | --- | --- |',
        ...[...SYSTEM_REFINEMENT_LEDGER].map(
            (entry) => `| \`${entry.id}\` | ${entry.verdict} | ${entry.generation} | ${entry.note} |`
        ),
        ''
    ].join('\n');
}
