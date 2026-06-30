let state = { opportunities: [], meta: {} };

const $ = (id) => document.getElementById(id);

async function loadData() {
  try {
    const res = await fetch(`data/opportunities.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state = await res.json();
    normalizeState();
    render();
  } catch (err) {
    state = { opportunities: [], meta: { error: String(err), generatedByWorkflow: false } };
    render();
  }
}

function normalizeState(){
  if (!Array.isArray(state.opportunities)) state.opportunities = [];
  if (!state.meta || typeof state.meta !== 'object') state.meta = {};
}

function sourceLabel(item){
  if (!item) return '—';
  if (typeof item === 'string') return item;
  return item.name || item.url || item.status || JSON.stringify(item);
}

function render(){
  const opps = [...state.opportunities].sort((a,b)=> (b.score||0)-(a.score||0));
  const high = opps.filter(o => (o.score||0) >= 85).length;
  const emergency = opps.filter(o => /fire|emergency|water|storm/i.test(o.category || '')).length;
  const avg = opps.length ? Math.round(opps.reduce((sum,o)=>sum+(o.score||0),0)/opps.length) : 0;
  const sourcesChecked = Array.isArray(state.meta.sourcesChecked) ? state.meta.sourcesChecked : [];
  const sourcesConfigured = state.meta.sourcesConfigured || sourcesChecked.length || '—';

  $('loadedPill').textContent = `Loaded ${opps.length} opportunities.`;
  $('sourcesPill').textContent = `Sources checked: ${sourcesChecked.length || sourcesConfigured || '—'}`;
  $('lastUpdatedPill').textContent = `Last update: ${formatDate(state.meta.generatedAt)}`;
  $('totalCount').textContent = opps.length;
  $('highCount').textContent = high;
  $('emergencyCount').textContent = emergency;
  $('avgScore').textContent = avg;

  $('dataStatus').textContent = opps.length ? 'Loaded' : 'Empty';
  $('sourcesConfigured').textContent = sourcesConfigured;
  $('sourcesChecked').textContent = sourcesChecked.length || '—';
  $('workflowStatus').textContent = state.meta.generatedByWorkflow ? 'OK' : '—';
  $('lastGenerated').textContent = formatDate(state.meta.generatedAt);

  renderRoute(opps.slice(0,10));
  renderFeed(opps);
}

function renderRoute(opps){
  const box = $('routeList');
  if (!opps.length){
    box.className='list empty';
    box.innerHTML='No opportunities loaded. Run the GitHub Action named <b>Update Intelligence</b>, refresh this page, then click <b>Update Intelligence</b>.';
    return;
  }
  box.className='list';
  box.innerHTML = opps.map((o,i)=> card(o,i+1,'route-item')).join('');
}

function renderFeed(opps){
  const q = ($('searchBox').value || '').toLowerCase().trim();
  const filtered = q ? opps.filter(o => JSON.stringify(o).toLowerCase().includes(q)) : opps;
  const box = $('feedList');
  if (!filtered.length){
    box.className='list empty';
    box.textContent='No matching opportunities.';
    return;
  }
  box.className='list';
  box.innerHTML = filtered.map((o,i)=> card(o,i+1,'feed-item')).join('');
}

function card(o, rank, cls){
  const cat = escapeHtml(o.category || 'Market Activity');
  const badgeClass = categoryClass(cat);
  const src = Array.isArray(o.sources) ? o.sources.map(sourceLabel).join(' | ') : sourceLabel(o.sources);
  return `<div class="${cls}">
    <div class="rank ${(o.score||0)>=90?'hot':''}">${rank}</div>
    <div>
      <div class="title">${escapeHtml(o.propertyName || o.companyName || o.title || 'Public Opportunity')}</div>
      <div class="sub">${escapeHtml([o.address,o.county,o.propertyType].filter(Boolean).join(' | ') || o.location || 'Charlotte Region')}</div>
      <div class="why"><b>What changed:</b> ${escapeHtml(o.whatChanged || o.title || '')}</div>
      <div class="why"><b>Why this matters:</b> ${escapeHtml(o.whyThisMatters || '')}</div>
      <div class="services"><b>Services:</b> ${escapeHtml((o.recommendedServices||[]).join(', '))}</div>
      <div class="sources">${escapeHtml(src || '')}</div>
    </div>
    <div class="badgewrap"><span class="badge ${badgeClass}">${cat}</span></div>
    <div class="score">${o.score || 0}</div>
  </div>`;
}

function categoryClass(cat){
  const c = (cat || '').toLowerCase();
  if (c.includes('fire') || c.includes('emergency')) return 'fire';
  if (c.includes('permit') || c.includes('capital')) return 'permit';
  if (c.includes('management') || c.includes('acquisition')) return 'management';
  return '';
}

function exportCsv(){
  const rows = [['Property','Address','County','Category','Score','Confidence','What Changed','Why This Matters','Services','Sources']];
  state.opportunities.forEach(o => rows.push([
    o.propertyName || o.companyName || o.title || '', o.address || '', o.county || '', o.category || '', o.score || '', o.confidence || '', o.whatChanged || '', o.whyThisMatters || '', (o.recommendedServices||[]).join('; '), (o.sources||[]).map(sourceLabel).join('; ')
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'opportunities.csv';
  a.click();
}

function formatDate(d){
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date) ? String(d) : date.toLocaleString();
}
function escapeHtml(v){return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

$('updateBtn').addEventListener('click', loadData);
$('routeBtn').addEventListener('click', () => document.querySelector('.large').scrollIntoView({behavior:'smooth'}));
$('exportBtn').addEventListener('click', exportCsv);
$('searchBox').addEventListener('input', () => renderFeed(state.opportunities));
loadData();
