export const runStringArray = (value: unknown): string[] => Array.isArray(value) ? value : [];

export const runFilteredStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const runFilteredStringArrayOrNull = (value: unknown): string[] | null =>
    Array.isArray(value) ? runFilteredStringArray(value) : null;

export const runArrayCount = (value: unknown): number => Array.isArray(value) ? value.length : 0;
