import { createElement } from 'react';

type BeatPipElementTag = 'i' | 's' | 'span' | 'u';
type BeatPipContainerTag = 'em' | 'span' | 'strong';
type BeatPipProps = Record<string, string | number | undefined>;

interface FeedbackBeatPipsProps {
    className?: string;
    containerTag?: BeatPipContainerTag;
    count: number;
    itemProps?: (beatIndex: number) => BeatPipProps;
    itemTag?: BeatPipElementTag;
    keyPrefix: string;
}

const FeedbackBeatPips = ({
    className,
    containerTag = 'span',
    count,
    itemProps,
    itemTag = 'i',
    keyPrefix
}: FeedbackBeatPipsProps) => {
    if (count <= 0) {
        return null;
    }

    return createElement(
        containerTag,
        {
            'aria-hidden': 'true',
            ...(className ? { className } : {})
        },
        Array.from({ length: count }, (_, beatIndex) =>
            createElement(itemTag, {
                key: `${keyPrefix}-${beatIndex + 1}`,
                ...(itemProps ? itemProps(beatIndex) : {})
            })
        )
    );
};

export default FeedbackBeatPips;
