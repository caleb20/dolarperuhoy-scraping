import { supabase } from './supabase.js';
import { normalizeRate } from './utils.js';

/**
 * Calcula el promedio de tasas de compra y venta
 * @param {Array<{buy_rate: number, sell_rate: number}>} rates
 * @returns {{buy: number, sell: number}} Tasas promedio
 */
function calculateAverageRates(rates) {
  if (!rates || rates.length === 0) {
    return { buy: null, sell: null };
  }

  const validRates = rates
    .map((rate) => ({
      ...rate,
      buy_rate: normalizeRate(rate?.buy_rate),
      sell_rate: normalizeRate(rate?.sell_rate),
    }))
    .filter((r) => r.buy_rate != null && r.sell_rate != null);
  if (validRates.length === 0) {
    return { buy: null, sell: null };
  }

  const avgBuy = validRates.reduce((sum, r) => sum + r.buy_rate, 0) / validRates.length;
  const avgSell = validRates.reduce((sum, r) => sum + r.sell_rate, 0) / validRates.length;

  return {
    buy: Number.parseFloat(avgBuy.toFixed(4)),
    sell: Number.parseFloat(avgSell.toFixed(4)),
  };
}

/**
 * Determina la tendencia comparando con el último snapshot
 * @param {number} newBuy
 * @param {number} newSell
 * @param {number} prevBuy
 * @param {number} prevSell
 * @returns {{trend: 'up'|'down'|'stable', changeValue: number, changePercent: number}}
 */
function determineTrend(newBuy, newSell, prevBuy, prevSell) {
  if (!prevBuy || !prevSell) {
    return { trend: 'stable', changeValue: 0, changePercent: 0 };
  }

  const avgNew = (newBuy + newSell) / 2;
  const avgPrev = (prevBuy + prevSell) / 2;
  const changeValue = Number.parseFloat((avgNew - avgPrev).toFixed(4));
  const changePercent = Number.parseFloat((((avgNew - avgPrev) / avgPrev) * 100).toFixed(4));

  let trend = 'stable';
  if (changeValue > 0.0005) {
    trend = 'up';
  } else if (changeValue < -0.0005) {
    trend = 'down';
  }

  return { trend, changeValue, changePercent };
}

/**
 * Inserta un snapshot promedio de tipos de cambio
 * @param {Array<{buy_rate: number, sell_rate: number}>} rates
 * @param {string} sourceName
 */
export async function insertSnapshot(rates, sourceName = 'average') {
  const validRates = (rates ?? [])
    .map((rate) => ({
      ...rate,
      buy_rate: normalizeRate(rate?.buy_rate),
      sell_rate: normalizeRate(rate?.sell_rate),
    }))
    .filter((r) => r?.buy_rate != null && r?.sell_rate != null);
  const { buy, sell } = calculateAverageRates(rates);

  if (buy == null || sell == null) {
    console.log('[SNAPSHOT] Sin datos válidos para calcular promedio');
    return null;
  }

  console.log(
    `[SNAPSHOT] Promedio casas (${validRates.length}) | compra=${buy} venta=${sell}`
  );

  // Obtener último snapshot para calcular tendencia
  const { data: lastSnapshot } = await supabase
    .from('exchange_rate_snapshots')
    .select('buy_rate, sell_rate')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { trend, changeValue, changePercent } = determineTrend(
    buy,
    sell,
    lastSnapshot?.buy_rate,
    lastSnapshot?.sell_rate
  );

  const snapshot = {
    buy_rate: buy,
    sell_rate: sell,
    trend,
    change_value: changeValue,
    change_percent: changePercent,
    source_name: sourceName,
    captured_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('exchange_rate_snapshots').insert([snapshot]);

  if (error) {
    console.error('[SNAPSHOT] Error:', error.message);
    return null;
  }

  console.log(
    `[SNAPSHOT] Insertado | compra=${buy} venta=${sell} | trend=${trend} change=${changePercent}% | casas=${validRates.length}`
  );

  return snapshot;
}
