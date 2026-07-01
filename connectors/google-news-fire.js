const queries = [
  'Charlotte NC apartment fire',
  'Charlotte NC commercial fire',
  'Charlotte NC hotel fire',
  'Mecklenburg County commercial structure fire',
  'Rock Hill SC apartment fire',
  'Fort Mill SC commercial fire'
];

function decodeXml(text) {
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function stripTags(html = '') {
  return decodeXml(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function tag(item, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = item.match(re);
  return m ? decodeXml(m[1].trim()) : '';
}

export async function runGoogleNewsFireConnector() {
  const started = Date.now();
  const events = [];
  const sourceResults = [];
  for (const q of queries) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PI/0.2.0 source validation' } });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = text.match(/<item>[\s\S]*?<\/item>/gi) || [];
      sourceResults.push({ query: q, status: 'PASS', items: items.length });
      for (const item of items.slice(0, 12)) {
        events.push({
          connector: 'commercial-fire-intelligence',
          sourceName: 'Google News',
          eventId: tag(item, 'guid') || tag(item, 'link') || tag(item, 'title'),
          dateFound: new Date().toISOString(),
          publishedAt: tag(item, 'pubDate'),
          category: 'FIRE_SIGNAL',
          headline: stripTags(tag(item, 'title')),
          description: stripTags(tag(item, 'description')),
          sourceUrl: tag(item, 'link'),
          confidence: 72,
          rawData: { query: q }
        });
      }
    } catch (err) {
      sourceResults.push({ query: q, status: 'ERROR', error: String(err.message || err), items: 0 });
    }
  }
  return {
    connector: 'commercial-fire-intelligence',
    version: '0.2.0',
    status: events.length ? 'PASS' : 'WARN',
    durationMs: Date.now() - started,
    itemsRetrieved: events.length,
    sourceResults,
    events
  };
}
