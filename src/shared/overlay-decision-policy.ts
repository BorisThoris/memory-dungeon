export type OverlayDecisionKind =
    | 'alert'
    | 'decision'
    | 'sheet'
    | 'pause'
    | 'floor_clear'
    | 'relic_draft'
    | 'settings_modal'
    | 'danger_confirm';

export interface OverlayDecisionPolicyRow {
    kind: OverlayDecisionKind;
    modalKind?: 'alert' | 'decision' | 'sheet';
    tone: 'pause' | 'success' | 'relic' | 'neutral' | 'danger';
    primaryAction: string;
    secondaryAction: string;
    oneHand: true;
    oneHandPlacement: string;
    keyboard: true;
    keyboardPath: string;
    backBehavior: string;
    usesExistingChrome: true;
    finalLicensedAssetRequired: false;
}

const DEFAULT_OVERLAY_DECISION_POLICY_ROW: OverlayDecisionPolicyRow = {
    kind: 'alert',
    modalKind: 'alert',
    tone: 'neutral',
    primaryAction: 'Acknowledge',
    secondaryAction: 'None',
    oneHand: true,
    oneHandPlacement: 'center sheet; action remains reachable',
    keyboard: true,
    keyboardPath: 'Tab trap + initial focus + focus restore',
    backBehavior: 'Acknowledgement closes the alert.',
    usesExistingChrome: true,
    finalLicensedAssetRequired: false
};

export const OVERLAY_DECISION_POLICY_ROWS: readonly OverlayDecisionPolicyRow[] = [
    DEFAULT_OVERLAY_DECISION_POLICY_ROW,
    {
        kind: 'decision',
        modalKind: 'decision',
        tone: 'neutral',
        primaryAction: 'Primary decision',
        secondaryAction: 'Secondary/cancel',
        oneHand: true,
        oneHandPlacement: 'sticky action rail / mobile bottom-safe area',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Secondary action preserves current context unless copy says otherwise.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'sheet',
        modalKind: 'sheet',
        tone: 'neutral',
        primaryAction: 'Inline content',
        secondaryAction: 'None',
        oneHand: true,
        oneHandPlacement: 'scrollable body with safe-area bounds',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Containing flow owns close behavior.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'pause',
        tone: 'pause',
        primaryAction: 'Resume',
        secondaryAction: 'Retreat',
        oneHand: true,
        oneHandPlacement: 'sticky action rail / mobile bottom-safe area',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'P/Escape or Resume returns to the frozen run.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'floor_clear',
        tone: 'success',
        primaryAction: 'Continue',
        secondaryAction: 'Review rewards',
        oneHand: true,
        oneHandPlacement: 'sticky action rail / mobile bottom-safe area',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Continue advances locally; status overlays are suppressed under meta screens.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'relic_draft',
        tone: 'relic',
        primaryAction: 'Pick relic',
        secondaryAction: 'Use service',
        oneHand: true,
        oneHandPlacement: 'scrollable sheet with service buttons in body',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Relic picks are required before advancing; focus remains trapped in the draft sheet.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'settings_modal',
        tone: 'neutral',
        primaryAction: 'Save',
        secondaryAction: 'Back',
        oneHand: true,
        oneHandPlacement: 'sticky footer',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Back restores prior view; unsaved changes open a confirmation decision sheet.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    },
    {
        kind: 'danger_confirm',
        tone: 'danger',
        primaryAction: 'Confirm',
        secondaryAction: 'Cancel',
        oneHand: true,
        oneHandPlacement: 'sticky action rail / mobile bottom-safe area',
        keyboard: true,
        keyboardPath: 'Tab trap + initial focus + focus restore',
        backBehavior: 'Cancel/Back keeps the current run or settings draft intact.',
        usesExistingChrome: true,
        finalLicensedAssetRequired: false
    }
];

export const getOverlayDecisionPolicyRows = (): readonly OverlayDecisionPolicyRow[] =>
    OVERLAY_DECISION_POLICY_ROWS.filter((row) => row.modalKind);

export const overlayDecisionPolicyForKind = (kind: OverlayDecisionKind): OverlayDecisionPolicyRow =>
    OVERLAY_DECISION_POLICY_ROWS.find((row) => row.kind === kind) ?? DEFAULT_OVERLAY_DECISION_POLICY_ROW;

export const getOverlayDecisionPolicyRow = overlayDecisionPolicyForKind;
