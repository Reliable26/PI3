const state = { data: null };

const el = (id) => document.getElementById(id);

function fmtDate(value) {
  if (!value) return 'Never';
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

async function loadIntelligence() {
  el('dataStatus').textContent = 'Loading published intelligence...';
  try {
    const res = await fetch(`public/intelligence.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.data = data;
    render(data);
  } catch (err) {
    el('dataStatus').textContent = `No published intelligence found: ${err.message}`;
  }
}

function render(data) {
  const opportunities = Array.isArray(data.opportunities) ? data.opportunities : [];
  const health = Array.isArray(data.sourceHealth) ? data.sourceHealth : [];
  const high = opportunities.filter(o => Number(o.opportunityScore || 0) >= 85).length;

  el('metricOpportunities').textContent = opportunities.length;
  el('metricHigh').textContent = high;
  el('metricSources').textContent = `${health.filter(h => h.status === 'PASS').length}/${health.length}`;
  el('metricUpdated').textContent = fmtDate(data.generatedAt);
  el('dataStatus').textContent = opportunities.length ? `Loaded ${opportunities.length} opportunities` : 'Loaded, but no opportunities found';

  renderTop(opportunities);
  renderFeed(opportunities);
  renderHealth(health);
}

function opportunityHtml(o, rank = null) {
  const services = (o.recommendedServices || []).map(s => `<span class="badge">${escapeHtml(s)}</span>`).join(' ');
  const sources = (o.sources || []).map(s => s.url ? `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name || 'Source')}</a>` : escapeHtml(s.name || 'Source')).join(', ');
  return `
    <article class="item">
      <h3>${rank ? `${rank}. ` : ''}${escapeHtml(o.propertyName || 'Needs property match')} <span class="score">${o.opportunityScore || 0}</span></h3>
      <div class="meta"><strong>${escapeHtml(o.category || 'Opportunity')}</strong> • Confidence ${o.confidenceScore || 0} • ${escapeHtml(o.county || 'Unknown county')}</div>
      <p><strong>What changed:</strong> ${escapeHtml(o.whatChanged || '')}</p>
      <p><strong>Why this matters:</strong> ${escapeHtml(o.whyThisMatters || '')}</p>
      <p><strong>Recommended:</strong> ${services || 'Needs review'}</p>
      <div class="meta"><strong>Sources:</strong> ${sources || 'None'}</div>
    </article>`;
}

function renderTop(opportunities) {
  const top = [...opportunities].sort((a,b) => (b.opportunityScore||0) - (a.opportunityScore||0)).slice(0, 10);
  el('topOpportunities').className = top.length ? 'list' : 'list empty';
  el('topOpportunities').innerHTML = top.length ? top.map((o,i) => opportunityHtml(o, i+1)).join('') : 'No top opportunities available yet.';
}

function renderFeed(opportunities) {
  const feed = [...opportunities].sort((a,b) => new Date(b.firstSeen || 0) - new Date(a.firstSeen || 0));
  el('opportunityFeed').className = feed.length ? 'list' : 'list empty';
  el('opportunityFeed').innerHTML = feed.length ? feed.map(o => opportunityHtml(o)).join('') : 'No new opportunities available yet.';
}

function renderHealth(health) {
  el('sourceHealth').className = health.length ? 'list' : 'list empty';
  el('sourceHealth').innerHTML = health.length ? health.map(h => `
    <div class="healthRow">
      <div><strong>${escapeHtml(h.name)}</strong><div class="meta">${escapeHtml(h.itemsRetrieved || 0)} items • ${escapeHtml(h.opportunitiesCreated || 0)} opportunities • ${escapeHtml(h.durationMs || 0)} ms</div></div>
      <div class="${h.status === 'PASS' ? 'statusPass' : h.status === 'WARN' ? 'statusWarn' : 'statusFail'}">${escapeHtml(h.status)}</div>
    </div>
  `).join('') : 'No source health data loaded.';
}

function escapeHtml(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(v) { return escapeHtml(v).replace(/'/g, '&#039;'); }

el('updateBtn').addEventListener('click', loadIntelligence);
el('routeBtn').addEventListener('click', () => {
  if (!state.data) loadIntelligence();
  document.querySelector('#topOpportunities').scrollIntoView({ behavior: 'smooth' });
});

loadIntelligence();
