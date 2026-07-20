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

const nonNegativePresentationCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const getFloorClearCausalityRows = (
    result: LevelResult,
    powersUsedThisRun: boolean,
    floorIdentity?: FloorIdentityContract | null
): FloorClearCausalityRow[] => {
    const mistakes = nonNegativePresentationCount(result.mistakes);
    const scoreGained = nonNegativePresentationCount(result.scoreGained);
    const objectiveBonusScore = nonNegativePresentationCount(result.objectiveBonusScore);
    const relicFavorGained = nonNegativePresentationCount(result.relicFavorGained);
    const endlessRiskWagerFavorGained = nonNegativePresentationCount(result.endlessRiskWagerFavorGained);
    const endlessRiskWagerStreakLost = nonNegativePresentationCount(result.endlessRiskWagerStreakLost);
    const bossTrophyCacheScore = nonNegativePresentationCount(result.bossTrophyCacheScore);
    const hazardTileTriggers = nonNegativePresentationCount(result.hazardTileTriggers);
    const hazardShuffleSnares = nonNegativePresentationCount(result.hazardShuffleSnares);
    const hazardCascadeCaches = nonNegativePresentationCount(result.hazardCascadeCaches);
    const hazardMirrorDecoys = nonNegativePresentationCount(result.hazardMirrorDecoys);
    const hazardFragileCacheClaims = nonNegativePresentationCount(result.hazardFragileCacheClaims);
    const hazardFragileCacheBreaks = nonNegativePresentationCount(result.hazardFragileCacheBreaks);
    const hazardTollCaches = nonNegativePresentationCount(result.hazardTollCaches);
    const hazardFuseCaches = nonNegativePresentationCount(result.hazardFuseCaches);
    const hazardFuseCacheExpiredClaims = nonNegativePresentationCount(result.hazardFuseCacheExpiredClaims);
    const lanternWardScouts = nonNegativePresentationCount(result.lanternWardScouts);
    const omenSealScouts = nonNegativePresentationCount(result.omenSealScouts);
    const mimicCacheClaims = nonNegativePresentationCount(result.mimicCacheClaims);
    const mimicCacheBites = nonNegativePresentationCount(result.mimicCacheBites);
    const anchorSealUses = nonNegativePresentationCount(result.anchorSealUses);
    const loadedGatewayPlans = nonNegativePresentationCount(result.loadedGatewayPlans);
    const catalystAltarUpgrades = nonNegativePresentationCount(result.catalystAltarUpgrades);
    const parasiteVesselConversions = nonNegativePresentationCount(result.parasiteVesselConversions);
    const pinLatticeRewards = nonNegativePresentationCount(result.pinLatticeRewards);
    const safeHazardWardsUsed = nonNegativePresentationCount(result.safeHazardWardsUsed);
    const recallMatches = nonNegativePresentationCount(result.recallMatches);
    const recallMistakes = nonNegativePresentationCount(result.recallMistakes);
    const recallBonusScore = nonNegativePresentationCount(result.recallBonusScore);
    const rows: FloorClearCausalityRow[] = [
        {
            id: 'performance_score',
            group: 'performance',
            label: 'Performance',
            detail: `Rating ${result.rating}; ${mistakes} mistake${mistakes === 1 ? '' : 's'}; +${scoreGained.toLocaleString()} score.`,
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
                ? `Completed for +${objectiveBonusScore} score and +${relicFavorGained} Favor.`
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
                    ? `Won for +${endlessRiskWagerFavorGained} Favor.`
                    : `Lost; streak reduced by ${endlessRiskWagerStreakLost}.`,
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
                    ? `Boss objective completed; trophy cache paid +${bossTrophyCacheScore} score.`
                    : 'Boss objective unresolved; trophy cache was forfeited.',
            tokens:
                result.bossTrophyCacheOutcome === 'claimed'
                    ? ['objective', 'reward', 'momentum']
                    : ['objective', 'forfeit', 'risk']
        });
    }

    if (hazardTileTriggers > 0) {
        const parts = [
            hazardShuffleSnares > 0 ? `${hazardShuffleSnares} snare shuffle${hazardShuffleSnares === 1 ? '' : 's'}` : null,
            hazardCascadeCaches > 0 ? `${hazardCascadeCaches} cascade clear${hazardCascadeCaches === 1 ? '' : 's'}` : null,
            hazardMirrorDecoys > 0 ? `${hazardMirrorDecoys} mirror decoy read${hazardMirrorDecoys === 1 ? '' : 's'}` : null,
            hazardFragileCacheClaims > 0
                ? `${hazardFragileCacheClaims} fragile cache claim${hazardFragileCacheClaims === 1 ? '' : 's'}`
                : null,
            hazardFragileCacheBreaks > 0
                ? `${hazardFragileCacheBreaks} fragile cache break${hazardFragileCacheBreaks === 1 ? '' : 's'}`
                : null,
            hazardTollCaches > 0 ? `${hazardTollCaches} toll cache claim${hazardTollCaches === 1 ? '' : 's'}` : null,
            hazardFuseCaches > 0
                ? `${hazardFuseCaches} fuse cache claim${hazardFuseCaches === 1 ? '' : 's'}${
                      hazardFuseCacheExpiredClaims > 0
                          ? ` (${hazardFuseCacheExpiredClaims} late)`
                          : ''
                  }`
                : null
        ].filter((part): part is string => part != null);
        rows.push({
            id: 'hazard_tiles',
            group: 'hazard',
            label: 'Hazard tiles',
            detail: withAtmosphere(
                parts.length > 0 ? parts.join('; ') + '.' : `${hazardTileTriggers} hazard trigger${hazardTileTriggers === 1 ? '' : 's'}.`,
                'Hazard marks woke under the cards.'
            ),
            tokens: ['risk', 'hidden_known', 'momentum']
        });
    }

    if (lanternWardScouts > 0) {
        rows.push({
            id: 'lantern_ward_scouts',
            group: 'reward',
            label: 'Lantern Ward',
            detail: withAtmosphere(
                `${lanternWardScouts} lantern scout${lanternWardScouts === 1 ? '' : 's'} identified hidden danger or mystery information.`,
                'The light left a readable mark in the room log.'
            ),
            tokens: ['safe', 'hidden_known', 'reward']
        });
    }

    if (omenSealScouts > 0) {
        rows.push({
            id: 'omen_seal_scouts',
            group: 'reward',
            label: 'Omen Seal',
            detail: withAtmosphere(
                `${omenSealScouts} omen scout${omenSealScouts === 1 ? '' : 's'} revealed hidden danger or mystery information.`,
                'The seal wrote the warning before the cards forgot it.'
            ),
            tokens: ['hidden_known', 'reward', 'risk']
        });
    }

    if (mimicCacheClaims > 0) {
        rows.push({
            id: 'mimic_cache_claims',
            group: mimicCacheBites > 0 ? 'hazard' : 'reward',
            label: 'Mimic Cache',
            detail: `${mimicCacheClaims} mimic cache claim${mimicCacheClaims === 1 ? '' : 's'}${
                mimicCacheBites > 0
                    ? `; ${mimicCacheBites} bite${mimicCacheBites === 1 ? '' : 's'} triggered reduced loot`
                    : '; all controlled for full loot'
            }.`,
            tokens: mimicCacheBites > 0 ? ['risk', 'reward', 'forfeit'] : ['hidden_known', 'reward', 'safe']
        });
    }

    if (anchorSealUses > 0) {
        rows.push({
            id: 'anchor_seal_uses',
            group: 'assist',
            label: 'Anchor Seal',
            detail: `${anchorSealUses} pressure rotation${anchorSealUses === 1 ? '' : 's'} frozen.`,
            tokens: ['safe', 'resolved', 'risk']
        });
    }

    if (loadedGatewayPlans > 0) {
        rows.push({
            id: 'loaded_gateway_plans',
            group: 'reward',
            label: 'Loaded Gateway',
            detail: `${loadedGatewayPlans} deterministic route branch${loadedGatewayPlans === 1 ? '' : 'es'} loaded.`,
            tokens: ['risk', 'reward', 'hidden_known']
        });
    }

    if (catalystAltarUpgrades > 0) {
        rows.push({
            id: 'catalyst_altar_upgrades',
            group: 'reward',
            label: 'Catalyst Altar',
            detail: `${catalystAltarUpgrades} shard upgrade${catalystAltarUpgrades === 1 ? '' : 's'} converted into reward.`,
            tokens: ['cost', 'reward', 'momentum']
        });
    }

    if (parasiteVesselConversions > 0) {
        rows.push({
            id: 'parasite_vessel_conversions',
            group: 'assist',
            label: 'Parasite Vessel',
            detail: `${parasiteVesselConversions} parasite pressure conversion${parasiteVesselConversions === 1 ? '' : 's'} resolved.`,
            tokens: ['risk', 'reward', 'momentum']
        });
    }

    if (pinLatticeRewards > 0) {
        rows.push({
            id: 'pin_lattice_rewards',
            group: 'reward',
            label: 'Pin Lattice',
            detail: `${pinLatticeRewards} deliberate pin payoff${pinLatticeRewards === 1 ? '' : 's'} claimed.`,
            tokens: ['hidden_known', 'momentum', 'cost']
        });
    }

    if (safeHazardWardsUsed > 0) {
        rows.push({
            id: 'safe_hazard_wards',
            group: 'assist',
            label: 'Guard Cache ward',
            detail: withAtmosphere(
                `${safeHazardWardsUsed} hazard ward${safeHazardWardsUsed === 1 ? '' : 's'} blocked a snare or fragile cache break.`,
                'The room kept one guarded memory intact.'
            ),
            tokens: ['safe', 'risk', 'hidden_known']
        });
    }

    if (recallMatches > 0 || recallMistakes > 0 || recallBonusScore > 0) {
        rows.push({
            id: 'recall_focus',
            group: 'performance',
            label: 'Recall focus',
            detail: withAtmosphere(
                `${recallMatches} remembered match${recallMatches === 1 ? '' : 'es'}; ${recallMistakes} recall lapse${recallMistakes === 1 ? '' : 's'}; +${recallBonusScore.toLocaleString()} memory score.`,
                'Room log updated.'
            ),
            tokens: recallMistakes > 0 ? ['momentum', 'risk', 'reward'] : ['momentum', 'safe', 'reward']
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
