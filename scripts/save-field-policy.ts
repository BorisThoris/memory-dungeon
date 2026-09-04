/**
 * Finds persisted save fields with no migration policy.
 *
 * `dungeon-save-migration.ts` exists to say which save fields need a migration when they change.
 * It only works if the next person to add a field is held to it, and the next person was me: I
 * added `runHistory` to `SaveData` and left the table alone for two generations, with every gate
 * green the whole time. Nothing could have said so, because the field and the table are two lists
 * that nobody compared.
 *
 * So this compares them. Every top-level `SaveData` field must be named in the policy — by itself
 * or as the root of a dotted entry — or listed below with the reason it needs no policy.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fields that cannot need a migration policy, by name with the reason. A field is exempt when
 * changing it cannot invalidate a stored profile.
 */
export const SAVE_FIELD_POLICY_EXEMPTIONS: Record<string, string> = {
    achievements: 'A set of booleans keyed by achievement id; an unknown id is dropped and a new one defaults to false.',
    bestScore: 'A number with a floor of zero; there is no shape here to migrate.',
    firstRunHelpDismissed: 'A boolean panel flag with a safe default.',
    onboardingDismissed: 'A boolean flag with a safe default.',
    powersFtueSeen: 'A boolean flag with a safe default.',
    schemaVersion: 'The version the policy is written against; it cannot need a policy of its own.',
    unlocks: 'A list of opaque string tags; unknown tags are dropped and known ones are re-derived.'
};

/** The fields declared on `SaveData`, in the order the interface lists them. */
export const readSaveDataFields = (contractsSource: string): string[] => {
    const start = contractsSource.indexOf('export interface SaveData {');
    if (start < 0) {
        return [];
    }
    const body = contractsSource.slice(start, contractsSource.indexOf('\n}', start));
    return [...body.matchAll(/^ {4}([a-zA-Z][A-Za-z0-9]*)\??:/gmu)].map((match) => match[1] ?? '');
};

/** The roots the policy table names: `runHistory.shareKey` covers `runHistory`. */
export const readPolicyRoots = (policySource: string): Set<string> =>
    new Set(
        [...policySource.matchAll(/field: '([^']+)'/gu)].map((match) => (match[1] ?? '').split('.')[0] ?? '')
    );

export const findFieldsWithoutPolicy = (fields: readonly string[], roots: ReadonlySet<string>): string[] =>
    fields.filter((field) => !roots.has(field) && SAVE_FIELD_POLICY_EXEMPTIONS[field] === undefined);

const main = (): void => {
    const fields = readSaveDataFields(readFileSync('src/shared/contracts.ts', 'utf8'));
    const roots = readPolicyRoots(readFileSync('src/shared/dungeon-save-migration.ts', 'utf8'));
    const missing = findFieldsWithoutPolicy(fields, roots);

    for (const field of missing) {
        console.log(`persisted save field with no migration policy: SaveData.${field}`);
    }
    console.log(
        `\n${fields.length} SaveData fields, ${missing.length} with no migration policy, ` +
            `${Object.keys(SAVE_FIELD_POLICY_EXEMPTIONS).length} exempt by name`
    );
    if (missing.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/save-field-policy.ts'))) {
    main();
}
