export function nowIso() {
  return new Date().toISOString();
}

export function slug(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

export function textIncludesAny(text, terms = []) {
  const lower = String(text || '').toLowerCase();
  return terms.some(t => lower.includes(String(t).toLowerCase()));
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function stripHtml(input = '') {
  return String(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
