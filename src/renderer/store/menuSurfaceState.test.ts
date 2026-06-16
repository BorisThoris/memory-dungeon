import { describe, expect, it } from 'vitest';
import { createMenuSurfacePatch } from './menuSurfaceState';

describe('menuSurfaceState', () => {
    it('clears run state, return pointers, achievements, and armed run surface flags', () => {
        expect(createMenuSurfacePatch()).toMatchObject({
            achievementBridgeNotice: null,
            boardPinMode: false,
            destroyPairArmed: false,
            dungeonExitPromptOpen: false,
            matchScorePop: null,
            mismatchScorePop: null,
            newlyUnlockedAchievements: [],
            peekModeArmed: false,
            run: null,
            runStartSaveData: null,
            settingsReturnView: 'menu',
            shopReturnMode: null,
            subscreenReturnView: 'menu',
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            view: 'menu'
        });
    });
});
