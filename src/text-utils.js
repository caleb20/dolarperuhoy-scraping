export function stripHtmlToText(html) {
  if (!html) return null;

  const withoutTags = String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|p|div|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–');

  const text = withoutTags
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return text || null;
}

const COMBINING_DIACRITICS_PATTERN = /[̀-ͯ]/g;

function slugifyText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Hash corto y estable (no criptográfico) para que el slug no cambie entre corridas
// pero sí sea único aunque dos empleos tengan el mismo título y empresa.
function stableSuffix(value) {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function buildJobSlug({ title, company, uniqueKey }) {
  const base = slugifyText(`${title}-${company ?? ''}`) || 'empleo-remoto';
  return `${base}-${stableSuffix(uniqueKey)}`;
}
