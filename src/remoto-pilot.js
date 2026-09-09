import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRemotiveJobs } from './remoto-remotive.js';
import { fetchHimalayasJobs } from './remoto-himalayas.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(currentDir, '../output');
const outputFile = path.join(outputDir, 'remoto-jobs.json');

async function run() {
  console.log('[remoto-pilot] Consultando Remotive...');
  const remotive = await fetchRemotiveJobs();
  console.log(`[remoto-pilot] Remotive: ${remotive.length} trabajos.`);

  console.log('[remoto-pilot] Consultando Himalayas (3 páginas)...');
  const himalayas = await fetchHimalayasJobs({ pages: 3, limit: 20 });
  console.log(`[remoto-pilot] Himalayas: ${himalayas.length} trabajos.`);

  const all = [...remotive, ...himalayas];
  const relevantes = all.filter((job) => job.relevante_peru);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(all, null, 2), 'utf-8');

  console.log('\n[remoto-pilot] Resumen:');
  console.log(`  Total combinado: ${all.length}`);
  console.log(`  Relevantes para Perú (heurístico): ${relevantes.length}`);
  console.log(`  Remotive relevantes: ${remotive.filter((j) => j.relevante_peru).length}/${remotive.length}`);
  console.log(`  Himalayas relevantes: ${himalayas.filter((j) => j.relevante_peru).length}/${himalayas.length}`);
  console.log(`  Resultado completo en: ${outputFile}`);
}

run().catch((error) => {
  console.error('[remoto-pilot] Error fatal:', error);
  process.exit(1);
});
