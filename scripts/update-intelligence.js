import fs from 'node:fs/promises';
import { sources } from '../config/sources.js';
import { groupOpportunities, stripHtml } from './pi-core.js';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'PI/0.2.3 source validation' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripHtml(m?.[1] || '');
}

function parseGoogleNewsRss(xml, sourceConfig) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return itemBlocks.map(item => ({
    title: extractTag(item, 'title'),
    description: extractTag(item, 'description'),
    link: extractTag(item, 'link'),
    publishedAt: extractTag(item, 'pubDate'),
    source: sourceConfig.id,
    module: sourceConfig.module
  }));
}

async function main() {
  const now = new Date();
  const allRecords = [];
  const sourceHealth = [];
  for (const source of sources) {
    const started = Date.now();
    try {
      const xml = await fetchText(source.url);
      const records = parseGoogleNewsRss(xml, source);
      allRecords.push(...records);
      sourceHealth.push({
        id: source.id,
        module: source.module,
        status: 'PASS',
        recordsRetrieved: records.length,
        durationMs: Date.now() - started,
        lastRun: now.toISOString()
      });
    } catch (err) {
      sourceHealth.push({
        id: source.id,
        module: source.module,
        status: 'WARN',
        recordsRetrieved: 0,
        durationMs: Date.now() - started,
        error: err.message,
        lastRun: now.toISOString()
      });
    }
  }
  const { opportunities, rejected } = groupOpportunities(allRecords, now);
  const rejectedCounts = rejected.reduce((acc, item) => {
    for (const r of item.reasons) acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const data = {
    generatedAt: now.toISOString(),
    version: '0.2.3-qe001',
    summary: {
      recordsRetrieved: allRecords.length,
      opportunitiesCreated: opportunities.length,
      rejected: rejected.length,
      rejectedCounts,
      sourceCount: sources.length
    },
    sourceHealth,
    opportunities,
    rejectedSample: rejected.slice(0, 20)
  };
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/opportunities.json', JSON.stringify(data, null, 2));
  console.log(`Generated ${opportunities.length} opportunities from ${allRecords.length} records. Rejected ${rejected.length}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
