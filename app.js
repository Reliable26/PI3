async function loadData(){
  const res=await fetch('intelligence.json?cache='+Date.now());
  const data=await res.json();
  const opps=data.opportunities||[]; const health=data.sourceHealth||[];
  document.getElementById('loaded').textContent=`Loaded ${opps.length} opportunities`;
  document.getElementById('events').textContent=`${data.meta?.eventsRetrieved||0} events retrieved`;
  document.getElementById('updated').textContent=`Last update: ${data.meta?.generatedAt?new Date(data.meta.generatedAt).toLocaleString():'--'}`;
  document.getElementById('mOpp').textContent=opps.length;
  document.getElementById('mHigh').textContent=opps.filter(o=>o.priority==='Critical'||o.score>=85).length;
  document.getElementById('mVerify').textContent=opps.filter(o=>o.propertyStatus==='Needs Verification').length;
  document.getElementById('mHealth').textContent=`${health.filter(h=>h.status==='PASS').length}/${health.length}`;
  document.getElementById('health').innerHTML=health.map(h=>`<div class="health-row"><div><b>${h.module}</b><br><span class="meta">${h.itemsRetrieved||0} items • ${h.durationMs||0} ms</span></div><div class="${h.status==='PASS'?'pass':'research'}">${h.status}</div></div>`).join('')||'<div class="empty">No source health reported.</div>';
  document.getElementById('opps').innerHTML=opps.map(o=>`<div class="opp"><div class="opp-top"><div><div class="opp-title">${escapeHtml(o.propertyName||'Property requires verification')}</div><span class="tag ${o.priority==='Critical'?'critical':''}">${o.priority||'Review'}</span><span class="tag">${o.category}</span><span class="tag">Confidence ${o.confidence}</span>${o.propertyStatus==='Needs Verification'?'<span class="tag verify">Needs Verification</span>':''}<div class="meta">${o.address||'Address requires verification'} • ${o.territory||'Charlotte Metro'} • ${o.propertyType||'Commercial'}</div></div><div class="score">${o.score}</div></div><p><b>What changed:</b> ${escapeHtml(o.whatChanged)}</p><p><b>Why now:</b> ${escapeHtml(o.whyNow)}</p><p><b>Why this matters:</b> ${escapeHtml(o.whyThisMatters)}</p><p><b>Services:</b> ${(o.recommendedServices||[]).join(', ')}</p><p><b>Sources:</b> ${(o.sources||[]).map(s=>`<a href="${s.url}" target="_blank" rel="noreferrer">${escapeHtml(s.name)}</a>`).join(', ')}</p></div>`).join('')||'<div class="empty">No opportunities generated.</div>';
}
function escapeHtml(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
loadData();
