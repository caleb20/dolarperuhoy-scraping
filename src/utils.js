export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_EXCHANGE_RATE = 2.5;
const MAX_EXCHANGE_RATE = 4;

export function normalizeRate(value) {
  const parsedValue = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(',', '.'));

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (parsedValue < MIN_EXCHANGE_RATE || parsedValue > MAX_EXCHANGE_RATE) {
    return null;
  }

  return parsedValue;
}

export function extractRateByRegex(input, regex) {
  const match = regex.exec(String(input ?? ''));
  if (!match?.[1]) return null;

  return normalizeRate(match[1]);
}

export function extractRate(html, label) {
  const regex = new RegExp(
    `${label}[^0-9]{0,20}([0-9]+(?:[.,][0-9]{2,4})?)`,
    'i'
  );

  return extractRateByRegex(html, regex);
}