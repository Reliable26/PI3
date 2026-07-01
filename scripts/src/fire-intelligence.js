import { rules } from '../../config/rules.js';
export function normalizeTitle(text){return String(text||'').replace(/\s+/g,' ').trim();}
export function extractPropertyName(title){
  const t=normalizeTitle(title);
  const patterns=[/([A-Z][A-Za-z0-9'&.\- ]+ Apartments)\b/,/([A-Z][A-Za-z0-9'&.\- ]+ Apartment Homes)\b/,/([A-Z][A-Za-z0-9'&.\- ]+ Commons)\b/,/([A-Z][A-Za-z0-9'&.\- ]+ Village)\b/,/([A-Z][A-Za-z0-9'&.\- ]+ Hotel)\b/,/([A-Z][A-Za-z0-9'&.\- ]+ Warehouse)\b/];
  for(const p of patterns){const m=t.match(p); if(m) return m[1].replace(/^(Fire damages|Crews battle|Fire at) /i,'').trim();}
  return null;
}
export function classifyFireEvent(item){
  const title=normalizeTitle(item.title||item.headline||''); const lower=title.toLowerCase();
  if(!rules.fire.some(k=>lower.includes(k))) return {include:false,reason:'No fire signal'};
  if(rules.excluded.some(k=>lower.includes(k))) return {include:false,reason:'Excluded non-target event'};
  const hasCommercial=rules.commercial.some(k=>lower.includes(k));
  if(!hasCommercial) return {include:false,reason:'No commercial/multifamily signal'};
  let category='FIRE_COMMERCIAL'; let type='Commercial';
  if(/apartment|multifamily|multi-family/.test(lower)){category='FIRE_MULTIFAMILY'; type='Multifamily';}
  else if(/hotel|motel/.test(lower)){category='FIRE_HOTEL'; type='Hospitality';}
  else if(/warehouse|industrial/.test(lower)){category='FIRE_INDUSTRIAL'; type='Industrial';}
  else if(/office/.test(lower)){category='FIRE_OFFICE'; type='Office';}
  else if(/retail|shopping center|store|restaurant/.test(lower)){category='FIRE_RETAIL'; type='Retail';}
  else if(/hospital|medical|assisted living|senior living|skilled nursing/.test(lower)){category='FIRE_HEALTHCARE'; type='Healthcare';}
  else if(/school|university/.test(lower)){category='FIRE_EDUCATION'; type='Education';}
  const propertyName=extractPropertyName(title);
  return {include:true,category,propertyType:type,propertyName,confidence: propertyName?86:80};
}
export function buildFireOpportunity(item){
  const c=classifyFireEvent(item); if(!c.include) return null;
  const title=normalizeTitle(item.title||'Fire-related public signal');
  return {id:'fire-'+Buffer.from(title).toString('base64url').slice(0,12),propertyName:c.propertyName||'Property requires verification',propertyStatus:c.propertyName?'Partially Resolved':'Needs Verification',address:'Address requires verification',territory:'Charlotte Metro',propertyType:c.propertyType,category:c.category,priority:'Critical',score:100,confidence:c.confidence,whatChanged:title,whyNow:'A recent fire-related public signal creates a time-sensitive reason to verify property impact and service needs.',whyThisMatters:'Commercial and multifamily fire events often create follow-on needs for emergency mitigation, smoke remediation, water mitigation from fire suppression, demolition, and reconstruction.',recommendedServices:rules.servicePlaybooks.fire,sources:[{name:item.sourceName||'Google News',url:item.link||'#'}],firstSeen:new Date().toISOString(),lastVerified:new Date().toISOString()};
}
