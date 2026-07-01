import territory from '../config/territory.js';
import watchlist from '../config/watchlist.js';

const fireWords = ['fire', 'structure fire', 'working fire', 'alarm fire', 'smoke', 'flames'];
const emergencyNoise = ['vehicle fire', 'car fire', 'brush fire', 'woods fire', 'grass fire', 'dumpster', 'trash fire', 'shed fire', 'garage fire'];
const residentialNoise = ['single family', 'single-family', 'house fire', 'home fire', 'residential fire', 'mobile home'];
const commercialTerms = ['apartment', 'apartments', 'multifamily', 'hotel', 'warehouse', 'industrial', 'office', 'retail', 'shopping center', 'medical', 'hospital', 'school', 'university', 'senior living', 'assisted living', 'commercial', 'business', 'mall', 'plaza'];

function includesAny(text, terms) {
  const t = (text || '').toLowerCase();
  return terms.some(term => t.includes(term.toLowerCase()));
}

export function classifyEvent(event) {
  const text = `${event.headline || ''} ${event.description || ''}`.toLowerCase();
  const source = event.sourceName || event.connector || 'Unknown Source';
  const inTerritory = territory.cities.some(c => text.includes(c.toLowerCase())) || territory.counties.some(c => text.includes(c.toLowerCase())) || text.includes('charlotte');
  const watchMatch = watchlist.find(w => text.includes(w.toLowerCase())) || null;

  if (includesAny(text, territory.exclude) || includesAny(text, emergencyNoise) || includesAny(text, residentialNoise)) {
    return { accepted: false, reason: 'Excluded residential/non-commercial/noise event', inTerritory, watchMatch };
  }

  if (includesAny(text, fireWords)) {
    let category = 'FIRE_COMMERCIAL';
    let propertyType = 'Commercial';
    if (text.includes('apartment') || text.includes('multifamily')) { category = 'FIRE_MULTIFAMILY'; propertyType = 'Multifamily'; }
    else if (text.includes('hotel') || text.includes('extended stay')) { category = 'FIRE_HOTEL'; propertyType = 'Hospitality'; }
    else if (text.includes('warehouse') || text.includes('industrial')) { category = 'FIRE_INDUSTRIAL'; propertyType = 'Industrial'; }
    else if (text.includes('hospital') || text.includes('medical') || text.includes('assisted living') || text.includes('skilled nursing')) { category = 'FIRE_HEALTHCARE'; propertyType = 'Healthcare'; }
    else if (text.includes('school') || text.includes('university') || text.includes('college')) { category = 'FIRE_EDUCATION'; propertyType = 'Education'; }
    else if (!includesAny(text, commercialTerms)) {
      return { accepted: false, reason: 'Fire event lacks commercial/multifamily indicator', inTerritory, watchMatch };
    }

    return {
      accepted: true,
      category,
      propertyType,
      reasonCode: category,
      whatChanged: event.headline,
      whyNow: 'A recent fire-related public signal creates a time-sensitive reason to verify property impact and service needs.',
      whyThisMatters: 'Commercial and multifamily fire events often create follow-on needs for emergency mitigation, smoke remediation, water mitigation from fire suppression, demolition, and reconstruction.',
      recommendedServices: ['Emergency Response', 'Fire Restoration', 'Smoke Remediation', 'Water Mitigation', 'Reconstruction'],
      inTerritory,
      watchMatch,
      source
    };
  }

  return { accepted: false, reason: 'No actionable PI category matched', inTerritory, watchMatch };
}
