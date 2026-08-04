import { z } from 'zod';
import {
    GAME_RULES_VERSION,
    MUTATOR_IDS,
    type ContractFlags,
    type RunState,
    type Settings,
    type StartingLoadoutId
} from './contracts';
import { GAMEPLAY_CORE_SCHEMA_VERSION } from './gameplay-core-contracts';
import { deriveDailyRunSeed } from './rng';
import { STARTING_LOADOUT_IDS } from './starting-loadouts';

const MAX_JAVASCRIPT_DATE_MS = 8_640_000_000_000_000;
const UINT32_MAX = 0xffff_ffff;
export const DUNGEON_SHOWCASE_RUN_SEED = 72_001;

export const runStartRequestSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('daily') }).strict(),
    z.object({ kind: z.literal('dungeonShowcase') }).strict(),
    z.object({ kind: z.literal('endless') }).strict(),
    z
        .object({
            durationMs: z.number().int().positive().max(MAX_JAVASCRIPT_DATE_MS),
            kind: z.literal('gauntlet')
        })
        .strict(),
    z.object({ kind: z.literal('meditation') }).strict(),
    z
        .object({
            kind: z.literal('meditationWithMutators'),
            mutators: z.array(z.enum(MUTATOR_IDS)).max(MUTATOR_IDS.length)
        })
        .strict(),
    z.object({ kind: z.literal('pinVow') }).strict(),
    z.object({ kind: z.literal('practice') }).strict(),
    z
        .object({
            kind: z.literal('puzzle'),
            puzzleId: z.string().min(1).max(160)
        })
        .strict(),
    z.object({ kind: z.literal('scholarContract') }).strict(),
    z.object({ kind: z.literal('wild') }).strict()
]);

export type RunStartRequest = z.infer<typeof runStartRequestSchema>;

export const runStartGameplaySettingsSchema = z
    .object({
        echoFeedbackEnabled: z.boolean(),
        resolveDelayMultiplier: z.number().finite().positive().max(10),
        shuffleScoreTaxEnabled: z.boolean(),
        weakerShuffleMode: z.enum(['full', 'rows_only'])
    })
    .strict();

export type RunStartGameplaySettings = z.infer<typeof runStartGameplaySettingsSchema>;

export const runStartContractOverrideSchema = z
    .object({
        noShuffle: z.boolean(),
        noDestroy: z.boolean(),
        maxMismatches: z.number().int().nonnegative().nullable(),
        maxPinsTotalRun: z.number().int().nonnegative().nullable().optional(),
        bonusRelicDraftPick: z.boolean().optional()
    })
    .strict();

export const runStartCommandSchema = z
    .object({
        schemaVersion: z.literal(GAMEPLAY_CORE_SCHEMA_VERSION),
        commandId: z.string().min(1).max(160),
        type: z.literal('run.start'),
        reason: z.enum(['new', 'restart']),
        request: runStartRequestSchema,
        observedAtMs: z.number().int().nonnegative().max(MAX_JAVASCRIPT_DATE_MS),
        runSeed: z.number().int().nonnegative().max(UINT32_MAX),
        runRulesVersion: z.number().int().positive(),
        bestScore: z.number().finite().nonnegative(),
        onboardingDismissed: z.boolean(),
        metaRelicDraftExtraPerMilestone: z.number().int().nonnegative().max(100),
        startingLoadoutId: z.enum(STARTING_LOADOUT_IDS).nullable(),
        activeContractOverride: runStartContractOverrideSchema.nullable(),
        settings: runStartGameplaySettingsSchema
    })
    .strict()
    .superRefine((command, context) => {
        const canonicalSeed = canonicalRunStartSeed(
            command.request,
            command.observedAtMs,
            command.runRulesVersion,
            command.runSeed
        );
        if (canonicalSeed !== command.runSeed) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `runSeed must be ${canonicalSeed} for ${command.request.kind}.`,
                path: ['runSeed']
            });
        }
        if (
            command.request.kind === 'gauntlet' &&
            command.observedAtMs + command.request.durationMs > MAX_JAVASCRIPT_DATE_MS
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Gauntlet deadline exceeds the serializable host-clock range.',
                path: ['request', 'durationMs']
            });
        }
        if (
            command.activeContractOverride &&
            (command.reason !== 'restart' ||
                (command.request.kind !== 'pinVow' && command.request.kind !== 'scholarContract'))
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Contract overrides are only valid for Pin Vow or Scholar restarts.',
                path: ['activeContractOverride']
            });
        }
    });

export type RunStartCommand = z.infer<typeof runStartCommandSchema>;

export interface RunRestartSelection {
    activeContractOverride: ContractFlags | null;
    request: RunStartRequest;
    startingLoadoutId: StartingLoadoutId | null;
}

export const canonicalRunStartSeed = (
    request: RunStartRequest,
    observedAtMs: number,
    runRulesVersion: number,
    proposedSeed: number
): number => {
    if (request.kind === 'daily') {
        return deriveDailyRunSeed(runRulesVersion, new Date(observedAtMs));
    }
    if (request.kind === 'dungeonShowcase') {
        return DUNGEON_SHOWCASE_RUN_SEED;
    }
    return proposedSeed >>> 0;
};

export const gameplaySettingsForRunStart = (settings: Settings): RunStartGameplaySettings => ({
    echoFeedbackEnabled: settings.echoFeedbackEnabled,
    resolveDelayMultiplier: settings.resolveDelayMultiplier,
    shuffleScoreTaxEnabled: settings.shuffleScoreTaxEnabled,
    weakerShuffleMode: settings.weakerShuffleMode
});

export const createRunStartCommand = (input: {
    bestScore: number;
    activeContractOverride?: ContractFlags | null;
    commandId: string;
    metaRelicDraftExtraPerMilestone: number;
    observedAtMs: number;
    onboardingDismissed: boolean;
    proposedRunSeed: number;
    reason: RunStartCommand['reason'];
    request: RunStartRequest;
    runRulesVersion?: number;
    settings: RunStartGameplaySettings;
    startingLoadoutId?: StartingLoadoutId | null;
}): RunStartCommand => {
    const runRulesVersion = input.runRulesVersion ?? GAME_RULES_VERSION;
    return runStartCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId: input.commandId,
        type: 'run.start',
        reason: input.reason,
        request: input.request,
        observedAtMs: input.observedAtMs,
        runSeed: canonicalRunStartSeed(
            input.request,
            input.observedAtMs,
            runRulesVersion,
            input.proposedRunSeed
        ),
        runRulesVersion,
        bestScore: input.bestScore,
        onboardingDismissed: input.onboardingDismissed,
        metaRelicDraftExtraPerMilestone: input.metaRelicDraftExtraPerMilestone,
        startingLoadoutId: input.startingLoadoutId ?? null,
        activeContractOverride: input.activeContractOverride ?? null,
        settings: input.settings
    });
};

export const createRestartRunSelection = (previousRun: RunState | null): RunRestartSelection => {
    const startingLoadoutId = previousRun?.startingLoadoutId ?? null;
    if (previousRun?.dungeonShowcaseRun || previousRun?.lastRunSummary?.dungeonShowcaseRun) {
        return { activeContractOverride: null, request: { kind: 'dungeonShowcase' }, startingLoadoutId: null };
    }
    if (previousRun?.gameMode === 'daily') {
        return { activeContractOverride: null, request: { kind: 'daily' }, startingLoadoutId: null };
    }
    if (previousRun?.gameMode === 'gauntlet') {
        return {
            activeContractOverride: null,
            request: { durationMs: previousRun.gauntletSessionDurationMs ?? 10 * 60 * 1000, kind: 'gauntlet' },
            startingLoadoutId: null
        };
    }
    if (previousRun?.gameMode === 'puzzle' && previousRun.puzzleId) {
        return {
            activeContractOverride: null,
            request: { kind: 'puzzle', puzzleId: previousRun.puzzleId },
            startingLoadoutId: null
        };
    }
    if (previousRun?.gameMode === 'meditation') {
        return previousRun.activeMutators.length > 0
            ? {
                  activeContractOverride: null,
                  request: {
                      kind: 'meditationWithMutators',
                      mutators: [...previousRun.activeMutators]
                  },
                  startingLoadoutId: null
              }
            : { activeContractOverride: null, request: { kind: 'meditation' }, startingLoadoutId: null };
    }
    if (previousRun?.activeContract?.maxPinsTotalRun != null) {
        return {
            activeContractOverride: previousRun.activeContract,
            request: { kind: 'pinVow' },
            startingLoadoutId
        };
    }
    if (previousRun?.wildMenuRun) {
        return { activeContractOverride: null, request: { kind: 'wild' }, startingLoadoutId: null };
    }
    if (previousRun?.practiceMode) {
        return { activeContractOverride: null, request: { kind: 'practice' }, startingLoadoutId };
    }
    if (previousRun?.activeContract?.noShuffle && previousRun.activeContract.noDestroy) {
        return {
            activeContractOverride: previousRun.activeContract,
            request: { kind: 'scholarContract' },
            startingLoadoutId
        };
    }
    return { activeContractOverride: null, request: { kind: 'endless' }, startingLoadoutId };
};
