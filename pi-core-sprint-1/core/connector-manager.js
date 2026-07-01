import { createHealth } from './models.js';
import { connector as fireConnector } from '../connectors/fire/charlotte-fire.js';
import { connector as newsConnector } from '../connectors/news/google-news.js';

const connectors = [fireConnector, newsConnector];

export async function runConnectors() {
  const allEvents = [];
  const health = [];
  for (const c of connectors) {
    const startedAt = new Date().toISOString();
    try {
      const events = await c.run();
      allEvents.push(...events);
      health.push(createHealth({ id: c.id, name: c.name, status: 'PASS', itemsRetrieved: events.length, opportunitiesCreated: 0, startedAt, finishedAt: new Date().toISOString() }));
    } catch (err) {
      health.push(createHealth({ id: c.id, name: c.name, status: 'FAIL', itemsRetrieved: 0, opportunitiesCreated: 0, errors: [err.message], startedAt, finishedAt: new Date().toISOString() }));
    }
  }
  return { events: allEvents, health };
}
