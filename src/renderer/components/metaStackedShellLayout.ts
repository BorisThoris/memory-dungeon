import metaStyles from './MetaScreen.module.css';

type MetaSubscreenTitleLevel = 'h1' | 'h2';

interface MetaInRunFramedPanelClasses {
    readonly panel: string;
    readonly hero: string;
}

/**
 * Shared layout decisions for Codex / Inventory (and future meta subscreens) when
 * `stackedOnGameplay` renders inside GameScreen with a desk modal.
 */
export function getMetaSubscreenLayout(
    stackedOnGameplay: boolean,
    inRunFramed: MetaInRunFramedPanelClasses
): {
    shellStageClass: string;
    panelClassName: string;
    heroPanelClassName: string;
    titleLevel: MetaSubscreenTitleLevel;
} {
    return {
        shellStageClass: stackedOnGameplay ? metaStyles.shellInRunModal : metaStyles.shellMetaStage,
        panelClassName: stackedOnGameplay ? inRunFramed.panel : '',
        heroPanelClassName: stackedOnGameplay ? inRunFramed.hero : '',
        titleLevel: stackedOnGameplay ? 'h2' : 'h1'
    };
}
