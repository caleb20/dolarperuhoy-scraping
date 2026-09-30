import { extractRate, normalizeRate, withRetry } from './utils.js';

function defaultExtractor(html) {
  return {
    buy: extractRate(html, 'compra'),
    sell: extractRate(html, 'venta'),
  };
}

async function fetchJetPeruRates() {
  const tokenResponse = await fetch('https://jetperu.com.pe/wp-admin/admin-ajax.php', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: new URLSearchParams({ action: 'tc_token' }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`JetPeru token ${tokenResponse.status}`);
  }

  const tokenPayload = await tokenResponse.json();
  const token = tokenPayload?.data;

  if (!token) {
    throw new Error('JetPeru token vacío');
  }

  const ratesResponse = await fetch(
    'https://apitc.jetperu.com.pe:5002/api/WebTipoCambio?monedaOrigenId=PEN',
    {
      headers: {
        authorization: `Bearer ${token}`,
        'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
      },
    }
  );

  if (!ratesResponse.ok) {
    throw new Error(`JetPeru rates ${ratesResponse.status}`);
  }

  const payload = await ratesResponse.json();
  const usdOnlineRate = payload?.dato?.find(
    (rate) => rate.monedaDestinoId === 'USDO'
  );
  const usdRate = payload?.dato?.find(
    (rate) => rate.monedaDestinoId === 'USD'
  );
  const selectedRate = usdOnlineRate ?? usdRate;

  return {
    buy: normalizeRate(selectedRate?.tipoCompra),
    sell: normalizeRate(selectedRate?.tipoVenta),
  };
}

const defaultProfile = {
  strategy: 'html',
  sourceName: 'scraper',
  extract: defaultExtractor,
};

async function fetchCambiosmassRates() {
  const res = await fetch('https://cambiosmass.com', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const m = html.match(/compra:([\d.]+),venta:([\d.]+)/);
  return {
    buy: normalizeRate(m?.[1]),
    sell: normalizeRate(m?.[2]),
  };
}

async function fetchInkamoneyRates() {
  const res = await fetch('https://inkamoney.com', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const buyMatch = html.match(/buy-price="(3\.\d+)"/);
  const sellMatch = html.match(/sale-price="(3\.\d+)"/);
  return {
    buy: normalizeRate(buyMatch?.[1]),
    sell: normalizeRate(sellMatch?.[1]),
  };
}

async function fetchMoneyhouseRates() {
  const res = await fetch('https://moneyhouse.pe', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const buyMatch = html.match(/field-t-c-compra[^]*?cantant">([\d.]+)<[/]span>/i);
  const sellMatch = html.match(/field-t-c-venta[^]*?cantant">([\d.]+)<[/]span>/i);
  return {
    buy: normalizeRate(buyMatch?.[1]),
    sell: normalizeRate(sellMatch?.[1]),
  };
}

async function fetchCambiafxRates() {
  const res = await fetch('https://apiluna.cambiafx.pe/api/BackendPizarra/getTcCustomerNoAuth?idParCurrency=1', {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`CambiaFX API ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('CambiaFX API sin datos');
  return {
    buy: normalizeRate(data[0].tcBuy),
    sell: normalizeRate(data[0].tcSale),
  };
}

// Antes esto primero visitaba la home para sacar una cookie de sesion y se la mandaba a
// la API. Comprobado en vivo (30-sep-2026): la API responde 200 con datos correctos SIN
// ninguna cookie -- no la necesita. Esa cookie ademas se extraia mal: Headers.get(
// 'set-cookie') en fetch/undici junta varios Set-Cookie en un solo string separado por
// comas, lo que puede partir un valor de cookie real a la mitad y mandar un header
// invalido. Sospecha (no confirmada, no hay logs del cron a mano): eso, sumado a que la
// llamada corre desde IPs de GitHub Actions detras de un WAF de Cloudflare, explicaria por
// que casi siempre fallaba (solo 1 fila insertada en todo septiembre). Quitamos el paso de
// la cookie por completo -- es el que probamos que sobra -- y le sumamos reintentos por si
// el bloqueo es intermitente.
async function fetchCambiomundialRates() {
  return withRetry(
    async () => {
      const apiRes = await fetch('https://www.cambiomundial.com/backend/tasaCambio/daily', {
        headers: {
          accept: 'application/json',
          referer: 'https://www.cambiomundial.com/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!apiRes.ok) throw new Error(`CambioMundial API ${apiRes.status}`);
      const data = await apiRes.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('CambioMundial API sin datos');
      const regular = data.find((r) => r.tipoTasa === 'REGULAR') ?? data[0];
      return {
        buy: normalizeRate(regular.buy),
        sell: normalizeRate(regular.sell),
      };
    },
    { retries: 3, baseDelayMs: 2000, label: 'CambioMundial' }
  );
}

async function fetchKambioRates() {
  const res = await fetch('https://kambio.com.pe/api/rates/current', {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Kambio API ${res.status}`);
  const data = await res.json();
  if (!data || data.buy == null || data.sell == null) throw new Error('Kambio API sin datos');
  return {
    buy: normalizeRate(data.buy),
    sell: normalizeRate(data.sell),
  };
}

const houseProfiles = {
  cambiosmass: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchCambiosmassRates,
  },
  dollarhouse: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /COMPRA\s+S\/\s*([\d.]+)/i,
      sellPattern: /VENTA\s+S\/\s*([\d.]+)/i,
      waitUntil: 'networkidle2',
      initialDelayMs: 3000,
      dismissSelector: '.sgpb-popup-close-button-1',
      dismissDelayMs: 1000,
      frameUrlPattern: 'app.dollarhouse.pe/calculadorav2',
      attempts: 4,
      intervalMs: 750,
      timeoutMs: 60000,
    },
  },
  westernunionperu: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPatterns: [
        /Compra[:\s]*S\/?\.?\s*([\d.]+)/i,
        /Compra[:\s]*([\d.]+)/i,
        /COMPRA[:\s]*S\/?\.?\s*([\d.]+)/i,
        /TE\s+COMPRAMOS[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Compramos[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Buy[:\s]*([\d.]+)/i,
      ],
      sellPatterns: [
        /Venta[:\s]*S\/?\.?\s*([\d.]+)/i,
        /Venta[:\s]*([\d.]+)/i,
        /VENTA[:\s]*S\/?\.?\s*([\d.]+)/i,
        /TE\s+VENDEMOS[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Vendemos[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Sell[:\s]*([\d.]+)/i,
      ],
      waitUntil: 'domcontentloaded',
      initialDelayMs: 2000,
      attempts: 4,
      intervalMs: 500,
      timeoutMs: 60000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  westernunion: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPatterns: [
        /Compra[:\s]*S\/?\.?\s*([\d.]+)/i,
        /Compra[:\s]*([\d.]+)/i,
        /COMPRA[:\s]*S\/?\.?\s*([\d.]+)/i,
        /TE\s+COMPRAMOS[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Compramos[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Buy[:\s]*([\d.]+)/i,
      ],
      sellPatterns: [
        /Venta[:\s]*S\/?\.?\s*([\d.]+)/i,
        /Venta[:\s]*([\d.]+)/i,
        /VENTA[:\s]*S\/?\.?\s*([\d.]+)/i,
        /TE\s+VENDEMOS[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Vendemos[:\s]*S?\/?\.?\s*([\d.]+)/i,
        /Sell[:\s]*([\d.]+)/i,
      ],
      waitUntil: 'domcontentloaded',
      initialDelayMs: 2000,
      attempts: 4,
      intervalMs: 500,
      timeoutMs: 60000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  jetperu: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchJetPeruRates,
  },
  inkamoney: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchInkamoneyRates,
  },
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
      buyPattern: /Compra:?\s+s\/\s*([\d.]+)/i,
      sellPattern: /Venta:?\s+s\/\s*([\d.]+)/i,
      waitUntil: 'networkidle2',
      initialDelayMs: 3000,
      attempts: 3,
      intervalMs: 500,
      timeoutMs: 60000,
    },
  },
  securex: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /Compra:\s*([\d.]+)/i,
      sellPattern: /Venta:\s*([\d.]+)/i,
      waitUntil: 'networkidle2',
      initialDelayMs: 4000,
      attempts: 3,
      intervalMs: 500,
      timeoutMs: 60000,
    },
  },
  tkambio: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /Compra:\s*([\d.]+)/i,
      sellPattern: /Venta:\s*([\d.]+)/i,
      waitUntil: 'networkidle2',
      initialDelayMs: 3000,
      attempts: 3,
      intervalMs: 500,
      timeoutMs: 60000,
    },
  },
  tucambista: {
    strategy: 'browser',
    sourceName: 'browser',
    browser: {
      buyPattern: /Tipo\s+de\s+cambio\s+hoy\s+Compra:\s*([\d.]+)/i,
      sellPattern: /Venta:\s*([\d.]+)/i,
      waitUntil: 'networkidle2',
      initialDelayMs: 3000,
      attempts: 3,
      intervalMs: 500,
      timeoutMs: 60000,
    },
  },
  moneyhouse: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchMoneyhouseRates,
  },
  cambiafx: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchCambiafxRates,
  },
  cambiomundial: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchCambiomundialRates,
  },
  kambio: {
    strategy: 'custom',
    sourceName: 'api',
    fetchRates: fetchKambioRates,
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