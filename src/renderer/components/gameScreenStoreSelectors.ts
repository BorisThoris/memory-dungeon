import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';

/** Board stage + graphics toggles used by `TileBoard` / presentation chrome — one subscription to limit rerenders. */
export const useGameScreenBoardVisualSettings = () =>
    useAppStore(
        useShallow((state) => ({
            boardBloomEnabled: state.settings.boardBloomEnabled,
            boardPresentation: state.settings.boardPresentation,
            boardScreenSpaceAA: state.settings.boardScreenSpaceAA,
            cameraViewportModePreference: state.settings.cameraViewportModePreference,
            dailyMusicEnabled: state.settings.dailyMusicEnabled,
            distractionChannelEnabled: state.settings.distractionChannelEnabled,
            graphicsQuality: state.settings.graphicsQuality,
            pairProximityHintsEnabled: state.settings.pairProximityHintsEnabled,
            tileFocusAssist: state.settings.tileFocusAssist,
            debugAllowBoardReveal: state.settings.debugFlags.allowBoardReveal,
            debugDisableAchievementsOnDebug: state.settings.debugFlags.disableAchievementsOnDebug,
            debugShowDebugTools: state.settings.debugFlags.showDebugTools
        }))
    );
