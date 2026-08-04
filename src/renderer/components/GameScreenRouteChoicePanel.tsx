import { RECALL_FOCUS_MAX } from '../../shared/contracts';
import styles from './GameScreen.module.css';
import type {
    GameScreenRouteChoiceCardProjection,
    GameScreenRouteChoiceProjection
} from './useGameScreenRouteChoiceProjection';

interface GameScreenRouteChoicePanelProps {
    onChooseRoute: (choiceId: string) => void;
    projection: GameScreenRouteChoiceProjection;
}

const RouteChoiceCard = ({
    card,
    onChooseRoute
}: {
    card: GameScreenRouteChoiceCardProjection;
    onChooseRoute: (choiceId: string) => void;
}) => {
    const {
        actionCue,
        actionCueLabel,
        ariaLabel,
        availability,
        beatCue,
        beatCueLabel,
        decisionStack,
        decisionStackLabel,
        firstRouteTeachingLabel,
        impactCue,
        impactCueLabel,
        memoryChoice,
        payoffRows,
        payoffsLabel,
        primaryPayoff,
        recipeLabel,
        recipeSteps,
        recipeValue,
        row,
        signalRows,
        signalsLabel
    } = card;

    return (
        <button
            aria-label={ariaLabel}
            className={styles.dungeonMapRoomButton}
            disabled={!availability.available}
            data-route-beat-action={beatCue.action}
            data-route-beat-audio={beatCue.audioCue}
            data-route-beat-count={beatCue.beatCount}
            data-route-beat-cue={beatCue.label}
            data-route-beat-screen-cue={beatCue.screenCue}
            data-route-beat-tier={beatCue.tier}
            data-route-impact-cue={impactCue.label}
            data-route-impact-cue-tone={impactCue.tone}
            data-route-next-action={actionCue.action}
            data-route-next-action-tone={actionCue.tone}
            data-route-primary-payoff={primaryPayoff?.value ?? 'none'}
            data-route-primary-payoff-audio={primaryPayoff?.audioCue ?? 'none'}
            data-route-primary-payoff-beats={primaryPayoff?.beatCount ?? 0}
            data-route-primary-payoff-id={primaryPayoff?.id ?? 'none'}
            data-route-primary-payoff-screen-cue={primaryPayoff?.screenCue ?? 'none'}
            data-route-primary-payoff-tone={primaryPayoff?.tone ?? 'none'}
            data-route-recipe={recipeValue}
            data-route-type={row.routeType}
            data-testid={`route-choice-${row.routeType}`}
            data-tone={row.tone}
            onClick={() => {
                if (availability.available) onChooseRoute(row.id);
            }}
            type="button"
        >
            <span className={styles.dungeonMapRoomGlyph}>{row.glyph}</span>
            <span className={styles.dungeonMapRoomCopy}>
                <strong>{row.choiceLabel}</strong>
                <span
                    aria-label={impactCueLabel}
                    className={styles.dungeonMapRoomImpactCue}
                    data-route-impact-cue-tone={impactCue.tone}
                    data-testid={`route-choice-${row.routeType}-impact-cue`}
                >
                    <small>{impactCue.label}</small>
                    <strong>{impactCue.value}</strong>
                </span>
                <span
                    aria-label={actionCueLabel}
                    className={styles.dungeonMapRoomActionCue}
                    data-route-action-tone={actionCue.tone}
                    data-testid={`route-choice-${row.routeType}-action-cue`}
                >
                    <small>{actionCue.label}</small>
                    <strong>{actionCue.action}</strong>
                    <em>{actionCue.detail}</em>
                </span>
                <span
                    aria-label={signalsLabel}
                    className={styles.dungeonMapRoomSignalRow}
                    data-testid={`route-choice-${row.routeType}-signals`}
                >
                    {signalRows.map((signal) => (
                        <span
                            data-route-signal={signal.id}
                            data-route-signal-audio={signal.audioCue}
                            data-route-signal-beats={signal.beatCount}
                            data-route-signal-screen-cue={signal.screenCue}
                            key={signal.id}
                        >
                            {signal.label}
                            <span aria-hidden="true" className={styles.dungeonMapRoomSignalBeatPips}>
                                {Array.from({ length: signal.beatCount }, (_, index) => (
                                    <i
                                        data-route-choice-signal-beat={index + 1}
                                        data-route-choice-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
                <span
                    aria-label={beatCueLabel}
                    className={styles.dungeonMapRoomBeatCue}
                    data-route-beat-action={beatCue.action}
                    data-route-beat-audio={beatCue.audioCue}
                    data-route-beat-screen-cue={beatCue.screenCue}
                    data-route-beat-tier={beatCue.tier}
                    data-testid={`route-choice-${row.routeType}-beat-cue`}
                >
                    <small>{beatCue.label}</small>
                    <span aria-hidden="true" className={styles.dungeonMapRoomBeatPips}>
                        {Array.from({ length: beatCue.beatCount }, (_, index) => (
                            <i
                                data-route-beat-pip={index + 1}
                                data-route-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <strong>{beatCue.action}</strong>
                    <em>{beatCue.detail}</em>
                </span>
                <span
                    aria-label={payoffsLabel}
                    className={styles.dungeonMapRoomPayoffRows}
                    data-route-primary-payoff={primaryPayoff?.value ?? 'none'}
                    data-route-primary-payoff-audio={primaryPayoff?.audioCue ?? 'none'}
                    data-route-primary-payoff-id={primaryPayoff?.id ?? 'none'}
                    data-route-primary-payoff-screen-cue={primaryPayoff?.screenCue ?? 'none'}
                    data-route-primary-payoff-tone={primaryPayoff?.tone ?? 'none'}
                    data-testid={`route-choice-${row.routeType}-payoffs`}
                >
                    {primaryPayoff ? (
                        <span
                            aria-label={`Primary route payoff. ${primaryPayoff.ariaLabel}`}
                            data-route-primary-payoff-audio={primaryPayoff.audioCue}
                            data-route-primary-payoff-beats={primaryPayoff.beatCount}
                            data-route-primary-payoff-id={primaryPayoff.id}
                            data-route-primary-payoff-screen-cue={primaryPayoff.screenCue}
                            data-route-primary-payoff-tone={primaryPayoff.tone}
                            data-testid={`route-choice-${row.routeType}-primary-payoff`}
                        >
                            <small>Primary payoff</small>
                            <strong>{primaryPayoff.value}</strong>
                            <em>{primaryPayoff.label}</em>
                            <span aria-hidden="true" className={styles.dungeonMapRoomPrimaryPayoffBeatPips}>
                                {Array.from({ length: primaryPayoff.beatCount }, (_, index) => (
                                    <i
                                        data-route-primary-payoff-beat={index + 1}
                                        data-route-primary-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    {payoffRows.map((payoff) => (
                        <span
                            data-route-payoff-audio={payoff.audioCue}
                            data-route-payoff-beats={payoff.beatCount}
                            data-route-payoff-id={payoff.id}
                            data-route-payoff-screen-cue={payoff.screenCue}
                            data-route-payoff-tone={payoff.tone}
                            key={payoff.id}
                        >
                            <small>{payoff.label}</small>
                            <strong>{payoff.value}</strong>
                            <span aria-hidden="true" className={styles.dungeonMapRoomPayoffBeatPips}>
                                {Array.from({ length: payoff.beatCount }, (_, index) => (
                                    <i
                                        data-route-payoff-beat={index + 1}
                                        data-route-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
                <span
                    aria-label={decisionStackLabel}
                    className={styles.dungeonMapRoomDecisionStack}
                    data-route-decision-stack-tone={decisionStack.tone}
                    data-testid={`route-choice-${row.routeType}-decision-stack`}
                >
                    <small>{decisionStack.label}</small>
                    <strong>{decisionStack.value}</strong>
                    <em>{decisionStack.nextCue}</em>
                </span>
                <span
                    aria-label={recipeLabel}
                    className={styles.dungeonMapRoomRecipe}
                    data-route-recipe-tone={decisionStack.tone}
                    data-testid={`route-choice-${row.routeType}-recipe`}
                >
                    {recipeSteps.map((step) => (
                        <span data-route-recipe-step={step.id} key={step.id}>
                            <small>{step.label}</small>
                            <strong>{step.value}</strong>
                        </span>
                    ))}
                </span>
                {row.approachLabel ? (
                    <small className={styles.dungeonMapRoomApproach}>Approach: {row.approachLabel}</small>
                ) : null}
                <small>{row.nodeLabel}: {row.mechanic}</small>
                <em>Reward: {row.reward}</em>
                {firstRouteTeachingLabel ? (
                    <small className={styles.dungeonMapRoomTeaching}>{firstRouteTeachingLabel}</small>
                ) : null}
                {memoryChoice ? (
                    <>
                        <small className={styles.dungeonMapRoomMemory}>Memory: {memoryChoice.memoryPrompt}</small>
                        <small className={styles.dungeonMapRoomMemory}>Recall: {memoryChoice.readinessLabel}</small>
                        <small className={styles.dungeonMapRoomMemory}>Atmosphere: {memoryChoice.atmosphericCue}</small>
                    </>
                ) : null}
            </span>
            <span className={styles.dungeonMapRoomRisk}>
                {availability.available ? `Risk: ${row.risk}` : availability.label}
            </span>
        </button>
    );
};

export const GameScreenRouteChoicePanel = ({
    onChooseRoute,
    projection
}: GameScreenRouteChoicePanelProps) => {
    if (!projection.routeChoiceRequired) return null;
    const {
        cards,
        dungeonMapPresentation,
        memoryRecallFeedback,
        memoryRecallPanelRows,
        recommendation,
        routeChoiceRequiredCopy,
        summary,
        visibleDungeonMapNodes
    } = projection;

    return (
        <section
            aria-labelledby="dungeon-route-choice-title"
            className={styles.dungeonMapChoicePanel}
            data-decision-state="required"
            data-testid="route-choice-panel"
        >
            <div className={styles.dungeonMapChoiceHeader}>
                <span>Dungeon map</span>
                <strong id="dungeon-route-choice-title">Choose the next room</strong>
                <small>Act {dungeonMapPresentation.act} / boss at depth {dungeonMapPresentation.bossFloor}</small>
            </div>
            <p className={styles.dungeonMapChoiceInstruction} data-testid="route-choice-required-copy">
                {routeChoiceRequiredCopy}
            </p>
            <span className={styles.dungeonMapChoiceSummary}>{summary}</span>
            {recommendation ? (
                <span
                    aria-label={recommendation.ariaLabel}
                    className={styles.dungeonMapChoiceRecommendation}
                    data-route-recommendation-action={recommendation.card.actionCue.action}
                    data-route-recommendation-audio={recommendation.card.beatCue.audioCue}
                    data-route-recommendation-beats={recommendation.card.beatCue.beatCount}
                    data-route-recommendation-payoff={recommendation.card.primaryPayoff?.value ?? 'none'}
                    data-route-recommendation-route={recommendation.card.row.routeType}
                    data-route-recommendation-screen-cue={recommendation.card.beatCue.screenCue}
                    data-route-recommendation-tone={recommendation.card.decisionStack.tone}
                    data-testid="route-choice-recommendation"
                >
                    <small>Recommended route</small>
                    <strong>{recommendation.card.row.choiceLabel}</strong>
                    <em>{recommendation.card.actionCue.action}</em>
                    <span aria-hidden="true" className={styles.dungeonMapChoiceRecommendationBeatPips}>
                        {Array.from({ length: recommendation.card.beatCue.beatCount }, (_, index) => (
                            <i
                                data-route-recommendation-beat={index + 1}
                                data-route-recommendation-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    {recommendation.card.primaryPayoff ? <b>{recommendation.card.primaryPayoff.value}</b> : null}
                </span>
            ) : null}
            <section
                aria-labelledby="route-memory-read-title"
                className={styles.routeMemoryReadPanel}
                data-pressure={memoryRecallFeedback.pressure}
                data-testid="route-memory-read-panel"
            >
                <div className={styles.routeMemoryReadHeader}>
                    <span>Memory read</span>
                    <strong id="route-memory-read-title">
                        Focus {memoryRecallFeedback.focus}/{RECALL_FOCUS_MAX} - {memoryRecallFeedback.focusLabel}
                    </strong>
                    <small>{memoryRecallFeedback.atmosphericSummary}</small>
                </div>
                <div className={styles.routeMemoryReadStats} aria-label="Recall state">
                    <span>Bonus <strong>+{memoryRecallFeedback.nextCleanMatchBonus}</strong></span>
                    <span>Clues <strong>{memoryRecallFeedback.rememberedClueTileCount}</strong></span>
                    <span>Forgotten <strong>{memoryRecallFeedback.forgottenTileCount}</strong></span>
                    <span data-tone={memoryRecallFeedback.burden.tone} title={memoryRecallFeedback.burden.detail}>
                        Burden <strong>{memoryRecallFeedback.burden.label}</strong>
                    </span>
                </div>
                <p className={styles.routeMemoryReadPressure}>{memoryRecallFeedback.pressureDetail}</p>
                <p className={styles.routeMemoryReadNextMove} data-tone={memoryRecallFeedback.nextMemoryMove.tone}>
                    <strong>{memoryRecallFeedback.nextMemoryMove.label}</strong>
                    <span>{memoryRecallFeedback.nextMemoryMove.detail}</span>
                </p>
                {memoryRecallPanelRows.length > 0 ? (
                    <div className={styles.routeMemoryReadRows}>
                        {memoryRecallPanelRows.map((line) => (
                            <span className={styles.routeMemoryReadRow} data-tone={line.tone} key={line.id}>
                                <strong>{line.label}</strong>
                                <small>{line.detail}</small>
                            </span>
                        ))}
                    </div>
                ) : null}
            </section>
            <div className={styles.dungeonMapTimeline} aria-label="Dungeon map route">
                {visibleDungeonMapNodes.map((node) => (
                    <span
                        className={styles.dungeonMapTimelineNode}
                        data-status={node.status}
                        data-tone={node.tone}
                        key={node.id}
                        title={`${node.label}: ${node.risk}`}
                    >
                        <span>{node.glyph}</span>
                        <small>{node.floor}</small>
                    </span>
                ))}
            </div>
            <div className={styles.dungeonMapChoiceActions}>
                {cards.map((card) => (
                    <RouteChoiceCard card={card} key={card.row.id} onChooseRoute={onChooseRoute} />
                ))}
            </div>
        </section>
    );
};
