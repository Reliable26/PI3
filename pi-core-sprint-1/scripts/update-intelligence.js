import fs from 'node:fs/promises';
import { runConnectors } from '../core/connector-manager.js';
import { buildOpportunities } from '../core/opportunity-engine.js';

const rules = JSON.parse(await fs.readFile('config/rules.json', 'utf8'));
await fs.mkdir('public', { recursive: true });

const { events, health } = await runConnectors();
const opportunities = buildOpportunities(events, rules);
const healthWithCounts = health.map(h => ({ ...h, opportunitiesCreated: opportunities.filter(o => o.sources?.some(s => s.name === h.name)).length }));

const payload = {
  generatedAt: new Date().toISOString(),
  version: '0.1.0',
  summary: {
    eventsRetrieved: events.length,
    opportunitiesCreated: opportunities.length,
    highPriority: opportunities.filter(o => o.opportunityScore >= 85).length
  },
  sourceHealth: healthWithCounts,
  opportunities
};

await fs.writeFile('public/intelligence.json', JSON.stringify(payload, null, 2));
console.log(`Generated ${opportunities.length} opportunities from ${events.length} events.`);
