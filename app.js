const state = { data: null, opportunities: [] };

const fmtDateTime = (value) => {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
};
const relativeAge = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
};
const latestActivityDate = (o) => {
  const dates = [o.publishedDate, o.piDetectedDate, o.permitCluster?.latestIssuedDate, ...(o.permitCluster?.permits || []).map(p => p.issuedDate)].filter(Boolean).map(x => new Date(x).getTime()).filter(Number.isFinite);
  return dates.length ? Math.max(...dates) : 0;
};
function metric(label, value) { return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`; }
function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Not listed';
  return n.toLocaleString([], { style:'currency', currency:'USD', maximumFractionDigits:0 });
}
function compactMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Not listed';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}
function heatLabel(score=0) {
  if (score >= 95) return 'Critical';
  if (score >= 88) return 'High';
  if (score >= 75) return 'Medium';
  return 'Low';
}
function sourceRow(h) {
  const cls = h.status === 'pass' ? 'pass' : 'fail';
  return `<div class="source ${cls}"><strong>${h.source}</strong><span>${h.query || ''}</span><small>${h.status?.toUpperCase() || 'UNKNOWN'} • ${h.itemsRetrieved ?? 0} items • ${h.durationMs ?? 0}ms</small></div>`;
}
function scoreBar(label, value) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="score-row"><span>${label}</span><b>${safe}</b><div class="bar"><i style="width:${safe}%"></i></div></div>`;
}
function permitClusterBlock(o) {
  const cluster = o.permitCluster;
  if (!cluster) return '';
  const permits = (cluster.permits || [])
    .slice()
    .sort((a,b) => new Date(b.issuedDate || 0) - new Date(a.issuedDate || 0))
    .map(p => `<li>
      <div class="timeline-date">${fmtDateTime(p.issuedDate)}</div>
      <strong>${p.caseNumber || 'Permit'}</strong>
      <span>${p.category || 'Permit'}</span>
      <em>${money(p.cost)}</em>
      <small>${p.description || ''}</small>
      <div class="permit-links">
        ${p.permitDetailUrl ? `<a href="${p.permitDetailUrl}" target="_blank" rel="noopener">Permit detail</a>` : ''}
        ${p.contractor ? `<a href="${p.contractorSearchUrl}" target="_blank" rel="noopener">${p.contractor}</a>` : '<span>Contractor/filer not exposed in permit layer</span>'}
      </div>
    </li>`).join('');
  return `<div class="brief-section"><h4>Permit Timeline</h4>
    <p>${cluster.permitCount || 0} permit${cluster.permitCount === 1 ? '' : 's'} at this property from ${fmtDateTime(cluster.firstIssuedDate)} to ${fmtDateTime(cluster.latestIssuedDate)}. Total listed value: <strong>${money(cluster.totalCost)}</strong>.</p>
    ${cluster.owner ? `<p><strong>Owner from permit record:</strong> ${cluster.owner}</p>` : ''}
    <ul class="permits timeline-list">${permits}</ul></div>`;
}
function propertyResolutionBlock(o) {
  const r = o.propertyResolution;
  if (!r) return '';
  const attrs = r.gisAttributes || {};
  const rows = [
    ['Status', r.status], ['Method', r.method], ['Parcel', r.parcelId],
    ['Confidence', r.confidence ? `${Math.round(r.confidence * 100)}%` : 'Unknown'],
    ['GIS PID', attrs.PID || ''], ['NC PIN', attrs.NC_PIN || ''],
    ['Map Book/Page', [attrs.MAP_BOOK, attrs.MAP_PAGE, attrs.MAP_BLOCK, attrs.LOT_NUM].filter(Boolean).join('-')]
  ].filter(x => x[1]);
  return `<div class="brief-section"><h4>Property Resolution</h4>
    <div class="resolution-grid compact">${rows.map(([k,v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    <div class="permit-links">
      ${r.gisSourceUrl ? `<a href="${r.gisSourceUrl}" target="_blank" rel="noopener">GIS source</a>` : ''}
      ${r.gisQueryUrl ? `<a href="${r.gisQueryUrl}" target="_blank" rel="noopener">GIS query</a>` : ''}
    </div></div>`;
}
function servicesStrip(o) {
  const services = (o.recommendedServices || []).slice(0, 6);
  if (!services.length) return '';
  return `<div class="service-strip">${services.map(s => `<span>${s}</span>`).join('')}</div>`;
}
function scoreBreakdown(o) {
  const breakdown = (o.signalBreakdown || []);
  if (!breakdown.length) return '';
  return `<div class="brief-section"><h4>Opportunity Drivers</h4><ul class="breakdown">${breakdown.map(x => `<li><span>${x.label}</span><b>+${x.points}</b></li>`).join('')}</ul></div>`;
}
function evidenceList(o) {
  const sources = (o.sources || []);
  if (!sources.length) return '<p class="empty">No public evidence attached.</p>';
  return `<ul class="sources">${sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name || 'Source'}</a><span>${fmtDateTime(s.publishedAt)}</span><em>${s.title || ''}</em></li>`).join('')}</ul>`;
}
function opportunityLead(o) {
  if (o.permitCluster) {
    const c = o.permitCluster;
    return `${c.permitCount || 0} permit${c.permitCount === 1 ? '' : 's'} totaling ${compactMoney(c.totalCost)} were identified for this property.`;
  }
  return o.whatChanged || `${o.category || 'Opportunity'} identified for this property.`;
}
function opportunityCard(o, rank) {
  const ratings = o.ratings || {};
  const score = ratings.overall ?? 0;
  const category = o.opportunityClass || o.category || 'Opportunity';
  return `<article class="card heat-${heatLabel(score).toLowerCase()}">
    <div class="rank-badge">#${rank}</div>
    <div class="card-top">
      <div class="card-copy">
        <p class="lead-sentence">${opportunityLead(o)}</p>
        <h3>${o.propertyName || 'Property Requires Verification'}</h3>
        <p>${category} • ${o.territory || 'Territory pending'} • ${o.propertyStatus || 'Needs Verification'}</p>
      </div>
      <div class="rating"><span>${score}</span><small>${heatLabel(score)}</small></div>
    </div>
    ${servicesStrip(o)}
    <div class="date-grid">
      <div><span>Latest Activity</span><strong>${fmtDateTime(latestActivityDate(o))}</strong><small>${relativeAge(latestActivityDate(o))}</small></div>
      <div><span>PI Detected</span><strong>${fmtDateTime(o.piDetectedDate)}</strong><small>${relativeAge(o.piDetectedDate)}</small></div>
      <div><span>Evidence</span><strong>${o.evidenceCount || 0} source${o.evidenceCount === 1 ? '' : 's'}</strong><small>${o.propertyResolution?.parcelId || 'Parcel pending'}</small></div>
    </div>
    <div class="scores">
      ${scoreBar('Opportunity', ratings.opportunity ?? 0)}
      ${scoreBar('Confidence', ratings.confidence ?? 0)}
      ${scoreBar('Freshness', ratings.freshness ?? 0)}
      ${scoreBar('Impact', ratings.impact ?? 0)}
      ${scoreBar('Coverage', ratings.coverage ?? 0)}
    </div>
    <details>
      <summary>Open Property Intelligence Record</summary>
      <div class="brief-grid">
        <div class="brief-section"><h4>What Changed</h4><p>${o.whatChanged || ''}</p></div>
        <div class="brief-section"><h4>Why This Matters</h4><p>${o.whyThisMatters || ''}</p></div>
      </div>
      ${propertyResolutionBlock(o)}
      ${permitClusterBlock(o)}
      ${scoreBreakdown(o)}
      <div class="brief-section"><h4>Supporting Public Sources</h4>${evidenceList(o)}</div>
    </details>
  </article>`;
}
function propertyCard(p) {
  const timeline = (p.timelines || [])
    .slice()
    .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 6)
    .map(t => `<li><span>${fmtDateTime(t.date)}</span><strong>${t.label || t.type}</strong><small>${t.description || ''}</small>${t.url ? `<a href="${t.url}" target="_blank" rel="noopener">Evidence</a>` : ''}</li>`).join('');
  const dq = p.dataQuality || {};
  return `<article class="property-card">
    <div class="property-head">
      <div><h3>${p.propertyName || p.address || 'Property'}</h3><p>${p.address || ''}</p></div>
      <div class="rating small-rating"><span>${p.currentHeatScore || 0}</span><small>Heat</small></div>
    </div>
    <div class="resolution-grid">
      <div><span>Parcel</span><strong>${p.parcelId || 'Pending'}</strong></div>
      <div><span>Type</span><strong>${p.propertyType || 'Pending'}</strong></div>
      <div><span>Owner</span><strong>${p.owner?.name || 'Pending'}</strong></div>
      <div><span>Management</span><strong>${p.management?.name || 'Pending'}</strong></div>
      <div><span>Permits</span><strong>${p.permitSummary?.permitCount || 0}</strong></div>
      <div><span>Listed Value</span><strong>${compactMoney(p.permitSummary?.totalCost || 0)}</strong></div>
      <div><span>Data Quality</span><strong>${dq.overall ?? 'Pending'}${dq.overall ? '%' : ''}</strong></div>
    </div>
    <details><summary>Chronological property timeline</summary><ul class="timeline">${timeline || '<li>No timeline records yet.</li>'}</ul></details>
  </article>`;
}
function organizationRow(o) {
  return `<div class="org-row"><strong>${o.name}</strong><span>${(o.roles || [o.type]).join(', ')}</span><small>${o.propertyIds?.length || 0} properties • ${o.evidenceCount || 0} evidence records${o.watchList ? ' • Watch list' : ''}</small></div>`;
}
function qaRows(summary={}) {
  const rows = [
    ['Permit Records Retrieved', summary.permitRecordsRetrieved ?? 0], ['Permit Candidates', summary.permitCandidates ?? 0],
    ['Permit Address Clusters', summary.permitClusters ?? 0], ['GIS Parcel Matches', `${summary.gisMatches ?? 0}/${summary.gisLookups ?? 0}`],
    ['Properties Created/Updated', summary.properties ?? 0], ['Organizations Resolved', summary.organizations ?? 0],
    ['Signals Created', summary.signals ?? 0], ['Evidence Records', summary.evidence ?? 0],
    ['Out of Territory Excluded', summary.outOfTerritoryExcluded ?? 0],
    ['Residential / Noise Excluded', (summary.nonCommercialExcluded ?? 0) + (summary.permitExcluded ?? 0)],
    ['Old Items Excluded', (summary.oldItemsExcluded ?? 0) + (summary.permitOldExcluded ?? 0)], ['Duplicates Removed', summary.duplicateRawExcluded ?? 0]
  ];
  return rows.map(([k,v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function searchableText(o) {
  return [o.propertyName, o.category, o.territory, o.whatChanged, o.whyThisMatters, o.propertyResolution?.parcelId, o.permitCluster?.owner, ...(o.sources || []).map(s => `${s.name} ${s.title}`), ...(o.recommendedServices || [])].filter(Boolean).join(' ').toLowerCase();
}
function filteredSortedOpportunities() {
  const q = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const sort = document.getElementById('sortSelect')?.value || 'score';
  const category = document.getElementById('categoryFilter')?.value || 'all';
  const minScore = Number(document.getElementById('scoreFilter')?.value || 0);
  let items = [...(state.opportunities || [])];
  items = items.filter(o => {
    const score = o.ratings?.overall ?? 0;
    const cls = o.opportunityClass || o.category || '';
    if (score < minScore) return false;
    if (category !== 'all' && !cls.includes(category)) return false;
    if (q && !searchableText(o).includes(q)) return false;
    return true;
  });
  items.sort((a,b) => {
    if (sort === 'newest') return latestActivityDate(b) - latestActivityDate(a);
    if (sort === 'value') return Number(b.permitCluster?.totalCost || 0) - Number(a.permitCluster?.totalCost || 0);
    if (sort === 'signals') return Number(b.permitCluster?.permitCount || 0) - Number(a.permitCluster?.permitCount || 0);
    if (sort === 'property') return String(a.propertyName || '').localeCompare(String(b.propertyName || ''));
    return (b.ratings?.overall ?? 0) - (a.ratings?.overall ?? 0);
  });
  return items;
}
function renderOpportunities() {
  const opportunities = document.getElementById('opportunities');
  const feedStatus = document.getElementById('feedStatus');
  const items = filteredSortedOpportunities();
  feedStatus.textContent = `${items.length} shown • ${state.opportunities.length} active`;
  opportunities.innerHTML = items.map((o,i) => opportunityCard(o, i + 1)).join('') || '<p class="empty">No opportunities match the current filters.</p>';
}
function renderData(data) {
  const s = data.summary || {};
  const highPriority = (data.opportunities || []).filter(o => (o.ratings?.overall ?? 0) >= 90).length;
  document.getElementById('briefLine').textContent = `${s.opportunities ?? 0} qualified opportunities identified. ${highPriority} high priority. ${s.permitClusters ?? 0} permit clusters. ${s.gisMatches ?? 0} GIS parcel matches.`;
  document.getElementById('lastUpdated').textContent = `Generated ${fmtDateTime(data.generatedAt)}`;
  document.getElementById('metrics').innerHTML = [
    metric('Qualified Opportunities', s.opportunities ?? 0), metric('High Priority', highPriority),
    metric('Properties', s.properties ?? 0), metric('Capital Projects', s.capitalImprovementOpportunities ?? 0),
    metric('Emergency', s.emergencyOpportunities ?? 0), metric('Permit Clusters', s.permitClusters ?? 0),
    metric('GIS Matches', `${s.gisMatches ?? 0}/${s.gisLookups ?? 0}`), metric('Organizations', s.organizations ?? 0)
  ].join('');
  document.getElementById('sourceHealth').innerHTML = (data.health || []).map(sourceRow).join('') || '<p>No source health available.</p>';
  document.getElementById('properties').innerHTML = (data.properties || []).slice(0, 12).map(propertyCard).join('') || '<p class="empty">No property intelligence records generated yet.</p>';
  document.getElementById('organizations').innerHTML = (data.organizations || []).slice(0, 20).map(organizationRow).join('') || '<p class="empty">No organizations resolved yet.</p>';
  document.getElementById('qaMetrics').innerHTML = qaRows(s);
  state.data = data;
  state.opportunities = data.opportunities || [];
  renderOpportunities();
}
async function loadData() {
  document.getElementById('metrics').innerHTML = metric('Status', 'Loading');
  try {
    const res = await fetch(`data/opportunities.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`Data file not found (${res.status})`);
    renderData(await res.json());
  } catch (err) {
    document.getElementById('metrics').innerHTML = metric('Status', 'No Data');
    document.getElementById('briefLine').textContent = 'Run GitHub Actions → Update Intelligence, then refresh this page.';
    document.getElementById('sourceHealth').innerHTML = `<p class="empty">${err.message}</p>`;
    document.getElementById('opportunities').innerHTML = '<p class="empty">Run GitHub Actions → Update Intelligence, then refresh this page.</p>';
    document.getElementById('properties').innerHTML = '';
    document.getElementById('organizations').innerHTML = '';
    document.getElementById('qaMetrics').innerHTML = '';
  }
}
document.getElementById('refreshBtn').addEventListener('click', loadData);
['searchInput','sortSelect','categoryFilter','scoreFilter'].forEach(id => document.getElementById(id)?.addEventListener('input', renderOpportunities));
loadData();
