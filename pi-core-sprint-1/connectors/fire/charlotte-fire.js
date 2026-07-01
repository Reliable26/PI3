export const connector = {
  id: 'charlotte-fire-v0-1',
  name: 'Charlotte Fire Signals',
  version: '0.1.0',
  async run() {
    const queries = [
      'Charlotte apartment fire',
      'Charlotte commercial building fire',
      'Charlotte warehouse fire',
      'Charlotte hotel fire'
    ];
    const events = [];
    for (const q of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { headers: { 'user-agent': 'PI-Core/0.1' } });
      if (!res.ok) continue;
      const xml = await res.text();
      events.push(...parseGoogleNews(xml, this.name));
    }
    return events;
  }
};

function parseGoogleNews(xml, connectorName) {
  const itemRe = /<item>[\s\S]*?<\/item>/g;
  const items = xml.match(itemRe) || [];
  return items.slice(0, 20).map(item => {
    const title = clean(tag(item, 'title'));
    const link = clean(tag(item, 'link'));
    const pubDate = clean(tag(item, 'pubDate'));
    return {
      connector: connectorName,
      eventId: `fire-${Math.abs(hashCode(title + link))}`,
      dateFound: new Date().toISOString(),
      category: 'Fire',
      headline: title,
      description: title,
      address: '',
      propertyName: '',
      sourceUrl: link,
      confidence: title.toLowerCase().includes('charlotte') ? 75 : 55,
      rawData: { pubDate }
    };
  }).filter(e => /fire|smoke|apartment|commercial|warehouse|hotel/i.test(e.headline));
}
function tag(xml, name) { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`)); return m ? m[1] : ''; }
function clean(v) { return String(v || '').replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').trim(); }
function hashCode(str) { let h = 0; for (let i=0;i<str.length;i++) h = Math.imul(31,h)+str.charCodeAt(i)|0; return h; }
