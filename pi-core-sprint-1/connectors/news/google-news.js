export const connector = {
  id: 'google-news-commercial-v0-1',
  name: 'Google News Commercial Signals',
  version: '0.1.0',
  async run() {
    const queries = [
      'Charlotte multifamily acquisition',
      'Charlotte apartment management change',
      'Charlotte commercial property renovation',
      'Mecklenburg County roof permit commercial'
    ];
    const events = [];
    for (const q of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { headers: { 'user-agent': 'PI-Core/0.1' } });
      if (!res.ok) continue;
      const xml = await res.text();
      events.push(...parse(xml, this.name));
    }
    return events;
  }
};
function parse(xml, connectorName) {
  const itemRe = /<item>[\s\S]*?<\/item>/g;
  const items = xml.match(itemRe) || [];
  return items.slice(0, 25).map(item => {
    const title = clean(tag(item, 'title'));
    const link = clean(tag(item, 'link'));
    return {
      connector: connectorName,
      eventId: `news-${Math.abs(hashCode(title + link))}`,
      dateFound: new Date().toISOString(),
      category: 'Market Intelligence',
      headline: title,
      description: title,
      address: '',
      propertyName: '',
      sourceUrl: link,
      confidence: 60,
      rawData: {}
    };
  }).filter(e => /charlotte|mecklenburg|apartment|multifamily|commercial|property|roof|management|acquisition|renovation/i.test(e.headline));
}
function tag(xml, name) { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`)); return m ? m[1] : ''; }
function clean(v) { return String(v || '').replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').trim(); }
function hashCode(str) { let h = 0; for (let i=0;i<str.length;i++) h = Math.imul(31,h)+str.charCodeAt(i)|0; return h; }
