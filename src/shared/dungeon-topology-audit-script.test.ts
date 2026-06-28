import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDungeonTopologyAudit, parseDungeonTopologyAuditOptions, runDungeonTopologyAudit } from '../../scripts/audit-dungeon-topology';

describe('dungeon topology audit script', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('audits scheduled endless boards with graph-backed diagnostics', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--floors=24', '--seeds=42001,42002'])).toBe(0);

        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('# Dungeon topology audit'))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42001,topology=24/24,routes=24/24'))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42002,topology=24/24,routes=24/24'))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('coverage: archetypes=['))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('objectives=['))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('mutators=['))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('routeNodeKinds=['))).toBe(true);
        expect(
            stdout.mock.calls.some(([chunk]) =>
                String(chunk).includes(
                    'Dungeon topology audit passed (48 board(s), 48 route state(s), 288 route branch state(s), 144 route target board(s))'
                )
            )
        ).toBe(true);
        expect(stderr).not.toHaveBeenCalled();
    });

    it('supports deterministic stress seed sweeps', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--floors=12', '--stressSeeds=3', '--stressSeedBase=42001'])).toBe(0);

        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('Seeds: 432012, 425003, 878670'))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=432012,topology=12/12,routes=12/12'))).toBe(true);
        expect(stderr).not.toHaveBeenCalled();
    });

    it('can analyze topology sweeps without writing through the CLI', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const options = parseDungeonTopologyAuditOptions(['--floors=8', '--stressSeeds=2', '--stressSeedBase=42001']);

        const result = analyzeDungeonTopologyAudit(options);

        expect(result).toMatchObject({
            floors: 8,
            rulesVersion: expect.any(Number),
            seeds: [432012, 425003],
            checkedBoards: 16,
            checkedRoutes: 16,
            checkedRouteBranches: 96,
            checkedRouteTargetBoards: 48,
            issueBoards: 0,
            issueRoutes: 0,
            issueRouteBranches: 0,
            issueRouteTargetBoards: 0,
            coverageCounts: {
                floorArchetypes: expect.objectContaining({
                    survey_hall: 2,
                    speed_trial: 8
                }),
                featuredObjectives: expect.objectContaining({
                    flip_par: expect.any(Number),
                    scholar_style: expect.any(Number)
                }),
                floorTags: expect.objectContaining({
                    normal: expect.any(Number),
                    breather: expect.any(Number),
                    boss: expect.any(Number)
                }),
                mutators: expect.objectContaining({
                    wide_recall: expect.any(Number),
                    short_memorize: expect.any(Number)
                }),
                routeNodeKinds: expect.objectContaining({
                    boss: expect.any(Number),
                    combat: expect.any(Number),
                    elite: expect.any(Number)
                })
            },
            issueContextCounts: {
                floorArchetypes: {},
                featuredObjectives: {},
                floorTags: {},
                mutators: {},
                routeNodeKinds: {}
            },
            coverageGaps: [],
            issueCounts: {},
            failures: []
        });
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
    });

    it('can suppress per-seed output for long stress runs', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--quiet', '--floors=6', '--seeds=42001,42002'])).toBe(0);

        const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join('');
        expect(output).not.toContain('# Dungeon topology audit');
        expect(output).not.toContain('seed=42001');
        expect(output).toContain(
            'Dungeon topology audit passed (12 board(s), 12 route state(s), 72 route branch state(s), 36 route target board(s))'
        );
        expect(stderr).not.toHaveBeenCalled();
    });

    it('fails required full-schedule coverage when a sweep is too narrow', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--requireFullScheduleCoverage', '--floors=1', '--seeds=42001'])).toBe(1);

        const errorOutput = stderr.mock.calls.map(([chunk]) => String(chunk)).join('');
        expect(errorOutput).toContain('Dungeon topology audit coverage gaps');
        expect(errorOutput).toContain('floorArchetype:anchor_chain');
        expect(errorOutput).toContain('mutator:n_back_anchor');
        expect(errorOutput).toContain('routeNodeKind:boss');
        expect(errorOutput).toContain('routeNodeKind:shop');
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('Dungeon topology audit passed'))).toBe(false);
    });

    it('passes required full-schedule coverage when the cycle surface is sampled', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--requireFullScheduleCoverage', '--floors=12', '--seeds=42001'])).toBe(0);

        const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join('');
        expect(output).toContain('coverage: archetypes=[');
        expect(output).toContain('spotlight_hunt=4');
        expect(output).toContain('shifting_spotlight=4');
        expect(output).toContain('routeNodeKinds=[');
        expect(stderr).not.toHaveBeenCalled();
    });

    it('can emit machine-readable JSON audit summaries', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runDungeonTopologyAudit(['--json', '--floors=6', '--seeds=42001'])).toBe(0);

        const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join('');
        const payload = JSON.parse(output) as {
            checkedBoards: number;
            checkedRoutes: number;
            checkedRouteBranches: number;
            checkedRouteTargetBoards: number;
            failures: unknown[];
            issueCounts: Record<string, number>;
            coverageCounts: {
                floorArchetypes: Record<string, number>;
                featuredObjectives: Record<string, number>;
                floorTags: Record<string, number>;
                mutators: Record<string, number>;
                routeNodeKinds: Record<string, number>;
            };
            issueRouteTargetBoards: number;
            issueContextCounts: {
                floorArchetypes: Record<string, number>;
                featuredObjectives: Record<string, number>;
                floorTags: Record<string, number>;
                mutators: Record<string, number>;
                routeNodeKinds: Record<string, number>;
            };
            coverageGaps: string[];
            seedSummaries: { seed: number; boardsPassed: number; routesPassed: number; floors: number }[];
        };
        expect(payload).toMatchObject({
            checkedBoards: 6,
            checkedRoutes: 6,
            checkedRouteBranches: 36,
            checkedRouteTargetBoards: 18,
            issueRouteTargetBoards: 0,
            failures: [],
            issueCounts: {},
            coverageCounts: {
                floorArchetypes: {
                    survey_hall: 1,
                    speed_trial: 4,
                    treasure_gallery: 4,
                    shadow_read: 4,
                    anchor_chain: 4,
                    breather: 4,
                    trap_hall: 3
                },
                featuredObjectives: {
                    flip_par: 5,
                    scholar_style: 8,
                    cursed_last: 8,
                    glass_witness: 3
                },
                floorTags: {
                    normal: 13,
                    breather: 8,
                    boss: 3
                },
                mutators: {
                    wide_recall: 1,
                    short_memorize: 4,
                    findables_floor: 4,
                    silhouette_twist: 4,
                    n_back_anchor: 4,
                    none: 4,
                    glass_floor: 3,
                    sticky_fingers: 3
                },
                routeNodeKinds: {
                    boss: 3,
                    combat: 4,
                    elite: 3,
                    event: 4,
                    rest: 1,
                    shop: 1,
                    trap: 1,
                    treasure: 1
                }
            },
            issueContextCounts: {
                floorArchetypes: {},
                featuredObjectives: {},
                floorTags: {},
                mutators: {},
                routeNodeKinds: {}
            },
            coverageGaps: [],
            seedSummaries: [{ seed: 42001, boardsPassed: 6, routesPassed: 6, floors: 6 }]
        });
        expect(output).not.toContain('# Dungeon topology audit');
        expect(stderr).not.toHaveBeenCalled();
    });
});
