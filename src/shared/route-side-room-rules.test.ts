import { describe, expect, it } from 'vitest';

import { createNewRun } from './game-core';
import { createPlayablePathFixture } from './playable-path-fixtures';
import {
    claimRouteSideRoomChoice,
    claimRouteSideRoomPrimary,
    openRouteSideRoom,
    routeNodeKindForSideRoom,
    skipRouteSideRoom
} from './route-side-room-rules';

describe('route side-room rules', () => {
    it('maps route type and floor into side-room node kinds', () => {
        expect(routeNodeKindForSideRoom('safe', 2)).toBe('rest');
        expect(routeNodeKindForSideRoom('greed', 3)).toBe('shop');
        expect(routeNodeKindForSideRoom('greed', 4)).toBe('treasure');
        expect(routeNodeKindForSideRoom('mystery', 4)).toBe('treasure');
        expect(routeNodeKindForSideRoom('mystery', 5)).toBe('event');
    });

    it('opens safe, greed, and mystery side rooms from playable fixtures', () => {
        expect(createPlayablePathFixture('sideRoomPrimary').run?.sideRoom).toMatchObject({
            kind: 'rest_shrine',
            routeType: 'safe'
        });
        expect(createPlayablePathFixture('sideRoomSkip').run?.sideRoom).toMatchObject({
            kind: 'bonus_reward',
            routeType: 'greed'
        });
        expect(createPlayablePathFixture('sideRoomChoice').run?.sideRoom).toMatchObject({
            kind: 'run_event',
            routeType: 'mystery'
        });
    });

    it('ignores side-room opening outside level-complete route interludes', () => {
        const run = createNewRun(0);

        expect(openRouteSideRoom(run)).toBe(run);
        expect(openRouteSideRoom({ ...run, status: 'levelComplete' as const, lives: 0 })).toMatchObject({
            sideRoom: null
        });
    });

    it('claims rest side rooms and clears side-room state', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const claimed = claimRouteSideRoomPrimary(run);

        expect(claimed.sideRoom).toBeNull();
        expect(claimed.lives).toBeGreaterThanOrEqual(run.lives);
        const deadRun = { ...run, lives: 0 };
        expect(claimRouteSideRoomPrimary(deadRun)).toBe(deadRun);
    });

    it('requires valid run-event choices and allows skipping bonus side rooms', () => {
        const eventRun = createPlayablePathFixture('sideRoomChoice').run!;
        const invalid = claimRouteSideRoomChoice(eventRun, 'missing-choice');
        expect(invalid).toBe(eventRun);

        const choiceId = eventRun.sideRoom!.choices!.find((choice) => choice.primary)!.id;
        expect(claimRouteSideRoomChoice(eventRun, choiceId).sideRoom).toBeNull();

        const bonusRun = createPlayablePathFixture('sideRoomSkip').run!;
        expect(skipRouteSideRoom(bonusRun)).toMatchObject({ sideRoom: null });
        expect(skipRouteSideRoom({ ...bonusRun, status: 'playing' as const })).toMatchObject({
            sideRoom: bonusRun.sideRoom
        });
    });

    it('opens bonus side rooms as deterministic reward drafts and claims the clicked reward', () => {
        const bonusRun = createPlayablePathFixture('sideRoomSkip').run!;
        const choices = bonusRun.sideRoom!.choices!;

        expect(bonusRun.sideRoom).toMatchObject({ kind: 'bonus_reward' });
        expect(choices.length).toBeGreaterThan(1);
        expect(choices.filter((choice) => choice.primary)).toHaveLength(1);

        const traitChoice =
            choices.find((choice) => /trait|row\/swap/i.test(`${choice.label} ${choice.detail}`)) ??
            choices.find((choice) => choice.primary)!;
        const claimed = claimRouteSideRoomChoice(bonusRun, traitChoice.id);

        expect(claimed.sideRoom).toBeNull();
        expect(
                claimed.regionShuffleCharges > bonusRun.regionShuffleCharges ||
                claimed.peekCharges > bonusRun.peekCharges ||
                claimed.shopGold > bonusRun.shopGold ||
                claimed.dungeonKeys.iron !== bonusRun.dungeonKeys.iron ||
                (claimed.rewardPerkIds?.length ?? 0) > (bonusRun.rewardPerkIds?.length ?? 0)
        ).toBe(true);
    });

    it('preserves trait build labels on bonus side-room reward draft choices', () => {
        const labeledRun = Array.from({ length: 40 }, (_, index) => {
            const run = createNewRun(index + 1);
            return openRouteSideRoom({
                ...run,
                status: 'levelComplete',
                pendingRouteCardPlan: {
                    choiceId: 'greed',
                    routeType: 'greed',
                    sourceLevel: 3,
                    targetLevel: 4
                }
            });
        }).find((run) => run.sideRoom?.choices?.some((choice) => (choice.traitBuildLabels ?? []).length > 0));

        expect(labeledRun?.sideRoom?.choices).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    traitBuildLabels: expect.arrayContaining([expect.any(String)])
                })
            ])
        );
    });

    it('explains board-driven trait reward choices from current trait opportunities', () => {
        const run = createNewRun(210_502);
        const board = run.board!;
        const opened = openRouteSideRoom({
            ...run,
            board: {
                ...board,
                columns: 2,
                tiles: board.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                        : index === 1
                          ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                          : { ...tile, tileTraitKind: undefined }
                )
            },
            status: 'levelComplete',
            pendingRouteCardPlan: {
                choiceId: 'greed',
                routeType: 'greed',
                sourceLevel: 3,
                targetLevel: 4
            }
        });

        expect(opened.sideRoom).toMatchObject({ kind: 'bonus_reward' });
        expect(opened.sideRoom?.choices).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rewardImpactBeats: 4,
                    rewardImpactCue: 'Best fit',
                    rewardImpactKind: 'build',
                    traitBuildReason: expect.stringContaining('Echo + Sealed: combo shard')
                })
            ])
        );
    });

    it('biases bonus side-room reward drafts by starting loadout', () => {
        const run = createNewRun(210_501, { startingLoadoutId: 'route_tactician' });
        const opened = openRouteSideRoom({
            ...run,
            status: 'levelComplete',
            pendingRouteCardPlan: {
                choiceId: 'greed',
                routeType: 'greed',
                sourceLevel: 3,
                targetLevel: 4
            }
        });

        expect(opened.sideRoom).toMatchObject({ kind: 'bonus_reward' });
        expect(opened.sideRoom?.choices?.[0]).toMatchObject({
            label: 'Free swap discipline',
            rewardImpactBeats: 4,
            rewardImpactCue: 'Best fit',
            rewardImpactKind: 'build',
            traitBuildLabels: expect.arrayContaining(['Drift Routing']),
            rewardPerkNextCue: 'Use Swap or row shuffle to connect trait routes.',
            nextCue: 'Use Swap or row shuffle to connect trait routes.'
        });
    });

    it('attaches next-floor cues to consumable bonus reward choices', () => {
        const run = createNewRun(210_503, { startingLoadoutId: 'vaultbreaker' });
        const opened = openRouteSideRoom({
            ...run,
            status: 'levelComplete',
            pendingRouteCardPlan: {
                choiceId: 'greed',
                routeType: 'greed',
                sourceLevel: 3,
                targetLevel: 4
            }
        });

        expect(opened.sideRoom).toMatchObject({ kind: 'bonus_reward' });
        expect(opened.sideRoom?.choices).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    label: 'Key insurance',
                    rewardImpactBeats: 4,
                    rewardImpactCue: 'Reward burst',
                    rewardImpactKind: 'resource',
                    nextCue: 'Keep the iron key for the next locked entrance.'
                })
            ])
        );
    });
});
