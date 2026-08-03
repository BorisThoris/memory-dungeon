import type { RunState } from '../../shared/contracts';
import {
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY
} from '../../shared/dungeon-rules';
import { flipTile } from '../../shared/turn-resolution';

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
        const nextRun = flipTile(run, tileId);
        return {
            kind: 'exitPrompt',
            run: nextRun,
            playFlipSfx: nextRun !== run
        };
    }

    if (pairKey === SHOP_PAIR_KEY) {
        const nextRun = flipTile(run, tileId);
        return nextRun === run || nextRun.shopOffers.length === 0
            ? { kind: 'ignored' }
            : {
                  kind: 'shop',
                  run: nextRun,
                  playFlipSfx: true
              };
    }

    if (pairKey === ROOM_PAIR_KEY) {
        const nextRun = flipTile(run, tileId);
        return nextRun === run
            ? { kind: 'ignored' }
            : {
                  kind: 'room',
                  run: nextRun,
                  playFlipSfx: true
              };
    }

    return { kind: 'notDungeonTile' };
};
