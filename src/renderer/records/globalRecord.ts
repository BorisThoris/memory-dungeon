import { GLOBAL_RECORD_API_URL } from '../../shared/global-record-config';
import { reject } from './playerNames.mjs';

export interface GlobalRecord { name: string; score: number; at: string }
interface RecordResponse { record: GlobalRecord | null; accepted?: boolean }
class RecordServiceError extends Error {}

const readRecord = (value: unknown): GlobalRecord | null => {
    if (value === null) return null;
    const row = value as Partial<GlobalRecord> | undefined;
    if (!row || typeof row.name !== 'string' || reject(row.name) || !Number.isSafeInteger(row.score) ||
        (row.score ?? 0) <= 0 || typeof row.at !== 'string') throw new Error('Global record unavailable');
    return row as GlobalRecord;
};

const requestRecord = async (name?: string, score?: number): Promise<RecordResponse> => {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${GLOBAL_RECORD_API_URL}/record`, {
            ...(name !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score }) } : {}),
            signal: controller.signal
        });
        const body = await response.json() as { record?: unknown; error?: string; accepted?: boolean };
        if (!response.ok) throw new RecordServiceError(body.error || 'Global record unavailable');
        if (name !== undefined && typeof body.accepted !== 'boolean') throw new Error('Global record unavailable');
        return { record: readRecord(body.record), accepted: body.accepted };
    } catch (cause) {
        if (cause instanceof RecordServiceError) throw cause;
        throw new Error('Global record unavailable. Please try again.');
    } finally { globalThis.clearTimeout(timeout); }
};

export const fetchGlobalRecord = (): Promise<RecordResponse> => requestRecord();
export const submitGlobalRecord = (name: string, score: number): Promise<RecordResponse> => {
    const why = reject(name);
    if (why) return Promise.reject(new Error(why));
    return requestRecord(name, score);
};
