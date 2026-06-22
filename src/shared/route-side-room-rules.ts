import { MAX_LIVES, type RouteNodeType, type RouteSideRoomState, type RunState } from './contracts';
import {
    claimBonusReward,
    previewBonusRewardClaim,
    resolveBonusRewardRoomByInstanceId,
    rollBonusRewardDraft,
    rollBonusRewardRoom
} from './bonus-rewards';
import { createRestShrineServices } from './rest-shrine';
import { applyRunEventChoice, rollRunEventRoom } from './run-events';
import { getTraitOpportunitySummary } from './trait-opportunities';

export const routeNodeKindForSideRoom = (
    routeType: RouteNodeType,
    targetFloor: number
): RouteSideRoomState['nodeKind'] => {
    if (routeType === 'safe') {
        return 'rest';
    }
    if (routeType === 'greed') {
        return targetFloor % 3 === 0 ? 'shop' : 'treasure';
    }
    return targetFloor % 4 === 0 ? 'treasure' : 'event';
};

const buildBonusSideRoom = (
    run: RunState,
    routeType: RouteNodeType,
    nodeKind: RouteSideRoomState['nodeKind'],
    floor: number
): RouteSideRoomState => {
    const reward = rollBonusRewardRoom({
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion,
        floor,
        routeKind: nodeKind,
        ledger: run.bonusRewardLedger
    });
    const routeLabel = routeType === 'safe' ? 'Safe' : routeType === 'greed' ? 'Greed' : 'Mystery';
    const rewardPreview = reward.eligible
        ? previewBonusRewardClaim(run, reward).feedback.summary
        : (reward.unavailableReason ?? 'No reward available.');
    const draft = rollBonusRewardDraft({
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion,
        floor,
        routeKind: nodeKind,
        ledger: run.bonusRewardLedger,
        count: 3,
        startingLoadoutId: run.startingLoadoutId,
        board: run.board
    });
    const primaryInstanceId = draft.some((option) => option.instanceId === reward.instanceId)
        ? reward.instanceId
        : draft[0]?.instanceId;
    const traitOpportunity = getTraitOpportunitySummary(run.board);
    const choices = draft.map((option) => ({
        id: option.instanceId,
        label: option.label,
        detail: option.eligible
            ? previewBonusRewardClaim(run, option).feedback.summary || option.summaryText
            : (option.unavailableReason ?? option.summaryText),
        primary: option.instanceId === primaryInstanceId,
        traitBuildLabels: [...(option.traitBuildLabels ?? [])],
        traitBuildReason:
            option.traitBuildLabels?.some((label) => traitOpportunity.buildLabels.includes(label))
                ? traitOpportunity.reason ?? undefined
                : undefined
    }));
    const primaryChoice = choices.find((choice) => choice.primary);
    return {
        id: `${reward.instanceId}:side`,
        kind: 'bonus_reward',
        routeType,
        nodeKind,
        floor,
        title: `${routeLabel} ${reward.label}`,
        body: reward.eligible
            ? `${reward.trigger} ${reward.discoverability}`
            : `${reward.label} is exhausted for this run.`,
        primaryLabel: primaryChoice?.label ?? (reward.eligible ? `Claim ${reward.label}` : 'Continue'),
        primaryDetail: primaryChoice?.detail ?? rewardPreview,
        skipLabel: reward.eligible ? 'Leave it' : 'Continue',
        choices: choices.length > 1 ? choices : undefined,
        payload: { kind: 'bonus_reward', instanceId: reward.instanceId }
    };
};

export const openRouteSideRoom = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || run.lives <= 0 || run.sideRoom || !run.pendingRouteCardPlan) {
        return run;
    }
    const routeType = run.pendingRouteCardPlan.routeType;
    const floor = run.pendingRouteCardPlan.targetLevel;
    const nodeKind = routeNodeKindForSideRoom(routeType, floor);

    if (routeType === 'safe' && run.lives < MAX_LIVES) {
        const services = createRestShrineServices(run);
        const service = services.find((item) => item.serviceId === 'rest_heal' && item.available);
        if (service) {
            return {
                ...run,
                sideRoom: {
                    id: `${run.runRulesVersion}:${run.runSeed}:${floor}:safe-rest`,
                    kind: 'rest_shrine',
                    routeType,
                    nodeKind,
                    floor,
                    title: 'Safe Quiet Rest',
                    body: 'The safe route opens a recovery stop before the next floor.',
                    primaryLabel: service.label,
                    primaryDetail: 'Restore 1 life; costs 1 shop gold if you have any.',
                    skipLabel: 'Save the time',
                    payload: { kind: 'rest_heal', serviceId: service.id }
                }
            };
        }
    }

    if (routeType === 'mystery' && nodeKind === 'event') {
        const event = rollRunEventRoom({ runSeed: run.runSeed, rulesVersion: run.runRulesVersion, floor });
        const choice = event.options.find((option) => option.effect !== 'skip') ?? event.options[0]!;
        return {
            ...run,
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType,
                nodeKind,
                floor,
                title: event.title,
                body: event.body,
                primaryLabel: choice.label,
                primaryDetail: choice.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: option.id === choice.id || (index === 0 && choice.id == null)
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: choice.id }
            }
        };
    }

    return {
        ...run,
        sideRoom: buildBonusSideRoom(run, routeType, nodeKind, floor)
    };
};

export const claimRouteSideRoomPrimary = (run: RunState): RunState => {
    const eventChoiceId = run.sideRoom?.payload.kind === 'event_choice' ? run.sideRoom.payload.choiceId : undefined;
    const choiceId = run.sideRoom?.choices?.find((choice) => choice.primary)?.id ?? eventChoiceId;
    return choiceId ? claimRouteSideRoomChoice(run, choiceId) : claimRouteSideRoomChoice(run);
};

export const claimRouteSideRoomChoice = (run: RunState, choiceId?: string): RunState => {
    if (run.status !== 'levelComplete' || run.lives <= 0 || !run.sideRoom) {
        return run;
    }
    const sideRoom = run.sideRoom;
    const clearedRun = { ...run, sideRoom: null };
    if (sideRoom.payload.kind === 'rest_heal') {
        const lives = Math.min(MAX_LIVES, clearedRun.lives + 1);
        return {
            ...clearedRun,
            lives,
            lastLevelResult: clearedRun.lastLevelResult
                ? { ...clearedRun.lastLevelResult, livesRemaining: lives }
                : clearedRun.lastLevelResult,
            shopGold: Math.max(0, clearedRun.shopGold - 1)
        };
    }
    if (sideRoom.payload.kind === 'event_choice') {
        const event = rollRunEventRoom({
            runSeed: run.runSeed,
            rulesVersion: run.runRulesVersion,
            floor: sideRoom.floor
        });
        if (event.eventKey !== sideRoom.payload.eventKey) {
            return clearedRun;
        }
        const result = applyRunEventChoice(clearedRun, event, choiceId ?? sideRoom.payload.choiceId);
        return result.applied ? result.run : run;
    }
    const reward = resolveBonusRewardRoomByInstanceId({
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion,
        floor: sideRoom.floor,
        routeKind: sideRoom.nodeKind,
        ledger: run.bonusRewardLedger,
        instanceId: choiceId ?? sideRoom.payload.instanceId
    });
    if (!reward) {
        return clearedRun;
    }
    const result = claimBonusReward(clearedRun, run.bonusRewardLedger, reward);
    return result.claimed
        ? { ...result.run, bonusRewardLedger: result.ledger }
        : { ...clearedRun, bonusRewardLedger: result.ledger };
};

export const skipRouteSideRoom = (run: RunState): RunState =>
    run.status === 'levelComplete' && run.lives > 0 && run.sideRoom ? { ...run, sideRoom: null } : run;
