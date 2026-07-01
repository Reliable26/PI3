const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const settings = JSON.parse(fs.readFileSync(path.join(root, 'config/settings.json'), 'utf8'));
const scoring = JSON.parse(fs.readFileSync(path.join(root, 'config/scoring.json'), 'utf8'));

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function nowIso() { return new Date().toISOString(); }
function hoursBetween(a, b) { return Math.abs((b.getTime() - a.getTime()) / 36e5); }
function escapeXml(s='') { return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function stripHtml(s='') { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function slug(s='') { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function hash(s='') { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 10); }

function parseRss(xml) {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items = [];
  let match;
  while ((match = itemRegex.exec(xml))) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? escapeXml(m[1]).trim() : '';
    };
    items.push({
      title: stripHtml(get('title')),
      link: stripHtml(get('link')),
      pubDate: stripHtml(get('pubDate')),
      source: stripHtml(get('source')) || extractSourceFromTitle(stripHtml(get('title'))),
      description: stripHtml(get('description'))
    });
  }
  return items;
}

function extractSourceFromTitle(title='') {
  const parts = title.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : 'Google News';
}

function cleanTitle(title='') {
  return title.replace(/\s+-\s+[^-]+$/,'').replace(/\s+/g,' ').trim();
}

function extractPropertyName(title, description='') {
  const text = `${cleanTitle(title)} ${description}`;
  const patterns = [
    /([A-Z][A-Za-z0-9'&.\- ]{2,80}\s+(?:Apartments|Apartment Homes|Apts|Townhomes|Commons|Village|Place|Pointe|Point|Crossing|Station|Lofts|Flats|Manor|Park|Square|Center|Centre|Hotel|Suites|Inn|Plaza|Mall|Warehouse|Distribution Center|Business Park|Office Park|School|Hospital|Medical Center))/,
    /at\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/,
    /damages?\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/,
    /fire\s+at\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return m[1].replace(/\b(on|in|near|after|where)$/i, '').trim();
    }
  }
  return '';
}

function classifyFire(title, description='') {
  const text = `${title} ${description}`.toLowerCase();
  if (settings.excludeTerms.some(t => text.includes(t))) return { keep:false, category:'Excluded', reason:'Excluded residential/noise term' };
  const checks = [
    ['Multifamily Fire', ['apartment', 'apartments', 'multifamily', 'senior living', 'assisted living']],
    ['Hotel Fire', ['hotel', 'motel', 'inn', 'suites', 'extended stay']],
    ['Industrial Fire', ['warehouse', 'industrial', 'distribution center', 'manufacturing']],
    ['Office Fire', ['office building', 'office park']],
    ['Retail Fire', ['shopping center', 'retail', 'mall', 'store', 'restaurant']],
    ['Healthcare Fire', ['hospital', 'medical center', 'clinic', 'nursing']],
    ['Education Fire', ['school', 'college', 'university']],
    ['Commercial Structure Fire', ['commercial', 'business', 'structure fire', 'building fire']]
  ];
  for (const [category, terms] of checks) {
    if (terms.some(t => text.includes(t))) return { keep:true, category, reason:`Matched ${category}` };
  }
  if (text.includes('fire')) return { keep:true, category:'Needs Verification', reason:'Fire-related article requires commercial verification' };
  return { keep:false, category:'Not Fire', reason:'No fire signal' };
}

function calculateScores(record, articleAgeHours, sourceCount) {
  const base = scoring.base[record.category] || 20;
  let opportunity = base;
  if (articleAgeHours <= 24) opportunity += scoring.bonuses.freshWithin24Hours;
  else if (articleAgeHours <= 72) opportunity += scoring.bonuses.freshWithin72Hours;
  if (sourceCount > 1) opportunity += scoring.bonuses.multipleSources;
  if (record.propertyName && record.propertyName !== 'Property Requires Verification') opportunity += scoring.bonuses.resolvedPropertyName;
  if (record.sources.some(s => s.url)) opportunity += scoring.bonuses.sourceLink;
  if (record.sources.some(s => s.publishedAt)) opportunity += scoring.bonuses.articleDate;
  opportunity = Math.min(100, opportunity);
  const confidence = Math.min(99, 65 + (sourceCount * 8) + (record.propertyName !== 'Property Requires Verification' ? 12 : 0) + (record.sources.some(s => s.publishedAt) ? 6 : 0));
  const freshness = Math.max(0, Math.round(100 - (articleAgeHours / 72) * 100));
  const impact = Math.min(100, base * 2);
  const coverage = record.propertyName !== 'Property Requires Verification' ? 55 : 25;
  const signalStrength = Math.min(100, sourceCount * 25);
  const overall = Math.round((opportunity * 0.35) + (confidence * 0.25) + (freshness * 0.2) + (impact * 0.15) + (coverage * 0.05));
  return { overall, opportunity, confidence, freshness, impact, coverage, signalStrength };
}

function buildOpportunity(group) {
  const sorted = group.items.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const lead = sorted[0];
  const articleAgeHours = hoursBetween(new Date(lead.publishedAt), new Date());
  const propertyName = lead.propertyName || 'Property Requires Verification';
  const sources = sorted.map(item => ({
    name: item.source || extractSourceFromTitle(item.title),
    title: cleanTitle(item.title),
    url: item.link,
    publishedAt: item.publishedAt
  }));
  const temp = { propertyName, category: lead.category, sources };
  const scores = calculateScores(temp, articleAgeHours, sources.length);
  const id = `PI-${new Date().getUTCFullYear()}-${hash(`${propertyName}|${lead.category}|${lead.publishedAt}`).toUpperCase()}`;
  return {
    id,
    propertyId: `PIR-${hash(propertyName || lead.groupKey).toUpperCase()}`,
    propertyName,
    propertyStatus: propertyName === 'Property Requires Verification' ? 'Needs Verification' : 'Extracted - Needs Property Verification',
    county: 'Mecklenburg / Charlotte Metro',
    territory: settings.territoryName,
    category: lead.category,
    opportunityClass: 'Emergency',
    eventDate: lead.publishedAt,
    publishedDate: lead.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings: scores,
    whatChanged: cleanTitle(lead.title),
    whyNow: 'This is a recent fire-related public signal inside the Charlotte metro monitoring window. Emergency events are time-sensitive and should be reviewed quickly.',
    whyThisMatters: 'Commercial and multifamily fire events can create needs for emergency stabilization, smoke remediation, water mitigation from fire suppression, demolition, drying, and reconstruction.',
    recommendedServices: [
      'Emergency response',
      'Fire restoration',
      'Smoke remediation',
      'Water mitigation',
      'Commercial reconstruction',
      'Annual property documentation after restoration'
    ],
    evidenceCount: sources.length,
    sources,
    signalBreakdown: [
      { label: lead.category, points: scoring.base[lead.category] || 20 },
      { label: 'Recent emergency article', points: articleAgeHours <= 24 ? 15 : 10 },
      { label: 'Supporting sources', points: sources.length > 1 ? 10 : 0 },
      { label: 'Property name extracted', points: propertyName !== 'Property Requires Verification' ? 8 : 0 }
    ].filter(x => x.points > 0)
  };
}

async function fetchFeed(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const started = Date.now();
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PI/0.2.2' } });
  const text = await res.text();
  return { query, url, status: res.status, ok: res.ok, durationMs: Date.now() - started, text };
}

async function main() {
  const runStarted = nowIso();
  const raw = [];
  const health = [];
  for (const query of settings.googleNewsQueries) {
    try {
      const feed = await fetchFeed(query);
      const items = feed.ok ? parseRss(feed.text) : [];
      raw.push(...items.map(x => ({ ...x, query })));
      health.push({ source:'Google News RSS', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }

  const seenLinks = new Set();
  const candidates = [];
  const now = new Date();
  let oldExcluded = 0, nonCommercialExcluded = 0, duplicateRawExcluded = 0;
  for (const item of raw) {
    if (!item.link || seenLinks.has(item.link)) { duplicateRawExcluded++; continue; }
    seenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { oldExcluded++; continue; }
    const ageHours = hoursBetween(pub, now);
    if (ageHours > settings.emergencyMaxAgeHours) { oldExcluded++; continue; }
    const cls = classifyFire(item.title, item.description);
    if (!cls.keep) { nonCommercialExcluded++; continue; }
    const propertyName = extractPropertyName(item.title, item.description);
    candidates.push({
      title: item.title,
      description: item.description,
      link: item.link,
      source: item.source || extractSourceFromTitle(item.title),
      publishedAt: pub.toISOString(),
      category: cls.category,
      classificationReason: cls.reason,
      propertyName: propertyName || '',
      groupKey: `${slug(propertyName || cleanTitle(item.title).slice(0,80))}|${cls.category}|${pub.toISOString().slice(0,10)}`
    });
  }

  const groups = new Map();
  for (const item of candidates) {
    const key = item.groupKey;
    if (!groups.has(key)) groups.set(key, { key, items: [] });
    groups.get(key).items.push(item);
  }
  const opportunities = [...groups.values()].map(buildOpportunity).sort((a,b) => b.ratings.overall - a.ratings.overall);
  const properties = opportunities.map(o => ({
    propertyId: o.propertyId,
    propertyName: o.propertyName,
    status: o.propertyStatus,
    territory: o.territory,
    county: o.county,
    latestSignal: o.category,
    latestSignalDate: o.eventDate,
    evidenceCount: o.evidenceCount,
    confidence: o.ratings.confidence,
    sources: o.sources
  }));
  const output = {
    generatedAt: nowIso(),
    version: settings.version,
    territory: settings.territoryName,
    summary: {
      rawItemsRetrieved: raw.length,
      candidates: candidates.length,
      opportunities: opportunities.length,
      properties: properties.length,
      oldItemsExcluded: oldExcluded,
      nonCommercialExcluded,
      duplicateRawExcluded,
      duplicateGroupsMerged: candidates.length - opportunities.length
    },
    health,
    opportunities,
    properties
  };
  const dataDir = path.join(root, 'dist', 'data');
  ensureDir(dataDir);
  fs.writeFileSync(path.join(dataDir, 'opportunities.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(dataDir, 'properties.json'), JSON.stringify({ generatedAt: output.generatedAt, properties }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'source-health.json'), JSON.stringify({ generatedAt: output.generatedAt, health, summary: output.summary }, null, 2));
  console.log(`PI update complete. Opportunities: ${opportunities.length}. Old excluded: ${oldExcluded}. Non-commercial excluded: ${nonCommercialExcluded}.`);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { parseRss, classifyFire, extractPropertyName, buildOpportunity };
