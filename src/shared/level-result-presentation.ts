import type { FloorIdentityContract } from './boss-encounters';
import type { LevelResult } from './contracts';
import type { MechanicTokenId } from './mechanic-feedback';

export type FloorClearCausalityGroup = 'performance' | 'encounter' | 'objective' | 'assist' | 'reward' | 'route' | 'hazard';

export interface FloorClearCausalityRow {
    id: string;
    group: FloorClearCausalityGroup;
    label: string;
    detail: string;
    tokens: MechanicTokenId[];
}

const objectiveLabel = (id: LevelResult['featuredObjectiveId']): string => {
    switch (id) {
        case 'scholar_style':
            return 'Scholar style';
        case 'glass_witness':
            return 'Glass witness';
        case 'cursed_last':
            return 'Cursed last';
        case 'flip_par':
            return 'Flip par';
        default:
            return 'Objective';
    }
};

const clearLifeDetail = (result: LevelResult): string | null => {
    if (result.clearLifeGained !== 1) {
        return null;
    }
    return result.clearLifeReason === 'perfect'
        ? 'Perfect floor restored 1 life.'
        : result.clearLifeReason === 'clean'
          ? 'Clean floor restored 1 life.'
          : null;
};

const withAtmosphere = (mechanicDetail: string, atmosphere: string): string => `${mechanicDetail} ${atmosphere}`;

export const getFloorClearCausalityRows = (
    result: LevelResult,
    powersUsedThisRun: boolean,
    floorIdentity?: FloorIdentityContract | null
): FloorClearCausalityRow[] => {
    const rows: FloorClearCausalityRow[] = [
        {
            id: 'performance_score',
            group: 'performance',
            label: 'Performance',
            detail: `Rating ${result.rating}; ${result.mistakes} mistake${result.mistakes === 1 ? '' : 's'}; +${result.scoreGained.toLocaleString()} score.`,
            tokens: result.perfect ? ['safe', 'reward'] : ['risk', 'reward']
        }
    ];

    const lifeDetail = clearLifeDetail(result);
    if (lifeDetail) {
        rows.push({
            id: 'life_restore',
            group: 'reward',
            label: 'Life restored',
            detail: lifeDetail,
            tokens: ['safe', 'reward']
        });
    }

    if (floorIdentity) {
        rows.push({
            id: 'encounter_identity',
            group: 'encounter',
            label: floorIdentity.label,
            detail: `${floorIdentity.floorClearSentence} ${floorIdentity.atmosphericFeedback}`,
            tokens: floorIdentity.tokens
        });
    }

    if (result.featuredObjectiveId) {
        rows.push({
            id: 'featured_objective',
            group: 'objective',
            label: objectiveLabel(result.featuredObjectiveId),
            detail: result.featuredObjectiveCompleted
                ? `Completed for +${result.objectiveBonusScore ?? 0} score and +${result.relicFavorGained ?? 0} Favor.`
                : 'Missed this floor; streak pressure updated.',
            tokens: result.featuredObjectiveCompleted ? ['objective', 'reward', 'momentum'] : ['objective', 'forfeit', 'risk']
        });
    }

    if (result.endlessRiskWagerOutcome) {
        rows.push({
            id: 'risk_wager',
            group: 'objective',
            label: 'Risk wager',
            detail:
                result.endlessRiskWagerOutcome === 'won'
                    ? `Won for +${result.endlessRiskWagerFavorGained ?? 0} Favor.`
                    : `Lost; streak reduced by ${result.endlessRiskWagerStreakLost ?? 0}.`,
            tokens: result.endlessRiskWagerOutcome === 'won' ? ['risk', 'reward', 'momentum'] : ['risk', 'forfeit']
        });
    }

    if (result.bossTrophyCacheOutcome) {
        rows.push({
            id: 'boss_trophy_cache',
            group: 'reward',
            label: 'Boss trophy',
            detail:
                result.bossTrophyCacheOutcome === 'claimed'
                    ? `Boss objective completed; trophy cache paid +${result.bossTrophyCacheScore ?? 0} score.`
                    : 'Boss objective unresolved; trophy cache was forfeited.',
            tokens:
                result.bossTrophyCacheOutcome === 'claimed'
                    ? ['objective', 'reward', 'momentum']
                    : ['objective', 'forfeit', 'risk']
        });
    }

    if (result.hazardTileTriggers) {
        const parts = [
            result.hazardShuffleSnares ? `${result.hazardShuffleSnares} snare shuffle${result.hazardShuffleSnares === 1 ? '' : 's'}` : null,
            result.hazardCascadeCaches ? `${result.hazardCascadeCaches} cascade clear${result.hazardCascadeCaches === 1 ? '' : 's'}` : null,
            result.hazardMirrorDecoys ? `${result.hazardMirrorDecoys} mirror decoy read${result.hazardMirrorDecoys === 1 ? '' : 's'}` : null,
            result.hazardFragileCacheClaims
                ? `${result.hazardFragileCacheClaims} fragile cache claim${result.hazardFragileCacheClaims === 1 ? '' : 's'}`
                : null,
            result.hazardFragileCacheBreaks
                ? `${result.hazardFragileCacheBreaks} fragile cache break${result.hazardFragileCacheBreaks === 1 ? '' : 's'}`
                : null,
            result.hazardTollCaches ? `${result.hazardTollCaches} toll cache claim${result.hazardTollCaches === 1 ? '' : 's'}` : null,
            result.hazardFuseCaches
                ? `${result.hazardFuseCaches} fuse cache claim${result.hazardFuseCaches === 1 ? '' : 's'}${
                      result.hazardFuseCacheExpiredClaims
                          ? ` (${result.hazardFuseCacheExpiredClaims} late)`
                          : ''
                  }`
                : null
        ].filter((part): part is string => part != null);
        rows.push({
            id: 'hazard_tiles',
            group: 'hazard',
            label: 'Hazard tiles',
            detail: withAtmosphere(
                parts.length > 0 ? parts.join('; ') + '.' : `${result.hazardTileTriggers} hazard trigger${result.hazardTileTriggers === 1 ? '' : 's'}.`,
                'Hazard marks woke under the cards.'
            ),
            tokens: ['risk', 'hidden_known', 'momentum']
        });
    }

    if (result.lanternWardScouts) {
        rows.push({
            id: 'lantern_ward_scouts',
            group: 'reward',
            label: 'Lantern Ward',
            detail: withAtmosphere(
                `${result.lanternWardScouts} lantern scout${result.lanternWardScouts === 1 ? '' : 's'} identified hidden danger or mystery information.`,
                'The light left a readable mark in the room log.'
            ),
            tokens: ['safe', 'hidden_known', 'reward']
        });
    }

    if (result.omenSealScouts) {
        rows.push({
            id: 'omen_seal_scouts',
            group: 'reward',
            label: 'Omen Seal',
            detail: withAtmosphere(
                `${result.omenSealScouts} omen scout${result.omenSealScouts === 1 ? '' : 's'} revealed hidden danger or mystery information.`,
                'The seal wrote the warning before the cards forgot it.'
            ),
            tokens: ['hidden_known', 'reward', 'risk']
        });
    }

    if (result.mimicCacheClaims) {
        rows.push({
            id: 'mimic_cache_claims',
            group: result.mimicCacheBites ? 'hazard' : 'reward',
            label: 'Mimic Cache',
            detail: `${result.mimicCacheClaims} mimic cache claim${result.mimicCacheClaims === 1 ? '' : 's'}${
                result.mimicCacheBites
                    ? `; ${result.mimicCacheBites} bite${result.mimicCacheBites === 1 ? '' : 's'} triggered reduced loot`
                    : '; all controlled for full loot'
            }.`,
            tokens: result.mimicCacheBites ? ['risk', 'reward', 'forfeit'] : ['hidden_known', 'reward', 'safe']
        });
    }

    if (result.anchorSealUses) {
        rows.push({
            id: 'anchor_seal_uses',
            group: 'assist',
            label: 'Anchor Seal',
            detail: `${result.anchorSealUses} pressure rotation${result.anchorSealUses === 1 ? '' : 's'} frozen.`,
            tokens: ['safe', 'resolved', 'risk']
        });
    }

    if (result.loadedGatewayPlans) {
        rows.push({
            id: 'loaded_gateway_plans',
            group: 'reward',
            label: 'Loaded Gateway',
            detail: `${result.loadedGatewayPlans} deterministic route branch${result.loadedGatewayPlans === 1 ? '' : 'es'} loaded.`,
            tokens: ['risk', 'reward', 'hidden_known']
        });
    }

    if (result.catalystAltarUpgrades) {
        rows.push({
            id: 'catalyst_altar_upgrades',
            group: 'reward',
            label: 'Catalyst Altar',
            detail: `${result.catalystAltarUpgrades} shard upgrade${result.catalystAltarUpgrades === 1 ? '' : 's'} converted into reward.`,
            tokens: ['cost', 'reward', 'momentum']
        });
    }

    if (result.parasiteVesselConversions) {
        rows.push({
            id: 'parasite_vessel_conversions',
            group: 'assist',
            label: 'Parasite Vessel',
            detail: `${result.parasiteVesselConversions} parasite pressure conversion${result.parasiteVesselConversions === 1 ? '' : 's'} resolved.`,
            tokens: ['risk', 'reward', 'momentum']
        });
    }

    if (result.pinLatticeRewards) {
        rows.push({
            id: 'pin_lattice_rewards',
            group: 'reward',
            label: 'Pin Lattice',
            detail: `${result.pinLatticeRewards} deliberate pin payoff${result.pinLatticeRewards === 1 ? '' : 's'} claimed.`,
            tokens: ['hidden_known', 'momentum', 'cost']
        });
    }

    if (result.safeHazardWardsUsed) {
        rows.push({
            id: 'safe_hazard_wards',
            group: 'assist',
            label: 'Guard Cache ward',
            detail: withAtmosphere(
                `${result.safeHazardWardsUsed} hazard ward${result.safeHazardWardsUsed === 1 ? '' : 's'} blocked a snare or fragile cache break.`,
                'The room kept one guarded memory intact.'
            ),
            tokens: ['safe', 'risk', 'hidden_known']
        });
    }

    if (result.recallMatches || result.recallMistakes || result.recallBonusScore) {
        const matchCount = result.recallMatches ?? 0;
        const mistakeCount = result.recallMistakes ?? 0;
        const score = result.recallBonusScore ?? 0;
        rows.push({
            id: 'recall_focus',
            group: 'performance',
            label: 'Recall focus',
            detail: withAtmosphere(
                `${matchCount} remembered match${matchCount === 1 ? '' : 'es'}; ${mistakeCount} recall lapse${mistakeCount === 1 ? '' : 's'}; +${score.toLocaleString()} memory score.`,
                'Room log updated.'
            ),
            tokens: mistakeCount > 0 ? ['momentum', 'risk', 'reward'] : ['momentum', 'safe', 'reward']
        });
    }

    rows.push({
        id: 'perfect_memory',
        group: 'assist',
        label: 'Perfect Memory',
        detail: powersUsedThisRun
            ? 'Locked by an assist used this run.'
            : 'Still eligible if the run also clears with zero mismatches.',
        tokens: powersUsedThisRun ? ['forfeit', 'cost'] : ['safe', 'objective']
    });

    if (result.routeChoices?.length) {
        const choiceLabels = result.routeChoices.map((choice) => choice.label).join(', ');
        rows.push({
            id: 'route_choice',
            group: 'route',
            label: 'Next route',
            detail: withAtmosphere(
                `${result.routeChoices.length} connected room choice${result.routeChoices.length === 1 ? '' : 's'} opened in the route archive: ${choiceLabels}.`,
                'The next route is now written into the archive margin.'
            ),
            tokens: ['objective', 'reward', 'risk']
        });
    }

    return rows;
};
