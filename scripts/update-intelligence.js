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


function isGenericIncidentNoise(item) {
  const text = `${item.title || ''} ${item.description || ''} ${item.source || ''}`;
  return (settings.incidentGenericExcludeTerms || []).some(term => containsPhrase(text, term));
}

function classifyIncident(title='', description='') {
  const raw = `${title} ${description}`;
  const text = normalizeText(raw);
  if (settings.excludeTerms.some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Excluded', reason:'Excluded residential/noise term' };
  if ((settings.incidentGenericExcludeTerms || []).some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Generic Mold/Advice Content', reason:'Generic advice/blog content' };
  const hasActiveSignal = (settings.incidentActiveTerms || []).some(t => text.includes(normalizeText(t)));
  const hasPropertySignal = (settings.incidentPropertyTerms || []).some(t => text.includes(normalizeText(t)));
  if (!hasActiveSignal) return { keep:false, category:'No Active Building Condition Signal', reason:'No active incident/closure/remediation signal' };
  if (!hasPropertySignal) return { keep:false, category:'No Commercial Property Signal', reason:'Incident not tied to target property type' };

  const checks = [
    ['Mold / Building Closure', ['closed due to mold','closure due to mold','mold closure','fire station closed','school closed','building closed','facility closed','displaced due to mold','mold remediation','mold found','mold discovered','mold growth']],
    ['Water Intrusion / Water Damage', ['water intrusion','water damage','pipe burst','sprinkler discharge','flooding damage','sewage backup']],
    ['Structural Damage / Collapse', ['ceiling collapse','roof collapse','structural damage','unsafe building','condemned']],
    ['Emergency Displacement', ['evacuated','building evacuated','operations displaced','temporarily relocated','displaced']]
  ];
  for (const [category, terms] of checks) {
    if (terms.some(t => text.includes(normalizeText(t)))) return { keep:true, category, reason:`Matched ${category}` };
  }
  return { keep:true, category:'Building Condition Incident', reason:'Matched active building-condition incident' };
}

function classifySocialAgency(title='', description='', source='') {
  const raw = `${title} ${description} ${source}`;
  const text = normalizeText(raw);
  if (settings.excludeTerms.some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Excluded', reason:'Excluded residential/noise term' };
  if ((settings.incidentGenericExcludeTerms || []).some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Generic/Advice Content', reason:'Generic advice/blog content' };
  const hasActiveSignal = (settings.socialActiveTerms || []).some(t => text.includes(normalizeText(t))) || (settings.incidentActiveTerms || []).some(t => text.includes(normalizeText(t)));
  const hasPropertySignal = (settings.incidentPropertyTerms || []).some(t => text.includes(normalizeText(t)));
  if (!hasActiveSignal) return { keep:false, category:'No Active Social Signal', reason:'No active public agency/social event signal' };
  if (!hasPropertySignal) return { keep:false, category:'No Commercial Property Signal', reason:'Social/public post not tied to target property type' };

  const official = (settings.socialOfficialSourceTerms || []).some(t => text.includes(normalizeText(t)));
  const social = (settings.socialSupportSourceTerms || []).some(t => text.includes(normalizeText(t)));
  const checks = [
    ['Public Agency Fire Signal', ['structure fire','apartment fire','commercial fire','fire crews','firefighters','smoke condition']],
    ['Public Agency Evacuation / Displacement', ['evacuated','evacuation','displaced','temporarily relocated']],
    ['Public Agency Water / Sprinkler Signal', ['sprinkler activation','sprinkler discharge','water flow alarm','water intrusion','water damage','pipe burst']],
    ['Public Agency Mold / Closure Signal', ['mold','mold remediation','building closed','facility closed']],
    ['Public Agency Structural Signal', ['ceiling collapse','roof collapse','unsafe building','structural damage']]
  ];
  for (const [category, terms] of checks) {
    if (terms.some(t => text.includes(normalizeText(t)))) {
      return { keep:true, category, reason: official ? `Official/source-indexed public post matched ${category}` : (social ? `Social-web indexed signal matched ${category}` : `Public web signal matched ${category}`), evidenceType: official ? 'Official Public Agency Source' : 'Supporting Social/Public Web Source' };
    }
  }
  return { keep:true, category:'Public Agency / Social Signal', reason:'Matched active public agency/social building-condition signal', evidenceType: official ? 'Official Public Agency Source' : 'Supporting Social/Public Web Source' };
}

function incidentServices(category='') {
  const c = normalizeText(category);
  if (c.includes('mold')) return ['Mold remediation','Water intrusion investigation','Containment','Interior build back','Commercial reconstruction','Annual property documentation'];
  if (c.includes('water')) return ['Water mitigation','Leak investigation','Water intrusion inspection','Drying','Interior build back','Commercial reconstruction'];
  if (c.includes('structural') || c.includes('collapse')) return ['Emergency response','Exterior repairs','Building envelope','Commercial reconstruction','Interior build back','Safety stabilization'];
  return ['Emergency response','Commercial reconstruction','Interior build back','Water mitigation','Mold remediation','Annual property documentation'];
}

function buildIncidentOpportunity(group) {
  const sorted = group.items.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const lead = sorted[0];
  const ageHours = hoursBetween(new Date(lead.publishedAt), new Date());
  const propertyName = lead.propertyName || 'Property Requires Verification';
  const sources = sorted.map(item => ({
    name: item.source || extractSourceFromTitle(item.title),
    title: cleanTitle(item.title),
    url: item.link,
    publishedAt: item.publishedAt
  }));
  const temp = { propertyName, category: 'Commercial Structure Fire', sources };
  const scores = calculateScores(temp, ageHours, sources.length);
  scores.opportunity = Math.min(100, scores.opportunity + 8);
  scores.impact = Math.min(100, scores.impact + 12);
  scores.overall = Math.min(100, Math.round(scores.overall + 8));
  const id = `PI-${new Date().getUTCFullYear()}-${hash(`incident|${propertyName}|${lead.category}|${lead.publishedAt}`).toUpperCase()}`;
  return {
    id,
    propertyId: `PIR-${hash(propertyName || lead.groupKey).toUpperCase()}`,
    propertyName,
    propertyStatus: propertyName === 'Property Requires Verification' ? 'Needs Verification' : 'Extracted - Needs Property Verification',
    county: 'Mecklenburg / Charlotte Metro',
    territory: settings.territoryName,
    category: lead.category,
    opportunityClass: 'Emergency / Incident',
    eventDate: lead.publishedAt,
    publishedDate: lead.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings: scores,
    whatChanged: cleanTitle(lead.title),
    whyNow: 'This is a recent public building-condition signal inside the Charlotte metro monitoring window. Active closures, displacement, mold, water intrusion, or structural issues can create time-sensitive service needs before a permit is issued.',
    whyThisMatters: 'Public building-condition incidents can indicate active remediation, mitigation, containment, investigation, reconstruction, and documentation needs. These signals are especially valuable because they may appear before construction permits or formal project announcements.',
    recommendedServices: incidentServices(lead.category),
    evidenceCount: sources.length,
    sources,
    signalBreakdown: [
      { label: lead.category, points: 35 },
      { label: 'Active building-condition signal', points: 20 },
      { label: 'Recent public source', points: ageHours <= 72 ? 15 : 8 },
      { label: 'Property type / facility signal', points: 10 },
      { label: 'Supporting sources', points: sources.length > 1 ? 10 : 0 }
    ].filter(x => x.points > 0)
  };
}


function buildSocialOpportunity(group) {
  const sorted = group.items.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const lead = sorted[0];
  const ageHours = hoursBetween(new Date(lead.publishedAt), new Date());
  const propertyName = lead.propertyName || 'Property Requires Verification';
  const sources = sorted.map(item => ({
    name: item.source || extractSourceFromTitle(item.title),
    title: cleanTitle(item.title),
    url: item.link,
    publishedAt: item.publishedAt,
    type: item.evidenceType || 'Supporting Social/Public Web Source'
  }));
  const temp = { propertyName, category: lead.category, sources };
  const scores = calculateScores(temp, ageHours, sources.length);
  scores.confidence = Math.min(96, scores.confidence + (String(lead.evidenceType || '').includes('Official') ? 10 : 2));
  scores.opportunity = Math.min(100, scores.opportunity + 6);
  scores.overall = Math.min(100, Math.round(scores.overall + (String(lead.evidenceType || '').includes('Official') ? 7 : 3)));
  return {
    id: `PI-${new Date().getUTCFullYear()}-${hash(`social|${propertyName}|${lead.category}|${lead.publishedAt}`).toUpperCase()}`,
    propertyId: `PIR-${hash(propertyName || lead.groupKey).toUpperCase()}`,
    propertyName,
    propertyStatus: propertyName === 'Property Requires Verification' ? 'Needs Verification' : 'Extracted - Needs Property Verification',
    county: 'Mecklenburg / Charlotte Metro',
    territory: settings.territoryName,
    category: lead.category,
    opportunityClass: 'Public Agency / Social',
    eventDate: lead.publishedAt,
    publishedDate: lead.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings: scores,
    whatChanged: cleanTitle(lead.title),
    whyNow: 'This is a recent public-agency or social-web indexed signal inside the Charlotte metro monitoring window. It may surface emergency or building-condition activity before permits, formal news articles, or ownership records appear.',
    whyThisMatters: 'Official agency and public social signals can identify active fires, evacuations, sprinkler events, water damage, mold closures, or building disruptions early. These are supporting intelligence signals and should be reviewed with the linked evidence before outreach.',
    recommendedServices: incidentServices(lead.category),
    evidenceCount: sources.length,
    sources,
    signalBreakdown: [
      { label: lead.category, points: 30 },
      { label: String(lead.evidenceType || '').includes('Official') ? 'Official public agency source' : 'Supporting social/public web source', points: String(lead.evidenceType || '').includes('Official') ? 25 : 12 },
      { label: 'Recent indexed public signal', points: ageHours <= 72 ? 15 : 8 },
      { label: 'Property/facility signal', points: 10 },
      { label: 'Supporting sources', points: sources.length > 1 ? 10 : 0 }
    ].filter(x => x.points > 0)
  };
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


function isExcludedPermitScope(attrs) {
  const text = normalizeText(permitText(attrs));
  return (settings.permitExcludedScopeTerms || []).some(term => text.includes(normalizeText(term)));
}

function classifyPermit(attrs) {
  const rawText = permitText(attrs);
  const text = normalizeText(rawText);
  if (isExcludedPermitScope(attrs)) return { keep:false, category:'Temporary/Event Permit', reason:'Festival, temporary event, staging, sign, or non-building scope' };
  const hasTarget = (settings.permitTargetTerms || []).some(t => text.includes(normalizeText(t)));
  const commercialHints = [
    ...(settings.permitCommercialTerms || []),
    'bldg commercial','building commercial','commercial building','non residential','nonresidential','mercantile','business','assembly','institutional','educational','hotel','apartment','multi family','multifamily','office','retail','industrial','warehouse','restaurant','medical'
  ];
  const residentialOnly = ['single family','sfd','duplex','townhome','townhouse','deck','pool','shed','detached garage'];
  if (residentialOnly.some(t => text.includes(normalizeText(t)))) return { keep:false, category:'Residential/Unknown Permit', reason:'Residential-only permit signal' };
  const hasCommercial = commercialHints.some(t => text.includes(normalizeText(t))) || /\b(com|bus|off|ret|ind|apt|hot|med|edu)\b/i.test(rawText);
  if (!hasTarget) return { keep:false, category:'Non-target Permit', reason:'No target service-related permit keyword' };
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


function normalizeAddressKey(address='') {
  return String(address)
    .toUpperCase()
    .replace(/\b(STREET)\b/g, 'ST')
    .replace(/\b(AVENUE)\b/g, 'AVE')
    .replace(/\b(BOULEVARD)\b/g, 'BLVD')
    .replace(/\b(DRIVE)\b/g, 'DR')
    .replace(/\b(ROAD)\b/g, 'RD')
    .replace(/\b(LANE)\b/g, 'LN')
    .replace(/\b(COURT)\b/g, 'CT')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function permitSourceConfig(record={}) {
  const sourceId = record.sourceId || record.sourceKey || 'meck-building-permits-arcgis';
  return (settings.permitSources || []).find(s => s.id === sourceId) || settings.permitSources?.[0] || {};
}

function permitSourceRecordUrl(record) {
  const cfg = permitSourceConfig(record);
  if (!record.caseNumber) return record.link || cfg.sourceUrl || cfg.url || '';
  const where = `permitnum='${String(record.caseNumber).replace(/'/g, "''")}'`;
  const params = new URLSearchParams({ where, outFields: '*', returnGeometry: 'false', f: 'pjson' });
  return `${cfg.url || record.link}?${params.toString()}`;
}

function permitOfficialSearchUrl(record) {
  const cfg = permitSourceConfig(record);
  return cfg.officialSearchUrl || cfg.sourceUrl || cfg.url || record.link || '';
}

function permitSourceLabel(record) {
  const cfg = permitSourceConfig(record);
  return cfg.label || cfg.name || record.source || 'Permit Source';
}

function permitOfficialSearchLabel(record) {
  const cfg = permitSourceConfig(record);
  return cfg.officialSearchLabel || `Open ${permitSourceLabel(record)} Search`;
}

function contractorSearchUrl(record) {
  const name = record.contractor || record.applicant || record.owner || '';
  if (!name) return '';
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} Charlotte NC contractor`)}`;
}

function clusterPermitRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = record.parcelId ? `parcel:${record.parcelId}` : `addr:${normalizeAddressKey(record.address || record.propertyName || record.caseNumber)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items: items.sort((a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)) }));
}

function dominantPermitCategory(items) {
  const priority = ['Fire Restoration','Water Damage','Structural Repair','Building Envelope','Waterproofing','Roofing','Exterior Renovation','Commercial Alteration','Capital Improvement'];
  for (const p of priority) if (items.some(x => x.category === p)) return p;
  return items[0]?.category || 'Capital Improvement';
}

function compactDollars(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'no listed value';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function cleanPermitDescription(text='') {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw
    .replace(/\bundefined\b/ig, '')
    .replace(/\bnull\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260);
}

function primaryPermitDescription(items=[]) {
  const candidates = [];
  for (const item of items) {
    candidates.push(item.description, item.workDescription, item.projectName, item.existingUse, item.proposedUse);
  }
  const best = candidates.map(cleanPermitDescription).find(x => x && normalizeText(x) !== 'commercial alteration');
  return best || cleanPermitDescription(items[0]?.description || items[0]?.category || 'Permit record');
}

function permitKeywordFlags(items=[]) {
  const text = normalizeText(items.map(x => [x.category, x.description, x.workDescription, x.projectName, x.existingUse, x.proposedUse, x.address].filter(Boolean).join(' ')).join(' '));
  return {
    roofing: /\broof\b|reroof|re roof|tpo|epdm|membrane|shingle|flashing|gutter/.test(text),
    exterior: /exterior|facade|fa ade|siding|stucco|eifs|window|windows|door|doors|paint|painting|carpentry|masonry|brick/.test(text),
    waterproofing: /waterproof|waterproofing|sealant|caulk|joint|leak|water intrusion/.test(text),
    fire: /fire damage|smoke|burn|sprinkler/.test(text),
    water: /water damage|mold|pipe|plumbing|flood|water mitigation|water intrusion|leak/.test(text),
    structural: /structural|foundation|beam|joist|collapse|shoring|framing/.test(text),
    interior: /alteration|renovation|upfit|tenant improvement|buildout|build out|build back|interior|drywall|flooring|paint|ceiling|office|suite/.test(text),
    amenity: /clubhouse|pool|fitness|leasing office|amenity|lobby|corridor|common area|community room/.test(text),
    multifamily: /apartment|apartments|multifamily|multi family|multi-family|units|dwelling/.test(text),
    hotel: /hotel|motel|inn|suite|extended stay/.test(text),
    healthcare: /hospital|medical|clinic|nursing|assisted living|rehab/.test(text),
    government: /city of charlotte|mecklenburg county|fire station|police|library|government|municipal/.test(text),
    education: /school|college|university|education|classroom|campus/.test(text)
  };
}

function projectSpecificServices(items=[], category='Capital Improvement') {
  const f = permitKeywordFlags(items);
  const services = [];
  const add = (...x) => x.forEach(s => { if (s && !services.includes(s)) services.push(s); });
  if (f.fire || category === 'Fire Restoration') add('Fire restoration','Smoke cleaning','Water mitigation','Commercial reconstruction','Interior build back');
  if (f.water || category === 'Water Damage') add('Water mitigation','Mold remediation','Leak investigation','Water intrusion investigation','Interior build back');
  if (f.roofing || category === 'Roofing') add('Roofing','Leak investigation','Water intrusion investigation','Building envelope assessment','Exterior repairs');
  if (f.waterproofing || category === 'Waterproofing') add('Waterproofing','Leak investigation','Water intrusion investigation','Building envelope assessment');
  if (f.exterior || category === 'Exterior Renovation' || category === 'Building Envelope') add('Building envelope','Exterior repairs','Windows','Doors','Siding','Exterior painting');
  if (f.structural || category === 'Structural Repair') add('Structural repairs','Commercial reconstruction','Exterior repairs','Building condition assessment');
  if (f.interior || category === 'Commercial Alteration') add('Commercial reconstruction','Interior build back','Drywall','Flooring','Interior painting');
  if (f.amenity) add('Amenity renovations','Interior painting','Flooring','Commercial reconstruction');
  add('Annual property documentation','Building condition assessment');
  return services.slice(0, 12);
}

function buildProjectDescription(items=[], category='Capital Improvement', totalCost=0) {
  const count = items.length;
  const desc = primaryPermitDescription(items);
  const cost = compactDollars(totalCost);
  const permitNumbers = items.map(x => x.caseNumber).filter(Boolean).slice(0, 3).join(', ');
  const pieces = [];
  pieces.push(`${count} ${category.toLowerCase()} permit${count === 1 ? '' : 's'}`);
  if (cost !== 'no listed value') pieces.push(`totaling ${cost}`);
  if (desc) pieces.push(`Scope signal: ${desc}`);
  if (permitNumbers) pieces.push(`Permit${items.length === 1 ? '' : 's'}: ${permitNumbers}${items.length > 3 ? ' +' + (items.length - 3) + ' more' : ''}`);
  return pieces.join('. ') + '.';
}

function buildProjectSpecificWhy(items=[], category='Capital Improvement', address='the property', totalCost=0) {
  const f = permitKeywordFlags(items);
  const desc = primaryPermitDescription(items);
  const cost = compactDollars(totalCost);
  const count = items.length;
  const scope = desc ? ` The public permit description references: "${desc}".` : '';
  const valueSentence = cost !== 'no listed value' ? ` The listed permit value is ${cost}, which makes this more than a routine maintenance signal.` : '';
  const clusterSentence = count > 1 ? ` Because ${count} permits are grouped at the same property, this may indicate a coordinated work program rather than a one-off repair.` : '';

  if (f.fire || category === 'Fire Restoration') {
    return `This record points to fire or smoke-related repair activity at ${address}.${scope} Relevant service lines may include fire restoration, smoke cleaning, water mitigation from suppression efforts, demolition, reconstruction, and commercial build-back.${valueSentence}${clusterSentence}`;
  }
  if (f.water || category === 'Water Damage') {
    return `This record points to water, mold, leak, or plumbing-related building work at ${address}.${scope} That creates a direct reason to discuss water mitigation, mold remediation, leak investigation, water intrusion investigation, drying, and interior build-back.${valueSentence}${clusterSentence}`;
  }
  if (f.roofing || category === 'Roofing') {
    return `This permit appears tied to roofing or roof-related repair activity at ${address}.${scope} That creates a direct opening to discuss roofing, leak investigation, water intrusion prevention, flashing details, building envelope repairs, and annual roof condition documentation.${valueSentence}${clusterSentence}`;
  }
  if (f.waterproofing || category === 'Waterproofing') {
    return `This permit indicates waterproofing or leak-prevention work at ${address}.${scope} Relevant service lines may include water intrusion investigation, sealant/joint work, envelope repairs, and preventative documentation before the next rain event exposes additional failures.${valueSentence}${clusterSentence}`;
  }
  if (f.exterior || category === 'Building Envelope' || category === 'Exterior Renovation') {
    return `This permit points to exterior or building-envelope work at ${address}.${scope} Exterior scopes often uncover related needs around siding, windows, doors, paint, sealants, water intrusion, and hidden substrate damage, making this a strong reason to evaluate envelope assessment and exterior repair support.${valueSentence}${clusterSentence}`;
  }
  if (f.structural || category === 'Structural Repair') {
    return `This record indicates structural repair activity at ${address}.${scope} Structural work can expose adjacent reconstruction, envelope, framing, drywall, flooring, and safety-related repair needs that may require support during or after the permitted scope.${valueSentence}${clusterSentence}`;
  }
  if (f.amenity) {
    return `This permit appears connected to amenity or common-area improvements at ${address}.${scope} Amenity work can create opportunities for interior build-back, flooring, painting, drywall, exterior repairs, and future capital-improvement support across the property.${valueSentence}${clusterSentence}`;
  }
  if (f.interior || category === 'Commercial Alteration') {
    return `This commercial alteration permit indicates active interior or tenant-improvement work at ${address}.${scope} Relevant service lines may include drywall, flooring, painting, interior build-back, reconstruction support, and related capital improvement work.${valueSentence}${clusterSentence}`;
  }
  if (f.multifamily) {
    return `This multifamily permit activity at ${address} may point to unit, common-area, or building-system improvements.${scope} Multifamily properties often expand from one permitted scope into related interior repairs, envelope reviews, leak investigations, and annual documentation needs.${valueSentence}${clusterSentence}`;
  }
  if (f.government) {
    return `This permit activity appears tied to a public building at ${address}.${scope} Public building work can create continuity, remediation, reconstruction, and documentation needs where continuity, remediation, reconstruction, and documentation needs may exist.${valueSentence}${clusterSentence}`;
  }
  return `This official permit activity at ${address} indicates current capital work or repair planning.${scope} Relevant service lines may include building envelope repairs, leak investigation, water intrusion prevention, commercial reconstruction, interior build-back, and annual property documentation.${valueSentence}${clusterSentence}`;
}

function clusterScores(cluster) {
  const items = cluster.items;
  const category = dominantPermitCategory(items);
  const newest = items[0];
  const ageDays = newest?.publishedAt ? hoursBetween(new Date(newest.publishedAt), new Date()) / 24 : 999;
  const base = permitScores({ ...newest, category, cost: items.reduce((sum, x) => sum + (x.cost || 0), 0) }, ageDays);
  const uniqueCats = new Set(items.map(x => x.category)).size;
  const totalCost = items.reduce((sum, x) => sum + (x.cost || 0), 0);
  const opportunity = Math.min(100, base.opportunity + Math.min(15, (items.length - 1) * 4) + Math.min(10, (uniqueCats - 1) * 3));
  const confidence = Math.min(99, base.confidence + (items.length > 1 ? 5 : 0));
  const impact = Math.min(100, base.impact + Math.min(20, (items.length - 1) * 5) + (totalCost > 250000 ? 6 : 0));
  const signalStrength = Math.min(100, 60 + Math.min(35, items.length * 7));
  const overall = Math.round((opportunity * 0.4) + (confidence * 0.22) + (base.freshness * 0.13) + (impact * 0.18) + (base.coverage * 0.07));
  return { ...base, overall, opportunity, confidence, impact, signalStrength };
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
    sourceId: source.id || 'meck-building-permits-arcgis',
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
    owner: firstValue(attrs, ['ownname','owner','ownername','owner_name']),
    applicant: firstValue(attrs, ['applicant','applicantname','applname','appl_name','contactname','contact_name']),
    contractor: firstValue(attrs, ['contractor','contractorname','contractor_name','contrname','licensedprofessional','license_professional','profname']),
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
  return buildPermitClusterOpportunity({ key: record.address || record.caseNumber, items: [record] });
}


function normalizeOrgName(name='') {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/\b(L\.L\.C\.|LLC|L\.P\.|LP|INC\.|INC|CORP\.|CORPORATION|COMPANY|CO\.|LIMITED|LTD\.)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  const low = normalizeText(cleaned);
  for (const entry of settings.organizationWatchlist || []) {
    if ((entry.aliases || []).some(alias => low === normalizeText(alias) || low.includes(normalizeText(alias)))) return entry.canonical;
  }
  return cleaned;
}

function organizationId(name='', type='Organization') {
  const normalized = normalizeOrgName(name);
  if (!normalized) return '';
  return `ORG-${hash(`${type}|${normalized}`).toUpperCase()}`;
}

function detectWatchlistOrganizations(text='') {
  const low = normalizeText(text);
  const found = [];
  for (const entry of settings.organizationWatchlist || []) {
    if ((entry.aliases || []).some(alias => low.includes(normalizeText(alias)))) found.push(entry.canonical);
  }
  return [...new Set(found)];
}

function addOrgToMap(map, name, type, propertyId='', evidenceCount=1) {
  const normalized = normalizeOrgName(name);
  if (!normalized) return;
  const id = organizationId(normalized, type);
  const existing = map.get(id) || { organizationId: id, name: normalized, type, roles: new Set(), propertyIds: new Set(), evidenceCount: 0, watchList: false };
  existing.roles.add(type);
  if (propertyId) existing.propertyIds.add(propertyId);
  existing.evidenceCount += evidenceCount;
  existing.watchList = existing.watchList || (settings.organizationWatchlist || []).some(x => x.canonical === normalized);
  map.set(id, existing);
}

function parcelPropertyId(parcel='', address='') {
  const cleanParcel = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanParcel) return `PARCEL-${cleanParcel}`;
  return `PIR-${hash(normalizeAddressKey(address || 'unknown-property')).toUpperCase()}`;
}

function inferPropertyTypeFromPermit(record) {
  const text = normalizeText(`${record.existingUse || ''} ${record.proposedUse || ''} ${record.description || ''} ${record.propertyName || ''}`);
  const checks = [
    ['Multifamily', ['apartment','apartments','multifamily','multi family','multi-family']],
    ['Hospitality', ['hotel','motel','inn','suite','extended stay']],
    ['Healthcare', ['hospital','medical','clinic','nursing','assisted living','rehab']],
    ['Industrial', ['warehouse','industrial','distribution','manufacturing']],
    ['Office', ['office','business']],
    ['Retail', ['retail','restaurant','shopping','store','mall','plaza']],
    ['Education', ['school','college','university','education']],
    ['Government', ['city of charlotte','mecklenburg county','government']]
  ];
  for (const [type, terms] of checks) if (terms.some(t => text.includes(normalizeText(t)))) return type;
  return 'Commercial / Needs Classification';
}

function buildSignal({ propertyId, type, category, source, date, confidence, impact, evidenceIds = [], metadata = {} }) {
  return {
    signalId: `SIG-${hash(`${propertyId}|${type}|${category}|${date}|${JSON.stringify(metadata).slice(0,80)}`).toUpperCase()}`,
    propertyId,
    type,
    category,
    source,
    date,
    confidence,
    impact,
    evidenceIds,
    metadata
  };
}

function buildEvidence({ source, url, title, publishedAt, type='Public Source', confidence=0.9 }) {
  return {
    evidenceId: `EVD-${hash(`${source}|${url}|${title}|${publishedAt}`).toUpperCase()}`,
    source,
    type,
    url,
    title,
    publishedAt,
    detectedAt: nowIso(),
    confidence
  };
}

function buildPermitPropertyRecord(opportunity) {
  const c = opportunity.permitCluster || {};
  const address = c.address || opportunity.propertyName || '';
  const ownerName = c.owner || '';
  const propertyId = parcelPropertyId(c.parcelId, address);
  const samplePermit = (c.permits || [])[0] || opportunity.permit || {};
  const propertyType = inferPropertyTypeFromPermit(samplePermit);
  const managers = detectWatchlistOrganizations([address, opportunity.propertyName, opportunity.whatChanged, opportunity.whyThisMatters, JSON.stringify(c)].join(' '));
  const timeline = (c.permits || []).map(p => ({
    date: p.issuedDate,
    type: 'Permit',
    label: p.category || 'Permit',
    description: p.description || p.caseNumber || '',
    source: 'Mecklenburg Building Permits',
    url: p.sourceRecordUrl || ''
  }));
  return {
    propertyId,
    parcelId: c.parcelId || '',
    propertyName: address,
    address,
    county: opportunity.county || 'Mecklenburg',
    territory: opportunity.territory || settings.territoryName,
    propertyType,
    owner: ownerName ? { organizationId: organizationId(ownerName, 'Owner'), name: normalizeOrgName(ownerName), confidence: 0.88, source: 'Permit record' } : null,
    management: managers.length ? { organizationId: organizationId(managers[0], 'Management Company'), name: managers[0], confidence: 0.7, source: 'Text match' } : null,
    gis: opportunity.propertyResolution || null,
    currentHeatScore: opportunity.ratings?.overall || 0,
    latestSignal: opportunity.category,
    latestSignalDate: opportunity.eventDate,
    evidenceCount: opportunity.evidenceCount || 0,
    signals: ['PERMIT'],
    timelines: timeline,
    permitSummary: {
      permitCount: c.permitCount || 0,
      totalCost: c.totalCost || 0,
      categories: c.categories || []
    },
    dataQuality: {
      identity: c.parcelId ? 92 : 72,
      ownership: ownerName ? 80 : 25,
      management: managers.length ? 70 : 10,
      evidence: Math.min(100, (opportunity.evidenceCount || 0) * 25),
      overall: Math.round(((c.parcelId ? 92 : 72) + (ownerName ? 80 : 25) + (managers.length ? 70 : 10) + Math.min(100, (opportunity.evidenceCount || 0) * 25)) / 4)
    },
    updatedAt: nowIso()
  };
}

function buildFirePropertyRecord(opportunity) {
  const propertyId = opportunity.propertyId || `PIR-${hash(opportunity.propertyName || opportunity.id).toUpperCase()}`;
  const managers = detectWatchlistOrganizations([opportunity.propertyName, opportunity.whatChanged, opportunity.whyThisMatters].join(' '));
  return {
    propertyId,
    parcelId: '',
    propertyName: opportunity.propertyName,
    address: '',
    county: opportunity.county || 'Mecklenburg / Charlotte Metro',
    territory: opportunity.territory || settings.territoryName,
    propertyType: opportunity.category === 'Multifamily Fire' ? 'Multifamily' : 'Commercial / Needs Classification',
    owner: null,
    management: managers.length ? { organizationId: organizationId(managers[0], 'Management Company'), name: managers[0], confidence: 0.7, source: 'Text match' } : null,
    currentHeatScore: opportunity.ratings?.overall || 0,
    latestSignal: opportunity.category,
    latestSignalDate: opportunity.eventDate,
    evidenceCount: opportunity.evidenceCount || 0,
    signals: ['FIRE'],
    timelines: [{ date: opportunity.eventDate, type: 'Fire', label: opportunity.category, description: opportunity.whatChanged, source: opportunity.sources?.[0]?.name || 'Public Source', url: opportunity.sources?.[0]?.url || '' }],
    dataQuality: { identity: opportunity.propertyName === 'Property Requires Verification' ? 30 : 60, ownership: 0, management: managers.length ? 70 : 0, evidence: Math.min(100, (opportunity.evidenceCount || 0) * 25), overall: opportunity.propertyName === 'Property Requires Verification' ? 25 : 45 },
    updatedAt: nowIso()
  };
}


function buildIncidentPropertyRecord(opportunity) {
  const propertyId = opportunity.propertyId || `PIR-${hash(opportunity.propertyName || opportunity.id).toUpperCase()}`;
  const managers = detectWatchlistOrganizations([opportunity.propertyName, opportunity.whatChanged, opportunity.whyThisMatters].join(' '));
  const text = normalizeText(`${opportunity.propertyName || ''} ${opportunity.whatChanged || ''} ${opportunity.whyThisMatters || ''}`);
  let propertyType = 'Commercial / Needs Classification';
  if (text.includes('fire station') || text.includes('city ') || text.includes('county ') || text.includes('government')) propertyType = 'Government / Public Facility';
  else if (text.includes('school') || text.includes('college') || text.includes('university')) propertyType = 'Education';
  else if (text.includes('apartment') || text.includes('multifamily')) propertyType = 'Multifamily';
  else if (text.includes('hotel') || text.includes('inn') || text.includes('suites')) propertyType = 'Hospitality';
  else if (text.includes('hospital') || text.includes('medical')) propertyType = 'Healthcare';
  return {
    propertyId,
    parcelId: '',
    propertyName: opportunity.propertyName,
    address: '',
    county: opportunity.county || 'Mecklenburg / Charlotte Metro',
    territory: opportunity.territory || settings.territoryName,
    propertyType,
    owner: null,
    management: managers.length ? { organizationId: organizationId(managers[0], 'Management Company'), name: managers[0], confidence: 0.7, source: 'Text match' } : null,
    currentHeatScore: opportunity.ratings?.overall || 0,
    latestSignal: opportunity.category,
    latestSignalDate: opportunity.eventDate,
    evidenceCount: opportunity.evidenceCount || 0,
    signals: ['INCIDENT'],
    timelines: [{ date: opportunity.eventDate, type: 'Incident', label: opportunity.category, description: opportunity.whatChanged, source: opportunity.sources?.[0]?.name || 'Public Source', url: opportunity.sources?.[0]?.url || '' }],
    dataQuality: { identity: opportunity.propertyName === 'Property Requires Verification' ? 35 : 62, ownership: 0, management: managers.length ? 70 : 0, evidence: Math.min(100, (opportunity.evidenceCount || 0) * 25), overall: opportunity.propertyName === 'Property Requires Verification' ? 28 : 48 },
    updatedAt: nowIso()
  };
}


function buildSocialPropertyRecord(opportunity) {
  const base = buildIncidentPropertyRecord({ ...opportunity, opportunityClass: 'Emergency / Incident' });
  return {
    ...base,
    latestSignal: opportunity.category,
    signals: ['SOCIAL_PUBLIC_AGENCY'],
    timelines: [{ date: opportunity.eventDate, type: 'Public Agency / Social', label: opportunity.category, description: opportunity.whatChanged, source: opportunity.sources?.[0]?.name || 'Public Agency / Social Web', url: opportunity.sources?.[0]?.url || '' }],
    dataQuality: { ...base.dataQuality, evidence: Math.min(100, (opportunity.evidenceCount || 0) * 25), overall: Math.max(base.dataQuality?.overall || 0, 42) }
  };
}

function mergeTimeline(a = [], b = []) {
  const map = new Map();
  for (const item of [...a, ...b]) {
    const key = `${item.date || ''}|${item.type || ''}|${item.label || ''}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((x,y) => new Date(y.date || 0) - new Date(x.date || 0));
}

function mergePropertyRecords(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([_,v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))),
    propertyId: existing.propertyId,
    parcelId: existing.parcelId || incoming.parcelId || '',
    propertyName: existing.propertyName && existing.propertyName !== existing.address ? existing.propertyName : (incoming.propertyName || existing.propertyName),
    owner: existing.owner || incoming.owner || null,
    management: existing.management || incoming.management || null,
    currentHeatScore: Math.max(existing.currentHeatScore || 0, incoming.currentHeatScore || 0),
    evidenceCount: (existing.evidenceCount || 0) + (incoming.evidenceCount || 0),
    timelines: mergeTimeline(existing.timelines || [], incoming.timelines || []),
    signals: [...new Set([...(existing.signals || []), ...(incoming.signals || [])])],
    updatedAt: nowIso()
  };
}

function dedupeProperties(records) {
  const map = new Map();
  for (const rec of records) map.set(rec.propertyId, mergePropertyRecords(map.get(rec.propertyId), rec));
  return [...map.values()].sort((a,b) => (b.currentHeatScore || 0) - (a.currentHeatScore || 0));
}

function collectOrganizationsFromOpportunities(opportunities) {
  const map = new Map();
  for (const o of opportunities) {
    const propertyId = o.propertyId || '';
    const text = [o.propertyName, o.whatChanged, o.whyThisMatters, JSON.stringify(o.permitCluster || {})].join(' ');
    for (const manager of detectWatchlistOrganizations(text)) addOrgToMap(map, manager, 'Management Company', propertyId, 1);
    const c = o.permitCluster;
    if (c) {
      addOrgToMap(map, c.owner, 'Owner', propertyId, 1);
      for (const p of c.permits || []) {
        addOrgToMap(map, p.contractor, 'Contractor', propertyId, 1);
        addOrgToMap(map, p.applicant, 'Applicant', propertyId, 1);
        addOrgToMap(map, p.owner, 'Owner', propertyId, 1);
      }
    }
  }
  return [...map.values()]
    .map(x => ({ ...x, roles: [...x.roles], propertyIds: [...x.propertyIds] }))
    .sort((a,b) => (b.watchList - a.watchList) || b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name));
}

function buildPermitClusterOpportunity(cluster) {
  const items = cluster.items;
  const newest = items[0];
  const oldest = items[items.length - 1];
  const category = dominantPermitCategory(items);
  const ratings = clusterScores(cluster);
  const address = newest.address || newest.propertyName || 'Property Requires Verification';
  const totalCost = items.reduce((sum, x) => sum + (x.cost || 0), 0);
  const categories = [...new Set(items.map(x => x.category))];
  const permitList = items.map(x => ({
    caseNumber: x.caseNumber,
    category: x.category,
    issuedDate: x.publishedAt,
    description: x.description,
    cost: x.cost,
    owner: x.owner || '',
    applicant: x.applicant || '',
    contractor: x.contractor || '',
    sourceId: x.sourceId || 'meck-building-permits-arcgis',
    sourceLabel: permitSourceLabel(x),
    officialSearchUrl: permitOfficialSearchUrl(x),
    officialSearchLabel: permitOfficialSearchLabel(x),
    sourceRecordUrl: permitSourceRecordUrl(x),
    contractorSearchUrl: contractorSearchUrl(x)
  }));
  const detailLinks = items.map(x => ({
    name: x.source,
    title: `${x.caseNumber || 'Permit'} - ${x.category}${x.contractor ? ` - ${x.contractor}` : ''}`,
    url: permitSourceRecordUrl(x),
    publishedAt: x.publishedAt
  }));
  return {
    id: `PI-${new Date().getUTCFullYear()}-${hash(`permitcluster|${cluster.key}|${category}`).toUpperCase()}`,
    propertyId: parcelPropertyId(newest.parcelId, address),
    propertyName: address,
    propertyStatus: newest.address ? 'Permit Address Cluster - Needs Property Verification' : 'Needs Verification',
    county: 'Mecklenburg',
    territory: settings.territoryName,
    category: items.length > 1 ? `${category} Cluster` : category,
    opportunityClass: 'Capital Improvement',
    eventDate: newest.eventDate,
    publishedDate: newest.publishedAt,
    piDetectedDate: nowIso(),
    lastVerifiedDate: nowIso(),
    ratings,
    projectDescription: buildProjectDescription(items, category, totalCost),
    whatChanged: buildProjectDescription(items, category, totalCost),
    whyNow: items.length > 1 ? `${items.length} official permit records at the same address indicate active work that may be part of a coordinated repair, renovation, or capital-improvement program.` : `A recent official permit record indicates active work at this property while planning, procurement, or construction may still be underway.`,
    whyThisMatters: buildProjectSpecificWhy(items, category, address, totalCost),
    recommendedServices: projectSpecificServices(items, category),
    evidenceCount: items.length,
    sources: detailLinks,
    signalBreakdown: [
      { label: category, points: Math.round((ratings.opportunity || 0) / 2) },
      { label: `${items.length} permit${items.length === 1 ? '' : 's'} at same address`, points: Math.min(20, items.length * 5) },
      { label: 'Official Mecklenburg permit source', points: 20 },
      { label: 'Permit value signal', points: totalCost > 100000 ? 8 : 0 },
      { label: 'Multiple permit categories', points: categories.length > 1 ? 8 : 0 }
    ].filter(x => x.points > 0),
    permitCluster: {
      address,
      parcelId: newest.parcelId || '',
      permitCount: items.length,
      categories,
      firstIssuedDate: oldest.publishedAt,
      latestIssuedDate: newest.publishedAt,
      totalCost,
      owner: newest.owner || '',
      permits: permitList
    },
    permit: { caseNumber: newest.caseNumber, address: newest.address, parcelId: newest.parcelId, cost: newest.cost, description: newest.description, existingUse: newest.existingUse, proposedUse: newest.proposedUse },
    intelligenceObject: 'Property Intelligence Record'
  };
}



function buildGisParcelQueryUrl(source, parcelId) {
  const clean = String(parcelId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const where = clean
    ? `(PID='${clean.replace(/'/g, "''")}' OR NC_PIN='${clean.replace(/'/g, "''")}')`
    : '1=0';
  const params = new URLSearchParams({
    where,
    outFields: 'OBJECTID,NC_PIN,PID,MAP_BOOK,MAP_PAGE,MAP_BLOCK,LOT_NUM,PARCEL_TYPE,CONDO_TOWN_FLAG,Legal_From',
    returnGeometry: 'false',
    resultRecordCount: '1',
    f: 'json'
  });
  return `${source.url}?${params.toString()}`;
}

async function fetchGisParcel(source, parcelId) {
  const url = buildGisParcelQueryUrl(source, parcelId);
  const started = Date.now();
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 CommercialPropertyIntelligence/0.9.14' } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  const feature = json && Array.isArray(json.features) && json.features.length ? json.features[0] : null;
  return { source, url, ok: res.ok, status: res.status, durationMs: Date.now() - started, feature, rawText: text.slice(0, 300) };
}

async function enrichPermitOpportunitiesWithGis(opportunities, health) {
  const source = (settings.gisSources || []).find(s => s.enabled);
  if (!source) return { opportunities, gisLookups: 0, gisMatches: 0 };
  const parcelIds = [...new Set(opportunities
    .filter(o => o.permitCluster && o.permitCluster.parcelId)
    .map(o => String(o.permitCluster.parcelId).replace(/[^A-Za-z0-9]/g, '').toUpperCase()))]
    .slice(0, 75);
  const cache = new Map();
  let gisLookups = 0, gisMatches = 0;
  const startedAll = Date.now();
  for (const parcel of parcelIds) {
    try {
      const result = await fetchGisParcel(source, parcel);
      gisLookups++;
      if (result.feature && result.feature.attributes) {
        gisMatches++;
        cache.set(parcel, { attributes: result.feature.attributes, sourceUrl: source.sourceUrl, queryUrl: result.url, matched: true });
      } else {
        cache.set(parcel, { attributes: {}, sourceUrl: source.sourceUrl, queryUrl: result.url, matched: false });
      }
    } catch (err) {
      cache.set(parcel, { attributes: {}, sourceUrl: source.sourceUrl, matched: false, error: err.message });
    }
  }
  health.push({ source: source.name, module: 'GIS / Property Resolution', query: 'Parcel lookup for permit clusters', status: 'pass', durationMs: Date.now() - startedAll, itemsRetrieved: gisLookups, opportunitiesCreated: gisMatches, url: source.sourceUrl });
  const enriched = opportunities.map(o => {
    if (!o.permitCluster || !o.permitCluster.parcelId) return o;
    const parcel = String(o.permitCluster.parcelId).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const gis = cache.get(parcel);
    if (!gis) return o;
    return {
      ...o,
      propertyResolution: {
        status: gis.matched ? 'GIS Parcel Matched' : 'Parcel ID Present - GIS Match Pending',
        method: 'parcel',
        parcelId: parcel,
        confidence: gis.matched ? 0.92 : 0.74,
        gisSource: source.name,
        gisSourceUrl: gis.sourceUrl,
        gisQueryUrl: gis.queryUrl,
        gisAttributes: gis.attributes || {}
      },
      propertyStatus: gis.matched ? 'Property Intelligence Record - GIS Parcel Matched' : o.propertyStatus
    };
  });
  return { opportunities: enriched, gisLookups, gisMatches };
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


  const incidentRaw = [];
  for (const query of (settings.incidentNewsQueries || [])) {
    try {
      const feed = await fetchFeed(query);
      const items = feed.ok ? parseRss(feed.text) : [];
      incidentRaw.push(...items.map(x => ({ ...x, query, module: 'Incident / Building Condition Intelligence' })));
      health.push({ source:'Google News RSS', module:'Incident / Building Condition Intelligence', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS', module:'Incident / Building Condition Intelligence', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }


  const socialRaw = [];
  for (const query of (settings.socialWebQueries || [])) {
    try {
      const feed = await fetchFeed(query);
      const items = feed.ok ? parseRss(feed.text) : [];
      socialRaw.push(...items.map(x => ({ ...x, query, module: 'Public Agency / Social Web Intelligence' })));
      health.push({ source:'Google News RSS / Public Web Index', module:'Public Agency / Social Web Intelligence', query, status: feed.ok ? 'pass' : 'fail', httpStatus: feed.status, durationMs: feed.durationMs, itemsRetrieved: items.length });
    } catch (err) {
      health.push({ source:'Google News RSS / Public Web Index', module:'Public Agency / Social Web Intelligence', query, status:'fail', error: err.message, itemsRetrieved:0 });
    }
  }

  const seenLinks = new Set();
  const candidates = [];
  const now = new Date();
  let oldExcluded = 0, nonCommercialExcluded = 0, duplicateRawExcluded = 0, outOfTerritoryExcluded = 0, fireFallbackUsed = false;
  const fireFallbackCandidates = [];
  for (const item of raw) {
    if (!item.link || seenLinks.has(item.link)) { duplicateRawExcluded++; continue; }
    seenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { oldExcluded++; continue; }
    const ageHours = hoursBetween(pub, now);
    if (ageHours > settings.emergencyMaxAgeHours) {
      const fallbackMaxHours = (settings.fireFallbackMaxAgeDays || 14) * 24;
      if (ageHours <= fallbackMaxHours && isInsideTargetTerritory(item)) {
        const fallbackCls = classifyFire(item.title, item.description);
        if (fallbackCls.keep) {
          const fallbackPropertyName = extractPropertyName(item.title, item.description);
          fireFallbackCandidates.push({
            title: item.title,
            description: item.description,
            link: item.link,
            source: item.source || extractSourceFromTitle(item.title),
            publishedAt: pub.toISOString(),
            category: fallbackCls.category,
            classificationReason: `${fallbackCls.reason}; included by 14-day fire safety-net because no current fire signals were available`,
            propertyName: fallbackPropertyName || '',
            opportunityClass: 'Emergency',
            groupKey: `${slug(fallbackPropertyName || cleanTitle(item.title).slice(0,80))}|${fallbackCls.category}|${pub.toISOString().slice(0,10)}`
          });
        }
      }
      oldExcluded++; continue;
    }
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

  if (!candidates.length && fireFallbackCandidates.length) {
    candidates.push(...fireFallbackCandidates);
    fireFallbackUsed = true;
  }


  const incidentSeenLinks = new Set(seenLinks);
  const incidentCandidates = [];
  let incidentOldExcluded = 0, incidentExcluded = 0, incidentOutOfTerritoryExcluded = 0, incidentDuplicateExcluded = 0;
  for (const item of incidentRaw) {
    if (!item.link || incidentSeenLinks.has(item.link)) { incidentDuplicateExcluded++; continue; }
    incidentSeenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { incidentOldExcluded++; continue; }
    const ageDays = hoursBetween(pub, now) / 24;
    if (ageDays > (settings.incidentMaxAgeDays || settings.standardMaxArticleAgeDays || 14)) { incidentOldExcluded++; continue; }
    if (!isInsideTargetTerritory(item)) { incidentOutOfTerritoryExcluded++; continue; }
    const cls = classifyIncident(item.title, item.description);
    if (!cls.keep) { incidentExcluded++; continue; }
    const propertyName = extractPropertyName(item.title, item.description) || cleanPropertyCandidate(removeEventPhrases(cleanTitle(item.title)));
    incidentCandidates.push({
      title: item.title,
      description: item.description,
      link: item.link,
      source: item.source || extractSourceFromTitle(item.title),
      publishedAt: pub.toISOString(),
      category: cls.category,
      classificationReason: cls.reason,
      propertyName: propertyName || '',
      opportunityClass: 'Emergency / Incident',
      groupKey: `${slug(propertyName || cleanTitle(item.title).slice(0,80))}|${cls.category}|${pub.toISOString().slice(0,10)}`
    });
  }


  const socialSeenLinks = new Set(incidentSeenLinks);
  const socialCandidates = [];
  let socialOldExcluded = 0, socialExcluded = 0, socialOutOfTerritoryExcluded = 0, socialDuplicateExcluded = 0;
  for (const item of socialRaw) {
    if (!item.link || socialSeenLinks.has(item.link)) { socialDuplicateExcluded++; continue; }
    socialSeenLinks.add(item.link);
    const pub = item.pubDate ? new Date(item.pubDate) : null;
    if (!pub || Number.isNaN(pub.getTime())) { socialOldExcluded++; continue; }
    const ageDays = hoursBetween(pub, now) / 24;
    if (ageDays > (settings.socialMaxAgeDays || 14)) { socialOldExcluded++; continue; }
    if (!isInsideTargetTerritory(item)) { socialOutOfTerritoryExcluded++; continue; }
    const cls = classifySocialAgency(item.title, item.description, item.source);
    if (!cls.keep) { socialExcluded++; continue; }
    const propertyName = extractPropertyName(item.title, item.description) || cleanPropertyCandidate(removeEventPhrases(cleanTitle(item.title)));
    socialCandidates.push({
      title: item.title,
      description: item.description,
      link: item.link,
      source: item.source || extractSourceFromTitle(item.title),
      publishedAt: pub.toISOString(),
      category: cls.category,
      classificationReason: cls.reason,
      evidenceType: cls.evidenceType || 'Supporting Social/Public Web Source',
      propertyName: propertyName || '',
      opportunityClass: 'Public Agency / Social',
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
  const incidentGroups = new Map();
  for (const item of incidentCandidates) {
    const key = item.groupKey;
    if (!incidentGroups.has(key)) incidentGroups.set(key, { key, items: [] });
    incidentGroups.get(key).items.push(item);
  }
  const incidentOpportunities = [...incidentGroups.values()].map(buildIncidentOpportunity);
  const socialGroups = new Map();
  for (const item of socialCandidates) {
    const key = item.groupKey;
    if (!socialGroups.has(key)) socialGroups.set(key, { key, items: [] });
    socialGroups.get(key).items.push(item);
  }
  const socialOpportunities = [...socialGroups.values()].map(buildSocialOpportunity);
  const permitClusters = clusterPermitRecords(permitCandidates);
  let permitOpportunities = permitClusters.map(buildPermitClusterOpportunity);
  const gisEnrichment = await enrichPermitOpportunitiesWithGis(permitOpportunities, health);
  permitOpportunities = gisEnrichment.opportunities;
  const opportunities = [...fireOpportunities, ...incidentOpportunities, ...socialOpportunities, ...permitOpportunities].sort((a,b) => b.ratings.overall - a.ratings.overall);
  const properties = dedupeProperties(opportunities.map(o => o.opportunityClass === 'Capital Improvement' ? buildPermitPropertyRecord(o) : (o.opportunityClass === 'Emergency / Incident' ? buildIncidentPropertyRecord(o) : (o.opportunityClass === 'Public Agency / Social' ? buildSocialPropertyRecord(o) : buildFirePropertyRecord(o)))));
  const organizations = collectOrganizationsFromOpportunities(opportunities);
  const signals = opportunities.flatMap(o => {
    const evidenceIds = (o.sources || []).map(s => buildEvidence({ source: s.name, url: s.url, title: s.title, publishedAt: s.publishedAt }).evidenceId);
    return [buildSignal({ propertyId: o.propertyId, type: o.opportunityClass === 'Capital Improvement' ? 'PERMIT' : (o.opportunityClass === 'Emergency / Incident' ? 'INCIDENT' : (o.opportunityClass === 'Public Agency / Social' ? 'SOCIAL_PUBLIC_AGENCY' : 'FIRE')), category: o.category, source: o.sources?.[0]?.name || 'Public Source', date: o.eventDate, confidence: (o.ratings?.confidence || 0) / 100, impact: (o.ratings?.impact || 0) / 100, evidenceIds, metadata: { opportunityId: o.id } })];
  });
  const evidence = opportunities.flatMap(o => (o.sources || []).map(s => buildEvidence({ source: s.name, url: s.url, title: s.title, publishedAt: s.publishedAt })));
  const byClass = opportunities.reduce((acc, o) => { acc[o.opportunityClass] = (acc[o.opportunityClass] || 0) + 1; return acc; }, {});
  const output = {
    generatedAt: nowIso(),
    version: settings.version,
    territory: settings.territoryName,
    summary: {
      rawItemsRetrieved: raw.length + incidentRaw.length + socialRaw.length + permitRaw,
      candidates: candidates.length + incidentCandidates.length + socialCandidates.length + permitCandidates.length,
      opportunities: opportunities.length,
      emergencyOpportunities: byClass.Emergency || 0,
      incidentOpportunities: byClass['Emergency / Incident'] || 0,
      socialAgencyOpportunities: byClass['Public Agency / Social'] || 0,
      capitalImprovementOpportunities: byClass['Capital Improvement'] || 0,
      properties: properties.length,
      gisLookups: typeof gisEnrichment !== 'undefined' ? gisEnrichment.gisLookups : 0,
      gisMatches: typeof gisEnrichment !== 'undefined' ? gisEnrichment.gisMatches : 0,
      organizations: organizations.length,
      signals: signals.length,
      evidence: evidence.length,
      oldItemsExcluded: oldExcluded + incidentOldExcluded,
      nonCommercialExcluded: nonCommercialExcluded + incidentExcluded,
      outOfTerritoryExcluded: outOfTerritoryExcluded + incidentOutOfTerritoryExcluded,
      socialRecordsRetrieved: socialRaw.length,
      socialCandidates: socialCandidates.length,
      socialExcluded,
      socialOldExcluded,
      socialOutOfTerritoryExcluded,
      duplicateRawExcluded: duplicateRawExcluded + incidentDuplicateExcluded + socialDuplicateExcluded,
      incidentRecordsRetrieved: incidentRaw.length,
      incidentCandidates: incidentCandidates.length,
      incidentExcluded,
      incidentOldExcluded,
      incidentOutOfTerritoryExcluded,
      socialRecordsRetrieved: socialRaw.length,
      socialCandidates: socialCandidates.length,
      socialExcluded,
      socialOldExcluded,
      socialOutOfTerritoryExcluded,
      fireFallbackUsed,
      fireFallbackCandidates: fireFallbackCandidates.length,
      duplicateGroupsMerged: candidates.length - fireOpportunities.length,
      permitRecordsRetrieved: permitRaw,
      permitCandidates: permitCandidates.length,
      permitClusters: typeof permitClusters !== 'undefined' ? permitClusters.length : 0,
      permitExcluded,
      permitOldExcluded
    },
    health,
    opportunities,
    properties,
    organizations,
    signals,
    evidence
  };
  const dataDir = path.join(root, 'dist', 'data');
  ensureDir(dataDir);
  fs.writeFileSync(path.join(dataDir, 'opportunities.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(dataDir, 'properties.json'), JSON.stringify({ generatedAt: output.generatedAt, properties }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'organizations.json'), JSON.stringify({ generatedAt: output.generatedAt, organizations }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'signals.json'), JSON.stringify({ generatedAt: output.generatedAt, signals }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'evidence.json'), JSON.stringify({ generatedAt: output.generatedAt, evidence }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'source-health.json'), JSON.stringify({ generatedAt: output.generatedAt, health, summary: output.summary }, null, 2));
  console.log(`PI update complete. Opportunities: ${opportunities.length}. Emergency: ${byClass.Emergency || 0}. Incidents: ${byClass['Emergency / Incident'] || 0}. Social/Public Agency: ${byClass['Public Agency / Social'] || 0}. Capital: ${byClass['Capital Improvement'] || 0}. Permit records: ${permitRaw}.`);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { parseRss, classifyFire, classifyIncident, classifySocialAgency, extractPropertyName, isInsideTargetTerritory, buildOpportunity, buildIncidentOpportunity, classifyPermit, normalizePermitFeature, buildPermitOpportunity, buildPermitClusterOpportunity, clusterPermitRecords, normalizeAddressKey, parcelPropertyId, normalizeOrgName, organizationId, buildPermitPropertyRecord, dedupeProperties, buildGisParcelQueryUrl, permitSourceRecordUrl };
