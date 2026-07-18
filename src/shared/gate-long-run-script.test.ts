import { describe, expect, it } from 'vitest';
import { formatLongRunGateReport, parseLongRunGateOptions } from '../../scripts/gate-long-run';

describe('long-run gate script', () => {
    it('can be imported without executing the soak CLI', () => {
        expect(parseLongRunGateOptions).toBeTypeOf('function');
        expect(formatLongRunGateReport).toBeTypeOf('function');
    });

    it('parses floors and safe seed lists through the shared contract', () => {
        expect(parseLongRunGateOptions(['--floors=12', '--seeds=101, 202 303'])).toEqual({
            floors: 12,
            seeds: [101, 202, 303]
        });
        expect(parseLongRunGateOptions(['--floors=0', '--seeds=-1,0,3.5'])).toEqual({
            floors: 1,
            seeds: [42_001, 42_077, 42_123]
        });
    });

    it('keeps the established defaults and returns fresh seed arrays', () => {
        const first = parseLongRunGateOptions([]);
        const second = parseLongRunGateOptions([]);

        expect(first).toEqual({ floors: 48, seeds: [42_001, 42_077, 42_123] });
        expect(first.seeds).not.toBe(second.seeds);
    });

    it('formats the soak report as the established CSV contract', () => {
        const report = {
            rows: [
                {
                    key: 'route_depth',
                    label: 'Route depth',
                    value: 4,
                    targetMin: 3,
                    targetMax: 5,
                    status: 'within_range' as const,
                    source: 'fixture'
                }
            ]
        };

        expect(formatLongRunGateReport(report)).toBe(
            'key,value,targetMin,targetMax,status,source\nroute_depth,4,3,5,within_range,fixture\n'
        );
    });
});
