import { createOpportunity } from './models.js';
import { scoreEvent } from './scoring.js';

function inferCategory(event) {
  const text = `${event.headline || ''} ${event.description || ''}`.toLowerCase();
  if (text.includes('fire') || text.includes('smoke')) return 'Fire';
  if (text.includes('roof')) return 'Roofing';
  if (text.includes('water') || text.includes('leak')) return 'Water';
  if (text.includes('management')) return 'Management Change';
  return event.category || 'Market Intelligence';
}

function inferPropertyType(event) {
  const text = `${event.headline || ''} ${event.description || ''}`.toLowerCase();
  if (text.includes('apartment') || text.includes('multifamily')) return 'Multifamily';
  if (text.includes('hotel')) return 'Hotel';
  if (text.includes('warehouse') || text.includes('industrial')) return 'Industrial';
  if (text.includes('office')) return 'Office';
  if (text.includes('school')) return 'Education';
  return 'Needs review';
}

function countyFromText(event) {
  const text = `${event.headline || ''} ${event.description || ''} ${event.address || ''}`.toLowerCase();
  for (const county of ['Mecklenburg','Cabarrus','Gaston','Union','Iredell','York','Lancaster']) {
    if (text.includes(county.toLowerCase())) return county;
  }
  if (text.includes('charlotte')) return 'Mecklenburg';
  return 'Needs review';
}

function serviceList(category, rules) {
  return rules.serviceMap[category] || ['Building Condition Assessment', 'Commercial Reconstruction'];
}

export function buildOpportunities(events, rules) {
  const filtered = events.filter(e => {
    const text = `${e.headline || ''} ${e.description || ''}`.toLowerCase();
    return !rules.excludeTerms.some(term => text.includes(term));
  });

  const seen = new Set();
  const opportunities = [];
  for (const event of filtered) {
    const key = `${event.connector}|${event.headline}|${event.sourceUrl}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const category = inferCategory(event);
    const scores = scoreEvent(event, rules);
    const propertyType = inferPropertyType(event);
    const county = countyFromText(event);

    opportunities.push(createOpportunity({
      opportunityId: `opp-${Math.abs(hashCode(key))}`,
      propertyName: event.propertyName || extractPropertyName(event),
      address: event.address || 'Needs verification',
      county,
      propertyType,
      category,
      opportunityScore: scores.opportunityScore,
      confidenceScore: scores.confidenceScore,
      relationshipScore: scores.relationshipScore,
      whatChanged: event.headline,
      whyThisMatters: whyThisMatters(category, propertyType),
      recommendedServices: serviceList(category, rules),
      reasonMatrix: scores.reasonMatrix,
      sources: [{ name: event.connector, url: event.sourceUrl }],
      status: scores.confidenceScore >= 80 ? 'Active' : 'Needs Review'
    }));
  }
  return opportunities.sort((a,b) => b.opportunityScore - a.opportunityScore);
}

function extractPropertyName(event) {
  if (event.propertyName) return event.propertyName;
  const text = event.headline || '';
  const match = text.match(/(?:at|near)\s+([A-Z][A-Za-z0-9'&\-\s]+?)(?:\s+in|\s+on|$)/);
  return match ? match[1].trim() : 'Needs property match';
}

function whyThisMatters(category, propertyType) {
  if (category === 'Fire') return `${propertyType} fire activity can create immediate needs for emergency mitigation, smoke remediation, fire restoration, water mitigation from suppression efforts, and reconstruction.`;
  if (category === 'Roofing') return `Roofing activity often creates related opportunities for leak investigation, flashing repairs, building envelope review, and interior water intrusion remediation.`;
  if (category === 'Water') return `Water-related activity can indicate active intrusion, drying needs, mold risk, and reconstruction opportunities.`;
  if (category === 'Management Change') return `New management teams often review vendors early, creating an opportunity to introduce emergency response, documentation, and building assessment services.`;
  return `This public signal may indicate ownership, management, maintenance, or capital planning activity worth reviewing for commercial service opportunities.`;
}

function hashCode(str) { let h = 0; for (let i=0;i<str.length;i++) h = Math.imul(31,h)+str.charCodeAt(i)|0; return h; }
