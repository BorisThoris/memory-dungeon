/**
 * Privacy-first telemetry hook (K1 / REG-063).
 *
 * v1 policy:
 * - default runtime is local/no-op; no remote sink is installed in production by this module.
 * - events are balance/debug signals, not competitive leaderboard submissions.
 * - payloads are scrubbed before delivery: forbidden keys dropped, strings truncated, filesystem-like paths redacted.
 */
export type TelemetryPayload = Record<string, string | number | boolean | null | undefined>;

export type TelemetrySink = (event: string, payload: TelemetryPayload) => void;
export type TelemetryCategory =
    | 'local_debug'
    | 'balance_playtest'
    | 'crash_error'
    | 'online_competitive_submission';

export interface TelemetryPolicy {
    defaultSink: 'none';
    remoteCollectionEnabled: false;
    consentRequiredBeforeRemoteSink: true;
    leaderboardSubmissionsShareSink: false;
    allowedCategories: readonly Exclude<TelemetryCategory, 'online_competitive_submission'>[];
    deferredCategories: readonly Extract<TelemetryCategory, 'online_competitive_submission'>[];
}

let sink: TelemetrySink | null = null;

export const TELEMETRY_POLICY: TelemetryPolicy = {
    defaultSink: 'none',
    remoteCollectionEnabled: false,
    consentRequiredBeforeRemoteSink: true,
    leaderboardSubmissionsShareSink: false,
    allowedCategories: ['local_debug', 'balance_playtest', 'crash_error'],
    deferredCategories: ['online_competitive_submission']
} as const;

export const classifyTelemetryEvent = (event: string): TelemetryCategory => {
    if (event.startsWith('leaderboard_')) {
        return 'online_competitive_submission';
    }
    if (event.startsWith('crash_') || event.startsWith('error_')) {
        return 'crash_error';
    }
    if (event.startsWith('save_') || event.startsWith('settings_')) {
        return 'local_debug';
    }
    return 'balance_playtest';
};

export const telemetryPolicyForEvent = (
    event: string
): {
    category: TelemetryCategory;
    sink: 'local_dev_or_opt_in_remote' | 'deferred_out_of_scope_v1';
    piiAllowed: false;
    remoteAllowedByDefault: false;
    leaderboardSeparated: true;
} => {
    const category = classifyTelemetryEvent(event);
    return {
        category,
        sink: category === 'online_competitive_submission' ? 'deferred_out_of_scope_v1' : 'local_dev_or_opt_in_remote',
        piiAllowed: false,
        remoteAllowedByDefault: false,
        leaderboardSeparated: true
    };
};

/** Keys that must never leave the client in structured telemetry (PII / secrets). */
const FORBIDDEN_TELEMETRY_KEYS = new Set([
    'email',
    'password',
    'token',
    'username',
    'userid',
    'user_id',
    'name',
    'address',
    'pathname',
    'path',
    'useragent',
    'user_agent',
    'ip',
    'phone'
]);

const MAX_TELEMETRY_STRING_LEN = 200;

const looksLikeAbsolutePath = (value: string): boolean => {
    if (/^\\\\[^\\]/.test(value) || /^\/(?:Users|home|var|usr|etc)\b/i.test(value)) {
        return true;
    }
    return /^[a-z]:[\\/]/i.test(value);
};

export const scrubTelemetryPayload = (payload: TelemetryPayload): TelemetryPayload => {
    const out: TelemetryPayload = Object.create(null);
    for (const key in payload) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
            continue;
        }
        const raw = payload[key];
        if (FORBIDDEN_TELEMETRY_KEYS.has(key.toLowerCase())) {
            continue;
        }
        if (raw === null || raw === undefined || typeof raw === 'number' || typeof raw === 'boolean') {
            out[key] = raw;
            continue;
        }
        if (typeof raw === 'string') {
            let s = raw;
            if (looksLikeAbsolutePath(s)) {
                s = '[path_redacted]';
            } else if (s.length > MAX_TELEMETRY_STRING_LEN) {
                s = `${s.slice(0, MAX_TELEMETRY_STRING_LEN)}…`;
            }
            out[key] = s;
        }
    }
    return out;
};

export const setTelemetrySink = (next: TelemetrySink | null): void => {
    sink = next;
};

export const trackEvent = (event: string, payload: TelemetryPayload = {}): void => {
    if (sink) {
        sink(event, scrubTelemetryPayload(payload));
    }
};
