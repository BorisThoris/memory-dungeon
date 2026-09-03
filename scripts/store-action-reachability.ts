/**
 * Finds store actions and state nothing outside the store ever touches.
 *
 * The recurring failure in this codebase is not broken code, it is code nobody can reach: a power
 * whose toolbar was deleted in a UI rebuild, a notice computed and never rendered, an achievement
 * asking for more content than ships. Each one had passing unit tests, because a unit test calls
 * the layer below directly and never asks whether a player can get there.
 *
 * So this walks `AppState` and reports every action and every state field with no reader outside
 * `src/renderer/store`. Exemptions are listed by name with a reason rather than hidden behind a
 * count, because "why is this unreachable" is the whole question.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Entries that are unreachable on purpose. A number would let a real one hide behind a total. */
export const REACHABILITY_EXEMPTIONS: Record<string, string> = {
    clearSaveReadFailureNotice:
        'The save-read notice is deliberately not dismissable: it stays up until the player starts a fresh profile.',
    endRun: 'Lifecycle pass-through kept for the run controller; no screen ends a run directly.',
    triggerDebugReveal: 'Debug-only reveal, not wired to any shipping affordance.'
};

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (/\.(ts|tsx)$/.test(path) && !/\.test\./.test(path)) {
            out.push(path);
        }
    }
    return out;
};

export interface AppStateMember {
    readonly name: string;
    readonly kind: 'action' | 'state';
}

export const readAppStateMembers = (source: string): AppStateMember[] => {
    const body = source.slice(source.indexOf('export interface AppState {'));
    return [...body.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*)\??:\s*(.+)$/gm)].map((match) => ({
        kind: /=>/.test(match[2] ?? '') ? 'action' : 'state',
        name: match[1] ?? ''
    }));
};

export const findUnreachableMembers = (
    members: readonly AppStateMember[],
    consumerSources: readonly string[]
): AppStateMember[] =>
    members.filter(
        (member) =>
            !(member.name in REACHABILITY_EXEMPTIONS) &&
            !consumerSources.some((source) => new RegExp(`\\b${member.name}\\b`).test(source))
    );

const main = (): void => {
    const members = readAppStateMembers(readFileSync('src/renderer/store/appStoreTypes.ts', 'utf8'));
    const consumers = walk('src/renderer')
        .filter((path) => !path.startsWith(join('src', 'renderer', 'store')))
        .map((path) => readFileSync(path, 'utf8'));
    const unreachable = findUnreachableMembers(members, consumers);

    for (const member of unreachable) {
        process.stdout.write(`${member.kind} with no reader outside the store: ${member.name}\n`);
    }
    process.stdout.write(
        `\n${members.length} AppState members, ${unreachable.length} unreachable, ` +
            `${Object.keys(REACHABILITY_EXEMPTIONS).length} exempt by name\n`
    );
    if (unreachable.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1]?.includes('store-action-reachability')) {
    main();
}
