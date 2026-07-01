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

function normalizeText(value='') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isLocalTrustedSource(source='') {
  const src = normalizeText(source);
  return (settings.localSourceTerms || []).some(term => src.includes(normalizeText(term)));
}

function containsPhrase(haystack='', phrase='') {
  const h = normalizeText(haystack);
  const p = normalizeText(phrase);
  if (!p) return false;
  return h.includes(p);
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
  // Important: do not use the Google query or source domain alone.
  // Local outlets can publish world/national syndicated articles. The article title/snippet itself must contain territory.
  const articleText = `${item.title || ''} ${item.description || ''}`;
  return (settings.targetGeoTerms || []).some(term => containsPhrase(articleText, term));
}

function isInsideTargetTerritory(item) {
  if (hasSectionExclusion(item)) return false;
  if (hasForeignExclusion(item)) return false;
  return hasExplicitTerritorySignal(item);
}

function cleanTitle(title='') {
  return title.replace(/\s+-\s+[^-]+$/,'').replace(/\s+/g,' ').trim();
}

const EVENT_PREFIXES = [
  'fire damages', 'fire damaged', 'fire destroys', 'fire destroyed',
  'fire breaks out at', 'fire reported at', 'fire at', 'blaze at',
  'blaze damages', '2-alarm fire at', 'two-alarm fire at',
  '3-alarm fire at', 'three-alarm fire at', 'commercial fire at',
  'crews battle fire at', 'crews battle blaze at', 'apartment fire at',
  'structure fire at', 'roof collapse at', 'explosion at'
];

function escapeRegex(value='') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    .replace(/^\s*(?:at|near|in|inside|outside)\s+/i, '')
    .replace(/\b(?:in|on|near|after|where|following|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Monday)\b.*$/i, '')
    .replace(/[,:;.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPropertyName(title, description='') {
  const cleanedTitle = removeEventPhrases(cleanTitle(title));
  const text = `${cleanedTitle} ${description}`.replace(/\s+/g, ' ').trim();
  const propertySuffix = '(?:Apartments|Apartment Homes|Apts\\.?|Townhomes|Commons|Village|Place|Pointe|Point|Crossing|Station|Lofts|Flats|Manor|Park|Square|Center|Centre|Hotel|Suites|Inn|Plaza|Mall|Warehouse|Distribution Center|Business Park|Office Park|School|Hospital|Medical Center)';
  const patterns = [
    new RegExp(`([A-Z][A-Za-z0-9'&.\\- ]{1,80}\\s+${propertySuffix})`, 'i'),
    /(?:at|near|inside)\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/i,
    /(?:damages?|destroyed?|hits?)\s+([A-Z][A-Za-z0-9'&.\- ]{2,80})\s+(?:in|on|near|after|,|\.)/i
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const candidate = cleanPropertyCandidate(m[1]);
      if (candidate.length >= 3) return candidate;
    }
  }
  const fallback = cleanPropertyCandidate(cleanedTitle);
  if (/\b(apartment|apartments|hotel|warehouse|office|school|hospital|center|centre|mall|plaza)\b/i.test(fallback)) return fallback;
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


function getAttr(feature, name) {
  return feature && feature.attributes ? feature.attributes[name] : undefined;
}

function esriDateToIso(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function buildArcGisQueryUrl(source) {
  const params = new URLSearchParams({
    where: 'issuedate IS NOT NULL',
    outFields: 'permitnum,permitdesc,permitstat,permittype,projname,projnum,projdesc,projphase,projadd,zipcode,parcelnum,taxjuris,zonecode,typeofbldg,numunits,usdcdesc,issuedate,bldgcost,constrtype,occupancy,prmtfeetype,worktype,workdesc,totalsqft,ownname',
    returnGeometry: 'false',
    orderByFields: 'issuedate DESC',
    resultRecordCount: String(source.resultRecordCount || 500),
    f: 'json'
  });
  return `${source.url}?${params.toString()}`;
}

async function fetchPermitSource(source) {
  const url = buildArcGisQueryUrl(source);
  const started = Date.now();
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PI/0.2.4' } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  const features = json && Array.isArray(json.features) ? json.features : [];
  return { source, url, ok: res.ok && Array.isArray(features), status: res.status, durationMs: Date.now() - started, features, rawText: text.slice(0, 300) };
}

function firstValue(attrs, names) {
  for (const name of names) {
    const v = attrs[name];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function permitText(attrs) {
  return [
    firstValue(attrs, ['workdesc','permitdesc','projdesc','description_of_work','description','Descriptio']),
    firstValue(attrs, ['projname','project_name']),
    firstValue(attrs, ['worktype','permittype','permit_type','type_of_work']),
    firstValue(attrs, ['occupancy','usdcdesc','constrtype','occupancy_code','usdc_code_and_description','construction_type']),
    firstValue(attrs, ['ProposedUs']),
    firstValue(attrs, ['ExistingUs']),
    firstValue(attrs, ['projadd','project_address','Address'])
  ].join(' ');
}

function classifyPermit(attrs) {
  const rawText = permitText(attrs);
  const text = normalizeText(rawText);
  const hasTarget = (settings.permitTargetTerms || []).some(t => text.includes(normalizeText(t)));
  const commercialHints = [
    ...(settings.permitCommercialTerms || []),
    'bldg commercial','building commercial','commercial building','non residential','nonresidential','mercantile','business','assembly','institutional','educational','hotel','apartment','multi family','multifamily','office','retail','industrial','warehouse','restaurant','medical'
  ];
  const residentialOnly = ['single family','sfd','duplex','townhome','townhouse','deck','pool','shed','detached garage'];
  if (residentialOnly.some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Residential/Unknown Permit', reason:'Residential-only permit signal' };
  const hasCommercial = commercialHints.some(t => text.includes(normalizeText(t))) || /\b(com|bus|off|ret|ind|apt|hot|med|edu)\b/i.test(rawText);
  if (!hasTarget) return { keep:false, category:'Non-target Permit', reason:'No Reliable service-related permit keyword' };
  if (!hasCommercial) return { keep:false, category:'Residential/Unknown Permit', reason:'No commercial property signal' };
  const catChecks = [
    ['Waterproofing', ['waterproof','waterproofing']],
    ['Roofing', ['roof replacement','roof repair','reroof','re roof','tpo','epdm','membrane']],
    ['Building Envelope', ['building envelope','envelope','facade','façade','siding','stucco','eifs','window','windows','door','doors']],
    ['Exterior Renovation', ['exterior','facade','façade','siding','stucco','eifs','paint','painting']],
    ['Fire Restoration', ['fire damage','smoke']],
    ['Water Damage', ['water damage','mold']],
    ['Structural Repair', ['structural']],
    ['Commercial Alteration', ['commercial alteration','alteration','renovation','upfit','tenant improvement','buildout','build out','build-out','repair']]
  ];
  for (const [category, terms] of catChecks) {
    if (terms.some(t => text.includes(normalizeText(t)))) return { keep:true, category, reason:`Matched ${category} permit` };
  }
  return { keep:true, category:'Capital Improvement', reason:'Matched target commercial permit' };
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizePermitFeature(feature, source) {
  const attrs = feature.attributes || {};
  const issuedIso = esriDateToIso(firstValue(attrs, ['issuedate','issue_date','IssuedDate']));
  const classification = classifyPermit(attrs);
  const address = String(firstValue(attrs, ['projadd','project_address','Address'])).trim();
  const desc = String(firstValue(attrs, ['workdesc','permitdesc','projdesc','description_of_work','description','Descriptio'])).trim();
  const cost = parseMoney(firstValue(attrs, ['bldgcost','building_construction_cost_customer','building_construction_cost_system','Cost']));
  const permitNumber = firstValue(attrs, ['permitnum','permit_number','CaseNumber']);
  const parcel = firstValue(attrs, ['parcelnum','cama_parcel_number','matparcelnum','BLOCKLOT']);
  return {
    module: 'Permit Intelligence',
    title: `${classification.category}: ${address || permitNumber || 'Mecklenburg permit'}`,
    description: desc,
    link: source.sourceUrl || source.url,
    source: source.name,
    publishedAt: issuedIso,
    eventDate: issuedIso,
    category: classification.category,
    classificationReason: classification.reason,
    keep: classification.keep,
    address,
    caseNumber: permitNumber || '',
    parcelId: parcel || '',
    existingUse: firstValue(attrs, ['ExistingUs','occupancy','usdcdesc','occupancy_code','usdc_code_and_description']),
    proposedUse: firstValue(attrs, ['ProposedUs','permittype','worktype','permit_type','type_of_work']),
    cost,
    neighborhood: firstValue(attrs, ['taxjuris','Neighborho','tax_jurisdiction']),
    propertyName: firstValue(attrs, ['projname','project_name']) || address || 'Property Requires Verification',
    opportunityClass: 'Capital Improvement',
    raw: attrs
  };
}

function permitScores(record, ageDays) {
  const baseMap = { 'Roofing':78, 'Building Envelope':82, 'Waterproofing':80, 'Exterior Renovation':72, 'Commercial Alteration':70, 'Fire Restoration':90, 'Water Damage':90, 'Structural Repair':84, 'Capital Improvement':68 };
  const opportunity = Math.min(100, (baseMap[record.category] || 65) + (record.cost > 250000 ? 8 : 0));
  const confidence = Math.min(98, 76 + (record.address ? 10 : 0) + (record.caseNumber ? 6 : 0) + (record.description ? 4 : 0));
  const freshness = Math.max(0, Math.round(100 - (ageDays / Math.max(settings.permitMaxAgeDays || 730, 1)) * 100));
  const impact = Math.min(100, 55 + (record.cost > 100000 ? 15 : 0) + (record.cost > 500000 ? 15 : 0));
  const coverage = record.address ? 65 : 35;
  const signalStrength = 80;
  const overall = Math.round((opportunity * 0.4) + (confidence * 0.25) + (freshness * 0.15) + (impact * 0.15) + (coverage * 0.05));
  return { overall, opportunity, confidence, freshness, impact, coverage, signalStrength };
}

function buildPermitOpportunity(record) {
  const ageDays = record.publishedAt ? hoursBetween(new Date(record.publishedAt), new Date()) / 24 : 999;
  const ratings = permitScores(record, ageDays);
  const propertyName = record.address || 'Property Requires Verification';
  return {
    id: `PI-${new Date().getUTCFullYear()}-${hash(`permit|${record.caseNumber}|${record.address}|${record.category}`).toUpperCase()}`,
    propertyId: `PIR-${hash(propertyName).toUpperCase()}`,
    propertyName,
    propertyStatus: record.address ? 'Permit Address Extracted - Needs Property Verification' : 'Needs Verification',
    county: 'Mecklenburg',
    territory: settings.territoryName,
    category: record.category,
    opportunityClass: 'Capital Improvement',
    eventDate: record.eventDate,
    publishedDate: record.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings,
    whatChanged: `${record.category} permit signal found${record.caseNumber ? ` (${record.caseNumber})` : ''}${record.address ? ` at ${record.address}` : ''}.`,
    whyNow: 'This permit is an official public construction signal. Capital improvement and alteration activity creates a timely reason to contact the property while work is being planned or underway.',
    whyThisMatters: 'Commercial roofing, envelope, waterproofing, exterior, alteration, fire, water, and structural permits often indicate conditions where Reliable Restorations can discuss leak investigation, water intrusion inspections, mitigation planning, reconstruction, and building envelope services.',
    recommendedServices: ['Leak investigation','Water intrusion inspection','Building envelope assessment','Commercial reconstruction','Interior build back','Exterior repairs','Annual property documentation'],
    evidenceCount: 1,
    sources: [{ name: record.source, title: record.description || record.title, url: record.link, publishedAt: record.publishedAt }],
    signalBreakdown: [
      { label: record.category, points: Math.round((ratings.opportunity || 0) / 2) },
      { label: 'Official Mecklenburg permit source', points: 20 },
      { label: 'Address available', points: record.address ? 8 : 0 },
      { label: 'Permit value signal', points: record.cost > 100000 ? 8 : 0 }
    ].filter(x => x.points > 0),
    permit: { caseNumber: record.caseNumber, address: record.address, parcelId: record.parcelId, cost: record.cost, description: record.description, existingUse: record.existingUse, proposedUse: record.proposedUse }
  };
}

async function main() {
  const raw = [];
  const health = [];

  for (const query of settings.googleNewsQueries) {
    try {
      const feed = await fetchFeed(query);
      const items = feed.ok ? parseRss(feed.text) : [];
      raw.push(...items.map(x => ({ ...x, query, module: 'Commercial Fire Intelligence' })));
      health.push({ source:'Google News RSS', module:'Commercial Fire Intelligence', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS', module:'Commercial Fire Intelligence', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }

  const seenLinks = new Set();
  const candidates = [];
  const now = new Date();
  let oldExcluded = 0, nonCommercialExcluded = 0, duplicateRawExcluded = 0, outOfTerritoryExcluded = 0;
  for (const item of raw) {
    if (!item.link || seenLinks.has(item.link)) { duplicateRawExcluded++; continue; }
    seenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { oldExcluded++; continue; }
    const ageHours = hoursBetween(pub, now);
    if (ageHours > settings.emergencyMaxAgeHours) { oldExcluded++; continue; }
    if (!isInsideTargetTerritory(item)) { outOfTerritoryExcluded++; continue; }
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
      opportunityClass: 'Emergency',
      groupKey: `${slug(propertyName || cleanTitle(item.title).slice(0,80))}|${cls.category}|${pub.toISOString().slice(0,10)}`
    });
  }

  let permitRaw = 0, permitKept = 0, permitExcluded = 0, permitOldExcluded = 0;
  const permitCandidates = [];
  for (const source of (settings.permitSources || []).filter(s => s.enabled)) {
    try {
      const result = await fetchPermitSource(source);
      const normalized = result.features.map(f => normalizePermitFeature(f, source));
      permitRaw += normalized.length;
      for (const record of normalized) {
        if (!record.keep) { permitExcluded++; continue; }
        if (!record.publishedAt) { permitExcluded++; continue; }
        const ageDays = hoursBetween(new Date(record.publishedAt), now) / 24;
        if (ageDays > (settings.permitMaxAgeDays || 730)) { permitOldExcluded++; continue; }
        permitCandidates.push(record);
      }
      permitKept += permitCandidates.length;
      health.push({ source: source.name, module:'Permit Intelligence', query:'ArcGIS FeatureServer latest building permits', status: result.ok ? 'pass' : 'fail', httpStatus: result.status, durationMs: result.durationMs, itemsRetrieved: normalized.length, opportunitiesCreated: permitCandidates.length, url: source.sourceUrl });
    } catch (err) {
      health.push({ source: source.name, module:'Permit Intelligence', query:'ArcGIS FeatureServer latest building permits', status:'fail', error: err.message, itemsRetrieved:0, opportunitiesCreated:0, url: source.sourceUrl });
    }
  }

  const groups = new Map();
  for (const item of candidates) {
    const key = item.groupKey;
    if (!groups.has(key)) groups.set(key, { key, items: [] });
    groups.get(key).items.push(item);
  }
  const fireOpportunities = [...groups.values()].map(buildOpportunity);
  const permitOpportunities = permitCandidates.map(buildPermitOpportunity);
  const opportunities = [...fireOpportunities, ...permitOpportunities].sort((a,b) => b.ratings.overall - a.ratings.overall);
  const properties = opportunities.map(o => ({
    propertyId: o.propertyId,
    propertyName: o.propertyName,
    status: o.propertyStatus,
    territory: o.territory,
    county: o.county,
    latestSignal: o.category,
    latestSignalDate: o.eventDate,
    opportunityClass: o.opportunityClass,
    evidenceCount: o.evidenceCount,
    confidence: o.ratings.confidence,
    sources: o.sources
  }));
  const byClass = opportunities.reduce((acc, o) => { acc[o.opportunityClass] = (acc[o.opportunityClass] || 0) + 1; return acc; }, {});
  const output = {
    generatedAt: nowIso(),
    version: settings.version,
    territory: settings.territoryName,
    summary: {
      rawItemsRetrieved: raw.length + permitRaw,
      candidates: candidates.length + permitCandidates.length,
      opportunities: opportunities.length,
      emergencyOpportunities: byClass.Emergency || 0,
      capitalImprovementOpportunities: byClass['Capital Improvement'] || 0,
      properties: properties.length,
      oldItemsExcluded: oldExcluded,
      nonCommercialExcluded,
      outOfTerritoryExcluded,
      duplicateRawExcluded,
      duplicateGroupsMerged: candidates.length - fireOpportunities.length,
      permitRecordsRetrieved: permitRaw,
      permitCandidates: permitCandidates.length,
      permitExcluded,
      permitOldExcluded
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
  console.log(`PI update complete. Opportunities: ${opportunities.length}. Emergency: ${byClass.Emergency || 0}. Capital: ${byClass['Capital Improvement'] || 0}. Permit records: ${permitRaw}.`);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { parseRss, classifyFire, extractPropertyName, isInsideTargetTerritory, buildOpportunity, classifyPermit, normalizePermitFeature, buildPermitOpportunity };
