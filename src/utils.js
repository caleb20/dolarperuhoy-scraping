export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractRate(html, label) {
  const regex = new RegExp(
    `${label}[^0-9]{0,20}([0-9]+(?:[.,][0-9]{2,4})?)`,
    'i'
  );

  const match = html.match(regex);
  if (!match?.[1]) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}