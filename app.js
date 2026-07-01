let currentData = null;
async function loadData() {
  try {
    const res = await fetch(`data/opportunities.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentData = await res.json();
  } catch (err) {
    currentData = { meta: { generatedAt: null, opportunitiesCreated: 0, eventsRetrieved: 0 }, sourceHealth: [], opportunities: [], rejectedSample: [], error: String(err.message || err) };
  }
  render();
}
function render() {
  const opps = currentData.opportunities || [];
  const health = currentData.sourceHealth || [];
  document.getElementById('statusStrip').textContent = currentData.error ? `Data not loaded: ${currentData.error}` : `Loaded ${opps.length} opportunities • ${currentData.meta.eventsRetrieved || 0} events retrieved`;
  document.getElementById('totalOpps').textContent = opps.length;
  document.getElementById('highOpps').textContent = opps.filter(o => ['Critical','High'].includes(o.priority)).length;
  document.getElementById('healthySources').textContent = health.filter(h => h.status === 'PASS').length + '/' + health.length;
  document.getElementById('lastUpdate').textContent = currentData.meta.generatedAt ? new Date(currentData.meta.generatedAt).toLocaleString() : '—';
  renderOpps('topOpportunities', opps.slice(0,5));
  renderOpps('feed', filterOpps(opps));
  renderHealth(health);
  renderRejected(currentData.rejectedSample || []);
}
function filterOpps(opps) {
  const q = (document.getElementById('search').value || '').toLowerCase();
  if (!q) return opps;
  return opps.filter(o => JSON.stringify(o).toLowerCase().includes(q));
}
function renderOpps(id, opps) {
  const el = document.getElementById(id);
  if (!opps.length) { el.innerHTML = '<div class="empty">No opportunities generated yet. Run GitHub Actions → Update Intelligence, then refresh.</div>'; return; }
  el.innerHTML = opps.map(o => `<div class="opp"><div><h3>${escapeHtml(o.propertyName)}</h3><div><span class="badge">${o.priority}</span><span class="badge">${o.category}</span><span class="badge">Confidence ${o.confidenceScore}</span></div><div class="meta">${escapeHtml(o.address)} • ${escapeHtml(o.county)} • ${escapeHtml(o.propertyType)}</div><p><strong>What changed:</strong> ${escapeHtml(o.whatChanged || '')}</p><p><strong>Why now:</strong> ${escapeHtml(o.whyNow || '')}</p><p><strong>Why this matters:</strong> ${escapeHtml(o.whyThisMatters || '')}</p><div class="services"><strong>Services:</strong> ${(o.recommendedServices || []).map(escapeHtml).join(', ')}</div><div class="meta"><strong>Sources:</strong> ${(o.supportingSources || []).map(s => s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>` : escapeHtml(s.name)).join(', ')}</div></div><div class="score">${o.opportunityScore}</div></div>`).join('');
}
function renderHealth(health) {
  const el = document.getElementById('sourceHealth');
  if (!health.length) { el.innerHTML = '<div class="empty">No source health data.</div>'; return; }
  el.innerHTML = health.map(h => `<div class="source"><div><strong>${escapeHtml(h.module)}</strong><div class="meta">${h.itemsRetrieved || 0} items • ${h.durationMs || 0} ms</div></div><div class="${h.status === 'PASS' ? 'ok' : h.status === 'ERROR' ? 'err' : 'warn'}">${h.status}</div></div>`).join('');
}
function renderRejected(items) {
  const el = document.getElementById('rejected');
  if (!items.length) { el.innerHTML = '<div class="empty">No rejected sample.</div>'; return; }
  el.innerHTML = items.map(i => `<div class="opp"><div><h3>${escapeHtml(i.headline || '')}</h3><div class="meta">Rejected: ${escapeHtml(i.reason || '')} • ${escapeHtml(i.source || '')}</div></div></div>`).join('');
}
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function exportCsv() {
  const opps = currentData?.opportunities || [];
  const rows = [['Property','Address','County','Type','Category','Score','Confidence','Why Now','Sources'], ...opps.map(o => [o.propertyName,o.address,o.county,o.propertyType,o.category,o.opportunityScore,o.confidenceScore,o.whyNow,(o.supportingSources||[]).map(s=>s.url).join(' ')])];
  const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = 'pi-opportunities.csv'; a.click();
}
document.getElementById('updateBtn').addEventListener('click', loadData);
document.getElementById('exportBtn').addEventListener('click', exportCsv);
document.getElementById('search').addEventListener('input', render);
loadData();
