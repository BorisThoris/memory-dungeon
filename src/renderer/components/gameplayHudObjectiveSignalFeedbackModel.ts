type HudObjectiveSignalTone = 'objective' | 'progress' | 'reward' | 'risk';
type HudObjectiveSignalAction = 'Build favor' | 'Cash wager' | 'Chase target' | 'Protect streak';
type HudObjectiveSignalAudioCue = 'objective-favor' | 'objective-risk' | 'objective-target' | 'objective-wager';
type HudObjectiveSignalScreenCue = 'burst' | 'guard' | 'pulse' | 'snap' | 'tick';

type HudObjectiveSignalBaseRow = { id: string; label: string; tone: HudObjectiveSignalTone; value: string };

export type HudObjectiveSignalRowModel = HudObjectiveSignalBaseRow & {
    action: HudObjectiveSignalAction;
    audioCue: HudObjectiveSignalAudioCue;
    beatCount: 2 | 3 | 4;
    screenCue: HudObjectiveSignalScreenCue;
};

export type HudObjectiveSignalFeedbackModel = {
    label: string;
    rows: HudObjectiveSignalRowModel[];
};

const getHudObjectiveSignals = ({
    activeRiskWagerFavor,
    featuredObjectiveLabel,
    relicFavorProgress,
    riskWagerActive,
    streakAtRisk
}: {
    activeRiskWagerFavor: number;
    featuredObjectiveLabel: string | null;
    relicFavorProgress: number;
    riskWagerActive: boolean;
    streakAtRisk: number;
}): HudObjectiveSignalBaseRow[] => {
    const rows: HudObjectiveSignalBaseRow[] = [];
    if (featuredObjectiveLabel) {
        rows.push({ id: 'objective', label: 'Target', tone: 'objective', value: featuredObjectiveLabel });
    }
    rows.push({ id: 'favor', label: 'Favor', tone: 'progress', value: `${relicFavorProgress}/3` });
    if (riskWagerActive) {
        rows.push({ id: 'wager', label: 'Wager', tone: 'reward', value: `+${activeRiskWagerFavor} Favor` });
        rows.push({ id: 'risk', label: 'Risk', tone: 'risk', value: `x${streakAtRisk}` });
    }
    return rows.slice(0, 4);
};

const getHudObjectiveSignalBeatCount = (row: HudObjectiveSignalBaseRow): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk') {
        const riskValue = Number(row.value.replace(/^x/i, ''));
        return riskValue >= 4 ? 3 : 2;
    }
    if (row.tone === 'progress') {
        const [current, total] = row.value.split('/').map((value) => Number(value));
        return total > 0 && current >= total ? 4 : 3;
    }
    return 3;
};

const getHudObjectiveSignalAction = (row: HudObjectiveSignalBaseRow): HudObjectiveSignalAction => {
    if (row.tone === 'reward') {
        return 'Cash wager';
    }
    if (row.tone === 'risk') {
        return 'Protect streak';
    }
    if (row.tone === 'progress') {
        return 'Build favor';
    }
    return 'Chase target';
};

const getHudObjectiveSignalAudioCue = (row: HudObjectiveSignalBaseRow): HudObjectiveSignalAudioCue => {
    if (row.tone === 'reward') {
        return 'objective-wager';
    }
    if (row.tone === 'risk') {
        return 'objective-risk';
    }
    if (row.tone === 'progress') {
        return 'objective-favor';
    }
    return 'objective-target';
};

const getHudObjectiveSignalScreenCue = (row: HudObjectiveSignalBaseRow): HudObjectiveSignalScreenCue => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'guard';
    }
    if (row.tone === 'progress') {
        return row.value.startsWith('3/') ? 'snap' : 'pulse';
    }
    return 'tick';
};

const decorateHudObjectiveSignalRow = (row: HudObjectiveSignalBaseRow): HudObjectiveSignalRowModel => ({
    ...row,
    action: getHudObjectiveSignalAction(row),
    audioCue: getHudObjectiveSignalAudioCue(row),
    beatCount: getHudObjectiveSignalBeatCount(row),
    screenCue: getHudObjectiveSignalScreenCue(row)
});

export const buildHudObjectiveSignalFeedbackModel = ({
    activeRiskWagerFavor,
    featuredObjectiveLabel,
    relicFavorProgress,
    riskWagerActive,
    streakAtRisk
}: {
    activeRiskWagerFavor: number;
    featuredObjectiveLabel: string | null;
    relicFavorProgress: number;
    riskWagerActive: boolean;
    streakAtRisk: number;
}): HudObjectiveSignalFeedbackModel => {
    const rows = getHudObjectiveSignals({
        activeRiskWagerFavor,
        featuredObjectiveLabel,
        relicFavorProgress,
        riskWagerActive,
        streakAtRisk
    }).map(decorateHudObjectiveSignalRow);
    const rowCopy = rows.map((row) => `${row.label}: ${row.value}`).join('. ');

    return {
        label: rowCopy ? `Objective reward signals. ${rowCopy}.` : 'Objective reward signals',
        rows
    };
};
