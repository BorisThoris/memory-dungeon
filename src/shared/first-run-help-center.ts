import type { SaveData } from './contracts';

export type FirstRunHelpCenterRowId = 'flip_match' | 'score_recover' | 'route_choice' | 'relic_rewards' | 'deeper_help';
export type FirstRunHelpCenterStatus = 'active' | 'replayable' | 'complete';

export interface FirstRunHelpCenterRow {
    id: FirstRunHelpCenterRowId;
    title: string;
    body: string;
    action: string;
    status: FirstRunHelpCenterStatus;
    targetSurface: 'gameplay_prompt' | 'codex' | 'collection';
    localOnly: true;
}

export const getFirstRunHelpCenterRows = (save: Pick<SaveData, 'onboardingDismissed' | 'powersFtueSeen'>): FirstRunHelpCenterRow[] => {
    const completed = save.onboardingDismissed;
    const firstStatus: FirstRunHelpCenterStatus = completed ? 'complete' : 'active';
    const laterStatus: FirstRunHelpCenterStatus = completed ? 'replayable' : 'active';

    return [
        {
            id: 'flip_match',
            title: '1. Flip and match',
            body: 'The first live board highlights a real pair so you learn by flipping cards, not by reading a long rules wall.',
            action: completed ? 'Replay from a fresh profile or start Classic to practice.' : 'Start Play and follow the highlighted pair.',
            status: firstStatus,
            targetSurface: 'gameplay_prompt',
            localOnly: true
        },
        {
            id: 'score_recover',
            title: '2. Score and recover',
            body: 'Clean matches bank score and streak before the guide asks for one more pair. Mistakes cost tempo, not the run.',
            action: 'Use the next marked pair before spending a rescue tool.',
            status: laterStatus,
            targetSurface: 'gameplay_prompt',
            localOnly: true
        },
        {
            id: 'route_choice',
            title: '3. Choose a room',
            body: 'The first floor clear turns into a route choice: Safe protects, Greed pays harder, and Mystery changes the next board.',
            action: 'Pick a route in the floor-clear sheet; the next board shows the consequence.',
            status: laterStatus,
            targetSurface: 'codex',
            localOnly: true
        },
        {
            id: 'relic_rewards',
            title: '4. Rewards and builds',
            body: 'Runs turn into relic drafts, objective progress, profile levels, and visual-only collection rewards.',
            action: 'Visit Collection after runs to see durable progress.',
            status: laterStatus,
            targetSurface: 'collection',
            localOnly: true
        },
        {
            id: 'deeper_help',
            title: 'Help center',
            body: 'Codex is the deeper reference for powers, mutators, modes, pickups, contracts, and achievements.',
            action: 'Use Codex any time; it is local-only and never changes run state.',
            status: 'replayable',
            targetSurface: 'codex',
            localOnly: true
        }
    ];
};

export const firstRunHelpCenterComplete = (save: Pick<SaveData, 'onboardingDismissed' | 'powersFtueSeen'>): boolean =>
    getFirstRunHelpCenterRows(save).some((row) => row.status === 'complete');
