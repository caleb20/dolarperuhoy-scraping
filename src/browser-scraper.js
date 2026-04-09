import puppeteer from 'puppeteer';
import { extractRateByRegex } from './utils.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRateWithPatterns(input, patterns) {
  for (const pattern of patterns) {
    const rate = extractRateByRegex(input, pattern);
    if (rate != null) {
      return rate;
    }
  }

  return null;
}

async function applyBrowserHeaders(page, userAgent) {
  if (!userAgent) {
    return;
  }

  await page.setExtraHTTPHeaders({
    'user-agent': userAgent,
  });
}

async function getBodyText(page, frameUrlPattern) {
  if (!frameUrlPattern) {
    return page.evaluate(() => document.body?.innerText ?? '');
  }

  const matchingFrame = page
    .frames()
    .find((frame) => frame.url().includes(frameUrlPattern));

  if (!matchingFrame) {
    return page.evaluate(() => document.body?.innerText ?? '');
  }

  return matchingFrame.evaluate(() => document.body?.innerText ?? '');
}

async function gotoWithFallback(page, url, waitUntil, timeout) {
  try {
    await page.goto(url, { waitUntil, timeout });
  } catch (error) {
    const isNavigationTimeout = String(error?.message ?? '')
      .toLowerCase()
      .includes('navigation timeout');

    if (waitUntil === 'networkidle2' && isNavigationTimeout) {
      // Algunas webs no alcanzan networkidle; degradamos a una espera menos estricta.
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
      return;
    }

    throw error;
  }
}

export async function scrapeWithBrowser(house, profile) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const userAgent = profile.browser?.userAgent;
    await applyBrowserHeaders(page, userAgent);

    const configuredWaitUntil = profile.browser?.waitUntil ?? 'domcontentloaded';
    const navigationTimeoutMs = profile.browser?.timeoutMs ?? 30000;
    await gotoWithFallback(
      page,
      house.website_url,
      configuredWaitUntil,
      navigationTimeoutMs
    );

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
    const buyPatterns = profile.browser?.buyPatterns ?? [profile.browser.buyPattern];
    const sellPatterns = profile.browser?.sellPatterns ?? [profile.browser.sellPattern];

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const bodyText = await getBodyText(page, frameUrlPattern);

      const buy = extractRateWithPatterns(bodyText, buyPatterns);
      const sell = extractRateWithPatterns(bodyText, sellPatterns);

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