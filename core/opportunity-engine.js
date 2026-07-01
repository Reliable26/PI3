import { slug, textIncludesAny, uniqueBy } from './utils.js';
import { scoreOpportunity, confidenceScore } from './scoring-engine.js';

export function buildOpportunities(events, rules, territory, watchlist) {
  const opportunities = [];
  let residentialFiltered = 0;

  for (const event of events) {
    const combined = `${event.headline || ''} ${event.description || ''} ${event.propertyName || ''} ${event.address || ''}`;
    const excluded = textIncludesAny(combined, rules.excludeTerms);
    const territoryMatch = textIncludesAny(combined, [...territory.counties, ...territory.cities, ...territory.states]);
    const commercialMatch = textIncludesAny(combined, [...rules.includePropertyTypes, ...rules.fireIncludeTerms]);
    const watchListMatch = textIncludesAny(combined, watchlist.companies);

    if (excluded) {
      residentialFiltered++;
      continue;
    }
    if (!territoryMatch && !commercialMatch) continue;

    const propertyName = event.propertyName || inferPropertyName(event);
    const category = event.category || 'market_signal';
    const context = { territoryMatch, commercialMatch, watchListMatch, excluded };
    const opportunityScore = scoreOpportunity(event, context);
    const confidence = confidenceScore(event, context);

    opportunities.push({
      opportunityId: `opp-${slug(event.connector)}-${slug(event.eventId || event.headline)}`,
      property: propertyName,
      address: event.address || 'Needs Verification',
      county: inferCounty(combined, territory),
      propertyType: inferPropertyType(combined),
      owner: 'Needs Verification',
      managementCompany: inferManagement(combined, watchlist),
      category,
      opportunityScore,
      confidenceScore: confidence,
      relationshipScore: relationshipScore(combined),
      whatChanged: event.headline || 'Public source signal detected',
      whyThisMatters: whyThisMatters(category, combined),
      recommendedServices: servicesFor(category, rules),
      supportingSources: [{ title: event.connector, url: event.sourceUrl || '' }],
      firstSeen: event.dateFound,
      lastVerified: event.dateFound,
      reasonMatrix: reasonMatrix(event, context, opportunityScore),
      rawHeadline: event.headline,
      sourceConnector: event.connector
    });
  }

  return {
    opportunities: uniqueBy(opportunities, o => `${slug(o.property)}-${slug(o.whatChanged)}`).sort((a, b) => b.opportunityScore - a.opportunityScore),
    residentialFiltered
  };
}

function inferPropertyName(event) {
  return event.address || 'Property Needs Verification';
}

function inferCounty(text, territory) {
  for (const county of territory.counties) {
    if (String(text).toLowerCase().includes(county.toLowerCase())) return county;
  }
  if (String(text).toLowerCase().includes('charlotte')) return 'Mecklenburg';
  return 'Needs Verification';
}

function inferPropertyType(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes('apartment') || lower.includes('multifamily')) return 'Multifamily';
  if (lower.includes('hotel')) return 'Hospitality';
  if (lower.includes('warehouse') || lower.includes('industrial')) return 'Industrial';
  if (lower.includes('office')) return 'Office';
  if (lower.includes('medical') || lower.includes('hospital') || lower.includes('assisted living')) return 'Healthcare';
  if (lower.includes('school') || lower.includes('university') || lower.includes('college')) return 'Education';
  return 'Commercial - Needs Verification';
}

function inferManagement(text, watchlist) {
  for (const company of watchlist.companies) {
    if (String(text).toLowerCase().includes(company.toLowerCase())) return company;
  }
  return 'Needs Verification';
}

function relationshipScore(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes('apartment') || lower.includes('multifamily') || lower.includes('hotel')) return 90;
  if (lower.includes('warehouse') || lower.includes('medical') || lower.includes('office')) return 80;
  return 65;
}

function servicesFor(category, rules) {
  if (category === 'fire') return rules.targetServices.fire;
  return rules.targetServices.default;
}

function whyThisMatters(category, text) {
  if (category === 'fire') {
    return 'A commercial or multifamily fire can create immediate restoration needs including smoke remediation, water mitigation from suppression, emergency stabilization, demolition, and reconstruction. This is a time-sensitive opportunity to discuss emergency response and restoration support.';
  }
  return 'This public signal may indicate a property event, ownership change, or capital need that creates a reason for commercial outreach. Verify the property details before adding to CRM.';
}

function reasonMatrix(event, context, finalScore) {
  return [
    { signal: event.category || 'public_signal', contribution: event.category === 'fire' ? 45 : 20 },
    { signal: 'territory_match', contribution: context.territoryMatch ? 8 : 0 },
    { signal: 'commercial_match', contribution: context.commercialMatch ? 12 : 0 },
    { signal: 'watchlist_match', contribution: context.watchListMatch ? 10 : 0 },
    { signal: 'final_score', contribution: finalScore }
  ];
}
