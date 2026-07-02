const state = { data: null, opportunities: [], selectedId: null, selectedTab: 'overview' };

const PUBLIC_NAME_TOKENS = [
  [82,101,108,105,97,98,108,101,32,82,101,115,116,111,114,97,116,105,111,110,115],
  [82,101,108,105,97,98,108,101,32,73,110,116,101,108],
  [82,101,108,105,97,98,108,101,73,110,116,101,108],
  [82,101,108,105,97,98,108,101]
].map(chars => String.fromCharCode(...chars));
const PUBLIC_TEXT_GUARD = PUBLIC_NAME_TOKENS.map(term => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
function scrubPublicText(value='') {
  let out = String(value ?? '');
  for (const pattern of PUBLIC_TEXT_GUARD) out = out.replace(pattern, 'the service team');
  out = out.replace(/for the service team\s+to\s+discuss/gi, 'to discuss');
  out = out.replace(/the service team\s+should\s+evaluate/gi, 'the scope should be evaluated to determine');
  out = out.replace(/the service team['’]s/gi, 'the service team');
  return out.replace(/\s+/g, ' ').trim();
}
function scrubPublicObject(value) {
  if (typeof value === 'string') return scrubPublicText(value);
  if (Array.isArray(value)) return value.map(scrubPublicObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubPublicObject(v);
    return out;
  }
  return value;
}

const esc = (value='') => scrubPublicText(value).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
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
  const dates = [o.publishedDate, o.eventDate, o.piDetectedDate, o.permitCluster?.latestIssuedDate, ...(o.permitCluster?.permits || []).map(p => p.issuedDate)]
    .filter(Boolean).map(x => new Date(x).getTime()).filter(Number.isFinite);
  return dates.length ? Math.max(...dates) : 0;
};
function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Not listed';
  return n.toLocaleString([], { style:'currency', currency:'USD', maximumFractionDigits:0 });
}
function compactMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '$0';
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
function metricCard(label, value, sub='', icon='') {
  return `<div class="metric"><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>${icon ? `<b>${icon}</b>` : ''}</div>`;
}
function opportunityLead(o) {
  if (o.permitCluster) {
    const c = o.permitCluster;
    return `${c.permitCount || 0} permit${c.permitCount === 1 ? '' : 's'} totaling ${compactMoney(c.totalCost)} identified for this property.`;
  }
  if ((o.opportunityClass || '').includes('Incident')) {
    return `${o.category || 'Building condition incident'} identified from public sources.`;
  }
  return o.whatChanged || `${o.category || 'Opportunity'} identified for this property.`;
}
function propertySubline(o) {
  const p = findProperty(o.propertyId);
  const items = [o.propertyName, p?.propertyType, p?.owner?.name, p?.management?.name].filter(Boolean);
  return items.length ? items.slice(1).join(' • ') : (o.category || 'Opportunity');
}
function servicesStrip(o, limit=6) {
  const services = (o.recommendedServices || []).slice(0, limit);
  if (!services.length) return '';
  return `<div class="service-strip">${services.map(s => `<span>${esc(s)}</span>`).join('')}</div>`;
}
function findProperty(propertyId) {
  return (state.data?.properties || []).find(p => p.propertyId === propertyId);
}
function searchableText(o) {
  const p = findProperty(o.propertyId) || {};
  return [o.propertyName, p.address, p.parcelId, p.owner?.name, p.management?.name, o.category, o.territory, o.whatChanged, o.whyThisMatters, o.propertyResolution?.parcelId, o.permitCluster?.owner, ...(o.permitCluster?.permits || []).map(p => `${p.caseNumber} ${p.description} ${p.contractor} ${p.applicant}`), ...(o.sources || []).map(s => `${s.name} ${s.title}`), ...(o.recommendedServices || [])].filter(Boolean).join(' ').toLowerCase();
}
function filteredSortedOpportunities() {
  const q = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const sort = document.getElementById('sortSelect')?.value || 'score';
  const category = document.getElementById('categoryFilter')?.value || 'all';
  const minScore = Number(document.getElementById('scoreFilter')?.value || 0);
  const heat = document.getElementById('heatFilter')?.value || 'all';
  let items = [...(state.opportunities || [])];
  items = items.filter(o => {
    const score = o.ratings?.overall ?? 0;
    const cls = o.opportunityClass || o.category || '';
    if (score < minScore) return false;
    if (category !== 'all' && !cls.includes(category)) return false;
    if (heat !== 'all' && heatLabel(score) !== heat) return false;
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
function opportunityListItem(o, rank) {
  const score = o.ratings?.overall ?? 0;
  const p = findProperty(o.propertyId) || {};
  const selected = state.selectedId === o.id ? ' selected' : '';
  const expanded = state.selectedId === o.id ? `<div class="inline-detail">${renderDetail(o, true)}</div>` : '';
  return `<article class="opp-card${selected}" data-id="${esc(o.id)}">
    <button type="button" class="opp-row${selected}" data-id="${esc(o.id)}" aria-expanded="${state.selectedId === o.id ? 'true' : 'false'}">
      <span class="thumb">${rank}</span>
      <span class="opp-main"><strong>${esc(o.propertyName || 'Property Requires Verification')}</strong><small>${esc(p.address || o.county || '')}</small><em>${esc(propertySubline(o))}</em></span>
      <span class="opp-score heat-${heatLabel(score).toLowerCase()}"><b>${score}</b><small>${heatLabel(score)}</small></span>
      <span class="chev">${state.selectedId === o.id ? '⌃' : '⌄'}</span>
    </button>
    ${expanded}
  </article>`;
}
function renderOpportunities() {
  const items = filteredSortedOpportunities();
  const visible = items;
  if (state.selectedId && !items.some(o => o.id === state.selectedId)) {
    state.selectedId = null;
    state.selectedTab = 'overview';
  }
  document.getElementById('feedStatus').textContent = `Showing all ${items.length} matching properties`; 
  const mapStatus = document.getElementById('mapStatus');
  if (mapStatus) mapStatus.textContent = `Map showing the same ${items.length} properties in the list`; 
  document.getElementById('opportunities').innerHTML = visible.map((o,i) => opportunityListItem(o, i + 1)).join('') || '<p class="empty">No properties match the current filters.</p>';
  document.querySelectorAll('.opp-row').forEach(btn => btn.addEventListener('click', () => selectOpportunity(btn.dataset.id)));
  wireDetailInteractions();
  renderMap(items);
}
function scoreBox(label, value, cls='') {
  return `<div class="score-box ${cls}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}
function verifiedBy(o) {
  const verifications = [];
  if (o.propertyResolution?.status) verifications.push('Mecklenburg GIS');
  if (o.permitCluster) verifications.push('Permit Database');
  if ((o.opportunityClass || '').includes('Incident')) verifications.push('Public Incident Source');
  if ((o.sources || []).some(s => /news|observer|wcnc|wsoc|wbtv|google/i.test(`${s.name} ${s.url}`))) verifications.push('News / Public Records');
  if ((o.sources || []).length) verifications.push(`${o.sources.length} Evidence Source${o.sources.length === 1 ? '' : 's'}`);
  return [...new Set(verifications)].slice(0, 6);
}
function scoreBreakdown(o) {
  const breakdown = (o.signalBreakdown || []);
  if (!breakdown.length) return '<p class="empty">Score drivers pending.</p>';
  return `<ul class="drivers">${breakdown.map(x => `<li><span>✓ ${esc(x.label)}</span><b>+${esc(x.points)}</b></li>`).join('')}</ul>`;
}
function evidenceLinks(o) {
  const sources = (o.sources || []);
  if (!sources.length) return '<p class="empty">No evidence links available.</p>';
  return sources.map((s, index) => `<a class="evidence-link" href="${esc(s.url)}" target="_blank" rel="noopener"><strong>${index + 1}. ${esc(s.name || 'Source')}</strong><span>${esc(s.title || 'Public source record')}</span><small>${fmtDateTime(s.publishedAt)}</small></a>`).join('');
}
function permitTimeline(o) {
  const permits = (o.permitCluster?.permits || []).slice().sort((a,b) => new Date(b.issuedDate || 0) - new Date(a.issuedDate || 0));
  if (!permits.length) return timelineItemsForOpportunity(o);
  return permits.map(p => `<li>
    <time>${fmtDateTime(p.issuedDate)}</time>
    <div><strong>${esc(p.category || 'Permit Issued')}</strong><span>${esc(p.caseNumber || '')} ${p.cost ? `• ${money(p.cost)}` : ''}</span><small>${esc(p.description || '')}</small>
    <small class="permit-source">Source: ${esc(p.sourceLabel || 'Permit Source')}</small>
    <div class="mini-links">
      ${p.caseNumber ? `<button type="button" class="copy-btn" data-copy="${esc(p.caseNumber)}">Copy Permit #</button>` : ''}
      ${p.officialSearchUrl ? `<a href="${esc(p.officialSearchUrl)}" target="_blank" rel="noopener">${esc(p.officialSearchLabel || 'Open Permit Search')}</a>` : ''}
      ${p.sourceRecordUrl ? `<a href="${esc(p.sourceRecordUrl)}" target="_blank" rel="noopener">View County Source Record</a>` : ''}
      ${p.contractor ? `<a href="${esc(p.contractorSearchUrl)}" target="_blank" rel="noopener">${esc(p.contractor)}</a>` : ''}
    </div></div>
  </li>`).join('');
}
function timelineItemsForOpportunity(o) {
  return `<li><time>${fmtDateTime(o.eventDate || o.publishedDate)}</time><div><strong>${esc(o.category || 'Signal')}</strong><span>${esc(o.whatChanged || '')}</span>${(o.sources || [])[0]?.url ? `<div class="mini-links"><a href="${esc(o.sources[0].url)}" target="_blank" rel="noopener">View Evidence</a></div>` : ''}</div></li>`;
}
function detailTabButton(tab, label) {
  const active = state.selectedTab === tab ? ' active' : '';
  return `<button type="button" class="tab-btn${active}" data-tab="${tab}">${label}</button>`;
}
function renderOverviewTab(o, p, score, intelligenceScore) {
  const projectDescription = o.projectDescription || o.whatChanged || opportunityLead(o);
  return `<section class="pir-section"><h3>What Changed</h3><p>${esc(opportunityLead(o))}</p></section>
    <section class="pir-section"><h3>Project Description</h3><p>${esc(projectDescription)}</p></section>
    <section class="pir-section"><h3>What We Know</h3><p>${esc(o.whatChanged || opportunityLead(o))}</p></section>
    <section class="pir-section"><h3>Why This Matters</h3><p>${esc(o.whyThisMatters || '')}</p></section>
    <section class="pir-kpis compact-kpis">
      <div><span>Latest Activity</span><strong>${fmtDateTime(latestActivityDate(o))}</strong><small>${relativeAge(latestActivityDate(o))}</small></div>
      <div><span>Sources</span><strong>${o.evidenceCount || 0}</strong><small>Verified</small></div>
      <div><span>Listed Permit Value</span><strong>${compactMoney(o.permitCluster?.totalCost || 0)}</strong><small>${o.permitCluster ? 'Permit cluster' : 'Not listed'}</small></div>
    </section>
    <section class="pir-section"><h3>Relevant Services</h3>${servicesStrip(o, 10)}</section>
    <section class="pir-section"><h3>Opportunity Indicators</h3>${scoreBreakdown(o)}</section>
    <section class="pir-section"><h3>Verified By</h3><div class="verified-list">${verifiedBy(o).map(v => `<span>✓ ${esc(v)}</span>`).join('') || '<span>Verification pending</span>'}</div></section>`;
}
function renderTimelineTab(o) {
  return `<section class="pir-section"><h3>Timeline <small>Newest first</small></h3><ul class="detail-timeline">${permitTimeline(o)}</ul></section>`;
}
function renderDetailsTab(o, p) {
  const rows = [
    ['Property', o.propertyName || p.propertyName || 'Pending'],
    ['Address', p.address || o.propertyResolution?.address || 'Pending'],
    ['County / Territory', p.county || o.county || o.territory || 'Pending'],
    ['Property Type', p.propertyType || 'Needs Classification'],
    ['Parcel', p.parcelId || o.propertyResolution?.parcelId || 'Pending'],
    ['Owner', p.owner?.name || o.permitCluster?.owner || 'Pending'],
    ['Management', p.management?.name || 'Pending'],
    ['Permit Count', o.permitCluster?.permitCount || p.permitSummary?.permitCount || 0],
    ['Listed Permit Value', compactMoney(o.permitCluster?.totalCost || p.permitSummary?.totalCost || 0)]
  ];
  return `<section class="pir-section"><h3>Property Details</h3><div class="detail-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div></section>`;
}
function renderEvidenceTab(o) {
  return `<section class="pir-section"><h3>Evidence</h3>${evidenceLinks(o)}</section>`;
}
function renderMapTab(o, p) {
  return `<section class="pir-section"><h3>Map Context</h3><p>${esc(p.address || o.propertyName || 'Selected property')} is highlighted on the Property Map below. Click another map marker or property row to update this record.</p></section>`;
}
function renderDetailBody(o, p, score, intelligenceScore) {
  if (state.selectedTab === 'timeline') return renderTimelineTab(o);
  if (state.selectedTab === 'details') return renderDetailsTab(o, p);
  if (state.selectedTab === 'map') return renderMapTab(o, p);
  if (state.selectedTab === 'evidence') return renderEvidenceTab(o);
  return renderOverviewTab(o, p, score, intelligenceScore);
}
function renderDetail(o, inline=false) {
  if (!o) return '<div class="empty-detail">Select a property to view its Property Intelligence Record.</div>';
  const p = findProperty(o.propertyId) || {};
  const score = o.ratings?.overall ?? 0;
  const intelligenceScore = p.dataQuality?.overall || o.ratings?.confidence || 0;
  return `<div class="detail-head">
      <div><h2>${esc(o.propertyName || 'Property Requires Verification')}</h2><p>${esc(p.address || o.county || '')}</p><small>${[p.propertyType, p.permitSummary?.permitCount ? `${p.permitSummary.permitCount} permits` : '', p.parcelId ? `Parcel ${p.parcelId}` : ''].filter(Boolean).join(' • ')}</small></div>
      <div class="detail-actions"><div class="detail-scores">${scoreBox('Opportunity Score', score, 'opportunity')}${scoreBox('Intelligence Score', intelligenceScore, 'intel')}</div>${inline ? '<button type="button" class="collapse-btn" data-collapse="1">Collapse</button>' : ''}</div>
    </div>
    <div class="tab-row" role="tablist">
      ${detailTabButton('overview', 'Overview')}
      ${detailTabButton('timeline', 'Timeline')}
      ${detailTabButton('details', 'Details')}
      ${detailTabButton('map', 'Map')}
      ${detailTabButton('evidence', 'Evidence')}
    </div>
    <div class="detail-body">${renderDetailBody(o, p, score, intelligenceScore)}</div>`;
}
function selectOpportunity(id, updateList=true) {
  const o = state.opportunities.find(x => x.id === id);
  if (!o) return;
  if (state.selectedId === o.id) {
    state.selectedId = null;
    state.selectedTab = 'overview';
  } else {
    state.selectedId = o.id;
    state.selectedTab = 'overview';
  }
  if (updateList) renderOpportunities();
}
function wireDetailInteractions() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', (event) => {
    event.stopPropagation();
    state.selectedTab = btn.dataset.tab || 'overview';
    renderOpportunities();
  }));
  document.querySelectorAll('.collapse-btn').forEach(btn => btn.addEventListener('click', (event) => {
    event.stopPropagation();
    state.selectedId = null;
    state.selectedTab = 'overview';
    renderOpportunities();
  }));
  document.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', async (event) => {
    event.stopPropagation();
    const value = btn.dataset.copy || '';
    try { await navigator.clipboard.writeText(value); btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy Permit #', 1200); }
    catch { btn.textContent = value; }
  }));
}
function renderMap(items) {
  const container = document.getElementById('mapCanvas');
  if (!container) return;
  const positions = [[18,23],[36,58],[50,34],[70,26],[78,62],[31,42],[57,71],[84,40],[45,51],[66,48],[24,70],[55,20],[12,54],[40,18],[74,78],[88,24],[62,14],[29,80],[47,75],[91,60],[16,36],[53,56],[68,40],[81,52],[35,70],[59,29],[22,14],[44,43],[72,66],[10,72],[96,42],[6,28],[31,62],[63,84],[49,21]];
  const markers = items.map((o,i) => {
    const score = o.ratings?.overall ?? 0;
    const pos = positions[i % positions.length];
    const selected = state.selectedId === o.id ? ' selected' : '';
    return `<button type="button" class="map-marker ${heatLabel(score).toLowerCase()}${selected}" style="left:${pos[0]}%;top:${pos[1]}%" data-id="${esc(o.id)}" title="${esc(o.propertyName)}">${i+1}</button>`;
  }).join('');
  container.innerHTML = `<div class="map-label charlotte">Charlotte</div><div class="road r1"></div><div class="road r2"></div><div class="road r3"></div><div class="road r4"></div>${markers}`;
  container.querySelectorAll('.map-marker').forEach(btn => btn.addEventListener('click', () => selectOpportunity(btn.dataset.id)));
}
function propertyCard(p) {
  return `<article class="property-card"><div><h3>${esc(p.propertyName || p.address || 'Property')}</h3><p>${esc(p.address || '')}</p></div><div class="resolution-grid"><div><span>Parcel</span><strong>${esc(p.parcelId || 'Pending')}</strong></div><div><span>Type</span><strong>${esc(p.propertyType || 'Pending')}</strong></div><div><span>Owner</span><strong>${esc(p.owner?.name || 'Pending')}</strong></div><div><span>Permits</span><strong>${p.permitSummary?.permitCount || 0}</strong></div><div><span>Value</span><strong>${compactMoney(p.permitSummary?.totalCost || 0)}</strong></div><div><span>Data Quality</span><strong>${p.dataQuality?.overall || 'Pending'}${p.dataQuality?.overall ? '%' : ''}</strong></div></div></article>`;
}
function organizationRow(o) {
  return `<div class="org-row"><strong>${esc(o.name)}</strong><span>${esc((o.roles || [o.type]).join(', '))}</span><small>${o.propertyIds?.length || 0} properties • ${o.evidenceCount || 0} evidence records${o.watchList ? ' • Watch list' : ''}</small></div>`;
}
function sourceRow(h) {
  const cls = h.status === 'pass' ? 'pass' : 'fail';
  return `<div class="source ${cls}"><strong>${esc(h.source)}</strong><span>${esc(h.query || '')}</span><small>${esc(h.status?.toUpperCase() || 'UNKNOWN')} • ${h.itemsRetrieved ?? 0} items${h.opportunitiesCreated !== undefined ? ` • ${h.opportunitiesCreated} opportunities` : ''} • ${h.durationMs ?? 0}ms</small></div>`;
}
function qaRows(summary={}) {
  const rows = [
    ['Permit Records Retrieved', summary.permitRecordsRetrieved ?? 0], ['Permit Candidates', summary.permitCandidates ?? 0],
    ['Permit Address Clusters', summary.permitClusters ?? 0], ['Temporary/Event Permits Excluded', summary.permitRejectedTemporary ?? 0],
    ['Residential/Unknown Permits Excluded', summary.permitRejectedResidential ?? 0], ['Non-Target Permits Excluded', summary.permitRejectedNonTarget ?? 0],
    ['Incident Records Retrieved', summary.incidentRecordsRetrieved ?? 0], ['Incident Candidates', summary.incidentCandidates ?? 0],
    ['Social/Public Records Retrieved', summary.socialRecordsRetrieved ?? 0], ['Social/Public Candidates', summary.socialCandidates ?? 0],
    ['GIS Parcel Matches', `${summary.gisMatches ?? 0}/${summary.gisLookups ?? 0}`],
    ['Properties Created/Updated', summary.properties ?? 0], ['Organizations Resolved', summary.organizations ?? 0],
    ['Signals Created', summary.signals ?? 0], ['Evidence Records', summary.evidence ?? 0],
    ['Out of Territory Excluded', summary.outOfTerritoryExcluded ?? 0],
    ['Residential / Noise Excluded', (summary.nonCommercialExcluded ?? 0) + (summary.permitRejectedResidential ?? 0)],
    ['Old Items Excluded', (summary.oldItemsExcluded ?? 0) + (summary.permitOldExcluded ?? 0)], ['Duplicates Removed', summary.duplicateRawExcluded ?? 0]
  ];
  return rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
}
function renderData(data) {
  data = scrubPublicObject(data);
  const s = data.summary || {};
  const highPriority = (data.opportunities || []).filter(o => (o.ratings?.overall ?? 0) >= 90).length;
  const permitValue = (data.opportunities || []).reduce((sum, o) => sum + Number(o.permitCluster?.totalCost || 0), 0);
  document.getElementById('briefLine').textContent = `${s.opportunities ?? 0} qualified properties identified from public records. ${s.incidentOpportunities || 0} incident/building-condition signals.`;
  document.getElementById('lastUpdated').textContent = `Updated ${fmtDateTime(data.generatedAt)}`;
  document.getElementById('sideStatus').textContent = 'Live';
  document.getElementById('sideUpdated').textContent = `Last update: ${relativeAge(data.generatedAt) || fmtDateTime(data.generatedAt)}`;
  document.getElementById('metrics').innerHTML = [
    metricCard("Today's Properties", s.opportunities ?? 0, 'New or updated', '▦'),
    metricCard('High Priority', highPriority, 'Score 90+', '⚑'),
    metricCard('Active Permits', s.permitCandidates ?? 0, `${s.incidentOpportunities || 0} incident signals`, '▣'),
    metricCard('Permit Value', compactMoney(permitValue), 'Listed value', '$'),
    metricCard('Data Confidence', `${Math.round(((s.gisMatches || 0) / Math.max(s.gisLookups || 1, 1)) * 100)}%`, 'GIS match rate', '◇')
  ].join('');
  document.getElementById('sourceHealth').innerHTML = (data.health || []).map(sourceRow).join('') || '<p>No source health available.</p>';
  document.getElementById('properties').innerHTML = (data.properties || []).slice(0, 12).map(propertyCard).join('') || '<p class="empty">No property intelligence records generated yet.</p>';
  document.getElementById('organizations').innerHTML = (data.organizations || []).slice(0, 20).map(organizationRow).join('') || '<p class="empty">No organizations resolved yet.</p>';
  document.getElementById('qaMetrics').innerHTML = qaRows(s);
  state.data = data;
  state.opportunities = data.opportunities || [];
  state.selectedId = null;
  renderOpportunities();
}
async function loadData() {
  document.getElementById('metrics').innerHTML = metricCard('Status', 'Loading', 'Reading generated data');
  try {
    const res = await fetch(`data/opportunities.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`Data file not found (${res.status})`);
    renderData(await res.json());
  } catch (err) {
    document.getElementById('metrics').innerHTML = metricCard('Status', 'No Data', 'Run GitHub Actions');
    document.getElementById('briefLine').textContent = 'Run GitHub Actions → Update Intelligence, then refresh this page.';
    document.getElementById('opportunities').innerHTML = '<p class="empty">Run GitHub Actions → Update Intelligence, then refresh this page.</p>';
    const detail = document.getElementById('propertyDetail'); if (detail) detail.innerHTML = '<div class="empty-detail">No data loaded.</div>';
  }
}
document.getElementById('refreshBtn').addEventListener('click', loadData);
document.getElementById('filterToggle').addEventListener('click', () => document.getElementById('filterRow').classList.toggle('open'));
['searchInput','sortSelect','categoryFilter','scoreFilter','heatFilter'].forEach(id => document.getElementById(id)?.addEventListener('input', renderOpportunities));
loadData();
