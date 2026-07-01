import fs from 'fs';import path from 'path';import { buildFireOpportunity, classifyFireEvent } from './src/fire-intelligence.js';
const start=Date.now();
const queries=[
  'Charlotte apartment fire',
  'Charlotte commercial fire',
  'Charlotte hotel fire',
  'Charlotte warehouse fire',
  'Charlotte NC multifamily fire',
  'Mecklenburg County apartment fire'
];
async function fetchGoogleNews(q){
  const url='https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=en-US&gl=US&ceid=US:en';
  const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 PI/0.2.1'}});
  if(!res.ok) throw new Error('HTTP '+res.status);
  const xml=await res.text();
  const items=[...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map(m=>m[0]).map(x=>({title:decode(x.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1]||x.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[2]||''),link:decode(x.match(/<link>([\s\S]*?)<\/link>/)?.[1]||url),pubDate:decode(x.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]||''),sourceName:'Google News'}));
  return items;
}
function decode(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
const all=[]; const health=[];
for(const q of queries){const t=Date.now();try{const items=await fetchGoogleNews(q);all.push(...items);health.push({module:'commercial-fire-intelligence',source:q,status:'PASS',itemsRetrieved:items.length,durationMs:Date.now()-t});}catch(e){health.push({module:'commercial-fire-intelligence',source:q,status:'WARN',itemsRetrieved:0,durationMs:Date.now()-t,error:e.message});}}
const seen=new Set(); const events=[];
for(const item of all){const key=(item.title||'').toLowerCase().replace(/\W+/g,' ').trim(); if(seen.has(key)) continue; seen.add(key); const cls=classifyFireEvent(item); events.push({...item,classification:cls});}
const opportunities=[]; const byProp=new Map();
for(const item of events){const opp=buildFireOpportunity(item); if(!opp) continue; const key=(opp.propertyName==='Property requires verification'?opp.whatChanged:opp.propertyName).toLowerCase(); if(byProp.has(key)){const existing=byProp.get(key); existing.sources.push(...opp.sources); existing.confidence=Math.min(98,existing.confidence+5); existing.whatChanged += ' | '+opp.whatChanged; } else {byProp.set(key,opp); opportunities.push(opp);} }
opportunities.sort((a,b)=>b.score-a.score||b.confidence-a.confidence);
const out={meta:{version:'0.2.1',generatedAt:new Date().toISOString(),eventsRetrieved:events.length,opportunitiesGenerated:opportunities.length,notes:'Developer Preview: Google News RSS fire/commercial signal validation with property resolution v0.1.'},sourceHealth:[{module:'Commercial Fire Intelligence',status:health.some(h=>h.status==='PASS')?'PASS':'WARN',itemsRetrieved:all.length,durationMs:Date.now()-start,details:health},{module:'Permit Intelligence',status:'RESEARCH',itemsRetrieved:0,durationMs:0,details:'Source validation not yet complete.'}],events:events.slice(0,100),opportunities};
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync(path.join('dist','intelligence.json'),JSON.stringify(out,null,2));console.log(`Generated ${opportunities.length} opportunities from ${events.length} events`);
