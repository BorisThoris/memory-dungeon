import type { RunState, Settings } from './contracts';

export const applyRunSettings = (run: RunState, settings: Settings): RunState => ({
    ...run,
    weakerShuffleMode: settings.weakerShuffleMode,
    shuffleScoreTaxActive: settings.shuffleScoreTaxEnabled,
    resolveDelayMultiplier: settings.resolveDelayMultiplier,
    echoFeedbackEnabled: settings.echoFeedbackEnabled
});
