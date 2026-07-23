export const runStringArray = (value: unknown): string[] => Array.isArray(value) ? value : [];

export const runArrayCount = (value: unknown): number => Array.isArray(value) ? value.length : 0;
