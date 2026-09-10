import {
    GameplayExitIcon,
    GameplayGreetIcon,
    GameplayPeekIcon,
    GameplayPinIcon,
    GameplayShuffleIcon,
    GameplayUndoIcon
} from '../ui/gameplayIcons';

/** Glyphs for the run shell's dock, one per board power. */
export const RUN_SHELL_GLYPHS = {
    shuffle: <GameplayShuffleIcon />,
    pin: <GameplayPinIcon />,
    peek: <GameplayPeekIcon />,
    undo: <GameplayUndoIcon />,
    greet: <GameplayGreetIcon />,
    exit: <GameplayExitIcon />
} as const;
