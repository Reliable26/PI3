import { buildOpportunities } from '../core/opportunity-engine.js';
import territory from '../config/territory.json' assert { type: 'json' };
import rules from '../config/rules.json' assert { type: 'json' };
import watchlist from '../config/watchlist.json' assert { type: 'json' };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fireEvent = {
  connector: 'Test',
  eventId: '1',
  dateFound: new Date().toISOString(),
  category: 'fire',
  headline: 'Apartment fire reported in Charlotte',
  description: 'Working fire at apartment community in Mecklenburg County',
  sourceUrl: 'https://example.com',
  confidence: 75
};
const residentialEvent = {
  connector: 'Test',
  eventId: '2',
  dateFound: new Date().toISOString(),
  category: 'fire',
  headline: 'Single family house fire in Charlotte',
  description: 'Residential home fire',
  sourceUrl: 'https://example.com',
  confidence: 75
};
const result = buildOpportunities([fireEvent, residentialEvent], rules, territory, watchlist);
assert(result.opportunities.length === 1, 'Expected exactly one commercial opportunity');
assert(result.residentialFiltered === 1, 'Expected one residential item filtered');
assert(result.opportunities[0].opportunityScore >= 80, 'Expected high fire opportunity score');
console.log('Tests passed');
