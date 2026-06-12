import type { AchievementId, RunState, SaveData, SubscreenReturnView, ViewState } from '../../shared/contracts';
import { createRunSurfaceReset, type RunSurfaceState } from './runSurfaceState';

export interface MenuSurfacePatch extends RunSurfaceState {
    achievementBridgeNotice: string | null;
    newlyUnlockedAchievements: AchievementId[];
    run: RunState | null;
    runStartSaveData: SaveData | null;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

export const createMenuSurfacePatch = (): MenuSurfacePatch => ({
    achievementBridgeNotice: null,
    newlyUnlockedAchievements: [],
    run: null,
    runStartSaveData: null,
    settingsReturnView: 'menu',
    subscreenReturnView: 'menu',
    view: 'menu',
    ...createRunSurfaceReset()
});
