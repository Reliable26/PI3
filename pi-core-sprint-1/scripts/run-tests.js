import { buildOpportunities } from '../core/opportunity-engine.js';
import rules from '../config/rules.json' assert { type: 'json' };
const events = [
  { connector:'test', headline:'Apartment fire reported in Charlotte', description:'Apartment fire in Charlotte', sourceUrl:'https://example.com', confidence:80 },
  { connector:'test', headline:'Single family house fire in Charlotte', description:'single family house fire', sourceUrl:'https://example.com', confidence:80 },
  { connector:'test', headline:'Commercial warehouse fire in Mecklenburg County', description:'commercial warehouse fire', sourceUrl:'https://example.com', confidence:80 }
];
const opps = buildOpportunities(events, rules);
if (opps.length !== 2) throw new Error(`Expected 2 opportunities, got ${opps.length}`);
console.log('Tests passed');
