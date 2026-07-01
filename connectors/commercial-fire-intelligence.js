import { nowIso, stripHtml, textIncludesAny, slug } from '../core/utils.js';
import rules from '../config/rules.json' assert { type: 'json' };

const QUERIES = [
  'Charlotte apartment fire commercial building fire',
  'Charlotte NC structure fire apartment warehouse hotel office',
  'Mecklenburg County commercial fire apartment fire',
  'Charlotte Fire Department working fire apartment commercial'
];

export const commercialFireConnector = {
  id: 'commercial-fire-intelligence',
  name: 'Commercial Fire Intelligence',
  version: '0.1.0',
  async run() {
    const allItems = [];
    const errors = [];

    for (const query of QUERIES) {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const response = await fetch(url, { headers: { 'user-agent': 'PI-Core/0.1.0' } });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const xml = await response.text();
        allItems.push(...parseRss(xml, query));
      } catch (error) {
        errors.push(`${query}: ${error.message}`);
      }
    }

    const events = [];
    let residentialFiltered = 0;

    for (const item of allItems) {
      const text = `${item.title} ${item.description}`;
      if (textIncludesAny(text, rules.excludeTerms)) {
        residentialFiltered++;
        continue;
      }
      if (!textIncludesAny(text, rules.fireIncludeTerms)) continue;

      events.push({
        connector: 'Commercial Fire Intelligence',
        eventId: `fire-${slug(item.title)}-${slug(item.pubDate)}`,
        dateFound: nowIso(),
        category: 'fire',
        headline: item.title,
        description: item.description,
        address: '',
        propertyName: '',
        sourceUrl: item.link,
        confidence: 70,
        rawData: { query: item.query, pubDate: item.pubDate }
      });
    }

    return {
      itemsRetrieved: allItems.length,
      residentialFiltered,
      events,
      errors
    };
  }
};

function parseRss(xml, query) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: stripHtml(getTag(block, 'title')),
      link: stripHtml(getTag(block, 'link')),
      pubDate: stripHtml(getTag(block, 'pubDate')),
      description: stripHtml(getTag(block, 'description')),
      query
    });
  }
  return items;
}

function getTag(block, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(regex);
  return match ? match[1] : '';
}
