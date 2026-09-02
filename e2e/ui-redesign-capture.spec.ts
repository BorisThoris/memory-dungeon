import { test } from '@playwright/test';
import { VISUAL_SCREEN_SCENARIOS } from './visualScenarioSteps';
import { captureVisualScreen } from './visualScreenHelpers';

/* Each scenario independent (no serial mode): one failure must not skip the rest. */
for (const scenario of VISUAL_SCREEN_SCENARIOS) {
    if (/startup intro/i.test(scenario.name)) continue;
    test(scenario.name, async ({ page }) => {
        test.setTimeout(scenario.timeoutMs ?? 120_000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await scenario.run(page, (baseName) => captureVisualScreen(page, 'desktop', 'landscape', baseName));
    });
}
