import { stripHtmlToText, buildJobSlug } from './text-utils.js';

const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';

const RELEVANT_LOCATION_PATTERN = /latam|americas|worldwide|anywhere|global|peru|remote/i;

function isRelevantForPeru(location) {
  if (!location) return true;
  return RELEVANT_LOCATION_PATTERN.test(location);
}

function normalize(job) {
  const id = String(job.id);

  return {
    fuente: 'remotive',
    id,
    slug: buildJobSlug({ title: job.title, company: job.company_name, uniqueKey: `remotive:${id}` }),
    titulo: job.title,
    empresa: job.company_name,
    logo: job.company_logo_url || job.company_logo || null,
    categoria: job.category,
    tipo_empleo: job.job_type,
    salario_texto: job.salary || null,
    descripcion: stripHtmlToText(job.description),
    ubicacion_restriccion: job.candidate_required_location || null,
    relevante_peru: isRelevantForPeru(job.candidate_required_location),
    publicado_en: job.publication_date,
    url: job.url,
  };
}

export async function fetchRemotiveJobs() {
  const response = await fetch(REMOTIVE_URL, {
    headers: { 'User-Agent': 'DolarPeruHoy-RemotoPiloto/1.0 (+https://dolarperuhoy.com)' },
  });

  if (!response.ok) {
    throw new Error(`[remotive] HTTP ${response.status}`);
  }

  const data = await response.json();

  return (data.jobs || []).map(normalize);
}
