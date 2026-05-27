import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { RouteNodeType, RouteSideRoomState } from '../../shared/contracts';
import { focusFirstTabbableOrContainer, handleTabFocusTrapEvent } from '../a11y/focusables';
import { popModalFocusSnapshot, pushModalFocusSnapshot } from '../a11y/modalFocusReturnStack';
import {
    playUiBackSfx,
    playUiConfirmSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import { OverlayActionDock } from '../ui';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import styles from './SideRoomScreen.module.css';

const routeLabel = (routeType: RouteNodeType): string =>
    routeType === 'safe' ? 'Safe route' : routeType === 'greed' ? 'Greedy route' : 'Mystery route';

const sideRoomNodeKindStamp = (sideRoom: RouteSideRoomState): string => {
    if (sideRoom.nodeKind) {
        return sideRoom.nodeKind;
    }
    if (sideRoom.kind === 'run_event') {
        return 'event';
    }
    if (sideRoom.kind === 'rest_shrine') {
        return 'rest';
    }
    return sideRoom.routeType === 'greed' ? 'treasure' : sideRoom.routeType;
};

const rewardFeedbackSegments = (sideRoom: RouteSideRoomState): { label: string; kind: 'gain' | 'capped' | 'neutral' }[] => {
    if (sideRoom.kind !== 'bonus_reward') {
        return [];
    }
    return sideRoom.primaryDetail
        .split(';')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((label) => ({
            label,
            kind: label.startsWith('+')
                ? 'gain'
                : /already full|unavailable|exhausted/i.test(label)
                  ? 'capped'
                  : 'neutral'
        }));
};

const SideRoomScreen = () => {
    const rootRef = useRef<HTMLElement | null>(null);
    const { claimSideRoomChoice, claimSideRoomPrimary, run, settings, skipSideRoom } = useAppStore(
        useShallow((state) => ({
            claimSideRoomChoice: state.claimSideRoomChoice,
            claimSideRoomPrimary: state.claimSideRoomPrimary,
            run: state.run,
            settings: state.settings,
            skipSideRoom: state.skipSideRoom
        }))
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);

    useEffect(() => {
        pushModalFocusSnapshot();
        const frame = window.requestAnimationFrame(() => {
            focusFirstTabbableOrContainer(rootRef.current);
        });
        return () => {
            window.cancelAnimationFrame(frame);
            popModalFocusSnapshot();
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                event.preventDefault();
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                skipSideRoom();
                return;
            }
            handleTabFocusTrapEvent(event, rootRef.current);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [skipSideRoom, uiGain]);

    if (!run || run.status !== 'levelComplete' || !run.sideRoom) {
        return null;
    }

    const sideRoom = run.sideRoom;
    const nodeKindStamp = sideRoomNodeKindStamp(sideRoom);
    const rewardSegments = rewardFeedbackSegments(sideRoom);

    return (
        <section
            aria-label="Route side room"
            aria-modal="true"
            className={styles.overlay}
            data-node-kind={nodeKindStamp}
            data-route-type={sideRoom.routeType}
            data-side-room-kind={sideRoom.kind}
            data-testid="side-room-screen"
            ref={rootRef}
            role="dialog"
            style={GAMEPLAY_VISUAL_CSS_VARS}
            tabIndex={-1}
        >
            <div className={styles.shell}>
                <header className={styles.header}>
                    <span className={styles.eyebrow}>
                        {routeLabel(sideRoom.routeType)} / Floor {sideRoom.floor}
                    </span>
                    <h2>{sideRoom.title}</h2>
                    <p>{sideRoom.body}</p>
                </header>

                <div className={styles.rewardPanel} data-testid="side-room-reward-panel">
                    <strong>{sideRoom.primaryLabel}</strong>
                    <p className={styles.rewardText}>{sideRoom.primaryDetail}</p>
                    {rewardSegments.length > 1 ? (
                        <ul
                            aria-label="Reward feedback breakdown"
                            className={styles.rewardFeedbackList}
                            data-testid="side-room-reward-feedback"
                        >
                            {rewardSegments.map((segment, index) => (
                                <li data-reward-feedback-kind={segment.kind} key={`${segment.kind}:${index}:${segment.label}`}>
                                    {segment.label}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {sideRoom.choices && sideRoom.choices.length > 0 ? (
                        <div className={styles.choiceList}>
                            {sideRoom.choices.map((choice) => (
                                <div
                                    className={styles.choiceRow}
                                    data-choice-id={choice.id}
                                    data-choice-primary={choice.primary ? 'true' : 'false'}
                                    data-testid={`side-room-choice-${choice.id}`}
                                    key={choice.id}
                                >
                                    <strong>{choice.label}</strong>
                                    <p>{choice.detail}</p>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                <footer className={styles.actions}>
                    <OverlayActionDock
                        actions={[
                            ...(sideRoom.choices || sideRoom.skipLabel !== sideRoom.primaryLabel
                                ? [
                                      {
                                          label: sideRoom.skipLabel,
                                          onClick: () => {
                                              resumeUiSfxContext();
                                              playUiBackSfx(uiGain);
                                              skipSideRoom();
                                          },
                                          variant: 'secondary' as const
                                      }
                                  ]
                                : []),
                            ...(sideRoom.choices && sideRoom.choices.length > 0
                                ? sideRoom.choices.map((choice) => ({
                                      label: choice.label,
                                      onClick: () => {
                                          resumeUiSfxContext();
                                          playUiConfirmSfx(uiGain);
                                          claimSideRoomChoice(choice.id);
                                      },
                                      variant: choice.primary ? ('primary' as const) : ('secondary' as const)
                                  }))
                                : [
                                      {
                                          label: sideRoom.primaryLabel,
                                          onClick: () => {
                                              resumeUiSfxContext();
                                              playUiConfirmSfx(uiGain);
                                              claimSideRoomPrimary();
                                          },
                                          variant: 'primary' as const
                                      }
                                  ])
                        ]}
                        placement="dock"
                        testId="side-room-action-dock"
                    />
                </footer>
            </div>
        </section>
    );
};

export default SideRoomScreen;
