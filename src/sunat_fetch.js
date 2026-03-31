import { insertSunatExchangeRates } from './sunat.js';

/**
 * Obtiene los tipos de cambio SUNAT vía fetch real
 * @param {number} anio
 * @param {number} mes
 * @param {string} token
 * @param {object} extraHeaders Opcional: headers extra (ej. Cookie)
 */
export async function fetchAndInsertSunat(anio, mes, token, extraHeaders = {}) {
  const url = 'https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias/listarTipoCambio';
  const headers = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'es-419,es-PE;q=0.9,es;q=0.8,en-PE;q=0.7,en;q=0.6',
    'Content-Type': 'application/json; charset=UTF-8',
    'Origin': 'https://e-consulta.sunat.gob.pe',
    'Referer': 'https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias',
    'User-Agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
    'X-Requested-With': 'XMLHttpRequest',
    ...extraHeaders,
  };
  const body = JSON.stringify({ anio, mes, token });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) throw new Error('Error al obtener tipos de cambio SUNAT');
  const data = await res.json();
  return insertSunatExchangeRates(data);
}
