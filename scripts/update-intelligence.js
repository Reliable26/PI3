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
function normalizeText(value='') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function escapeRegex(value='') { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function containsPhrase(haystack='', phrase='') {
  const h = normalizeText(haystack);
  const p = normalizeText(phrase);
  return p ? h.includes(p) : false;
}
function cleanTitle(title='') { return title.replace(/\s+-\s+[^-]+$/,'').replace(/\s+/g,' ').trim(); }

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

function hasSectionExclusion(item) {
  const text = `${item.title || ''} ${item.description || ''} ${item.source || ''} ${item.link || ''}`.toLowerCase();
  return (settings.sectionExcludeTerms || []).some(term => text.includes(String(term).toLowerCase()));
}
function hasForeignExclusion(item) {
  const text = `${item.title || ''} ${item.description || ''} ${item.source || ''} ${item.link || ''}`;
  return (settings.foreignExcludeTerms || []).some(term => containsPhrase(text, term));
}
function hasExplicitTerritorySignal(item) {
  const articleText = `${item.title || ''} ${item.description || ''}`;
  return (settings.targetGeoTerms || []).some(term => containsPhrase(articleText, term));
}
function isInsideTargetTerritory(item) {
  if (hasSectionExclusion(item)) return false;
  if (hasForeignExclusion(item)) return false;
  return hasExplicitTerritorySignal(item);
}

const EVENT_PREFIXES = [
  'fire damages', 'fire damaged', 'fire destroys', 'fire destroyed',
  'fire breaks out at', 'fire reported at', 'fire at', 'blaze at',
  'blaze damages', '2-alarm fire at', 'two-alarm fire at',
  '3-alarm fire at', 'three-alarm fire at', 'commercial fire at',
  'crews battle fire at', 'crews battle blaze at', 'apartment fire at',
  'structure fire at', 'roof collapse at', 'explosion at',
  'permit issued for', 'building permit issued for', 'commercial permit issued for',
  'permits filed for', 'permit filed for', 'plans filed for', 'developer seeks permit for'
];

function removeEventPhrases(text='') {
  let cleaned = text
    .replace(/\s+-\s+[^-]+$/, '')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  for (const phrase of EVENT_PREFIXES) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegex(phrase)}\\s+`, 'i'), '');
  }
  cleaned = cleaned
    .replace(/^\d+\s+(?:hurt|injured|displaced|rescued)\s+after\s+(?:crews\s+)?(?:battle\s+)?(?:a\s+)?(?:\d+-alarm|two-alarm|three-alarm)?\s*(?:apartment|commercial|structure)?\s*fire\s+(?:at|in|near)?\s*/i, '')
    .replace(/^(?:after|following)\s+(?:a\s+)?(?:fire|blaze)\s+(?:at|near|in)\s+/i, '')
    .trim();
  return cleaned;
}

function cleanPropertyCandidate(candidate='') {
  return candidate
    .replace(/^\s*(?:at|near|in|inside|outside|for)\s+/i, '')
    .replace(/\b(?:in|on|near|after|where|following|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Monday|when|as)\b.*$/i, '')
    .replace(/[,:;.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPropertyName(title, description='') {
  const cleanedTitle = removeEventPhrases(cleanTitle(title));
  const text = `${cleanedTitle} ${description}`.replace(/\s+/g, ' ').trim();
  const propertySuffix = '(?:Apartments|Apartment Homes|Apts\\.?|Townhomes|Commons|Village|Place|Pointe|Point|Crossing|Station|Lofts|Flats|Manor|Park|Square|Center|Centre|Hotel|Suites|Inn|Plaza|Mall|Warehouse|Distribution Center|Business Park|Office Park|School|Hospital|Medical Center|Apartments)';
  const patterns = [
    new RegExp(`([A-Z][A-Za-z0-9'&.\\- ]{1,80}\\s+${propertySuffix})`, 'i'),
    /(?:at|near|inside|for)\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/i,
    /(?:damages?|destroyed?|hits?|planned for|filed for)\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/i
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const candidate = cleanPropertyCandidate(m[1]);
      if (candidate.length >= 3) return candidate;
    }
  }
  const fallback = cleanPropertyCandidate(cleanedTitle);
  if (/\b(apartment|apartments|hotel|warehouse|office|school|hospital|center|centre|mall|plaza|business park|distribution center)\b/i.test(fallback)) return fallback;
  return '';
}

function hasExcludedCommercialNoise(text='') {
  const t = text.toLowerCase();
  return (settings.excludeTerms || []).some(term => t.includes(String(term).toLowerCase()));
}

function classifyFire(title, description='') {
  const text = `${title} ${description}`.toLowerCase();
  if (hasExcludedCommercialNoise(text)) return { keep:false, category:'Excluded', reason:'Excluded residential/noise term' };
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
    if (terms.some(t => text.includes(t))) return { keep:true, category, reason:`Matched ${category}`, opportunityClass:'Emergency' };
  }
  if (text.includes('fire')) return { keep:true, category:'Needs Verification', reason:'Fire-related article requires commercial verification', opportunityClass:'Emergency' };
  return { keep:false, category:'Not Fire', reason:'No fire signal' };
}

function classifyPermit(title, description='') {
  const text = `${title} ${description}`.toLowerCase();
  if (hasExcludedCommercialNoise(text)) return { keep:false, category:'Excluded', reason:'Excluded residential/noise term' };
  const hasPermitSignal = /\b(permit|permits|permitting|commercial alteration|tenant improvement|building permit|plans filed|construction permit)\b/i.test(text);
  const hasCapitalSignal = /\b(roof|roofing|tpo|epdm|waterproofing|building envelope|exterior renovation|facade|windows|doors|stucco|eifs|siding|commercial alteration|tenant improvement|buildout|build-out|fire repair|water damage|structural repair|renovation)\b/i.test(text);
  if (!hasPermitSignal && !hasCapitalSignal) return { keep:false, category:'Not Permit', reason:'No permit/capital signal' };
  const checks = [
    ['Fire Repair Permit', ['fire repair', 'fire damage', 'smoke damage']],
    ['Water Damage Permit', ['water damage', 'water intrusion', 'flood damage']],
    ['Commercial Roof Permit', ['roof replacement', 'roofing', 'roof permit', 'tpo', 'epdm', 'modified bitumen', 'metal roof', 'roof coating']],
    ['Building Envelope Permit', ['building envelope', 'facade', 'façade', 'windows', 'doors', 'stucco', 'eifs', 'siding', 'masonry', 'flashing']],
    ['Waterproofing Permit', ['waterproofing', 'sealant', 'sealants', 'caulking']],
    ['Exterior Renovation Permit', ['exterior renovation', 'exterior repair', 'exterior paint', 'painting', 'carpentry', 'gutters']],
    ['Structural Repair Permit', ['structural repair', 'structural', 'foundation repair']],
    ['Commercial Alteration Permit', ['commercial alteration', 'alteration permit', 'building permit', 'commercial permit']],
    ['Tenant Improvement Permit', ['tenant improvement', 'tenant upfit', 'buildout', 'build-out', 'interior renovation']]
  ];
  for (const [category, terms] of checks) {
    if (terms.some(t => text.includes(t))) return { keep:true, category, reason:`Matched ${category}`, opportunityClass:'Capital Improvement' };
  }
  return { keep:true, category:'Capital Improvement Permit', reason:'Permit/capital activity requires review', opportunityClass:'Capital Improvement' };
}

function calculateScores(record, articleAgeHours, sourceCount) {
  const base = scoring.base[record.category] || 20;
  let opportunity = base;
  if (articleAgeHours <= 24) opportunity += scoring.bonuses.freshWithin24Hours;
  else if (articleAgeHours <= 72) opportunity += scoring.bonuses.freshWithin72Hours;
  else if (articleAgeHours <= 336) opportunity += scoring.bonuses.freshWithin14Days || 0;
  if (record.opportunityClass === 'Capital Improvement') opportunity += scoring.bonuses.capitalSignal || 0;
  if (sourceCount > 1) opportunity += scoring.bonuses.multipleSources;
  if (record.propertyName && record.propertyName !== 'Property Requires Verification') opportunity += scoring.bonuses.resolvedPropertyName;
  if (record.sources.some(s => s.url)) opportunity += scoring.bonuses.sourceLink;
  if (record.sources.some(s => s.publishedAt)) opportunity += scoring.bonuses.articleDate;
  opportunity = Math.min(100, opportunity);
  const confidence = Math.min(99, 65 + (sourceCount * 8) + (record.propertyName !== 'Property Requires Verification' ? 12 : 0) + (record.sources.some(s => s.publishedAt) ? 6 : 0));
  const maxWindow = record.opportunityClass === 'Emergency' ? 72 : 336;
  const freshness = Math.max(0, Math.round(100 - (articleAgeHours / maxWindow) * 100));
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
  const temp = { propertyName, category: lead.category, opportunityClass: lead.opportunityClass, sources };
  const scores = calculateScores(temp, articleAgeHours, sources.length);
  const id = `PI-${new Date().getUTCFullYear()}-${hash(`${propertyName}|${lead.category}|${lead.publishedAt}`).toUpperCase()}`;
  const isCapital = lead.opportunityClass === 'Capital Improvement';
  return {
    id,
    propertyId: `PIR-${hash(propertyName || lead.groupKey).toUpperCase()}`,
    propertyName,
    propertyStatus: propertyName === 'Property Requires Verification' ? 'Needs Verification' : 'Extracted - Needs Property Verification',
    county: 'Mecklenburg / Charlotte Metro',
    territory: settings.territoryName,
    module: lead.module,
    category: lead.category,
    opportunityClass: lead.opportunityClass,
    eventDate: lead.publishedAt,
    publishedDate: lead.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings: scores,
    whatChanged: cleanTitle(lead.title),
    whyNow: isCapital
      ? 'This is a recent permit or capital-improvement public signal inside the Charlotte metro monitoring window. Active permitting is a timely reason to review exterior, envelope, water-intrusion, and reconstruction opportunities.'
      : 'This is a recent fire-related public signal inside the Charlotte metro monitoring window. Emergency events are time-sensitive and should be reviewed quickly.',
    whyThisMatters: isCapital
      ? 'Commercial permit activity can indicate planned capital improvements, roofing, waterproofing, exterior renovation, tenant improvement, or reconstruction work. These projects create opportunities to discuss leak investigations, water intrusion inspections, building envelope services, and commercial reconstruction support.'
      : 'Commercial and multifamily fire events can create needs for emergency stabilization, smoke remediation, water mitigation from fire suppression, demolition, drying, and reconstruction.',
    recommendedServices: isCapital ? [
      'Leak investigation',
      'Water intrusion inspection',
      'Building envelope assessment',
      'Waterproofing',
      'Commercial reconstruction',
      'Exterior repairs',
      'Interior build-back'
    ] : [
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
      { label: isCapital ? 'Recent capital/permit signal' : 'Recent emergency article', points: articleAgeHours <= 24 ? 15 : (articleAgeHours <= 72 ? 10 : 8) },
      { label: 'Supporting sources', points: sources.length > 1 ? 10 : 0 },
      { label: 'Property name extracted', points: propertyName !== 'Property Requires Verification' ? 8 : 0 }
    ].filter(x => x.points > 0)
  };
}

async function fetchFeed(query, module) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const started = Date.now();
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PI/0.2.3' } });
  const text = await res.text();
  return { query, module, url, status: res.status, ok: res.ok, durationMs: Date.now() - started, text };
}

async function validateSource(source) {
  const started = Date.now();
  try {
    const res = await fetch(source.url, { headers: { 'user-agent': 'Mozilla/5.0 PI/0.2.3' } });
    return { source: source.name, module:'Permit Intelligence', query:'Source validation', status: res.ok ? 'pass' : 'warning', httpStatus: res.status, durationMs: Date.now() - started, itemsRetrieved: 0, note:'Connectivity validation only; production permit extraction still requires source-specific parser.' };
  } catch (err) {
    return { source: source.name, module:'Permit Intelligence', query:'Source validation', status:'fail', error: err.message, durationMs: Date.now() - started, itemsRetrieved: 0 };
  }
}

function processItems(raw, moduleName, classifier, maxAgeHours) {
  const seenLinks = new Set();
  const candidates = [];
  const now = new Date();
  const stats = { oldExcluded:0, nonCommercialExcluded:0, duplicateRawExcluded:0, outOfTerritoryExcluded:0 };
  for (const item of raw) {
    if (!item.link || seenLinks.has(item.link)) { stats.duplicateRawExcluded++; continue; }
    seenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { stats.oldExcluded++; continue; }
    const ageHours = hoursBetween(pub, now);
    if (ageHours > maxAgeHours) { stats.oldExcluded++; continue; }
    if (!isInsideTargetTerritory(item)) { stats.outOfTerritoryExcluded++; continue; }
    const cls = classifier(item.title, item.description);
    if (!cls.keep) { stats.nonCommercialExcluded++; continue; }
    const propertyName = extractPropertyName(item.title, item.description);
    candidates.push({
      module: moduleName,
      title: item.title,
      description: item.description,
      link: item.link,
      source: item.source || extractSourceFromTitle(item.title),
      publishedAt: pub.toISOString(),
      category: cls.category,
      opportunityClass: cls.opportunityClass,
      classificationReason: cls.reason,
      propertyName: propertyName || '',
      groupKey: `${slug(propertyName || cleanTitle(item.title).slice(0,80))}|${cls.category}|${pub.toISOString().slice(0,10)}`
    });
  }
  return { candidates, stats };
}

async function main() {
  const rawFire = [];
  const rawPermit = [];
  const health = [];

  const fireQueries = settings.googleNewsFireQueries || settings.googleNewsQueries || [];
  for (const query of fireQueries) {
    try {
      const feed = await fetchFeed(query, 'Commercial Fire Intelligence');
      const items = feed.ok ? parseRss(feed.text) : [];
      rawFire.push(...items.map(x => ({ ...x, query })));
      health.push({ source:'Google News RSS', module:'Commercial Fire Intelligence', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS', module:'Commercial Fire Intelligence', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }

  for (const query of (settings.googleNewsPermitQueries || [])) {
    try {
      const feed = await fetchFeed(query, 'Permit Intelligence');
      const items = feed.ok ? parseRss(feed.text) : [];
      rawPermit.push(...items.map(x => ({ ...x, query })));
      health.push({ source:'Google News RSS', module:'Permit Intelligence', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS', module:'Permit Intelligence', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }

  for (const source of (settings.permitValidationSources || [])) {
    health.push(await validateSource(source));
  }

  const fire = processItems(rawFire, 'Commercial Fire Intelligence', classifyFire, settings.emergencyMaxAgeHours || 72);
  const permit = processItems(rawPermit, 'Permit Intelligence', classifyPermit, (settings.standardMaxArticleAgeDays || 14) * 24);
  const candidates = [...fire.candidates, ...permit.candidates];

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

  const summary = {
    rawItemsRetrieved: rawFire.length + rawPermit.length,
    fireRawItemsRetrieved: rawFire.length,
    permitRawItemsRetrieved: rawPermit.length,
    candidates: candidates.length,
    fireCandidates: fire.candidates.length,
    permitCandidates: permit.candidates.length,
    opportunities: opportunities.length,
    emergencyOpportunities: opportunities.filter(o => o.opportunityClass === 'Emergency').length,
    capitalOpportunities: opportunities.filter(o => o.opportunityClass === 'Capital Improvement').length,
    properties: properties.length,
    oldItemsExcluded: fire.stats.oldExcluded + permit.stats.oldExcluded,
    nonCommercialExcluded: fire.stats.nonCommercialExcluded + permit.stats.nonCommercialExcluded,
    outOfTerritoryExcluded: fire.stats.outOfTerritoryExcluded + permit.stats.outOfTerritoryExcluded,
    duplicateRawExcluded: fire.stats.duplicateRawExcluded + permit.stats.duplicateRawExcluded,
    duplicateGroupsMerged: candidates.length - opportunities.length
  };

  const output = { generatedAt: nowIso(), version: settings.version, territory: settings.territoryName, summary, health, opportunities, properties };
  const dataDir = path.join(root, 'dist', 'data');
  ensureDir(dataDir);
  fs.writeFileSync(path.join(dataDir, 'opportunities.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(dataDir, 'properties.json'), JSON.stringify({ generatedAt: output.generatedAt, properties }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'source-health.json'), JSON.stringify({ generatedAt: output.generatedAt, health, summary }, null, 2));
  console.log(`PI update complete. Opportunities: ${opportunities.length}. Emergency: ${summary.emergencyOpportunities}. Capital: ${summary.capitalOpportunities}. Out-of-territory excluded: ${summary.outOfTerritoryExcluded}.`);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { parseRss, classifyFire, classifyPermit, extractPropertyName, isInsideTargetTerritory, buildOpportunity, processItems };
