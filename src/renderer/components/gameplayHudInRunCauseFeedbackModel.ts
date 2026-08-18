import { type FeedbackCauseRow } from '../../shared/long-run-feedback';

type HudInRunCauseAction =
    | 'Bank reward'
    | 'Clear pressure'
    | 'Hold recall'
    | 'Protect run'
    | 'Push objective'
    | 'Push route'
    | 'Spend bank'
    | 'Stabilize hazard';

type HudInRunCauseAudioCue =
    | 'hud-cause-objective'
    | 'hud-cause-reward'
    | 'hud-cause-hazard'
    | 'hud-cause-pressure'
    | 'hud-cause-recall'
    | 'hud-cause-route'
    | 'hud-cause-guard'
    | 'hud-cause-bank';

type HudInRunCauseScreenCue = 'burst' | 'guard' | 'pressure' | 'route' | 'pulse';

export type HudInRunCauseRowModel = FeedbackCauseRow & {
    action: HudInRunCauseAction;
    ariaLabel: string;
    audioCue: HudInRunCauseAudioCue;
    beatCount: 2 | 3 | 4;
    primaryAriaLabel: string;
    screenCue: HudInRunCauseScreenCue;
};

export type HudInRunCauseFeedbackModel = {
    primaryRow: HudInRunCauseRowModel | null;
    rows: HudInRunCauseRowModel[];
};

const getHudInRunCauseAction = (row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>): HudInRunCauseAction => {
    if (row.kind === 'objective_progress') {
        return 'Push objective';
    }
    if (row.kind === 'match_reward') {
        return 'Bank reward';
    }
    if (row.kind === 'hazard_trigger') {
        return 'Stabilize hazard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure') {
        return 'Clear pressure';
    }
    if (row.kind === 'recall_feedback') {
        return 'Hold recall';
    }
    if (row.kind === 'route_reward') {
        return 'Push route';
    }
    if (row.kind === 'perfect_memory_locked') {
        return 'Protect run';
    }
    if (row.kind === 'economy_delta') {
        return 'Spend bank';
    }
    return row.tokens.includes('risk') || row.tokens.includes('cost') ? 'Protect run' : 'Push route';
};

const getHudInRunCauseBeatCount = (row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>): 2 | 3 | 4 => {
    if (
        row.kind === 'hazard_trigger' ||
        row.kind === 'combat_feedback' ||
        row.kind === 'boss_pressure' ||
        row.kind === 'perfect_memory_locked' ||
        row.tokens.includes('risk') ||
        row.tokens.includes('forfeit')
    ) {
        return 4;
    }
    if (
        row.kind === 'objective_progress' ||
        row.kind === 'match_reward' ||
        row.kind === 'recall_feedback' ||
        row.tokens.includes('reward') ||
        row.tokens.includes('momentum') ||
        row.tokens.includes('resolved')
    ) {
        return 3;
    }
    return 2;
};

const getHudInRunCauseAudioCue = (row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>): HudInRunCauseAudioCue => {
    if (row.kind === 'objective_progress') {
        return 'hud-cause-objective';
    }
    if (row.kind === 'match_reward') {
        return 'hud-cause-reward';
    }
    if (row.kind === 'hazard_trigger') {
        return 'hud-cause-hazard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure') {
        return 'hud-cause-pressure';
    }
    if (row.kind === 'recall_feedback') {
        return 'hud-cause-recall';
    }
    if (row.kind === 'route_reward') {
        return 'hud-cause-route';
    }
    if (row.kind === 'perfect_memory_locked' || row.tokens.includes('risk') || row.tokens.includes('cost')) {
        return 'hud-cause-guard';
    }
    return 'hud-cause-bank';
};

const getHudInRunCauseScreenCue = (row: Pick<FeedbackCauseRow, 'kind' | 'tokens'>): HudInRunCauseScreenCue => {
    if (row.kind === 'hazard_trigger' || row.kind === 'perfect_memory_locked' || row.tokens.includes('risk')) {
        return 'guard';
    }
    if (row.kind === 'combat_feedback' || row.kind === 'boss_pressure' || row.tokens.includes('cost')) {
        return 'pressure';
    }
    if (row.kind === 'objective_progress' || row.kind === 'match_reward' || row.tokens.includes('reward')) {
        return 'burst';
    }
    if (row.kind === 'route_reward') {
        return 'route';
    }
    return 'pulse';
};

const decorateHudInRunCauseRow = (row: FeedbackCauseRow): HudInRunCauseRowModel => {
    const action = getHudInRunCauseAction(row);
    const beatCount = getHudInRunCauseBeatCount(row);

    return {
        ...row,
        action,
        ariaLabel: `Run cause. ${row.label}. ${row.summary}. ${action}. ${beatCount} beats.`,
        audioCue: getHudInRunCauseAudioCue(row),
        beatCount,
        primaryAriaLabel: `Primary run cause. ${row.label}: ${row.summary}. ${action}. ${beatCount} beats.`,
        screenCue: getHudInRunCauseScreenCue(row)
    };
};

export const buildHudInRunCauseFeedbackModel = (
    rows: readonly FeedbackCauseRow[]
): HudInRunCauseFeedbackModel => {
    const decoratedRows = rows.map(decorateHudInRunCauseRow);
    const primaryRow = decoratedRows.reduce<HudInRunCauseRowModel | null>((primary, row) => {
        if (!primary || row.beatCount > primary.beatCount) {
            return row;
        }
        return primary;
    }, null);

    return {
        primaryRow,
        rows: decoratedRows
    };
};
