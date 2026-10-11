/** Bobball's exact name moderation rules, shared with the record service. */
export function clean(raw: unknown): string;
export function reject(raw: unknown): string | null;
export function bad(raw: unknown): boolean;
export function normalise(raw: unknown): string;
export function extend(words: readonly string[]): number;
