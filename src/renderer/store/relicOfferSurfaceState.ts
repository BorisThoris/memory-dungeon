import type { RelicId, RelicOfferServiceId, RunState, SaveData, Settings } from '../../shared/contracts';
import {
    createGameplayRelicOfferServiceCommand,
    createGameplayRelicPickCommand
} from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import { advanceFloorThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
import { mergeRelicPickStat, normalizeSaveData } from '../../shared/save-data';
import { clearRunSurfaceArmedModes, type RunSurfaceState } from './runSurfaceState';
import {
    getNewGameplayFeedback,
    type GameplayFeedbackPresentation
} from './gameplayFeedbackAdapter';

type RelicPickSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'accepted';
          feedback: GameplayFeedbackPresentation | null;
          nextSave: SaveData;
          patch: Pick<
              RunSurfaceState,
              'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
          > & {
              run: RunState;
              saveData: SaveData;
              settings: Settings;
          };
      };

type RelicOfferServiceSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          feedback: GameplayFeedbackPresentation | null;
          patch: { run: RunState };
      };

export const createRelicPickSurfaceResult = ({
    relicId,
    run,
    saveData
}: {
    relicId: RelicId;
    run: RunState | null;
    saveData: SaveData;
}): RelicPickSurfaceResult => {
    if (!run?.relicOffer?.options.includes(relicId)) {
        return { kind: 'ignored' };
    }

    const offer = run.relicOffer;
    const command = createGameplayRelicPickCommand(
        `relic-pick:${run.runSeed}:${offer.tier}:${offer.pickRound}:${relicId}`,
        relicId
    );
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        return { kind: 'ignored' };
    }
    const pickEvent = result.events.find((event) => event.type === 'relic.picked');
    if (!pickEvent) {
        return { kind: 'ignored' };
    }
    const journaledRun = appendGameplayJournal(result.run, [command], result.events);
    const floorAdvance = pickEvent.outcome === 'advance_ready'
        ? advanceFloorThroughGameplayCore(
              journaledRun,
              `floor-advance:${journaledRun.runSeed}:${(journaledRun.board?.level ?? 0) + 1}`
          )
        : null;
    const nextRun = floorAdvance?.accepted ? floorAdvance.run : journaledRun;

    const nextSave = mergeHonorUnlockTags(normalizeSaveData(mergeRelicPickStat(saveData, relicId)));

    return {
        kind: 'accepted',
        feedback: getNewGameplayFeedback(run, nextRun).find((item) => item.audioCategory === 'relic-pick') ?? null,
        nextSave,
        patch: {
            run: nextRun,
            saveData: nextSave,
            settings: nextSave.settings,
            ...clearRunSurfaceArmedModes()
        }
    };
};

export const createRelicOfferServiceSurfaceResult = ({
    run,
    serviceId,
    targetRelicId
}: {
    run: RunState | null;
    serviceId: RelicOfferServiceId;
    targetRelicId?: RelicId;
}): RelicOfferServiceSurfaceResult => {
    if (!run?.relicOffer) {
        return { kind: 'ignored' };
    }

    const offer = run.relicOffer;
    const command = createGameplayRelicOfferServiceCommand(
        `relic-service:${run.runSeed}:${offer.tier}:${offer.pickRound}:${serviceId}:${targetRelicId ?? 'auto'}`,
        serviceId,
        targetRelicId
    );
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        return { kind: 'ignored' };
    }
    const journaledRun = appendGameplayJournal(result.run, [command], result.events);

    return {
        kind: 'applied',
        feedback: getNewGameplayFeedback(run, journaledRun).find((item) => item.audioCategory === 'relic-service') ?? null,
        patch: {
            run: journaledRun
        }
    };
};
