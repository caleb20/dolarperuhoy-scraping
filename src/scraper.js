import { scrapeWithBrowser } from './browser-scraper.js';
import { getHouseProfile } from './house-profiles.js';
import { supabase } from './supabase.js';
import { normalizeRate, sleep } from './utils.js';
import './env.js';

// ================= CONFIG =================
const timeoutMs = Number(process.env.SCRAPER_REQUEST_TIMEOUT_MS ?? 15000);
const maxHouses = Number(process.env.SCRAPER_MAX_HOUSES ?? 10);

// Menos concurrencia en GitHub Actions = más estable
const concurrency = Number(process.env.SCRAPER_CONCURRENCY ?? 2);

// ================= DATA =================
async function fetchHousePages() {
  const { data, error } = await supabase
    .from('exchange_houses')
    .select('id, slug, name, website_url')
    .eq('is_active', true)
    .not('website_url', 'is', null)
    .limit(maxHouses);

  if (error) throw new Error(error.message);

  return data ?? [];
}

// ================= SCRAPER =================
async function scrapeWebsite(house) {
  const profile = getHouseProfile(house.slug);

  try {
    let buy = null;
    let sell = null;

    if (typeof profile.fetchRates === 'function') {
      ({ buy, sell } = await profile.fetchRates({ house, profile }));
    } else if (profile.strategy === 'browser') {
      ({ buy, sell } = await scrapeWithBrowser(house, profile));
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(house.website_url, {
          headers: {
            'user-agent':
              'Mozilla/5.0 (compatible; DolarPeruBot/1.0)',
          },
          signal: controller.signal,
        });

        const html = await res.text();
        ({ buy, sell } = profile.extract(html));
      } finally {
        clearTimeout(timeout);
      }
    }

    buy = normalizeRate(buy);
    sell = normalizeRate(sell);

    if (buy == null || sell == null) {
      console.log(
        `[NO DATA] ${house.name} | compra=${buy ?? 'n/d'} venta=${sell ?? 'n/d'}`
      );
      return null;
    }

    const result = {
      house_id: house.id,
      buy_rate: buy,
      sell_rate: sell,
      source_name: profile.sourceName,
      captured_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('exchange_house_rates').insert([result]);

    if (error) {
      console.error(`[DB ERROR] ${house.name}`, error.message);
    } else {
      console.log(
        `[OK] ${house.name} | compra=${buy} venta=${sell}`
      );
    }

    return result;
  } catch (err) {
    console.error(`[ERROR] ${house.name}`, err.message);
    return null;
  }
}

// ================= SIMPLE WORKER POOL =================
async function runWithConcurrency(items, worker, limit) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => worker(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

// ================= RUN =================
export async function runCycle() {
  console.log(`[scraper] ciclo iniciado: ${new Date().toISOString()}`);

  const houses = await fetchHousePages();

  console.log(`[scraper] casas: ${houses.length}`);

  const results = await runWithConcurrency(
    houses,
    async (house) => {
      await sleep(500); // 🔥 más rápido que 1000ms en GitHub
      return scrapeWebsite(house);
    },
    concurrency
  );

  console.log('[scraper] ciclo terminado');
  
  return results;
}