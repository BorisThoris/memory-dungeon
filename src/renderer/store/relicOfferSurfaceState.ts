import type { RelicId, RelicOfferServiceId, RunState, SaveData, Settings } from '../../shared/contracts';
import { applyRelicOfferServiceToRun } from '../../shared/objective-rules';
import { createGameplayRelicPickCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import { advanceToNextLevel } from '../../shared/next-floor-transition-rules';
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
    const nextRun = pickEvent.outcome === 'advance_ready' ? advanceToNextLevel(journaledRun) : journaledRun;

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

    return {
        kind: 'applied',
        patch: {
            run: applyRelicOfferServiceToRun(run, serviceId, targetRelicId)
        }
    };
};
