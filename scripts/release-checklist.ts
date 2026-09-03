/**
 * Writes (or checks) `docs/RELEASE_CHECKLIST.md` from `src/shared/release-checklist.ts`.
 *
 * A release checklist is the document most likely to be believed and least likely to be reread, so
 * it is generated rather than written. `--check` fails when the committed document has drifted from
 * the data, the same way the system diagrams are gated.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderReleaseChecklistMarkdown, releaseChecklistByOwner } from '../src/shared/release-checklist';
import { STEAM_ACHIEVEMENT_API_NAME } from '../src/shared/steam-achievement-api-names';

const DOC_PATH = join(process.cwd(), 'docs', 'RELEASE_CHECKLIST.md');

const main = (): void => {
    const markdown = renderReleaseChecklistMarkdown();

    if (process.argv.includes('--check')) {
        const onDisk = (() => {
            try {
                return readFileSync(DOC_PATH, 'utf8');
            } catch {
                return null;
            }
        })();
        if (onDisk !== markdown) {
            process.stderr.write('docs/RELEASE_CHECKLIST.md is stale. Run yarn docs:release-checklist.\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('docs/RELEASE_CHECKLIST.md matches src/shared/release-checklist.ts\n');
        return;
    }

    if (process.argv.includes('--write')) {
        writeFileSync(DOC_PATH, markdown);
        process.stdout.write(`Wrote docs/RELEASE_CHECKLIST.md (${releaseChecklistByOwner('repo').length} proved rows).\n`);
        return;
    }

    // Bare invocation prints the list plus the achievement names, which is what somebody sitting in
    // front of the Partner site actually needs on screen.
    process.stdout.write(markdown);
    process.stdout.write('\n## Achievement API names to create\n\n');
    for (const name of Object.values(STEAM_ACHIEVEMENT_API_NAME)) {
        process.stdout.write(`- ${name}\n`);
    }
};

main();
