import { extractRate } from './utils.js';

function extractByRegex(html, regex) {
  const match = html.match(regex);
  if (!match?.[1]) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function defaultExtractor(html) {
  return {
    buy: extractRate(html, 'compra'),
    sell: extractRate(html, 'venta'),
  };
}

const defaultProfile = {
  strategy: 'html',
  sourceName: 'scraper',
  extract: defaultExtractor,
};

const houseProfiles = {
  kambista: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /Compra:\s*([\d.]+)/i,
      sellPattern: /Venta:\s*([\d.]+)/i,
      attempts: 3,
      intervalMs: 300,
      timeoutMs: 30000,
    },
  },
  rextie: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /Compra:\s*s\/?\s*([\d.]+)/i,
      sellPattern: /Venta:\s*s\/?\s*([\d.]+)/i,
      attempts: 3,
      intervalMs: 300,
      timeoutMs: 30000,
    },
  },
};

export function getHouseProfile(slug) {
  const houseProfile = houseProfiles[String(slug ?? '').toLowerCase()];

  if (!houseProfile) {
    return defaultProfile;
  }

  return {
    ...defaultProfile,
    ...houseProfile,
  };
}