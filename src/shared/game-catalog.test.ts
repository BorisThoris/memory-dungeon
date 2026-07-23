import { describe, expect, it } from 'vitest';
import { MUTATOR_IDS } from './contracts';
import * as GameCatalog from './game-catalog';
import * as Encyclopedia from './mechanics-encyclopedia';
import { RELIC_POOL } from './relics';

/** `CodexScreen` must import these from `game-catalog`; guard against silent export drops. */
describe('game-catalog encyclopedia re-exports', () => {
    it('aliases SoT arrays to mechanics-encyclopedia (same reference)', () => {
        expect(GameCatalog.CODEX_CORE_TOPICS).toBe(Encyclopedia.CODEX_CORE_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_POWER_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_POWER_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_CONTRACT_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_CONTRACT_TOPICS);
        expect(GameCatalog.ENCYCLOPEDIA_FEATURED_RUN_TOPICS).toBe(Encyclopedia.ENCYCLOPEDIA_FEATURED_RUN_TOPICS);
        expect(GameCatalog.GAME_MODE_CODEX).toBe(Encyclopedia.GAME_MODE_CODEX);
        expect(GameCatalog.RELIC_CATALOG).toBe(Encyclopedia.RELIC_CATALOG);
        expect(GameCatalog.MUTATOR_CATALOG).toBe(Encyclopedia.MUTATOR_CATALOG);
        expect(GameCatalog.VISUAL_ENDLESS_MODE_LOCKED).toBe(Encyclopedia.VISUAL_ENDLESS_MODE_LOCKED);
        expect(GameCatalog.ENCYCLOPEDIA_VERSION).toBe(Encyclopedia.ENCYCLOPEDIA_VERSION);
        expect(GameCatalog.ACHIEVEMENT_CATALOG).toBe(Encyclopedia.ACHIEVEMENT_CATALOG);
    });

    it('projects relic and mutator rows through stable shared ID orders', () => {
        expect(GameCatalog.getRelicCatalogRows().map((row) => row.id)).toEqual([...RELIC_POOL]);
        expect(GameCatalog.getMutatorCatalogRows().map((row) => row.id)).toEqual([...MUTATOR_IDS]);
    });
});
