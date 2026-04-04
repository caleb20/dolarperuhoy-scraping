import puppeteer from 'puppeteer';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractByRegex(text, regex) {
  const match = regex.exec(String(text ?? ''));
  if (!match?.[1]) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
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

    const attempts = profile.browser?.attempts ?? 3;
    const intervalMs = profile.browser?.intervalMs ?? 300;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const bodyText = await page.evaluate(() => document.body?.innerText ?? '');

      const buy = extractByRegex(bodyText, profile.browser.buyPattern);
      const sell = extractByRegex(bodyText, profile.browser.sellPattern);

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