import puppeteer from 'puppeteer';
import { extractRateByRegex } from './utils.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeWithBrowser(house, profile) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.goto(house.website_url, {
      waitUntil: profile.browser?.waitUntil ?? 'domcontentloaded',
      timeout: profile.browser?.timeoutMs ?? 30000,
    });

    const initialDelayMs = profile.browser?.initialDelayMs ?? 0;
    if (initialDelayMs > 0) {
      await sleep(initialDelayMs);
    }

    const dismissSelector = profile.browser?.dismissSelector;
    if (dismissSelector) {
      await page.click(dismissSelector).catch(() => {});

      const dismissDelayMs = profile.browser?.dismissDelayMs ?? 0;
      if (dismissDelayMs > 0) {
        await sleep(dismissDelayMs);
      }
    }

    const attempts = profile.browser?.attempts ?? 3;
    const intervalMs = profile.browser?.intervalMs ?? 300;
    const frameUrlPattern = profile.browser?.frameUrlPattern;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let bodyText = await page.evaluate(() => document.body?.innerText ?? '');

      if (frameUrlPattern) {
        const matchingFrame = page
          .frames()
          .find((frame) => frame.url().includes(frameUrlPattern));

        if (matchingFrame) {
          bodyText = await matchingFrame.evaluate(
            () => document.body?.innerText ?? ''
          );
        }
      }

      const buy = extractRateByRegex(bodyText, profile.browser.buyPattern);
      const sell = extractRateByRegex(bodyText, profile.browser.sellPattern);

      if (buy != null && sell != null) {
        return { buy, sell };
      }

      if (attempt < attempts) {
        await sleep(intervalMs);
      }
    }

    return { buy: null, sell: null };
  } finally {
    await browser.close();
  }
}