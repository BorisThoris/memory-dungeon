import { RECALL_FOCUS_MAX } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { getHazardTileLiveCopy, HAZARD_TILE_KINDS } from '../../shared/hazard-tiles';
import { TILE_TRAIT_COPY } from '../../shared/tile-trait-rules';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';
import { getChainRewardForecastCues, getChainRewardUrgencyCopy } from './chainMomentum';
import {
    getFindableAnnouncementText,
    joinReadableList,
    pluralize,
    resourceDeltaCopy
} from './hudActionFeedback';

type BoardTurnResolvedEvent = Extract<GameplayEvent, { type: 'board.turn_resolved' }>;

interface BoardTurnGameplayFeedback {
    commandId: string;
    eventId: string;
    message: string;
    priority: 'error' | 'info';
}

export interface BoardTurnAnnouncementPresentation {
    consumedGameplayFeedbackEventIds: string[];
    dedupeKey: string;
    message: string;
    priority: 'error' | 'info';
}

interface BoardTurnAnnouncementOptions {
    reduceMotion?: boolean;
}

const CHAIN_MILESTONE_THRESHOLDS = [3, 6, 10] as const;

const chainRewardAnnouncementLine = (streak: number, comboShards: number, lives: number): string => {
    const cue = getChainRewardForecastCues(streak, comboShards, lives)[0];
    return cue ? ` Next reward: ${getChainRewardUrgencyCopy(cue)}: ${cue.label} in ${cue.distanceLabel}.` : '';
};

const payoffIntensityAnnouncementLine = ({
    chainMatchStreak,
    comboShardDelta,
    guardTokenDelta,
    lifeDelta,
    shopGoldDelta,
    traitMatchCount
}: {
    chainMatchStreak: number;
    comboShardDelta: number;
    guardTokenDelta: number;
    lifeDelta: number;
    shopGoldDelta: number;
    traitMatchCount: number;
}): string | null => {
    const lanes = [
        comboShardDelta > 0 ? 'combo shard' : null,
        guardTokenDelta > 0 ? 'guard token' : null,
        lifeDelta > 0 ? 'life' : null,
        shopGoldDelta > 0 ? 'shop gold' : null,
        traitMatchCount >= 2 ? 'trait surge' : null
    ].filter((lane): lane is string => lane !== null);
    if (lanes.length < 2) {
        return null;
    }
    if (lanes.length >= 4) {
        return `Payoff stack: ${lanes.length} payoffs cashed. Cash stack now.`;
    }
    if (chainMatchStreak >= 3) {
        return `Cashout hit: ${lanes.length} payoffs paid together. Keep the chain live.`;
    }
    return `Reward cashout: ${lanes.length} payoffs paid together.`;
};

const traitLabels = (
    kinds: BoardTurnResolvedEvent['announcement']['matchedTraitKinds']
): string[] => kinds.map((kind) => TILE_TRAIT_COPY[kind].label);

const hazardTileAnnouncementLines = (
    facts: BoardTurnResolvedEvent['announcement'],
    reduceMotion: boolean
): string[] => {
    const before = facts.hazardTilesBefore;
    const after = facts.hazardTilesAfter;
    const firedKinds = HAZARD_TILE_KINDS.filter((kind) => {
        if (kind === 'shuffle_snare') return after.shuffleSnares > before.shuffleSnares;
        if (kind === 'cascade_cache') return after.cascadeCaches > before.cascadeCaches;
        if (kind === 'mirror_decoy') return after.mirrorDecoys > before.mirrorDecoys;
        if (kind === 'fragile_cache') {
            return after.fragileCacheClaims > before.fragileCacheClaims ||
                after.fragileCacheBreaks > before.fragileCacheBreaks;
        }
        if (kind === 'toll_cache') return after.tollCaches > before.tollCaches;
        return after.fuseCaches > before.fuseCaches;
    });

    return firedKinds.flatMap((kind) => {
        const liveCopy = getHazardTileLiveCopy(kind);
        if (kind !== 'fragile_cache') {
            if (kind === 'fuse_cache' && after.fuseExpiredClaims > before.fuseExpiredClaims) {
                return [
                    reduceMotion
                        ? liveCopy.reducedMotionBreakLiveAnnouncement ?? liveCopy.reducedMotionLiveAnnouncement
                        : liveCopy.breakLiveAnnouncement ?? liveCopy.liveAnnouncement
                ];
            }
            return [reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement];
        }

        const lines: string[] = [];
        if (after.fragileCacheClaims > before.fragileCacheClaims) {
            lines.push(reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement);
        }
        if (after.fragileCacheBreaks > before.fragileCacheBreaks) {
            lines.push(
                reduceMotion
                    ? liveCopy.reducedMotionBreakLiveAnnouncement ?? liveCopy.reducedMotionLiveAnnouncement
                    : liveCopy.breakLiveAnnouncement ?? liveCopy.liveAnnouncement
            );
        }
        return lines;
    });
};

const secondaryBoardAnnouncementLines = (
    facts: BoardTurnResolvedEvent['announcement'],
    reduceMotion: boolean
): string[] => {
    const lines = hazardTileAnnouncementLines(facts, reduceMotion);
    if (facts.scoutsAfter.lanternWard > facts.scoutsBefore.lanternWard) {
        lines.push('Lantern Ward scouted a hidden threat.');
    }
    if (facts.scoutsAfter.omenSeal > facts.scoutsBefore.omenSeal) {
        lines.push('Omen Seal revealed hidden danger.');
    }
    if (facts.mimicCacheAfter.bites > facts.mimicCacheBefore.bites) {
        lines.push(
            facts.mimicCacheAfter.guardBites > facts.mimicCacheBefore.guardBites
                ? 'Mimic Cache bit. Guard absorbed the hit.'
                : 'Mimic Cache bit. Life lost; reduced loot claimed.'
        );
    } else if (facts.mimicCacheAfter.claims > facts.mimicCacheBefore.claims) {
        lines.push('Mimic Cache controlled. Full loot claimed.');
    }

    const before = facts.routeSpecialsBefore;
    const after = facts.routeSpecialsAfter;
    if (after.anchorSealUses > before.anchorSealUses) {
        lines.push('Anchor Seal froze rotating pressure.');
    }
    if (after.loadedGatewayPlans > before.loadedGatewayPlans) {
        lines.push('Loaded Gateway prepared the next route.');
    }
    if (after.catalystAltarUpgrades > before.catalystAltarUpgrades) {
        lines.push('Catalyst Altar converted a shard into reward.');
    }
    if (after.parasiteVesselConversions > before.parasiteVesselConversions) {
        lines.push('Parasite Vessel reduced pressure.');
    }
    if (after.pinLatticeRewards > before.pinLatticeRewards) {
        lines.push('Pin Lattice rewarded deliberate planning.');
    }
    if (facts.safeHazardWardsUsedAfter > facts.safeHazardWardsUsedBefore) {
        lines.push('Guard Cache ward blocked a hazard.');
    }
    return lines;
};

export const buildBoardTurnAnnouncement = (
    turnEvent: BoardTurnResolvedEvent,
    gameplayFeedback: readonly BoardTurnGameplayFeedback[] = [],
    options: BoardTurnAnnouncementOptions = {}
): BoardTurnAnnouncementPresentation => {
    const sameCommandFeedback = gameplayFeedback.filter(
        (feedback) => feedback.commandId === turnEvent.commandId
    );
    const pickupFallback =
        sameCommandFeedback.length === 0 && turnEvent.matchedFindableKind != null
            ? getFindableAnnouncementText(turnEvent.matchedFindableKind)
            : null;
    const ownsResourceGainCopy = sameCommandFeedback.length > 0 || pickupFallback != null;
    const facts = turnEvent.announcement;
    const lines: string[] = sameCommandFeedback.length > 0
        ? sameCommandFeedback.map((feedback) => feedback.message)
        : pickupFallback
          ? [pickupFallback]
          : [];
    const lifeDelta = turnEvent.livesAfter - turnEvent.livesBefore;
    const guardDelta = turnEvent.guardTokensAfter - turnEvent.guardTokensBefore;
    const shardDelta = turnEvent.comboShardsAfter - turnEvent.comboShardsBefore;
    const goldDelta = facts.shopGoldAfter - facts.shopGoldBefore;
    const shuffleChargeDelta = facts.shuffleChargesAfter - facts.shuffleChargesBefore;
    const regionShuffleChargeDelta = facts.regionShuffleChargesAfter - facts.regionShuffleChargesBefore;
    const volatileTraitShuffleDelta = facts.volatileTraitShufflesAfter - facts.volatileTraitShufflesBefore;
    const recallMatchDelta = facts.recallMatchesAfter - facts.recallMatchesBefore;
    const recallMistakeDelta = facts.recallMistakesAfter - facts.recallMistakesBefore;
    const recallBonusDelta = facts.recallBonusScoreAfter - facts.recallBonusScoreBefore;
    const forgottenDelta = facts.forgottenTileCountAfter - facts.forgottenTileCountBefore;
    const dungeonEnemyDefeatDelta =
        facts.dungeonEnemiesDefeatedAfter - facts.dungeonEnemiesDefeatedBefore;
    const enemyHazardHitDelta = facts.enemyHazardHitsAfter - facts.enemyHazardHitsBefore;
    const enemyHazardDefeatDelta =
        facts.enemyHazardsDefeatedAfter - facts.enemyHazardsDefeatedBefore;
    const mimicBiteDelta = facts.mimicCacheAfter.bites - facts.mimicCacheBefore.bites;
    const matched = turnEvent.outcome === 'match' || turnEvent.outcome === 'gambit_match';
    const mismatched = turnEvent.outcome === 'mismatch' || turnEvent.outcome === 'gambit_mismatch';
    const matchedTraitLabels = traitLabels(facts.matchedTraitKinds);
    const mismatchedTraitLabels = traitLabels(facts.mismatchedTraitKinds);

    if (lifeDelta < 0) {
        lines.push(
            `Life lost. ${turnEvent.livesAfter} ${turnEvent.livesAfter === 1 ? 'life remains' : 'lives remain'}.`
        );
    } else if (lifeDelta > 0) {
        lines.push(
            `Life restored. ${turnEvent.livesAfter} ${turnEvent.livesAfter === 1 ? 'life available' : 'lives available'}.`
        );
    } else if (guardDelta < 0) {
        lines.push(
            `Guard token spent. ${turnEvent.guardTokensAfter} guard ${
                turnEvent.guardTokensAfter === 1 ? 'token remains' : 'tokens remain'
            }.`
        );
    } else if (guardDelta > 0 && !ownsResourceGainCopy) {
        lines.push(`${pluralize(guardDelta, 'guard token')} gained. ${turnEvent.guardTokensAfter} available.`);
    }

    if (mismatched && lifeDelta >= 0 && guardDelta >= 0) {
        lines.push('No match. Recover with a safe match. Chain reset.');
    }

    if (enemyHazardHitDelta > 0) {
        lines.push(
            enemyHazardHitDelta === 1
                ? 'Moving enemy contact.'
                : `${enemyHazardHitDelta} moving enemy contacts.`
        );
    }

    if (recallMistakeDelta > 0) {
        lines.push(
            facts.forgottenTileCountAfter > 0
                ? `Recall broken. ${facts.forgottenTileCountAfter} ${
                      facts.forgottenTileCountAfter === 1 ? 'tile memory is' : 'tile memories are'
                  } unstable.`
                : 'Recall broken. Focus lost.'
        );
    } else if (forgottenDelta > 0 || (facts.recallFocusAfter < facts.recallFocusBefore && !matched)) {
        const forgottenCount = Math.max(forgottenDelta, facts.forgottenTileCountAfter);
        lines.push(
            forgottenCount > 0
                ? `Memory aid used. Recall focus ${facts.recallFocusAfter}/${RECALL_FOCUS_MAX}; ${forgottenCount} ${
                      forgottenCount === 1 ? 'tile memory is' : 'tile memories are'
                  } unstable.`
                : `Memory aid used. Recall focus ${facts.recallFocusAfter}/${RECALL_FOCUS_MAX}.`
        );
    }

    if (matched) {
        const pairTotal = Math.max(
            facts.pairCountBefore,
            facts.pairCountAfter,
            facts.matchedPairsAfter
        );
        lines.push(`Match resolved. ${facts.matchedPairsAfter}/${pairTotal} pairs cleared.`);
        if (matchedTraitLabels.length > 0) {
            lines.push(
                matchedTraitLabels.length >= 2
                    ? `Trait combo surge: ${joinReadableList(matchedTraitLabels)} resolved.`
                    : `${joinReadableList(matchedTraitLabels)} trait resolved.`
            );
        }
        if (regionShuffleChargeDelta > 0) {
            lines.push(`${pluralize(regionShuffleChargeDelta, 'row/swap charge')} gained.`);
        }
        if (shuffleChargeDelta > 0) {
            lines.push(`${pluralize(shuffleChargeDelta, 'full shuffle charge')} gained.`);
        }
        if (
            facts.stickyBlockIndexAfter !== null &&
            facts.stickyBlockIndexAfter !== facts.stickyBlockIndexBefore
        ) {
            lines.push('Stasis blocked a nearby trait tile from opening first next turn.');
        }
        if (recallMatchDelta > 0) {
            lines.push(
                recallBonusDelta > 0
                    ? `Recall focus ${facts.recallFocusAfter}/${RECALL_FOCUS_MAX}; +${recallBonusDelta} memory score.`
                    : `Recall focus ${facts.recallFocusAfter}/${RECALL_FOCUS_MAX}.`
            );
        }
        if (forgottenDelta < 0) {
            const settledCount = Math.abs(forgottenDelta);
            lines.push(
                `${settledCount} ${
                    settledCount === 1 ? 'unstable tile memory' : 'unstable tile memories'
                } stabilized.`
            );
        }
        if (enemyHazardDefeatDelta > 0) {
            lines.push(
                enemyHazardDefeatDelta === 1
                    ? `Moving enemy defeated. ${facts.enemyHazardsDefeatedAfter} cleared this floor.`
                    : `${enemyHazardDefeatDelta} moving enemies defeated. ${facts.enemyHazardsDefeatedAfter} cleared this floor.`
            );
        }
        if (dungeonEnemyDefeatDelta > 0) {
            lines.push(
                dungeonEnemyDefeatDelta === 1
                    ? `Dungeon enemy defeated. ${facts.dungeonEnemiesDefeatedAfter} defeated this floor.`
                    : `${dungeonEnemyDefeatDelta} dungeon enemies defeated. ${facts.dungeonEnemiesDefeatedAfter} defeated this floor.`
            );
        }

        for (const milestone of CHAIN_MILESTONE_THRESHOLDS) {
            if (turnEvent.currentStreakBefore < milestone && turnEvent.currentStreakAfter >= milestone) {
                const feedback = getChainMilestoneFeedback(
                    turnEvent.currentStreakBefore,
                    turnEvent.currentStreakAfter
                );
                const rewardLine = chainRewardAnnouncementLine(
                    turnEvent.currentStreakAfter,
                    turnEvent.comboShardsAfter,
                    turnEvent.livesAfter
                );
                lines.push(
                    feedback
                        ? `${feedback.label}: ${feedback.target}. ${feedback.value}.${rewardLine}`
                        : `Chain times ${milestone} - keep the chain for bigger match payouts.${rewardLine}`
                );
                break;
            }
        }
    } else if (
        turnEvent.currentStreakBefore >= 3 &&
        turnEvent.currentStreakAfter < turnEvent.currentStreakBefore
    ) {
        lines.push(`Chain x${turnEvent.currentStreakBefore} broken - recover with a remembered pair.`);
    }

    if (mismatchedTraitLabels.length > 0) {
        lines.push(
            mismatchedTraitLabels.length >= 2
                ? `Trait surge: ${mismatchedTraitLabels.length} penalties applied: ${joinReadableList(mismatchedTraitLabels)}.`
                : `${joinReadableList(mismatchedTraitLabels)} trait penalty applied.`
        );
    }

    if (volatileTraitShuffleDelta > 0) {
        lines.push('Volatile trait shuffled hidden cards.');
    }

    lines.push(...secondaryBoardAnnouncementLines(facts, options.reduceMotion === true));

    const objectiveBefore = facts.objectiveBefore;
    const objectiveAfter = facts.objectiveAfter;
    if (
        objectiveAfter &&
        objectiveAfter.required > 0 &&
        objectiveBefore?.label === objectiveAfter.label &&
        (objectiveAfter.progress > objectiveBefore.progress ||
            (objectiveAfter.progress >= objectiveAfter.required &&
                objectiveBefore.progress < objectiveBefore.required))
    ) {
        const complete = objectiveAfter.progress >= objectiveAfter.required;
        lines.push(
            `${objectiveAfter.label}: ${Math.min(objectiveAfter.progress, objectiveAfter.required)}/${
                objectiveAfter.required
            }${complete ? ' complete' : ''}.`
        );
    }

    if (shardDelta > 0 && !ownsResourceGainCopy) {
        lines.push(
            `${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'gained')}. ${
                turnEvent.comboShardsAfter
            } available.`
        );
    } else if (shardDelta < 0) {
        lines.push(
            `${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'spent')}. ${
                turnEvent.comboShardsAfter
            } available.`
        );
    }

    if (goldDelta > 0) {
        lines.push(
            `${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'gained', 'shop gold')}. ${
                facts.shopGoldAfter
            } available.`
        );
    } else if (goldDelta < 0) {
        lines.push(
            `${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'spent', 'shop gold')}. ${
                facts.shopGoldAfter
            } available.`
        );
    }

    if (matched) {
        const payoffIntensityLine = payoffIntensityAnnouncementLine({
            chainMatchStreak: turnEvent.currentStreakAfter,
            comboShardDelta: shardDelta,
            guardTokenDelta: guardDelta,
            lifeDelta,
            shopGoldDelta: goldDelta,
            traitMatchCount: matchedTraitLabels.length
        });
        if (payoffIntensityLine) {
            lines.push(payoffIntensityLine);
        }
    }

    return {
        consumedGameplayFeedbackEventIds: sameCommandFeedback.map((feedback) => feedback.eventId),
        dedupeKey: `board-turn:${turnEvent.eventId}`,
        message: lines.join(' '),
        priority:
            lifeDelta < 0 ||
            enemyHazardHitDelta > 0 ||
            mimicBiteDelta > 0 ||
            sameCommandFeedback.some((feedback) => feedback.priority === 'error')
                ? 'error'
                : 'info'
    };
};
