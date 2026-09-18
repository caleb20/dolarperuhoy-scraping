export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintenta una función async con backoff exponencial.
 * Pensado para absorber errores transitorios de red/infra (ej. 522 de Supabase)
 * sin tumbar todo el proceso.
 * @param {() => Promise<T>} fn
 * @param {{retries?: number, baseDelayMs?: number, label?: string}} options
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const { retries = 3, baseDelayMs = 1500, label = 'operación' } = options;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        const shortMessage = String(err?.message ?? err).slice(0, 200);
        console.warn(
          `[retry] ${label} falló (intento ${attempt}/${retries}): ${shortMessage}. Reintentando en ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
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