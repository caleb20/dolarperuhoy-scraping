import { supabase } from './supabase.js';
import { sleep, extractRate } from './utils.js';

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

    const buy = extractRate(html, 'compra');
    const sell = extractRate(html, 'venta');

    const result = {
      house_id: house.id,
      compra: buy,
      venta: sell,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('rates').insert([result]);

    if (error) {
      console.error(`[DB ERROR] ${house.name}`, error.message);
    }

    console.log(
      `[OK] ${house.name} | compra=${buy ?? 'n/d'} venta=${sell ?? 'n/d'}`
    );

    return result;
  } catch (err) {
    console.error(`[ERROR] ${house.name}`, err.message);
    return null;
  } finally {
    clearTimeout(timeout);
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

  await runWithConcurrency(
    houses,
    async (house) => {
      await sleep(500); // 🔥 más rápido que 1000ms en GitHub
      return scrapeWebsite(house);
    },
    concurrency
  );

  console.log('[scraper] ciclo terminado');
}