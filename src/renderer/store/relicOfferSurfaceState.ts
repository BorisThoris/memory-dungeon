import type { RelicId, RelicOfferServiceId, RunState, SaveData, Settings } from '../../shared/contracts';
import { applyRelicOfferServiceToRun, completeRelicPickAndAdvance } from '../../shared/objective-rules';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
import { mergeRelicPickStat, normalizeSaveData } from '../../shared/save-data';
import { clearRunSurfaceArmedModes, type RunSurfaceState } from './runSurfaceState';

type RelicPickSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'accepted';
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

    const nextRun = completeRelicPickAndAdvance(run, relicId);
    if (nextRun === run) {
        return { kind: 'ignored' };
    }

    const nextSave = mergeHonorUnlockTags(normalizeSaveData(mergeRelicPickStat(saveData, relicId)));

    return {
        kind: 'accepted',
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
