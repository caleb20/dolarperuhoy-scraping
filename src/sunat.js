import { supabase } from './supabase.js';

/**
 * Inserta los tipos de cambio SUNAT en la tabla sunat_exchange_rates
 * @param {Array<{fecPublica: string, valTipo: string, codTipo: string}>} data
 */
export async function insertSunatExchangeRates(data) {
  // Agrupa por fecha
  const grouped = {};
  for (const row of data) {
    const date = row.fecPublica.split('/').reverse().join('-'); // yyyy-mm-dd
    if (!grouped[date]) grouped[date] = {};
    if (row.codTipo === 'C') grouped[date].buy_rate = parseFloat(row.valTipo);
    if (row.codTipo === 'V') grouped[date].sell_rate = parseFloat(row.valTipo);
  }

  const records = Object.entries(grouped)
    .filter(([_, v]) => v.buy_rate && v.sell_rate)
    .map(([date, v]) => ({ date, buy_rate: v.buy_rate, sell_rate: v.sell_rate }));

  if (!records.length) throw new Error('No hay registros válidos para insertar');

  const { error } = await supabase.from('sunat_exchange_rates').upsert(records, { onConflict: 'date' });
  if (error) throw error;
  return records.length;
}
