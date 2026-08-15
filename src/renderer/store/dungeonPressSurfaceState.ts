import type { RunState } from '../../shared/contracts';
import {
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY
} from '../../shared/dungeon-rules';
import { applyTileFlipThroughGameplayCore } from '../../shared/gameplay-core-adapters';

type DungeonTilePressSurfaceResult =
    | { kind: 'notDungeonTile' }
    | { kind: 'ignored' }
    | {
          kind: 'exitPrompt';
          run: RunState;
          playFlipSfx: boolean;
      }
    | {
          kind: 'shop';
          run: RunState;
          playFlipSfx: boolean;
      }
    | {
          kind: 'room';
          run: RunState;
          playFlipSfx: boolean;
      };

export const createDungeonTilePressSurfaceResult = ({
    pairKey,
    run,
    tileId
}: {
    pairKey: string | null | undefined;
    run: RunState;
    tileId: string;
}): DungeonTilePressSurfaceResult => {
    if (pairKey === EXIT_PAIR_KEY) {
        const transition = applyTileFlipThroughGameplayCore(run, tileId);
        return {
            kind: 'exitPrompt',
            run: transition.run,
            playFlipSfx: transition.accepted
        };
    }

    if (pairKey === SHOP_PAIR_KEY) {
        const transition = applyTileFlipThroughGameplayCore(run, tileId);
        return !transition.accepted || transition.run.shopOffers.length === 0
            ? { kind: 'ignored' }
            : {
                  kind: 'shop',
                  run: transition.run,
                  playFlipSfx: true
              };
    }

    if (pairKey === ROOM_PAIR_KEY) {
        const transition = applyTileFlipThroughGameplayCore(run, tileId);
        return !transition.accepted
            ? { kind: 'ignored' }
            : {
                  kind: 'room',
                  run: transition.run,
                  playFlipSfx: true
              };
    }

    return { kind: 'notDungeonTile' };
};
