import { stripHtmlToText, buildJobSlug } from './text-utils.js';

const HIMALAYAS_URL = 'https://himalayas.app/jobs/api';

const RELEVANT_RESTRICTION_PATTERN = /peru|latin america|south america|americas/i;

function isRelevantForPeru(locationRestrictions) {
  if (!Array.isArray(locationRestrictions) || locationRestrictions.length === 0) {
    return true; // sin restricción = abierto a cualquier país
  }

  return locationRestrictions.some((entry) => RELEVANT_RESTRICTION_PATTERN.test(entry));
}

// La API devuelve pubDate/expiryDate como epoch en segundos (número), no ISO.
function toIso(epochSeconds) {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000).toISOString();
}

function normalize(job) {
  const id = job.guid;

  return {
    fuente: 'himalayas',
    id,
    slug: buildJobSlug({ title: job.title, company: job.companyName, uniqueKey: `himalayas:${id}` }),
    titulo: job.title,
    empresa: job.companyName,
    logo: job.companyLogo || null,
    categoria: job.parentCategories?.[0] || job.categories?.[0] || null,
    tipo_empleo: job.employmentType,
    salario_min: job.minSalary ?? null,
    salario_max: job.maxSalary ?? null,
    salario_periodo: job.salaryPeriod ?? null,
    moneda: job.currency ?? null,
    descripcion: stripHtmlToText(job.description) || job.excerpt || null,
    ubicacion_restriccion: job.locationRestrictions,
    relevante_peru: isRelevantForPeru(job.locationRestrictions),
    publicado_en: toIso(job.pubDate),
    expira_en: toIso(job.expiryDate),
    url: job.applicationLink,
  };
}

// Trae varias páginas vía cursor. `pages` controla cuántas páginas de `limit` items se piden.
export async function fetchHimalayasJobs({ pages = 3, limit = 20 } = {}) {
  const jobs = [];
  let cursor = null;

  for (let page = 0; page < pages; page += 1) {
    const url = new URL(HIMALAYAS_URL);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'DolarPeruHoy-RemotoPiloto/1.0 (+https://dolarperuhoy.com)' },
    });

    if (!response.ok) {
      throw new Error(`[himalayas] HTTP ${response.status}`);
    }

    const data = await response.json();
    jobs.push(...(data.jobs || []).map(normalize));

    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return jobs;
}
