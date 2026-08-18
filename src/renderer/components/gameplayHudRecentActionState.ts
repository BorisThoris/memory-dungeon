import { formatHudActionFeedbackText, getHudActionFeedbackProfile } from '../copy/hudActionFeedback';
import { getVisualHudAnnouncementImpact } from './gameScreenFeedback';
import { buildHudRecentActionFeedbackModel } from './gameplayHudRecentActionFeedbackModel';

const sentenceWithPeriod = (text: string): string =>
    /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

export interface GameplayHudRecentActionState {
    compactHudAnnouncement: string;
    recentActionAriaLabel: string | undefined;
    recentActionFeedbackModel: ReturnType<typeof buildHudRecentActionFeedbackModel>;
    recentActionImpact: ReturnType<typeof getVisualHudAnnouncementImpact>;
    recentActionLabel: string;
    recentActionTone: 'info' | 'error' | 'reward' | 'chain' | 'trait';
}

export const buildGameplayHudRecentActionState = ({
    politeHudAnnouncement,
    politeHudAnnouncementPriority
}: {
    politeHudAnnouncement: string;
    politeHudAnnouncementPriority: 'info' | 'error';
}): GameplayHudRecentActionState => {
    const compactHudAnnouncement = politeHudAnnouncement
        ? formatHudActionFeedbackText(politeHudAnnouncement, { maxChars: 76, maxSentences: 1 })
        : '';
    const recentActionFeedback = compactHudAnnouncement
        ? getHudActionFeedbackProfile(politeHudAnnouncement, politeHudAnnouncementPriority)
        : null;
    const recentActionImpact = compactHudAnnouncement
        ? getVisualHudAnnouncementImpact(politeHudAnnouncement, politeHudAnnouncementPriority)
        : null;
    const recentActionFeedbackModel = buildHudRecentActionFeedbackModel(recentActionImpact);
    const recentActionLabel = recentActionFeedback?.label ?? 'Action result';
    const recentActionDetailsLabel =
        recentActionImpact?.details && recentActionImpact.details.length > 0
            ? ` Impact cue: ${recentActionFeedbackModel.impactCue ?? 'Payoff cue'}. Impact: ${recentActionImpact.details
                  .slice(0, 3)
                  .map((detail) => detail.label)
                  .join(', ')}.${
                  recentActionFeedbackModel.stackLabel ? ` Stack: ${recentActionFeedbackModel.stackLabel}.` : ''
              }${
                  recentActionFeedbackModel.laneMapLabel ? ` ${recentActionFeedbackModel.laneMapLabel}` : ''
              }${
                  recentActionFeedbackModel.stackSummary
                      ? ` ${recentActionFeedbackModel.stackSummary.label}: ${recentActionFeedbackModel.stackSummary.action}. ${recentActionFeedbackModel.stackSummary.value}. ${recentActionFeedbackModel.stackSummary.firstCue}. ${recentActionFeedbackModel.stackSummary.thenCue}. ${recentActionFeedbackModel.stackSummary.keepCue}.`
                      : ''
              }`
            : '';
    const recentActionAriaLabel = compactHudAnnouncement
        ? `${recentActionLabel}: ${sentenceWithPeriod(compactHudAnnouncement)}${recentActionDetailsLabel}`
        : undefined;

    return {
        compactHudAnnouncement,
        recentActionAriaLabel,
        recentActionFeedbackModel,
        recentActionImpact,
        recentActionLabel,
        recentActionTone: recentActionFeedback?.tone ?? politeHudAnnouncementPriority
    };
};
