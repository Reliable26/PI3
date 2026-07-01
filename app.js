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
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
};
function metric(label, value) { return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`; }
function sourceRow(h) {
  const cls = h.status === 'pass' ? 'pass' : 'fail';
  return `<div class="source ${cls}"><strong>${h.source}</strong><span>${h.query || ''}</span><small>${h.status?.toUpperCase() || 'UNKNOWN'} • ${h.itemsRetrieved ?? 0} items • ${h.durationMs ?? 0}ms</small></div>`;
}
function scoreBar(label, value) {
  return `<div class="score-row"><span>${label}</span><b>${value}</b><div class="bar"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div></div>`;
}
function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Not listed';
  return n.toLocaleString([], { style:'currency', currency:'USD', maximumFractionDigits:0 });
}
function permitClusterBlock(o) {
  const cluster = o.permitCluster;
  if (!cluster) return '';
  const permits = (cluster.permits || []).map(p => `<li>
    <strong>${p.caseNumber || 'Permit'}</strong> <span>${p.category || ''}</span>
    <em>${fmtDateTime(p.issuedDate)} • ${money(p.cost)}</em>
    <small>${p.description || ''}</small>
    <div class="permit-links">
      ${p.permitDetailUrl ? `<a href="${p.permitDetailUrl}" target="_blank" rel="noopener">Permit detail</a>` : ''}
      ${p.contractor ? `<a href="${p.contractorSearchUrl}" target="_blank" rel="noopener">${p.contractor}</a>` : '<span>Contractor/filer not exposed in permit layer</span>'}
    </div>
  </li>`).join('');
  return `<h4>Permit Cluster</h4>
    <p>${cluster.permitCount || 0} permit${cluster.permitCount === 1 ? '' : 's'} at this address from ${fmtDateTime(cluster.firstIssuedDate)} to ${fmtDateTime(cluster.latestIssuedDate)}. Total listed value: <strong>${money(cluster.totalCost)}</strong>.</p>
    ${cluster.owner ? `<p><strong>Owner from permit record:</strong> ${cluster.owner}</p>` : ''}
    <ul class="permits">${permits}</ul>`;
}
function opportunityCard(o) {
  const ratings = o.ratings || {};
  const sources = (o.sources || []).map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name || 'Source'}</a><span>${fmtDateTime(s.publishedAt)}</span><em>${s.title || ''}</em></li>`).join('');
  const services = (o.recommendedServices || []).map(x => `<li>${x}</li>`).join('');
  const breakdown = (o.signalBreakdown || []).map(x => `<li><span>${x.label}</span><b>+${x.points}</b></li>`).join('');
  return `<article class="card">
    <div class="card-top">
      <div>
        <h3>${o.propertyName || 'Property Requires Verification'}</h3>
        <p>${o.category || 'Opportunity'} • ${o.propertyStatus || 'Needs Verification'}</p>
      </div>
      <div class="rating"><span>${ratings.overall ?? 0}</span><small>Rating</small></div>
    </div>
    <div class="date-grid">
      <div><span>Event / Published</span><strong>${fmtDateTime(o.publishedDate)}</strong><small>${relativeAge(o.publishedDate)}</small></div>
      <div><span>PI Detected</span><strong>${fmtDateTime(o.piDetectedDate)}</strong><small>${relativeAge(o.piDetectedDate)}</small></div>
      <div><span>Evidence</span><strong>${o.evidenceCount || 0} source${o.evidenceCount === 1 ? '' : 's'}</strong><small>${o.territory || ''}</small></div>
    </div>
    <div class="scores">
      ${scoreBar('Opportunity', ratings.opportunity ?? 0)}
      ${scoreBar('Confidence', ratings.confidence ?? 0)}
      ${scoreBar('Freshness', ratings.freshness ?? 0)}
      ${scoreBar('Impact', ratings.impact ?? 0)}
      ${scoreBar('Coverage', ratings.coverage ?? 0)}
    </div>
    <details>
      <summary>Open brief and evidence</summary>
      <h4>What Changed</h4><p>${o.whatChanged || ''}</p>
      <h4>Why Now</h4><p>${o.whyNow || ''}</p>
      <h4>Why This Matters</h4><p>${o.whyThisMatters || ''}</p>
      <h4>Recommended Services</h4><ul>${services}</ul>
      ${permitClusterBlock(o)}
      <h4>Score Breakdown</h4><ul class="breakdown">${breakdown}</ul>
      <h4>Supporting Public Sources</h4><ul class="sources">${sources}</ul>
    </details>
  </article>`;
}
async function loadData() {
  const metrics = document.getElementById('metrics');
  const sourceHealth = document.getElementById('sourceHealth');
  const opportunities = document.getElementById('opportunities');
  const feedStatus = document.getElementById('feedStatus');
  const lastUpdated = document.getElementById('lastUpdated');
  metrics.innerHTML = metric('Status', 'Loading');
  try {
    const res = await fetch(`data/opportunities.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`Data file not found (${res.status})`);
    const data = await res.json();
    const s = data.summary || {};
    lastUpdated.textContent = `Generated ${fmtDateTime(data.generatedAt)}`;
    metrics.innerHTML = [
      metric('Opportunities', s.opportunities ?? 0),
      metric('Emergency', s.emergencyOpportunities ?? 0),
      metric('Capital Improvement', s.capitalImprovementOpportunities ?? 0),
      metric('Permit Records Retrieved', s.permitRecordsRetrieved ?? 0),
      metric('Permit Address Clusters', s.permitClusters ?? 0),
      metric('Out of Territory Excluded', s.outOfTerritoryExcluded ?? 0),
      metric('Residential / Noise Excluded', (s.nonCommercialExcluded ?? 0) + (s.permitExcluded ?? 0))
    ].join('');
    sourceHealth.innerHTML = (data.health || []).map(sourceRow).join('') || '<p>No source health available.</p>';
    feedStatus.textContent = `${(data.opportunities || []).length} active`;
    opportunities.innerHTML = (data.opportunities || []).map(opportunityCard).join('') || '<p class="empty">No recent commercial fire opportunities found inside the current recency window.</p>';
  } catch (err) {
    metrics.innerHTML = metric('Status', 'No Data');
    sourceHealth.innerHTML = `<p class="empty">${err.message}</p>`;
    opportunities.innerHTML = '<p class="empty">Run GitHub Actions → Update Intelligence, then refresh this page.</p>';
  }
}
document.getElementById('refreshBtn').addEventListener('click', loadData);
loadData();
