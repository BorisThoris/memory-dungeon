export const runArray = <T>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const runStringArray = (value: unknown): string[] => runArray(value);

export const runFilteredArray = <T>(value: unknown, predicate: (item: unknown) => item is T): T[] =>
    runArray<unknown>(value).filter(predicate);

export const runFilteredStringArray = (value: unknown): string[] =>
    runFilteredArray(value, (item): item is string => typeof item === 'string');

export const runFilteredStringArrayOrNull = (value: unknown): string[] | null =>
    Array.isArray(value) ? runFilteredStringArray(value) : null;

export const runArrayCount = (value: unknown): number => runArray(value).length;
