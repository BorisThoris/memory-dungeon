import { describe, expect, it, vi } from 'vitest';
import {
    classifyTelemetryEvent,
    scrubTelemetryPayload,
    setTelemetrySink,
    telemetryPolicyForEvent,
    trackEvent
} from './telemetry';

describe('telemetry (REF-067)', () => {
    it('scrubs forbidden keys, truncates long strings, and redacts path-like values', () => {
        const scrubbed = scrubTelemetryPayload({
            mode: 'endless',
            email: 'nope@example.com',
            score: 12,
            long: 'x'.repeat(400),
            winPath: 'C:\\Users\\someone\\secret\\file.json',
            posixPath: '/Users/me/file.txt',
            okShort: 'hello'
        });
        expect(scrubbed.email).toBeUndefined();
        expect(scrubbed.mode).toBe('endless');
        expect(scrubbed.score).toBe(12);
        expect(scrubbed.okShort).toBe('hello');
        expect(String(scrubbed.long).length).toBeLessThanOrEqual(201);
        expect(scrubbed.winPath).toBe('[path_redacted]');
        expect(scrubbed.posixPath).toBe('[path_redacted]');
    });

    it('passes scrubbed payloads to the sink', () => {
        const fn = vi.fn();
        setTelemetrySink(fn);
        trackEvent('run_start', { mode: 'daily', pathname: '/should-drop' });
        setTelemetrySink(null);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0]![0]).toBe('run_start');
        expect(fn.mock.calls[0]![1]).toEqual({ mode: 'daily' });
    });

    it('preserves prototype-named fields as own telemetry keys', () => {
        const payload = JSON.parse('{"__proto__":null,"constructor":"local","toString":true}');
        const scrubbed = scrubTelemetryPayload(payload);

        expect(Object.getPrototypeOf(scrubbed)).toBeNull();
        expect(Object.keys(scrubbed)).toEqual(['__proto__', 'constructor', 'toString']);
        expect(scrubbed.__proto__).toBeNull();
    });

    it('classifies event policy without online competitive submissions', () => {
        expect(classifyTelemetryEvent('run_start')).toBe('balance_playtest');
        expect(classifyTelemetryEvent('save_write_failed')).toBe('local_debug');
        expect(classifyTelemetryEvent('crash_renderer')).toBe('crash_error');
        expect(classifyTelemetryEvent('leaderboard_submit')).toBe('online_competitive_submission');

        expect(telemetryPolicyForEvent('run_complete')).toEqual({
            category: 'balance_playtest',
            sink: 'local_dev_or_opt_in_remote',
            piiAllowed: false,
            remoteAllowedByDefault: false,
            leaderboardSeparated: true
        });
        expect(telemetryPolicyForEvent('leaderboard_submit')).toEqual({
            category: 'online_competitive_submission',
            sink: 'deferred_out_of_scope_v1',
            piiAllowed: false,
            remoteAllowedByDefault: false,
            leaderboardSeparated: true
        });
    });
});
