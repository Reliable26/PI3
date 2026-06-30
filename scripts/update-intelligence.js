const fs = require('fs');
const path = require('path');
const config = require('../config/sources.json');

const OUT = path.join(process.cwd(), 'dist', 'data');
fs.mkdirSync(OUT, { recursive: true });

const now = new Date().toISOString();

async function main(){
  const sourceResults = [];
  const rawItems = [];
  for (const src of config.gdeltQueries){
    try{
      const items = await fetchGdelt(src.query);
      sourceResults.push({ name: src.name, status: 'OK', count: items.length });
      for (const item of items) rawItems.push({ ...item, connector: src.name });
    } catch(err){
      sourceResults.push({ name: src.name, status: 'ERROR', error: String(err).slice(0,180), count: 0 });
    }
  }

  const opportunities = dedupe(rawItems.map(toOpportunity).filter(Boolean))
    .sort((a,b)=> b.score - a.score)
    .slice(0,50);

  const payload = {
    meta: {
      generatedAt: now,
      generatedByWorkflow: true,
      engine: 'gdelt-public-signals-v1',
      sourcesConfigured: config.gdeltQueries.length,
      sourcesChecked: sourceResults,
      opportunityCount: opportunities.length
    },
    opportunities
  };
  fs.writeFileSync(path.join(OUT, 'opportunities.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(OUT, 'properties.json'), JSON.stringify({ meta:{generatedAt:now}, properties: opportunities.map(o => ({ propertyName:o.propertyName, address:o.address, county:o.county, propertyType:o.propertyType })) }, null, 2));
  fs.writeFileSync(path.join(OUT, 'companies.json'), JSON.stringify({ meta:{generatedAt:now}, companies: [...new Set(opportunities.map(o => o.companyName).filter(Boolean))].map(name => ({ name })) }, null, 2));
  console.log(`Generated ${opportunities.length} opportunities`);
}

async function fetchGdelt(query){
  const url = 'https://api.gdeltproject.org/api/v2/doc/doc?' + new URLSearchParams({
    query,
    mode: 'ArtList',
    format: 'json',
    maxrecords: '25',
    sort: 'DateDesc'
  });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 property-intelligence' }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map(a => ({
    title: a.title || '',
    url: a.url || '',
    source: a.domain || a.sourceCountry || 'Public Source',
    seenDate: a.seendate || now,
    summary: a.socialimage || '',
    language: a.language || ''
  }));
}

function toOpportunity(item){
  const text = `${item.title} ${item.url}`;
  if (isExcluded(text)) return null;
  if (!isTerritory(text)) return null;

  const category = categorize(text);
  const score = scoreFor(text, category, item.seenDate);
  const confidence = confidenceFor(item, category);
  const propertyName = extractPropertyName(item.title) || categoryBasedName(category);
  const county = inferCounty(text);
  const propertyType = inferPropertyType(text, category);
  return {
    id: slug(`${item.title}-${item.url}`),
    propertyName,
    companyName: extractCompany(text),
    address: '',
    county,
    propertyType,
    category,
    score,
    confidence,
    whatChanged: item.title,
    whyThisMatters: why(category),
    recommendedServices: services(category),
    firstSeen: now,
    lastVerified: now,
    sources: [{ name: item.source || item.connector, url: item.url }]
  };
}

function isTerritory(text){ return config.territoryKeywords.some(k => new RegExp(`\\b${escapeReg(k)}\\b`, 'i').test(text)); }
function isExcluded(text){ return config.excludeKeywords.some(k => new RegExp(k, 'i').test(text)); }
function categorize(text){
  const t = text.toLowerCase();
  if (/apartment fire|commercial fire|structure fire|hotel fire|warehouse fire|smoke damage|fire suppression/.test(t)) return 'Fire / Emergency';
  if (/roof|permit|renovation|capital improvement|exterior|waterproofing|building permit/.test(t)) return 'Permit / Capital Improvement';
  if (/acquisition|acquires|purchased|sold|sale/.test(t)) return 'Acquisition';
  if (/management|manager|property management/.test(t)) return 'Management Change';
  if (/refinance|financing|loan/.test(t)) return 'Financing';
  return 'Market Intelligence';
}
function scoreFor(text, category, date){
  let s = 60;
  if (category === 'Fire / Emergency') s += 35;
  if (category === 'Permit / Capital Improvement') s += 25;
  if (category === 'Acquisition') s += 25;
  if (category === 'Management Change') s += 20;
  if (/apartment|multifamily|hotel|warehouse|office|medical|commercial/i.test(text)) s += 8;
  if (/Charlotte|Mecklenburg/i.test(text)) s += 5;
  return Math.min(100, s);
}
function confidenceFor(item, category){ let c=65; if(item.url)c+=10; if(item.source)c+=10; if(category !== 'Market Intelligence')c+=10; return Math.min(100,c); }
function why(category){
  const map = {
    'Fire / Emergency':'Fire, smoke, and suppression activity can create urgent needs for mitigation, smoke remediation, structural drying, reconstruction, and documentation.',
    'Permit / Capital Improvement':'Permit and capital project activity often signals active budgets, exterior work, roof work, envelope issues, or upcoming renovation needs.',
    'Acquisition':'New ownership commonly reviews vendors, budgets, deferred maintenance, insurance readiness, and capital improvement priorities within the first 90 days.',
    'Management Change':'New management teams often reassess vendor relationships, property condition, emergency response readiness, and deferred maintenance needs.',
    'Financing':'Refinancing can precede capital improvements, deferred maintenance work, and asset repositioning projects.',
    'Market Intelligence':'Public activity indicates a possible prospecting signal that should be reviewed before outreach.'
  };
  return map[category] || map['Market Intelligence'];
}
function services(category){
  const map = {
    'Fire / Emergency':['Fire Restoration','Smoke Remediation','Water Mitigation','Commercial Reconstruction','Emergency Response'],
    'Permit / Capital Improvement':['Roofing','Building Envelope','Water Intrusion Investigation','Exterior Repairs','Commercial Reconstruction'],
    'Acquisition':['Building Condition Assessment','Annual Property Documentation','Water Intrusion Inspection','Emergency Response Planning'],
    'Management Change':['Emergency Response','Building Condition Assessment','Water Intrusion Inspection','Commercial Reconstruction'],
    'Financing':['Capital Improvements','Building Envelope Assessment','Exterior Painting','Roofing'],
    'Market Intelligence':['Building Condition Assessment','Annual Property Documentation']
  };
  return map[category] || map['Market Intelligence'];
}
function inferCounty(text){
  if (/Mecklenburg|Charlotte|Pineville|Matthews|Huntersville/i.test(text)) return 'Mecklenburg';
  if (/Cabarrus|Concord/i.test(text)) return 'Cabarrus';
  if (/Gaston|Gastonia/i.test(text)) return 'Gaston';
  if (/Union|Monroe/i.test(text)) return 'Union';
  if (/Iredell|Mooresville/i.test(text)) return 'Iredell';
  if (/York|Rock Hill|Fort Mill/i.test(text)) return 'York';
  if (/Lancaster/i.test(text)) return 'Lancaster';
  return 'Charlotte Region';
}
function inferPropertyType(text, category){
  if (/apartment|multifamily/i.test(text)) return 'Multifamily';
  if (/hotel|hospitality/i.test(text)) return 'Hospitality';
  if (/warehouse|industrial/i.test(text)) return 'Industrial';
  if (/medical|hospital|health/i.test(text)) return 'Healthcare';
  if (/office/i.test(text)) return 'Office';
  if (/retail|shopping/i.test(text)) return 'Retail';
  if (category === 'Fire / Emergency') return 'Commercial / Multifamily';
  return 'Commercial';
}
function extractCompany(text){
  const companies = ['Bell Partners','Knightvest','MAA','Cortland','Asset Living','Willow Bridge','Lincoln Property','RPM Living','Fogelman','Morgan Properties','Cushman & Wakefield'];
  return companies.find(c => new RegExp(escapeReg(c),'i').test(text)) || '';
}
function extractPropertyName(title){
  const match = title.match(/(?:at|for|near)\s+([A-Z][A-Za-z0-9'& .-]{4,60})/);
  return match ? match[1].replace(/[-|:].*$/,'').trim() : '';
}
function categoryBasedName(category){ return category === 'Fire / Emergency' ? 'Commercial Fire Signal' : 'Public Property Signal'; }
function dedupe(items){ const seen = new Set(); return items.filter(o => { const k = slug(o.whatChanged + o.county + o.category); if(seen.has(k)) return false; seen.add(k); return true; }); }
function slug(v){ return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90); }
function escapeReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

main().catch(err => { console.error(err); process.exit(1); });
