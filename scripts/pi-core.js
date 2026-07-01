import { territory } from '../config/territory.js';
import { qualificationConfig as qc } from '../config/qualification.js';

export function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

export function getHost(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'unknown'; }
}

export function hoursOld(dateValue, now = new Date()) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.max(0, (now - d) / 36e5);
}

export function includesAny(text, terms) {
  const lower = String(text || '').toLowerCase();
  return terms.some(t => lower.includes(String(t).toLowerCase()));
}

export function extractPropertyName(title = '') {
  let value = stripHtml(title);
  value = value.split(' - ')[0].trim();
  value = value.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  const lower = value.toLowerCase();
  for (const prefix of qc.eventPrefixes) {
    const p = prefix.toLowerCase();
    if (lower.startsWith(p + ' ')) return value.slice(prefix.length).trim().replace(/^at\s+/i, '');
  }
  value = value.replace(/^(fire|blaze|explosion)\s+(damages|destroys|reported at|at)\s+/i, '');
  value = value.replace(/^(crews|firefighters)\s+.*?\s+at\s+/i, '');
  return value.trim();
}

export function classifyPropertyType(text = '') {
  const t = text.toLowerCase();
  if (/apartment|apartments|multifamily|multi-family/.test(t)) return 'Multifamily';
  if (/hotel|motel|extended stay/.test(t)) return 'Hospitality';
  if (/warehouse|industrial|plant|distribution/.test(t)) return 'Industrial';
  if (/office/.test(t)) return 'Office';
  if (/retail|shopping center|mall|store|restaurant/.test(t)) return 'Retail';
  if (/hospital|medical|assisted living|skilled nursing|rehab/.test(t)) return 'Healthcare';
  if (/school|university|college/.test(t)) return 'Education';
  if (/commercial|business|facility|complex/.test(t)) return 'Commercial';
  return 'Needs Verification';
}

export function qualifyRecord(record, now = new Date()) {
  const haystack = [record.title, record.description, record.source, record.link].filter(Boolean).join(' ');
  const rejected = [];

  const urlLower = String(record.link || '').toLowerCase();
  if (territory.rejectUrlParts.some(part => urlLower.includes(part))) rejected.push('Syndicated/world-national URL section');
  if (includesAny(haystack, territory.rejectTerms)) rejected.push('Out-of-territory/global term');

  const hasGeo = includesAny(haystack, territory.geographyTerms) || includesAny(haystack, territory.cities) || includesAny(haystack, territory.counties);
  if (!hasGeo) rejected.push('No target territory signal');

  if (includesAny(haystack, qc.residentialRejectTerms)) rejected.push('Residential/non-target property term');
  if (includesAny(haystack, qc.nonTargetRejectTerms)) rejected.push('Excluded sector term');

  const hasCommercial = includesAny(haystack, qc.commercialTerms);
  const hasBusinessSignal = includesAny(haystack, qc.businessSignalTerms);
  if (!hasBusinessSignal) rejected.push('No business-relevant signal');

  const ageHours = hoursOld(record.publishedAt, now);
  const emergency = /fire|smoke|water damage|sprinkler|suppression/i.test(haystack);
  const maxAge = emergency ? qc.emergencyMaxAgeHours : qc.standardMaxAgeDays * 24;
  if (ageHours > maxAge) rejected.push(`Stale item (${Math.round(ageHours)} hours old)`);

  const propertyName = extractPropertyName(record.title);
  const propertyType = classifyPropertyType(haystack + ' ' + propertyName);
  const needsVerification = propertyType === 'Needs Verification' || !hasCommercial;

  return {
    qualified: rejected.length === 0 && hasGeo && hasBusinessSignal,
    rejected,
    whyQualified: [
      hasGeo ? 'Target territory match' : null,
      hasCommercial ? 'Commercial property indicator' : needsVerification ? 'Commercial status needs verification' : null,
      hasBusinessSignal ? 'Business-relevant signal' : null,
      ageHours <= maxAge ? 'Within recency window' : null,
      record.link ? 'Public source link available' : null
    ].filter(Boolean),
    propertyName,
    propertyType,
    needsVerification,
    ageHours,
    sourceHost: getHost(record.link)
  };
}

export function makePropertyId(name = '', source = '') {
  const seed = `${name}|${source}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `PIR-${String(hash).padStart(10, '0').slice(0, 10)}`;
}

export function scoreOpportunity(q, evidenceCount = 1) {
  const signal = 40;
  const territoryScore = q.whyQualified.includes('Target territory match') ? 15 : 0;
  const commercial = q.propertyType !== 'Needs Verification' ? 15 : 5;
  const freshness = q.ageHours <= 24 ? 15 : q.ageHours <= 72 ? 10 : 4;
  const evidence = Math.min(15, evidenceCount * 5);
  const confidence = Math.min(99, 60 + territoryScore + commercial + evidence + (q.needsVerification ? 0 : 10));
  const overall = Math.min(100, signal + territoryScore + commercial + freshness + evidence);
  return { overall, opportunity: overall, confidence, freshness: Math.min(100, freshness * 6), impact: signal + commercial, coverage: q.needsVerification ? 45 : 70 };
}

export function groupOpportunities(records, now = new Date()) {
  const groups = new Map();
  const rejected = [];
  for (const record of records) {
    const q = qualifyRecord(record, now);
    if (!q.qualified) {
      rejected.push({ title: record.title, source: record.source, reasons: q.rejected });
      continue;
    }
    const key = q.propertyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || record.title.toLowerCase();
    if (!groups.has(key)) groups.set(key, { qualification: q, records: [] });
    groups.get(key).records.push(record);
  }
  const opportunities = Array.from(groups.values()).map((group, index) => {
    const q = group.qualification;
    const evidenceCount = group.records.length;
    const rating = scoreOpportunity(q, evidenceCount);
    const first = group.records[0];
    const sources = group.records.map(r => ({
      title: r.source || getHost(r.link),
      url: r.link,
      publishedAt: r.publishedAt,
      sourceHost: getHost(r.link)
    }));
    return {
      id: `OPP-${new Date(now).toISOString().slice(0,10).replace(/-/g,'')}-${String(index + 1).padStart(3, '0')}`,
      propertyId: makePropertyId(q.propertyName, first.link),
      propertyName: q.propertyName || 'Property requires verification',
      propertyStatus: q.needsVerification ? 'Needs Verification' : 'Resolved Candidate',
      propertyType: q.propertyType,
      category: /fire/i.test([first.title, first.description].join(' ')) ? 'Emergency / Commercial Fire' : 'Commercial Intelligence',
      overallRating: rating.overall,
      rating,
      signalStrength: evidenceCount >= 3 ? 'Strong' : evidenceCount === 2 ? 'Moderate' : 'Single Source',
      whatChanged: stripHtml(first.title),
      whyNow: 'Recent public source activity passed PI qualification rules for territory, business relevance, freshness, and evidence.',
      whyThisMatters: 'A qualified commercial fire or damage signal may create opportunities for emergency response, mitigation, smoke remediation, water mitigation from suppression efforts, reconstruction, and follow-up property documentation.',
      recommendedServices: ['Emergency Response', 'Fire Restoration', 'Smoke Remediation', 'Water Mitigation', 'Reconstruction', 'Annual Property Documentation'],
      eventDate: first.publishedAt,
      publishedDate: first.publishedAt,
      detectedDate: new Date(now).toISOString(),
      evidenceCount,
      sources,
      whyQualified: q.whyQualified
    };
  }).sort((a,b) => b.overallRating - a.overallRating);
  return { opportunities, rejected };
}
