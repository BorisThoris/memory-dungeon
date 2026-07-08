import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { rollRunEventRoom } from '../../shared/run-events';
import { createDefaultSaveData } from '../../shared/save-data';
import { useAppStore } from '../store/useAppStore';
import SideRoomScreen from './SideRoomScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playUiBackSfx: vi.fn(),
    playUiConfirmSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

vi.mock('../audio/uiSfx', () => uiSfxMocks);

const setupEventSideRoom = () => {
    const saveData = createDefaultSaveData();
    const run = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 47 });
    const event = rollRunEventRoom({ runSeed: run.runSeed, rulesVersion: run.runRulesVersion, floor: 2 });
    useAppStore.setState({
        hydrated: true,
        hydrating: false,
        view: 'sideRoom',
        saveData,
        settings: saveData.settings,
        run: {
            ...run,
            status: 'levelComplete',
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            stats: {
                ...run.stats,
                currentStreak: 4,
                bestStreak: 5,
                comboShards: 2,
                guardTokens: 1
            },
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType: 'mystery',
                nodeKind: 'event',
                floor: 2,
                title: event.title,
                body: event.body,
                primaryLabel: event.options[0]!.label,
                primaryDetail: event.options[0]!.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: index === 0
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: event.options[0]!.id }
            }
        }
    });
    return event;
};

describe('SideRoomScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAppStore.setState({ run: null, view: 'menu' });
    });

    it('renders every event choice as an action', () => {
        const event = setupEventSideRoom();

        render(<SideRoomScreen />);

        expect(screen.getByRole('dialog', { name: /route side room/i })).toBeInTheDocument();
        expect(screen.getByText(/Mystery route \/ Floor 2/)).toBeInTheDocument();
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Action');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Choose');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Payoff');
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="action"]')
        ).toHaveAttribute('data-primary-action-beats', '2');
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="action"]')
        ).toHaveAttribute('data-primary-action-audio', 'side-room-action');
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="action"]')
        ).toHaveAttribute('data-primary-action-screen-cue', 'pulse');
        expect(
            screen
                .getByTestId('side-room-primary-action-signals')
                .querySelector('[data-primary-action-tone="action"]')
                ?.querySelectorAll('[data-primary-action-beat]')
        ).toHaveLength(2);
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="route"]')
        ).toHaveAttribute('data-primary-action-beats', '3');
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="route"]')
        ).toHaveAttribute('data-primary-action-audio', 'side-room-route');
        expect(
            screen.getByTestId('side-room-primary-action-signals').querySelector('[data-primary-action-tone="route"]')
        ).toHaveAttribute('data-primary-action-screen-cue', 'route');
        expect(screen.getByTestId('side-room-board-moment')).toHaveTextContent('Board moment');
        expect(screen.getByTestId('side-room-board-moment')).toHaveTextContent('Choose next-floor leverage');
        expect(screen.getByTestId('side-room-board-moment')).toHaveAttribute('data-board-moment-tone', 'reward');
        const payoffEngine = screen.getByTestId('side-room-payoff-engine');
        expect(payoffEngine).toHaveAttribute('data-side-room-payoff-engine-tone', 'super');
        expect(payoffEngine).toHaveAttribute('data-side-room-payoff-engine-beats', '4');
        expect(payoffEngine).toHaveAttribute('data-side-room-payoff-engine-action', 'Push reward stack');
        expect(payoffEngine).toHaveAttribute('data-side-room-payoff-engine-audio', 'side-room-payoff-super');
        expect(payoffEngine).toHaveAttribute('data-side-room-payoff-engine-screen-cue', 'super');
        expect(payoffEngine).toHaveTextContent('Super stack');
        expect(payoffEngine).toHaveTextContent('4 payoffs live');
        expect(payoffEngine).toHaveTextContent('Chain + Pickup + Burst + Trait route');
        expect(payoffEngine).toHaveTextContent('Push x6 reward');
        expect(payoffEngine.querySelectorAll('[data-side-room-payoff-engine-beat]')).toHaveLength(4);
        expect(payoffEngine).toHaveAccessibleName(
            /Side room payoff engine.*Super stack: Push reward stack.*4 payoffs live.*Chain \+ Pickup \+ Burst \+ Trait route.*Push x6 reward/i
        );
        for (const choice of event.options) {
            expect(screen.getByRole('button', { name: new RegExp(`^${choice.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toBeInTheDocument();
            expect(screen.getAllByText(choice.detail).length).toBeGreaterThan(0);
        }
        const signaledChoice = event.options.find((choice) => /[+]|lose|spend|cost|pay|damage|risk/i.test(choice.detail));
        if (signaledChoice) {
            expect(screen.getByTestId(`side-room-choice-${signaledChoice.id}-impact`)).toBeInTheDocument();
            expect(screen.getByTestId(`side-room-choice-${signaledChoice.id}-heat`)).toBeInTheDocument();
            expect(screen.getByTestId(`side-room-choice-${signaledChoice.id}-signals`)).toBeInTheDocument();
            expect(screen.getByTestId(`side-room-choice-${signaledChoice.id}-payoffs`)).toBeInTheDocument();
        }
    });

    it('breaks bonus reward feedback into gained and capped pickup chips', () => {
        const saveData = createDefaultSaveData();
        const run = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 48 });
        useAppStore.setState({
            hydrated: true,
            hydrating: false,
            view: 'sideRoom',
            saveData,
            settings: saveData.settings,
            run: {
                ...run,
                status: 'levelComplete',
                sideRoom: {
                    id: 'bonus-feedback-test',
                    kind: 'bonus_reward',
                    routeType: 'greed',
                    nodeKind: 'treasure',
                    floor: 3,
                    title: 'Greed Bonus cache',
                    body: 'A capped cache still converts unused pickup value before the next floor.',
                    primaryLabel: 'Claim Bonus cache',
                    primaryDetail: '+1 guard token; +5 overflow score; Combo shards already full',
                    skipLabel: 'Leave it',
                    payload: { kind: 'bonus_reward', instanceId: 'missing' }
                }
            }
        });

        render(<SideRoomScreen />);

        const feedback = screen.getByTestId('side-room-reward-feedback');
        const burst = screen.getByTestId('side-room-reward-burst-strip');
        const actionSignals = screen.getByTestId('side-room-primary-action-signals');
        expect(screen.getByTestId('side-room-board-moment')).toHaveTextContent('Protect the next chain');
        expect(screen.getByTestId('side-room-board-moment')).toHaveAttribute('data-board-moment-tone', 'safety');
        expect(actionSignals).toHaveTextContent('Claim');
        expect(actionSignals).toHaveTextContent('+1 guard token');
        expect(actionSignals).toHaveTextContent('Reward risk');
        expect(actionSignals.getAttribute('aria-label')).toContain(
            'Side room primary action signals. Action: Claim. Payoff: +1 guard token. Route: Reward risk.'
        );
        expect(actionSignals.querySelector('[data-primary-action-tone="action"]')).toHaveAttribute(
            'data-primary-action-beats',
            '2'
        );
        expect(actionSignals.querySelector('[data-primary-action-tone="gain"]')).toHaveAttribute(
            'data-primary-action-beats',
            '4'
        );
        expect(actionSignals.querySelector('[data-primary-action-tone="gain"]')).toHaveAttribute(
            'data-primary-action-audio',
            'side-room-gain'
        );
        expect(actionSignals.querySelector('[data-primary-action-tone="gain"]')).toHaveAttribute(
            'data-primary-action-screen-cue',
            'burst'
        );
        expect(actionSignals.querySelector('[data-primary-action-tone="gain"]')?.querySelectorAll('[data-primary-action-beat]')).toHaveLength(4);
        expect(actionSignals.querySelector('[data-primary-action-tone="route"]')).toHaveAttribute(
            'data-primary-action-beats',
            '3'
        );
        expect(burst).toHaveTextContent('Reward burst');
        expect(burst).toHaveTextContent('2 gains');
        expect(burst).toHaveTextContent('Overflow');
        expect(burst).toHaveTextContent('1 capped');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')).toHaveAttribute('data-reward-burst-beats', '3');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')).toHaveAttribute('data-reward-burst-action', 'Claim reward');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')).toHaveAttribute('data-reward-burst-audio', 'side-room-reward-gain');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')).toHaveAttribute('data-reward-burst-screen-cue', 'burst');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')).toHaveTextContent('Claim reward');
        expect(burst.querySelector('[data-reward-burst-tone="gain"]')?.querySelectorAll('[data-reward-burst-beat]')).toHaveLength(3);
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')).toHaveAttribute('data-reward-burst-beats', '2');
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')).toHaveAttribute('data-reward-burst-action', 'Convert overflow');
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')).toHaveAttribute('data-reward-burst-audio', 'side-room-reward-capped');
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')).toHaveAttribute('data-reward-burst-screen-cue', 'snap');
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')).toHaveTextContent('Convert overflow');
        expect(burst.querySelector('[data-reward-burst-tone="capped"]')?.querySelectorAll('[data-reward-burst-beat]')).toHaveLength(2);
        expect(burst.getAttribute('aria-label')).toContain(
            'Side room reward burst signals. Reward burst: 2 gains. Overflow: 1 capped.'
        );
        expect(feedback).toHaveTextContent('+1 guard token');
        expect(feedback).toHaveTextContent('+5 overflow score');
        expect(feedback).toHaveTextContent('Combo shards already full');
        expect(feedback.getAttribute('aria-label')).toContain('gain: +1 guard token');
        expect(feedback.getAttribute('aria-label')).toContain('capped: Combo shards already full');
        expect(feedback.querySelectorAll("[data-reward-feedback-kind='gain']")).toHaveLength(2);
        expect(feedback.querySelectorAll("[data-reward-feedback-kind='capped']")).toHaveLength(1);
    });

    it('shows trait build archetype tags on bonus reward choices', () => {
        const saveData = createDefaultSaveData();
        const run = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 50 });
        useAppStore.setState({
            hydrated: true,
            hydrating: false,
            view: 'sideRoom',
            saveData,
            settings: saveData.settings,
            run: {
                ...run,
                status: 'levelComplete',
                sideRoom: {
                    id: 'bonus-trait-tags-test',
                    kind: 'bonus_reward',
                    routeType: 'greed',
                    nodeKind: 'treasure',
                    floor: 3,
                    title: 'Greed Trait toolkit',
                    body: 'Trait-routing rewards should name the builds they support.',
                    primaryLabel: 'Trait toolkit',
                    primaryDetail: '+1 row/swap charge; +1 peek charge',
                    skipLabel: 'Leave it',
                    choices: [
                        {
                            id: 'choice-trait-toolkit',
                            label: 'Trait toolkit',
                            detail: '+1 row/swap charge; +1 peek charge',
                            primary: true,
                            traitBuildLabels: ['Drift Routing', 'Conduit Cartographer'],
                            traitBuildReason: 'Offered for Drift Routing: Drift + Volatile: routing burst',
                            rewardImpactBeats: 4,
                            rewardImpactCue: 'Best fit',
                            rewardImpactDetail: 'Offered for Drift Routing: Drift + Volatile: routing burst',
                            rewardImpactKind: 'build',
                            rewardPerkNextCue: 'Use Swap or row shuffle to connect trait routes.'
                        },
                        {
                            id: 'choice-key-insurance',
                            label: 'Key insurance',
                            detail: '+1 dungeon key; +1 shop gold',
                            primary: false,
                            rewardImpactBeats: 4,
                            rewardImpactCue: 'Reward burst',
                            rewardImpactDetail: 'Keep the iron key for the next locked entrance.',
                            rewardImpactKind: 'resource',
                            nextCue: 'Keep the iron key for the next locked entrance.'
                        }
                    ],
                    payload: { kind: 'bonus_reward', instanceId: 'choice-trait-toolkit' }
                }
            }
        });

        render(<SideRoomScreen />);

        expect(screen.getByTestId('side-room-board-moment')).toHaveTextContent('Pick a build lane');
        expect(screen.getByTestId('side-room-board-moment')).toHaveAttribute('data-board-moment-tone', 'build');
        expect(screen.getByLabelText('Trait build archetypes')).toHaveTextContent('Drift Routing');
        expect(screen.getByLabelText('Trait build archetypes')).toHaveTextContent('Conduit Cartographer');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Choose');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('+1 row/swap charge');
        const laneMap = screen.getByTestId('side-room-choice-lane-map');
        expect(laneMap).toHaveAttribute('data-choice-lane-map', 'build:1>unlock:1');
        expect(laneMap).toHaveAttribute('data-choice-lane-actions', 'build:Pick build:1>unlock:Bank unlock:1');
        expect(laneMap).toHaveAttribute('data-choice-lane-roles', 'build:Prime:1>unlock:Bank:1');
        expect(laneMap).toHaveAttribute('data-choice-lane-role-ids', 'build:prime:1>unlock:bank:1');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane', 'build');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-action', 'Pick build');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-audio', 'side-room-lane-build');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-beats', '4');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-cue', 'Drift Routing');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-role', 'Prime');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-role-id', 'prime');
        expect(laneMap).toHaveAttribute('data-choice-primary-lane-screen-cue', 'burst');
        const laneMapSummary = screen.getByTestId('side-room-choice-lane-map-summary');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-count', '2');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary', 'build');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary-action', 'Pick build');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary-audio', 'side-room-lane-build');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary-role', 'Prime');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary-role-id', 'prime');
        expect(laneMapSummary).toHaveAttribute('data-choice-lane-summary-primary-screen-cue', 'burst');
        expect(laneMapSummary).toHaveTextContent('Lanes');
        expect(laneMapSummary).toHaveTextContent('2 lanes');
        expect(laneMapSummary).toHaveTextContent('Prime Build');
        expect(laneMapSummary.querySelectorAll('[data-choice-lane-map-summary-beat]')).toHaveLength(3);
        expect(laneMapSummary.querySelector('[data-choice-lane-map-summary-beat="1"]')).toHaveAttribute(
            'data-choice-lane-map-summary-beat-focus',
            'build'
        );
        expect(laneMapSummary.querySelector('[data-choice-lane-map-summary-beat="1"]')).toHaveAttribute(
            'data-choice-lane-map-summary-beat-role-id',
            'prime'
        );
        expect(laneMapSummary.querySelector('[data-choice-lane-map-summary-beat="1"]')).toHaveAttribute(
            'data-choice-lane-map-summary-beat-screen-cue',
            'burst'
        );
        expect(laneMapSummary.querySelector('[data-choice-lane-map-summary-beat="2"]')).toHaveAttribute(
            'data-choice-lane-map-summary-beat-focus',
            'support'
        );
        const primaryLane = screen.getByTestId('side-room-choice-primary-lane');
        expect(primaryLane).toHaveAccessibleName('Primary side room lane. Prime Build: Pick build. Drift Routing. 4 beats.');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane', 'build');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-action', 'Pick build');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-audio', 'side-room-lane-build');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-beats', '4');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-cue', 'Drift Routing');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-role', 'Prime');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-role-id', 'prime');
        expect(primaryLane).toHaveAttribute('data-choice-primary-lane-screen-cue', 'burst');
        expect(primaryLane).toHaveTextContent('Best lane');
        expect(primaryLane).toHaveTextContent('Prime');
        expect(primaryLane).toHaveTextContent('Pick build');
        expect(primaryLane.querySelectorAll('[data-choice-primary-lane-beat]')).toHaveLength(4);
        expect(laneMap).toHaveTextContent('Build');
        expect(laneMap).toHaveTextContent('Prime');
        expect(laneMap).toHaveTextContent('Pick build');
        expect(laneMap).toHaveTextContent('x1 / Drift Routing');
        expect(laneMap).toHaveTextContent('Unlock');
        expect(laneMap).toHaveTextContent('Bank');
        expect(laneMap).toHaveTextContent('Bank unlock');
        expect(laneMap).toHaveTextContent('x1 / Keep the iron key for the next locked entrance.');
        expect(laneMap.querySelector('[data-choice-lane="build"]')).toHaveAttribute(
            'data-choice-lane-action',
            'Pick build'
        );
        expect(laneMap.querySelector('[data-choice-lane="build"]')).toHaveAttribute('data-choice-lane-beats', '4');
        expect(laneMap.querySelector('[data-choice-lane="build"]')).toHaveAttribute('data-choice-lane-role', 'Prime');
        expect(laneMap.querySelector('[data-choice-lane="build"]')).toHaveAttribute('data-choice-lane-role-id', 'prime');
        expect(
            laneMap.querySelector('[data-choice-lane="build"]')?.querySelectorAll('[data-choice-lane-beat]')
        ).toHaveLength(4);
        expect(laneMap.querySelector('[data-choice-lane="unlock"]')).toHaveAttribute(
            'data-choice-lane-action',
            'Bank unlock'
        );
        expect(laneMap.querySelector('[data-choice-lane="unlock"]')).toHaveAttribute('data-choice-lane-beats', '3');
        expect(laneMap.querySelector('[data-choice-lane="unlock"]')).toHaveAttribute('data-choice-lane-role', 'Bank');
        expect(laneMap.querySelector('[data-choice-lane="unlock"]')).toHaveAttribute('data-choice-lane-role-id', 'bank');
        expect(
            laneMap.querySelector('[data-choice-lane="unlock"]')?.querySelectorAll('[data-choice-lane-beat]')
        ).toHaveLength(3);
        expect(laneMap).toHaveAccessibleName(
            'Side room choice lanes. Build: Prime x1. Pick build. Drift Routing. Unlock: Bank x1. Bank unlock. Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-recommendation',
            'best-fit'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute('data-choice-heat', 'hot');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-heat-value',
            'Hot route'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-beat-cue',
            'Stack beat'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-beat-tier',
            'stack'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-beat-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-beat-count',
            '4'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-reward-impact-kind',
            'build'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-reward-impact-cue',
            'Best fit'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-reward-impact-beats',
            '4'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-reward-impact-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit')).toHaveAttribute(
            'data-choice-build-routes',
            'conduit_cartographer:conduit+echo+mirror:guard>drift_routing:drift+volatile:route'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute(
            'data-choice-reward-impact-kind',
            'resource'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-impact')).toHaveTextContent('Reward burst');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-beat')).toHaveTextContent('Stack beat');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-beat')).toHaveTextContent('Stack choice');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-beat')).toHaveAttribute(
            'data-choice-beat-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-beat').querySelectorAll('i')).toHaveLength(4);
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-heat')).toHaveTextContent('Choice heat');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-heat')).toHaveTextContent('Hot route');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-heat')).toHaveTextContent(
            'Offered for Drift Routing'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-heat')).toHaveAttribute(
            'data-choice-heat-tier',
            'hot'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-heat')).toHaveAccessibleName(
            'Choice heat: Hot route. Offered for Drift Routing: Drift + Volatile: routing burst.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-impact')).toHaveTextContent('Best fit');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-impact')).toHaveTextContent('Drift Routing');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-impact')).toHaveAttribute(
            'data-choice-impact-tone',
            'build'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-impact')).toHaveAttribute(
            'data-choice-impact-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-impact')).toHaveAccessibleName(
            'Best fit: Drift Routing.'
        );
        const buildRoutes = screen.getByTestId('side-room-choice-choice-trait-toolkit-build-routes');
        expect(buildRoutes).toHaveAttribute('data-choice-build-route-count', '2');
        expect(buildRoutes).toHaveAccessibleName(
            /Choice build routes.*Conduit Cartographer.*Traits: Conduit into Echo into Mirror.*Drift Routing.*Traits: Drift into Volatile/i
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-choice-build-route-tone',
            'guard'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-choice-build-trait-count',
            '3'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-choice-build-route-beats',
            '4'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-trait="conduit"]')).toHaveTextContent('Conduit');
        expect(buildRoutes.querySelector('[data-choice-build-route-trait="echo"]')).toHaveTextContent('Echo');
        expect(buildRoutes.querySelector('[data-choice-build-route-trait="mirror"]')).toHaveTextContent('Mirror');
        expect(buildRoutes.querySelector('[data-choice-build-route-id="conduit_cartographer"]')?.querySelectorAll('[data-choice-build-route-beat]')).toHaveLength(4);
        expect(buildRoutes.querySelector('[data-choice-build-route-id="drift_routing"]')).toHaveAttribute(
            'data-choice-build-route-tone',
            'route'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-id="drift_routing"]')).toHaveAttribute(
            'data-choice-build-trait-count',
            '2'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-id="drift_routing"]')).toHaveAttribute(
            'data-choice-build-route-beats',
            '3'
        );
        expect(buildRoutes.querySelector('[data-choice-build-route-trait="drift"]')).toHaveTextContent('Drift');
        expect(buildRoutes.querySelector('[data-choice-build-route-trait="volatile"]')).toHaveTextContent('Volatile');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-tone',
            'super'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('3 payoffs');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('Reward + Route + Next');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent(
            'Use Swap or row shuffle to connect trait routes.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-first',
            '+1 row/swap charge'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-then',
            'Offered for Drift Routing: Drift + Volatile: routing burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-keep',
            'Use Swap or row shuffle to connect trait routes.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('First');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('Then');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveTextContent('Keep');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoff-stack')).toHaveAccessibleName(
            'Super stack: 3 payoffs. Reward + Route + Next. First: +1 row/swap charge. Then: Offered for Drift Routing: Drift + Volatile: routing burst. Keep: Use Swap or row shuffle to connect trait routes. Next: Use Swap or row shuffle to connect trait routes.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-signals')).toHaveTextContent('Best fit');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-signals')).toHaveTextContent('Gain');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-signals')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-signals')).toHaveTextContent('Next unlock');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-signals')).toHaveAttribute(
            'aria-label',
            'Trait toolkit signals. Best fit. Gain. Route prime. Next unlock.'
        );
        const traitToolkitSignals = screen.getByTestId('side-room-choice-choice-trait-toolkit-signals');
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')).toHaveAttribute(
            'data-choice-signal-beats',
            '4'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')).toHaveAttribute(
            'data-choice-signal-action',
            'Prime route'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')).toHaveAttribute(
            'data-choice-signal-audio',
            'side-room-signal-build'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')).toHaveAttribute(
            'data-choice-signal-screen-cue',
            'route'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')).toHaveTextContent('Prime route');
        expect(
            traitToolkitSignals.querySelector('[data-choice-signal-tone="build"]')?.querySelectorAll('[data-choice-signal-beat]')
        ).toHaveLength(4);
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="gain"]')).toHaveAttribute(
            'data-choice-signal-beats',
            '4'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="gain"]')).toHaveAttribute(
            'data-choice-signal-action',
            'Claim reward'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="gain"]')).toHaveAttribute(
            'data-choice-signal-audio',
            'side-room-signal-gain'
        );
        expect(traitToolkitSignals.querySelector('[data-choice-signal-tone="gain"]')).toHaveAttribute(
            'data-choice-signal-screen-cue',
            'burst'
        );
        expect(
            traitToolkitSignals.querySelector('[data-choice-signal-tone="gain"]')?.querySelectorAll('[data-choice-signal-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent('Reward');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent('+1 row/swap charge');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent('Prime');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent('Offered for Drift Routing');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent('Next');
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs')).toHaveTextContent(
            'Use Swap or row shuffle to connect trait routes.'
        );
        expect(screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs').getAttribute('aria-label')).toContain(
            'Trait toolkit payoff. Reward: +1 row/swap charge. Prime: Offered for Drift Routing: Drift + Volatile: routing burst. Next: Use Swap or row shuffle to connect trait routes.'
        );
        const traitToolkitPayoffs = screen.getByTestId('side-room-choice-choice-trait-toolkit-payoffs');
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')).toHaveAttribute(
            'data-choice-payoff-beats',
            '4'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')).toHaveAttribute(
            'data-choice-payoff-action',
            'Claim reward'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')).toHaveAttribute(
            'data-choice-payoff-audio',
            'choice-payoff-gain'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')).toHaveAttribute(
            'data-choice-payoff-screen-cue',
            'burst'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')).toHaveTextContent('Claim reward');
        expect(
            traitToolkitPayoffs.querySelector('[data-choice-payoff-id="reward"]')?.querySelectorAll('[data-choice-payoff-beat]')
        ).toHaveLength(4);
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="build"]')).toHaveAttribute(
            'data-choice-payoff-beats',
            '4'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="build"]')).toHaveAttribute(
            'data-choice-payoff-action',
            'Prime route'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="build"]')).toHaveAttribute(
            'data-choice-payoff-audio',
            'choice-payoff-build'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="build"]')).toHaveAttribute(
            'data-choice-payoff-screen-cue',
            'snap'
        );
        expect(traitToolkitPayoffs.querySelector('[data-choice-payoff-id="next"]')).toHaveAttribute(
            'data-choice-payoff-beats',
            '4'
        );
        expect(screen.getByRole('button', { name: /Trait toolkit\. Choice heat: Hot route\. Offered for Drift Routing.*Best fit: Drift Routing\. Super stack: 3 payoffs\. Reward \+ Route \+ Next\. First: \+1 row\/swap charge\. Then: Offered for Drift Routing.*Keep: Use Swap or row shuffle.*Next: Use Swap or row shuffle.*Recommended: Offered for Drift Routing.*Reward: \+1 row\/swap charge.*Route primes: Drift Routing \/ Conduit Cartographer.*Next cue: Use Swap or row shuffle/i })).toBeInTheDocument();
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent('Trait toolkit');
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent(
            'Best fit: +1 row/swap charge -> Use Swap or row shuffle to connect trait routes.'
        );
        expect(
            screen
                .getByTestId('side-room-choice-choice-trait-toolkit-payoffs')
                .querySelector('[data-choice-payoff-id="build"]')
        ).toHaveTextContent('Drift Routing');
        expect(screen.getAllByText('Offered for Drift Routing: Drift + Volatile: routing burst')).toHaveLength(5);
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute('data-choice-heat', 'live');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute(
            'data-choice-beat-cue',
            'Cashout beat'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute(
            'data-choice-beat-tier',
            'cashout'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute(
            'data-choice-beat-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance')).toHaveAttribute(
            'data-choice-beat-count',
            '3'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-beat')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-beat')).toHaveTextContent('Cash payoff');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-beat')).toHaveAttribute(
            'data-choice-beat-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-beat').querySelectorAll('i')).toHaveLength(3);
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-heat')).toHaveTextContent('Live payoff');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-heat')).toHaveTextContent('Reward + Next');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-heat')).toHaveAccessibleName(
            'Choice heat: Live payoff. Reward + Next.'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-impact')).toHaveTextContent('Reward burst');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-impact')).toHaveTextContent(
            'Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-impact')).toHaveAttribute(
            'data-choice-impact-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveTextContent('2 payoffs');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveTextContent('Reward + Next');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveTextContent(
            'Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-first',
            '+1 dungeon key'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-then',
            'Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoff-stack')).toHaveAttribute(
            'data-choice-payoff-stack-keep',
            'Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoffs')).toHaveTextContent('Next');
        expect(screen.getByTestId('side-room-choice-choice-key-insurance-payoffs')).toHaveTextContent(
            'Keep the iron key for the next locked entrance.'
        );
        expect(screen.getByRole('button', { name: /Key insurance\. Choice heat: Live payoff\. Reward \+ Next\. Reward burst: Keep the iron key for the next locked entrance.*Payoff stack: 2 payoffs\. Reward \+ Next\. First: \+1 dungeon key\. Then: Keep the iron key.*Keep: Keep the iron key.*Next cue: Keep the iron key/i })).toBeInTheDocument();
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent('Key insurance');
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent(
            'Reward burst: +1 dungeon key -> Keep the iron key for the next locked entrance.'
        );
    });

    it('collapses exhausted bonus rewards to one continue action', () => {
        const saveData = createDefaultSaveData();
        const run = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 49 });
        useAppStore.setState({
            hydrated: true,
            hydrating: false,
            view: 'sideRoom',
            saveData,
            settings: saveData.settings,
            run: {
                ...run,
                status: 'levelComplete',
                sideRoom: {
                    id: 'bonus-exhausted-test',
                    kind: 'bonus_reward',
                    routeType: 'greed',
                    nodeKind: 'treasure',
                    floor: 3,
                    title: 'Greed Treasure chest',
                    body: 'Treasure chest is exhausted for this run.',
                    primaryLabel: 'Continue',
                    primaryDetail: 'Treasure chest claim limit reached for this run.',
                    skipLabel: 'Continue',
                    payload: { kind: 'bonus_reward', instanceId: 'missing' }
                }
            }
        });

        render(<SideRoomScreen />);

        expect(screen.getByTestId('side-room-board-moment')).toHaveTextContent('Push reward pressure');
        expect(screen.getByTestId('side-room-board-moment')).toHaveAttribute('data-board-moment-tone', 'neutral');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Continue');
        expect(screen.getByTestId('side-room-primary-action-signals')).toHaveTextContent('Outcome');
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent('Continue');
        expect(screen.getByTestId('side-room-action-dock')).toHaveTextContent('Push reward pressure');
        expect(screen.getAllByRole('button', { name: 'Continue' })).toHaveLength(1);
    });

    it('claims the clicked event choice', () => {
        const event = setupEventSideRoom();
        const choice = event.options.find((option) => option.effect === 'gain_iron_key') ?? event.options[0]!;

        render(<SideRoomScreen />);
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${choice.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }));

        expect(uiSfxMocks.playUiConfirmSfx).toHaveBeenCalled();
        expect(useAppStore.getState().run?.sideRoom).toBeNull();
    });
});
