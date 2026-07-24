export const isRunRecord = (value: unknown): value is Record<string, unknown> =>
    value != null && typeof value === 'object' && !Array.isArray(value);

export const runRecord = (value: unknown): Record<string, unknown> => isRunRecord(value) ? value : {};
