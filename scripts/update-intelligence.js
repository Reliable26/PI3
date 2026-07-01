import fs from 'node:fs/promises';
import path from 'node:path';
import { runConnectors } from '../core/connector-manager.js';
import { buildOpportunities } from '../core/opportunity-engine.js';
import { commercialFireConnector } from '../connectors/commercial-fire-intelligence.js';
import territory from '../config/territory.json' assert { type: 'json' };
import rules from '../config/rules.json' assert { type: 'json' };
import watchlist from '../config/watchlist.json' assert { type: 'json' };
import { nowIso } from '../core/utils.js';

const connectors = [commercialFireConnector];

async function main() {
  const startedAt = nowIso();
  const { events, health } = await runConnectors(connectors);
  const built = buildOpportunities(events, rules, territory, watchlist);

  const intelligence = {
    meta: {
      generatedAt: nowIso(),
      startedAt,
      version: '0.1.0',
      environment: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
      note: 'Generated at deployment/runtime. Generated JSON should not be committed manually.'
    },
    summary: {
      connectorsConfigured: connectors.length,
      connectorsPassing: health.filter(h => h.status === 'PASS').length,
      itemsRetrieved: health.reduce((sum, h) => sum + (h.itemsRetrieved || 0), 0),
      commercialSignalsFound: events.length,
      residentialFiltered: built.residentialFiltered + health.reduce((sum, h) => sum + (h.residentialFiltered || 0), 0),
      opportunitiesCreated: built.opportunities.length,
      highPriority: built.opportunities.filter(o => o.opportunityScore >= 85).length,
      averageConfidence: built.opportunities.length ? Math.round(built.opportunities.reduce((sum, o) => sum + o.confidenceScore, 0) / built.opportunities.length) : 0
    },
    sourceHealth: health,
    opportunities: built.opportunities,
    watchListActivity: built.opportunities.filter(o => o.managementCompany !== 'Needs Verification')
  };

  await fs.mkdir('dist/data', { recursive: true });
  await fs.writeFile('dist/data/intelligence.json', JSON.stringify(intelligence, null, 2));
  await fs.writeFile('dist/data/source-health.json', JSON.stringify(health, null, 2));
  await fs.writeFile('dist/data/opportunities.json', JSON.stringify(built.opportunities, null, 2));
  console.log(`PI update complete: ${built.opportunities.length} opportunities from ${events.length} commercial signals.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
