import { nowIso } from './utils.js';
import { createHealthRecord } from './source-health.js';

export async function runConnectors(connectors) {
  const events = [];
  const health = [];

  for (const connector of connectors) {
    const startedAt = nowIso();
    try {
      const result = await connector.run();
      events.push(...(result.events || []));
      health.push(createHealthRecord({
        connectorId: connector.id,
        connectorName: connector.name,
        status: 'PASS',
        startedAt,
        itemsRetrieved: result.itemsRetrieved || 0,
        commercialMatches: result.events?.length || 0,
        residentialFiltered: result.residentialFiltered || 0,
        opportunitiesCreated: result.events?.length || 0,
        errors: []
      }));
    } catch (error) {
      health.push(createHealthRecord({
        connectorId: connector.id,
        connectorName: connector.name,
        status: 'FAIL',
        startedAt,
        errors: [String(error?.message || error)]
      }));
    }
  }

  return { events, health };
}
