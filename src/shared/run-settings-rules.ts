import type { RunState, Settings } from './contracts';

export const applyRunSettings = (run: RunState, settings: Settings): RunState => ({
    ...run,
    weakerShuffleMode: settings.weakerShuffleMode,
    shuffleScoreTaxActive: settings.shuffleScoreTaxEnabled,
    // A calm solo setup (including its restart) owns its pace. Global settings are the fallback.
    resolveDelayMultiplier: run.resolveDelayMultiplier > 1 ? run.resolveDelayMultiplier : settings.resolveDelayMultiplier,
    echoFeedbackEnabled: settings.echoFeedbackEnabled
});
