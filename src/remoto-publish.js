import { fetchRemotiveJobs } from './remoto-remotive.js';
import { fetchHimalayasJobs } from './remoto-himalayas.js';
import { supabase } from './supabase.js';

function toRow(job) {
  return {
    id: `${job.fuente}:${job.id}`,
    source: job.fuente,
    source_id: job.id,
    slug: job.slug,
    title: job.titulo,
    company: job.empresa ?? null,
    company_logo: job.logo ?? null,
    description: job.descripcion ?? null,
    category: job.categoria ?? null,
    employment_type: job.tipo_empleo ?? null,
    salary_min: job.salario_min ?? null,
    salary_max: job.salario_max ?? null,
    salary_period: job.salario_periodo ?? null,
    currency: job.moneda ?? null,
    salary_text: job.salario_texto ?? null,
    location_restriction: job.ubicacion_restriccion ?? null,
    relevant_pe: Boolean(job.relevante_peru),
    posted_at: job.publicado_en ?? null,
    expires_at: job.expira_en ?? null,
    apply_url: job.url,
  };
}

async function run() {
  console.log('[remoto-publish] Consultando Remotive...');
  const remotive = await fetchRemotiveJobs();

  console.log('[remoto-publish] Consultando Himalayas (5 páginas)...');
  const himalayas = await fetchHimalayasJobs({ pages: 5, limit: 20 });

  const rows = [...remotive, ...himalayas].map(toRow);

  console.log(`[remoto-publish] Publicando ${rows.length} registros (upsert por id)...`);
  const { error, count } = await supabase
    .from('remote_jobs')
    .upsert(rows, { onConflict: 'id', count: 'exact' });

  if (error) {
    throw new Error(`[remoto-publish] Error en upsert: ${error.message}`);
  }

  const relevantes = rows.filter((r) => r.relevant_pe).length;
  console.log(`[remoto-publish] OK. ${count ?? rows.length} filas escritas, ${relevantes} relevantes para Perú.`);
}

run().catch((error) => {
  console.error('[remoto-publish] Error fatal:', error);
  process.exit(1);
});
