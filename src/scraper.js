import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';

// ================= CONFIG =================
const timeoutMs = Number(process.env.SCRAPER_REQUEST_TIMEOUT_MS ?? 15000);
const maxHouses = Number(process.env.SCRAPER_MAX_HOUSES ?? 10);
const concurrency = Number(process.env.SCRAPER_CONCURRENCY ?? 3);

const limit = pLimit(concurrency);

// ================= SUPABASE =================
const supabaseUrl =
  process.env.SCRAPER_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.SCRAPER_SUPABASE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('[scraper] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ================= UTIL =================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractRate(html, label) {
  const regex = new RegExp(
    `${label}[^0-9]{0,20}([0-9]+(?:[.,][0-9]{2,4})?)`,
    'i'
  );

  const match = html.match(regex);
  if (!match?.[1]) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

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
  const start = Date.now();

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

    // guardar en Supabase
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

// ================= RUN =================
async function runCycle() {
  console.log(`[scraper] ciclo iniciado: ${new Date().toISOString()}`);

  const houses = await fetchHousePages();

  console.log(`[scraper] casas: ${houses.length}`);

  // 🧠 control de concurrencia
  const tasks = houses.map((house) =>
    limit(async () => {
      await sleep(1000); // anti-bloqueo
      return scrapeWebsite(house);
    })
  );

  await Promise.all(tasks);

  console.log('[scraper] ciclo terminado');
}

// ================= ENTRY POINT =================
async function main() {
  try {
    await runCycle();
  } catch (err) {
    console.error('[scraper] fatal error', err.message);
    process.exit(1);
  }
}

main();