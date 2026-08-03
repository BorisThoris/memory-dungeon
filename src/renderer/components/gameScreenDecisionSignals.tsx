/* eslint-disable react-refresh/only-export-components -- Decision rows and their two tiny renderers intentionally share one typed presentation contract. */
import type {
    RouteCardKind,
    RouteSpecialKind,
    RunState
} from '../../shared/contracts';
import type { DungeonExitStatus } from '../../shared/dungeon-rules';
import type { OnboardingStepId } from '../../shared/playable-onboarding';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import styles from './GameScreen.module.css';

/** PLAY-009: pair-index rings on face-down DOM tiles only for very early floors + until FTUE flag clears after tutorial floors. */
export const TUTORIAL_PAIR_MARKER_MAX_LEVEL = 2;

export const routeTypeLabel = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): string => {
    switch (routeType) {
        case 'safe':
            return 'Safe route';
        case 'greed':
            return 'Greedy route';
        case 'mystery':
        default:
            return 'Mystery route';
    }
};

export const routeSpecialDisplayLabel = (kind: RouteSpecialKind | RouteCardKind): string =>
    routeSpecialLabel(kind as RouteSpecialKind);

export const routeSpecialDisplayRewardLine = (kind: RouteSpecialKind | RouteCardKind): string =>
    `Match the ${routeSpecialLabel(kind as RouteSpecialKind)} pair for ${routeSpecialRewardLine(kind as RouteSpecialKind)}.`;

type RouteSpecialSignalRow = {
    label: string;
    tone: 'build' | 'control' | 'risk' | 'reward' | 'safety';
    value: string;
};

export const routeSpecialSignalRows = (
    kind: RouteSpecialKind | RouteCardKind
): RouteSpecialSignalRow[] => {
    switch (kind) {
        case 'safe_ward':
        case 'guard_cache':
        case 'final_ward':
        case 'lantern_ward':
            return [
                { label: 'Role', value: 'Protection', tone: 'safety' },
                { label: 'Payoff', value: 'Guard bank', tone: 'safety' },
                { label: 'Play', value: 'Match before exit', tone: 'control' }
            ];
        case 'greed_cache':
        case 'elite_cache':
        case 'greed_toll':
        case 'fragile_cache':
            return [
                { label: 'Role', value: 'Payout', tone: 'reward' },
                { label: 'Payoff', value: 'Gold score', tone: 'reward' },
                { label: 'Risk', value: 'Lost if destroyed', tone: 'risk' }
            ];
        case 'mimic_cache':
            return [
                { label: 'Role', value: 'Trap loot', tone: 'risk' },
                { label: 'Payoff', value: 'Scout first', tone: 'control' },
                { label: 'Risk', value: 'Blind bite', tone: 'risk' }
            ];
        case 'mystery_veil':
        case 'loaded_gateway':
        case 'secret_door':
            return [
                { label: 'Role', value: 'Discovery', tone: 'build' },
                { label: 'Payoff', value: 'Route value', tone: 'reward' },
                { label: 'Play', value: 'Reveal safely', tone: 'control' }
            ];
        case 'anchor_seal':
        case 'pin_lattice':
            return [
                { label: 'Role', value: 'Board control', tone: 'control' },
                { label: 'Payoff', value: 'Prime turn', tone: 'build' },
                { label: 'Play', value: 'Plan the pair', tone: 'control' }
            ];
        case 'catalyst_altar':
        case 'omen_seal':
            return [
                { label: 'Role', value: 'Combo fuel', tone: 'build' },
                { label: 'Payoff', value: 'Shard spike', tone: 'reward' },
                { label: 'Play', value: 'Chain into it', tone: 'build' }
            ];
        case 'parasite_vessel':
            return [
                { label: 'Role', value: 'Pressure cashout', tone: 'risk' },
                { label: 'Payoff', value: 'Favor swing', tone: 'reward' },
                { label: 'Play', value: 'Use pressure', tone: 'control' }
            ];
        case 'keystone_pair':
            return [
                { label: 'Role', value: 'Boss payoff', tone: 'reward' },
                { label: 'Payoff', value: 'Favor score', tone: 'reward' },
                { label: 'Play', value: 'Secure route', tone: 'control' }
            ];
        default:
            return [
                { label: 'Role', value: 'Special pair', tone: 'build' },
                { label: 'Payoff', value: 'Match reward', tone: 'reward' },
                { label: 'Play', value: 'Find both cards', tone: 'control' }
            ];
    }
};

export const getRouteSpecialSignalBeatCount = (row: RouteSpecialSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'build') {
        return 3;
    }
    return 2;
};

export const getRouteSpecialSignalAudioCue = (
    row: RouteSpecialSignalRow
): 'route-card-reward' | 'route-card-risk' | 'route-card-build' | 'route-card-guard' | 'route-card-control' => {
    if (row.tone === 'reward') {
        return 'route-card-reward';
    }
    if (row.tone === 'risk') {
        return 'route-card-risk';
    }
    if (row.tone === 'build') {
        return 'route-card-build';
    }
    if (row.tone === 'safety') {
        return 'route-card-guard';
    }
    return 'route-card-control';
};

export const getRouteSpecialSignalScreenCue = (
    row: RouteSpecialSignalRow
): 'burst' | 'risk' | 'build' | 'guard' | 'control' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'risk';
    }
    if (row.tone === 'build') {
        return 'build';
    }
    if (row.tone === 'safety') {
        return 'guard';
    }
    return 'control';
};

export const routeCardKindForRouteType = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): RouteCardKind =>
    routeType === 'safe' ? 'safe_ward' : routeType === 'greed' ? 'greed_cache' : 'mystery_veil';

const dungeonExitLockLabel = (lockKind: DungeonExitStatus['lockKind']): string => {
    if (lockKind === 'none') {
        return 'Unlocked exit';
    }
    if (lockKind === 'lever') {
        return 'Lever-sealed exit';
    }
    return `${lockKind.charAt(0).toUpperCase()}${lockKind.slice(1)} key exit`;
};

export const dungeonExitPromptTitle = (status: DungeonExitStatus): string =>
    status.keyFallbackPending ? 'Key fallback pending' : dungeonExitLockLabel(status.lockKind);

export const dungeonExitPromptLockLine = (status: DungeonExitStatus, run: RunState): string => {
    if (status.keyFallbackPending) {
        return 'No key source remains; clear the remaining pairs to force this exit open.';
    }
    if (status.lockKind === 'lever') {
        return `${status.leverCount}/${status.requiredLeverCount} floor levers ready.`;
    }
    if (status.lockKind === 'none') {
        return 'No key required.';
    }
    return `Keys: ${run.dungeonKeys[status.lockKind] ?? 0} matching, ${run.dungeonMasterKeys} master.`;
};

export const getClearLifeBonusLabel = (result: NonNullable<RunState['lastLevelResult']>): string | null => {
    if (result.clearLifeGained !== 1) {
        return null;
    }

    if (result.clearLifeReason === 'perfect') {
        return 'Perfect floor bonus: +1 Life';
    }

    if (result.clearLifeReason === 'clean') {
        return 'Clean floor bonus: +1 Life';
    }

    return null;
};

export const FLOOR_CLEAR_LIFE_CARRYOVER_NOTE =
    'Lives carry across the run. Clean clears, safe routes, shops, rests, and shrines can restore them.';

export const getFirstRouteChoiceTeachingLabel = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): string => {
    if (routeType === 'safe') {
        return 'Recommended first route';
    }
    if (routeType === 'greed') {
        return 'High reward, higher danger';
    }
    return 'Changes the next board';
};

type OnboardingPromptSignalTone = 'action' | 'chain' | 'recovery' | 'reward' | 'route';
type OnboardingPromptSignalRow = { label: string; tone: OnboardingPromptSignalTone; value: string };

export const getOnboardingPromptSignalBeatCount = (row: OnboardingPromptSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'route') {
        return 4;
    }
    if (row.tone === 'chain' || row.tone === 'recovery') {
        return 3;
    }
    return 2;
};

export const getOnboardingPromptSignalAudioCue = (
    row: OnboardingPromptSignalRow
): 'onboarding-action' | 'onboarding-chain' | 'onboarding-recovery' | 'onboarding-reward' | 'onboarding-route' => {
    if (row.tone === 'reward') {
        return 'onboarding-reward';
    }
    if (row.tone === 'route') {
        return 'onboarding-route';
    }
    if (row.tone === 'chain') {
        return 'onboarding-chain';
    }
    if (row.tone === 'recovery') {
        return 'onboarding-recovery';
    }
    return 'onboarding-action';
};

export const getOnboardingPromptSignalScreenCue = (
    row: OnboardingPromptSignalRow
): 'action' | 'burst' | 'chain' | 'recover' | 'route' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'route') {
        return 'route';
    }
    if (row.tone === 'chain') {
        return 'chain';
    }
    if (row.tone === 'recovery') {
        return 'recover';
    }
    return 'action';
};

export const getOnboardingPromptSignals = (id: OnboardingStepId | 'room_goal'): OnboardingPromptSignalRow[] => {
    if (id === 'first_match') {
        return [
            { label: 'Action', value: 'Flip pair', tone: 'action' },
            { label: 'Reward', value: 'Score pop', tone: 'reward' },
            { label: 'Chain', value: 'Start streak', tone: 'chain' }
        ];
    }
    if (id === 'recovery') {
        return [
            { label: 'Recovery', value: 'Rebuild', tone: 'recovery' },
            { label: 'Chain', value: 'Keep clean', tone: 'chain' },
            { label: 'Tools', value: 'Save rescues', tone: 'action' }
        ];
    }
    return [
        { label: 'Goal', value: 'Clear pairs', tone: 'action' },
        { label: 'Reward', value: 'Route choice', tone: 'route' },
        { label: 'Chain', value: 'Clean finish', tone: 'chain' }
    ];
};

export const GAMBIT_SIGNAL_ROWS = [
    { label: 'Window', value: 'Third flip' },
    { label: 'Payoff', value: 'Recover pair' },
    { label: 'Cost', value: 'No perfect' }
] as const;

export const getGambitSignalBeatCount = (signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']): 2 | 3 | 4 => {
    if (signal === 'Payoff') {
        return 4;
    }
    if (signal === 'Cost') {
        return 3;
    }
    return 2;
};

export const getGambitSignalAudioCue = (
    signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']
): 'gambit-window' | 'gambit-payoff' | 'gambit-cost' => {
    if (signal === 'Payoff') {
        return 'gambit-payoff';
    }
    if (signal === 'Cost') {
        return 'gambit-cost';
    }
    return 'gambit-window';
};

export const getGambitSignalScreenCue = (signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']): 'window' | 'burst' | 'risk' => {
    if (signal === 'Payoff') {
        return 'burst';
    }
    if (signal === 'Cost') {
        return 'risk';
    }
    return 'window';
};

export const formatGameplaySignalRowsLabel = (
    label: string,
    rows: readonly { label: string; value: string }[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}: ${row.value}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

export const formatGameplayDetailRowsLabel = (
    label: string,
    rows: readonly { detail?: string | null; label: string; value?: string }[]
): string => {
    const rowCopy = rows
        .map((row) => `${row.label}${row.value ? `: ${row.value}` : ''}${row.detail ? ` - ${row.detail}` : ''}`)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

export const GAMBIT_SIGNAL_ROWS_LABEL = formatGameplaySignalRowsLabel('Gambit opportunity signals', GAMBIT_SIGNAL_ROWS);

type RiskWagerSignalTone = 'armed' | 'objective' | 'reward' | 'risk';
type RiskWagerSignalRow = { label: string; tone: RiskWagerSignalTone; value: string };
type RiskWagerPrimaryCue = {
    action: 'Arm wager' | 'Protect streak';
    beatCount: 3 | 4;
    label: 'Wager available' | 'Wager armed';
    payoff: string;
    risk: string;
    tone: 'armed' | 'offer';
};

export const getRiskWagerSignalBeatCount = (row: RiskWagerSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'armed') {
        return 3;
    }
    return 2;
};

export const getRiskWagerSignalAudioCue = (
    row: RiskWagerSignalRow
): 'risk-wager-signal-armed' | 'risk-wager-signal-objective' | 'risk-wager-signal-reward' | 'risk-wager-signal-risk' => {
    if (row.tone === 'armed') {
        return 'risk-wager-signal-armed';
    }
    if (row.tone === 'reward') {
        return 'risk-wager-signal-reward';
    }
    if (row.tone === 'risk') {
        return 'risk-wager-signal-risk';
    }
    return 'risk-wager-signal-objective';
};

export const getRiskWagerSignalScreenCue = (row: RiskWagerSignalRow): 'armed' | 'burst' | 'risk' | 'objective' => {
    if (row.tone === 'armed') {
        return 'armed';
    }
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'risk';
    }
    return 'objective';
};

export const getRiskWagerSignalRows = ({
    armed,
    bonusFavor,
    streakAtRisk
}: {
    armed: boolean;
    bonusFavor: number;
    streakAtRisk: number;
}): RiskWagerSignalRow[] => [
    { label: armed ? 'Armed' : 'Stake', value: `x${streakAtRisk} streak`, tone: armed ? 'armed' : 'risk' },
    { label: 'Payoff', value: `+${bonusFavor} Favor`, tone: 'reward' },
    { label: 'Trigger', value: 'Next objective', tone: 'objective' }
];

export const getRiskWagerPrimaryCue = ({
    armed,
    bonusFavor,
    streakAtRisk
}: {
    armed: boolean;
    bonusFavor: number;
    streakAtRisk: number;
}): RiskWagerPrimaryCue => ({
    action: armed ? 'Protect streak' : 'Arm wager',
    beatCount: armed ? 4 : 3,
    label: armed ? 'Wager armed' : 'Wager available',
    payoff: `+${bonusFavor} Favor`,
    risk: `x${streakAtRisk} streak`,
    tone: armed ? 'armed' : 'offer'
});

const getRiskWagerPrimaryAudioCue = (cue: RiskWagerPrimaryCue): 'risk-wager-armed' | 'risk-wager-offer' =>
    cue.tone === 'armed' ? 'risk-wager-armed' : 'risk-wager-offer';

const getRiskWagerPrimaryScreenCue = (cue: RiskWagerPrimaryCue): 'burst' | 'risk' =>
    cue.tone === 'armed' ? 'burst' : 'risk';

export const RiskWagerPrimaryCueView = ({ cue }: { cue: RiskWagerPrimaryCue }) => (
    <span
        aria-label={`${cue.label}. ${cue.action}. Payoff ${cue.payoff}. Risk ${cue.risk}. ${cue.beatCount} beats.`}
        className={styles.endlessRiskWagerPrimaryCue}
        data-risk-wager-primary-action={cue.action}
        data-risk-wager-primary-audio={getRiskWagerPrimaryAudioCue(cue)}
        data-risk-wager-primary-beats={cue.beatCount}
        data-risk-wager-primary-payoff={cue.payoff}
        data-risk-wager-primary-risk={cue.risk}
        data-risk-wager-primary-screen-cue={getRiskWagerPrimaryScreenCue(cue)}
        data-risk-wager-primary-tone={cue.tone}
        data-testid="endless-risk-wager-primary-cue"
    >
        <small>{cue.label}</small>
        <b>{cue.action}</b>
        <em>{cue.payoff}</em>
        <strong>{cue.risk}</strong>
        <span aria-hidden="true" className={styles.endlessRiskWagerPrimaryBeatPips}>
            {Array.from({ length: cue.beatCount }, (_, index) => (
                <i
                    data-risk-wager-primary-beat={index + 1}
                    data-risk-wager-primary-beat-focus={index === 0 ? 'primary' : 'support'}
                    key={index}
                />
            ))}
        </span>
    </span>
);

export const RiskWagerSignalRowsView = ({
    label,
    rows
}: {
    label: string;
    rows: readonly RiskWagerSignalRow[];
}) => (
    <div className={styles.endlessRiskWagerSignals} data-testid="endless-risk-wager-signals" aria-label={label}>
        {rows.map((row) => {
            const beatCount = getRiskWagerSignalBeatCount(row);
            return (
                <span
                    data-risk-wager-signal-audio={getRiskWagerSignalAudioCue(row)}
                    data-risk-wager-signal-beats={beatCount}
                    data-risk-wager-signal-screen-cue={getRiskWagerSignalScreenCue(row)}
                    data-risk-wager-signal-tone={row.tone}
                    key={`${row.label}:${row.value}`}
                >
                    <small>{row.label}</small>
                    <b>{row.value}</b>
                    <span aria-hidden="true" className={styles.endlessRiskWagerBeatPips}>
                        {Array.from({ length: beatCount }, (_, index) => (
                            <i data-risk-wager-signal-beat={index + 1} data-risk-wager-signal-beat-focus={index === 0 ? 'primary' : 'support'} key={index} />
                        ))}
                    </span>
                </span>
            );
        })}
    </div>
);
