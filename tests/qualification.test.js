import assert from 'node:assert/strict';
import { extractPropertyName, qualifyRecord, groupOpportunities } from '../scripts/pi-core.js';

const now = new Date('2026-07-01T12:00:00Z');

assert.equal(extractPropertyName('Fire damages Ashley Place Apartments - Charlotte Observer'), 'Ashley Place Apartments');
assert.equal(extractPropertyName('Commercial fire at SouthPark Mall - WCNC'), 'SouthPark Mall');

const belgium = qualifyRecord({
  title: 'Fire damages apartment building in Belgium',
  description: 'World News article',
  link: 'https://wnct.com/news/world/fire-belgium/',
  publishedAt: '2026-07-01T10:00:00Z',
  source: 'wnct'
}, now);
assert.equal(belgium.qualified, false);
assert.ok(belgium.rejected.some(r => /territory|global|section/i.test(r)));

const charlotteApt = qualifyRecord({
  title: 'Fire damages Ashley Place Apartments in Charlotte',
  description: 'Residents displaced after apartment fire in Mecklenburg County NC',
  link: 'https://example.com/local/ashley-place-fire',
  publishedAt: '2026-07-01T10:00:00Z',
  source: 'local'
}, now);
assert.equal(charlotteApt.qualified, true);
assert.equal(charlotteApt.propertyName, 'Ashley Place Apartments in Charlotte');

const stale = qualifyRecord({
  title: 'Fire damages apartment complex in Charlotte',
  description: 'Mecklenburg County',
  link: 'https://example.com/local/old-fire',
  publishedAt: '2024-07-01T10:00:00Z',
  source: 'local'
}, now);
assert.equal(stale.qualified, false);
assert.ok(stale.rejected.some(r => /stale/i.test(r)));

const grouped = groupOpportunities([
  { title: 'Fire damages Ashley Place Apartments in Charlotte', description: 'Mecklenburg apartment fire', link: 'https://a.example', publishedAt: '2026-07-01T10:00:00Z', source: 'A' },
  { title: 'Fire damages Ashley Place Apartments in Charlotte - second report', description: 'Mecklenburg apartment fire', link: 'https://b.example', publishedAt: '2026-07-01T10:30:00Z', source: 'B' }
], now);
assert.equal(grouped.opportunities.length, 1);
assert.equal(grouped.opportunities[0].evidenceCount, 2);

console.log('qualification tests passed');
