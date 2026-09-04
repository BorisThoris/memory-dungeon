import { expect, test } from '@playwright/test';
import { GAME_RULES_VERSION } from '../src/shared/contracts';
import { encodeRunShareKey } from '../src/shared/run-share-key';
import { expectGameplayReady, openModeLibrary } from './playablePathHelpers';

/**
 * The share loop end to end: a key someone else's game produced starts that run here.
 *
 * The unit tests prove the key round-trips and that the replay deals the same board. This proves
 * the part a player does — paste, press, land in the right mode — which is the half that a
 * round-tripping encoder cannot tell you about.
 */

const SEED = 912_345;

const pasteAndPlay = async (page: import('@playwright/test').Page, text: string): Promise<void> => {
    const form = page.getByTestId('choose-path-shared-run');
    await expect(form).toBeVisible();
    await form.getByRole('textbox').fill(text);
    await form.getByRole('button', { name: /play it/i }).click();
};

test.describe('Playing a shared run', () => {
    test.describe.configure({ retries: 0 });

    for (const shared of [
        { expected: /Wild Run/i, variant: 'wild' as const },
        { expected: /Scholar Contract/i, variant: 'scholar' as const },
        { expected: /Classic Dungeon/i, variant: 'classic' as const }
    ]) {
        test(`a ${shared.variant} key starts a ${shared.variant} run, not the mode underneath it`, async ({ page }) => {
            test.setTimeout(120_000);
            await openModeLibrary(page);
            await pasteAndPlay(
                page,
                encodeRunShareKey({ rulesVersion: GAME_RULES_VERSION, seed: SEED, variant: shared.variant })
            );

            await expectGameplayReady(page);
            await expect(page.getByTestId('hud-mode-identity')).toContainText(shared.expected);
        });
    }

    test('the whole sentence the copy button produces is accepted, because that is what people paste', async ({
        page
    }) => {
        test.setTimeout(120_000);
        await openModeLibrary(page);
        const key = encodeRunShareKey({ rulesVersion: GAME_RULES_VERSION, seed: SEED, variant: 'practice' });
        await pasteAndPlay(page, `Memory Dungeon — Practice: floor 9, 1,200 points. Same run: ${key}`);

        await expectGameplayReady(page);
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Practice/i);
    });

    test('a paste that is not a key says so and starts nothing', async ({ page }) => {
        test.setTimeout(120_000);
        await openModeLibrary(page);
        await pasteAndPlay(page, 'have a nice day');

        await expect(page.getByTestId('choose-path-shared-run-error')).toBeVisible();
        await expect(page.getByTestId('game-hud')).toHaveCount(0);
    });
});
