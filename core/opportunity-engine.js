import { classifyEvent } from './classifier.js';
import { scoreOpportunity } from './scoring.js';

function makeId(text) {
  return Buffer.from(text).toString('base64url').slice(0, 18);
}

export function buildOpportunities(events) {
  const opportunities = [];
  const rejected = [];
  for (const event of events) {
    const classification = classifyEvent(event);
    if (!classification.accepted || !classification.inTerritory) {
      rejected.push({ event, classification });
      continue;
    }
    const scored = scoreOpportunity(classification, event);
    const propertyName = event.propertyName || extractLikelyProperty(event.headline) || 'Property requires verification';
    const id = makeId(`${event.sourceUrl || event.headline}-${classification.category}`);
    opportunities.push({
      id,
      propertyName,
      address: event.address || 'Address requires verification',
      county: event.county || 'Charlotte Metro',
      propertyType: classification.propertyType,
      owner: 'Public source review required',
      managementCompany: classification.watchMatch || 'Public source review required',
      category: classification.category,
      priority: scored.priority,
      opportunityScore: scored.score,
      confidenceScore: scored.confidence,
      relationshipScore: classification.watchMatch ? 85 : 65,
      whatChanged: classification.whatChanged,
      whyNow: classification.whyNow,
      whyThisMatters: classification.whyThisMatters,
      recommendedServices: classification.recommendedServices,
      supportingSources: [{ name: event.sourceName || event.connector || 'Public source', url: event.sourceUrl || '' }],
      firstSeen: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      scoreBreakdown: scored.scoreBreakdown,
      rawHeadline: event.headline
    });
  }
  return { opportunities: dedupe(opportunities), rejected };
}

function extractLikelyProperty(headline = '') {
  const patterns = [/at ([A-Z][A-Za-z0-9 '&.-]+?)(?: in | after | following | -|$)/, /([A-Z][A-Za-z0-9 '&.-]+ Apartments)/, /([A-Z][A-Za-z0-9 '&.-]+ Hotel)/];
  for (const p of patterns) {
    const m = headline.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function dedupe(list) {
  const seen = new Map();
  for (const item of list) {
    const key = `${item.propertyName}-${item.category}`.toLowerCase();
    if (!seen.has(key) || seen.get(key).opportunityScore < item.opportunityScore) seen.set(key, item);
  }
  return [...seen.values()].sort((a,b) => b.opportunityScore - a.opportunityScore);
}
