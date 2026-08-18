import type { ComponentProps } from 'react';
import TileBoardBoardStatusChips from './TileBoardBoardStatusChips';
import TileBoardChainOpportunityChip from './TileBoardChainOpportunityChip';
import TileBoardOpportunityCompass from './TileBoardOpportunityCompass';
import TileBoardOpportunityLaneMap from './TileBoardOpportunityLaneMap';
import TileBoardTraitPreviewChip from './TileBoardTraitPreviewChip';

interface TileBoardFeedbackOverlayProps {
    boardChainOpportunityLinesLength: number;
    boardChainOpportunitySurfaceView: ComponentProps<typeof TileBoardChainOpportunityChip>;
    boardOpportunityCompassView: Omit<ComponentProps<typeof TileBoardOpportunityCompass>, 'children'>;
    boardOpportunityLaneMapView: ComponentProps<typeof TileBoardOpportunityLaneMap>;
    boardStatusChipsView: ComponentProps<typeof TileBoardBoardStatusChips>;
    compact?: boolean;
    focusedPreviewChipProps: ComponentProps<typeof TileBoardTraitPreviewChip>;
}

const TileBoardFeedbackOverlay = ({
    boardChainOpportunityLinesLength,
    boardChainOpportunitySurfaceView,
    boardOpportunityCompassView,
    boardOpportunityLaneMapView,
    boardStatusChipsView,
    compact = false,
    focusedPreviewChipProps
}: TileBoardFeedbackOverlayProps) => {
    const showChainOpportunityChip =
        boardChainOpportunityLinesLength > 0 && (!compact || boardOpportunityCompassView.rows.length === 0);

    return (
        <>
            {showChainOpportunityChip ? (
                <TileBoardChainOpportunityChip {...boardChainOpportunitySurfaceView} compact={compact} />
            ) : null}
            <TileBoardBoardStatusChips {...boardStatusChipsView} compact={compact} />
            <TileBoardOpportunityCompass {...boardOpportunityCompassView} compact={compact}>
                <TileBoardOpportunityLaneMap {...boardOpportunityLaneMapView} compact={compact} />
            </TileBoardOpportunityCompass>
            <TileBoardTraitPreviewChip {...focusedPreviewChipProps} compact={compact} />
        </>
    );
};

export default TileBoardFeedbackOverlay;
