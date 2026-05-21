import { expect, type Locator, type Page, test } from "@playwright/test";

const demoUrl = process.env.DEMO_BROWSER_URL ?? "http://127.0.0.1:4102/";

const severeConsoleTypes = new Set(["error"]);

function installDemoErrorGuards(page: Page) {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (!severeConsoleTypes.has(message.type())) {
      return;
    }

    failures.push(`console ${message.type()}: ${message.text()}`);
  });

  return {
    expectClean() {
      expect(failures).toEqual([]);
    },
  };
}

async function clickFirstVisible(candidates: Locator[], label: string) {
  for (const candidate of candidates) {
    const count = await candidate.count();
    for (let index = 0; index < count; index += 1) {
      const item = candidate.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.click();
        return;
      }
    }
  }

  throw new Error(`Could not find visible ${label}.`);
}

async function startPortfolioRun(page: Page) {
  await clickFirstVisible(
    [
      page.getByRole("button", { name: /classic run/i }),
      page.getByRole("button", { name: /start.*classic|classic.*start/i }),
      page.getByRole("button", { name: /new run|start run|begin run|play/i }),
      page.getByText(/classic run/i),
    ],
    "demo run start control",
  );
}

async function interactWithBoard(page: Page) {
  await expect(
    page
      .locator(
        [
          "[data-testid*='tile']",
          "[data-testid*='card']",
          "[aria-label*='tile' i]",
          "[aria-label*='card' i]",
          "canvas",
        ].join(", "),
      )
      .first(),
  ).toBeVisible({ timeout: 10_000 });

  await clickFirstVisible(
    [
      page.locator("[data-testid*='tile']"),
      page.locator("[data-testid*='card']"),
      page.getByRole("button", { name: /tile|card|symbol|memory/i }),
      page.locator("canvas"),
    ],
    "board interaction target",
  );
}

async function openAndCloseSettings(page: Page) {
  await clickFirstVisible(
    [
      page.getByRole("button", { name: /^settings$/i }),
      page.getByRole("button", { name: /open settings|options/i }),
      page.locator("[data-testid*='settings']"),
    ],
    "settings control",
  );

  await expect(
    page
      .getByRole("dialog", { name: /settings|options/i })
      .or(page.getByText(/settings/i))
      .first(),
  ).toBeVisible({ timeout: 5_000 });

  const closeCandidates = [
    page.getByRole("button", { name: /close|done|back|resume|return/i }),
    page.locator("[aria-label*='close' i]"),
  ];

  for (const candidate of closeCandidates) {
    if ((await candidate.count()) > 0 && (await candidate.first().isVisible().catch(() => false))) {
      await candidate.first().click();
      return;
    }
  }

  await page.keyboard.press("Escape");
}

test("browser demo loads, starts, survives settings, and keeps gameplay usable", async ({ page }) => {
  const errorGuard = installDemoErrorGuards(page);

  await page.goto(demoUrl);
  await expect(page.getByText(/memory dungeon/i).first()).toBeVisible({ timeout: 10_000 });

  await startPortfolioRun(page);
  await interactWithBoard(page);
  await openAndCloseSettings(page);
  await interactWithBoard(page);

  errorGuard.expectClean();
});
