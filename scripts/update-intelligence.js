import fs from 'fs/promises';
import path from 'path';
import { runConnectors } from '../core/connector-manager.js';
import { buildOpportunities } from '../core/opportunity-engine.js';

const outDir = path.resolve('dist/data');
await fs.mkdir(outDir, { recursive: true });
const connectorResults = await runConnectors();
const events = connectorResults.flatMap(r => r.events || []);
const { opportunities, rejected } = buildOpportunities(events);
const payload = {
  meta: {
    app: 'PI',
    version: '0.2.0-developer-preview',
    generatedAt: new Date().toISOString(),
    note: 'Generated during GitHub Actions; not committed back to repository.',
    eventsRetrieved: events.length,
    opportunitiesCreated: opportunities.length,
    rejectedEvents: rejected.length
  },
  sourceHealth: connectorResults.map(r => ({
    module: r.connector,
    version: r.version || 'unknown',
    status: r.status,
    durationMs: r.durationMs || 0,
    itemsRetrieved: r.itemsRetrieved || 0,
    sourceResults: r.sourceResults || [],
    error: r.error || null
  })),
  opportunities,
  rejectedSample: rejected.slice(0, 10).map(x => ({ headline: x.event.headline, reason: x.classification.reason, source: x.event.sourceName }))
};
await fs.writeFile(path.join(outDir, 'opportunities.json'), JSON.stringify(payload, null, 2));
console.log(`PI update complete: ${events.length} events, ${opportunities.length} opportunities.`);
