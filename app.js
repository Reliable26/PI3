async function loadIntelligence() {
  const status = document.getElementById('lastUpdated');
  status.textContent = 'Loading intelligence...';
  try {
    const response = await fetch(`data/intelligence.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No intelligence file found (${response.status})`);
    const data = await response.json();
    render(data);
  } catch (error) {
    status.textContent = `Last update: no generated data loaded`;
    document.getElementById('topOpportunities').textContent = 'No intelligence data found yet. Run GitHub Actions -> Update Intelligence.';
    document.getElementById('sourceHealth').textContent = String(error.message || error);
  }
}

function render(data) {
  const summary = data.summary || {};
  document.getElementById('lastUpdated').textContent = `Last update: ${formatDate(data.meta?.generatedAt)}`;
  document.getElementById('metricOpps').textContent = summary.opportunitiesCreated ?? 0;
  document.getElementById('metricHigh').textContent = summary.highPriority ?? 0;
  document.getElementById('metricHealth').textContent = `${summary.connectorsPassing ?? 0}/${summary.connectorsConfigured ?? 0}`;
  document.getElementById('metricConfidence').textContent = `${summary.averageConfidence ?? 0}%`;

  renderTop(data.opportunities || []);
  renderHealth(data.sourceHealth || []);
  renderFeed(data.opportunities || []);
}

function renderTop(opportunities) {
  const el = document.getElementById('topOpportunities');
  if (!opportunities.length) {
    el.className = 'cards empty';
    el.textContent = 'No validated opportunities were created from the latest update.';
    return;
  }
  el.className = 'cards';
  el.innerHTML = opportunities.slice(0, 10).map(cardHtml).join('');
}

function cardHtml(o, index) {
  const services = (o.recommendedServices || []).map(s => `<span class="service">${escapeHtml(s)}</span>`).join('');
  const source = (o.supportingSources || [])[0];
  return `<article class="card">
    <div class="card-top">
      <div>
        <h3>${index + 1}. ${escapeHtml(o.property)}</h3>
        <div class="meta">${escapeHtml(o.propertyType)} • ${escapeHtml(o.county)} • ${escapeHtml(o.category)}</div>
      </div>
      <div class="score">${o.opportunityScore}</div>
    </div>
    <span class="badge">Confidence ${o.confidenceScore}%</span>
    <p class="reason"><strong>What changed:</strong> ${escapeHtml(o.whatChanged)}</p>
    <p class="reason"><strong>Why this matters:</strong> ${escapeHtml(o.whyThisMatters)}</p>
    <div class="services">${services}</div>
    ${source?.url ? `<p class="meta"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Public source</a></p>` : ''}
  </article>`;
}

function renderHealth(health) {
  const el = document.getElementById('sourceHealth');
  if (!health.length) {
    el.className = 'health empty';
    el.textContent = 'No connector results loaded.';
    return;
  }
  el.className = 'health';
  el.innerHTML = health.map(h => `<div class="health-row">
    <div>
      <strong>${escapeHtml(h.connectorName)}</strong><br>
      <span class="meta">Items: ${h.itemsRetrieved} • Matches: ${h.commercialMatches} • ${h.durationMs}ms</span>
    </div>
    <div class="${h.status === 'PASS' ? 'pass' : 'fail'}">${h.status}</div>
  </div>`).join('');
}

function renderFeed(opportunities) {
  const el = document.getElementById('opportunityFeed');
  if (!opportunities.length) {
    el.className = 'feed empty';
    el.textContent = 'No opportunities loaded.';
    return;
  }
  el.className = 'feed';
  el.innerHTML = opportunities.map(o => `<div class="feed-item">
    <strong>${escapeHtml(o.property)}</strong> — ${escapeHtml(o.whatChanged)}<br>
    <span class="meta">Score ${o.opportunityScore} • Confidence ${o.confidenceScore} • ${formatDate(o.firstSeen)}</span>
  </div>`).join('');
}

function formatDate(value) {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

document.getElementById('refreshBtn').addEventListener('click', loadIntelligence);
loadIntelligence();
