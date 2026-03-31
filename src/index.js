import 'dotenv/config.js';
import { runCycle } from './scraper.js';
import { fetchAndInsertSunat } from './sunat_fetch.js';
import { supabase } from './supabase.js';

async function main() {
  await runCycle();

  // SUNAT: solo una vez al día
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const { data: sunatRow, error } = await supabase
    .from('sunat_exchange_rates')
    .select('date')
    .eq('date', today)
    .maybeSingle();
  if (error) {
    console.error('[SUNAT] Error al consultar si ya existe registro:', error.message);
  }
  if (!sunatRow) {
    try {
      const inserted = await fetchAndInsertSunat(
        2026,
        2,
        'g5quz8jhjmx1b6o3jfcymhvnpglkk0f26qcsgbhmolfi5u9bxlhx',
        {
          Cookie: '_ga_6NCEEN6JSV=GS2.1.s1774980319$o3$g0$t1774980319$j60$l0$h0; _ga=GA1.3.1201271569.1715738061; _gid=GA1.3.2043430048.1774980320; TS61ff7286027=08d0cd49b8ab2000299312076c1481a94dbe7ef37113ede48700e9d1b56ef15035249b0c8f387f02089b30949b113000308ce72d548027ab346594092dcb551507c8f9aa2902a2b73c8eb296dccdd2554b2563ef73692b9b29c608d8d525f42e; IAASISTENCIAGESTIONSESSION=NXxFxHOcRgixZxjkYdt_nNdGhbonct4LaDzodXKFf36w4WqsNK3nVyVVV53BBeUt3hHeK4e0mDMUzmWEujM0RJTFeknyXSGVtSxuNZbzntBRMqXqBwWidB769Kd_SI7a2Nhj_iAA_eTsINl3vSKxmHucqi1CC5fOhuKxN-FqTRfFV15mO1WGumrCRd0RHgzcpRqQ4Y-lLAwrep-vI18e3gW_gB-chvC0X7augv5Dvm3i7t4rnVh7N2nS879Wi2ld!1397485715!-484652978; TS0105b0c6=014dc399cb85bea759a517e91d049fd2c5fc5790c78dd547c8239002635c3c31b19c48b1a024f0f0aa8e1bed263d4fd1f205ec1e7145ef94c6973da316ac45d59a0d0e71e3; TSf3c1dbbd027=08fe7428c8ab20004d7532ca7c73d6373949e8ca6afc33cef74c3978a6bc5173d35ac37cf09a321308a438d4cf11300029c47908a032800950ecca297498ff42ccecd896439870a215d6552f69aac868430d069900da0ed5f040794d4e69064f'
        }
      );
      console.log(`[SUNAT] Registros insertados/actualizados: ${inserted}`);
    } catch (err) {
      console.error('[SUNAT] Error:', err.message);
    }
  } else {
    console.log('[SUNAT] Ya existe tipo de cambio para hoy, no se inserta.');
  }
  process.exit(0); // importante para cron job
}

main();